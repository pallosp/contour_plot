import assert from 'minimalistic-assert';

import {alignToGrid, overlappingArea, Rect} from './rect';
import {Run, Square} from './types';

interface Node<T> extends Square<T> {
  /** True iff the square is not further subdivided. */
  leaf: boolean;
}

/** Plot state. */
interface State<T> {
  // Nodes of the underlying quadtree, keyed by x * cx + y * cy
  readonly nodes: Map<number, Node<T>>;
  // Domain rectangle aligned to a multiple of sampleSpacing
  readonly domain: Rect;
  // Initial density of the points to evaluate.
  readonly sampleSpacing: number;
  // Maximum density of the points to evaluate.
  readonly pixelSize: number;
  // Coefficients to map valid (x, y) points in the domain to distinct integers
  readonly cx: number;
  readonly cy: number;
}

export interface ComputeStats {
  size: number;
  deltaSize: number;
  affectedPixels: number;
  elapsedMs: number;
}

function createState<T>(
    domain: Rect, sampleSpacing: number, pixelSize: number): State<T> {
  assert(Number.isInteger(Math.log2(sampleSpacing)));
  assert(Number.isInteger(Math.log2(pixelSize)));

  sampleSpacing = Math.max(pixelSize, sampleSpacing);
  domain = alignToGrid(domain, sampleSpacing);
  const nodes = new Map<number, Node<T>>();
  const cx = 2 / pixelSize;
  const cy = domain.width / pixelSize * cx;

  return {nodes, domain, sampleSpacing, pixelSize, cx, cy};
}

const EMPTY_STATE: State<unknown> =
    createState({x: 0, y: 0, width: 0, height: 0}, 1, 1);

/**
 * A special value assigned to tree nodes where the function is known to take at
 * least two distinct values within the node's area.
 */
const NON_UNIFORM = Symbol();

export class Plot<T> {
  private state = EMPTY_STATE as State<T>;
  private stats:
      ComputeStats = {size: 0, deltaSize: 0, affectedPixels: 0, elapsedMs: 0};

  /**
   * LIFO queue of quadtree nodes for which the plotted function's value has
   * been computed, but it hasn't been decided whether the node should be
   * subdivided.
   */
  private readonly queue: Array<Node<T>> = [];

  constructor(readonly func: (x: number, y: number) => T) {};

  /**
   * Evaluates the function passed to the constructor at every grid point within
   * the `domain` rectangle, spaced `sampleSpacing` apart. If neighboring points
   * have different values, the function is refined between them at double
   * resolution, continuing until the resolution reaches `pixelSize`.
   */
  public compute(domain: Rect, sampleSpacing: number, pixelSize: number): this {
    const startTime = performance.now();
    const prevState = this.state;
    const state = createState<T>(domain, sampleSpacing, pixelSize);
    domain = state.domain;
    sampleSpacing = state.sampleSpacing;

    const reuse = sampleSpacing === prevState.sampleSpacing &&
        pixelSize === prevState.pixelSize &&
        overlappingArea(domain, prevState.domain) ===
            domain.width * domain.height;
    let prevSize = 0;
    let reusedArea = 0;
    if (reuse) {
      this.copyFiltered(prevState.nodes, state);
      if (pixelSize === prevState.pixelSize) {
        reusedArea = overlappingArea(domain, prevState.domain);
      }
      prevSize = state.nodes.size;
    } else {
      const shouldEnqueue = pixelSize < sampleSpacing;
      this.computeGrid(state, shouldEnqueue);
    }

    this.state = state;
    this.traverse();

    this.stats.size = state.nodes.size;
    this.stats.deltaSize = state.nodes.size - prevSize;
    this.stats.affectedPixels =
        (domain.width * domain.height - reusedArea) / pixelSize ** 2;
    this.stats.elapsedMs = performance.now() - startTime;

    return this;
  }

  /**
   * Computes the function at the grid points `state.sampleSpacing` apart.
   * Optionally adds the created quadtree nodes to the traversal queue.
   */
  private computeGrid(state: State<T>, enqueue: boolean) {
    const {nodes, domain, sampleSpacing, cx, cy} = state;
    const {func, queue} = this;

    const xStart = domain.x + sampleSpacing / 2;
    const xStop = domain.x + domain.width;
    const yStart = domain.y + sampleSpacing / 2;
    const yStop = domain.y + domain.height;

    for (let y = yStart; y < yStop; y += sampleSpacing) {
      for (let x = xStart; x < xStop; x += sampleSpacing) {
        const key = cx * x + cy * y;
        const node = {x, y, size: sampleSpacing, value: func(x, y), leaf: true};
        nodes.set(key, node);
        if (enqueue) queue.push(node);
      }
    }
  }

  /**
   * Copies the nodes that meet the constraints of `state` from `sourceNodes`
   * to `state.nodes`.
   */
  private copyFiltered(sourceNodes: Map<number, Node<T>>, state: State<T>) {
    const {nodes, domain, sampleSpacing, pixelSize, cx, cy} = state;
    const {x, y} = domain;
    const right = x + domain.width;
    const bottom = y + domain.height;

    for (const node of sourceNodes.values()) {
      if (node.x > x && node.x < right && node.y > y && node.y < bottom &&
          node.size >= pixelSize && node.size <= sampleSpacing) {
        nodes.set(node.x * cx + node.y * cy, node);
      }
    }
  }

  private addChildren(x: number, y: number, size: number) {
    const func = this.func;
    const {cx, cy, nodes} = this.state;
    x -= size / 4;
    y -= size / 4;
    size /= 2;

    let key = cx * x + cy * y;
    const leaf1 = {x, y, size, value: func(x, y), leaf: true};
    nodes.set(key, leaf1);

    x += size;
    key += size * cx;
    const leaf2 = {x, y, size, value: func(x, y), leaf: true};
    nodes.set(key, leaf2);

    y += size;
    key += size * cy;
    const leaf3 = {x, y, size, value: func(x, y), leaf: true};
    nodes.set(key, leaf3);

    x -= size;
    key -= size * cx;
    const leaf4 = {x, y, size, value: func(x, y), leaf: true};
    nodes.set(key, leaf4);

    this.queue.push(leaf1, leaf2, leaf3, leaf4);
  }

  /**
   * Splits the given leaf node into 4 quadrants. Ensures that the tree stays
   * balanced, i.e. the sizes of adjacent nodes differ by at most a factor of 2.
   */
  private subdivideLeaf(node: Node<T>) {
    const {x, y, size} = node;
    const state = this.state;
    node.leaf = false;

    const parentSize = size * 2;
    const parentX = (Math.floor(x / parentSize) + 0.5) * parentSize;
    const parentY = (Math.floor(y / parentSize) + 0.5) * parentSize;
    const parentKey = state.cx * parentX + state.cy * parentY;
    const xNeighbor = state.nodes.get(parentKey + 4 * (x - parentX) * state.cx);
    const yNeighbor = state.nodes.get(parentKey + 4 * (y - parentY) * state.cy);

    if (xNeighbor?.leaf) this.subdivideLeaf(xNeighbor);
    if (yNeighbor?.leaf) this.subdivideLeaf(yNeighbor);

    this.addChildren(x, y, size);
  }

  /**
   * Processes all leaf nodes in the queue. When the node different from any of
   * its neighbors, subdivides it as well as the different neighbors.
   */
  private traverse() {
    const queue = this.queue;
    const {cx, cy, nodes, pixelSize} = this.state;
    let node: Node<T>|undefined;
    while ((node = queue.pop())) {
      if (!node.leaf) continue;

      const {x, y, size, value} = node;
      const parentSize = size * 2;
      const parentX = (Math.floor(x / parentSize) + 0.5) * parentSize;
      const parentY = (Math.floor(y / parentSize) + 0.5) * parentSize;
      const key = cx * x + cy * y;
      const parentKey = parentX * cx + parentY * cy;

      if (size === pixelSize) {
        // x/y neighbors with 2px size
        const nx = nodes.get(parentKey + (x - parentX) * 4 * cx);
        const ny = nodes.get(parentKey + (y - parentY) * 4 * cy);
        if (nx?.leaf && value !== nx.value) this.subdivideLeaf(nx);
        if (ny?.leaf && value !== ny.value) this.subdivideLeaf(ny);
        continue;
      }

      const n =
          nodes.get(key - size * cy) ?? nodes.get(parentKey - parentSize * cy);
      const e =
          nodes.get(key + size * cx) ?? nodes.get(parentKey + parentSize * cx);
      const s =
          nodes.get(key + size * cy) ?? nodes.get(parentKey + parentSize * cy);
      const w =
          nodes.get(key - size * cx) ?? nodes.get(parentKey - parentSize * cx);

      let subdivideThis = false;
      if (n && value !== n.value) {
        if (n.leaf) this.subdivideLeaf(n);
        subdivideThis = true;
      }
      if (e && value !== e.value) {
        if (e.leaf) this.subdivideLeaf(e);
        subdivideThis = true;
      }
      if (s && value !== s.value) {
        if (s.leaf) this.subdivideLeaf(s);
        subdivideThis = true;
      }
      if (w && value !== w.value) {
        if (w.leaf) this.subdivideLeaf(w);
        subdivideThis = true;
      }

      if (subdivideThis) {
        this.subdivideLeaf(node);
      }
    }
  }

  /**
   * Helper function to traverse the tree and collect the nodes for
   * this.squares(). Returns the common value of the subtree nodes, or
   * NON_UNIFORM if they are different.
   */
  private collectSquares(node: Node<T>, squares: Array<Square<T>>): T|symbol {
    if (node.leaf) {
      return node.value;
    }
    const {x, y, size} = node;
    const childRadius = size / 4;
    const {cx, cy, nodes} = this.state;
    const key = cx * x + cy * y;
    const child1 = nodes.get(key + childRadius * (cx + cy))!;
    const child2 = nodes.get(key + childRadius * (cx - cy))!;
    const child3 = nodes.get(key - childRadius * (cx + cy))!;
    const child4 = nodes.get(key - childRadius * (cx - cy))!;
    const v1 = this.collectSquares(child1, squares);
    const v2 = this.collectSquares(child2, squares);
    const v3 = this.collectSquares(child3, squares);
    const v4 = this.collectSquares(child4, squares);
    if (v1 === NON_UNIFORM || v1 !== v2 || v1 !== v3 || v1 !== v4) {
      if (v1 !== NON_UNIFORM) squares.push(child1);
      if (v2 !== NON_UNIFORM) squares.push(child2);
      if (v3 !== NON_UNIFORM) squares.push(child3);
      if (v4 !== NON_UNIFORM) squares.push(child4);
      return NON_UNIFORM;
    }
    node.value = v1 as T;
    return v1;
  }

  /**
   * Returns a list of squares that cover the domain rectangle without overlap,
   * and within each square the plotted function evaluates to the same value.
   * When compression is enabled, merges equal valued neighboring squares.
   */
  squares(compress = true): Array<Square<T>> {
    const squares: Array<Square<T>> = [];
    const {nodes, sampleSpacing} = this.state;
    if (compress) {
      for (const node of nodes.values()) {
        if (node.size < sampleSpacing) break;
        if (this.collectSquares(node, squares) !== NON_UNIFORM) {
          squares.push(node);
        }
      }
    } else {
      for (const node of nodes.values()) {
        if (node.leaf) squares.push(node);
      }
    }
    return squares;
  }

  /**
   * Statistics about the last computation.
   */
  computeStats(): ComputeStats {
    return this.stats;
  }

  private leafAt(x: number, y: number): Node<T> {
    let node: Node<T>|undefined;
    const state = this.state;
    let size = state.pixelSize;
    while (!(node = state.nodes.get(state.cx * x + state.cy * y))) {
      size *= 2;
      x = (Math.floor(x / size) + 0.5) * size;
      y = (Math.floor(y / size) + 0.5) * size;
    }
    return node;
  }

  /**
   * Returns the plot as a list of "runs". Each run is a horizontal line
   * aligned to the center of the "pixels", along which the plotted function's
   * value is considered constant.
   */
  runs(): Array<Run<T>> {
    const {cx, cy, domain, nodes, pixelSize} = this.state;
    const right = domain.x + domain.width;
    const bottom = domain.y + domain.height;
    const xMin = (Math.floor(domain.x / pixelSize) + 0.5) * pixelSize;
    const yMin = (Math.floor(domain.y / pixelSize) + 0.5) * pixelSize;
    const xMax = (Math.ceil(right / pixelSize) - 0.5) * pixelSize;
    const yMax = (Math.ceil(bottom / pixelSize) - 0.5) * pixelSize;
    const runs: Array<Run<T>> = [];
    for (let y = yMin; y <= yMax; y += pixelSize) {
      let lastNode = this.leafAt(xMin, y);
      let lastRun: Run<T> = {
        xMin,
        xMax: lastNode.x + (lastNode.size - pixelSize) / 2,
        y,
        value: lastNode.value,
      };
      runs.push(lastRun);
      while (lastRun.xMax < xMax) {
        const rightX = lastNode.x + lastNode.size;
        const rightY = lastNode.y;
        let node = nodes.get(cx * rightX + cy * rightY);
        if (!node) {
          const parentSize = lastNode.size * 2;
          const parentX = rightX + parentSize / 4;
          const parentY = (Math.floor(rightY / parentSize) + 0.5) * parentSize;
          node = nodes.get(cx * parentX + cy * parentY)!;
        } else if (!node.leaf) {
          const offset = lastNode.size / 4;
          const childX = rightX - offset;
          const childY = y > rightY ? rightY + offset : rightY - offset;
          node = nodes.get(cx * childX + cy * childY)!;
        }
        if (node.value === lastNode.value) {
          lastRun.xMax += node.size;
        } else {
          lastRun = {
            xMin: lastRun.xMax + pixelSize,
            xMax: lastRun.xMax + node.size,
            y,
            value: node.value,
          };
          runs.push(lastRun);
        }
        lastNode = node;
      }
      lastRun.xMax = xMax;
    }
    return runs;
  }
}

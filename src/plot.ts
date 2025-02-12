import assert from 'minimalistic-assert';

import {alignToGrid, overlappingArea, Rect} from './rect';
import {Run, Square} from './types';

interface Node<T> extends Square<T> {
  value: T;
  /** True iff the square is not further subdivided. */
  leaf: boolean;
}

type NodeMap<T> = Map<number, Node<T>>;

/** Plot state. */
interface State<T> {
  /** Nodes of the underlying quadtree, keyed by x * cx + y * cy */
  nodes: NodeMap<T>;
  /** Domain rectangle aligned to a multiple of sampleSpacing */
  readonly domain: Rect;
  /** Initial density of the points to evaluate */
  readonly sampleSpacing: number;
  /** Maximum density of the points to evaluate */
  readonly pixelSize: number;
  /**
   * x-coefficient of the linear function that maps valid (x, y) points in the
   * domain to distinct integers
   */
  readonly cx: number;
  /**
   * y-coefficient of the linear function that maps valid (x, y) points in the
   * domain to distinct integers
   */
  readonly cy: number;
}

export interface ComputeStats {
  /** Number of stored function values. */
  size: number;
  /** Number of evaluations of the plotted function during the computation. */
  newCalls: number;
  /** Number of pixels in the (re)computed area. */
  newArea: number;
  /** Elapsed time. */
  elapsedMs: number;
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
      ComputeStats = {size: 0, newCalls: 0, newArea: 0, elapsedMs: 0};

  /**
   * LIFO queue of quadtree nodes for which the plotted function's value has
   * been computed, but it hasn't been decided whether the node should be
   * subdivided.
   */
  private readonly queue: Array<Node<T>> = [];

  constructor(private readonly func: (x: number, y: number) => T) {};

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

    const overlap = overlappingArea(domain, prevState.domain);
    const reuse = sampleSpacing === prevState.sampleSpacing &&
        pixelSize === prevState.pixelSize && overlap > 0;
    this.stats.newCalls = 0;
    let reusedArea = 0;

    if (reuse) {
      if (haveSameBoundaries(state, prevState)) {
        state.nodes = prevState.nodes;
      } else {
        this.computeGrid(state, prevState);
        copyNodesFiltered(prevState, state, this.queue);
      }
      if (pixelSize === prevState.pixelSize) {
        reusedArea = overlap;
      }
    } else {
      this.computeGrid(state, EMPTY_STATE as State<T>);
    }

    this.state = state;
    if (pixelSize < sampleSpacing) {
      this.traverse();
    } else {
      this.queue.length = 0;
    }

    this.stats.size = state.nodes.size;
    this.stats.newArea =
        (domain.width * domain.height - reusedArea) / pixelSize ** 2;
    this.stats.elapsedMs = performance.now() - startTime;

    return this;
  }

  /**
   * Domain of the last computation. Its boundaries are aligned to the multiples
   * of `sampleSpacing`. Empty rectangle if `compute()` hasn't been called yet.
   */
  public domain(): Rect {
    return this.state.domain;
  }

  /**
   * Resolution of the last computation (height of the smallest square).
   */
  public pixelSize(): number {
    return this.state.pixelSize;
  }

  /**
   * Statistics about the last computation.
   */
  public computeStats(): ComputeStats {
    return this.stats;
  }

  /**
   * Returns a list of squares that cover the domain rectangle without overlap,
   * and within each square the plotted function evaluates to the same value.
   *
   * Merges equal valued neighboring squares by default. Pass `{all: true}` to
   * list all squares.
   */
  public squares(options: {all?: boolean} = {}): Array<Square<T>> {
    const squares: Array<Square<T>> = [];
    const {nodes, sampleSpacing} = this.state;
    if (options.all) {
      for (const node of nodes.values()) {
        if (node.leaf) squares.push(node);
      }
    } else {
      for (const node of nodes.values()) {
        if (node.size < sampleSpacing) break;
        if (this.collectSquares(node, squares) !== NON_UNIFORM) {
          squares.push(node);
        }
      }
    }
    return squares;
  }

  /**
   * Returns the plot as a list of "runs". Each run is a horizontal line
   * aligned to the center of the "pixels", along which the plotted function's
   * value is considered constant.
   */
  public runs(): Array<Run<T>> {
    const {cx, cy, domain, nodes, pixelSize} = this.state;

    const xMin = domain.x;
    const yMin = domain.y;
    const xMax = xMin + domain.width;
    const yMax = yMin + domain.height;
    const runs: Array<Run<T>> = [];
    if (xMin === xMax) return runs;

    for (let y = yMin + pixelSize / 2; y < yMax; y += pixelSize) {
      let lastNode = this.leafAt(xMin + pixelSize / 2, y);
      let lastRun: Run<T> = {
        xMin,
        xMax: xMin + lastNode.size,
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
            xMin: lastRun.xMax,
            xMax: lastRun.xMax + node.size,
            y,
            value: node.value,
          };
          runs.push(lastRun);
        }
        lastNode = node;
      }
    }

    return runs;
  }

  /**
   * Computes the function at the grid points `state.sampleSpacing` apart.
   * Reuses already computed nodes from prevState. Adds the newly created nodes
   * to the traversal queue.
   */
  private computeGrid(state: State<T>, prevState: State<T>) {
    const {nodes, domain, sampleSpacing, cx, cy} = state;
    const {func, queue} = this;

    const xStart = domain.x + sampleSpacing / 2;
    const xStop = xStart + domain.width;
    const yStart = domain.y + sampleSpacing / 2;
    const yStop = yStart + domain.height;

    const prevNodes = prevState.nodes.size > 0 ? prevState.nodes : undefined;
    const prevCx = prevState.cx;
    const prevCy = prevState.cy;

    let funcCalls = 0;

    for (let y = yStart; y < yStop; y += sampleSpacing) {
      for (let x = xStart; x < xStop; x += sampleSpacing) {
        const key = cx * x + cy * y;
        let node = prevNodes?.get(prevCx * x + prevCy * y);
        if (node === undefined) {
          node = {x, y, size: sampleSpacing, value: func(x, y), leaf: true};
          queue.push(node);
          funcCalls++;
        }
        nodes.set(key, node);
      }
    }

    this.stats.newCalls += funcCalls;
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
    this.stats.newCalls += 4;
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

  private leafAt(x: number, y: number): Node<T> {
    let node: Node<T>|undefined;
    const state = this.state;
    let size = state.pixelSize;
    while (!(node = state.nodes.get(state.cx * x + state.cy * y)) &&
           size < state.sampleSpacing) {
      size *= 2;
      x = (Math.floor(x / size) + 0.5) * size;
      y = (Math.floor(y / size) + 0.5) * size;
    }
    assert(node);
    return node;
  }
}

function createState<T>(
    domain: Rect, sampleSpacing: number, pixelSize: number): State<T> {
  assert(Number.isInteger(Math.log2(sampleSpacing)));
  assert(Number.isInteger(Math.log2(pixelSize)));
  assert(domain.width >= 0);
  assert(domain.height >= 0);

  sampleSpacing = Math.max(pixelSize, sampleSpacing);
  domain = alignToGrid(domain, sampleSpacing);
  const nodes = new Map<number, Node<T>>();
  const cx = 2 / pixelSize;
  const cy = domain.width / pixelSize * cx;

  return {nodes, domain, sampleSpacing, pixelSize, cx, cy};
}

/**
 * Tells whether the two states have the same domain, sample spacing and pixel
 * size.
 */
function haveSameBoundaries(
    state1: State<unknown>, state2: State<unknown>): boolean {
  const d1 = state1.domain;
  const d2 = state2.domain;
  return d1.x === d2.x && d1.y === d2.y && d1.width === d2.width &&
      d1.height === d2.height && state1.pixelSize === state2.pixelSize &&
      state1.sampleSpacing === state2.sampleSpacing;
}

/**
 * Copies the nodes that meet the constraints of the target state from
 * `source.nodes` to `target.nodes`. Adds the nodes at the target boundary to
 * the traversal queue.
 */
function copyNodesFiltered<T>(
    source: State<T>, target: State<T>, queue: Array<Node<T>>) {
  const {nodes, domain, sampleSpacing, cx, cy} = target;

  const x0 = domain.x;
  const y0 = domain.y;
  const x1 = x0 + domain.width;
  const y1 = y0 + domain.height;

  const sd = source.domain;
  const sx0 = sd.x;
  const sy0 = sd.y;
  const sx1 = sx0 + sd.width;
  const sy1 = sy0 + sd.height;

  for (const node of source.nodes.values()) {
    const {x, y, size} = node;
    if (size >= sampleSpacing) continue;
    let enqueue = false;

    if (x0 >= sx0) {
      if (x < x0) continue;
    } else {
      if (x < sx0 + sampleSpacing - 2 * size) continue;
      if (x < sx0 + sampleSpacing) enqueue = true;
      if (x < sx0 + sampleSpacing - size / 2) node.leaf = true;
    }

    if (y0 >= sy0) {
      if (y < y0) continue;
    } else {
      if (y < sy0 + sampleSpacing - 2 * size) continue;
      if (y < sy0 + sampleSpacing) enqueue = true;
      if (y < sy0 + sampleSpacing - size / 2) node.leaf = true;
    }

    if (x1 <= sx1) {
      if (x > x1) continue;
    } else {
      if (x > sx1 - sampleSpacing + 2 * size) continue;
      if (x > sx1 - sampleSpacing) enqueue = true;
      if (x > sx1 - sampleSpacing + size / 2) node.leaf = true;
    }

    if (y1 <= sy1) {
      if (y > y1) continue;
    } else {
      if (y > sy1 - sampleSpacing + 2 * size) continue;
      if (y > sy1 - sampleSpacing) enqueue = true;
      if (y > sy1 - sampleSpacing + size / 2) node.leaf = true;
    }

    nodes.set(x * cx + y * cy, node);
    if (enqueue) queue.push(node);
  }
}

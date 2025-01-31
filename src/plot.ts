import assert from 'minimalistic-assert';

import {Rect, Run, Square} from './types';

interface Node<T> extends Square<T> {
  /** True iff the square is not further subdivided. */
  leaf: boolean;
}

/**
 * A special value assigned to tree nodes where the function is known to take at
 * least two distinct values within the node's area.
 */
const NON_UNIFORM = Symbol();

export class Plot<T> {
  /**
   * Nodes of the underlying quadtree, keyed by x * cx + y * cy.
   */
  private nodes = new Map<number, Node<T>>();

  /**
   * Coefficients to map valid (x, y) coordinates in the domain rectangle to
   * unique integers.
   */
  private cx = 0;
  private cy = 0;

  /** Rectangle in which this.func was last evaluated. */
  private domain: Rect = {x: 0, y: 0, width: 0, height: 0};
  private sampleSpacing = 0;
  private pixelSize = 0;

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
    assert(Number.isInteger(Math.log2(sampleSpacing)));
    assert(Number.isInteger(Math.log2(pixelSize)));

    const squareSize = Math.max(pixelSize, sampleSpacing);
    const right = domain.x + domain.width;
    const bottom = domain.y + domain.height;
    const xStart = (Math.floor(domain.x / squareSize) + 0.5) * squareSize;
    const yStart = (Math.floor(domain.y / squareSize) + 0.5) * squareSize;
    const xStop = (Math.ceil(right / squareSize) + 0.5) * squareSize;
    const yStop = (Math.ceil(bottom / squareSize) + 0.5) * squareSize;

    this.nodes = new Map();
    this.cx = 2 / pixelSize;
    this.cy = (xStop - xStart) / pixelSize * this.cx;

    for (let y = yStart; y < yStop; y += squareSize) {
      for (let x = xStart; x < xStop; x += squareSize) {
        const key = this.cx * x + this.cy * y;
        this.nodes.set(
            key, {x, y, size: squareSize, value: this.func(x, y), leaf: true});
      }
    }

    if (pixelSize < sampleSpacing) {
      this.queue.push(...this.nodes.values());
    }

    this.domain = {...domain};
    this.sampleSpacing = sampleSpacing;
    this.pixelSize = pixelSize;

    this.traverse();
    return this;
  }

  private addChildren(x: number, y: number, size: number) {
    const {cx, cy, func, nodes} = this;
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

    if (size >= this.pixelSize) {
      this.queue.push(leaf1, leaf2, leaf3, leaf4);
    }
  }

  /**
   * Splits the given leaf node into 4 quadrants. Ensures that the tree stays
   * balanced, i.e. the sizes of adjacent nodes differ by at most a factor of 2.
   */
  private subdivideLeaf(node: Node<T>) {
    const {x, y, size} = node;
    node.leaf = false;

    const parentSize = size * 2;
    const parentX = (Math.floor(x / parentSize) + 0.5) * parentSize;
    const parentY = (Math.floor(y / parentSize) + 0.5) * parentSize;
    const parentKey = this.cx * parentX + this.cy * parentY;
    const xNeighbor = this.nodes.get(parentKey + 4 * (x - parentX) * this.cx);
    const yNeighbor = this.nodes.get(parentKey + 4 * (y - parentY) * this.cy);

    if (xNeighbor?.leaf) this.subdivideLeaf(xNeighbor);
    if (yNeighbor?.leaf) this.subdivideLeaf(yNeighbor);

    this.addChildren(x, y, size);
  }

  /**
   * Processes all leaf nodes in the queue. When the node different from any of
   * its neighbors, subdivides it as well as the different neighbors.
   */
  private traverse() {
    const {cx, cy, nodes, pixelSize, queue} = this;
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
    const {cx, cy, nodes} = this;
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
    if (compress) {
      for (const node of this.nodes.values()) {
        if (node.size < this.sampleSpacing) break;
        if (this.collectSquares(node, squares) !== NON_UNIFORM) {
          squares.push(node);
        }
      }
    } else {
      for (const node of this.nodes.values()) {
        if (node.leaf) squares.push(node);
      }
    }
    return squares;
  }

  /**
   * Number of nodes in the underlying quadtree. It's equal to the number of
   * evaluations of the plotted function.
   */
  size(): number {
    return this.nodes.size;
  }

  private leafAt(x: number, y: number): Node<T> {
    let node: Node<T>|undefined;
    let size = this.pixelSize;
    while (!(node = this.nodes.get(this.cx * x + this.cy * y))) {
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
    const {cx, cy, domain, nodes, pixelSize} = this;
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

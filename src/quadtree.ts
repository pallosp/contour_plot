import assert from 'minimalistic-assert';

import {Rect, Run, Square} from './types';

interface Node<T> extends Square<T> {
  /** True iff the square is not further subdivided. */
  leaf: boolean;
}

/**
 * Special value used for composite Quadtree nodes whose subtree contains nodes
 * with at least two different values.
 */
const NON_UNIFORM = Symbol();

export class Quadtree<T> {
  /**
   * Quadtree nodes keyed by x*coeffX+y*coeffY.
   */
  private nodes = new Map<number, Node<T>>();

  /**
   * Powers of 2. x*coeffX+y*coeffY are unique integers for all possible
   * quadtree nodes in the viewport.
   */
  private coeffX = 0;
  private coeffY = 0;

  private viewport: Rect = {x: 0, y: 0, width: 0, height: 0};
  private sampleDistance = 0;
  private pixelSize = 0;

  /**
   * LIFO queue of nodes for which the plotted function's value has been
   * computed, but it hasn't been decided whether the node should be subdivided.
   */
  private readonly queue: Array<Node<T>> = [];

  constructor(readonly func: (x: number, y: number) => T) {};

  /**
   * Evaluates `this.func(x, y)` at each grid point within `viewport`, spaced
   * `sampleDistance` apart. If neighboring points have different values, the
   * function is refined between them at double resolution, continuing until
   * the resolution reaches `pixelSize`.
   */
  public compute(viewport: Rect, sampleDistance: number, pixelSize: number):
      this {
    assert(Number.isInteger(Math.log2(sampleDistance)));
    assert(Number.isInteger(Math.log2(pixelSize)));

    const squareSize = Math.max(pixelSize, sampleDistance);
    const right = viewport.x + viewport.width;
    const bottom = viewport.y + viewport.height;
    const xStart = (Math.floor(viewport.x / squareSize) + 0.5) * squareSize;
    const yStart = (Math.floor(viewport.y / squareSize) + 0.5) * squareSize;
    const xStop = (Math.ceil(right / squareSize) + 0.5) * squareSize;
    const yStop = (Math.ceil(bottom / squareSize) + 0.5) * squareSize;

    this.nodes = new Map();
    this.coeffX = 2 / pixelSize;
    this.coeffY = (xStop - xStart) / pixelSize * this.coeffX;

    for (let y = yStart; y < yStop; y += squareSize) {
      for (let x = xStart; x < xStop; x += squareSize) {
        const key = this.coeffX * x + this.coeffY * y;
        this.nodes.set(
            key, {x, y, size: squareSize, value: this.func(x, y), leaf: true});
      }
    }

    if (pixelSize < sampleDistance) {
      this.queue.push(...this.nodes.values());
    }

    this.viewport = {...viewport};
    this.sampleDistance = sampleDistance;
    this.pixelSize = pixelSize;

    this.traverse();
    return this;
  }

  private addChildren(x: number, y: number, size: number) {
    const {coeffX, coeffY, func, nodes} = this;
    x -= size / 4;
    y -= size / 4;
    size /= 2;

    let key = coeffX * x + coeffY * y;
    const leaf1 = {x, y, size, value: func(x, y), leaf: true};
    nodes.set(key, leaf1);

    x += size;
    key += size * coeffX;
    const leaf2 = {x, y, size, value: func(x, y), leaf: true};
    nodes.set(key, leaf2);

    y += size;
    key += size * coeffY;
    const leaf3 = {x, y, size, value: func(x, y), leaf: true};
    nodes.set(key, leaf3);

    x -= size;
    key -= size * coeffX;
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
    const parentKey = this.coeffX * parentX + this.coeffY * parentY;
    const xNeighbor =
        this.nodes.get(parentKey + 4 * (x - parentX) * this.coeffX);
    const yNeighbor =
        this.nodes.get(parentKey + 4 * (y - parentY) * this.coeffY);

    if (xNeighbor?.leaf) this.subdivideLeaf(xNeighbor);
    if (yNeighbor?.leaf) this.subdivideLeaf(yNeighbor);

    this.addChildren(x, y, size);
  }

  /**
   * Processes all leaf nodes in the queue. When the node different from any of
   * its neighbors, subdivides it as well as the different neighbors.
   */
  private traverse() {
    const {coeffX, coeffY, nodes, pixelSize, queue} = this;
    let node: Node<T>|undefined;
    while ((node = queue.pop())) {
      if (!node.leaf) continue;

      const {x, y, size, value} = node;
      const parentSize = size * 2;
      const parentX = (Math.floor(x / parentSize) + 0.5) * parentSize;
      const parentY = (Math.floor(y / parentSize) + 0.5) * parentSize;
      const key = coeffX * x + coeffY * y;
      const parentKey = parentX * coeffX + parentY * coeffY;

      if (size === pixelSize) {
        // x/y neighbors with 2px size
        const nx = nodes.get(parentKey + (x - parentX) * 4 * coeffX);
        const ny = nodes.get(parentKey + (y - parentY) * 4 * coeffY);
        if (nx?.leaf && value !== nx.value) this.subdivideLeaf(nx);
        if (ny?.leaf && value !== ny.value) this.subdivideLeaf(ny);
        continue;
      }

      const n = nodes.get(key - size * coeffY) ??
          nodes.get(parentKey - parentSize * coeffY);
      const e = nodes.get(key + size * coeffX) ??
          nodes.get(parentKey + parentSize * coeffX);
      const s = nodes.get(key + size * coeffY) ??
          nodes.get(parentKey + parentSize * coeffY);
      const w = nodes.get(key - size * coeffX) ??
          nodes.get(parentKey - parentSize * coeffX);

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
  private collectSquares(node: Node<T>, squares: Array<Node<T>>): T|symbol {
    if (node.leaf) {
      return node.value;
    }
    const {x, y, size} = node;
    const childRadius = size / 4;
    const {coeffX, coeffY, nodes} = this;
    const key = coeffX * x + coeffY * y;
    const child1 = nodes.get(key + childRadius * (coeffX + coeffY))!;
    const child2 = nodes.get(key + childRadius * (coeffX - coeffY))!;
    const child3 = nodes.get(key - childRadius * (coeffX + coeffY))!;
    const child4 = nodes.get(key - childRadius * (coeffX - coeffY))!;
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
   * Returns the smallest subset of tree nodes that cover the viewport, and
   * within each tree node the plotted function evaluates to the same value.
   */
  squares(): Array<Node<T>> {
    const squares: Array<Node<T>> = [];
    for (const node of this.nodes.values()) {
      if (node.size < this.sampleDistance) break;

      if (this.collectSquares(node, squares) !== NON_UNIFORM) {
        squares.push(node);
      }
    }
    return squares;
  }

  /** Returns the leaf nodes of the quadtree in no specific order. */
  leaves(): Array<Node<T>> {
    const leaves = [];
    for (const node of this.nodes.values()) {
      if (node.leaf) {
        leaves.push(node);
      }
    }
    return leaves;
  }

  /**
   * Number of nodes in the tree. It's equal to the number of evaluations of the
   * plotted function.
   */
  size(): number {
    return this.nodes.size;
  }

  private leafAt(x: number, y: number): Node<T> {
    let node: Node<T>|undefined;
    let size = this.pixelSize;
    while (!(node = this.nodes.get(this.coeffX * x + this.coeffY * y))) {
      size *= 2;
      x = (Math.floor(x / size) + 0.5) * size;
      y = (Math.floor(y / size) + 0.5) * size;
    }
    return node;
  }

  /**
   * Converts the tree to a list of "runs". Each run is a horizontal line
   * aligned to the center of the "pixels", along which the plotted function's
   * value is considered constant.
   */
  runs(): Array<Run<T>> {
    const {coeffX, coeffY, nodes, pixelSize, viewport} = this;
    const right = viewport.x + viewport.width;
    const bottom = viewport.y + viewport.height;
    const xMin = (Math.floor(viewport.x / pixelSize) + 0.5) * pixelSize;
    const yMin = (Math.floor(viewport.y / pixelSize) + 0.5) * pixelSize;
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
        let node = nodes.get(coeffX * rightX + coeffY * rightY);
        if (!node) {
          const parentSize = lastNode.size * 2;
          const parentX = rightX + parentSize / 4;
          const parentY = (Math.floor(rightY / parentSize) + 0.5) * parentSize;
          node = nodes.get(coeffX * parentX + coeffY * parentY)!;
        } else if (!node.leaf) {
          const offset = lastNode.size / 4;
          const childX = rightX - offset;
          const childY = y > rightY ? rightY + offset : rightY - offset;
          node = nodes.get(coeffX * childX + coeffY * childY)!;
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

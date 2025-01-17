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
  private readonly nodes = new Map<number, Node<T>>();

  /**
   * Powers of 2. x*coeffX+y*coeffY are unique integers for all possible
   * quadtree nodes in the viewport.
   */
  private readonly coeffX: number;
  private readonly coeffY: number;

  /**
   * LIFO queue of nodes for which the plotted function's value has been
   * computed, but it hasn't been decided whether the node should be subdivided.
   */
  private readonly queue: Array<Node<T>> = [];

  constructor(
      readonly func: (x: number, y: number) => T,
      readonly viewport: Rect,
      readonly sampleDistance: number,
      readonly pixelSize: number,
  ) {
    assert(Number.isInteger(Math.log2(sampleDistance)));
    assert(Number.isInteger(Math.log2(pixelSize)));
    const squareSize = Math.max(pixelSize, sampleDistance);
    const right = viewport.x + viewport.width;
    const bottom = viewport.y + viewport.height;
    const xStart = (Math.floor(viewport.x / squareSize) + 0.5) * squareSize;
    const yStart = (Math.floor(viewport.y / squareSize) + 0.5) * squareSize;
    const xStop = (Math.ceil(right / squareSize) + 0.5) * squareSize;
    const yStop = (Math.ceil(bottom / squareSize) + 0.5) * squareSize;
    this.coeffX = 2 / pixelSize;
    this.coeffY =
        (2 ** Math.ceil(Math.log2(xStop - xStart)) / pixelSize) * this.coeffX;
    for (let y = yStart; y < yStop; y += squareSize) {
      for (let x = xStart; x < xStop; x += squareSize) {
        this.nodes.set(this.coeffX * x + this.coeffY * y, {
          x,
          y,
          size: squareSize,
          value: func(x, y),
          leaf: true,
        });
      }
    }
    if (pixelSize < sampleDistance) {
      this.queue.push(...this.nodes.values());
    }
    let node: Node<T>|undefined;
    while ((node = this.queue.pop())) {
      if (node.leaf) {
        this.processLeaf(node);
      }
    }
  }

  private addLeaf(x: number, y: number, size: number) {
    const leaf: Node<T> = {x, y, size, value: this.func(x, y), leaf: true};
    this.nodes.set(this.coeffX * x + this.coeffY * y, leaf);
    if (size >= this.pixelSize) {
      this.queue.push(leaf);
    }
  }

  /**
   * Splits the given leaf node into 4 quadrants. Ensures that the tree stays
   * balanced, i.e. the sizes of adjacent nodes differ by at most a factor of 2.
   */
  private subdivideLeaf(node: Node<T>) {
    const {x, y, size} = node;
    const childSize = size / 2;
    const childRadius = size / 4;
    node.leaf = false;
    this.addLeaf(x - childRadius, y - childRadius, childSize);
    this.addLeaf(x + childRadius, y - childRadius, childSize);
    this.addLeaf(x - childRadius, y + childRadius, childSize);
    this.addLeaf(x + childRadius, y + childRadius, childSize);

    const parentSize = size * 2;
    const parentX = (Math.floor(x / parentSize) + 0.5) * parentSize;
    const parentY = (Math.floor(y / parentSize) + 0.5) * parentSize;
    const parentKey = this.coeffX * parentX + this.coeffY * parentY;
    const xNeighbor = this.nodes.get(
        parentKey + 4 * (x - parentX) * this.coeffX,
    );
    const yNeighbor = this.nodes.get(
        parentKey + 4 * (y - parentY) * this.coeffY,
    );
    if (xNeighbor?.leaf) {
      this.subdivideLeaf(xNeighbor);
    }
    if (yNeighbor?.leaf) {
      this.subdivideLeaf(yNeighbor);
    }
  }

  /**
   * If the given leaf node is different from any of its neighbors, subdivides
   * it as well as the different neighbors.
   */
  private processLeaf(leaf: Node<T>) {
    const {x, y, size, value} = leaf;
    const {coeffX, coeffY, nodes, pixelSize} = this;
    const parentSize = size * 2;
    const parentX = (Math.floor(x / parentSize) + 0.5) * parentSize;
    const parentY = (Math.floor(y / parentSize) + 0.5) * parentSize;
    const key = coeffX * x + coeffY * y;
    const parentKey = parentX * coeffX + parentY * coeffY;

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
      if (n.leaf && n.size > pixelSize) this.subdivideLeaf(n);
      subdivideThis = true;
    }
    if (e && value !== e.value) {
      if (e.leaf && e.size > pixelSize) this.subdivideLeaf(e);
      subdivideThis = true;
    }
    if (s && value !== s.value) {
      if (s.leaf && s.size > pixelSize) this.subdivideLeaf(s);
      subdivideThis = true;
    }
    if (w && value !== w.value) {
      if (w.leaf && w.size > pixelSize) this.subdivideLeaf(w);
      subdivideThis = true;
    }

    if (subdivideThis && leaf.size > pixelSize) {
      this.subdivideLeaf(leaf);
    }
  }

  /**
   * Traverses the tree from the given root node. Merges its subtrees in which
   * all nodes have the same value into a single node. Returns the common value
   * of the subtree nodes, or NON_UNIFORM if they are different.
   */
  private compressSubtree(node: Node<T>): T|symbol {
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
    const v1 = this.compressSubtree(child1);
    const v2 = this.compressSubtree(child2);
    const v3 = this.compressSubtree(child3);
    const v4 = this.compressSubtree(child4);
    if (v1 === NON_UNIFORM || v1 !== v2 || v1 !== v3 || v1 !== v4) {
      return NON_UNIFORM;
    }
    child1.leaf = false;
    child2.leaf = false;
    child3.leaf = false;
    child4.leaf = false;
    node.leaf = true;
    node.value = v1 as T;
    return v1;
  }

  /**
   * Traverses the tree. Merges its subtrees in which all nodes have the same
   * value into a single node. Doesn't prune the excess nodes, so this.size()
   * stays the same.
   */
  compress() {
    for (const node of this.nodes.values()) {
      if (node.size < this.sampleDistance) {
        break;
      }
      this.compressSubtree(node);
    }
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
          const childX = lastNode.x + lastNode.size * 0.75;
          const childY = y > lastNode.y ? lastNode.y + lastNode.size / 4 :
                                          lastNode.y - lastNode.size / 4;
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

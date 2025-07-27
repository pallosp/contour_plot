import assert from 'minimalistic-assert';

import {Rect} from './rect';
import {AffineTransform, Run, Square} from './types';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

type AddStylesCallback<T> = (element: SVGGraphicsElement, value: T) => void;

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Renders a list of squares represented by their centers, sizes and associated
 * values as SVG <path> elements. The caller can assign CSS classes or styles
 * such as stroke color with the addStyles callback. Optionally applies a domain
 * to view transformation to the result.
 *
 * To reduce the output size and the drawing time, this function will render the
 * squares with the same size and value as a single SVG path.
 */
export function squaresToSvg<T>(
    squares: Array<Square<T>>, addStyles: AddStylesCallback<T>,
    options?: {edges?: boolean, transform?: AffineTransform}):
    SVGGraphicsElement[] {
  if (squares.length === 0) return [];
  const squareMap = new Map<T, Map<number, Array<Square<T>>>>();
  for (const square of squares) {
    let squaresBySize = squareMap.get(square.value);
    if (!squaresBySize) {
      squaresBySize = new Map<number, Array<Square<T>>>();
      squareMap.set(square.value, squaresBySize);
    }
    const group = squaresBySize.get(square.size);
    if (group) {
      group.push(square);
    } else {
      squaresBySize.set(square.size, [square]);
    }
  }

  const root = document.createElementNS(SVG_NAMESPACE, 'g');
  if (options?.edges) {
    root.setAttribute('stroke-width', '.9')
  } else {
    root.setAttribute('shape-rendering', 'crispEdges');
  }
  root.setAttribute('stroke-linecap', 'square');
  if (options?.transform) {
    const {a, b, c, d, e, f} = options.transform;
    root.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);
  }

  for (const squaresBySize of squareMap.values()) {
    for (const group of squaresBySize.values()) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path');
      path.setAttribute('d', sameSizeSquaresToPathDef(group));
      if (group[0].size !== 1) {
        path.setAttribute('transform', `scale(${group[0].size})`);
      }
      addStyles(path, group[0].value);
      root.append(path);
    }
  }
  return [root];
}

function sameSizeSquaresToPathDef(squares: Array<Square<unknown>>): string {
  // The algorithm below implements run-length encoding, which yields ~40%
  // shorter output compared to the naive algorithm, i.e.
  // squares.map(s => `M${s.x} ${s.y}h0`).join('')
  squares.sort((s1, s2) => s1.y - s2.y || s1.x - s2.x);

  const {x, y, size} = squares[0];
  const scale = 1 / size;
  const d: string[] = [`m${x * scale} ${y * scale}`];
  let last = {x: x - size, y};
  let h = -1;

  for (const sq of squares) {
    if (sq.y === last.y && sq.x === last.x + size) {
      h++;
    } else {
      d.push(`h${h}m${(sq.x - last.x) * scale} ${(sq.y - last.y) * scale}`);
      h = 0;
    }
    last = sq;
  }
  d.push(`h${h}`);
  return d.join('');
}

/**
 * Renders a list of "runs" as SVG <path> elements.
 *
 * Optionally applies a domain to view transformation to the result. This
 * transformation is semantically equivalent with wrapping the returned svg into
 * <g transform="..."></g>, but has less floating point rounding error due to
 * using 64-bit floats under the hood.
 *
 * Generates separate paths for distinct function values and segments them into
 * 64-pixel-tall horizontal stripes. This segmentation improves performance by
 * preventing overly complex paths that could slow down mouse interactions like
 * panning. The caller can customize styling, such as stroke color, using the
 * addStyles callback.
 */
export function runsToSvg<T>(
    runs: Array<Run<T>>, addStyles: AddStylesCallback<T>,
    options?: {transform?: AffineTransform}): SVGGraphicsElement[] {
  if (runs.length === 0) return [];
  const runHeight = greatestPow2Divisor(runs[0].y) * 2;
  const origin = {x: runs[0].x0, y: runs[0].y - runHeight / 2};
  const runsByValue = new Map<T, Array<Run<T>>>();
  for (const run of runs) {
    const sameValueRuns = runsByValue.get(run.value);
    if (sameValueRuns) {
      sameValueRuns.push(run);
    } else {
      runsByValue.set(run.value, [run]);
    }
  }

  // The effective transformation is the combination of
  //  1. scale(runHeight)
  //  2. translate(origin.x, origin.y)
  //  3. options.transform
  let {a, b, c, d, e, f} =
      options?.transform ?? {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};
  e += a * origin.x + c * origin.y;
  f += b * origin.x + d * origin.y;
  a *= runHeight;
  b *= runHeight;
  c *= runHeight;
  d *= runHeight;

  const root = document.createElementNS(SVG_NAMESPACE, 'g');
  root.setAttribute('shape-rendering', 'crispEdges');
  root.setAttribute('stroke-width', '1');
  root.setAttribute('transform', `matrix(${a} ${b} ${c} ${d} ${e} ${f})`);

  for (const runs of runsByValue.values()) {
    const g = document.createElementNS(SVG_NAMESPACE, 'g');
    addStyles(g, runs[0].value);
    for (const d of runsToPathDefs(runs, origin, 1 / runHeight)) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path');
      path.setAttribute('d', d);
      g.append(path);
    }
    root.append(g);
  }
  return [root];
}

/** Returns the greatest 2ⁿ (n ∈ ℤ) for which x / 2ⁿ is an integer. */
function greatestPow2Divisor(x: number): number {
  assert(x !== 0);
  let div = 1;
  while (x % div === 0) div *= 2;
  while (x % div !== 0) div /= 2;
  return div;
}

/**
 * Translates a non-empty list of runs to an SVG path definition.
 * Multiplies all coordinates by `zoom`.
 */
function runsToPathDefs(
    runs: Array<Run<unknown>>, origin: Point, zoom: number): string[] {
  let lastX = origin.x;
  let lastY = origin.y;
  let rows = 0;
  const pathDefs: string[] = [];
  let d: string[] = [];
  for (let {x0, x1, y} of runs) {
    if (y > lastY && (++rows) % 64 === 0) {
      pathDefs.push(d.join(''));
      d = [];
      lastX = origin.x;
      lastY = origin.y;
    }
    if (x1 === lastX) {
      x1 = x0;
      x0 = lastX;
    }
    d.push(`m${(x0 - lastX) * zoom} ${(y - lastY) * zoom}h${(x1 - x0) * zoom}`);
    lastX = x1;
    lastY = y;
  }
  pathDefs.push(d.join(''));
  return pathDefs;
}

function createBitmap<T>(width: number, height: number): Array<Array<T>> {
  const bitmap = new Array(height);
  for (let i = 0; i < height; i++) {
    bitmap[i] = new Array(width);
  }
  return bitmap;
}

/**
 * Renders `squares` as a bitmap (2d array) in the given order. They must be
 * aligned to the grid. In case `zoom` is set, magnifies both the squares and
 * the viewport.
 */
export function squaresToBitmap<T>(
    squares: Array<Square<T>>, viewport: Rect, zoom = 1): Array<Array<T>> {
  const bitmap = createBitmap<T>(viewport.width * zoom, viewport.height * zoom);
  for (let {x, y, size, value} of squares) {
    const r = size * zoom / 2;
    x = (x - viewport.x) * zoom;
    y = (y - viewport.y) * zoom;
    const yStart = Math.max(y - r, 0);
    const yStop = Math.min(y + r, viewport.height * zoom);
    for (let i = yStart; i < yStop; i++) {
      bitmap[i].fill(value, Math.max(x - r, 0), x + r);
    }
  }
  return bitmap;
}

/**
 * Renders `runs` as a bitmap (2d array) in the given order. Their height must
 * be 1 pixel, and they must be aligned to the grid.
 */
export function runsToBitmap<T>(
    runs: Array<Run<T>>, viewport: Rect): Array<Array<T>> {
  const bitmap = createBitmap<T>(viewport.width, viewport.height);
  const top = viewport.y + 0.5;
  const bottom = viewport.y + viewport.height - 0.5;
  for (const {x0, x1, y, value} of runs) {
    if (y >= top && y <= bottom) {
      const start = x0 - 0.5 - viewport.x;
      const stop = x1 + 0.5 - viewport.x;
      bitmap[y - top].fill(value, Math.max(start, 0), stop);
    }
  }
  return bitmap;
}

const WHITE_BOX_ELEMENTS =
    ['┌─', '──', '┐ ', '│ ', '  ', '│ ', '└─', '──', '┘ ', '□ '];
const BLACK_BOX_ELEMENTS =
    ['▗▄', '▄▄', '▖ ', '▐█', '██', '▌ ', '▝▀', '▀▀', '▘ ', '■ '];

/**
 * Renders the square tiles using Unicode characters: outlined squares for falsy
 * values and filled squares for truthy values. Spaces are added for visual
 * separation.
 *
 * If `pixelSize` is unset, the smallest square will be 1 character tall.
 * If `pixelSize` is specified, the rendered squares will be `square.size /
 * pixelSize` characters tall.
 */
export function squaresToText<T>(
    squares: Array<Square<T>>, options?: {pixelSize?: number}): string {
  if (squares.length === 0) return '';
  const sq = squares[0];
  let x0 = sq.x, x1 = sq.x, y0 = sq.y, y1 = sq.y;
  let minSize = options?.pixelSize ?? sq.size;
  for (const {x, y, size} of squares) {
    const r = size / 2;
    if (x - r < x0) x0 = x - r;
    if (x + r > x1) x1 = x + r;
    if (y - r < y0) y0 = y - r;
    if (y + r >= y1) y1 = y + r;
    if (size < minSize) minSize = size;
  }
  const w = (x1 - x0) / minSize;
  const h = (y1 - y0) / minSize;
  const chars: Array<Array<string>> = [];
  for (let y = 0; y < h; y++) {
    chars.push(Array(w).fill('  '));
  }
  for (let {x, y, size, value} of squares) {
    const r = size / 2;
    const n = size / minSize;
    x = (x - r - x0) / minSize;
    y = (y - r - y0) / minSize;
    const boxElements = value ? BLACK_BOX_ELEMENTS : WHITE_BOX_ELEMENTS;
    if (n === 1) {
      chars[y][x] = boxElements[9];
    } else {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const row = j === 0 ? 0 : j === n - 1 ? 6 : 3;
          const col = i === 0 ? 0 : i === n - 1 ? 2 : 1;
          chars[y + j][x + i] = boxElements[row + col];
        }
      }
    }
  }
  return chars.map(row => row.join('')).join('\n');
}

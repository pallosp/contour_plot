import {Rect} from './rect';
import {Run, Square} from './types';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/**
 * Renders a list of squares represented by their centers, sizes and associated
 * values as SVG <path> elements. The caller can assign CSS classes or styles
 * such as stroke color with the addStyles callback.
 *
 * To reduce the output size and the drawing time, this function will render the
 * squares with the same size and value as a single SVG path.
 */
export function squaresToSvg<T>(
    squares: Array<Square<T>>,
    addStyles: (element: SVGElement, value: T) => void): SVGElement[] {
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
  const pathElements: SVGPathElement[] = [];
  for (const squaresBySize of squareMap.values()) {
    for (const group of squaresBySize.values()) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path');
      path.setAttribute('d', sameSizeSquaresToPathDef(group));
      path.setAttribute('shape-rendering', 'crispEdges');
      path.setAttribute('stroke-linecap', 'square');
      if (group[0].size !== 1) {
        path.setAttribute('transform', `scale(${group[0].size})`);
      }
      addStyles(path, group[0].value);
      pathElements.push(path);
    }
  }
  return pathElements;
}

function sameSizeSquaresToPathDef(squares: Array<Square<unknown>>): string {
  // The algorithm below implements run-length encoding, which yields ~40%
  // shorter output compared to the naive algorithm, i.e.
  // squares.map(s => `M${s.x} ${s.y}h0`).join('')
  const size = squares[0].size;
  const scale = 1 / size;
  const d: string[] = [];
  let last = {x: 0} as Square<unknown>;
  let h = 0;
  squares.sort((s1, s2) => s1.y - s2.y || s1.x - s2.x);
  squares.push({} as Square<unknown>);
  for (const square of squares) {
    if (square.y === last.y) {
      if (square.x === last.x + size) {
        h++;
      } else {
        d.push(`h${h}m${(square.x - last.x) * scale} 0`);
        h = 0;
      }
    } else {
      if (last.y !== undefined) {
        d.push(`h${h}`);
        h = 0;
      }
      if (square.y !== undefined) {
        d.push(
            `m${(square.x - last.x) * scale} ${
                (square.y - (last.y ?? 0)) * scale}`,
        );
      }
    }
    last = square;
  }
  return d.join('');
}

/**
 * Renders a list of "runs" as SVG <path> elements.
 *
 * Generates separate paths for distinct function values and segments them into
 * 64-pixel-tall horizontal stripes. This segmentation improves performance by
 * preventing overly complex paths that could slow down mouse interactions like
 * panning. The caller can customize styling, such as stroke color, using the
 * addStyles callback.
 */
export function runsToSvg<T>(
    runs: Array<Run<T>>,
    addStyles: (element: SVGElement, value: T) => void): SVGElement[] {
  if (runs.length === 0) return [];
  const scale = greatestPow2Divisor(runs[0].y);
  const runsByValue = new Map<T, Array<Run<T>>>();
  for (const run of runs) {
    const sameValueRuns = runsByValue.get(run.value);
    if (sameValueRuns) {
      sameValueRuns.push(run);
    } else {
      runsByValue.set(run.value, [run]);
    }
  }
  const svgElements: SVGElement[] = [];
  for (const runs of runsByValue.values()) {
    const g = document.createElementNS(SVG_NAMESPACE, 'g');
    g.setAttribute('shape-rendering', 'crispEdges');
    g.setAttribute('stroke-width', '1px');
    g.setAttribute('transform', `scale(${scale})`);
    addStyles(g, runs[0].value);
    for (const d of runsToPathDefs(runs, 1 / scale)) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path');
      path.setAttribute('d', d);
      g.append(path);
    }
    svgElements.push(g);
  }
  return svgElements;
}

/** Returns the greatest 2ⁿ (n ∈ ℤ) for which x / 2ⁿ is an integer. */
function greatestPow2Divisor(x: number): number {
  let divisor = 1;
  while (x % 1 === 0) {
    x = x / 2;
    divisor *= 2;
  }
  while (x % 0.5 !== 0) {
    x = x * 2;
    divisor /= 2;
  }
  return divisor;
}

/**
 * Translates a non-empty list of runs to an SVG path definition.
 * Multiplies all coordinates by `zoom`.
 */
function runsToPathDefs(runs: Array<Run<unknown>>, zoom: number): string[] {
  let lastX = 0;
  let lastY = 0;
  let rows = 0;
  const pathDefs: string[] = [];
  let d: string[] = [];
  for (const run of runs) {
    if (run.xMax === lastX) {
      d.push(`m0 ${(run.y - lastY) * zoom}h${(run.xMin - run.xMax) * zoom}`);
      lastX = run.xMin;
    } else {
      if (run.y > lastY) {
        if ((++rows) % 64 === 0) {
          pathDefs.push(d.join(''));
          d = [];
          lastX = 0;
          lastY = 0;
        }
      }
      d.push(
          `m${(run.xMin - lastX) * zoom} ${(run.y - lastY) * zoom}h${
              (run.xMax - run.xMin) * zoom}`,
      );
      lastX = run.xMax;
    }
    lastY = run.y;
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
  for (const {xMin, xMax, y, value} of runs) {
    if (y >= top && y <= bottom) {
      const start = xMin - 0.5 - viewport.x;
      const stop = xMax + 0.5 - viewport.x;
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

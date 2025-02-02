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
    addStyles: (value: T, element: SVGElement) => void): SVGPathElement[] {
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
      addStyles(group[0].value, path);
      pathElements.push(path);
    }
  }
  return pathElements;
}

function sameSizeSquaresToPathDef<T>(squares: Array<Square<T>>): string {
  // The algorithm below implements run-length encoding, which yields ~40%
  // shorter output compared to the naive algorithm, i.e.
  // squares.map(s => `M${s.x} ${s.y}h0`).join('')
  const size = squares[0].size;
  const scale = 1 / size;
  const d: string[] = [];
  let last: Square<T> = {} as Square<T>;
  let h = 0;
  squares.sort((s1, s2) => s1.y - s2.y || s1.x - s2.x);
  squares.push({} as Square<T>);
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
        if (last.x !== undefined) {
          d.push(
              `m${(square.x - last.x) * scale} ${(square.y - last.y) * scale}`,
          );
        } else {
          d.push(`M${square.x * scale} ${square.y * scale}`);
        }
      }
    }
    last = square;
  }
  return d.join('');
}

/**
 * Renders a list of "runs" as SVG <path> elements, one for each distinct
 * function value. The caller can assign CSS classes or styles such as stroke
 * color with the addStyles callback.
 */
export function runsToSvg<T>(
    runs: Array<Run<T>>,
    addStyles: (value: T, element: SVGElement) => void): SVGPathElement[] {
  const scale = greatestPow2Divisor(runs[0].xMin);
  const runsByValue = new Map<T, Array<Run<T>>>();
  for (const run of runs) {
    const sameValueRuns = runsByValue.get(run.value);
    if (sameValueRuns) {
      sameValueRuns.push(run);
    } else {
      runsByValue.set(run.value, [run]);
    }
  }
  const pathElements: SVGPathElement[] = [];
  for (const runs of runsByValue.values()) {
    const path = document.createElementNS(SVG_NAMESPACE, 'path');
    path.setAttribute('d', runsToPathDef(runs, 1 / scale));
    path.setAttribute('shape-rendering', 'crispEdges');
    path.setAttribute('stroke-linecap', 'square');
    path.setAttribute('stroke-width', '1px');
    path.setAttribute('transform', `scale(${scale})`);
    addStyles(runs[0].value, path);
    pathElements.push(path);
  }
  return pathElements;
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
function runsToPathDef<T>(runs: Array<Run<T>>, zoom: number): string {
  let lastX = 0;
  let lastY = 0;
  const d: string[] = [];
  for (const run of runs) {
    if (run.xMax === lastX) {
      d.push(`m0 ${(run.y - lastY) * zoom}h${(run.xMin - run.xMax) * zoom}`);
      lastX = run.xMin;
    } else {
      d.push(
          `m${(run.xMin - lastX) * zoom} ${(run.y - lastY) * zoom}h${
              (run.xMax - run.xMin) * zoom}`,
      );
      lastX = run.xMax;
    }
    lastY = run.y;
  }
  d[0] = 'M' + d[0].substring(1);
  return d.join('');
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

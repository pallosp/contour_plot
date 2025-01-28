import {Quadtree} from './quadtree';
import {Rect, Run, Square} from './types';

/**
 * Computes a 2-dimensional function with discrete values in the given viewport.
 * Approximates the function with a set of squares. In each square the
 * function's value is considered constant.
 */
export function evalDiscrete2dFunction<T>(
    func: (x: number, y: number) => T,
    viewport: Rect,
    sampleDistance: number,
    pixelSize: number,
    ): Array<Square<T>> {
  return new Quadtree<T>(func)
      .compute(viewport, sampleDistance, pixelSize)
      .squares();
}

/**
 * Computes a 2-dimensional function with discrete values in the given viewport.
 * Approximates the function with a set of runs (n✕1 horizontal rectangles). In
 * each run the function's value is considered constant.
 */
export function evalDiscrete2dFunctionAsRuns<T>(
    func: (x: number, y: number) => T,
    viewport: Rect,
    sampleDistance: number,
    pixelSize: number,
    ): Array<Run<T>> {
  return new Quadtree<T>(func)
      .compute(viewport, sampleDistance, pixelSize)
      .runs();
}

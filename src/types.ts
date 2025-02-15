/**
 * Represents a square shaped area in which the plotted function's value is
 * considered constant.
 */
export interface Square<T> {
  /** x-coordinate of the center point */
  readonly x: number;
  /** y-coordinate of the center point */
  readonly y: number;
  /** edge size */
  readonly size: number;
  /** value of the plotted function at the center */
  readonly value: T;
}

/**
 * Represents a horizontal line over which the plotted function's value is
 * considered constant.
 */
export interface Run<T> {
  /** x-coordinate of the start point */
  readonly x0: number;
  /** x-coordinate of the end point */
  readonly x1: number;
  /** y-coordinate of the line */
  readonly y: number;
  /** value of the plotted function over the run */
  readonly value: T;
}

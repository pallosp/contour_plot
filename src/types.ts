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
  /** x-coordinate of the leftmost point */
  xMin: number;
  /** x-coordinate of the rightmost point */
  xMax: number;
  /** y-coordinate of the line */
  y: number;
  /** value of the plotted function over the run */
  value: T;
}

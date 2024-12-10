/**
 * Represents a rectangle area with no specific semantics.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a square shaped area in which the plotted function's value is
 * considered constant.
 */
export interface Square<T> {
  /** x-coordinate of the center point */
  x: number;
  /** y-coordinate of the center point */
  y: number;
  /** edge size */
  size: number;
  /** value of the plotted function at the center */
  value: T;
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


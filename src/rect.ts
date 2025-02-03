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
 * Returns a copy of `rect` extending it with the minimum amount so that its
 * boundaries will be multiples of gridSpacing.
 */
export function alignToGrid(rect: Rect, gridSpacing: number): Rect {
  const x = Math.floor(rect.x / gridSpacing) * gridSpacing;
  const y = Math.floor(rect.y / gridSpacing) * gridSpacing;
  return {
    x,
    y,
    width: Math.ceil((rect.x + rect.width) / gridSpacing) * gridSpacing - x,
    height: Math.ceil((rect.y + rect.height) / gridSpacing) * gridSpacing - y
  };
}

/** Calculates the overlapping area of two rectangles. */
export function overlappingArea(rect1: Rect, rect2: Rect): number {
  const width = Math.min(rect1.x + rect1.width, rect2.x + rect2.width) -
      Math.max(rect1.x, rect2.x);
  const height = Math.min(rect1.y + rect1.height, rect2.y + rect2.height) -
      Math.max(rect1.y, rect2.y);

  return width > 0 && height > 0 ? width * height : 0;
}

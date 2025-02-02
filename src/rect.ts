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

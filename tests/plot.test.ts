import {Plot} from '../src/plot';
import {Square} from '../src/types';

const VIEWPORT_4X4 = {
  x: 0,
  y: 0,
  width: 4,
  height: 4
};

/**
 * Returns a function that maps the points in a 4x4 viewport to booleans.
 *
 * The input is a 20-bit integer.
 * - Its 0th..15th bits specify the function's value at the (x+0.5, y+0.5)
 *   grid points.
 * - Its 16th..19th bits specify the function's value at the (2x+1, 2y+1)
 *   grid points.
 */
function bitmapFunc4x4(i: number): (x: number, y: number) => boolean {
  return (x: number, y: number) => x % 1 === 0 ?
      (i & 2 ** (y - 1 + (x - 1) / 2 + 16)) > 0 :
      (i & 2 ** (y * 4 + x - 2.5)) > 0;
};

function compareSquares<T>(a: Square<T>, b: Square<T>): number {
  return (a.y - b.y) || (a.x - b.x);
}

test('constant function', () => {
  const plot = new Plot(() => 2);
  plot.compute({x: 0, y: 0, width: 1, height: 1}, 1, 1);
  expect(plot.squares()).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: 2}),
  ]);
});

test('sampling', () => {
  const plot = new Plot(() => 0);
  plot.compute(VIEWPORT_4X4, 2, 1);
  expect(plot.squares().sort(compareSquares)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: 0}),
  ]);
});

test('viewport not aligned with samples', () => {
  const plot = new Plot(() => 0);
  plot.compute({x: 1, y: 1, width: 2, height: 2}, 2, 1);
  expect(plot.squares().sort(compareSquares)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: 0}),
  ]);
});

test('invalid sample spacing', () => {
  const plot = new Plot(() => 0);
  expect(() => plot.compute({x: 0, y: 0, width: 3, height: 3}, 3, 1)).toThrow();
});

test('invalid pixel size', () => {
  const plot = new Plot(() => 0);
  expect(() => plot.compute(VIEWPORT_4X4, 4, 3)).toThrow();
});

// █▖··
// ▝█··
// ····
// ····
test('plot compression', () => {
  const plot = new Plot((x, y) => x == y && x < 2);
  plot.compute(VIEWPORT_4X4, 2, 1);
  expect(plot.squares(/* compress= */ false).length).toEqual(13);
  expect(plot.squares().length).toEqual(7);
  expect(plot.squares().sort(compareSquares)).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: true}),
    expect.objectContaining({x: 1.5, y: 0.5, size: 1, value: false}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 0.5, y: 1.5, size: 1, value: false}),
    expect.objectContaining({x: 1.5, y: 1.5, size: 1, value: true}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: false}),
  ]);
});

// █▖··
// ▝█··
// ····
// ····
test('4x4 viewport, 0 ≤ x = y ≤ 2', () => {
  const plot = new Plot((x, y) => x == y && x < 2);
  plot.compute(VIEWPORT_4X4, 2, 1);
  expect(plot.squares(/* compress= */ false).length).toEqual(13);
});

test('4x4 viewport, x=y=0 or x=y=1, pixel size=2', () => {
  const plot = new Plot((x, y) => x == y && x < 2);
  plot.compute(VIEWPORT_4X4, 2, 2);
  expect(plot.squares().sort(compareSquares)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: true}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: false}),
  ]);
});

// █···
// ····
// ····
// ····
test('sampling too sparse', () => {
  const plot = new Plot((x, y) => x + y == 1);
  plot.compute(VIEWPORT_4X4, 2, 1);
  expect(plot.squares().sort(compareSquares)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: false}),
  ]);
});

test('resolves isolated points even with low sampling rate', () => {
  function circle(x: number, y: number) {
    return Math.sign(5 * 5 - (x - 6.5) ** 2 - (y - 6.5) ** 2);
  }
  const plot = new Plot(circle);
  plot.compute({x: 0, y: 0, width: 13, height: 13}, 8, 1);
  // The circle perimeter contains 12 grid points:
  //   center + ((±5, 0) ∨ (0, ±5) ∨ (±3, ±4) ∨ (±4, ±3))
  expect(plot.squares().filter(s => s.value === 0).length).toEqual(12);
});

test('tolerates when sample spacing < pixel size', () => {
  const plot = new Plot((x, y) => x === y);
  plot.compute({x: 0, y: 0, width: 2, height: 2}, 0.5, 1);
  expect(plot.squares()).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: true}),
    expect.objectContaining({x: 1.5, y: 0.5, size: 1, value: false}),
    expect.objectContaining({x: 0.5, y: 1.5, size: 1, value: false}),
    expect.objectContaining({x: 1.5, y: 1.5, size: 1, value: true}),
  ]);
});

test('point may disappear during refining', () => {
  const plot = new Plot((x, y) => x === 1 && y === 1);
  plot.compute({x: 0, y: 0, width: 4, height: 2}, 2, 1);
  expect(plot.squares()).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
  ]);
});

test('recomputing with different viewport and resolution', () => {
  const plot = new Plot((x, y) => x <= y);

  plot.compute({x: 2, y: 2, width: 2, height: 2}, 1, 1);
  expect(plot.squares()).toEqual([
    expect.objectContaining({x: 2.5, y: 2.5, size: 1, value: true}),
    expect.objectContaining({x: 3.5, y: 2.5, size: 1, value: false}),
    expect.objectContaining({x: 2.5, y: 3.5, size: 1, value: true}),
    expect.objectContaining({x: 3.5, y: 3.5, size: 1, value: true}),
  ]);

  plot.compute(VIEWPORT_4X4, 2, 2);
  expect(plot.squares()).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: true}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: true}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: true}),
  ]);
});

// ·██·
// ····
test('runs from same size squares', () => {
  const plot = new Plot((x, y) => x > 1 && x < 3 && y < 1);
  plot.compute({x: 0, y: 0, width: 4, height: 2}, 1, 1);
  expect(plot.runs()).toEqual([
    {xMin: 0.5, xMax: 0.5, y: 0.5, value: false},
    {xMin: 1.5, xMax: 2.5, y: 0.5, value: true},
    {xMin: 3.5, xMax: 3.5, y: 0.5, value: false},
    {xMin: 0.5, xMax: 3.5, y: 1.5, value: false},
  ]);
});

// ··████··
// ··████··
// ········
// ········
test('runs with pixel size > 1', () => {
  const plot = new Plot((x, y) => x > 2 && x < 6 && y < 2);
  plot.compute({x: 0, y: 0, width: 8, height: 4}, 2, 2);
  expect(plot.runs()).toEqual([
    {xMin: 1, xMax: 1, y: 1, value: false},
    {xMin: 3, xMax: 5, y: 1, value: true},
    {xMin: 7, xMax: 7, y: 1, value: false},
    {xMin: 1, xMax: 7, y: 3, value: false},
  ]);
});

// █········█
// █········█
test('runs from different size squares', () => {
  const plot = new Plot((x) => x <= 1 || x >= 9);
  plot.compute({x: 0, y: 0, width: 10, height: 2}, 2, 1);
  expect(plot.runs()).toEqual([
    {xMin: 0.5, xMax: 0.5, y: 0.5, value: true},
    {xMin: 1.5, xMax: 8.5, y: 0.5, value: false},
    {xMin: 9.5, xMax: 9.5, y: 0.5, value: true},
    {xMin: 0.5, xMax: 0.5, y: 1.5, value: true},
    {xMin: 1.5, xMax: 8.5, y: 1.5, value: false},
    {xMin: 9.5, xMax: 9.5, y: 1.5, value: true},
  ]);
});

// █···
// ····
// ··▂▂
// ████
test('the traversal does not reach the top left corner', () => {
  const plot = new Plot(bitmapFunc4x4(0x8F001));
  plot.compute(VIEWPORT_4X4, 2, 1);
  expect(plot.runs()).toEqual([
    {xMin: 0.5, xMax: 3.5, y: 0.5, value: false},
    {xMin: 0.5, xMax: 3.5, y: 1.5, value: false},
    {xMin: 0.5, xMax: 3.5, y: 2.5, value: false},
    {xMin: 0.5, xMax: 3.5, y: 3.5, value: true},
  ]);
});

// ····
// ··█·
// ··█▖
// ··▝▘
test('the traversal follows the continuous feature', () => {
  const plot = new Plot(bitmapFunc4x4(0x10440));
  plot.compute(VIEWPORT_4X4, 2, 1);
  expect(plot.runs()).toEqual([
    {xMin: 0.5, xMax: 3.5, y: 0.5, value: false},
    {xMin: 0.5, xMax: 1.5, y: 1.5, value: false},
    {xMin: 2.5, xMax: 2.5, y: 1.5, value: true},
    {xMin: 3.5, xMax: 3.5, y: 1.5, value: false},
    {xMin: 0.5, xMax: 1.5, y: 2.5, value: false},
    {xMin: 2.5, xMax: 2.5, y: 2.5, value: true},
    {xMin: 3.5, xMax: 3.5, y: 2.5, value: false},
    {xMin: 0.5, xMax: 3.5, y: 3.5, value: false},
  ]);
});

test.skip('A/B regression test for experimental features', () => {
  for (let i = 0; i < 1048576; i++) {
    const plot = new Plot(bitmapFunc4x4(i));
    plot.compute(VIEWPORT_4X4, 2, 1);
    const r1 = plot.runs().length;
    // Enable experimental feature here, e.g. plot.optIn = true;
    plot.compute(VIEWPORT_4X4, 2, 1);
    const r2 = plot.runs().length;
    if (r1 !== r2) {
      console.warn(`func: 0x${i.toString(16)}, before: ${r1}, after: ${r2}`);
      expect(r1).toBe(r2);
    }
  }
});

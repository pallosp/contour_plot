import {Plot} from '../src/plot';
import {squaresToText} from '../src/render';
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

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

test('zero state', () => {
  const plot = new Plot(() => 0);
  expect(plot.domain()).toEqual({x: 0, y: 0, width: 0, height: 0});
  expect(plot.squares()).toEqual([]);
  expect(plot.runs()).toEqual([]);
  expect(plot.computeStats())
      .toEqual({size: 0, newCalls: 0, newArea: 0, elapsedMs: 0});
});

test('rejects negative domain dimensions', () => {
  const plot = new Plot(() => 0);
  expect(() => plot.compute({x: 0, y: 0, width: -1, height: 1}, 1, 1))
      .toThrow();
  expect(() => plot.compute({x: 0, y: 0, width: -1, height: 0}, 1, 1))
      .toThrow();
  expect(() => plot.compute({x: 0, y: 0, width: 1, height: -1}, 1, 1))
      .toThrow();
  expect(() => plot.compute({x: 0, y: 0, width: 0, height: -1}, 1, 1))
      .toThrow();
});

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
  expect(plot.domain()).toEqual({x: 0, y: 0, width: 4, height: 4});
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
  expect(() => plot.compute(VIEWPORT_4X4, 0, 1)).toThrow();
  expect(() => plot.compute(VIEWPORT_4X4, -1, 1)).toThrow();
});

test('invalid pixel size', () => {
  const plot = new Plot(() => 0);
  expect(() => plot.compute(VIEWPORT_4X4, 4, 3)).toThrow();
  expect(() => plot.compute(VIEWPORT_4X4, 4, 0)).toThrow();
  expect(() => plot.compute(VIEWPORT_4X4, 4, -1)).toThrow();
});

// █▖··
// ▝█··
// ····
// ····
test('plot compression', () => {
  const plot = new Plot((x, y) => x == y && x < 2);
  plot.compute(VIEWPORT_4X4, 2, 1);
  expect(plot.squares({all: true}).length).toEqual(13);
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
  expect(plot.squares({all: true}).length).toEqual(13);
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

test('runs from empty plot', () => {
  const plot = new Plot(() => 0);
  plot.compute({x: 0, y: 0, width: 1, height: 0}, 1, 1);
  expect(plot.runs()).toEqual([]);
  plot.compute({x: 0, y: 0, width: 0, height: 1}, 1, 1);
  expect(plot.runs()).toEqual([]);
});

// ·██·
// ····
test('runs from same size squares', () => {
  const plot = new Plot((x, y) => x > 1 && x < 3 && y < 1);
  plot.compute({x: 0, y: 0, width: 4, height: 2}, 1, 1);
  expect(plot.runs()).toEqual([
    {x0: 0, x1: 1, y: 0.5, value: false},
    {x0: 1, x1: 3, y: 0.5, value: true},
    {x0: 3, x1: 4, y: 0.5, value: false},
    {x0: 0, x1: 4, y: 1.5, value: false},
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
    {x0: 0, x1: 2, y: 1, value: false},
    {x0: 2, x1: 6, y: 1, value: true},
    {x0: 6, x1: 8, y: 1, value: false},
    {x0: 0, x1: 8, y: 3, value: false},
  ]);
});

// █········█
// █········█
test('runs from different size squares', () => {
  const plot = new Plot((x) => x <= 1 || x >= 9);
  plot.compute({x: 0, y: 0, width: 10, height: 2}, 2, 1);
  expect(plot.runs()).toEqual([
    {x0: 0, x1: 1, y: 0.5, value: true},
    {x0: 1, x1: 9, y: 0.5, value: false},
    {x0: 9, x1: 10, y: 0.5, value: true},
    {x0: 0, x1: 1, y: 1.5, value: true},
    {x0: 1, x1: 9, y: 1.5, value: false},
    {x0: 9, x1: 10, y: 1.5, value: true},
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
    {x0: 0, x1: 4, y: 0.5, value: false},
    {x0: 0, x1: 4, y: 1.5, value: false},
    {x0: 0, x1: 4, y: 2.5, value: false},
    {x0: 0, x1: 4, y: 3.5, value: true},
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
    {x0: 0, x1: 4, y: 0.5, value: false},
    {x0: 0, x1: 2, y: 1.5, value: false},
    {x0: 2, x1: 3, y: 1.5, value: true},
    {x0: 3, x1: 4, y: 1.5, value: false},
    {x0: 0, x1: 2, y: 2.5, value: false},
    {x0: 2, x1: 3, y: 2.5, value: true},
    {x0: 3, x1: 4, y: 2.5, value: false},
    {x0: 0, x1: 4, y: 3.5, value: false},
  ]);
});

test('# squares after extending domain', () => {
  const plot = new Plot((x) => x > 2)
                   .compute({x: 0, y: 0, width: 4, height: 2}, 2, 1)
                   .compute({x: 0, y: 0, width: 4, height: 4}, 2, 1);
  expect(plot.squares().length).toBe(4);
});

test('domain shrinking preserves info', () => {
  const func = (x: number, y: number) => Number(y < x - 2);
  const domain1 = {x: 0, y: 0, width: 5, height: 4};
  const domain2 = {x: 0, y: 0, width: 4, height: 4};
  const plot1 = new Plot(func).compute(domain1, 2, 1).compute(domain2, 2, 1);
  const plot2 = new Plot(func).compute(domain2, 1, 1);
  const plot3 = new Plot(func).compute(domain2, 2, 1);
  // plot2 should preserve the 1 values in the corner after shrinking.
  expect(plot1.runs()).toEqual(plot2.runs());
  // plot3's sample spacing is too large to pick up the 1 values in the corner.
  expect(plot1.runs()).not.toEqual(plot3.runs());
});

test('nodes stay balanced after panning', () => {
  const plot1 = new Plot(() => 0)
                    .compute(VIEWPORT_4X4, 2, 1)
                    .compute({x: 2, y: 2, width: 4, height: 4}, 2, 1);
  expect(() => plot1.runs()).not.toThrow();

  const plot2 = new Plot((x, y) => y < x + 1)
                    .compute({x: 0, y: 2, width: 4, height: 4}, 4, 1)
                    .compute({x: 2, y: 0, width: 4, height: 4}, 4, 1);
  expect(() => plot2.runs()).not.toThrow();

  const plot3 = new Plot((x, y) => x > y)
                    .compute({x: 0, y: 0, width: 8, height: 8}, 4, 1)
                    .compute({x: 0, y: 4, width: 8, height: 8}, 4, 1);
  expect(() => plot3.runs()).not.toThrow();

  const plot4 = new Plot((x, y) => y > 2 * x - 8)
                    .compute({x: 0, y: 0, width: 16, height: 16}, 8, 1)
                    .compute({x: 8, y: 8, width: 16, height: 16}, 8, 1);
  expect(() => plot4.runs()).not.toThrow();
});

test('nodes stay balanced after resizing domain', () => {
  const plot = new Plot(() => 0)
                   .compute({x: 0, y: 0, width: 2, height: 4}, 2, 1)
                   .compute({x: 0, y: 0, width: 6, height: 2}, 2, 1);
  expect(() => plot.runs()).not.toThrow();
});

test('nodes stay balanced after shrinking domain', () => {
  const plot = new Plot((x, y) => x > y)
                   .compute({x: 0, y: 0, width: 8, height: 4}, 4, 1)
                   .compute({x: 0, y: 0, width: 4, height: 4}, 4, 1);
  expect(() => plot.runs()).not.toThrow();
});

test('nodes stay balanced after extending domain', () => {
  const plot = new Plot(() => false)
                   .compute({x: 0, y: 0, width: 4, height: 4}, 4, 1)
                   .compute({x: 0, y: 0, width: 8, height: 4}, 4, 1);
  expect(() => plot.runs()).not.toThrow();
});

test('nodes stay balanced after resizing domain, random', () => {
  for (let i = 0; i < 100; i++) {
    const a = randomInt(-8, 8), b = randomInt(-8, 8), c = randomInt(-8, 8);
    const func = (x: number, y: number) => a * x + b * y + c > 0;
    const domain1 = {
      x: randomInt(0, 2) * 4,
      y: randomInt(0, 2) * 4,
      width: randomInt(1, 2) * 4,
      height: randomInt(1, 2) * 4,
    };
    const domain2 = {
      x: randomInt(0, 2) * 4,
      y: randomInt(0, 2) * 4,
      width: randomInt(1, 2) * 4,
      height: randomInt(1, 2) * 4,
    };
    const plot = new Plot(func).compute(domain1, 4, 1).compute(domain2, 4, 1);
    try {
      // runs() throwing an Error indicates unbalanced nodes
      expect(() => plot.runs()).not.toThrow();
    } catch (e) {
      console.error(
          `Failure while resizing domain\n\n` +
          `Old domain: x: ${domain1.x}, y: ${domain1.y}, width: ${
              domain1.width}, height: ${domain1.height}\n` +
          `New domain: x: ${domain2.x}, y: ${domain2.y}, width: ${
              domain2.width}, height: ${domain2.height}\n\n` +
          `Function: ${a}x + ${b}y + ${c} > 0\n` +
          squaresToText(plot.squares({all: true}), {pixelSize: 1}));
      throw e;
    }
  }
});

test('computeStats', () => {
  const plot = new Plot((x) => x > 2);

  // initial computation
  let stats =
      plot.compute({x: 0, y: 0, width: 4, height: 2}, 2, 1).computeStats();
  expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(stats.size).toBe(10);
  expect(stats.newCalls).toBe(10);
  expect(stats.newArea).toBe(8);

  // no change
  stats = plot.compute({x: 0, y: 0, width: 4, height: 2}, 2, 1).computeStats();
  expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(stats.size).toBe(10);
  expect(stats.newCalls).toBe(0);
  expect(stats.newArea).toBe(0);

  // extended domain
  stats = plot.compute({x: 0, y: 0, width: 4, height: 4}, 2, 1).computeStats();
  expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(stats.size).toBe(20);
  expect(stats.newCalls).toBe(10);
  expect(stats.newArea).toBe(8);

  // shrunk domain
  stats = plot.compute({x: 0, y: 2, width: 4, height: 2}, 2, 1).computeStats();
  expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(stats.size).toBe(10);
  expect(stats.newCalls).toBe(0);
  expect(stats.newArea).toBe(0);

  // larger pixels
  stats = plot.compute({x: 0, y: 2, width: 4, height: 2}, 2, 2).computeStats();
  expect(stats.elapsedMs).toBeGreaterThanOrEqual(0);
  expect(stats.size).toBe(2);
  expect(stats.newCalls).toBe(2);
  expect(stats.newArea).toBe(2);
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

import {Quadtree} from '../src/quadtree';
import {Square} from '../src/types';

function compareLeaves<T>(a: Square<T>, b: Square<T>): number {
  return (a.y - b.y) || (a.x - b.x);
}

test('constant function', () => {
  const tree = new Quadtree(() => 2);
  tree.compute({x: 0, y: 0, width: 1, height: 1}, 1, 1);
  const squares: Array<Square<number>> = tree.leaves();
  expect(squares).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: 2}),
  ]);
});

test('sampling', () => {
  const tree = new Quadtree(() => 0);
  tree.compute({x: 0, y: 0, width: 4, height: 4}, 2, 1);
  const squares: Array<Square<number>> = tree.leaves();
  expect(squares.sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: 0}),
  ]);
});

test('viewport not aligned with samples', () => {
  const tree = new Quadtree(() => 0);
  tree.compute({x: 1, y: 1, width: 2, height: 2}, 2, 1);
  const squares: Array<Square<number>> = tree.leaves();
  expect(squares.sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: 0}),
  ]);
});

test('invalid sample distance', () => {
  const tree = new Quadtree(() => 0);
  expect(() => tree.compute({x: 0, y: 0, width: 3, height: 3}, 3, 1)).toThrow();
});

test('invalid pixel size', () => {
  const tree = new Quadtree(() => 0);
  expect(() => tree.compute({x: 0, y: 0, width: 4, height: 4}, 4, 3)).toThrow();
});

// O···
// ·O··
// ····
// ····
test('tree compression', () => {
  const tree = new Quadtree((x, y) => x == y && x < 2);
  tree.compute({x: 0, y: 0, width: 4, height: 4}, 2, 1);
  expect(tree.leaves().length).toEqual(13);

  tree.compress();
  expect(tree.leaves().length).toEqual(7);
  expect(tree.leaves().sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: true}),
    expect.objectContaining({x: 1.5, y: 0.5, size: 1, value: false}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 0.5, y: 1.5, size: 1, value: false}),
    expect.objectContaining({x: 1.5, y: 1.5, size: 1, value: true}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: false}),
  ]);
});

// O···
// ·O··
// ····
// ····
test('4x4 viewport, 0 ≤ x = y ≤ 2', () => {
  const tree = new Quadtree((x, y) => x == y && x < 2);
  tree.compute({x: 0, y: 0, width: 4, height: 4}, 2, 1);
  expect(tree.leaves().length).toEqual(13);
});

test('4x4 viewport, x=y=0 or x=y=1, pixel size=2', () => {
  const tree = new Quadtree((x, y) => x == y && x < 2);
  tree.compute({x: 0, y: 0, width: 4, height: 4}, 2, 2);
  expect(tree.leaves().sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: true}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: false}),
  ]);
});

// O···
// ····
// ····
// ····
test('sampling too sparse', () => {
  const tree = new Quadtree((x, y) => x + y == 1);
  tree.compute({x: 0, y: 0, width: 4, height: 4}, 2, 1);
  expect(tree.leaves().sort(compareLeaves)).toEqual([
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
  const tree = new Quadtree(circle);
  tree.compute({x: 0, y: 0, width: 13, height: 13}, 8, 1);
  // The circle perimeter contains 12 grid points:
  //   center + ((±5, 0) ∨ (0, ±5) ∨ (±3, ±4) ∨ (±4, ±3))
  expect(tree.leaves().filter(l => l.value === 0).length).toEqual(12);
});

test('tolerates when sample distance < pixel size', () => {
  const tree = new Quadtree((x, y) => x === y);
  tree.compute({x: 0, y: 0, width: 2, height: 2}, 0.5, 1);
  expect(tree.leaves()).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: true}),
    expect.objectContaining({x: 1.5, y: 0.5, size: 1, value: false}),
    expect.objectContaining({x: 0.5, y: 1.5, size: 1, value: false}),
    expect.objectContaining({x: 1.5, y: 1.5, size: 1, value: true}),
  ]);
});

test('point may disappear during refining', () => {
  const tree = new Quadtree((x, y) => x === 1 && y === 1);
  tree.compute({x: 0, y: 0, width: 4, height: 2}, 2, 1);
  tree.compress();
  const squares = tree.leaves();
  expect(squares).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
  ]);
});

test('recomputing with different viewport and resolution', () => {
  const tree = new Quadtree((x, y) => x <= y);

  tree.compute({x: 2, y: 2, width: 2, height: 2}, 1, 1);
  expect(tree.leaves()).toEqual([
    expect.objectContaining({x: 2.5, y: 2.5, size: 1, value: true}),
    expect.objectContaining({x: 3.5, y: 2.5, size: 1, value: false}),
    expect.objectContaining({x: 2.5, y: 3.5, size: 1, value: true}),
    expect.objectContaining({x: 3.5, y: 3.5, size: 1, value: true}),
  ]);

  tree.compute({x: 0, y: 0, width: 4, height: 4}, 2, 2);
  expect(tree.leaves()).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: true}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: true}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: true}),
  ]);
});

test('runs from same size leaves', () => {
  const tree = new Quadtree((x, y) => x > 1 && x < 3 && y < 1);
  tree.compute({x: 0, y: 0, width: 4, height: 2}, 1, 1);
  expect(tree.runs()).toEqual([
    {xMin: 0.5, xMax: 0.5, y: 0.5, value: false},
    {xMin: 1.5, xMax: 2.5, y: 0.5, value: true},
    {xMin: 3.5, xMax: 3.5, y: 0.5, value: false},
    {xMin: 0.5, xMax: 3.5, y: 1.5, value: false},
  ]);
});

// O········O
// O········O
test('runs from different size leaves', () => {
  const tree = new Quadtree((x) => x <= 1 || x >= 9);
  tree.compute({x: 0, y: 0, width: 10, height: 2}, 2, 1);
  expect(tree.runs()).toEqual([
    {xMin: 0.5, xMax: 0.5, y: 0.5, value: true},
    {xMin: 1.5, xMax: 8.5, y: 0.5, value: false},
    {xMin: 9.5, xMax: 9.5, y: 0.5, value: true},
    {xMin: 0.5, xMax: 0.5, y: 1.5, value: true},
    {xMin: 1.5, xMax: 8.5, y: 1.5, value: false},
    {xMin: 9.5, xMax: 9.5, y: 1.5, value: true},
  ]);
});

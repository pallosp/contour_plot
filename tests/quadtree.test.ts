import {Quadtree} from '../src/quadtree';
import {Rect, Square} from '../src/types';

function compareLeaves(a: Square<any>, b: Square<any>): number {
  return (a.y - b.y) || (a.x - b.x);
}

test('constant function', () => {
  const viewport: Rect = {x: 0, y: 0, width: 1, height: 1};
  const squares: Array<Square<number>> =
      new Quadtree(() => 2, viewport, 1, 1).leaves();
  expect(squares).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: 2}),
  ]);
});

test('sampling', () => {
  const viewport: Rect = {x: 0, y: 0, width: 4, height: 4};
  const squares: Array<Square<number>> =
      new Quadtree(() => 0, viewport, 2, 1).leaves();
  expect(squares.sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: 0}),
  ]);
});

test('viewport not aligned with samples', () => {
  const viewport: Rect = {x: 1, y: 1, width: 2, height: 2};
  const squares: Array<Square<number>> =
      new Quadtree(() => 0, viewport, 2, 1).leaves();
  expect(squares.sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: 0}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: 0}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: 0}),
  ]);
});

test('invalid sample distance', () => {
  const viewport: Rect = {x: 0, y: 0, width: 3, height: 3};
  expect(() => new Quadtree(() => 0, viewport, 3, 1)).toThrow();
});

test('invalid pixel size', () => {
  const viewport: Rect = {x: 0, y: 0, width: 4, height: 4};
  expect(() => new Quadtree(() => 0, viewport, 4, 3)).toThrow();
});

test('tree compression', () => {
  const viewport: Rect = {x: 0, y: 0, width: 4, height: 4};
  const tree: Quadtree<boolean> =
      new Quadtree((x, y) => x == y && x < 2, viewport, 2, 1);
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

test('4x4 viewport, x=y=0 or x=y=1', () => {
  const viewport: Rect = {x: 0, y: 0, width: 4, height: 4};
  const tree: Quadtree<boolean> =
      new Quadtree((x, y) => x == y && x < 2, viewport, 2, 1);
  expect(tree.leaves().length).toEqual(13);
});

test('4x4 viewport, x=y=0 or x=y=1, pixel size=2', () => {
  const viewport: Rect = {x: 0, y: 0, width: 4, height: 4};
  const tree: Quadtree<boolean> =
      new Quadtree((x, y) => x == y && x < 2, viewport, 2, 2);
  expect(tree.leaves().sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: true}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: false}),
  ]);
});

test('sampling too sparse', () => {
  const viewport: Rect = {x: 0, y: 0, width: 4, height: 4};
  const tree: Quadtree<boolean> =
      new Quadtree((x, y) => x + y == 1, viewport, 2, 1);
  expect(tree.leaves().sort(compareLeaves)).toEqual([
    expect.objectContaining({x: 1, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 1, size: 2, value: false}),
    expect.objectContaining({x: 1, y: 3, size: 2, value: false}),
    expect.objectContaining({x: 3, y: 3, size: 2, value: false}),
  ]);
});

test('resolves isolated points even with low sampling rate', () => {
  const viewport: Rect = {x: 0, y: 0, width: 13, height: 13};
  function circle(x: number, y: number) {
    return Math.sign(5 * 5 - (x - 6.5) ** 2 - (y - 6.5) ** 2);
  }
  const tree: Quadtree<number> = new Quadtree(circle, viewport, 8, 1);
  // The circle perimeter contains 12 grid points:
  //   center + ((±5, 0) ∨ (0, ±5) ∨ (±3, ±4) ∨ (±4, ±3))
  expect(tree.leaves().filter(l => l.value === 0).length).toEqual(12);
});

test('tolerates when sample distance < pixel size', () => {
  const viewport: Rect = {x: 0, y: 0, width: 2, height: 2};
  const squares: Square<boolean>[] =
      new Quadtree((x, y) => x === y, viewport, 0.5, 1).leaves();
  expect(squares).toEqual([
    expect.objectContaining({x: 0.5, y: 0.5, size: 1, value: true}),
    expect.objectContaining({x: 1.5, y: 0.5, size: 1, value: false}),
    expect.objectContaining({x: 0.5, y: 1.5, size: 1, value: false}),
    expect.objectContaining({x: 1.5, y: 1.5, size: 1, value: true}),
  ]);
});

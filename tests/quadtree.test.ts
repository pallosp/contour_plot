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

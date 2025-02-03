import {alignToGrid, overlappingArea} from '../src/rect';

test('alignToGrid', () => {
  expect(alignToGrid({x: 3, y: 6, width: 9, height: 12}, 3))
      .toEqual({x: 3, y: 6, width: 9, height: 12});
  expect(alignToGrid({x: 1, y: 2, width: 3, height: 4}, 5))
      .toEqual({x: 0, y: 0, width: 5, height: 10});
});

test('overlappingArea', () => {
  const rect = {x: 0, y: 0, width: 2, height: 2};

  expect(overlappingArea(rect, {x: 1, y: 1, width: 1, height: 0})).toBe(0);
  expect(overlappingArea(rect, {x: 1, y: 1, width: 0, height: 1})).toBe(0);

  expect(overlappingArea(rect, {x: 0, y: 0, width: 1, height: 1})).toBe(1);
  expect(overlappingArea(rect, {x: -1, y: 0, width: 1, height: 1})).toBe(0);
  expect(overlappingArea(rect, {x: 0, y: -1, width: 1, height: 1})).toBe(0);
  expect(overlappingArea(rect, {x: -1, y: -1, width: 2, height: 2})).toBe(1);

  expect(overlappingArea(rect, {x: 1, y: 1, width: 1, height: 1})).toBe(1);
  expect(overlappingArea(rect, {x: 2, y: 1, width: 1, height: 1})).toBe(0);
  expect(overlappingArea(rect, {x: 1, y: 2, width: 1, height: 1})).toBe(0);
  expect(overlappingArea(rect, {x: 1, y: 1, width: 2, height: 2})).toBe(1);

  expect(overlappingArea(rect, {x: -1, y: -1, width: 4, height: 4})).toBe(4);
});

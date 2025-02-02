import {alignToGrid} from '../src/rect';

test('alignToGrid', () => {
  expect(alignToGrid({x: 3, y: 6, width: 9, height: 12}, 3))
      .toEqual({x: 3, y: 6, width: 9, height: 12});
  expect(alignToGrid({x: 1, y: 2, width: 3, height: 4}, 5))
      .toEqual({x: 0, y: 0, width: 5, height: 10});
});

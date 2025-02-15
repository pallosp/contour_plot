import {Plot} from '../src/plot';
import {runsToBitmap, squaresToBitmap, squaresToText} from '../src/render';

test('disjoint squares', () => {
  const viewport = {x: 0, y: 0, width: 4, height: 2};
  const bitmap = squaresToBitmap(
      [{x: 1, y: 1, size: 2, value: 2}, {x: 3.5, y: 0.5, size: 1, value: 1}],
      viewport);
  expect(bitmap).toEqual([[2, 2, undefined, 1], [2, 2, undefined, undefined]]);
});

test('overlapping squares', () => {
  const viewport = {x: 0, y: 0, width: 3, height: 3};
  const bitmap = squaresToBitmap(
      [{x: 1, y: 1, size: 2, value: 1}, {x: 2, y: 2, size: 2, value: 2}],
      viewport);
  expect(bitmap).toEqual([[1, 1, undefined], [1, 2, 2], [undefined, 2, 2]]);
});

test('square sticks out at south-east', () => {
  const viewport = {x: 0, y: 0, width: 2, height: 2};
  const bitmap = squaresToBitmap([{x: 2, y: 2, size: 2, value: 1}], viewport);
  expect(bitmap).toEqual([[undefined, undefined], [undefined, 1]]);
});

test('square sticks out at north-west', () => {
  const viewport = {x: 0, y: 0, width: 2, height: 2};
  const bitmap = squaresToBitmap([{x: 0, y: 0, size: 2, value: 1}], viewport);
  expect(bitmap).toEqual([[1, undefined], [undefined, undefined]]);
});

test('viewport starts at negative coordinates', () => {
  const viewport = {x: -2, y: -1, width: 2, height: 1};
  const bitmap =
      squaresToBitmap([{x: -1.5, y: -0.5, size: 1, value: 1}], viewport);
  expect(bitmap).toEqual([[1, undefined]]);
});

test('zoomed squares', () => {
  const viewport = {x: 0, y: 0, width: 2, height: 1};
  const bitmap =
      squaresToBitmap([{x: 1.5, y: 0.5, size: 1, value: 2}], viewport, 2);
  expect(bitmap).toEqual(
      [[undefined, undefined, 2, 2], [undefined, undefined, 2, 2]]);
});

test('disjoint runs', () => {
  const viewport = {x: 0, y: 0, width: 4, height: 1};
  const bitmap = runsToBitmap(
      [
        {x0: 0.5, x1: 1.5, y: 0.5, value: 1},
        {x0: 3.5, x1: 3.5, y: 0.5, value: 2}
      ],
      viewport);
  expect(bitmap).toEqual([[1, 1, undefined, 2]]);
});

test('runs outside the viewport', () => {
  const viewport = {x: 0, y: 0, width: 1, height: 1};
  const bitmap = runsToBitmap(
      [
        {x0: -1.5, x1: -0.5, y: 0.5, value: 1},
        {x0: 1.5, x1: 2.5, y: 0.5, value: 1},
        {x0: 0.5, x1: 0.5, y: -0.5, value: 1},
        {x0: 0.5, x1: 0.5, y: 1.5, value: 1},
      ],
      viewport);
  expect(bitmap).toEqual([[undefined]]);
});

test('runs sticking out of the viewport', () => {
  const viewport = {x: 0, y: 0, width: 3, height: 1};
  const bitmap = runsToBitmap(
      [
        {x0: -1.5, x1: 0.5, y: 0.5, value: 1},
        {x0: 2.5, x1: 3.5, y: 0.5, value: 2},
      ],
      viewport);
  expect(bitmap).toEqual([[1, undefined, 2]]);
});

test('intersecting runs', () => {
  const viewport = {x: 0, y: 0, width: 3, height: 1};
  const bitmap = runsToBitmap(
      [
        {x0: 0.5, x1: 1.5, y: 0.5, value: 1},
        {x0: 1.5, x1: 2.5, y: 0.5, value: 2},
      ],
      viewport);
  expect(bitmap).toEqual([[1, 2, 2]]);
});

test('squaresToText, empty list', () => {
  expect(squaresToText([])).toBe('');
});

test('squaresToText, boolean values', () => {
  const unicodePlot =
      squaresToText(new Plot((x, y) => y < x - 4)
                        .compute({x: 0, y: 0, width: 12, height: 4}, 4, 1)
                        .squares());
  expect(unicodePlot)
      .toBe(
          '┌─────┐ □ ■ ▗▄▖ ▗▄▄▄▄▄▖ \n' +
          '│     │ □ □ ▝▀▘ ▐█████▌ \n' +
          '│     │ ┌─┐ □ ■ ▐█████▌ \n' +
          '└─────┘ └─┘ □ □ ▝▀▀▀▀▀▘ ');
});

test('squaresToText, numeric values', () => {
  const squares = [
    {x: 0.5, y: 0.5, size: 1, value: 0},
    {x: 1.5, y: 0.5, size: 1, value: 1},
    {x: 2.5, y: 0.5, size: 1, value: 2},
    {x: 3.5, y: 0.5, size: 1, value: NaN},
    {x: 4.5, y: 0.5, size: 1, value: null},
  ];
  expect(squaresToText(squares)).toBe('□ ■ ■ □ □ ');
});

test('squaresToText, custom pixelSize', () => {
  const square1 = {x: 0.5, y: 0.5, size: 1, value: false};
  const square2 = {x: 1.5, y: 0.5, size: 1, value: true};
  expect(squaresToText([square1, square2], {pixelSize: 0.5}))
      .toBe(
          '┌─┐ ▗▄▖ \n' +
          '└─┘ ▝▀▘ ');
});

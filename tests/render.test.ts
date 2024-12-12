import {squaresToBitmap} from '../src/render';

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

test('zooming', () => {
  const viewport = {x: 0, y: 0, width: 2, height: 1};
  const bitmap =
      squaresToBitmap([{x: 1.5, y: 0.5, size: 1, value: 2}], viewport, 2);
  expect(bitmap).toEqual(
      [[undefined, undefined, 2, 2], [undefined, undefined, 2, 2]]);
});

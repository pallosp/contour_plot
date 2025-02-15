/**
 * @jest-environment jsdom
 */

import {runsToSvg, squaresToSvg} from '../src/render';

test('runsToSvg, empty', () => {
  expect(runsToSvg([], () => {})).toEqual([]);
});

test('runsToSvg, y=0', () => {
  expect(() => runsToSvg([{xMin: 0, xMax: 1, y: 0, value: 1}], () => {}))
      .toThrow();
});

test('runsToSvg, x>0', () => {
  const svgElements =
      runsToSvg([{xMin: 3, xMax: 5, y: 1.5, value: 1}], () => {});
  expect(svgElements.length).toBe(1);
  expect(svgElements[0].children.length).toBe(1);
  expect(svgElements[0].children[0].getAttribute('d')).toBe('m3 1.5h2');
});

test('runsToSvg, zoomed in', () => {
  const svgElements = runsToSvg([{xMin: 2, xMax: 6, y: 1, value: 1}], () => {});
  expect(svgElements.length).toBe(1);
  expect(svgElements[0].getAttribute('transform')).toBe('scale(2)');
  expect(svgElements[0].children.length).toBe(1);
  expect(svgElements[0].children[0].getAttribute('d')).toBe('m1 0.5h2');
});

test('runsToSvg, zoomed out', () => {
  const svgElements =
      runsToSvg([{xMin: 2, xMax: 6, y: 0.25, value: 1}], () => {});
  expect(svgElements.length).toBe(1);
  expect(svgElements[0].getAttribute('transform')).toBe('scale(0.5)');
  expect(svgElements[0].children.length).toBe(1);
  expect(svgElements[0].children[0].getAttribute('d')).toBe('m4 0.5h8');
});

test('runsToSvg, multiple values', () => {
  const svgElements = runsToSvg(
      [
        {xMin: 0, xMax: 2, y: 0.5, value: 1},
        {xMin: 0, xMax: 2, y: 1.5, value: 2}
      ],
      () => {});
  expect(svgElements.length).toBe(2);
  expect(svgElements[0].children.length).toBe(1);
  expect(svgElements[0].children[0].getAttribute('d')).toBe('m0 0.5h2');
  expect(svgElements[1].children.length).toBe(1);
  expect(svgElements[1].children[0].getAttribute('d')).toBe('m0 1.5h2');
});

test('runsToSvg, zigzag optimization', () => {
  const svgElements = runsToSvg(
      [
        {xMin: 0, xMax: 2, y: 0.5, value: 1},
        {xMin: 0, xMax: 2, y: 1.5, value: 1},
        {xMin: 0, xMax: 2, y: 2.5, value: 1},
      ],
      () => {});
  expect(svgElements.length).toBe(1);
  expect(svgElements[0].children.length).toBe(1);
  expect(svgElements[0].children[0].getAttribute('d'))
      .toBe('m0 0.5h2m0 1h-2m0 1h2');
});

test('squaresToSvg, empty', () => {
  expect(squaresToSvg([], () => {})).toEqual([]);
});

test('squaresToSvg, run-length encoding', () => {
  const svgElements = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 0},
      ],
      () => {});
  expect(svgElements.length).toBe(1);
  expect(svgElements[0].getAttribute('d')).toBe('m0.5 0.5h1');
  expect(svgElements[0].getAttribute('transform')).toBe(null);
});

test('squaresToSvg, scaling', () => {
  const svgElements = squaresToSvg([{x: 1, y: 1, size: 2, value: 0}], () => {});
  expect(svgElements.length).toBe(1);
  expect(svgElements[0].getAttribute('d')).toBe('m0.5 0.5h0');
  expect(svgElements[0].getAttribute('transform')).toBe('scale(2)');
});

test('squaresToSvg, value mapping', () => {
  const svgElements = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 1},
      ],
      (el, value) => {
        el.classList.add('c' + String(value));
      });
  expect(svgElements.length).toBe(2);
  expect(svgElements[0].getAttribute('d')).toBe('m0.5 0.5h0');
  expect(svgElements[0].getAttribute('class')).toBe('c0');
  expect(svgElements[1].getAttribute('d')).toBe('m1.5 0.5h0');
  expect(svgElements[1].getAttribute('class')).toBe('c1');
});

test('squaresToSvg, multiple sizes', () => {
  const svgElements = squaresToSvg(
      [
        {x: 1, y: 1, size: 2, value: 0},
        {x: 2.5, y: 0.5, size: 1, value: 1},
      ],
      () => {});
  expect(svgElements.length).toBe(2);
  expect(svgElements[0].getAttribute('d')).toBe('m0.5 0.5h0');
  expect(svgElements[0].getAttribute('transform')).toBe('scale(2)');
  expect(svgElements[1].getAttribute('d')).toBe('m2.5 0.5h0');
  expect(svgElements[1].getAttribute('transform')).toBe(null);
});

test('squaresToSvg, one row, alternating values', () => {
  const svgElements = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 1},
        {x: 2.5, y: 0.5, size: 1, value: 0},
      ],
      () => {});
  expect(svgElements.length).toBe(2);
  expect(svgElements[0].getAttribute('d')).toBe('m0.5 0.5h0m2 0h0');
  expect(svgElements[1].getAttribute('d')).toBe('m1.5 0.5h0');
});

test('squaresToSvg, multiple rows', () => {
  const svgElements = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 1},
        {x: 0.5, y: 1.5, size: 1, value: 1},
        {x: 1.5, y: 1.5, size: 1, value: 0},
      ],
      () => {});
  expect(svgElements.length).toBe(2);
  expect(svgElements[0].getAttribute('d')).toBe('m0.5 0.5h0m1 1h0');
  expect(svgElements[1].getAttribute('d')).toBe('m1.5 0.5h0m-1 1h0');
});

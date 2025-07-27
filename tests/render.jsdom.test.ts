/**
 * @jest-environment jsdom
 */

import {runsToSvg, squaresToSvg} from '../src/render';

test('runsToSvg, empty', () => {
  expect(runsToSvg([], () => {})).toEqual([]);
});

test('runsToSvg, y=0', () => {
  expect(() => runsToSvg([{x0: 0, x1: 1, y: 0, value: 1}], () => {})).toThrow();
});

test('runsToSvg, x>0', () => {
  const root = runsToSvg([{x0: 3, x1: 5, y: 1.5, value: 1}], () => {})[0];
  expect(root.getAttribute('transform')).toBe('matrix(1 0 0 1 3 1)');
  const paths = root.children;
  expect(paths.length).toBe(1);
  expect(paths[0].children.length).toBe(1);
  expect(paths[0].children[0].getAttribute('d')).toBe('m0 0.5h2');
});

test('runsToSvg, zoomed in', () => {
  const root = runsToSvg([{x0: 2, x1: 8, y: 1, value: 1}], () => {})[0];
  expect(root.getAttribute('transform')).toBe('matrix(2 0 0 2 2 0)');
  const paths = root.children;
  expect(paths.length).toBe(1);
  expect(paths[0].children.length).toBe(1);
  expect(paths[0].children[0].getAttribute('d')).toBe('m0 0.5h3');
});

test('runsToSvg, zoomed out', () => {
  const root = runsToSvg([{x0: 2, x1: 8, y: 0.25, value: 1}], () => {})[0];
  expect(root.getAttribute('transform')).toBe('matrix(0.5 0 0 0.5 2 0)');
  const paths = root.children;
  expect(paths.length).toBe(1);
  expect(paths[0].children.length).toBe(1);
  expect(paths[0].children[0].getAttribute('d')).toBe('m0 0.5h12');
});

test('runsToSvg, multiple values', () => {
  const root = runsToSvg(
      [
        {x0: 0, x1: 2, y: 0.5, value: 1},
        {x0: 0, x1: 2, y: 1.5, value: 2},
      ],
      () => {})[0];
  const paths = root.children;
  expect(paths.length).toBe(2);
  expect(paths[0].children.length).toBe(1);
  expect(paths[0].children[0].getAttribute('d')).toBe('m0 0.5h2');
  expect(paths[1].children.length).toBe(1);
  expect(paths[1].children[0].getAttribute('d')).toBe('m0 1.5h2');
});

test('runsToSvg, zigzag optimization', () => {
  const root = runsToSvg(
      [
        {x0: 0, x1: 2, y: 0.5, value: 1},
        {x0: 0, x1: 2, y: 1.5, value: 1},
        {x0: 0, x1: 2, y: 2.5, value: 1},
      ],
      () => {})[0];
  const paths = root.children;
  expect(paths.length).toBe(1);
  expect(paths[0].children.length).toBe(1);
  expect(paths[0].children[0].getAttribute('d')).toBe('m0 0.5h2m0 1h-2m0 1h2');
});

test('runsToSvg, translated', () => {
  const transform = {a: 1, b: 0, c: 0, d: 1, e: 20, f: 10};
  const root =
      runsToSvg([{x0: 2, x1: 3, y: 1.5, value: 1}], () => {}, {transform})[0];
  expect(root.getAttribute('transform')).toBe('matrix(1 0 0 1 22 11)');
});

test('runsToSvg, translated and scaled', () => {
  const transform = {a: 2, b: 0, c: 0, d: 2, e: 20, f: 10};
  const root =
      runsToSvg([{x0: 2, x1: 3, y: 1.5, value: 1}], () => {}, {transform})[0];
  expect(root.getAttribute('transform')).toBe('matrix(2 0 0 2 24 12)');
});

test('squaresToSvg, empty', () => {
  expect(squaresToSvg([], () => {})).toEqual([]);
});

test('squaresToSvg, run-length encoding', () => {
  const root = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 0},
      ],
      () => {})[0];
  const paths = root.children;
  expect(paths.length).toBe(1);
  expect(paths[0].getAttribute('d')).toBe('m0.5 0.5h1');
  expect(paths[0].getAttribute('transform')).toBe(null);
});

test('squaresToSvg, scaling', () => {
  const root = squaresToSvg([{x: 1, y: 1, size: 2, value: 0}], () => {})[0];
  const paths = root.children;
  expect(paths.length).toBe(1);
  expect(paths[0].getAttribute('d')).toBe('m0.5 0.5h0');
  expect(paths[0].getAttribute('transform')).toBe('scale(2)');
});

test('squaresToSvg, value mapping', () => {
  const root = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 1},
      ],
      (el, value) => {
        el.classList.add('c' + String(value));
      })[0];
  const paths = root.children;
  expect(paths.length).toBe(2);
  expect(paths[0].getAttribute('d')).toBe('m0.5 0.5h0');
  expect(paths[0].getAttribute('class')).toBe('c0');
  expect(paths[1].getAttribute('d')).toBe('m1.5 0.5h0');
  expect(paths[1].getAttribute('class')).toBe('c1');
});

test('squaresToSvg, multiple sizes', () => {
  const root = squaresToSvg(
      [
        {x: 1, y: 1, size: 2, value: 0},
        {x: 2.5, y: 0.5, size: 1, value: 1},
      ],
      () => {})[0];
  const paths = root.children;
  expect(paths.length).toBe(2);
  expect(paths[0].getAttribute('d')).toBe('m0.5 0.5h0');
  expect(paths[0].getAttribute('transform')).toBe('scale(2)');
  expect(paths[1].getAttribute('d')).toBe('m2.5 0.5h0');
  expect(paths[1].getAttribute('transform')).toBe(null);
});

test('squaresToSvg, one row, alternating values', () => {
  const root = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 1},
        {x: 2.5, y: 0.5, size: 1, value: 0},
      ],
      () => {})[0];
  const paths = root.children;
  expect(paths.length).toBe(2);
  expect(paths[0].getAttribute('d')).toBe('m0.5 0.5h0m2 0h0');
  expect(paths[1].getAttribute('d')).toBe('m1.5 0.5h0');
});

test('squaresToSvg, multiple rows', () => {
  const root = squaresToSvg(
      [
        {x: 0.5, y: 0.5, size: 1, value: 0},
        {x: 1.5, y: 0.5, size: 1, value: 1},
        {x: 0.5, y: 1.5, size: 1, value: 1},
        {x: 1.5, y: 1.5, size: 1, value: 0},
      ],
      () => {})[0];
  const paths = root.children;
  expect(paths.length).toBe(2);
  expect(paths[0].getAttribute('d')).toBe('m0.5 0.5h0m1 1h0');
  expect(paths[1].getAttribute('d')).toBe('m1.5 0.5h0m-1 1h0');
});

test('squaresToSvg, showing edges', () => {
  const root = squaresToSvg(
      [{x: 0.5, y: 0.5, size: 1, value: 0}], () => {}, {edges: true})[0];
  expect(root.getAttribute('stroke-width')).toBe('.9');
  const paths = root.children;
  expect(paths.length).toBe(1);
  expect(paths[0].getAttribute('d')).toBe('m0.5 0.5h0');
});

test('squaresToSvg, with domain to view transformation', () => {
  const root = squaresToSvg(
      [{x: 1, y: 1, size: 2, value: 0}], () => {},
      {transform: {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6}})[0];
  expect(root.getAttribute('transform')).toBe('matrix(1 2 3 4 5 6)');
});

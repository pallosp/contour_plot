import {Bench} from 'tinybench';

import {Quadtree} from '../src/quadtree';

function mandelbrot(x: number, y: number): number {
  let re = x, im = y, i = 0;
  for (; re * re + im * im < 4 && i < 1000; i++) {
    const t = (re + im) * (re - im) + x;
    im = 2 * re * im + y;
    re = t;
  }
  return i % 6;
}

function checkerboard(x: number, y: number): boolean {
  return x === y || Math.clz32(x - y & y - x) + 1 < Math.clz32(x & -x);
}

const PIXEL_SIZE = 1 / 128;
const SAMPLE_DISTANCE = 1 / 4;
const viewport = {
  x: -3,
  y: -3,
  width: 6,
  height: 6
};

const bench = new Bench({warmupIterations: 5});

const mandelbrotTree = new Quadtree(mandelbrot);
mandelbrotTree.compute(viewport, SAMPLE_DISTANCE, PIXEL_SIZE);

bench.add('Mandelbrot ∀ px', () => {
  const xMin = viewport.x + PIXEL_SIZE / 2;
  const xMax = viewport.x + viewport.width - PIXEL_SIZE / 2;
  const yMin = viewport.y + PIXEL_SIZE / 2;
  const yMax = viewport.y + viewport.height - PIXEL_SIZE / 2;
  for (let y = yMin; y <= yMax; y += PIXEL_SIZE) {
    for (let x = xMin; x <= xMax; x += PIXEL_SIZE) {
      mandelbrot(x, y);
    }
  }
});
bench.add('Mandelbrot tree', () => {
  mandelbrotTree.compute(viewport, SAMPLE_DISTANCE, PIXEL_SIZE);
});
bench.add('Mandelbrot runs', () => {
  mandelbrotTree.runs();
});

const checkerboardTree = new Quadtree(
    (x, y) => x === y || Math.clz32(x - y & y - x) + 1 < Math.clz32(x & -x));

bench.add('Checkers ∀ px', () => {
  for (let y = 1; y < 128; y += 2) {
    for (let x = 1; x < 128; x += 2) {
      checkerboard(x, y);
    }
  }
});
bench.add('Checkers tree', () => {
  checkerboardTree.compute({x: 0, y: 0, width: 128, height: 128}, 16, 2);
});

await bench.run();

console.table(bench.table());

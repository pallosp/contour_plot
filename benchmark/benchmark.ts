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

const PIXEL_SIZE = 1 / 128;
const SAMPLE_DISTANCE = 1 / 4;
const viewport = {
  x: -3,
  y: -3,
  width: 6,
  height: 6
};

const bench = new Bench({warmupIterations: 5});

const tree = new Quadtree(mandelbrot);
tree.compute(viewport, SAMPLE_DISTANCE, PIXEL_SIZE);

bench.add('eval ∀ pixels', () => {
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
bench.add('build tree', () => {
  tree.compute(viewport, SAMPLE_DISTANCE, PIXEL_SIZE);
});
bench.add('build runs', () => {
  tree.runs();
});

await bench.run();

console.table(bench.table());

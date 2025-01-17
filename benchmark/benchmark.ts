import {Bench} from 'tinybench';

import {Quadtree} from '../src/quadtree';

function mandelbrot(x: number, y: number): number {
  let re = x, im = y, i = 0;
  for (; re * re + im * im < 4 && i < 1000; i++) {
    const t = re * re - im * im + x;
    im = 2 * re * im + y;
    re = t;
  }
  return i % 6;
}

const viewport = {
  x: -3,
  y: -3,
  width: 6,
  height: 6
};

const bench = new Bench({warmupIterations: 5});
const tree = new Quadtree(mandelbrot, viewport, 1 / 4, 1 / 128);

bench.add('build tree', () => {
  new Quadtree(mandelbrot, viewport, 1 / 4, 1 / 128);
});
bench.add('build runs', () => {
  tree.runs();
});

await bench.run();

console.table(bench.table());

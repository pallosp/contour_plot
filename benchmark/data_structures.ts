// Command to run the benchmark:
// npx tsx benchmark/data_structures

import {Bench} from 'tinybench';

const bench =
    new Bench({name: 'Adding 50k elements to key-value data structures'});

bench.add('float keyed Map', () => {
  const m = new Map<number, number>;
  for (let i = 0.5; i < 100000; i += 2) m.set(i, i);
});
bench.add('int keyed Map', () => {
  const m = new Map<number, number>;
  for (let i = 0; i < 100000; i += 2) m.set(i, i);
});
bench.add('10 int keyed Maps', () => {
  for (let i = 0; i < 10; i++) {
    const m = new Map<number, number>;
    for (let j = 0; j < 10000; j += 2) m.set(j, j);
  }
});
bench.add('sparse Array, 0.5', () => {
  const a: number[] = new Array(100000);
  for (let i = 0; i < 100000; i += 2) a[i] = i;
});
bench.add('sparse Array, 0.1', () => {
  const a: number[] = new Array(500000);
  for (let i = 0; i < 500000; i += 10) a[i] = i;
});
bench.add('sparse Array, 0.05', () => {
  const a: number[] = new Array(1000000);
  for (let i = 0; i < 1000000; i += 20) a[i] = i;
});

await bench.run();

console.info(bench.name);
console.table(bench.table());

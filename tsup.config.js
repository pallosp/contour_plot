import {defineConfig} from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist/npm',
  clean: true,
  dts: true,
  format: 'esm',
  minify: true,
  sourcemap: true,
  splitting: false,
});

import {Quadtree} from '../src/quadtree';
import {runsToPathElements, squaresToPathElements} from '../src/render';
import {Run, Square} from '../src/types';

import {ViewportDragger} from './viewport_dragger';

type PlotConfig = {
  func: (x: number, y: number) => number,
  sampleDistance: number,
  classes: string[],
  zoom: number,
};
let lastPlotConfig: PlotConfig|undefined;

const svg = document.querySelector('svg')!;
const chart = svg.querySelector<SVGElement>('#chart')!;
const vd = new ViewportDragger(svg, chart, 1);

function random(min: number, max: number): number {
  return Math.random() * (max - min + 1) + min;
}

function linePointDistance(
    [a, b, c]: [number, number, number], x: number, y: number) {
  return Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b);
}

function plotRandomLines() {
  const zoom = 64;
  vd.reset(zoom);
  const lines: Array<[number, number, number]> = [];
  for (let i = 0; i < 10; i++) {
    lines.push([random(-5, 5), random(-5, 5), random(-25, 25)]);
  }
  plotFunction({
    func: (x, y) =>
        lines.some(
            (line, i) => linePointDistance(line, x, y) < 0.12 / (i + 3)) ?
        0 :
        1,
    sampleDistance: 1 / 4,
    classes: ['perimeter', 'outside'],
    zoom,
  });
}

function circleAt([cx, cy, r]: [number, number, number], x: number, y: number) {
  const d = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2);
  return d < r - 0.02 ? 1 : d > r + 0.02 ? -1 : 0;
}

function plotRandomCircles() {
  const zoom = 64;
  vd.reset(zoom);
  const circles: Array<[number, number, number]> = [];
  for (let i = 0; i < 10; i++) {
    circles.push([random(-10, 10), random(-6, 6), random(0.5, 4)]);
  }
  plotFunction({
    func: (x, y) => circles.reduce((acc, c) => acc * circleAt(c, x, y), 1) + 1,
    sampleDistance: 1 / 4,
    classes: ['outside', 'perimeter', 'inside'],
    zoom,
  });
}

function mandelbrot(x: number, y: number): number {
  let re = x, im = y, i = 0;
  for (; re * re + im * im < 4 && i < 1000; i++) {
    const t = (re + im) * (re - im) + x;
    im = 2 * re * im + y;
    re = t;
  }
  return i % 6;
}

function plotMandelbrot() {
  const zoom = 256;
  vd.reset(zoom);
  plotFunction({
    func: mandelbrot,
    sampleDistance: 1 / 4,
    classes: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
    zoom,
  });
}

function plotSinCos() {
  const zoom = 64;
  vd.reset(zoom);
  plotFunction({
    func: (x, y) => Math.floor((Math.sin(x) + Math.cos(y)) * 1.5) + 3,
    sampleDistance: 1 / 4,
    classes: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'],
    zoom,
  });
}

function roundDownToPow2(x: number): number {
  return 2 ** Math.floor(Math.log2(x));
}

function plotFunction(plotConfig: PlotConfig) {
  lastPlotConfig = plotConfig;
  let {func, sampleDistance, classes} = plotConfig;
  const showEdges = document.getElementById('show-edges') as HTMLInputElement;
  const useRuns = document.getElementById('use-runs') as HTMLInputElement;
  const viewport = vd.viewport();
  const pixelSizeInput =
      document.querySelector<HTMLInputElement>('#pixel-size')!;
  const pixelSize = 2 ** +pixelSizeInput.value / roundDownToPow2(vd.zoom);
  sampleDistance = Math.max(sampleDistance, pixelSize);

  const startCompute = Date.now();
  const tree = new Quadtree(func, viewport, sampleDistance, pixelSize);

  const startPostprocess = Date.now();
  let runs: Array<Run<number>> = [];
  let squares: Array<Square<number>> = [];
  if (useRuns.checked) {
    runs = tree.runs();
  } else {
    tree.compress();
    squares = tree.leaves();
  }

  const startDraw = Date.now();
  const valueToClass = (value: number) => classes[value];
  const pathElements = useRuns.checked ?
      runsToPathElements(runs, valueToClass) :
      squaresToPathElements(squares, valueToClass);
  if (showEdges.checked) {
    for (const path of pathElements) {
      path.setAttribute('stroke-width', '0.9px');
      path.removeAttribute('shape-rendering');
    }
  }
  const chart = document.getElementById('chart')!;
  chart.textContent = '';
  chart.append(...pathElements);

  const computeTime = startPostprocess - startCompute;
  const postprocessTime = startDraw - startPostprocess;
  const renderTime = Date.now() - startDraw;
  const evalCount = tree.size();
  const rectCount = squares.length + runs.length;
  const pixelCount = viewport.width * viewport.height / pixelSize ** 2;
  const pixelPerEval = Math.round(pixelCount * 10 / evalCount) / 10;
  const svgSize = Math.round(chart.innerHTML.length / 1024);
  document.querySelector('.time')!.textContent =
      `Computed f(x,y) ${evalCount} times, once for every ${
          pixelPerEval} pixels in ${computeTime} ms. ` +
      `Built ${rectCount} rectangles in
      ${postprocessTime} ms and rendered them in ${renderTime} ms. ` +
      `SVG size: ${svgSize} KiB`;
}

function updatePlot() {
  lastPlotConfig!.sampleDistance *=
      roundDownToPow2(lastPlotConfig!.zoom) / roundDownToPow2(vd.zoom);
  lastPlotConfig!.zoom = vd.zoom;
  plotFunction(lastPlotConfig!);
}

function main() {
  document.getElementById('random-lines')!.onclick = plotRandomLines;
  document.getElementById('random-circles')!.onclick = plotRandomCircles;
  document.getElementById('mandelbrot-set')!.onclick = plotMandelbrot;
  document.getElementById('sin-cos')!.onclick = plotSinCos;
  document.getElementById('show-edges')!.onclick = updatePlot;
  document.getElementById('use-runs')!.onclick = updatePlot;
  document.getElementById('pixel-size')!.onchange = updatePlot;

  vd.addEventListener('change', updatePlot);
  plotRandomLines();
}

main();

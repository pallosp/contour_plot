import {evalDiscrete2dFunction, evalDiscrete2dFunctionAsRuns} from './eval';
import {runsToPathElements, squaresToPathElements} from './render';
import {Run, Square} from './types';

type PlotConfig = [
  func: (x: number, y: number) => number,
  sampleDistance: number,
  classes: string[],
  zoom: number,
];
let lastPlotConfig: PlotConfig|undefined;

function random(min: number, max: number): number {
  return Math.random() * (max - min + 1) + min;
}

function linePointDistance(
    [a, b, c]: [number, number, number], x: number, y: number) {
  return Math.abs(a * x + b * y + c) / Math.sqrt(a * a + b * b);
}

function plotRandomLines() {
  const lines: Array<[number, number, number]> = [];
  for (let i = 0; i < 10; i++) {
    lines.push([random(-5, 5), random(-5, 5), random(-25, 25)]);
  }
  document.querySelector('#function')!.textContent = '10 lines';
  plotFunction(
      (x, y) =>
          lines.some(
              (line, i) => linePointDistance(line, x, y) < 0.12 / (i + 3)) ?
          0 :
          1,
      /* sampleDistance= */ 1 / 4, ['perimeter', 'outside'], 64);
}

function circleAt([cx, cy, r]: [number, number, number], x: number, y: number) {
  let d = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2);
  return d < r - 0.02 ? 1 : d > r + 0.02 ? -1 : 0;
}

function plotRandomCircles() {
  const circles: Array<[number, number, number]> = [];
  for (let i = 0; i < 10; i++) {
    circles.push([random(-10, 10), random(-6, 6), random(0.5, 4)]);
  }
  document.querySelector('#function')!.textContent = '10 circles';
  plotFunction(
      (x, y) => circles.reduce((acc, c) => acc * circleAt(c, x, y), 1) + 1,
      /* sampleDistance= */ 1 / 4, ['outside', 'perimeter', 'inside'], 64);
}

function mandelbrot(x: number, y: number): number {
  let re = x, im = y, i = 0;
  for (i = 0; re * re + im * im < 4 && i < 1000; i++) {
    const t = re * re - im * im + x;
    im = 2 * re * im + y;
    re = t;
  }
  return i % 6;
}

function plotMandelbrot() {
  document.querySelector('#function')!.textContent = 'Mandelbrot set';
  plotFunction(
      mandelbrot, /* sampleDistance= */ 1 / 4,
      ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], 256);
}

function plotSinCos() {
  document.querySelector('#function')!.textContent = 'sin x + cos y';
  plotFunction(
      (x, y) => Math.floor((Math.sin(x) + Math.cos(y)) * 1.5) + 3,
      /* sampleDistance= */ 1 / 4, ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'], 64);
}

function plotFunction(
    func: (x: number, y: number) => number,
    sampleDistance: number,
    classes: string[],
    zoom: number,
) {
  lastPlotConfig = [func, sampleDistance, classes, zoom];
  const showEdges = document.getElementById('show-edges') as HTMLInputElement;
  const useRuns = document.getElementById('use-runs') as HTMLInputElement;
  const svg = document.querySelector('svg')!;
  svg.querySelector<SVGElement>('#chart')!.style.transform =
      `translate(50%, 50%) scale(${zoom})`;
  const viewport = {
    x: -svg.clientWidth / zoom / 2,
    y: -svg.clientHeight / zoom / 2,
    width: svg.clientWidth / zoom,
    height: svg.clientHeight / zoom
  };
  const pixelSizeInput =
      document.querySelector<HTMLInputElement>('#pixel-size')!;
  const pixelSize = 2 ** +pixelSizeInput.value / zoom;
  sampleDistance = Math.max(sampleDistance, pixelSize);
  const startCompute = Date.now();
  const plot = useRuns.checked ?
      evalDiscrete2dFunctionAsRuns(func, viewport, sampleDistance, pixelSize) :
      evalDiscrete2dFunction(func, viewport, sampleDistance, pixelSize);

  const startDraw = Date.now();
  const valueToClass = (value: number) => classes[value];
  const pathElements = useRuns.checked ?
      runsToPathElements(plot as Array<Run<number>>, valueToClass) :
      squaresToPathElements(plot as Array<Square<number>>, valueToClass);
  if (showEdges.checked) {
    for (const path of pathElements) {
      path.setAttribute('stroke-width', '0.9px');
      path.removeAttribute('shape-rendering');
    }
  }
  const chart = document.getElementById('chart')!;
  chart.textContent = '';
  chart.append(...pathElements);

  const svgSize = chart.innerHTML.length;
  document.querySelector('.time')!.textContent =
      `Computed ${plot.length} nodes in ${startDraw - startCompute} ms, ` +
      `and rendered them in ${Date.now() - startDraw} ms. ` +
      `SVG size: ${svgSize} bytes`;
}

function updatePlot() {
  plotFunction(...lastPlotConfig!);
}

function main() {
  document.getElementById('random-lines')!.onclick = plotRandomLines;
  document.getElementById('random-circles')!.onclick = plotRandomCircles;
  document.getElementById('mandelbrot-set')!.onclick = plotMandelbrot;
  document.getElementById('sin-cos')!.onclick = plotSinCos;
  document.getElementById('show-edges')!.onclick = updatePlot;
  document.getElementById('use-runs')!.onclick = updatePlot;
  document.getElementById('pixel-size')!.onchange = updatePlot;
  let updateTimer = 0;
  window.onresize = () => {
    clearTimeout(updateTimer);
    updateTimer = window.setTimeout(updatePlot, 35);
  };
  plotRandomLines();
}

main();

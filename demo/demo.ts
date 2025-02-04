import {Plot, runsToSvg, squaresToSvg} from '../src';

import {ViewportDragger} from './viewport_dragger';

type PlotParams<T> = {
  plot: Plot<T>,
  sampleSpacing: number,
  addStyles: (value: T, element: SVGElement) => void,
  zoom: number,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastPlotParams: PlotParams<any>|undefined;
let lastUseBlocks = false;

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
    plot: new Plot(
        (x, y) => lines.some(
            (line, i) => linePointDistance(line, x, y) < 0.12 / (i + 3))),
    sampleSpacing: 1 / 2,
    addStyles: (value, el) => {
      el.classList.add(value ? 'outside' : 'perimeter');
    },
    zoom,
  } as PlotParams<boolean>);
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
  const classes = ['outside', 'perimeter', 'inside'];
  plotFunction({
    plot: new Plot(
        (x: number, y: number) =>
            circles.reduce((acc, c) => acc * circleAt(c, x, y), 1)),
    sampleSpacing: 1 / 2,
    addStyles: (value, el) => void el.classList.add(classes[value + 1]),
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
    plot: new Plot(mandelbrot),
    sampleSpacing: 1 / 2,
    addStyles: (value, el) => {
      el.style.stroke = '#' + (value % 6 * 3).toString(16).repeat(3);
    },
    zoom,
  } as PlotParams<number>);
}

function plotSinCos() {
  const zoom = 64;
  vd.reset(zoom);
  plotFunction({
    plot: new Plot((x, y) => Math.floor((Math.sin(x) + Math.cos(y)) * 1.5)),
    sampleSpacing: 1,
    addStyles: (value, el) => {
      el.style.stroke = '#' + ((value + 3) * 3).toString(16).repeat(3);
    },
    zoom,
  } as PlotParams<number>);
}

function roundDownToPow2(x: number): number {
  return 2 ** Math.floor(Math.log2(x));
}

function plotFunction<T>(plotParams: PlotParams<T>) {
  let {plot, sampleSpacing, addStyles} = plotParams;
  const useBlocks =
      (document.getElementById('use-blocks') as HTMLInputElement).checked;
  const viewport = vd.viewport();
  const pixelSizeInput =
      document.querySelector<HTMLInputElement>('#pixel-size')!;
  const pixelSize = 2 ** +pixelSizeInput.value / roundDownToPow2(vd.zoom);
  sampleSpacing = Math.max(sampleSpacing, pixelSize);

  plot.compute(viewport, sampleSpacing, pixelSize);
  const computeStats = plot.computeStats();

  const startPostprocess = Date.now();
  const runs = useBlocks ? [] : plot.runs();
  const squares = useBlocks ? plot.squares() : [];

  const startDraw = Date.now();
  const svgElements =
      useBlocks ? squaresToSvg(squares, addStyles) : runsToSvg(runs, addStyles);
  if (useBlocks) {
    // Show the edges of the building blocks.
    for (const el of svgElements) {
      el.setAttribute('stroke-width', '0.9px');
      el.removeAttribute('shape-rendering');
    }
  }
  const chart = document.getElementById('chart')!;
  chart.textContent = '';
  chart.append(...svgElements);

  const computeTime = computeStats.elapsedMs;
  const postprocessTime = startDraw - startPostprocess;
  const renderTime = Date.now() - startDraw;
  const evalCount = computeStats.deltaSize;
  const rectCount = squares.length + runs.length;
  const pixelPerEval =
      Math.round(computeStats.affectedPixels * 10 / evalCount) / 10;
  const svgSize = Math.round(chart.innerHTML.length / 1024);

  if (computeStats.deltaSize > 0 || useBlocks != lastUseBlocks) {
    const computeStatsText = computeStats.deltaSize > 0 ?
        `Computed f(x,y) ${evalCount} times, once for every ${
            pixelPerEval} pixels in ${Math.round(computeTime)} ms. ` :
        '';
    const renderStatsText = `Built ${rectCount} rectangles in ${
        postprocessTime} ms and drawn them in ${renderTime} ms. `;
    const svgStatsText = `SVG size: ${svgSize} KiB`;
    document.querySelector('#plot-stats')!.textContent =
        computeStatsText + renderStatsText + svgStatsText;
  }

  lastPlotParams = plotParams;
  lastUseBlocks = useBlocks;
}

function updatePlot() {
  lastPlotParams!.sampleSpacing *=
      roundDownToPow2(lastPlotParams!.zoom) / roundDownToPow2(vd.zoom);
  lastPlotParams!.zoom = vd.zoom;
  plotFunction(lastPlotParams!);
}

function main() {
  document.getElementById('random-lines')!.onclick = plotRandomLines;
  document.getElementById('random-circles')!.onclick = plotRandomCircles;
  document.getElementById('mandelbrot-set')!.onclick = plotMandelbrot;
  document.getElementById('sin-cos')!.onclick = plotSinCos;
  document.getElementById('use-blocks')!.onclick = updatePlot;
  document.getElementById('pixel-size')!.onchange = updatePlot;

  vd.addEventListener('change', updatePlot);
  plotRandomLines();
}

main();

import {Plot, runsToSvg, squaresToSvg} from '../src';
import {containsRect} from '../src/rect';

import {ViewportDragger} from './viewport_dragger';

type PlotParams<T> = {
  name: string,
  plot: Plot<T>,
  sampleSpacing: number,
  addStyles: (element: SVGGraphicsElement, value: T) => void,
  zoom: number,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastPlotParams: PlotParams<any>|undefined;
let lastShowEdges = false;

const svg = document.querySelector('svg')!;
const chart = svg.querySelector<SVGElement>('#chart')!;
const vd = new ViewportDragger(svg, chart, 1);

const plotters: {[key: string]: () => void} = {
  'random-lines': plotRandomLines,
  'random-circles': plotRandomCircles,
  'mandelbrot-set': plotMandelbrot,
  'sin-cos': plotSinCos
};

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
    name: 'random-lines',
    plot: new Plot(
        (x, y) => lines.some(
            (line, i) => linePointDistance(line, x, y) < 0.12 / (i + 3))),
    sampleSpacing: 1 / 2,
    addStyles: (el, value) => {
      el.classList.add(value ? 'outside' : 'perimeter');
    },
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
  const classes = ['outside', 'perimeter', 'inside'];
  plotFunction({
    name: 'random-circles',
    plot: new Plot(
        (x: number, y: number) =>
            circles.reduce((acc, c) => acc * circleAt(c, x, y), 1)),
    sampleSpacing: 1 / 2,
    addStyles: (el, value) => void el.classList.add(classes[value + 1]),
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
    name: 'mandelbrot-set',
    plot: new Plot(mandelbrot),
    sampleSpacing: 1 / 4,
    addStyles: (el, value) => {
      el.style.stroke = '#' + (value % 6 * 3).toString(16).repeat(3);
    },
    zoom,
  });
}

function plotSinCos() {
  const zoom = 64;
  vd.reset(zoom);
  plotFunction({
    name: 'sin-cos',
    plot: new Plot((x, y) => Math.floor((Math.sin(x) + Math.cos(y)) * 1.5)),
    sampleSpacing: 1,
    addStyles: (el, value) => {
      el.style.stroke = '#' + ((value + 3) * 3).toString(16).repeat(3);
    },
    zoom,
  });
}

function roundDownToPow2(x: number): number {
  return 2 ** Math.floor(Math.log2(x));
}

function plotFunction<T>(plotParams: PlotParams<T>) {
  let {name, plot, sampleSpacing, addStyles} = plotParams;
  history.replaceState(null, '', '?f=' + encodeURIComponent(name));
  const showEdges =
      (document.getElementById('show-edges') as HTMLInputElement).checked;
  let viewport = vd.viewport();
  const pixelSizeInput =
      document.querySelector<HTMLInputElement>('#pixel-size')!;
  const pixelSize = 2 ** +pixelSizeInput.value / roundDownToPow2(vd.zoom);
  sampleSpacing = Math.max(sampleSpacing, pixelSize);

  if (sampleSpacing === lastPlotParams?.sampleSpacing &&
      pixelSize === lastPlotParams?.plot?.pixelSize() &&
      containsRect(plotParams.plot.domain(), viewport)) {
    viewport = plotParams.plot.domain();
  }
  plot.compute(viewport, sampleSpacing, pixelSize);
  const computeStats = plot.computeStats();

  const startPostprocess = Date.now();
  const runs = showEdges ? [] : plot.runs();
  const squares = showEdges ? plot.squares() : [];

  const startDraw = Date.now();
  const domainToView = new DOMMatrix()
                           .scale(1 / plot.pixelSize())
                           .translate(-plot.domain().x, -plot.domain().y);
  const svgElements = showEdges ?
      squaresToSvg(squares, addStyles, {transform: domainToView, edges: true}) :
      runsToSvg(runs, addStyles, {transform: domainToView});
  vd.setToDomainTransform(domainToView.inverse());

  const chart = document.getElementById('chart')!;
  chart.textContent = '';
  chart.append(...svgElements);

  const computeTime = computeStats.elapsedMs;
  const postprocessTime = startDraw - startPostprocess;
  const renderTime = Date.now() - startDraw;
  const evalCount = computeStats.newCalls;
  const tileCount = squares.length + runs.length;
  const pixelPerEval = Math.round(computeStats.newArea * 10 / evalCount) / 10;
  const svgSize = Math.round(chart.innerHTML.length / 1024);

  if (computeStats.newCalls > 0 || showEdges != lastShowEdges) {
    const computeStatsText = computeStats.newCalls > 0 ?
        `Computed f(x,y) ${evalCount} times, once for every ${
            pixelPerEval} pixels in ${Math.round(computeTime)} ms. ` :
        '';
    const renderStatsText =
        `Built ${tileCount} ${showEdges ? 'squares' : 'runs'} in ${
            postprocessTime} ms and drawn them in ${renderTime} ms. `;
    const svgStatsText = `SVG size: ${svgSize} KiB`;
    document.querySelector('#plot-stats')!.textContent =
        computeStatsText + renderStatsText + svgStatsText;
  }

  lastPlotParams = plotParams;
  lastShowEdges = showEdges;
}

function updatePlot() {
  const plotParams = {...lastPlotParams!};
  plotParams.sampleSpacing *=
      roundDownToPow2(lastPlotParams!.zoom) / roundDownToPow2(vd.zoom);
  plotParams.zoom = vd.zoom;
  plotFunction(plotParams);
}

function main() {
  for (const name in plotters) {
    document.getElementById(name)!.onclick = plotters[name];
  }
  document.getElementById('show-edges')!.onclick = updatePlot;
  document.getElementById('pixel-size')!.onchange = updatePlot;
  vd.addEventListener('change', updatePlot);

  const plotterName = new URL(location.href).searchParams.get('f');
  const plotter = plotters[plotterName ?? ''] ?? plotRandomLines;
  plotter();
}

main();

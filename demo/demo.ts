import {Quadtree, runsToSvg, squaresToSvg} from '../src';

import {ViewportDragger} from './viewport_dragger';

type Plot<T> = {
  tree: Quadtree<T>,
  sampleDistance: number,
  addStyles: (value: T, element: SVGElement) => void,
  zoom: number,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastPlot: Plot<any>|undefined;

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
    tree: new Quadtree(
        (x, y) => lines.some(
            (line, i) => linePointDistance(line, x, y) < 0.12 / (i + 3))),
    sampleDistance: 1 / 2,
    addStyles: (value, el) => {
      el.classList.add(value ? 'outside' : 'perimeter');
    },
    zoom,
  } as Plot<boolean>);
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
    tree: new Quadtree(
        (x, y) => circles.reduce((acc, c) => acc * circleAt(c, x, y), 1)),
    sampleDistance: 1 / 2,
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
    tree: new Quadtree(mandelbrot),
    sampleDistance: 1 / 2,
    addStyles: (value, el) => {
      el.style.stroke = '#' + (value % 6 * 3).toString(16).repeat(3);
    },
    zoom,
  });
}

function plotSinCos() {
  const zoom = 64;
  vd.reset(zoom);
  plotFunction({
    tree: new Quadtree((x, y) => Math.floor((Math.sin(x) + Math.cos(y)) * 1.5)),
    sampleDistance: 1,
    addStyles: (value, el) => {
      el.style.stroke = '#' + ((value + 3) * 3).toString(16).repeat(3);
    },
    zoom,
  } as Plot<number>);
}

function roundDownToPow2(x: number): number {
  return 2 ** Math.floor(Math.log2(x));
}

function plotFunction<T>(plot: Plot<T>) {
  lastPlot = plot;
  let {tree, sampleDistance, addStyles} = plot;
  const useBlocks =
      (document.getElementById('use-blocks') as HTMLInputElement).checked;
  const viewport = vd.viewport();
  const pixelSizeInput =
      document.querySelector<HTMLInputElement>('#pixel-size')!;
  const pixelSize = 2 ** +pixelSizeInput.value / roundDownToPow2(vd.zoom);
  sampleDistance = Math.max(sampleDistance, pixelSize);

  const startCompute = Date.now();
  tree.compute(viewport, sampleDistance, pixelSize);

  const startPostprocess = Date.now();
  const runs = useBlocks ? [] : tree.runs();
  const squares = useBlocks ? tree.squares() : [];

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
  lastPlot!.sampleDistance *=
      roundDownToPow2(lastPlot!.zoom) / roundDownToPow2(vd.zoom);
  lastPlot!.zoom = vd.zoom;
  plotFunction(lastPlot!);
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

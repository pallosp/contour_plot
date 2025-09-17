# Contour Plot

[![NPM package](https://img.shields.io/npm/v/contour-plot-svg)](https://npmjs.org/package/contour-plot-svg "View this project on npm")
[![Bundle size](https://img.shields.io/bundlephobia/min/contour-plot-svg)](https://bundlephobia.com/package/contour-plot-svg)
![Downloads](https://img.shields.io/npm/dt/contour-plot-svg)
[![MIT license](https://img.shields.io/badge/license-MIT-brightgreen)](https://opensource.org/licenses/MIT)

**Contour Plot** is a TypeScript library designed for efficient plotting of
functions that map (x, y) points to a limited set of discrete values. The
library evaluates the function at grid points with configurable density, refines
boundaries where neighboring grid points produce different values, and generates
a list of squares or runs (unit-height rectangles). Within each square or run,
the function's value is treated as constant. The coordinates of the building
blocks are selected so that they can be precisely and efficiently rendered as
SVG.

## Example usage

### SVG output

The following TypeScript code snippet will create an SVG and draw a filled
hyperbola:

```typescript
import {Plot, runsToSvg} from 'contour-plot-svg';

document.body.innerHTML =
    '<svg style="width: 100%; height: calc(100vh - 20px)" />';
const svg = document.querySelector('svg')!;

const hyperbola = (x: number, y: number) => x * y > 10000;

const [width, height] = [svg.clientWidth, svg.clientHeight];
const domain = {x: -width / 2, y: -height / 2, width, height};
const domainToViewTransform =
    new DOMMatrix().translate(width / 2, height / 2).flipY();

svg.append(...runsToSvg(
    new Plot<boolean>(hyperbola)
        .compute(domain, /* sampleSpacing= */ 128, /* pixelSize= */ 1)
        .runs(),
    /* addStyles= */ (el, isInside) => {
      el.style.stroke = isInside ? 'olive' : 'lightgreen';
    }, {transform: domainToViewTransform}));
```

[Demo on CodePen](https://codepen.io/Peter-Pallos/full/wBvWRBJ)

### Text output

The library can also visualize boolean-valued functions using Unicode block
drawing characters, exposing the plot's underlying structure:

```typescript
import {Plot, squaresToText} from 'contour-plot-svg';

const domain = {x: -8, y: -8, width: 16, height: 8};
const plot = new Plot((x, y) => x * x + y * y < 45)
    .compute(domain, /* sampleSpacing= */ 4, /* pixelSize= */ 1);

const pre = document.createElement('pre');
pre.style.lineHeight = '1';
pre.textContent = squaresToText(plot.squares());
document.body.append(pre);
```

Result

```
┌─┐ ┌─┐ ┌─┐ □ □ □ □ ┌─┐ ┌─┐ ┌─┐ 
└─┘ └─┘ └─┘ ■ ■ ■ ■ └─┘ └─┘ └─┘ 
┌─┐ □ □ ▗▄▖ ▗▄▖ ▗▄▖ ▗▄▖ □ □ ┌─┐ 
└─┘ □ ■ ▝▀▘ ▝▀▘ ▝▀▘ ▝▀▘ ■ □ └─┘ 
┌─┐ ▗▄▖ ▗▄▄▄▄▄▖ ▗▄▄▄▄▄▖ ▗▄▖ ┌─┐ 
└─┘ ▝▀▘ ▐█████▌ ▐█████▌ ▝▀▘ └─┘ 
□ ■ ▗▄▖ ▐█████▌ ▐█████▌ ▗▄▖ ■ □ 
□ ■ ▝▀▘ ▝▀▀▀▀▀▘ ▝▀▀▀▀▀▘ ▝▀▘ ■ □ 
```

[Demo on CodePen](https://codepen.io/Peter-Pallos/full/vEYKvag)

## Interactive demo

To start a demo showcasing all features, run the following commands then open
http://localhost:4173. There you can select a function to plot, specify the
resolution, and optionally highlight the edges of the building blocks.

```sh
git clone https://github.com/pallosp/contour_plot.git
cd contour_plot
npm install
npm run build
npm run preview
```

### Screenshot

<img src="screenshot.png" alt="demo screenshot" style="width:587px;"/>

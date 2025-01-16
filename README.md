# Contour Plot

[![MIT license](https://img.shields.io/badge/license-MIT-brightgreen.svg)](https://opensource.org/licenses/MIT)

**Contour Plot** is a TypeScript library designed for efficient plotting of functions that map `(x, y)` points to a limited set of discrete values. The library evaluates the function at grid points with configurable density, refines boundaries where neighboring grid points produce different values, and generates a list of squares or runs (unit-height rectangles). Within each square or run, the function's value is treated as constant. The coordinates of the building blocks are selected so that they can be precisely and efficiently rendered as SVG.

## Demo

To run a demo, build it with `npm run build`, start a web server with `npm run preview`, then open http://localhost:4173  
There you can select a function to plot, specify the resolution, and optionally highlight the edges of the building blocks.

<img src="screenshot.png" alt="demo screenshot" style="width:541px;"/>

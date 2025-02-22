import {Rect} from '../src/rect';

/**
 * A 2D affine transformation matrix compatible with SVGMatrix and DOMMatrix,
 * with the notable difference of supporting 64-bit coefficients.
 *
 * [a c e]
 * [b d f]
 * [0 0 1]
 */
export interface TransformationMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export class ViewportDragger extends EventTarget {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private translateX = 0;
  private translateY = 0;
  private width: number;
  private height: number;
  private preTransform: TransformationMatrix = new DOMMatrix();
  private debounceFrames = 0;
  private overlay = createOverlay();

  private readonly mouseMoveListener = (e: Event) =>
      this.mouseMove(e as MouseEvent);
  private readonly mouseUpListener = () => this.mouseUp();

  constructor(
      private readonly mouseEl: HTMLElement|SVGElement,
      private readonly transformEl: SVGElement, public zoom: number) {
    super();
    this.width = mouseEl.clientWidth;
    this.height = mouseEl.clientHeight;
    this.reset(zoom);
    mouseEl.addEventListener(
        'mousedown', (e) => this.mouseDown(e as MouseEvent));
    mouseEl.addEventListener('wheel', (e) => this.wheel(e as WheelEvent));
    new ResizeObserver(() => this.resize()).observe(mouseEl);
  }

  private mouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();  // Don't select nearby text while panning.
    this.dragging = true;
    document.body.appendChild(this.overlay);
    window.addEventListener('mousemove', this.mouseMoveListener, true);
    window.addEventListener('mouseup', this.mouseUpListener);
    this.lastX = e.x;
    this.lastY = e.y;
  }

  private mouseMove(e: MouseEvent) {
    if (this.dragging) {
      this.translateX += e.x - this.lastX;
      this.translateY += e.y - this.lastY;
      this.lastX = e.x;
      this.lastY = e.y;
      this.update();
      this.dispatchChange();
    }
  }

  private mouseUp() {
    this.dragging = false;
    this.overlay.remove();
    window.removeEventListener('mousemove', this.mouseMoveListener);
    window.removeEventListener('mouseup', this.mouseUpListener);
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    const zoomMult = 0.999 ** e.deltaY;
    this.translateX =
        Math.round(((this.translateX - e.offsetX) * zoomMult + e.offsetX) * 2) /
        2;
    this.translateY =
        Math.round(((this.translateY - e.offsetY) * zoomMult + e.offsetY) * 2) /
        2;
    this.zoom *= zoomMult;
    this.update();
    this.dispatchChange();
  }

  private resize() {
    const w = this.mouseEl.clientWidth;
    const h = this.mouseEl.clientHeight;
    if (w === this.width && h === this.height) return;
    this.translateX += (w - this.width) / 2;
    this.translateY += (h - this.height) / 2;
    this.width = w;
    this.height = h;
    this.update();
    this.dispatchChange();
  }

  private update() {
    const {a, b, c, d, e, f} = this.preTransform;
    const z = this.zoom;
    const transform = new DOMMatrix([
      a * z, b * z, c * z, d * z, e * z + this.translateX,
      f * z + this.translateY
    ]);
    this.transformEl.setAttribute('transform', transform.toString());
  }

  private dispatchChange() {
    const callback = () => {
      if (--this.debounceFrames > 0) {
        requestAnimationFrame(callback);
      } else {
        this.dispatchEvent(new Event('change'));
      }
    };
    const prevFrames = this.debounceFrames;
    this.debounceFrames = 3;
    if (prevFrames === 0) callback();
  }

  public viewport(): Rect {
    return {
      x: -this.translateX / this.zoom,
      y: -this.translateY / this.zoom,
      width: this.width / this.zoom,
      height: this.height / this.zoom,
    };
  }

  public setPreTransform(preTransform: TransformationMatrix) {
    this.preTransform = preTransform;
    this.update();
  }

  public reset(zoom: number) {
    this.zoom = zoom;
    this.preTransform = new DOMMatrix();
    this.translateX = this.width / 2;
    this.translateY = this.height / 2;
    this.update();
  }
}

/**
 * Creates an element over the entire document to set the mouse cursor.
 */
function createOverlay(): Element {
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.cursor = 'grab';
  return overlay;
}

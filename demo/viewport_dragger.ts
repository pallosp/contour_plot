import {Rect} from '../src/rect';

export class ViewportDragger extends EventTarget {
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private translateX = 0;
  private translateY = 0;
  private throttleTimer = 0;
  private width: number;
  private height: number;

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
    this.mouseEl.addEventListener('mousemove', this.mouseMoveListener);
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
    this.mouseEl.removeEventListener('mousemove', this.mouseMoveListener);
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
    this.translateX += (w - this.width) / 2;
    this.translateY += (h - this.height) / 2;
    this.width = w;
    this.height = h;
    this.update();
    this.dispatchChange();
  }

  private update() {
    this.transformEl.style.transform = `translate(${this.translateX}px, ${
        this.translateY}px) scale(${this.zoom})`;
  }

  private dispatchChange() {
    if (this.throttleTimer) {
      window.clearTimeout(this.throttleTimer);
    }
    this.throttleTimer = window.setTimeout(() => {
      this.throttleTimer = 0;
      this.dispatchEvent(new Event('change'));
    }, 35);
  }

  public viewport(): Rect {
    return {
      x: -this.translateX / this.zoom,
      y: -this.translateY / this.zoom,
      width: this.width / this.zoom,
      height: this.height / this.zoom,
    };
  }

  public reset(zoom: number) {
    this.zoom = zoom;
    this.translateX = this.width / 2;
    this.translateY = this.height / 2;
    this.update();
  }
}

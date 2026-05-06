export class CanvasInput {
  constructor(canvas, { onStroke, strokeColor = '#e2e8f0', strokeWidth = 4 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onStroke = onStroke;
    this.strokeColor = strokeColor;
    this.strokeWidth = strokeWidth;
    this.strokes = [];
    this.current = null;
    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this._onMove(e));
    this.canvas.addEventListener('pointerup', (e) => this._onUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this._onUp(e));
    this.canvas.style.touchAction = 'none';
  }

  _pt(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  }

  _onDown(e) {
    this.current = { points: [this._pt(e)] };
    if (this.canvas.setPointerCapture) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch {}
    }
  }

  _onMove(e) {
    if (!this.current) return;
    const p = this._pt(e);
    this.current.points.push(p);
    this._drawSegment(this.current.points.at(-2), p);
  }

  _onUp(e) {
    if (!this.current) return;
    if (this.current.points.length === 1) this.current.points.push(this._pt(e));
    const stroke = this.current;
    this.strokes.push(stroke);
    this.current = null;
    this.onStroke?.(stroke);
  }

  _drawSegment(a, b) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  clear() {
    this.strokes = [];
    this.current = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getStrokes() { return this.strokes; }
}

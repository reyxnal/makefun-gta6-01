// Keyboard + mouse input. The game reads this state each tick; menus and
// the pause screen also listen through the same key events.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each tick
    this.mouse = { x: 0, y: 0, down: false, clicked: false, rightDown: false };
    this.anyKey = false;
    this.wheelDelta = 0;
    this.canvas = canvas || document.getElementById('game');
    const cv = this.canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(k);
      this.pressed.add(k);
      this.anyKey = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) e.preventDefault();
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    this._onMove = (e) => {
      const r = cv.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    this._onDown = (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) this.mouse.rightDown = true;
      this.anyKey = true;
    };
    this._onUp = (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    };
    this._onBlur = () => { this.keys.clear(); this.mouse.down = false; };
    this._onCtx = (e) => e.preventDefault();
    this._onWheel = (e) => { this.wheelDelta += e.deltaY > 0 ? 1 : -1; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    cv.addEventListener('mousemove', this._onMove);
    cv.addEventListener('mousedown', this._onDown);
    window.addEventListener('mouseup', this._onUp);
    cv.addEventListener('contextmenu', this._onCtx);
    cv.addEventListener('wheel', this._onWheel, { passive: true });
  }

  mouseDown(button) {
    return button === 2 ? this.mouse.rightDown : this.mouse.down;
  }

  consumeWheel() {
    const d = this.wheelDelta;
    this.wheelDelta = 0;
    return d;
  }

  down(...names) {
    return names.some((n) => this.keys.has(n));
  }

  hit(...names) {
    return names.some((n) => this.pressed.has(n));
  }

  // Movement axes, -1..1, from WASD or arrows.
  axes() {
    let x = 0, y = 0;
    if (this.down('a', 'ArrowLeft')) x -= 1;
    if (this.down('d', 'ArrowRight')) x += 1;
    if (this.down('w', 'ArrowUp')) y -= 1;
    if (this.down('s', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  endTick() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  // Alias: the main loop calls endFrame().
  endFrame() {
    this.endTick();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMove);
    this.canvas.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mouseup', this._onUp);
    this.canvas.removeEventListener('contextmenu', this._onCtx);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }
}

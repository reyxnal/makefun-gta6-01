// Keyboard and mouse input. Pointer lock is optional: arrow keys rotate the
// camera too, so the whole game is playable keyboard-only.

export class InputState {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    this.enabled = false;
    this.onFirstGesture = null;
    this.gestureFired = false;
    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return;
      this.keys.add(ev.code);
      this.pressed.add(ev.code);
      this.fireGesture();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
    });
    window.addEventListener('keyup', (ev) => { this.keys.delete(ev.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    this.canvas.addEventListener('click', () => {
      this.fireGesture();
      if (this.enabled && !this.locked) {
        try { this.canvas.requestPointerLock(); } catch (err) { /* lock unavailable */ }
      }
    });
    document.addEventListener('mousemove', (ev) => {
      if (!this.locked) return;
      this.mouseDX += ev.movementX || 0;
      this.mouseDY += ev.movementY || 0;
    });
    document.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
      this.fireGesture();
    });
    document.addEventListener('mouseup', (ev) => {
      if (ev.button === 0) this.mouseDown = false;
    });
  }

  fireGesture() {
    if (this.gestureFired) return;
    this.gestureFired = true;
    if (this.onFirstGesture) this.onFirstGesture();
  }

  consumeMouseDelta() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  axisForward() {
    let v = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) v += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) v -= 1;
    return v;
  }

  axisStrafe() {
    let v = 0;
    if (this.isDown('KeyD')) v += 1;
    if (this.isDown('KeyA')) v -= 1;
    return v;
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}

// Solmar Heat — keyboard + mouse input. One job: raw device state, nothing else.
// Keys are read by code name so WASD and arrows both work.
const KEYS = new Set();
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let mouseClicked = false;
let anyKey = false;

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    KEYS.add(e.code);
    anyKey = true;
  });
  window.addEventListener('keyup', (e) => KEYS.delete(e.code));
  window.addEventListener('blur', () => KEYS.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    mouseDown = true;
    mouseClicked = true;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
  });
}

export function key(code) {
  return KEYS.has(code);
}
export function up() {
  return key('KeyW') || key('ArrowUp');
}
export function down() {
  return key('KeyS') || key('ArrowDown');
}
export function left() {
  return key('KeyA') || key('ArrowLeft');
}
export function right() {
  return key('KeyD') || key('ArrowRight');
}
export function runKey() {
  return key('ShiftLeft') || key('ShiftRight');
}
export function interactKey() {
  return key('KeyE');
}
export function punchKey() {
  return key('Space');
}
export function pauseKey() {
  return key('Escape') || key('KeyP');
}
export function mouse() {
  return { x: mouseX, y: mouseY, down: mouseDown };
}
export function consumeClick() {
  const c = mouseClicked;
  mouseClicked = false;
  return c;
}
export function consumeAnyKey() {
  const k = anyKey;
  anyKey = false;
  return k;
}
export function clearKeys() {
  KEYS.clear();
}

// Solmar Heat — entry point. One job: own the game state, run the loop, route
// input to the right system, and host the ?shot= / ?selftest= hooks.
import { WORLD_W, WORLD_H, PLAYER, CAR, MISSIONS, DIALOGUE_INTRO, clamp, dist } from './config.js';
import { generateCity } from './city.js';
import { makePlayer, makeCar, moveOnFoot, driveCar, nearestCar, enterCar, exitCar, collideCars } from './entities.js';
import { spawnTraffic, spawnPedestrians, updateTraffic, updatePedestrians } from './traffic.js';
import { addWanted, updatePolice } from './police.js';
import { currentMission, startMission, updateMissions } from './missions.js';
import { spawnPickups, shoot, punch, updateGuards, updatePickups } from './combat.js';
import { resizeCanvas, drawWorld, drawMenu, drawOverlay } from './render.js';
import { stageShot } from './shots.js';
import { initInput, up, down, left, right, runKey, interactKey, punchKey, pauseKey, mouse, consumeClick, consumeAnyKey } from './input.js';
import { initAudio, setEngine, setSiren, startMusic, sfxClick, sfxSteal, sfxWasted, toggleMute } from './audio.js';
import { saveGame, loadSave, hasSave } from './save.js';
import { makeRng } from './rng.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let view = resizeCanvas(canvas);
window.addEventListener('resize', () => {
  view = resizeCanvas(canvas);
});
initInput(canvas);

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const SEED = Number.isFinite(seedParam) ? seedParam : 7;

export function newGame(seed, saveData) {
  const city = generateCity(seed);
  const rng = makeRng(seed + 11);
  const player = makePlayer(1400, 1000);
  if (saveData) {
    player.money = saveData.money || 0;
    player.health = saveData.health || PLAYER.maxHealth;
    player.x = saveData.x || 1400;
    player.y = saveData.y || 1000;
  }
  const state = {
    seed,
    city,
    player,
    traffic: spawnTraffic(city, 14, rng, player.x, player.y),
    police: [],
    peds: spawnPedestrians(city, 26, rng),
    guards: [],
    pickups: [],
    wanted: saveData ? saveData.wanted || 0 : 0,
    wantedTimer: 26,
    lastCrime: null,
    missionIndex: saveData ? saveData.missionIndex || 0 : 0,
    completedMissions: saveData ? saveData.completed || 0 : 0,
    mission: null,
    dialogue: null,
    dialogueTimer: 0,
    message: null,
    messageTimer: 0,
    screen: 'menu',
    camera: { x: player.x, y: player.y },
    tracers: [],
    hitMarkers: [],
    gunfireTimer: 0,
    time: 0,
    hintTimer: 0,
    playerInDanger: false,
    gameWon: false,
    missionFailed: false,
    menuButtons: [],
    savedMissions: -1,
  };
  state.crime = (kind) => addWanted(state, kind);
  spawnPickups(state, rng);
  return state;
}

let state = newGame(SEED, null);
let lastTs = 0;
let prevInteract = false;
let prevPause = false;
let prevMute = false;

function layoutMenuButtons() {
  const { w, h } = view;
  const bw = 300;
  const bx = w / 2 - bw / 2;
  const buttons = [{ label: '▶  MULAI', action: 'start', x: bx, y: h / 2 - 40, w: bw, h: 52, hover: false }];
  if (hasSave()) {
    buttons.push({ label: '↻  LANJUTKAN', action: 'continue', x: bx, y: h / 2 + 24, w: bw, h: 52, hover: false });
  }
  buttons.push({ label: 'ℹ  CARA MAIN', action: 'howto', x: bx, y: h / 2 + (hasSave() ? 88 : 24), w: bw, h: 52, hover: false });
  state.menuButtons = buttons;
}

function startPlay(fromSave) {
  const saveData = fromSave ? loadSave() : null;
  state = newGame(SEED, saveData);
  state.screen = 'play';
  state.hintTimer = 12;
  state.dialogue = DIALOGUE_INTRO.slice(0, 2);
  state.dialogueTimer = 7;
  startMission(state, state.missionIndex);
  initAudio();
  startMusic();
  sfxClick();
  lastTs = performance.now();
}

function update(dt) {
  const p = state.player;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (state.gunfireTimer > 0) state.gunfireTimer -= dt;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.dialogueTimer > 0) state.dialogueTimer -= dt;
  if (state.hintTimer > 0) state.hintTimer -= dt;
  for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
    state.tracers[i].life -= dt;
    if (state.tracers[i].life <= 0) state.tracers.splice(i, 1);
  }
  for (let i = state.hitMarkers.length - 1; i >= 0; i -= 1) {
    state.hitMarkers[i].life -= dt;
    if (state.hitMarkers[i].life <= 0) state.hitMarkers.splice(i, 1);
  }

  // Pause / mute edge detection.
  const pauseNow = pauseKey();
  if (pauseNow && !prevPause) {
    state.screen = state.screen === 'play' ? 'paused' : state.screen === 'paused' ? 'play' : state.screen;
    sfxClick();
  }
  prevPause = pauseNow;
  if (state.screen !== 'play') return;
  if (window.__muteKey && window.__muteKey()) { /* reserved */ }
  if (consumeAnyKey()) initAudio();

  // Movement.
  if (p.car) {
    const throttle = up() ? 1 : down() ? -1 : 0;
    const steer = left() ? -1 : right() ? 1 : 0;
    driveCar(p.car, throttle, steer, dt, state.city, true);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    setEngine(Math.abs(p.car.speed) / CAR.maxSpeed, true);
    if (Math.abs(p.car.speed) > 500) state.playerInDanger = true;
    else state.playerInDanger = false;
  } else {
    p.speed = runKey() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let dx = (right() ? 1 : 0) - (left() ? 1 : 0);
    let dy = (down() ? 1 : 0) - (up() ? 1 : 0);
    moveOnFoot(p, dx, dy, dt, state.city);
    setEngine(0, false);
  }

  // Enter / exit / steal a car (E, edge-triggered).
  const interNow = interactKey();
  if (interNow && !prevInteract) {
    if (p.car) {
      exitCar(p);
      sfxClick();
    } else {
      const car = nearestCar(state.traffic, p.x, p.y, 70);
      if (car) {
        const wasParked = car.speed < 5;
        enterCar(p, car);
        state.traffic = state.traffic.filter((c) => c !== car);
        if (!wasParked || true) {
          state.crime('steal');
          sfxSteal();
          state.message = 'Mobil dicuri! Polisi mengejarmu!';
          state.messageTimer = 3;
        }
      }
    }
  }
  prevInteract = interNow;

  // Combat: mouse click shoots, Space punches.
  const m = mouse();
  if (m.down && p.onFoot) {
    const wx = state.camera.x + (m.x - view.w / 2);
    const wy = state.camera.y + (m.y - view.h / 2);
    shoot(state, wx, wy);
  }
  if (punchKey()) punch(state);

  // World systems.
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updatePolice(state, dt);
  updateGuards(state, dt);
  updatePickups(state, dt);
  updateMissions(state, dt);

  // Car-vs-car collisions involving the player car.
  if (p.car) {
    for (let i = 0; i < state.traffic.length; i += 1) {
      if (collideCars(p.car, state.traffic[i])) {
        state.crime('ram-police');
      }
    }
  }

  // Camera follows the player.
  state.camera.x = clamp(p.x, view.w / 2 - 100, WORLD_W - view.w / 2 + 100);
  state.camera.y = clamp(p.y, view.h / 2 - 100, WORLD_H - view.h / 2 + 100);

  // Autosave whenever a mission completes.
  if (state.completedMissions !== state.savedMissions) {
    state.savedMissions = state.completedMissions;
    saveGame(state);
  }

  // Death / win screens.
  if (p.health <= 0 && state.screen === 'play') {
    state.screen = 'wasted';
    sfxWasted();
    setEngine(0, false);
    setSiren(false);
  }
  state.time += dt;
}

function render() {
  if (state.screen === 'menu') {
    layoutMenuButtons();
    const m = mouse();
    for (let i = 0; i < state.menuButtons.length; i += 1) {
      const b = state.menuButtons[i];
      b.hover = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
    }
    drawMenu(ctx, state, view);
    return;
  }
  drawWorld(ctx, state, view);
  if (state.screen !== 'play') drawOverlay(ctx, state, view);
}

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000 || 0.016, 0.05);
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function handleClick() {
  if (!consumeClick()) return;
  initAudio();
  if (state.screen === 'menu') {
    const m = mouse();
    for (let i = 0; i < state.menuButtons.length; i += 1) {
      const b = state.menuButtons[i];
      if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
        if (b.action === 'start') startPlay(false);
        else if (b.action === 'continue') startPlay(true);
        else if (b.action === 'howto') {
          state.dialogue = ['Cara main', 'WASD gerak • E curi / masuk mobil • Klik tembak • Spasi pukul • Esc jeda'];
          state.dialogueTimer = 99;
        }
        return;
      }
    }
    return;
  }
  if (state.screen === 'wasted' || state.screen === 'failed') {
    const idx = state.screen === 'failed' ? state.missionIndex : state.missionIndex;
    state = newGame(SEED, null);
    state.missionIndex = idx;
    state.screen = 'play';
    startMission(state, idx);
    lastTs = performance.now();
    return;
  }
  if (state.screen === 'won') {
    state = newGame(SEED, null);
    state.screen = 'menu';
  }
}

// Mute on M, polled in the loop via keydown listener.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') toggleMute();
});

canvas.addEventListener('mousedown', handleClick);
window.addEventListener('mousedown', () => {
  if (state.screen !== 'menu') handleClick();
});

// ---- Headless hooks: ?shot= and ?selftest= (used for screenshots + checks) ----
const shotName = params.get('shot');
if (shotName) {
  const ok = stageShot(shotName, state);
  if (ok) {
    view = resizeCanvas(canvas);
    drawWorld(ctx, state, view);
    document.title = 'SHOT ' + shotName;
  } else {
    document.title = 'SHOT UNKNOWN';
  }
} else if (params.get('selftest') === '1') {
  runSelfTest();
  view = resizeCanvas(canvas);
  drawWorld(ctx, state, view);
} else {
  layoutMenuButtons();
  requestAnimationFrame((ts) => {
    lastTs = ts;
    requestAnimationFrame(loop);
  });
}

function runSelfTest() {
  const results = [];
  function check(name, fn) {
    try {
      const ok = fn();
      results.push({ name, pass: !!ok });
    } catch (err) {
      results.push({ name, pass: false, error: String(err && err.message ? err.message : err) });
    }
  }
  check('city-has-buildings', () => state.city.buildings.length > 100);
  check('city-has-roads', () => state.city.vRoads.length >= 5 && state.city.hRoads.length >= 4);
  check('player-spawns-on-road', () => {
    const p = state.player;
    return Math.abs(p.x - 1400) < 2 && Math.abs(p.y - 1000) < 2;
  });
  check('drive-moves-car', () => {
    const s = newGame(SEED, null);
    const car = makeCar(1400, 1000, 0, '#d9392b', 'player');
    enterCar(s.player, car);
    const x0 = car.x;
    for (let i = 0; i < 120; i += 1) driveCar(car, 1, 0, 1 / 60, s.city, true);
    return car.x - x0 > 100;
  });
  check('steal-raises-wanted', () => {
    const s = newGame(SEED, null);
    const car = makeCar(s.player.x + 30, s.player.y, 0, '#d9392b', 'traffic');
    s.traffic.push(car);
    enterCar(s.player, car);
    s.crime('steal');
    return s.wanted === 1;
  });
  check('police-spawn-matches-wanted', () => {
    const s = newGame(SEED, null);
    s.crime('steal');
    s.crime('hit-ped');
    return s.police.length === 3 && s.wanted === 3;
  });
  check('mission-goto-completes', () => {
    const s = newGame(SEED, null);
    startMission(s, 0);
    const money0 = s.player.money;
    s.player.x = 2960;
    s.player.y = 1200;
    updateMissions(s, 0.1);
    return s.missionIndex === 1 && s.player.money === money0 + 150;
  });
  check('shoot-consumes-ammo', () => {
    const s = newGame(SEED, null);
    const ammo0 = s.player.ammo;
    const fired = shoot(s, s.player.x + 100, s.player.y);
    return fired && s.player.ammo === ammo0 - 1 && s.tracers.length === 1;
  });
  check('save-load-roundtrip', () => {
    const s = newGame(SEED, null);
    s.player.money = 777;
    s.missionIndex = 2;
    saveGame(s);
    const loaded = loadSave();
    return loaded && loaded.money === 777 && loaded.missionIndex === 2;
  });
  check('zero-network-requests', () => {
    const entries = performance.getEntriesByType('resource');
    return entries.every((e) => e.name.startsWith(window.location.origin) || e.name.startsWith('data:'));
  });
  check('render-one-frame', () => {
    const v = resizeCanvas(canvas);
    drawWorld(ctx, state, v);
    return true;
  });
  check('mission-chain-has-five', () => MISSIONS.length === 5);
  const passed = results.filter((r) => r.pass).length;
  const el = document.getElementById('selftest');
  const text = JSON.stringify({ passed, total: results.length, results }, null, 2);
  if (el) el.textContent = text;
  document.title = 'SELFTEST ' + passed + '/' + results.length;
  window.__selftest = { passed, total: results.length, results };
}

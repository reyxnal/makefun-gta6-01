// Solmar Heat — story missions. One job: the five-mission chain, its
// objectives, timers, rewards and dialogue. The game loop calls updateMissions
// every frame; it only reads and writes state.
import { MISSIONS, dist, clamp } from './config.js';
import { makeCar } from './entities.js';
import { sfxMission } from './audio.js';

export function currentMission(state) {
  if (state.missionIndex >= MISSIONS.length) return null;
  return MISSIONS[state.missionIndex];
}

export function startMission(state, index) {
  const m = MISSIONS[index];
  if (!m) return;
  state.mission = {
    def: m,
    phase: 'active',
    timer: m.timeLimit || 0,
    stolenCar: null,
    guardsLeft: 0,
  };
  state.dialogue = [m.title, m.brief];
  state.dialogueTimer = 6;
  if (m.type === 'fight') {
    spawnGuards(state, m.x, m.y);
    state.mission.guardsLeft = state.guards.length;
  }
  if (m.type === 'steal') {
    spawnTargetCar(state, m.x, m.y);
  }
}

function spawnGuards(state, x, y) {
  state.guards = [];
  for (let i = 0; i < 3; i += 1) {
    state.guards.push({
      x: x + (i - 1) * 90,
      y: y + 120 + (i % 2) * 60,
      angle: Math.PI,
      health: 50,
      shootCooldown: 1 + i * 0.5,
      alive: true,
      speed: 90,
    });
  }
}

function spawnTargetCar(state, x, y) {
  const car = makeCar(x, y, -Math.PI / 2, '#d9392b', 'traffic', 'sport');
  car.targetCar = true;
  car.speed = 0;
  state.traffic.push(car);
  state.mission.stolenCar = car;
}

export function updateMissions(state, dt) {
  const m = state.mission;
  if (!m) return;
  const def = m.def;
  const p = state.player;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      state.message = 'Waktu habis! Misi gagal — coba lagi.';
      state.missionFailed = true;
      state.screen = 'failed';
      return;
    }
  }
  if (def.type === 'goto' || def.type === 'escape') {
    if (dist(p.x, p.y, def.x, def.y) < def.radius) completeMission(state);
  } else if (def.type === 'steal') {
    const car = m.stolenCar;
    if (car && car.driver === 'player') {
      state.message = 'Mobil curian didapat! Bawa ke garasi (tanda kuning).';
      m.phase = 'deliver';
    }
    if (m.phase === 'deliver' && p.car === car && dist(p.x, p.y, def.deliverX, def.deliverY) < def.radius) {
      completeMission(state);
    }
  } else if (def.type === 'fight') {
    const alive = state.guards.filter((g) => g.alive).length;
    m.guardsLeft = alive;
    if (alive === 0 && dist(p.x, p.y, def.x, def.y) < def.radius) completeMission(state);
    else if (alive === 0) state.message = 'Penjaga habis! Ambil uang di gudang (tanda kuning).';
  } else if (def.type === 'timed') {
    if (dist(p.x, p.y, def.x, def.y) < def.radius) completeMission(state);
  }
}

export function completeMission(state) {
  const m = state.mission;
  if (!m) return;
  const def = m.def;
  state.player.money += def.reward;
  state.completedMissions += 1;
  state.message = `MISI SELESAI +$${def.reward}`;
  state.dialogue = [def.title + ' — SELESAI', def.done];
  state.dialogueTimer = 6;
  sfxMission();
  state.missionIndex += 1;
  state.mission = null;
  if (state.missionIndex >= MISSIONS.length) {
    state.screen = 'won';
    state.gameWon = true;
    return;
  }
  startMission(state, state.missionIndex);
}

export function missionMarker(state) {
  const m = state.mission;
  if (!m) return null;
  const def = m.def;
  if (def.type === 'steal' && m.phase === 'deliver') {
    return { x: def.deliverX, y: def.deliverY, label: 'GARASI' };
  }
  if (def.type === 'steal' && m.stolenCar) {
    return { x: m.stolenCar.x, y: m.stolenCar.y, label: 'CURI MOBIL INI' };
  }
  return { x: def.x, y: def.y, label: def.type === 'fight' ? 'GUDANG' : 'TUJUAN' };
}

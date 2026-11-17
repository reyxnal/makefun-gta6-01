// People: pedestrians with sidewalk routines and fear, foot police who
// chase and arrest, and the Gulls crew who shoot back. Witness sight
// checks live here because they belong to eyes, not to the wanted meter.

import { TUNING, clamp, angleDiff } from './config.js';
import { collideCircle, randomSidewalkPoint, segmentBlocked } from './city.js';
import { makeRng, pick, range, chance } from './rng.js';

const SHIRTS = ['#d94f4f', '#4f7ad9', '#e8b64f', '#5aa87a', '#8a5aa8', '#e8e4d2', '#3a4a5a', '#ff8a5f'];
const PANTS = ['#2d3a4a', '#4a3a2d', '#3a4a3a', '#5a5a5a', '#28323e'];
const SKINS = ['#f2c9a0', '#e0ac82', '#c98a5e', '#a06a42', '#7a4a2d', '#f7ddc4'];

let pedId = 1;

export function makePed(x, y, kind = 'ped') {
  const rng = makeRng('ped' + pedId);
  return {
    id: pedId++,
    kind,
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 0,
    state: 'walk',
    target: null,
    wait: range(rng, 0, 3),
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, SKINS),
    hp: kind === 'gull' ? TUNING.gullHp : 30,
    maxHp: kind === 'gull' ? TUNING.gullHp : 30,
    scared: 0,
    fleeFrom: null,
    shootCd: range(rng, 0.5, 1.5),
    witnessFlash: 0,
    reporting: 0,
    dead: false,
    walkPhase: rng() * Math.PI * 2,
    helpMe: false,
    helped: false,
  };
}

export function makeCop(x, y) {
  const c = makePed(x, y, 'cop');
  c.shirt = '#24344d';
  c.pants = '#1c2733';
  c.hp = TUNING.copHp;
  c.maxHp = TUNING.copHp;
  c.state = 'patrol';
  return c;
}

export function spawnPeds(S, count) {
  const rng = makeRng('peds-seed');
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint(rng, S.city);
    if (Math.hypot(p.x - S.player.x, p.y - S.player.y) < 420) continue;
    const ped = makePed(p.x, p.y);
    ped.target = randomSidewalkPoint(rng, S.city);
    S.peds.push(ped);
  }
  // A few stranded drivers who can be helped (kindness deeds).
  const spots = [
    { x: 924, y: 396 }, { x: 1716, y: 1716 }, { x: 396, y: 1980 },
  ];
  for (const s of spots) {
    const ped = makePed(s.x, s.y);
    ped.helpMe = true;
    ped.state = 'idle';
    S.peds.push(ped);
  }
}

export function canSee(city, wx, wy, wAngle, tx, ty, rangePx, fovHalf) {
  const dx = tx - wx, dy = ty - wy;
  const d = Math.hypot(dx, dy);
  if (d > rangePx) return false;
  if (d < 30) return true;
  const want = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(wAngle, want)) > fovHalf) return false;
  return !segmentBlocked(city, wx, wy, tx, ty);
}

export function scarePeds(S, x, y, radius) {
  for (const p of S.peds) {
    if (p.dead || p.kind !== 'ped') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.scared = 4 + Math.random() * 3;
      p.fleeFrom = { x, y };
      p.state = 'flee';
    }
  }
}

function walkToward(S, ped, tx, ty, speed, dt) {
  const dx = tx - ped.x, dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 6) return true;
  const want = Math.atan2(dy, dx);
  ped.angle += clamp(angleDiff(ped.angle, want), -4 * dt, 4 * dt);
  const step = Math.min(d, speed * dt);
  const nx = ped.x + Math.cos(ped.angle) * step;
  const ny = ped.y + Math.sin(ped.angle) * step;
  const c = collideCircle(S.city, nx, ny, 10, false);
  ped.x = c.x; ped.y = c.y;
  ped.speed = speed;
  ped.walkPhase += dt * speed * 0.06;
  return false;
}

export function updatePeds(S, dt) {
  const rng = Math.random;
  for (const p of S.peds) {
    if (p.dead) continue;
    if (p.witnessFlash > 0) p.witnessFlash -= dt;
    if (p.reporting > 0) p.reporting -= dt;
    if (p.scared > 0) p.scared -= dt;

    if (p.kind === 'gull') { updateGull(S, p, dt); continue; }
    if (p.kind === 'cop') { updateCop(S, p, dt); continue; }

    if (p.state === 'flee') {
      if (p.scared <= 0) { p.state = 'walk'; p.target = null; }
      else if (p.fleeFrom) {
        const away = Math.atan2(p.y - p.fleeFrom.y, p.x - p.fleeFrom.x);
        const tx = p.x + Math.cos(away) * 120;
        const ty = p.y + Math.sin(away) * 120;
        walkToward(S, p, tx, ty, TUNING.pedFlee, dt);
        continue;
      }
    }
    if (p.state === 'idle') {
      p.speed = 0;
      if (p.helpMe && !p.helped && Math.hypot(p.x - S.player.x, p.y - S.player.y) < 70) {
        p.witnessFlash = 0.2; // draws the "!" prompt via renderer
      }
      continue;
    }
    if (p.wait > 0) { p.wait -= dt; p.speed = 0; continue; }
    if (!p.target) {
      p.target = randomSidewalkPoint(makeRng('w' + p.id + ':' + Math.floor(S.time)), S.city);
    }
    const arrived = walkToward(S, p, p.target.x, p.target.y, TUNING.pedWalk, dt);
    if (arrived) {
      p.target = null;
      p.wait = chance(makeRng('wait' + p.id + S.time), 0.4) ? 1 + rng() * 4 : 0;
    }
  }
  // Keep the crowd topped up near the player.
  if (S.peds.filter((p) => !p.dead && p.kind === 'ped').length < 26 && Math.random() < dt * 0.5) {
    const p = randomSidewalkPoint(makeRng('topup' + S.time), S.city);
    if (Math.hypot(p.x - S.player.x, p.y - S.player.y) > 600 && Math.hypot(p.x - S.player.x, p.y - S.player.y) < 1400) {
      const ped = makePed(p.x, p.y);
      ped.target = randomSidewalkPoint(makeRng('topup2' + S.time), S.city);
      S.peds.push(ped);
    }
  }
}

function updateCop(S, cop, dt) {
  const p = S.player;
  const wanted = S.wanted.stars > 0;
  if (!wanted) {
    // Patrol: stroll between sidewalk points.
    if (!cop.target) cop.target = randomSidewalkPoint(makeRng('cop' + cop.id + S.time), S.city);
    if (walkToward(S, cop, cop.target.x, cop.target.y, TUNING.copWalk, dt)) cop.target = null;
    return;
  }
  // Chase: run at the player; strike in melee range when the player is on foot.
  const d = Math.hypot(p.x - cop.x, p.y - cop.y);
  if (d > 46) {
    walkToward(S, cop, p.x, p.y, TUNING.copRun, dt);
  } else if (!p.car) {
    cop.shootCd -= dt;
    if (cop.shootCd <= 0) {
      cop.shootCd = 0.9;
      if (S.onCopStrike) S.onCopStrike(cop);
      S.audio.punch();
    }
  }
  cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
}

function updateGull(S, gull, dt) {
  const p = S.player;
  const d = Math.hypot(p.x - gull.x, p.y - gull.y);
  if (gull.state === 'idle' && d < 420 && !segmentBlocked(S.city, gull.x, gull.y, p.x, p.y)) {
    gull.state = 'combat';
    if (S.onAlerted) S.onAlerted(gull);
  }
  if (gull.state !== 'combat') return;
  // Face the player always; move directly (strafing) so facing never
  // fights the movement direction.
  gull.angle = Math.atan2(p.y - gull.y, p.x - gull.x);
  const los = !segmentBlocked(S.city, gull.x, gull.y, p.x, p.y);
  if (!los || d > 300) {
    moveDirect(S, gull, p.x, p.y, TUNING.copWalk, dt);
  } else if (d < 140) {
    const away = Math.atan2(gull.y - p.y, gull.x - p.x);
    moveDirect(S, gull, gull.x + Math.cos(away) * 80, gull.y + Math.sin(away) * 80, TUNING.copWalk, dt);
  } else {
    gull.speed = 0;
  }
  gull.shootCd -= dt;
  if (gull.shootCd <= 0 && d < 480 && los) {
    gull.shootCd = 0.9 + Math.random() * 0.7;
    if (S.onEnemyShot) S.onEnemyShot(gull);
  }
}

// Straight-line step with collision, used by gulls so they can strafe
// while facing the player (walkToward's gradual turning would fight it).
// When a wall blocks the direct step, slide along it instead of
// getting stuck against the face.
function moveDirect(S, ped, tx, ty, speed, dt) {
  const dx = tx - ped.x, dy = ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) { ped.speed = 0; return; }
  const step = Math.min(d, speed * dt);
  const ux = dx / d, uy = dy / d;
  const before = { x: ped.x, y: ped.y };
  const c = collideCircle(S.city, ped.x + ux * step, ped.y + uy * step, 10, false);
  ped.x = c.x; ped.y = c.y;
  const moved = Math.hypot(ped.x - before.x, ped.y - before.y);
  if (moved < step * 0.3) {
    const px = -uy, py = ux;
    for (const s of [1, -1]) {
      const c2 = collideCircle(S.city, before.x + px * s * step, before.y + py * s * step, 10, false);
      const m2 = Math.hypot(c2.x - before.x, c2.y - before.y);
      if (m2 > step * 0.5) { ped.x = c2.x; ped.y = c2.y; break; }
    }
  }
  ped.speed = speed;
  ped.walkPhase += dt * speed * 0.06;
}

export function nearestPed(S, x, y, maxD, filter) {
  let best = null, bd = maxD;
  for (const p of S.peds) {
    if (p.dead) continue;
    if (filter && !filter(p)) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

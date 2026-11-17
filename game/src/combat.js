// Solmar Heat — combat. One job: shooting, punching, guards that shoot back,
// pickups (cash, health, ammo) and the tracer effects the renderer draws.
import { dist, clamp } from './config.js';
import { sfxShot, sfxPunch, sfxPickup } from './audio.js';

export function spawnPickups(state, rng) {
  state.pickups = [];
  for (let i = 0; i < 10; i += 1) {
    state.pickups.push({
      x: 300 + rng() * 2400,
      y: 300 + rng() * 1800,
      kind: i % 3 === 0 ? 'health' : i % 3 === 1 ? 'ammo' : 'cash',
      taken: false,
      bob: rng() * Math.PI * 2,
    });
  }
}

// Fire the pistol toward (tx, ty) in world space. Returns true if fired.
export function shoot(state, tx, ty) {
  const p = state.player;
  if (p.onFoot === false || p.ammo <= 0 || p.shootCooldown > 0) return false;
  p.ammo -= 1;
  p.shootCooldown = 0.28;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  p.angle = angle;
  state.gunfireTimer = 0.8;
  state.tracers.push({ x1: p.x, y1: p.y, x2: p.x + Math.cos(angle) * 420, y2: p.y + Math.sin(angle) * 420, life: 0.12 });
  sfxShot();
  // Hit the nearest guard roughly along the shot line.
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < state.guards.length; i += 1) {
    const g = state.guards[i];
    if (!g.alive) continue;
    const dx = g.x - p.x;
    const dy = g.y - p.y;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const side = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (along > 0 && along < 430 && side < 26 && along < bestD) {
      bestD = along;
      best = g;
    }
  }
  if (best) {
    best.health -= 34;
    state.hitMarkers.push({ x: best.x, y: best.y, life: 0.3 });
    if (best.health <= 0) {
      best.alive = false;
      state.player.money += 25;
      state.message = 'Penjaga tumbang +$25';
    }
  }
  state.crime('shoot');
  return true;
}

export function punch(state) {
  const p = state.player;
  if (p.punchCooldown > 0 || !p.onFoot) return false;
  p.punchCooldown = 0.45;
  sfxPunch();
  for (let i = 0; i < state.guards.length; i += 1) {
    const g = state.guards[i];
    if (!g.alive) continue;
    if (dist(p.x, p.y, g.x, g.y) < 46) {
      g.health -= 20;
      if (g.health <= 0) {
        g.alive = false;
        state.player.money += 25;
      }
    }
  }
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (!ped.down && dist(p.x, p.y, ped.x, ped.y) < 40) {
      ped.down = true;
      ped.downTimer = 4;
      state.crime('hit-ped');
    }
  }
  return true;
}

// Guards walk toward the player and shoot when in range.
export function updateGuards(state, dt) {
  const p = state.player;
  for (let i = 0; i < state.guards.length; i += 1) {
    const g = state.guards[i];
    if (!g.alive) continue;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d < 520) {
      g.angle = Math.atan2(p.y - g.y, p.x - g.x);
      if (d > 190) {
        g.x += Math.cos(g.angle) * g.speed * dt;
        g.y += Math.sin(g.angle) * g.speed * dt;
      }
      g.shootCooldown -= dt;
      if (g.shootCooldown <= 0 && d < 380) {
        g.shootCooldown = 1.4;
        state.tracers.push({ x1: g.x, y1: g.y, x2: p.x, y2: p.y, life: 0.12, enemy: true });
        sfxShot();
        if (Math.random() < 0.55) {
          p.health -= 9;
          if (p.health <= 0) state.screen = 'wasted';
        }
      }
    }
  }
}

export function updatePickups(state, dt) {
  const p = state.player;
  for (let i = 0; i < state.pickups.length; i += 1) {
    const pk = state.pickups[i];
    if (pk.taken) continue;
    pk.bob += dt * 3;
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.money += 50;
        state.message = 'Uang jalanan +$50';
      } else if (pk.kind === 'health') {
        p.health = clamp(p.health + 30, 0, 100);
        state.message = 'Kesehatan +30';
      } else {
        p.ammo += 12;
        state.message = 'Amunisi +12';
      }
      sfxPickup();
    }
  }
  if (state.pickups.every((pk) => pk.taken)) {
    spawnPickups(state, Math.random);
  }
}

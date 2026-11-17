// Combat: bullets, melee, explosions, damage and particles. Hits are
// resolved against buildings, people, cars and the player; deaths and
// destruction are reported back through hooks the main loop wires up.

import { WEAPONS, TUNING } from './config.js';
import { buildingsNear, segmentBlocked } from './city.js';

export function fireWeapon(S, shooter, angle, weaponKey) {
  const w = WEAPONS[weaponKey];
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const spread = pellets > 1 ? (Math.random() - 0.5) * 0.24 : (Math.random() - 0.5) * 0.03;
    const a = angle + spread;
    const speed = 900;
    S.bullets.push({
      x: shooter.x + Math.cos(a) * 26,
      y: shooter.y + Math.sin(a) * 26,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: w.range / speed,
      damage: w.damage,
      from: shooter === S.player ? 'player' : 'enemy',
      owner: shooter,
    });
  }
  // Muzzle flash + a puff of smoke.
  S.particles.push({
    x: shooter.x + Math.cos(angle) * 28, y: shooter.y + Math.sin(angle) * 28,
    vx: 0, vy: 0, life: 0.07, max: 0.07, size: 12, color: '#ffe9a8', kind: 'flash',
  });
  S.audio.shot();
}

export function meleeAttack(S, attacker, angle) {
  const w = WEAPONS.fists;
  S.audio.punch();
  S.particles.push({
    x: attacker.x + Math.cos(angle) * 30, y: attacker.y + Math.sin(angle) * 30,
    vx: 0, vy: 0, life: 0.18, max: 0.18, size: 16, color: '#ffffff', kind: 'swipe',
  });
  const targets = attacker === S.player ? S.peds : [S.player];
  for (const t of targets) {
    if (t.dead || t.hp <= 0) continue;
    const d = Math.hypot(t.x - attacker.x, t.y - attacker.y);
    if (d < w.range + 14) {
      damageTarget(S, t, w.damage, attacker);
    }
  }
}

export function damageTarget(S, target, amount, attacker) {
  if (target.dead) return;
  if (target === S.player) {
    // Armor absorbs 60% of each hit until it is gone.
    let rest = amount;
    if (target.armor > 0) {
      const absorbed = Math.min(target.armor, rest * 0.6);
      target.armor -= absorbed;
      rest -= absorbed;
    }
    target.hp -= rest;
    spawnHitBurst(S, target.x, target.y);
    if (S.onPlayerHit) S.onPlayerHit(rest, attacker ? attacker.x : target.x, attacker ? attacker.y : target.y, 'hit');
    if (target.hp <= 0) {
      target.hp = 0;
      if (S.onPlayerDown) S.onPlayerDown('combat');
    }
    return;
  }
  target.hp -= amount;
  spawnHitBurst(S, target.x, target.y);
  if (target.hp <= 0) {
    target.hp = 0;
    target.dead = true;
    target.state = 'dead';
    if (S.onPedDown) S.onPedDown(target, attacker);
  }
}

export function spawnHitBurst(S, x, y) {
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
    S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35, max: 0.35, size: 3, color: '#ffd166', kind: 'spark' });
  }
}

// Distance from a point to a segment: bullets are tested along their
// whole per-frame path so fast shots cannot tunnel past a target.
function segDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

export function updateBullets(S, dt) {
  const kept = [];
  for (const b of S.bullets) {
    b.life -= dt;
    const nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
    let dead = b.life <= 0;
    // Building hit: sample the segment.
    if (!dead && segmentBlocked(S.city, b.x, b.y, nx, ny)) {
      dead = true;
      spawnHitBurst(S, nx, ny);
      S.particles.push({ x: nx, y: ny, vx: 0, vy: -14, life: 0.5, max: 0.5, size: 6, color: '#c9c2b2', kind: 'smoke' });
    }
    // Person hit (segment test, no tunneling).
    if (!dead) {
      if (b.from === 'player') {
        for (const p of S.peds) {
          if (p.dead) continue;
          if (segDist(p.x, p.y, b.x, b.y, nx, ny) < 15) {
            damageTarget(S, p, b.damage, S.player);
            dead = true;
            break;
          }
        }
      } else if (!S.player.car && segDist(S.player.x, S.player.y, b.x, b.y, nx, ny) < 15) {
        damageTarget(S, S.player, b.damage, b.owner);
        dead = true;
      }
    }
    // Car hit (skip the shooter's own car).
    if (!dead) {
      for (const c of S.cars) {
        if (c.dead) continue;
        const dx = nx - c.x, dy = ny - c.y;
        const ca = Math.cos(-c.angle), sa = Math.sin(-c.angle);
        const lx = dx * ca - dy * sa, ly = dx * sa + dy * ca;
        if (Math.abs(lx) < c.def.len / 2 && Math.abs(ly) < c.def.wid / 2) {
          c.health -= b.damage * 0.6;
          spawnHitBurst(S, nx, ny);
          if (c.health <= 0 && !c.dead) {
            c.dead = true;
            if (S.onCarDestroyed) S.onCarDestroyed(c, nx, ny);
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) { b.x = nx; b.y = ny; kept.push(b); }
  }
  S.bullets = kept;
}

export function explodeCar(S, car) {
  S.audio.explosion();
  S.camera.shake = 18;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 220;
    S.particles.push({
      x: car.x, y: car.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.6, max: 1.1, size: 6 + Math.random() * 10,
      color: ['#ff9f43', '#ff6b35', '#ffd166', '#5a5a5a'][i % 4], kind: 'fire',
    });
  }
  S.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: 60, color: '#fff3c4', kind: 'flash' });
  // Splash damage.
  for (const p of S.peds) {
    if (p.dead) continue;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d < 110) damageTarget(S, p, 60 * (1 - d / 110) + 20, null);
  }
  if (!S.player.car && Math.hypot(S.player.x - car.x, S.player.y - car.y) < 110) {
    damageTarget(S, S.player, 45, null);
  }
  if (S.onExplosion) S.onExplosion(car.x, car.y);
}

export function updateParticles(S, dt) {
  const kept = [];
  for (const p of S.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.2 * dt;
    p.vy *= 1 - 2.2 * dt;
    if (p.kind === 'smoke' || p.kind === 'fire') { p.size += dt * 10; p.vy -= 12 * dt; }
    kept.push(p);
  }
  S.particles = kept;
  for (const s of S.skids) s.life -= dt;
  S.skids = S.skids.filter((s) => s.life > 0);
}

// Direct damage to the player with armor absorption and death handling.
export function damagePlayer(S, amount, fromX, fromY, source) {
  const p = S.player;
  if (p.hp <= 0 || S.mode !== 'playing') return;
  damageTarget(S, p, amount, null);
}

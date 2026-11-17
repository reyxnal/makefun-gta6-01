// Cars: arcade driving physics with drift, traffic that follows the road
// graph, parked cars to steal, and police pursuit driving.

import { WORLD, CAR_TYPES, clamp, angleDiff } from './config.js';
import { collideCircle, nearestRoadPoint, randomRoadPoint } from './city.js';
import { makeRng, pick, range } from './rng.js';

let carId = 1;

export function makeCar(typeKey, x, y, angle, opts = {}) {
  const def = CAR_TYPES[typeKey];
  return {
    id: carId++,
    type: typeKey,
    def,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    steer: 0,
    color: opts.color || pick(makeRng('car' + carId), def.colors),
    health: def.health,
    maxHealth: def.health,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | null (parked)
    route: opts.route || [],
    wait: 0,
    brake: false,
    dead: false,
    smoke: 0,
    horn: 0,
    stolen: false,
    sirenPhase: Math.random() * Math.PI * 2,
    skid: 0,
    owner: opts.owner || null,
    fare: null,
  };
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

function collideCarWithWorld(S, car) {
  const def = car.def;
  const pts = [
    { dx: def.len * 0.32, dy: 0, r: def.wid * 0.52 },
    { dx: -def.len * 0.32, dy: 0, r: def.wid * 0.52 },
    { dx: 0, dy: 0, r: def.wid * 0.55 },
  ];
  let hit = false;
  const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
  for (const p of pts) {
    const wx = car.x + p.dx * cos - p.dy * sin;
    const wy = car.y + p.dx * sin + p.dy * cos;
    const c = collideCircle(S.city, wx, wy, p.r, false);
    if (c.hit) {
      hit = true;
      car.x += c.x - wx;
      car.y += c.y - wy;
    }
  }
  return hit;
}

function damageCar(S, car, amount, causeX, causeY) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 30 && car.health > 0) car.smoke = 1;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    if (S.onCarDestroyed) S.onCarDestroyed(car, causeX, causeY);
  }
}

// Player driving: W/S throttle, A/D steer, Space handbrake, H horn.
export function updatePlayerCar(S, car, dt, input) {
  const def = car.def;
  const throttle = (input.down('w', 'ArrowUp') ? 1 : 0) - (input.down('s', 'ArrowDown') ? 1 : 0);
  const steerInput = (input.down('a', 'ArrowLeft') ? -1 : 0) + (input.down('d', 'ArrowRight') ? 1 : 0);
  const handbrake = input.down(' ');
  const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speedAlong = car.vx * forward.x + car.vy * forward.y;

  car.steer += ((steerInput * 0.55) - car.steer) * Math.min(1, dt * 8);
  const steerAuthority = clamp(Math.abs(speedAlong) / 120, 0, 1);
  car.angle += car.steer * steerAuthority * (speedAlong >= 0 ? 1 : -1) * dt * 2.1;

  let accel = 0;
  if (throttle > 0) accel = def.accel * (speedAlong < def.top ? 1 : 0);
  else if (throttle < 0) accel = speedAlong > 10 ? -def.accel * 1.6 : -def.accel * 0.55;
  const fwd2 = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  car.vx += fwd2.x * accel * dt;
  car.vy += fwd2.y * accel * dt;

  // Grip: velocity eases toward the heading direction; handbrake loosens it.
  const grip = handbrake ? def.grip * 0.35 : def.grip;
  const targetVx = fwd2.x * speedAlong + fwd2.x * accel * dt;
  const targetVy = fwd2.y * speedAlong + fwd2.y * accel * dt;
  const k = Math.min(1, grip * dt);
  car.vx += (targetVx - car.vx) * k;
  car.vy += (targetVy - car.vy) * k;

  // Rolling drag + handbrake drag.
  const drag = handbrake ? 1.6 : 0.35;
  car.vx -= car.vx * drag * dt * (throttle === 0 ? 1.6 : 0.6);
  car.vy -= car.vy * drag * dt * (throttle === 0 ? 1.6 : 0.6);

  const prevX = car.x, prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = carSpeed(car);

  const hitWall = collideCarWithWorld(S, car);
  if (hitWall) {
    const impact = Math.hypot(car.vx, car.vy);
    if (impact > 170) {
      damageCar(S, car, (impact - 170) * 0.05, car.x, car.y);
      S.audio.crash();
      S.camera.shake = Math.min(14, impact * 0.03);
      spawnSparks(S, car.x, car.y, 8);
      if (S.onCrash) S.onCrash(car, impact);
    }
    car.vx *= -0.25; car.vy *= -0.25;
    car.x = prevX + (car.x - prevX) * 0.2;
    car.y = prevY + (car.y - prevY) * 0.2;
  }

  // Skid marks when sliding hard.
  const lateral = Math.abs(car.vx * -fwd2.y + car.vy * fwd2.x);
  if (lateral > 90 && carSpeed(car) > 160) {
    car.skid += dt;
    if (car.skid > 0.05) {
      car.skid = 0;
      S.skids.push({ x: car.x - fwd2.x * def.len * 0.3, y: car.y - fwd2.y * def.len * 0.3, angle: car.angle, life: 6 });
      if (S.skids.length > 220) S.skids.shift();
    }
  }
  if (input.hit('h')) { car.horn = 0.3; S.audio.horn(); }
  if (car.horn > 0) car.horn -= dt;
  if (car.smoke > 0 && Math.random() < 0.5) {
    S.particles.push({ x: car.x + fwd2.x * def.len * 0.4, y: car.y + fwd2.y * def.len * 0.4, vx: range(Math.random, -20, 20), vy: -30, life: 0.9, max: 0.9, size: 8, color: '#5a5a5a', kind: 'smoke' });
  }
}

export function spawnSparks(S, x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 140;
    S.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, max: 0.4, size: 2, color: '#ffd98a', kind: 'spark' });
  }
}

// Traffic: follow the road graph with right-hand lane offsets, brake for
// the car ahead, pause at intersections sometimes.
export function updateTrafficCar(S, car, dt) {
  const def = car.def;
  if (car.wait > 0) { car.wait -= dt; car.vx *= 0.8; car.vy *= 0.8; car.x += car.vx * dt; car.y += car.vy * dt; return; }
  if (car.route.length === 0) {
    const near = nearestNode(S.city, car.x, car.y);
    const next = pickNextNode(S.city, near, car.lastNode);
    car.lastNode = near;
    car.route = [next];
  }
  const target = S.city.nodes[car.route[0]];
  const dx = target.x - car.x, dy = target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 34) {
    car.route.shift();
    if (Math.random() < 0.22) car.wait = 0.5 + Math.random() * 1.2;
    return;
  }
  // Lane offset: right-hand side of the direction of travel.
  const ux = dx / d, uy = dy / d;
  const ox = -uy * 11, oy = ux * 11;
  const tx = target.x + ox, ty = target.y + oy;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -1.8 * dt, 1.8 * dt);
  let cruise = 150;
  if (d < 90) cruise = 95;
  // Brake for the car ahead.
  const ahead = carAhead(S, car, 85);
  if (ahead) cruise = Math.min(cruise, Math.max(0, carSpeed(ahead) * 0.8 - 10));
  const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speedAlong = car.vx * fwd.x + car.vy * fwd.y;
  const accel = speedAlong < cruise ? def.accel * 0.55 : -def.accel;
  car.vx += fwd.x * accel * dt;
  car.vy += fwd.y * accel * dt;
  const k = Math.min(1, 4 * dt);
  car.vx += (fwd.x * speedAlong - car.vx) * k;
  car.vy += (fwd.y * speedAlong - car.vy) * k;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = carSpeed(car);
  collideCarWithWorld(S, car);
}

function nearestNode(city, x, y) {
  let best = 0, bd = Infinity;
  city.nodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

function pickNextNode(city, from, prev) {
  const opts = city.neighbours[from].filter((n) => n !== prev);
  const pool = opts.length > 0 ? opts : city.neighbours[from];
  return pool[Math.floor(Math.random() * pool.length)];
}

function carAhead(S, car, rangePx) {
  const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  let best = null, bd = rangePx;
  for (const o of S.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fwd.x + dy * fwd.y;
    const side = Math.abs(dx * -fwd.y + dy * fwd.x);
    if (along > 0 && along < bd && side < 30) { bd = along; best = o; }
  }
  return best;
}

// Police pursuit: steer toward the player's predicted position, faster
// and more aggressive as stars rise.
export function updatePoliceCar(S, car, dt, stars) {
  const p = S.player;
  const def = car.def;
  const predict = 0.35 + stars * 0.06;
  const tx = p.x + (p.vx || 0) * predict;
  const ty = p.y + (p.vy || 0) * predict;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
  const d = Math.hypot(tx - car.x, ty - car.y);
  const cruise = d > 260 ? def.top : d > 120 ? def.top * 0.8 : 150;
  const fwd = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
  const speedAlong = car.vx * fwd.x + car.vy * fwd.y;
  const accel = speedAlong < cruise ? def.accel : -def.accel * 0.8;
  car.vx += fwd.x * accel * dt;
  car.vy += fwd.y * accel * dt;
  const k = Math.min(1, 3.6 * dt);
  car.vx += (fwd.x * speedAlong - car.vx) * k;
  car.vy += (fwd.y * speedAlong - car.vy) * k;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.speed = carSpeed(car);
  car.sirenPhase += dt * 6;
  collideCarWithWorld(S, car);
  // Give up the chase if the player is long gone and far away.
  if (d > 1400 && S.wanted.stars === 0) car.retire = true;
}

// Pairwise car collisions: push apart, exchange a little velocity, damage.
export function resolveCarCollisions(S, dt) {
  const cars = S.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.def.len + b.def.len) * 0.32;
      if (d > 0.01 && d < min) {
        const nx = dx / d, ny = dy / d;
        const push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
        if (rel > 120) {
          const dmg = (rel - 120) * 0.04;
          damageCar(S, a, dmg, a.x, a.y);
          damageCar(S, b, dmg, b.x, b.y);
          if (rel > 220) {
            S.audio.crash();
            spawnSparks(S, (a.x + b.x) / 2, (a.y + b.y) / 2, 6);
            if (S.onCrash) S.onCrash(a.driver === 'player' ? a : b, rel);
          }
          const ex = rel * 0.35;
          a.vx -= nx * ex; a.vy -= ny * ex;
          b.vx += nx * ex; b.vy += ny * ex;
        }
      }
    }
  }
}

export function spawnTraffic(S, count) {
  const rng = makeRng('traffic-seed');
  const types = ['brio', 'corsa', 'corsa', 'lobo', 'burro', 'taxi'];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng);
    if (Math.hypot(p.x - S.player.x, p.y - S.player.y) < 500) continue;
    const angle = Math.floor(rng() * 4) * (Math.PI / 2);
    S.cars.push(makeCar(pick(rng, types), p.x, p.y, angle, { driver: 'traffic' }));
  }
}

export function spawnParked(S, count) {
  const rng = makeRng('parked-seed');
  const types = ['brio', 'corsa', 'falco', 'lobo', 'burro'];
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 8) {
    tries++;
    const p = randomRoadPoint(rng);
    const angle = Math.floor(rng() * 4) * (Math.PI / 2);
    // Park at the road edge.
    const off = WORLD.roadHalf - 14;
    const x = p.x + (angle === 0 || angle === Math.PI ? 0 : (rng() < 0.5 ? off : -off));
    const y = p.y + (angle === 0 || angle === Math.PI ? (rng() < 0.5 ? off : -off) : 0);
    const c = collideCircle(S.city, x, y, 20, false);
    if (c.hit) continue;
    if (Math.hypot(x - S.player.x, y - S.player.y) < 260) continue;
    S.cars.push(makeCar(pick(rng, types), x, y, angle, { driver: null }));
    placed++;
  }
}

export function nearestCar(S, x, y, maxD, filter) {
  let best = null, bd = maxD;
  for (const c of S.cars) {
    if (c.dead) continue;
    if (filter && !filter(c)) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

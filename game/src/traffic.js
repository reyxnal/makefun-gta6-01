// Solmar Heat — traffic cars and pedestrians. One job: ambient city life.
// Traffic follows road centrelines and turns at intersections; pedestrians
// stroll the sidewalks and flee from gunfire and speeding cars.
import { PALETTE, CAR, clamp, dist, angleLerp } from './config.js';
import { makeCar, driveCar, collideCars } from './entities.js';
import { nearestRoadPoint, onRoad } from './city.js';
import { makeRng, pick, range } from './rng.js';

const PED_NAMES = ['Maya', 'Dono', 'Sinta', 'Budi', 'Lala', 'Agus', 'Rina', 'Joko', 'Tari', 'Eko'];

export function spawnTraffic(city, count, rng, playerX, playerY) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const x = range(rng, 200, 2800);
    const y = range(rng, 200, 2200);
    const p = nearestRoadPoint(city, x, y);
    if (!p) continue;
    const angle = p.vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(p.x + (p.vertical ? range(rng, -18, 18) : 0), p.y + (p.vertical ? 0 : range(rng, -18, 18)), angle, pick(rng, PALETTE.carColors), 'traffic');
    car.speed = range(rng, 120, 220);
    car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}

export function spawnPedestrians(city, count, rng) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const x = range(rng, 200, 2800);
    const y = range(rng, 200, 2200);
    const p = nearestRoadPoint(city, x, y);
    if (!p) continue;
    const side = rng() < 0.5 ? -1 : 1;
    peds.push({
      x: p.vertical ? p.x + side * 62 : p.x + range(rng, -120, 120),
      y: p.vertical ? p.y + range(rng, -120, 120) : p.y + side * 62,
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 28, 55),
      name: pick(rng, PED_NAMES),
      color: pick(rng, ['#e8590c', '#2b8a3e', '#1971c2', '#c2255c', '#6741d9', '#0b7285']),
      fleeing: 0,
      panic: 0,
      walkPhase: range(rng, 0, Math.PI * 2),
    });
  }
  return peds;
}

// One traffic step: cruise along the road, slow for the car ahead, turn at
// intersections, despawn far away and respawn near the player.
export function updateTraffic(state, dt) {
  const { city, traffic, player } = state;
  for (let i = 0; i < traffic.length; i += 1) {
    const car = traffic[i];
    if (car.driver === 'player') continue;
    const ahead = carAhead(traffic, car);
    let target = car.cruise || 160;
    if (ahead && ahead.d < 90) target = Math.max(0, ahead.car.speed - 20);
    const atJunction = nearJunction(city, car.x, car.y);
    if (atJunction && Math.random() < dt * 0.25) {
      car.angle += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
      car.angle = Math.round(car.angle / (Math.PI / 2)) * (Math.PI / 2);
    }
    car.speed += clamp(target - car.speed, -300 * dt, 200 * dt);
    const ox = car.x;
    const oy = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (!onRoad(city, car.x, car.y)) {
      car.x = ox;
      car.y = oy;
      car.angle += Math.PI / 2;
    }
    if (dist(car.x, car.y, player.x, player.y) > 1400) {
      respawnTrafficCar(state, car);
    }
  }
  for (let i = 0; i < traffic.length; i += 1) {
    for (let j = i + 1; j < traffic.length; j += 1) {
      collideCars(traffic[i], traffic[j]);
    }
  }
}

function carAhead(cars, car) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < cars.length; i += 1) {
    const o = cars[i];
    if (o === car) continue;
    const dx = o.x - car.x;
    const dy = o.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 220) continue;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < bestD && side < 40) {
      bestD = along;
      best = o;
    }
  }
  return best ? { car: best, d: bestD } : null;
}

function nearJunction(city, x, y) {
  for (let i = 0; i < city.vRoads.length; i += 1) {
    for (let j = 0; j < city.hRoads.length; j += 1) {
      if (Math.abs(x - city.vRoads[i]) < 40 && Math.abs(y - city.hRoads[j]) < 40) return true;
    }
  }
  return false;
}

function respawnTrafficCar(state, car) {
  const rng = makeRng((Math.random() * 1e9) | 0);
  const a = Math.random() * Math.PI * 2;
  const x = state.player.x + Math.cos(a) * 1000;
  const y = state.player.y + Math.sin(a) * 1000;
  const p = nearestRoadPoint(state.city, Math.max(150, Math.min(2850, x)), Math.max(150, Math.min(2250, y)));
  if (!p) return;
  car.x = p.x;
  car.y = p.y;
  car.angle = p.vertical ? Math.PI / 2 : 0;
  car.speed = car.cruise || 160;
}

export function updatePedestrians(state, dt) {
  const { city, peds, player } = state;
  for (let i = 0; i < peds.length; i += 1) {
    const p = peds[i];
    p.walkPhase += dt * 6;
    const playerCar = player.car;
    const threatX = playerCar ? playerCar.x : player.x;
    const threatY = playerCar ? playerCar.y : player.y;
    const threatSpeed = playerCar ? Math.abs(playerCar.speed) : (player.moving ? 300 : 0);
    const d = dist(p.x, p.y, threatX, threatY);
    if (state.gunfireTimer > 0 && d < 420) p.fleeing = 2.5;
    if (threatSpeed > 260 && d < 170) p.fleeing = 2;
    if (p.fleeing > 0) {
      p.fleeing -= dt;
      const away = Math.atan2(p.y - threatY, p.x - threatX);
      p.angle = angleLerp(p.angle, away, dt * 6);
      p.x += Math.cos(p.angle) * 150 * dt;
      p.y += Math.sin(p.angle) * 150 * dt;
    } else {
      if (Math.random() < dt * 0.12) p.angle += (Math.random() - 0.5) * 1.6;
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      if (!onRoad(city, p.x, p.y) && Math.random() < dt * 0.5) {
        const rp = nearestRoadPoint(city, p.x, p.y);
        if (rp) p.angle = Math.atan2(rp.y - p.y, rp.x - p.x);
      }
    }
    if (d < 26 && threatSpeed > 120) {
      // Player ran a pedestrian over: a crime, and the pedestrian is down.
      p.down = true;
      p.downTimer = 4;
      state.crime('hit-ped');
    }
    if (p.down) {
      p.downTimer -= dt;
      if (p.downTimer <= 0) {
        p.down = false;
        p.fleeing = 3;
      }
    }
    if (dist(p.x, p.y, player.x, player.y) > 1500) {
      const a = Math.random() * Math.PI * 2;
      const rp = nearestRoadPoint(city, player.x + Math.cos(a) * 900, player.y + Math.sin(a) * 900);
      if (rp) {
        p.x = rp.x;
        p.y = rp.y;
      }
    }
  }
}

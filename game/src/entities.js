// Solmar Heat — entities: the player on foot, cars, and the arcade driving
// model. One job: move things and resolve collisions; AI lives elsewhere.
import { PLAYER, CAR, CAR_TYPES, clamp, dist, angleLerp, angleDiff } from './config.js';
import { hitsBuilding, insideWorld } from './city.js';
import { sfxCrash } from './audio.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, health: PLAYER.maxHealth, money: 0,
    car: null, ammo: 24, punchCooldown: 0, shootCooldown: 0,
    invulnerable: 0, moving: false,
  };
}

export function makeCar(x, y, angle, color, kind, bodyType) {
  const type = CAR_TYPES[bodyType || 'sedan'] || CAR_TYPES.sedan;
  return {
    x, y, angle, speed: 0, color,
    kind: kind || 'traffic',
    bodyType: bodyType || 'sedan',
    accel: type.accel,
    maxSpeed: type.maxSpeed,
    turnRate: type.turnRate,
    length: CAR.length, width: CAR.width,
    driver: kind === 'player' ? 'player' : 'npc',
    hp: 100, brakeLight: false, siren: false,
  };
}

// Move a circle (the player on foot) with building collision.
export function moveOnFoot(player, dx, dy, dt, city) {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) {
    player.moving = false;
    return;
  }
  player.moving = true;
  const nx = player.x + (dx / len) * player.speed * dt;
  const ny = player.y + (dy / len) * player.speed * dt;
  if (!hitsBuilding(city, nx, player.y, PLAYER.radius) && insideWorld(nx, player.y)) player.x = nx;
  if (!hitsBuilding(city, player.x, ny, PLAYER.radius) && insideWorld(player.x, ny)) player.y = ny;
  player.angle = Math.atan2(dy, dx);
}

// Arcade car physics: accelerate, steer (stronger at speed), collide with
// buildings by testing the car's front and rear circles.
export function driveCar(car, throttle, steer, dt, city, isPlayer) {
  const maxFwd = car.maxSpeed || CAR.maxSpeed;
  const maxRev = CAR.maxReverse;
  const accel = car.accel || CAR.accel;
  const turnRate = car.turnRate || CAR.turnRate;
  if (throttle > 0) car.speed += accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 260 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = clamp(car.speed, -maxRev, maxFwd);
  const grip = clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += steer * turnRate * grip * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const crashed = carHitsBuilding(city, nx, ny, car.angle);
  if (crashed) {
    if (Math.abs(car.speed) > 240 && isPlayer) sfxCrash();
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.brakeLight = throttle < 0 && car.speed > 5;
  return crashed;
}

export function carHitsBuilding(city, x, y, angle) {
  const fx = Math.cos(angle) * (CAR.length / 2 - 6);
  const fy = Math.sin(angle) * (CAR.length / 2 - 6);
  if (hitsBuilding(city, x + fx, y + fy, 13)) return true;
  if (hitsBuilding(city, x - fx, y - fy, 13)) return true;
  return false;
}

// Circle-based car-vs-car push-apart. Returns true when a crash happened.
export function collideCars(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const min = (a.length + b.length) / 2 - 8;
  if (d >= min || d < 0.01) return false;
  const push = (min - d) / 2;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  const s = a.speed;
  a.speed = b.speed * 0.5;
  b.speed = s * 0.5;
  return true;
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (let i = 0; i < cars.length; i += 1) {
    const c = cars[i];
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

// Steal / enter a car: the player leaves foot mode and the car becomes theirs.
export function enterCar(player, car) {
  player.onFoot = false;
  player.car = car;
  car.driver = 'player';
  car.kind = 'player';
  player.x = car.x;
  player.y = car.y;
}

export function exitCar(player) {
  if (!player.car) return;
  const car = player.car;
  car.driver = 'npc';
  car.kind = 'traffic';
  car.speed = 0;
  const side = player.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 40;
  player.y = car.y + Math.sin(side) * 40;
  player.onFoot = true;
  player.car = null;
}

export function damagePlayer(player, amount) {
  if (player.invulnerable > 0) return false;
  player.health -= amount;
  player.invulnerable = 0.6;
  return player.health <= 0;
}

export function healPlayer(player, amount) {
  player.health = clamp(player.health + amount, 0, PLAYER.maxHealth);
}

// Vehicles: car meshes, arcade driving physics, road traffic, parked cars,
// police pursuit and the wanted system.
import * as THREE from 'three';
import { CAR_TYPES, ROADS, WORLD_HALF, PARKED_SPOTS, clampNumber, angleLerp, distance2D, TUNING } from './config.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x16181e });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2a3a });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a });

export function buildCarMesh(typeKey, colorOverride) {
  const spec = CAR_TYPES[typeKey] || CAR_TYPES.sedan;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorOverride ?? spec.color });
  const L = spec.length; const W = spec.width;
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(W, 0.72, L);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(bodyGeo, glassMat);
  cabin.scale.set(W * 0.82, 0.6, L * 0.44);
  cabin.position.set(0, 1.22, -L * 0.06);
  cabin.castShadow = true;
  group.add(cabin);
  const stripe = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  if (typeKey === 'police') {
    stripe.scale.set(W + 0.02, 0.3, L * 0.5);
    stripe.position.set(0, 0.72, 0);
    group.add(stripe);
  }
  for (const [wx, wz] of [[-W / 2, L / 2 - 0.7], [W / 2, L / 2 - 0.7], [-W / 2, -L / 2 + 0.7], [W / 2, -L / 2 + 0.7]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    group.add(wheel);
  }
  for (const hx of [-W * 0.32, W * 0.32]) {
    const head = new THREE.Mesh(bodyGeo, lightMat);
    head.scale.set(0.34, 0.18, 0.08);
    head.position.set(hx, 0.7, L / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(bodyGeo, tailMat);
    tail.scale.set(0.34, 0.18, 0.08);
    tail.position.set(hx, 0.7, -L / 2 - 0.02);
    group.add(tail);
  }
  let barRed = null; let barBlue = null;
  if (typeKey === 'police') {
    barRed = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xff2038 }));
    barRed.scale.set(0.7, 0.24, 0.5);
    barRed.position.set(-0.4, 1.66, -L * 0.06);
    group.add(barRed);
    barBlue = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0x2060ff }));
    barBlue.scale.set(0.7, 0.24, 0.5);
    barBlue.position.set(0.4, 1.66, -L * 0.06);
    group.add(barBlue);
  }
  group.userData = { barRed, barBlue, spec, typeKey };
  return group;
}

export class Car {
  constructor(scene, typeKey, x, z, heading, colorOverride) {
    this.typeKey = typeKey;
    this.spec = CAR_TYPES[typeKey];
    this.mesh = buildCarMesh(typeKey, colorOverride);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.nitro = 1;
    this.id = 'car-' + Math.random().toString(36).slice(2, 8);
    this.stoppedTimer = 0;
    this.crashed = false;
    scene.add(this.mesh);
    this.syncMesh();
  }

  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }

  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  drive(dt, throttle, steerInput, handbrake, nitroHeld, city, onCrash) {
    const spec = this.spec;
    const top = spec.topSpeed * (nitroHeld && this.nitro > 0 ? 1.35 : 1);
    if (nitroHeld && throttle > 0 && this.nitro > 0) this.nitro = Math.max(0, this.nitro - dt * 0.35);
    else this.nitro = Math.min(1, this.nitro + dt * 0.08);
    if (throttle > 0) this.speed += spec.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= spec.accel * 1.6 * dt;
      else this.speed = Math.max(-spec.topSpeed * 0.4, this.speed + spec.accel * throttle * dt);
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 4 * dt);
    }
    if (handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 18 * dt);
    this.speed = clampNumber(this.speed, -spec.topSpeed * 0.4, top);
    const speedFactor = clampNumber(Math.abs(this.speed) / 12, 0, 1);
    this.steer = angleLerp(this.steer, steerInput, Math.min(1, dt * 8));
    const turnRate = this.steer * spec.grip * speedFactor * (this.speed >= 0 ? 1 : -1) * (handbrake ? 1.5 : 1);
    this.heading += turnRate * dt * 0.9;
    const f = this.forward();
    const oldX = this.x; const oldZ = this.z;
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    const fixed = city.resolveCollision(this.x, this.z, 2.1);
    this.crashed = false;
    if (Math.abs(fixed.x - this.x) > 0.01 || Math.abs(fixed.z - this.z) > 0.01) {
      const impact = Math.abs(this.speed);
      this.x = fixed.x; this.z = fixed.z;
      if (impact > 8) {
        this.crashed = true;
        if (onCrash) onCrash(impact);
      }
      this.speed *= 0.35;
    }
    this.x = clampNumber(this.x, -WORLD_HALF + 3, WORLD_HALF - 3);
    this.z = clampNumber(this.z, -WORLD_HALF + 3, WORLD_HALF - 3);
    this.syncMesh();
    return { moved: Math.hypot(this.x - oldX, this.z - oldZ) };
  }
}

export function spawnParkedCars(scene, city) {
  const parked = [];
  for (const [type, x, z, heading, specialId, color] of PARKED_SPOTS) {
    const car = new Car(scene, type, x, z, heading, color);
    if (specialId) car.id = specialId;
    car.parked = true;
    parked.push(car);
  }
  return parked;
}

export class TrafficSystem {
  constructor(scene, city, count = 14) {
    this.scene = scene;
    this.city = city;
    this.cars = [];
    const types = ['sedan', 'sedan', 'taxi', 'pickup', 'van', 'sedan', 'taxi'];
    for (let i = 0; i < count; i += 1) {
      const axis = i % 2 === 0 ? 'x' : 'z';
      const road = ROADS[i % ROADS.length];
      const along = -160 + ((i * 53) % 320);
      const x = axis === 'x' ? along : road;
      const z = axis === 'x' ? road : along;
      const car = new Car(scene, types[i % types.length], x, z, axis === 'x' ? Math.PI / 2 : 0);
      car.traffic = { axis, road, dir: i % 4 < 2 ? 1 : -1, speed: 9 + (i % 4) };
      car.parked = false;
      this.cars.push(car);
    }
  }

  update(dt, playerPos, playerCar, onTrafficHit) {
    for (const car of this.cars) {
      const t = car.traffic;
      if (car.stoppedTimer > 0) { car.stoppedTimer -= dt; car.syncMesh(); continue; }
      // Brake for the player ahead on the same road.
      let speed = t.speed;
      if (playerPos) {
        const ahead = t.axis === 'x'
          ? (playerPos.z - t.road) * 0 + (Math.abs(playerPos.z - t.road) < 5 && (playerPos.x - car.x) * t.dir > 0 && Math.abs(playerPos.x - car.x) < 12)
          : (Math.abs(playerPos.x - t.road) < 5 && (playerPos.z - car.z) * t.dir > 0 && Math.abs(playerPos.z - car.z) < 12);
        if (ahead) speed = 0;
      }
      if (t.axis === 'x') {
        car.x += t.dir * speed * dt;
        car.heading = angleLerp(car.heading, t.dir > 0 ? Math.PI / 2 : -Math.PI / 2, Math.min(1, dt * 4));
        if (Math.abs(car.x) > WORLD_HALF - 6) { t.dir *= -1; car.x = clampNumber(car.x, -WORLD_HALF + 6, WORLD_HALF - 6); }
        for (const r of ROADS) {
          if (Math.abs(car.x - r) < speed * dt + 0.4 && Math.random() < 0.012) {
            t.axis = 'z'; t.road = r; car.z = t.road; car.x = r;
            t.dir = Math.random() < 0.5 ? 1 : -1;
          }
        }
      } else {
        car.z += t.dir * speed * dt;
        car.heading = angleLerp(car.heading, t.dir > 0 ? 0 : Math.PI, Math.min(1, dt * 4));
        if (Math.abs(car.z) > WORLD_HALF - 6) { t.dir *= -1; car.z = clampNumber(car.z, -WORLD_HALF + 6, WORLD_HALF - 6); }
        for (const r of ROADS) {
          if (Math.abs(car.z - r) < speed * dt + 0.4 && Math.random() < 0.012) {
            t.axis = 'x'; t.road = r; car.x = t.road; car.z = r;
            t.dir = Math.random() < 0.5 ? 1 : -1;
          }
        }
      }
      // Shove apart from the player's car.
      if (playerCar && distance2D(car.x, car.z, playerCar.x, playerCar.z) < 4.4) {
        const d = Math.max(0.5, distance2D(car.x, car.z, playerCar.x, playerCar.z));
        const push = (4.4 - d) * 0.5;
        const nx = (car.x - playerCar.x) / d; const nz = (car.z - playerCar.z) / d;
        car.x += nx * push; car.z += nz * push;
        if (Math.abs(playerCar.speed) > 10) {
          car.stoppedTimer = 2.5;
          if (onTrafficHit) onTrafficHit(car);
        }
      }
      car.syncMesh();
    }
  }
}

export class WantedSystem {
  constructor() {
    this.stars = 0;
    this.decayTimer = 0;
    this.unseenTimer = 0;
  }

  raise(n, onRaise) {
    const before = this.stars;
    this.stars = clampNumber(this.stars + n, 0, TUNING.maxWanted);
    this.decayTimer = 0;
    this.unseenTimer = 0;
    if (this.stars > before && onRaise) onRaise(this.stars);
  }

  setStars(n) {
    this.stars = clampNumber(n, 0, TUNING.maxWanted);
    this.decayTimer = 0;
    this.unseenTimer = 0;
  }

  clear() { this.stars = 0; this.decayTimer = 0; this.unseenTimer = 0; }

  update(dt, seenByPolice, inLayLow) {
    if (this.stars === 0) return;
    if (inLayLow) {
      this.unseenTimer += dt;
      if (this.unseenTimer > 2.5) this.clear();
      return;
    }
    if (!seenByPolice) {
      this.unseenTimer += dt;
      if (this.unseenTimer > TUNING.wantedDecaySeconds) {
        this.stars -= 1;
        this.unseenTimer = 0;
      }
    } else {
      this.unseenTimer = 0;
    }
  }
}

export class PoliceSystem {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.units = [];
    this.flashTimer = 0;
    this.bustedTimer = 0;
  }

  desiredCount(stars) { return stars === 0 ? 0 : Math.min(4, 1 + stars); }

  spawnNear(playerX, playerZ) {
    const road = ROADS[Math.floor(Math.random() * ROADS.length)];
    const horizontal = Math.random() < 0.5;
    let x; let z;
    if (horizontal) { x = playerX + (Math.random() < 0.5 ? -55 : 55); z = road; }
    else { x = road; z = playerZ + (Math.random() < 0.5 ? -55 : 55); }
    x = clampNumber(x, -WORLD_HALF + 8, WORLD_HALF - 8);
    z = clampNumber(z, -WORLD_HALF + 8, WORLD_HALF - 8);
    const car = new Car(this.scene, 'police', x, z, Math.atan2(playerX - x, playerZ - z));
    car.police = true;
    this.units.push(car);
    return car;
  }

  removeUnit(car) {
    this.scene.remove(car.mesh);
    this.units = this.units.filter((u) => u !== car);
  }

  nearestDistance(playerX, playerZ) {
    let best = Infinity;
    for (const u of this.units) best = Math.min(best, distance2D(u.x, u.z, playerX, playerZ));
    return best;
  }

  update(dt, playerX, playerZ, playerSpeed, stars, onRam) {
    this.flashTimer += dt;
    const flashOn = Math.floor(this.flashTimer * 4) % 2 === 0;
    const want = this.desiredCount(stars);
    while (this.units.length < want) this.spawnNear(playerX, playerZ);
    while (this.units.length > want) this.removeUnit(this.units[this.units.length - 1]);
    let busted = false;
    let closeAndSlow = false;
    for (const u of this.units) {
      const { barRed, barBlue } = u.mesh.userData;
      if (barRed && barBlue) {
        barRed.material.color.setHex(flashOn ? 0xff2038 : 0x55101a);
        barBlue.material.color.setHex(flashOn ? 0x102050 : 0x2060ff);
      }
      const dist = distance2D(u.x, u.z, playerX, playerZ);
      const targetHeading = Math.atan2(playerX - u.x, playerZ - u.z);
      u.heading = angleLerp(u.heading, targetHeading, Math.min(1, dt * 2.2));
      const throttle = dist > 7 ? 1 : 0.25;
      u.drive(dt, throttle, 0, false, false, this.city, null);
      if (dist < 5 && Math.abs(playerSpeed) < 3) closeAndSlow = true;
      if (dist < 4.2 && Math.abs(u.speed) > 12 && onRam) onRam(u);
    }
    if (stars > 0 && closeAndSlow) {
      this.bustedTimer += dt;
      if (this.bustedTimer > TUNING.bustedHoldSeconds) { busted = true; this.bustedTimer = 0; }
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    return { busted, nearest: this.nearestDistance(playerX, playerZ) };
  }

  clearAll() {
    for (const u of [...this.units]) this.removeUnit(u);
    this.bustedTimer = 0;
  }
}

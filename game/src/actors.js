// Actors: Ria on foot, sidewalk pedestrians, rival crews and combat.
// Hitscan shooting, punches, health, pickups and flee behaviour live here.
import * as THREE from 'three';
import { TUNING, clampNumber, distance2D, angleLerp, RIVAL_SPAWNS } from './config.js';

const limbGeo = new THREE.BoxGeometry(0.34, 0.8, 0.34);
const torsoGeo = new THREE.BoxGeometry(0.72, 0.85, 0.4);
const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);

export function buildPersonMesh(shirt, pants, skin, capColor) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const legL = new THREE.Mesh(limbGeo, pantsMat);
  legL.position.set(-0.2, 0.4, 0);
  const legR = new THREE.Mesh(limbGeo, pantsMat);
  legR.position.set(0.2, 0.4, 0);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 1.22;
  torso.castShadow = true;
  const armL = new THREE.Mesh(limbGeo, shirtMat);
  armL.position.set(-0.56, 1.3, 0);
  const armR = new THREE.Mesh(limbGeo, shirtMat);
  armR.position.set(0.56, 1.3, 0);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.92;
  head.castShadow = true;
  group.add(legL, legR, torso, armL, armR, head);
  if (capColor !== null) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.56), new THREE.MeshLambertMaterial({ color: capColor }));
    cap.position.y = 2.22;
    group.add(cap);
  }
  group.userData = { legL, legR, armL, armR, torso, head };
  return group;
}

function animateWalk(mesh, phase, amount) {
  const u = mesh.userData;
  const swing = Math.sin(phase) * 0.6 * amount;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.7;
  u.armR.rotation.x = swing * 0.7;
  mesh.position.y = Math.abs(Math.cos(phase)) * 0.06 * amount;
}

export class Player {
  constructor(scene, x, z) {
    this.mesh = buildPersonMesh(0xff5b8f, 0x2a3550, 0xe8b88a, 0xffd23e);
    this.x = x; this.z = z; this.y = 0;
    this.heading = Math.PI;
    this.health = TUNING.playerHealth;
    this.vy = 0;
    this.grounded = true;
    this.walkPhase = 0;
    this.inCar = null;
    this.mag = TUNING.pistolMagazine;
    this.reloading = false;
    this.reloadTimer = 0;
    this.shootCooldown = 0;
    this.punchCooldown = 0;
    this.ownedCars = new Set();
    scene.add(this.mesh);
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
  }

  updateOnFoot(dt, moveX, moveZ, sprint, jump, city) {
    const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    const len = Math.hypot(moveX, moveZ);
    let moving = 0;
    if (len > 0.01) {
      const nx = moveX / len; const nz = moveZ / len;
      this.x += nx * speed * dt;
      this.z += nz * speed * dt;
      this.heading = angleLerp(this.heading, Math.atan2(nx, nz), Math.min(1, dt * 12));
      moving = sprint ? 1.4 : 1;
      this.walkPhase += dt * (sprint ? 11 : 8);
    }
    if (jump && this.grounded) { this.vy = 7; this.grounded = false; }
    if (!this.grounded) {
      this.vy -= 22 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.grounded = true; }
    }
    const fixed = city.resolveCollision(this.x, this.z, 0.7);
    this.x = fixed.x; this.z = fixed.z;
    animateWalk(this.mesh, this.walkPhase, moving);
    this.syncMesh();
    return moving;
  }

  updateTimers(dt) {
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.reloading = false; this.mag = TUNING.pistolMagazine; }
    }
  }

  startReload() {
    if (this.reloading || this.mag === TUNING.pistolMagazine) return false;
    this.reloading = true;
    this.reloadTimer = TUNING.reloadSeconds;
    return true;
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.reloading || this.inCar) return false;
    if (this.mag <= 0) { this.startReload(); return false; }
    this.mag -= 1;
    this.shootCooldown = 0.22;
    return true;
  }

  tryPunch() {
    if (this.punchCooldown > 0 || this.inCar) return false;
    this.punchCooldown = 0.45;
    return true;
  }

  takeDamage(n) {
    this.health = Math.max(0, this.health - n);
    return this.health <= 0;
  }

  heal(n) { this.health = Math.min(TUNING.playerHealth, this.health + n); }

  enterCar(car) {
    this.inCar = car;
    this.mesh.visible = false;
    car.parked = false;
  }

  exitCar(city) {
    const car = this.inCar;
    if (!car) return;
    this.inCar = null;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.x = car.x + side.x * 2.6;
    this.z = car.z + side.z * 2.6;
    const fixed = city.resolveCollision(this.x, this.z, 0.7);
    this.x = fixed.x; this.z = fixed.z;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.syncMesh();
  }
}

const PED_SHIRTS = [0x3f7fbf, 0xe8a83c, 0x4a9a5a, 0xb87ab8, 0xd8d8d8, 0x38b8a8, 0xc96a3a];
const PED_PANTS = [0x2a3550, 0x3a3a3a, 0x5a4a3a, 0x2a4a3a];
const PED_SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf2d0a8, 0x6a4632];

export class PedestrianSystem {
  constructor(scene, city, count = 26) {
    this.scene = scene;
    this.city = city;
    this.peds = [];
    for (let i = 0; i < count; i += 1) {
      const x = -160 + ((i * 67) % 320);
      const z = -160 + ((i * 113) % 320);
      const mesh = buildPersonMesh(PED_SHIRTS[i % PED_SHIRTS.length], PED_PANTS[i % PED_PANTS.length], PED_SKINS[i % PED_SKINS.length], i % 3 === 0 ? 0x30405a : null);
      scene.add(mesh);
      this.peds.push({
        mesh, x, z, heading: Math.random() * Math.PI * 2,
        targetX: x, targetZ: z, phase: Math.random() * 6,
        fleeTimer: 0, fleeX: 0, fleeZ: 0, downTimer: 0, speed: 1.8 + Math.random() * 1.2,
      });
    }
    this.pickNewTargets();
  }

  pickNewTargets() {
    for (const p of this.peds) {
      p.targetX = clampNumber(p.x + (Math.random() - 0.5) * 70, -170, 170);
      p.targetZ = clampNumber(p.z + (Math.random() - 0.5) * 70, -170, 170);
    }
  }

  scare(x, z, radius) {
    for (const p of this.peds) {
      if (p.downTimer > 0) continue;
      if (distance2D(p.x, p.z, x, z) < radius) {
        p.fleeTimer = 3;
        p.fleeX = p.x - x; p.fleeZ = p.z - z;
      }
    }
  }

  update(dt, threatCars) {
    for (const p of this.peds) {
      if (p.downTimer > 0) {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          p.mesh.rotation.x = 0;
          p.x = clampNumber(p.x + 60, -170, 170);
          p.z = clampNumber(p.z - 40, -170, 170);
        }
        p.mesh.position.set(p.x, 0, p.z);
        continue;
      }
      let vx = 0; let vz = 0; let speed = p.speed;
      if (p.fleeTimer > 0) {
        p.fleeTimer -= dt;
        const len = Math.max(0.1, Math.hypot(p.fleeX, p.fleeZ));
        vx = (p.fleeX / len); vz = (p.fleeZ / len);
        speed = 5.2;
      } else {
        const dx = p.targetX - p.x; const dz = p.targetZ - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 3) {
          p.targetX = clampNumber(p.x + (Math.random() - 0.5) * 80, -170, 170);
          p.targetZ = clampNumber(p.z + (Math.random() - 0.5) * 80, -170, 170);
        } else { vx = dx / d; vz = dz / d; }
      }
      // Dodge fast cars: step aside.
      if (threatCars) {
        for (const car of threatCars) {
          if (Math.abs(car.speed) > 8 && distance2D(p.x, p.z, car.x, car.z) < 7) {
            p.fleeTimer = 1.2;
            p.fleeX = p.x - car.x; p.fleeZ = p.z - car.z;
          }
        }
      }
      p.x += vx * speed * dt;
      p.z += vz * speed * dt;
      const fixed = this.city.resolveCollision(p.x, p.z, 0.6);
      if (Math.abs(fixed.x - p.x) > 0.01 || Math.abs(fixed.z - p.z) > 0.01) {
        p.targetX = p.x - vx * 20; p.targetZ = p.z - vz * 20;
      }
      p.x = fixed.x; p.z = fixed.z;
      if (Math.hypot(vx, vz) > 0.01) p.heading = angleLerp(p.heading, Math.atan2(vx, vz), Math.min(1, dt * 8));
      p.phase += dt * speed * 1.6;
      animateWalk(p.mesh, p.phase, 0.8);
      p.mesh.position.set(p.x, p.mesh.position.y, p.z);
      p.mesh.rotation.y = p.heading;
    }
  }

  knockDown(ped) {
    ped.downTimer = 4;
    ped.mesh.rotation.x = Math.PI / 2 - 0.15;
    ped.fleeTimer = 0;
  }
}

// Ray from origin along dir (unit, horizontal-ish). Returns nearest hit within range.
export function rayHitActors(origin, dir, actors, range) {
  let best = null; let bestT = range;
  for (const a of actors) {
    if (a.dead || a.downTimer > 0) continue;
    const dx = a.x - origin.x; const dz = a.z - origin.z;
    const t = dx * dir.x + dz * dir.z;
    if (t < 0 || t > bestT) continue;
    const px = origin.x + dir.x * t; const pz = origin.z + dir.z * t;
    const miss = Math.hypot(a.x - px, a.z - pz);
    if (miss < 1.15) { best = a; bestT = t; }
  }
  return best ? { actor: best, distance: bestT } : null;
}

export class EnemySquad {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.enemies = [];
    this.pickups = [];
  }

  spawnCrew() {
    this.clearAll();
    for (const [x, z] of RIVAL_SPAWNS) {
      const mesh = buildPersonMesh(0x8a2028, 0x1c1c24, PED_SKINS[Math.floor(Math.random() * PED_SKINS.length)], 0x1c1c24);
      this.scene.add(mesh);
      const barBg = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0x101010 }));
      barBg.position.y = 2.55;
      mesh.add(barBg);
      const barFg = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.1, 0.07), new THREE.MeshBasicMaterial({ color: 0x40ff70 }));
      barFg.position.set(0, 2.55, 0.01);
      mesh.add(barFg);
      const enemy = {
        mesh, barFg, x, z, heading: 0, health: 100, dead: false,
        alerted: false, shootTimer: 1 + Math.random(), phase: Math.random() * 6, homeX: x, homeZ: z,
      };
      mesh.position.set(x, 0, z);
      this.enemies.push(enemy);
    }
  }

  aliveCount() { return this.enemies.filter((e) => !e.dead).length; }

  damageEnemy(enemy, n, onKill) {
    enemy.health -= n;
    enemy.alerted = true;
    const ratio = clampNumber(enemy.health / 100, 0, 1);
    enemy.barFg.scale.x = ratio;
    enemy.barFg.position.x = -(1.24 * (1 - ratio)) / 2;
    enemy.barFg.material.color.setHex(ratio > 0.5 ? 0x40ff70 : ratio > 0.25 ? 0xffd23e : 0xff4030);
    if (enemy.health <= 0 && !enemy.dead) {
      enemy.dead = true;
      enemy.mesh.rotation.x = Math.PI / 2 - 0.12;
      enemy.mesh.position.y = 0.2;
      this.dropPickup(enemy.x, enemy.z);
      if (onKill) onKill(enemy);
    }
  }

  dropPickup(x, z) {
    const kind = Math.random() < 0.5 ? 'cash' : 'ammo';
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.6),
      new THREE.MeshBasicMaterial({ color: kind === 'cash' ? 0x40ff70 : 0xffd23e }),
    );
    mesh.position.set(x, 0.6, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, x, z, kind, taken: false });
  }

  update(dt, player, onEnemyShot) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dist = distance2D(e.x, e.z, player.x, player.z);
      if (!e.alerted && dist < 20) e.alerted = true;
      if (e.alerted && !player.inCar) {
        e.heading = angleLerp(e.heading, Math.atan2(player.x - e.x, player.z - e.z), Math.min(1, dt * 6));
        if (dist > 9) {
          const nx = (player.x - e.x) / dist; const nz = (player.z - e.z) / dist;
          e.x += nx * 3.6 * dt; e.z += nz * 3.6 * dt;
          const fixed = this.city.resolveCollision(e.x, e.z, 0.6);
          e.x = fixed.x; e.z = fixed.z;
          e.phase += dt * 7;
          animateWalk(e.mesh, e.phase, 0.9);
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && dist < 34) {
          e.shootTimer = 1.5 + Math.random() * 0.9;
          if (onEnemyShot) onEnemyShot(e, dist);
        }
      } else if (!e.alerted) {
        e.phase += dt * 1.2;
        e.heading += Math.sin(e.phase * 0.4) * dt * 0.4;
      }
      e.mesh.position.set(e.x, e.mesh.position.y, e.z);
      e.mesh.rotation.y = e.heading;
    }
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      pk.mesh.rotation.y += dt * 2;
    }
  }

  collectPickups(player, onCollect) {
    for (const pk of this.pickups) {
      if (pk.taken || player.inCar) continue;
      if (distance2D(pk.x, pk.z, player.x, player.z) < 2.2) {
        pk.taken = true;
        this.scene.remove(pk.mesh);
        if (onCollect) onCollect(pk);
      }
    }
  }

  clearAll() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    for (const pk of this.pickups) this.scene.remove(pk.mesh);
    this.enemies = [];
    this.pickups = [];
  }
}

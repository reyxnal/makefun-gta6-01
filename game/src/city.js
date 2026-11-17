// Procedural Vela Mar: grid city, marina, docks, festival plaza, day-night
// lighting, particles and objective beacons. All textures are painted on
// canvases at boot; nothing is loaded from disk or network.
import * as THREE from 'three';
import { ROADS, ROAD_WIDTH, WORLD_HALF, BLOCK_PITCH, TOKEN_SPOTS, rectClearOfKeepOut, pointClearOfKeepOut, mulberry32, pickRandom, clampNumber, lerpNumber } from './config.js';

const FACADE_COLORS = [0xe8d9b0, 0xd9b8a3, 0xa8c4d4, 0xf2e6c9, 0xc9d6b8, 0xe6c8d8, 0xb8c8e8, 0xd4c5a0];
const CONTAINER_COLORS = [0xc94f32, 0x3f7fbf, 0x4a9a5a, 0xd9a83c, 0x7a5ab8];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function facadeTexture(baseHex, rng, litRatio) {
  const c = makeCanvas(128, 256);
  const g = c.getContext('2d');
  g.fillStyle = baseHex;
  g.fillRect(0, 0, 128, 256);
  const cols = 6; const rows = 12;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffe9a8' : '#2a3550';
      g.fillRect(8 + x * 20, 10 + y * 20, 13, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#2e323b';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#f2c230';
  g.fillRect(60, 8, 8, 48);
  g.fillRect(60, 72, 8, 48);
  g.fillStyle = '#565c68';
  for (let i = 0; i < 90; i += 1) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 28);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, sub, bg, fg) {
  const c = makeCanvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = '800 52px Trebuchet MS, Verdana, sans-serif';
  g.textAlign = 'center';
  g.fillText(text, 256, 62);
  g.font = '700 26px Trebuchet MS, Verdana, sans-serif';
  g.fillText(sub, 256, 102);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hexCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

export class ParticleSystem {
  constructor(scene, max = 400) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.velocities = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.colors = new Float32Array(max * 3);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(x, y, z, color, count, speed, up = 3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i += 1) {
      const idx = this.head;
      this.head = (this.head + 1) % this.max;
      this.positions[idx * 3] = x; this.positions[idx * 3 + 1] = y; this.positions[idx * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.velocities[idx * 3] = Math.cos(a) * s;
      this.velocities[idx * 3 + 1] = up * (0.4 + Math.random());
      this.velocities[idx * 3 + 2] = Math.sin(a) * s;
      this.colors[idx * 3] = c.r; this.colors[idx * 3 + 1] = c.g; this.colors[idx * 3 + 2] = c.b;
      this.life[idx] = 0.5 + Math.random() * 0.5;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i += 1) {
      if (this.life[i] <= 0) { this.positions[i * 3 + 1] = -50; continue; }
      this.life[i] -= dt;
      this.velocities[i * 3 + 1] -= 9 * dt;
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      if (this.positions[i * 3 + 1] < 0.05) this.positions[i * 3 + 1] = 0.05;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

export class CityBuilder {
  constructor(scene, seed = 7) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.colliders = [];
    this.lampMaterials = [];
    this.tokens = [];
    this.yachts = [];
    this.wheel = null;
    this.beacon = null;
    this.beaconRing = null;
    this.gateMeshes = [];
    this.particles = new ParticleSystem(scene);
    this.sun = null;
    this.hemi = null;
    this.elapsed = 0;
  }

  addCollider(x, z, halfW, halfD) {
    this.colliders.push({ minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD });
  }

  buildAll() {
    this.buildGroundAndRoads();
    this.buildBlocks();
    this.buildFestivalPlaza();
    this.buildMarina();
    this.buildDocks();
    this.buildSpecialSigns();
    this.buildTokens();
    this.buildBeacon();
    this.buildLights();
  }

  buildGroundAndRoads() {
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x9aa07a });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2 + 40, WORLD_HALF * 2 + 40), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const tex = roadTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: tex });
    const span = WORLD_HALF * 2;
    for (const r of ROADS) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, span), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(r, 0.02, 0);
      v.receiveShadow = true;
      this.scene.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(span, ROAD_WIDTH), roadMat.clone());
      h.material.map = tex.clone();
      h.material.map.needsUpdate = true;
      h.rotation.x = -Math.PI / 2;
      h.rotation.z = Math.PI / 2;
      h.position.set(0, 0.03, r);
      h.receiveShadow = true;
      this.scene.add(h);
    }
    // Sidewalk slabs per block.
    const slabMat = new THREE.MeshLambertMaterial({ color: 0xb9b2a2 });
    const slabGeo = new THREE.BoxGeometry(BLOCK_PITCH - ROAD_WIDTH - 2, 0.3, BLOCK_PITCH - ROAD_WIDTH - 2);
    for (let bx = -125; bx <= 125; bx += 50) {
      for (let bz = -125; bz <= 125; bz += 50) {
        const slab = new THREE.Mesh(slabGeo, slabMat);
        slab.position.set(bx, 0.15, bz);
        slab.receiveShadow = true;
        this.scene.add(slab);
      }
    }
  }

  buildBlocks() {
    const rng = this.rng;
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const facadeMats = FACADE_COLORS.map((hex) => new THREE.MeshLambertMaterial({ map: facadeTexture(hexCss(hex), rng, 0.35) }));
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a6a72 });
    const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
    const palmLeafMat = new THREE.MeshLambertMaterial({ color: 0x3f9a4a });
    for (let bx = -125; bx <= 125; bx += 50) {
      for (let bz = -125; bz <= 125; bz += 50) {
        if (bx === 0 && bz === 0) continue; // festival plaza
        if (bx === 75 && bz === -75) continue; // garage block handled by signs + garage mesh
        const count = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i += 1) {
          const w = 9 + rng() * 9;
          const d = 9 + rng() * 9;
          const h = 8 + rng() * rng() * 34;
          let x = 0; let z = 0; let placed = false;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const ox = (rng() - 0.5) * (BLOCK_PITCH - ROAD_WIDTH - w - 4);
            const oz = (rng() - 0.5) * (BLOCK_PITCH - ROAD_WIDTH - d - 4);
            x = bx + ox; z = bz + oz;
            if (rectClearOfKeepOut(x, z, w / 2, d / 2)) { placed = true; break; }
          }
          if (!placed) continue;
          const mat = pickRandom(rng, facadeMats);
          const mesh = new THREE.Mesh(boxGeo, mat);
          mesh.scale.set(w, h, d);
          mesh.position.set(x, 0.3 + h / 2, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          this.scene.add(mesh);
          const roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(w * 0.9, 0.6, d * 0.9);
          roof.position.set(x, 0.3 + h + 0.3, z);
          this.scene.add(roof);
          this.addCollider(x, z, w / 2, d / 2);
          if (rng() < 0.3) {
            const neon = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: pickRandom(rng, [0xff5b8f, 0x38e0ff, 0xffd23e, 0x7dffb0]) }));
            neon.scale.set(0.5, Math.min(h * 0.5, 12), 0.5);
            neon.position.set(x + w / 2 + 0.3, 0.3 + h * 0.55, z);
            this.scene.add(neon);
          }
        }
        // Palms at block corners, kept clear of cars and markers.
        for (const [cx, cz] of [[-14, -14], [14, 14], [-14, 14], [14, -14]]) {
          if (rng() < 0.55 && pointClearOfKeepOut(bx + cx, bz + cz, 1)) this.buildPalm(bx + cx, bz + cz, palmTrunkMat, palmLeafMat, rng);
        }
        // Street lamp.
        if (rng() < 0.8 && pointClearOfKeepOut(bx + 16, bz - 16, 1)) this.buildLamp(bx + 16, bz - 16);
      }
    }
  }

  buildPalm(x, z, trunkMat, leafMat, rng) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 6.5, 6), trunkMat);
    trunk.position.set(x, 3.4, z);
    trunk.castShadow = true;
    this.scene.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
      const a = (i / 5) * Math.PI * 2 + rng();
      leaf.position.set(x + Math.cos(a) * 1.1, 6.6, z + Math.sin(a) * 1.1);
      leaf.rotation.z = Math.PI / 2.4;
      leaf.rotation.y = a;
      this.scene.add(leaf);
    }
    this.addCollider(x, z, 0.4, 0.4);
  }

  buildLamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6), new THREE.MeshLambertMaterial({ color: 0x3a3f4a }));
    pole.position.set(x, 2.7, z);
    this.scene.add(pole);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), bulbMat);
    bulb.position.set(x, 5.5, z);
    this.scene.add(bulb);
    this.lampMaterials.push(bulbMat);
  }

  buildFestivalPlaza() {
    const stageMat = new THREE.MeshLambertMaterial({ color: 0x2a2f45 });
    const stage = new THREE.Mesh(new THREE.BoxGeometry(26, 4, 10), stageMat);
    stage.position.set(0, 2.3, -14);
    stage.castShadow = true;
    this.scene.add(stage);
    this.addCollider(0, -14, 13, 5);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(28, 0.6, 12), new THREE.MeshLambertMaterial({ color: 0xff5b8f }));
    roof.position.set(0, 9.5, -14);
    this.scene.add(roof);
    for (const sx of [-11, 11]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), stageMat);
      pole.position.set(sx, 5, -14);
      this.scene.add(pole);
      const stack = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3), new THREE.MeshLambertMaterial({ color: 0x141828 }));
      stack.position.set(sx, 6.5, -17);
      this.scene.add(stack);
    }
    // Neon arch over the plaza entrance.
    const archMat = new THREE.MeshBasicMaterial({ color: 0x38e0ff });
    for (const sx of [-8, 8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.8), archMat);
      post.position.set(sx, 3.5, 24);
      this.scene.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.8, 0.8), archMat);
    beam.position.set(0, 7.2, 24);
    this.scene.add(beam);
    // Ferris wheel.
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(19, 12, 12);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(9, 0.35, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    wheelGroup.add(rim);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.25, 18, 0.25), new THREE.MeshBasicMaterial({ color: 0xff8fb3 }));
      spoke.rotation.z = a;
      wheelGroup.add(spoke);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshLambertMaterial({ color: pickRandom(this.rng, [0xff5b8f, 0x38e0ff, 0x7dffb0, 0xffd23e]) }));
      cabin.position.set(Math.cos(a) * 9, Math.sin(a) * 9, 0);
      cabin.name = 'wheelCabin';
      wheelGroup.add(cabin);
    }
    this.scene.add(wheelGroup);
    this.wheel = wheelGroup;
    const legMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
    for (const lx of [-4, 4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 13, 0.8), legMat);
      leg.position.set(19 + lx, 6, 12);
      leg.rotation.z = lx > 0 ? -0.3 : 0.3;
      this.scene.add(leg);
    }
    this.addCollider(19, 12, 3, 3);
    // Food stalls.
    const stallColors = [0xff8f3d, 0x38e0ff, 0x7dffb0];
    [-18, -10, 10].forEach((sx, i) => {
      const stall = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
      stall.position.set(sx, 1.8, 16);
      stall.castShadow = true;
      this.scene.add(stall);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.4, 4.6), new THREE.MeshLambertMaterial({ color: stallColors[i] }));
      awn.position.set(sx, 3.6, 16);
      this.scene.add(awn);
      this.addCollider(sx, 16, 2.5, 2);
    });
  }

  buildMarina() {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2 + 40, 34), new THREE.MeshLambertMaterial({ color: 0x2a7fa8, transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, 168);
    this.scene.add(water);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 2, 8), new THREE.MeshLambertMaterial({ color: 0xb08a5a }));
    board.rotation.x = -Math.PI / 2;
    board.position.set(0, 0.12, 152);
    this.scene.add(board);
    const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
    const hull2Mat = new THREE.MeshLambertMaterial({ color: 0xe8b8c8 });
    [[-60, 170], [-20, 172], [30, 170], [70, 172]].forEach(([x, z], i) => {
      const yacht = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 12), i % 2 ? hull2Mat : hullMat);
      hull.position.y = 0.8;
      yacht.add(hull);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 5), new THREE.MeshLambertMaterial({ color: 0xdfe8f2 }));
      cabin.position.set(0, 2.6, -1);
      yacht.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), new THREE.MeshLambertMaterial({ color: 0x8a8a8a }));
      mast.position.set(0, 5, 2);
      yacht.add(mast);
      yacht.position.set(x, 0, z);
      this.scene.add(yacht);
      this.yachts.push(yacht);
    });
    // Lighthouse landmark.
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 20, 10), new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
    tower.position.set(-162, 10, 162);
    tower.castShadow = true;
    this.scene.add(tower);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 3, 10), new THREE.MeshBasicMaterial({ color: 0xff5b6e }));
    top.position.set(-162, 21, 162);
    this.scene.add(top);
    this.addCollider(-162, 162, 3, 3);
    // Clinic building.
    const clinic = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 12), new THREE.MeshLambertMaterial({ color: 0xe8f2f2 }));
    clinic.position.set(-58, 4.3, 168);
    clinic.castShadow = true;
    this.scene.add(clinic);
    this.addCollider(-58, 168, 7, 6);
  }

  buildDocks() {
    const rng = this.rng;
    const corridorClear = (x, z) => {
      // Keep the case arena and the gate approach corridor open so the
      // mission fight stays visible and walkable.
      if (Math.hypot(x - 158, z - 58) < 13) return false;
      if (x > 128 && x < 160 && z > 50 && z < 66) return false;
      return true;
    };
    for (let i = 0; i < 14; i += 1) {
      let x = 0; let z = 0; let placed = false;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        x = 138 + rng() * 34;
        z = 20 + rng() * 90;
        if (corridorClear(x, z)) { placed = true; break; }
      }
      if (!placed) continue;
      const stack = 1 + Math.floor(rng() * 2);
      for (let s = 0; s < stack; s += 1) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 3.4), new THREE.MeshLambertMaterial({ color: pickRandom(rng, CONTAINER_COLORS) }));
        box.position.set(x, 1.8 + s * 3.1, z);
        box.castShadow = true;
        this.scene.add(box);
      }
      this.addCollider(x, z, 4.5, 1.8);
    }
    for (const cz of [30, 90]) {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 22, 3), new THREE.MeshLambertMaterial({ color: 0xd9a83c }));
      tower.position.set(172, 11, cz);
      tower.castShadow = true;
      this.scene.add(tower);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 1.6), new THREE.MeshLambertMaterial({ color: 0xd9a83c }));
      jib.position.set(160, 22, cz);
      this.scene.add(jib);
      this.addCollider(172, cz, 1.6, 1.6);
    }
    // The case pedestal.
    const crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.6), new THREE.MeshLambertMaterial({ color: 0x8a6a3a }));
    crate.position.set(158, 1.0, 58);
    crate.castShadow = true;
    this.scene.add(crate);
    this.caseMesh = crate;
  }

  buildSpecialSigns() {
    const panel = (text, sub, bg, fg, w, h) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, sub, bg, fg), side: THREE.DoubleSide }));
      return m;
    };
    // Voss Garage building + sign.
    const garage = new THREE.Mesh(new THREE.BoxGeometry(20, 7, 16), new THREE.MeshLambertMaterial({ color: 0x8a8fa8 }));
    garage.position.set(78, 3.8, -75);
    garage.castShadow = true;
    this.scene.add(garage);
    this.addCollider(78, -75, 10, 8);
    const gSign = panel('VOSS GARAGE', 'FIXER • TOW • LAY LOW', '#1c2438', '#ffd23e', 16, 4);
    gSign.position.set(67.8, 5.2, -75);
    gSign.rotation.y = -Math.PI / 2;
    this.scene.add(gSign);
    const sSign = panel('AURORA STAGE', 'LUMEN FEST • LIVE ALL NIGHT', '#3a1040', '#ff8fb3', 20, 5);
    sSign.position.set(0, 8.2, -8.6);
    this.scene.add(sSign);
    const fSign = panel('LUMEN FEST', 'VELA MAR • LAUNCH EVE', '#10403a', '#7dffb0', 16, 4);
    fSign.position.set(0, 8.0, 24);
    this.scene.add(fSign);
    const hq = new THREE.Mesh(new THREE.BoxGeometry(16, 12, 14), new THREE.MeshLambertMaterial({ color: 0x9aa8c8 }));
    hq.position.set(-132, 6.3, -132);
    hq.castShadow = true;
    this.scene.add(hq);
    this.addCollider(-132, -132, 8, 7);
    const hqSign = panel('VMPD HQ', 'VELA MAR POLICE', '#16203c', '#8fe3ff', 13, 3.2);
    hqSign.position.set(-132, 9.5, -124.8);
    this.scene.add(hqSign);
    const mSign = panel('MERCADO VERDE', 'NIGHT MARKET • TACOS • FLOWERS', '#2a4010', '#ffe9a8', 15, 3.8);
    mSign.position.set(-100, 7.5, 60);
    this.scene.add(mSign);
    const cSign = panel('MARINA CLINIC', 'OPEN 24 HOURS', '#f2f2f2', '#c9303e', 10, 2.5);
    cSign.position.set(-58, 6.4, 161.8);
    cSign.rotation.y = Math.PI;
    this.scene.add(cSign);
    // Lay-low lockup marker building.
    const lockup = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 10), new THREE.MeshLambertMaterial({ color: 0x6a5a8a }));
    lockup.position.set(-58, 2.8, -134);
    lockup.castShadow = true;
    this.scene.add(lockup);
    this.addCollider(-58, -134, 6, 5);
    // Stunt ramp.
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 10), new THREE.MeshLambertMaterial({ color: 0xff8f3d }));
    ramp.position.set(100, 0.9, 0);
    ramp.rotation.x = -0.32;
    this.scene.add(ramp);
  }

  buildTokens() {
    const geo = new THREE.TorusGeometry(1.1, 0.28, 8, 18);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    for (const [x, z] of TOKEN_SPOTS) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 2.2, z);
      this.scene.add(mesh);
      this.tokens.push({ mesh, x, z, taken: false });
    }
  }

  buildBeacon() {
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.2, 46, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    cyl.position.y = 23;
    cyl.visible = false;
    this.scene.add(cyl);
    this.beacon = cyl;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.4, 0.3, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.4;
    ring.visible = false;
    this.scene.add(ring);
    this.beaconRing = ring;
  }

  setBeacon(x, z, visible, color = 0xffd23e) {
    if (!this.beacon) return;
    this.beacon.visible = visible;
    this.beaconRing.visible = visible;
    if (visible) {
      this.beacon.position.x = x; this.beacon.position.z = z;
      this.beaconRing.position.x = x; this.beaconRing.position.z = z;
      this.beacon.material.color.setHex(color);
      this.beaconRing.material.color.setHex(color);
    }
  }

  setCheckpointGates(gates) {
    for (const m of this.gateMeshes) this.scene.remove(m);
    this.gateMeshes = [];
    const geo = new THREE.TorusGeometry(4.2, 0.4, 8, 22);
    gates.forEach(([x, z], i) => {
      const mat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffd23e : 0x38e0ff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 4.4, z);
      this.scene.add(mesh);
      this.gateMeshes.push(mesh);
    });
  }

  setActiveGate(index) {
    this.gateMeshes.forEach((m, i) => {
      m.material.color.setHex(i === index ? 0xffd23e : 0x38e0ff);
      m.visible = i >= index;
    });
  }

  clearGates() {
    for (const m of this.gateMeshes) this.scene.remove(m);
    this.gateMeshes = [];
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xffe0b8, 0x405070, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
    this.sun.position.set(90, 120, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.far = 320;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  setShadowsEnabled(on) {
    if (this.sun) this.sun.castShadow = on;
  }

  setDayPhase(t) {
    const p = clampNumber(t, 0, 1);
    const sky = new THREE.Color().setHex(0xffb36b).lerp(new THREE.Color(0x2a1a4a), p * 0.55).lerp(new THREE.Color(0x0b1026), p * p);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky.getHex(), 120, 340 - p * 60);
    if (this.sun) {
      this.sun.intensity = lerpNumber(1.6, 0.35, p);
      this.sun.color.setHex(p < 0.5 ? 0xffd9a0 : 0x8fa8ff);
      this.sun.position.set(lerpNumber(90, -60, p), lerpNumber(120, 40, p), 40);
    }
    if (this.hemi) this.hemi.intensity = lerpNumber(0.9, 0.45, p);
    for (const m of this.lampMaterials) m.color.setHex(p > 0.35 ? 0xfff2c0 : 0xd8d8c8);
  }

  followShadowTarget(x, z) {
    if (!this.sun) return;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + 90, 120, z + 40);
  }

  update(dt) {
    this.elapsed += dt;
    if (this.wheel) {
      this.wheel.rotation.z += dt * 0.12;
      for (const child of this.wheel.children) {
        if (child.name === 'wheelCabin') child.rotation.z = -this.wheel.rotation.z;
      }
    }
    for (let i = 0; i < this.yachts.length; i += 1) {
      this.yachts[i].position.y = Math.sin(this.elapsed * 0.7 + i * 1.7) * 0.12;
      this.yachts[i].rotation.z = Math.sin(this.elapsed * 0.5 + i) * 0.015;
    }
    for (const tok of this.tokens) {
      if (tok.taken) continue;
      tok.mesh.rotation.y += dt * 1.6;
      tok.mesh.position.y = 2.2 + Math.sin(this.elapsed * 2 + tok.x) * 0.3;
    }
    if (this.beacon && this.beacon.visible) {
      const s = 1 + Math.sin(this.elapsed * 4) * 0.12;
      this.beaconRing.scale.set(s, s, 1);
    }
    this.particles.update(dt);
  }

  // Circle vs AABB resolve. Returns corrected x,z.
  resolveCollision(x, z, radius) {
    let nx = x; let nz = z;
    for (const c of this.colliders) {
      const cx = clampNumber(nx, c.minX, c.maxX);
      const cz = clampNumber(nz, c.minZ, c.maxZ);
      const dx = nx - cx; const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 < 0.0001) {
          const pushLeft = nx - c.minX; const pushRight = c.maxX - nx;
          const pushBack = nz - c.minZ; const pushFront = c.maxZ - nz;
          const m = Math.min(pushLeft, pushRight, pushBack, pushFront);
          if (m === pushLeft) nx = c.minX - radius;
          else if (m === pushRight) nx = c.maxX + radius;
          else if (m === pushBack) nz = c.minZ - radius;
          else nz = c.maxZ + radius;
        } else {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * radius;
          nz = cz + (dz / d) * radius;
        }
      }
    }
    const lim = WORLD_HALF - 2;
    nx = clampNumber(nx, -lim, lim);
    nz = clampNumber(nz, -lim, lim);
    return { x: nx, z: nz };
  }
}

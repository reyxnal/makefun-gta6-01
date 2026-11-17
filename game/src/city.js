// Procedural Verdeluz: one seed, one city. A road grid with blocks of
// extruded buildings, a beach and marina on two edges, parks, CCTV poles,
// props, and the road graph traffic drives on. Collision and line-of-sight
// helpers live here too, backed by a spatial hash of buildings.

import { WORLD, PALETTE, DISTRICTS, districtAt } from './config.js';
import { makeRng, pick, range, rangeInt, chance } from './rng.js';

const ROOFS = [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD];
const WALLS = [PALETTE.wallA, PALETTE.wallB, PALETTE.wallC, PALETTE.wallD];
const NEON = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonAmber];

export function roadCenters() {
  const centers = [];
  for (let i = 0; i < 10; i++) centers.push(132 + i * WORLD.roadGap);
  return centers;
}

export function isWater(x, y, city) {
  if (y >= WORLD.waterY || x >= WORLD.waterX) {
    if (city) {
      for (const p of city.piers) {
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return false;
      }
    }
    return true;
  }
  return false;
}

export function generateCity() {
  const rng = makeRng('verdeluz-witness-city-seed-1');
  const centers = roadCenters();
  const buildings = [];
  const trees = [];
  const lamps = [];
  const palms = [];
  const props = [];
  const cctv = [];
  const piers = [];
  const boats = [];

  // Blocks sit between roads. Block (i,j) spans centers[i]+roadHalf .. centers[i+1]-roadHalf.
  for (let i = 0; i < centers.length - 1; i++) {
    for (let j = 0; j < centers.length - 1; j++) {
      const x0 = centers[i] + WORLD.roadHalf + WORLD.sidewalk;
      const y0 = centers[j] + WORLD.roadHalf + WORLD.sidewalk;
      const x1 = centers[i + 1] - WORLD.roadHalf - WORLD.sidewalk;
      const y1 = centers[j + 1] - WORLD.roadHalf - WORLD.sidewalk;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      const bw = x1 - x0, bh = y1 - y0;
      const downtown = Math.hypot(cx - 1320, cy - 660) < 700;

      // Verde Park blocks become green space with trees.
      if (district === 'Verde Park' && chance(rng, 0.72)) {
        const n = rangeInt(rng, 6, 10);
        for (let t = 0; t < n; t++) {
          trees.push({ x: range(rng, x0 + 14, x1 - 14), y: range(rng, y0 + 14, y1 - 14), r: range(rng, 10, 17) });
        }
        props.push({ kind: 'bench', x: cx - 30, y: cy, angle: 0 });
        props.push({ kind: 'fountain', x: cx + 30, y: cy, r: 16 });
        continue;
      }
      // Beach-front blocks stay low and open.
      const beachfront = y1 > WORLD.beachY - 60;
      const count = beachfront ? 1 : (chance(rng, 0.3) ? 1 : chance(rng, 0.55) ? 2 : 4);
      const cols = count === 4 ? 2 : count;
      const rows = count === 4 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const gx0 = x0 + (bw / cols) * c + 6;
          const gy0 = y0 + (bh / rows) * r + 6;
          const gw = bw / cols - 12;
          const gh = bh / rows - 12;
          const hgt = beachfront ? range(rng, 22, 40)
            : downtown ? range(rng, 60, 130)
            : range(rng, 30, 78);
          const neon = district === 'Neon Row' && chance(rng, 0.6);
          buildings.push({
            x: gx0, y: gy0, w: gw, h: gh, hgt,
            roof: pick(rng, ROOFS), wall: pick(rng, WALLS),
            neon: neon ? pick(rng, NEON) : null,
            lit: chance(rng, 0.8),
            district,
          });
        }
      }
      // Sidewalk trees and lamps around the block.
      const nT = rangeInt(rng, 2, 5);
      for (let t = 0; t < nT; t++) {
        const edge = rangeInt(rng, 0, 3);
        if (edge === 0) trees.push({ x: range(rng, x0, x1), y: y0 - 8, r: range(rng, 8, 13) });
        else if (edge === 1) trees.push({ x: range(rng, x0, x1), y: y1 + 8, r: range(rng, 8, 13) });
        else if (edge === 2) trees.push({ x: x0 - 8, y: range(rng, y0, y1), r: range(rng, 8, 13) });
        else trees.push({ x: x1 + 8, y: range(rng, y0, y1), r: range(rng, 8, 13) });
      }
    }
  }

  // Beach: palms, umbrellas, boardwalk lamps along the sand.
  for (let x = 80; x < WORLD.size - 80; x += rangeInt(rng, 70, 130)) {
    palms.push({ x: x + range(rng, -20, 20), y: range(rng, WORLD.beachY + 30, WORLD.waterY - 40), lean: range(rng, -0.2, 0.2) });
  }
  for (let x = 120; x < WORLD.size; x += 220) {
    props.push({ kind: 'umbrella', x, y: WORLD.beachY + 90 + range(rng, -20, 30), color: pick(rng, NEON) });
  }

  // Marina: piers jutting into the eastern water, with moored boats.
  for (let y = 240; y < 2100; y += 420) {
    piers.push({ x: WORLD.marinaX - 40, y, w: 200, h: 26 });
    boats.push({ x: WORLD.marinaX + 60, y: y - 34, angle: 0.1, color: pick(rng, ['#e8e4d2', '#d94f4f', '#4f7ad9']) });
    boats.push({ x: WORLD.marinaX + 90, y: y + 52, angle: -0.08, color: pick(rng, ['#e8e4d2', '#ffb347', '#37e0d8']) });
  }

  // Street lamps at intersections.
  for (const cx of centers) {
    for (const cy of centers) {
      lamps.push({ x: cx + WORLD.roadHalf + 4, y: cy + WORLD.roadHalf + 4 });
    }
  }

  // CCTV poles: fixed watchers at major intersections and the docks.
  const cctvSpots = [
    [396, 396, 0.8], [1188, 396, 2.4], [1980, 396, -0.6], [660, 924, 1.6],
    [1452, 924, -2.2], [2244, 924, 2.9], [396, 1716, 0.4], [1188, 1716, -1.2],
    [1980, 1716, 2.0], [660, 2244, -0.5], [1452, 2244, 1.1], [2244, 1980, 2.6],
    [2508, 660, Math.PI], [2508, 1452, Math.PI],
  ];
  for (const [x, y, angle] of cctvSpots) {
    cctv.push({ x, y, angle, disabled: false, blink: rng() * Math.PI * 2 });
  }

  // Landmark locations, fixed so missions can rely on them.
  const garage = { x: 700, y: 1520, name: "Rosa's Garage" };
  const safehouse = { x: 330, y: 2050, name: "Mara's Apartment" };
  const docksOffice = { x: 2050, y: 2150, name: 'Harbor Office' };
  const vaneTower = { x: 1188, y: 330, name: 'Vane Tower' };
  const marinaBar = { x: 2244, y: 500, name: 'The Salt Line Bar' };

  // Hidden packages: tucked into alleys, park edges, beach and piers.
  // Each spot is nudged out of any building footprint so every package
  // is reachable on foot.
  const packageSpots = [
    [250, 250], [900, 300], [1700, 260], [2350, 700], [300, 1000], [1100, 1050],
    [1900, 1150], [2400, 1600], [500, 1900], [1300, 2050], [2100, 2400], [2420, 1093],
  ];
  const packages = packageSpots.map(([x, y], i) => {
    let px = x, py = y;
    for (let iter = 0; iter < 6; iter++) {
      const inside = buildings.find((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
      if (!inside) break;
      const left = px - inside.x, right = inside.x + inside.w - px;
      const top = py - inside.y, bottom = inside.y + inside.h - py;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = inside.x - 18;
      else if (m === right) px = inside.x + inside.w + 18;
      else if (m === top) py = inside.y - 18;
      else py = inside.y + inside.h + 18;
    }
    return { id: i, x: px, y: py, taken: false };
  });

  // Stunt jumps: ramps on long straight roads.
  const jumps = [
    { x: 1188, y: 1452, angle: -Math.PI / 2, name: 'Courthouse Leap' },
    { x: 660, y: 660, angle: 0, name: 'Park Flyer' },
    { x: 1980, y: 1980, angle: Math.PI / 2, name: 'Dock Drop' },
  ];

  // Taxi stands where fares wait.
  const taxiStands = [
    { x: 396, y: 660 }, { x: 1716, y: 396 }, { x: 924, y: 1452 },
    { x: 1980, y: 1188 }, { x: 660, y: 1980 }, { x: 2244, y: 2244 },
  ];

  // Road graph: intersections + neighbours, for traffic routing.
  const nodes = [];
  const nodeIndex = new Map();
  centers.forEach((cx, i) => centers.forEach((cy, j) => {
    nodeIndex.set(i + ',' + j, nodes.length);
    nodes.push({ x: cx, y: cy, i, j });
  }));
  const neighbours = nodes.map((n) => {
    const out = [];
    if (n.i > 0) out.push(nodeIndex.get((n.i - 1) + ',' + n.j));
    if (n.i < 9) out.push(nodeIndex.get((n.i + 1) + ',' + n.j));
    if (n.j > 0) out.push(nodeIndex.get(n.i + ',' + (n.j - 1)));
    if (n.j < 9) out.push(nodeIndex.get(n.i + ',' + (n.j + 1)));
    return out;
  });

  const city = {
    buildings, trees, lamps, palms, props, cctv, piers, boats,
    garage, safehouse, docksOffice, vaneTower, marinaBar,
    packages, jumps, taxiStands, nodes, neighbours, centers,
    hash: new Map(), hashCell: 264,
  };
  buildHash(city);
  return city;
}

function buildHash(city) {
  for (const b of city.buildings) {
    const x0 = Math.floor(b.x / city.hashCell), x1 = Math.floor((b.x + b.w) / city.hashCell);
    const y0 = Math.floor(b.y / city.hashCell), y1 = Math.floor((b.y + b.h) / city.hashCell);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = x + ',' + y;
        if (!city.hash.has(k)) city.hash.set(k, []);
        city.hash.get(k).push(b);
      }
    }
  }
}

export function buildingsNear(city, x, y, r) {
  const out = [];
  const x0 = Math.floor((x - r) / city.hashCell), x1 = Math.floor((x + r) / city.hashCell);
  const y0 = Math.floor((y - r) / city.hashCell), y1 = Math.floor((y + r) / city.hashCell);
  const seen = new Set();
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const list = city.hash.get(gx + ',' + gy);
      if (!list) continue;
      for (const b of list) {
        if (!seen.has(b)) { seen.add(b); out.push(b); }
      }
    }
  }
  return out;
}

// Push a circle out of buildings and world bounds. Returns corrected pos + hit flag.
export function collideCircle(city, x, y, r, allowWater) {
  let hit = false;
  const min = r + 4, max = WORLD.size - r - 4;
  if (x < min) { x = min; hit = true; }
  if (x > max) { x = max; hit = true; }
  if (y < min) { y = min; hit = true; }
  if (y > max) { y = max; hit = true; }
  for (const b of buildingsNear(city, x, y, r + 4)) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else {
        // Centre inside the rect: push out along the smallest overlap.
        const left = x - b.x, right = b.x + b.w - x;
        const top = y - b.y, bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  if (!allowWater && isWater(x, y, city)) {
    hit = true;
    // Step back toward the last dry position is handled by callers; here clamp to shore.
    if (y >= WORLD.waterY) y = WORLD.waterY - r - 2;
    if (x >= WORLD.waterX) x = WORLD.waterX - r - 2;
  }
  return { x, y, hit };
}

// Does a straight segment hit any building? Sampled, cheap enough for
// witness checks which only run when a crime happens.
export function segmentBlocked(city, x0, y0, x1, y1) {
  const steps = 7;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    for (const b of buildingsNear(city, x, y, 4)) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
    }
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  const centers = roadCenters();
  let best = null, bd = Infinity;
  for (const cx of centers) {
    const d = Math.abs(x - cx);
    if (d < bd) { bd = d; best = { x: cx, y }; }
  }
  for (const cy of centers) {
    const d = Math.abs(y - cy);
    if (d < bd) { bd = d; best = { x, y: cy }; }
  }
  return best;
}

export function randomRoadPoint(rng) {
  const centers = roadCenters();
  const vertical = chance(rng, 0.5);
  if (vertical) {
    return { x: pick(rng, centers), y: range(rng, 100, WORLD.size - 100) };
  }
  return { x: range(rng, 100, WORLD.size - 100), y: pick(rng, centers) };
}

export function randomSidewalkPoint(rng, city) {
  for (let tries = 0; tries < 20; tries++) {
    const p = randomRoadPoint(rng);
    const off = WORLD.roadHalf + WORLD.sidewalk * 0.5;
    const p2 = chance(rng, 0.5)
      ? { x: p.x + (chance(rng, 0.5) ? off : -off), y: p.y }
      : { x: p.x, y: p.y + (chance(rng, 0.5) ? off : -off) };
    if (isWater(p2.x, p2.y, city)) continue;
    const c = collideCircle(city, p2.x, p2.y, 8, false);
    if (!c.hit) return p2;
  }
  return { x: 660, y: 660 };
}

// Solmar Heat — city generation. One job: build Solmar Bay's layout from a seed
// (roads, blocks, buildings, parks, palms, marina, beach and sea) and answer
// collision queries against it.
import { WORLD_W, WORLD_H, ROAD_W, ROAD_GAP, BEACH_X, SEA_X, PALETTE } from './config.js';
import { makeRng, pick, range, intRange } from './rng.js';

export function verticalRoads() {
  const xs = [];
  for (let x = ROAD_GAP / 2; x < BEACH_X; x += ROAD_GAP) xs.push(x);
  return xs;
}

export function horizontalRoads() {
  const ys = [];
  for (let y = ROAD_GAP / 2; y < WORLD_H; y += ROAD_GAP) ys.push(y);
  return ys;
}

export function generateCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const parks = [];
  const vRoads = verticalRoads();
  const hRoads = horizontalRoads();
  const roadHalf = ROAD_W / 2 + 14;

  for (let bi = 0; bi < vRoads.length; bi += 1) {
    for (let bj = 0; bj < hRoads.length; bj += 1) {
      const x0 = vRoads[bi] + roadHalf;
      const x1 = (bi + 1 < vRoads.length ? vRoads[bi + 1] : BEACH_X) - roadHalf;
      const y0 = hRoads[bj] + roadHalf;
      const y1 = (bj + 1 < hRoads.length ? hRoads[bj + 1] : WORLD_H) - roadHalf;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const roll = rng();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = intRange(rng, 4, 9);
        for (let i = 0; i < n; i += 1) {
          palms.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20) });
        }
        continue;
      }
      const cols = x1 - x0 > 240 ? 2 : 1;
      const rows = y1 - y0 > 240 ? 2 : 1;
      const cw = (x1 - x0) / cols;
      const ch = (y1 - y0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const bx = x0 + c * cw + 12;
          const by = y0 + r * ch + 12;
          const bw = cw - 24 - range(rng, 0, 30);
          const bh = ch - 24 - range(rng, 0, 30);
          if (bw < 40 || bh < 40) continue;
          buildings.push({
            x: bx,
            y: by,
            w: bw,
            h: bh,
            roof: pick(rng, PALETTE.buildingRoof),
            wall: pick(rng, PALETTE.buildingWall),
            tall: rng() < 0.25,
          });
        }
      }
      if (rng() < 0.5) {
        palms.push({ x: range(rng, x0 + 16, x1 - 16), y: y0 + 8 });
      }
    }
  }
  // Marina strip: parked cars row and a palm line along the beach road.
  for (let y = 240; y < WORLD_H - 100; y += 260) {
    palms.push({ x: BEACH_X - 60, y });
  }
  return { buildings, palms, parks, vRoads, hRoads, seed };
}

// True when the circle at (x, y) with radius r overlaps any building.
export function hitsBuilding(city, x, y, r) {
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

export function insideWorld(x, y) {
  return x > 20 && x < WORLD_W - 20 && y > 20 && y < WORLD_H - 20;
}

export function onRoad(city, x, y) {
  for (let i = 0; i < city.vRoads.length; i += 1) {
    if (Math.abs(x - city.vRoads[i]) < ROAD_W / 2) return true;
  }
  for (let i = 0; i < city.hRoads.length; i += 1) {
    if (Math.abs(y - city.hRoads[i]) < ROAD_W / 2) return true;
  }
  return false;
}

// Nearest point on a road centreline (used to snap spawned traffic onto roads).
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < city.vRoads.length; i += 1) {
    const d = Math.abs(x - city.vRoads[i]);
    if (d < bestD) {
      bestD = d;
      best = { x: city.vRoads[i], y, vertical: true };
    }
  }
  for (let i = 0; i < city.hRoads.length; i += 1) {
    const d = Math.abs(y - city.hRoads[i]);
    if (d < bestD) {
      bestD = d;
      best = { x, y: city.hRoads[i], vertical: false };
    }
  }
  return best;
}

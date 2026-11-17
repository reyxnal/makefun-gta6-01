// Seeded random helpers: the city is generated from one seed so every run
// of the game shows the same Verdeluz, while gameplay stays unpredictable.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seedText) {
  return mulberry32(hashString(seedText));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

export function chance(rng, p) {
  return rng() < p;
}

// Smooth value noise in 1D, for water shimmer and crowd variation.
export function noise1(seed, x) {
  const xi = Math.floor(x);
  const xf = x - xi;
  const a = mulberry32(seed + xi)();
  const b = mulberry32(seed + xi + 1)();
  const u = xf * xf * (3 - 2 * xf);
  return a + (b - a) * u;
}

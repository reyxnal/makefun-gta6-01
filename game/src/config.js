// Verdeluz: Witness City — tuning, palette, names and static data.
// Every value the game balances on lives here so systems stay in sync.

export const WORLD = {
  size: 2640, // square world, pixels
  roadGap: 264, // distance between road centre lines
  roadHalf: 26, // half width of a road
  sidewalk: 14, // sidewalk band around each block
  beachY: 2340, // sand starts here (south edge)
  waterY: 2508, // water starts here (south edge)
  marinaX: 2380, // docks start here (east edge)
  waterX: 2520, // water starts here (east edge)
};

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6f9c4e',
  park: '#8fbf6a',
  sand: '#e8d29a',
  water: '#2e9db8',
  waterDeep: '#1f7f9c',
  asphalt: '#3d3f45',
  asphaltDark: '#34363c',
  sidewalk: '#b9b3a6',
  curb: '#9a948a',
  line: '#e8e4d2',
  laneDash: '#e8e4d2',
  centerLine: '#f2c14e',
  roofA: '#e8e0d0',
  roofB: '#d9c9b4',
  roofC: '#c9d6dd',
  roofD: '#e6c9a8',
  wallA: '#b8a88f',
  wallB: '#a89a86',
  wallC: '#9fb2bd',
  wallD: '#c9a87f',
  neonPink: '#ff5fa2',
  neonCyan: '#37e0d8',
  neonAmber: '#ffb347',
  palmTrunk: '#7a5a3c',
  palmLeaf: '#3f8f4f',
  lampGlow: '#ffd98a',
};

export const DISTRICTS = [
  { name: 'Marina del Sol', x0: 1800, y0: 0, x1: 2640, y1: 900, tint: '#e8f2f0' },
  { name: 'Neon Row', x0: 900, y0: 0, x1: 1800, y1: 900, tint: '#f2e8f2' },
  { name: 'Coral Heights', x0: 0, y0: 0, x1: 900, y1: 900, tint: '#f2ece0' },
  { name: 'Palm Court', x0: 0, y0: 900, x1: 1320, y1: 1800, tint: '#eef2e2' },
  { name: 'Old Port', x0: 1320, y0: 900, x1: 2640, y1: 1800, tint: '#e8ecef' },
  { name: 'Verde Park', x0: 0, y0: 1800, x1: 1320, y1: 2640, tint: '#e2f0dc' },
  { name: 'The Docks', x0: 1320, y0: 1800, x1: 2640, y1: 2640, tint: '#e6e2d8' },
];

export const CAR_TYPES = {
  brio: { name: 'Brio', len: 52, wid: 26, accel: 240, top: 330, grip: 3.2, health: 60, value: 400, colors: ['#d94f4f', '#4f7ad9', '#e8e4d2', '#7a7f8c'] },
  corsa: { name: 'Corsa', len: 62, wid: 28, accel: 260, top: 380, grip: 3.0, health: 80, value: 700, colors: ['#3a4a5a', '#c9c2b2', '#5a6e46', '#8c3a4a'] },
  falco: { name: 'Falco GT', len: 60, wid: 28, accel: 360, top: 520, grip: 4.2, health: 70, value: 2400, colors: ['#ffb347', '#ff5fa2', '#37e0d8', '#222831'] },
  lobo: { name: 'Lobo', len: 66, wid: 30, accel: 320, top: 460, grip: 3.4, health: 95, value: 1500, colors: ['#6b2d2d', '#2d3a2d', '#c9a227', '#4a4a52'] },
  burro: { name: 'Burro Van', len: 72, wid: 30, accel: 190, top: 290, grip: 2.6, health: 120, value: 500, colors: ['#e8e4d2', '#7a8a99', '#b8a05a'] },
  taxi: { name: 'City Cab', len: 60, wid: 28, accel: 250, top: 360, grip: 3.0, health: 80, value: 600, colors: ['#f2c14e'] },
  patrol: { name: 'Patrol Interceptor', len: 62, wid: 28, accel: 340, top: 500, grip: 4.0, health: 110, value: 0, colors: ['#1c2733'] },
  armored: { name: 'Vault Hauler', len: 78, wid: 32, accel: 170, top: 270, grip: 2.4, health: 220, value: 5000, colors: ['#4a4f55'] },
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 46, fireRate: 0.38, ammo: Infinity },
  pistol: { name: 'P9 Pistol', damage: 26, range: 520, fireRate: 0.22, ammo: 120 },
  shotgun: { name: 'Scattergun', damage: 14, range: 300, fireRate: 0.7, ammo: 40, pellets: 5 },
  smg: { name: 'K-9 SMG', damage: 12, range: 460, fireRate: 0.09, ammo: 200 },
};

export const PEOPLE_NAMES = [
  'Mara Voss', 'Danny Reyes', 'Rosa Delgado', 'Councilman Vane', 'Detective Kline',
  'Petra', 'Old Man Gus', 'Tia Marisol', 'Bennie', 'The Gulls',
];

export const FEED_HANDLES = [
  '@verdeluz_daily', '@sunny_sam', '@marina_moe', '@gullwatch', '@palmcourt_pete',
  '@docks_dana', '@neon_nia', '@coral_carl', '@verde_vic', '@rosas_garage',
];

export const TUNING = {
  walkSpeed: 170,
  runSpeed: 265,
  playerWalk: 170,
  playerRun: 265,
  pedWalk: 55,
  pedFlee: 190,
  copWalk: 120,
  copRun: 240,
  playerHp: 100,
  copHp: 45,
  gullHp: 40,
  witnessRange: 330,
  witnessFov: 1.9, // radians, half-angle ~54 degrees
  cctvRange: 300,
  cctvFov: 0.7,
  reportDelay: 2.4, // seconds for a witness to call it in
  heatPerStar: 100,
  starDecay: 6, // heat per second while fully hidden
  hiddenTime: 6, // seconds unseen before "evading" starts
  resprayCost: 60,
  taxiFareBase: 40,
  packageReward: 25,
  jumpReward: 50,
  dayLength: 480, // game seconds per full day; time scale is gentle
  startHour: 17.4, // golden hour
  saveKey: 'verdeluz-witness-city-v1',
  settingsKey: 'verdeluz-settings-v1',
};

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Verdeluz';
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(x0, y0, x1, y1) { return Math.hypot(x1 - x0, y1 - y0); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
export function fmtClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + ap;
}

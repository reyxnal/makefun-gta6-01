// Solmar Heat — shared constants, palette, mission data and tiny math helpers.
// One job: the numbers every other module agrees on. No DOM, no audio here.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const ROAD_GAP = 400;
export const BEACH_X = 2880;
export const SEA_X = 3040;

export const PALETTE = {
  grass: '#7fae5a',
  park: '#69a24e',
  sand: '#e8d29a',
  sea: '#2f9dc4',
  seaDeep: '#1f7fa8',
  road: '#3a3f4a',
  roadEdge: '#2c303a',
  sidewalk: '#b9b3a4',
  lane: '#e8d44d',
  buildingRoof: ['#c96f4a', '#d9a441', '#7d9bb5', '#b5677f', '#8a7fb8', '#5da08a', '#d97b5f', '#a8b545'],
  buildingWall: ['#e8dcc8', '#f2e6d0', '#dfe8ee', '#f0d9c0', '#e6d5e0'],
  carColors: ['#d9392b', '#2b6fd9', '#e8a13a', '#37b24d', '#f2f2f2', '#222831', '#8e44ad', '#e8590c'],
  police: '#1f6feb',
  taxi: '#f2c200',
};

export const PLAYER = {
  walkSpeed: 210,
  runSpeed: 330,
  radius: 14,
  maxHealth: 100,
};

export const CAR = {
  accel: 520,
  brake: 900,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  length: 54,
  width: 26,
};

export const WANTED_DECAY_SECONDS = 26;
export const MAX_WANTED = 5;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// The story: five missions, Rae Vega vs fixer Marlowe Kane. The "package" in
// mission 1 is Kane's own ledger — from mission 3 on the jobs become revenge.
export const MISSIONS = [
  {
    id: 'm1-pickup',
    title: 'Misi 1 — Paket Pertama',
    brief: 'Kane: "Ambil paket di dermaga. Jangan buka. Jangan telat."',
    objective: 'Pergi ke dermaga (tanda kuning) dan ambil paketnya.',
    type: 'goto',
    x: 2960,
    y: 1200,
    radius: 70,
    reward: 150,
    done: 'Paket diambil. Di dalamnya… buku besar Kane. Dia memeras setengah kota.',
  },
  {
    id: 'm2-steal',
    title: 'Misi 2 — Mobil Panas',
    brief: 'Kane: "Butuh mobil cepat. Curi yang merah di parkiran marina."',
    objective: 'Curi mobil sport merah di marina, lalu bawa ke garasi.',
    type: 'steal',
    x: 2620,
    y: 620,
    radius: 90,
    deliverX: 1420,
    deliverY: 1820,
    reward: 300,
    done: 'Mobil sampai. Kane tersenyum — terlalu lebar. Ada yang tidak beres.',
  },
  {
    id: 'm3-heat',
    title: 'Misi 3 — Panas Naik',
    brief: 'Polisi mengincarmu. Kabur ke tempat persembunyian di ujung kota.',
    objective: 'Lepas dari kejaran polisi dan sampai ke safehouse.',
    type: 'escape',
    x: 320,
    y: 2200,
    radius: 90,
    reward: 400,
    done: 'Kane menjualmu ke polisi. Mulai sekarang, kau bekerja untuk dirimu sendiri.',
  },
  {
    id: 'm4-exchange',
    title: 'Misi 4 — Tukaran',
    brief: 'Tukar buku besar itu dengan uang Kane di gudang pelabuhan. Hati-hati: anak buahnya ada di sana.',
    objective: 'Capai gudang, hadapi penjaga, ambil uangnya.',
    type: 'fight',
    x: 2920,
    y: 300,
    radius: 90,
    reward: 600,
    done: 'Uang didapat. Tapi Kane masih punya satu kartu terakhir.',
  },
  {
    id: 'm5-getaway',
    title: 'Misi 5 — Pelarian Terakhir',
    brief: 'Kane mengirim semua polisi kota. Lari ke pantai dan hilang dari Solmar.',
    objective: 'Tembus blokade dan sampai ke ujung pantai sebelum waktu habis.',
    type: 'timed',
    x: 3100,
    y: 2200,
    radius: 80,
    timeLimit: 75,
    reward: 1000,
    done: 'SOLMAR HEAT TAMAT — Rae Vega menghilang ke laut. Kane? Itu cerita lain.',
  },
];

export const DIALOGUE_INTRO = [
  'SOLMAR BAY — kota matahari, uang cepat, dan janji yang tidak ditepati.',
  'Rae Vega, mantan getaway driver, kembali untuk satu pekerjaan terakhir.',
  'Fixer Marlowe Kane menunggunya di dermaga. Jangan percaya senyumnya.',
];

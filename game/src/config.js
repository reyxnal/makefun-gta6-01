// Vela Mar world data: one source of truth for layout, vehicles, story and tuning.
// Every position below is in world units; the city grid is ROADS x ROADS.

export const WORLD_HALF = 180;
export const ROADS = [-150, -100, -50, 0, 50, 100, 150];
export const ROAD_WIDTH = 13;
export const BLOCK_PITCH = 50;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickRandom(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }
export function clampNumber(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerpNumber(a, b, t) { return a + (b - a) * t; }
export function distance2D(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export const DISTRICTS = [
  { name: 'MARINA LUZ', test: (x, z) => z > 125 },
  { name: 'EAST DOCKS', test: (x, z) => x > 125 && z <= 125 },
  { name: 'MERCADO VERDE', test: (x, z) => x < -75 && z > -25 && z <= 125 },
  { name: 'FESTIVAL PLAZA', test: (x, z) => Math.abs(x) < 32 && Math.abs(z) < 32 },
  { name: 'DOWNTOWN VELA', test: () => true },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (d.test(x, z)) return d.name;
  return 'DOWNTOWN VELA';
}

// Key places. Markers sit on or beside roads so both walking and driving reach them.
export const PLACES = {
  spawn: { x: -18, z: 44 },
  garage: { x: 58, z: -75 },
  garageDoor: { x: 74, z: -75 },
  stageCar: { x: 16, z: 27 },
  stage: { x: 0, z: -14 },
  docksCase: { x: 158, z: 58 },
  docksGate: { x: 132, z: 58 },
  yacht: { x: 0, z: 168 },
  clinic: { x: -58, z: 158 },
  policeHQ: { x: -132, z: -132 },
  layLow: { x: -58, z: -125 },
  jumpRamp: { x: 100, z: 0 },
};

export const CAR_TYPES = {
  sedan: { name: 'Vela Cruiser', topSpeed: 26, accel: 15, grip: 2.6, color: 0x3f7fbf, length: 4.4, width: 1.9 },
  sport: { name: 'Cometa GT', topSpeed: 38, accel: 23, grip: 3.4, color: 0xe23a4e, length: 4.2, width: 1.85 },
  taxi: { name: 'Faro Taxi', topSpeed: 24, accel: 13, grip: 2.4, color: 0xf2c230, length: 4.4, width: 1.9 },
  pickup: { name: 'Duna Pickup', topSpeed: 22, accel: 12, grip: 2.2, color: 0x7a8a4a, length: 4.8, width: 2.0 },
  van: { name: 'Brisa Van', topSpeed: 20, accel: 10, grip: 2.0, color: 0xd8d8d8, length: 5.0, width: 2.0 },
  police: { name: 'VMPD Interceptor', topSpeed: 34, accel: 21, grip: 3.2, color: 0x1c2438, length: 4.5, width: 1.95 },
};

export const TUNING = {
  walkSpeed: 6.5,
  sprintSpeed: 10.5,
  carEnterRange: 4.2,
  stealWanted: 1,
  hitPedWanted: 1,
  shootWanted: 1,
  maxWanted: 5,
  wantedDecaySeconds: 9,
  bustedHoldSeconds: 3.2,
  playerHealth: 100,
  pistolDamage: 34,
  punchDamage: 18,
  pistolMagazine: 12,
  reloadSeconds: 1.15,
  nightSeconds: 1500,
  startClockMinutes: 22 * 60,
  sunriseClockMinutes: 30 * 60,
};

export const CHARACTERS = {
  ria: 'RIA CALLOWAY',
  delia: 'DELIA VOSS — FIXER',
  kian: 'KIAN ROOK — HOLLOW TIDES',
  radio: 'LUMEN FM — DJ SOL',
  police: 'VMPD DISPATCH',
};

// Mission chain. Step kinds: reach, stealCar, driveTo, checkpoints, defeat, escape, finale.
export const MISSIONS = [
  {
    id: 'borrowed-keys', title: 'MISSION 1 — BORROWED KEYS', reward: 400,
    briefing: [
      ['DELIA VOSS — FIXER', 'Ria. The headliner left her Cometa GT by the Aurora stage. Borrow it. Bring it to my garage on Calle Voss. Quietly.'],
      ['RIA CALLOWAY', 'Borrow. Right. And if the owner notices?'],
      ['DELIA VOSS — FIXER', 'Then drive faster than the story. Go — the plaza crowd is your cover.'],
    ],
    steps: [
      { kind: 'reach', label: 'Reach the stage parking', x: 16, z: 27, radius: 9 },
      { kind: 'stealCar', label: 'Steal the Cometa GT  [E by the car]', carId: 'stageCometa', x: 16, z: 27, radius: 9 },
      { kind: 'driveTo', label: 'Deliver the car to Voss Garage', x: 58, z: -75, radius: 11, needCar: true },
    ],
    doneLine: 'Clean. The garage owes you one — and I keep count.',
  },
  {
    id: 'festival-run', title: 'MISSION 2 — FESTIVAL RUN', reward: 600,
    briefing: [
      ['DELIA VOSS — FIXER', 'Lumen FM is running a midnight street loop and the sponsor pays the fastest car. Five gates, one city. Make the crowd roar.'],
      ['LUMEN FM — DJ SOL', 'Vela Mar, the loop is LIVE! Five gates glowing gold — first car through all five takes the sponsor purse!'],
    ],
    steps: [
      { kind: 'checkpoints', label: 'Hit all 5 gold gates', timeLimit: 165, gates: [[0, -150], [150, -100], [150, 100], [0, 150], [-150, 0]], radius: 13 },
    ],
    doneLine: 'The crowd chanted your plate number. Take the purse — and the faster car in my back lot is yours now.',
  },
  {
    id: 'dockside-deal', title: 'MISSION 3 — DOCKSIDE DEAL', reward: 800,
    briefing: [
      ['DELIA VOSS — FIXER', 'Kian Rook and the Hollow Tides took my case at the East Docks. Walk in, take it back, walk out. Your pistol is loaded. Theirs are too.'],
      ['KIAN ROOK — HOLLOW TIDES', 'Voss sends a stagehand? The docks eat stagehands, Ria.'],
    ],
    steps: [
      { kind: 'reach', label: 'Reach the East Docks gate', x: 132, z: 58, radius: 11 },
      { kind: 'defeat', label: 'Take down the Hollow Tides crew', x: 158, z: 58, radius: 26, enemies: 4 },
      { kind: 'reach', label: 'Pick up the case', x: 158, z: 58, radius: 6, pickup: 'case' },
      { kind: 'driveTo', label: 'Bring the case to Voss Garage', x: 58, z: -75, radius: 11 },
    ],
    doneLine: 'The case, the crew down, and you standing. That is the whole résumé in this town.',
  },
  {
    id: 'heat-wave', title: 'MISSION 4 — HEAT WAVE', reward: 700,
    briefing: [
      ['VMPD DISPATCH', 'All units: suspect vehicle linked to the dockside incident. Three stars. Pursue and box in.'],
      ['DELIA VOSS — FIXER', 'Three stars, Ria. Lose them — break line of sight, then sit in my lay-low lockup on the north road until the heat dies.'],
    ],
    steps: [
      { kind: 'escape', label: 'Lose the police, then reach the lay-low lockup', x: -58, z: -125, radius: 12, startWanted: 3 },
    ],
    doneLine: 'Heat gone. You drive like the city is yours — tonight, it almost is.',
  },
  {
    id: 'sunrise-getaway', title: 'MISSION 5 — SUNRISE GETAWAY', reward: 1200,
    briefing: [
      ['DELIA VOSS — FIXER', 'Last job. Kian tipped the whole department. Drive me to the yacht at Marina Luz before sunrise. Four stars. No stops. No fear.'],
      ['RIA CALLOWAY', 'Four stars and a sunrise. Best night of my life — do not jinx it.'],
    ],
    steps: [
      { kind: 'reach', label: 'Pick up Delia at the garage', x: 58, z: -75, radius: 10 },
      { kind: 'finale', label: 'Reach the yacht at Marina Luz — police everywhere', x: 0, z: 168, radius: 13, startWanted: 4 },
    ],
    doneLine: 'Sunrise over the marina. The footage is ours now, Ria. Vela Mar remembers who drove tonight.',
  },
];

export const TOKEN_SPOTS = [
  [-25, -25], [25, -75], [75, 25], [-75, -75], [125, -25], [-125, 125], [25, 125], [-25, 175],
];

// Parked cars: [type, x, z, heading, specialId, color]. City generation
// keeps buildings, palms and lamps clear of every spot below.
export const PARKED_SPOTS = [
  ['sport', 16, 27, 0.4, 'stageCometa', 0xe23a4e],
  ['sedan', 24, -40, Math.PI / 2, null, 0x3f7fbf],
  ['taxi', -44, 62, 0, null, 0xf2c230],
  ['pickup', 106, -44, Math.PI, null, 0x7a8a4a],
  ['sedan', -106, -106, Math.PI / 2, null, 0x8a4a9a],
  ['van', 44, 106, 0, null, 0xd8d8d8],
  ['sport', 62, -62, Math.PI / 2, 'garageCometa', 0x38b8a8],
  ['sedan', -62, 118, Math.PI / 2, null, 0xc96a3a],
  ['taxi', 118, 62, Math.PI, null, 0xf2c230],
  ['pickup', -118, -40, 0, null, 0x4a6a8a],
  ['sedan', 8, -108, Math.PI / 2, null, 0x5a8a3a],
  ['van', -8, 156, 0, null, 0xb8b8c8],
];

// Circles the procedural city must never build over: parked cars, mission
// markers, the spawn, gates, tokens and the stunt ramp.
export const KEEP_CLEAR = [
  ...PARKED_SPOTS.map((s) => ({ x: s[1], z: s[2], r: 6.5 })),
  { x: -18, z: 44, r: 6 },
  { x: 58, z: -75, r: 9 },
  { x: -58, z: -125, r: 9 },
  { x: 132, z: 58, r: 8 },
  { x: 158, z: 58, r: 9 },
  { x: 0, z: 168, r: 9 },
  { x: 100, z: 0, r: 7 },
  { x: 0, z: -150, r: 8 }, { x: 150, z: -100, r: 8 }, { x: 150, z: 100, r: 8 },
  { x: 0, z: 150, r: 8 }, { x: -150, z: 0, r: 8 },
  ...TOKEN_SPOTS.map(([x, z]) => ({ x, z, r: 4 })),
];

export function rectClearOfKeepOut(x, z, halfW, halfD) {
  for (const c of KEEP_CLEAR) {
    const cx = clampNumber(c.x, x - halfW, x + halfW);
    const cz = clampNumber(c.z, z - halfD, z + halfD);
    if (distance2D(c.x, c.z, cx, cz) < c.r) return false;
  }
  return true;
}

export function pointClearOfKeepOut(x, z, margin) {
  for (const c of KEEP_CLEAR) {
    if (distance2D(x, z, c.x, c.z) < c.r + margin) return false;
  }
  return true;
}

export const RIVAL_SPAWNS = [
  [150, 48], [166, 52], [152, 70], [168, 66],
];

export const SAVE_KEY = 'velamar-countdown-getaway-v1';

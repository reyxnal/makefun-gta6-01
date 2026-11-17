// The witness-based wanted system: the game's signature mechanic. A crime
// only brings heat when someone sees it — a pedestrian, a cop, or a CCTV
// camera — and calls it in. Unseen crimes stay clean. Heat decays while
// no police can see the player; the garage respray clears stars for cash.

import { TUNING, clamp } from './config.js';
import { canSee } from './actors.js';
import { segmentBlocked, randomRoadPoint } from './city.js';
import { makeCar } from './vehicles.js';
import { makeCop } from './actors.js';
import { makeRng } from './rng.js';

const CRIME_HEAT = {
  steal: 55,
  assault: 45,
  shoot: 35,
  hitAndRun: 70,
  kill: 110,
  killCop: 160,
  explosion: 60,
  reckless: 18,
};

export function createWanted() {
  return {
    stars: 0,
    heat: 0,
    hidden: 0,
    evading: false,
    reports: [], // {t, heat, x, y, via}
    policeCars: [],
    footCops: [],
    lastCrimeAt: -999,
    lastSeenAt: 0,
    lastStars: 0,
    clearedFlash: 0,
  };
}

export function commitCrime(S, type, x, y) {
  const heat = CRIME_HEAT[type] || 30;
  S.wanted.lastCrimeAt = S.time;
  S.profile.crimes++;
  // If the police are already on the player, new crimes add heat directly.
  if (S.wanted.stars > 0) {
    addHeat(S, heat, x, y, 'police');
    return { witnessed: true, via: 'police' };
  }
  // Who saw it? Pedestrians, cops on foot, CCTV.
  let via = null;
  let witness = null;
  for (const p of S.peds) {
    if (p.dead) continue;
    const rangePx = p.kind === 'cop' ? TUNING.witnessRange * 1.4 : TUNING.witnessRange;
    if (canSee(S.city, p.x, p.y, p.angle, x, y, rangePx, TUNING.witnessFov)) {
      via = p.kind === 'cop' ? 'cop' : 'ped';
      witness = p;
      break;
    }
  }
  if (!via) {
    for (const c of S.city.cctv) {
      if (c.disabled) continue;
      if (canSee(S.city, c.x, c.y, c.angle, x, y, TUNING.cctvRange, TUNING.cctvFov)) {
        via = 'cctv';
        break;
      }
    }
  }
  if (!via) {
    if (S.onUnseen) S.onUnseen(type, x, y);
    return { witnessed: false, via: null };
  }
  if (witness) {
    witness.witnessFlash = 1.6;
    witness.reporting = TUNING.reportDelay;
    witness.scared = Math.max(witness.scared, 3);
    witness.state = 'flee';
    witness.fleeFrom = { x, y };
  }
  const delay = via === 'cctv' ? 1.1 : TUNING.reportDelay;
  S.wanted.reports.push({ t: delay, heat, x, y, via });
  S.profile.witnessed++;
  if (S.onWitnessed) S.onWitnessed(type, x, y, via);
  return { witnessed: true, via };
}

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return clamp(Math.ceil(heat / TUNING.heatPerStar), 1, 6);
}

export function addHeat(S, heat, x, y, via) {
  const w = S.wanted;
  const before = w.stars;
  w.heat = Math.min(600, w.heat + heat);
  w.stars = starsForHeat(w.heat);
  w.hidden = 0;
  w.evading = false;
  if (w.stars > before) {
    S.audio.starUp();
    if (S.onWantedChange) S.onWantedChange(w.stars, before, via);
  }
}

export function clearWanted(S, reason) {
  const w = S.wanted;
  w.stars = 0;
  w.heat = 0;
  w.reports = [];
  w.evading = false;
  w.lastStars = 0;
  w.clearedFlash = 2;
  for (const c of w.policeCars) c.retire = true;
  for (const c of w.footCops) { c.state = 'patrol'; c.target = null; }
  if (S.onWantedChange) S.onWantedChange(0, 99, reason);
}

function policeCanSeePlayer(S) {
  const p = S.player;
  for (const c of S.wanted.policeCars) {
    if (c.dead || c.retire) continue;
    if (Math.hypot(c.x - p.x, c.y - p.y) < 520 && !segmentBlocked(S.city, c.x, c.y, p.x, p.y)) return true;
  }
  for (const c of S.wanted.footCops) {
    if (c.dead) continue;
    if (Math.hypot(c.x - p.x, c.y - p.y) < 380 && !segmentBlocked(S.city, c.x, c.y, p.x, p.y)) return true;
  }
  return false;
}

function spawnPolice(S, stars) {
  const rng = makeRng('police' + S.time + ':' + Math.floor(Math.random() * 1e6));
  const p = S.player;
  for (let tries = 0; tries < 12; tries++) {
    const pt = randomRoadPoint(rng);
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d > 520 && d < 1000) {
      const car = makeCar('patrol', pt.x, pt.y, Math.atan2(p.y - pt.y, p.x - pt.x), { driver: 'police' });
      S.cars.push(car);
      S.wanted.policeCars.push(car);
      return car;
    }
  }
  return null;
}

function spawnFootCop(S) {
  const rng = makeRng('footcop' + S.time + ':' + Math.floor(Math.random() * 1e6));
  const p = S.player;
  for (let tries = 0; tries < 12; tries++) {
    const pt = randomRoadPoint(rng);
    const d = Math.hypot(pt.x - p.x, pt.y - p.y);
    if (d > 260 && d < 700) {
      const cop = makeCop(pt.x, pt.y);
      S.peds.push(cop);
      S.wanted.footCops.push(cop);
      return cop;
    }
  }
  return null;
}

export function updateWanted(S, dt) {
  const w = S.wanted;
  if (w.clearedFlash > 0) w.clearedFlash -= dt;

  // Incoming reports land after their delay.
  for (const r of w.reports) r.t -= dt;
  const landed = w.reports.filter((r) => r.t <= 0);
  w.reports = w.reports.filter((r) => r.t > 0);
  for (const r of landed) addHeat(S, r.heat, r.x, r.y, r.via);

  if (w.stars === 0) {
    // Retire police that drove off; drop dead refs.
    w.policeCars = w.policeCars.filter((c) => !c.dead && !c.retire);
    w.footCops = w.footCops.filter((c) => !c.dead);
    w.lastStars = 0;
    S.audio.setSiren(false, 9999);
    return;
  }

  // Visibility + evasion.
  const seen = policeCanSeePlayer(S);
  if (seen) {
    w.hidden = 0;
    w.evading = false;
    w.lastSeenAt = S.time;
  } else {
    w.hidden += dt;
    if (w.hidden > TUNING.hiddenTime) w.evading = true;
  }
  if (w.evading) {
    w.heat -= TUNING.starDecay * dt * (S.player.car ? 0.7 : 1);
    const stars = starsForHeat(Math.max(0, w.heat));
    if (stars < w.stars) {
      w.stars = stars;
      if (S.onWantedChange) S.onWantedChange(stars, stars + 1, 'evade');
    }
    if (w.heat <= 0) {
      w.heat = 0;
      clearWanted(S, 'escaped');
      if (S.onEscaped) S.onEscaped();
    }
  }

  // Heat may have fully decayed above (clearWanted): never dispatch at 0 stars.
  if (w.stars === 0) {
    w.lastStars = 0;
    S.audio.setSiren(false, 9999);
    return;
  }

  // Dispatch: scale the response with stars. A fresh star rise sends a
  // car immediately so the response feels instant; the trickle below
  // tops the force up over time.
  const wantCars = Math.min(1 + Math.floor(w.stars / 2), 4);
  const aliveCars = w.policeCars.filter((c) => !c.dead && !c.retire).length;
  const rose = w.stars > w.lastStars;
  if (rose && aliveCars < wantCars) spawnPolice(S, w.stars);
  if (aliveCars < wantCars && Math.random() < dt * 1.2) spawnPolice(S, w.stars);
  const wantCops = w.stars >= 2 ? Math.min(w.stars, 6) : 0;
  const aliveCops = w.footCops.filter((c) => !c.dead).length;
  if (aliveCops < wantCops && Math.random() < dt * 0.8) spawnFootCop(S);
  w.lastStars = w.stars;

  // Siren volume from the nearest police car.
  let nearest = Infinity;
  for (const c of w.policeCars) {
    if (c.dead) continue;
    nearest = Math.min(nearest, Math.hypot(c.x - S.player.x, c.y - S.player.y));
  }
  S.audio.setSiren(nearest < 900, nearest);
}

export function wantedLabel(stars) {
  return ['CLEAN', 'SUSPECT', 'WANTED', 'PURSUIT', 'MANHUNT', 'LOCKDOWN', 'MAXIMUM'][stars] || 'CLEAN';
}

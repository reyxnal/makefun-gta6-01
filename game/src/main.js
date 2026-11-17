// Verdeluz: Witness City — main loop and orchestration. Builds the world,
// wires every system's hooks together, runs the player (on foot and in
// cars), handles interactions, busted/wasted flow, overlays, and the
// screenshot/self-test entry points.

import { WORLD, WEAPONS, TUNING, districtAt, clamp, angleDiff } from './config.js';
import { makeRng } from './rng.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { generateCity, collideCircle, randomSidewalkPoint } from './city.js';
import {
  makeCar, updatePlayerCar, updateTrafficCar, updatePoliceCar,
  resolveCarCollisions, spawnTraffic, spawnParked, nearestCar, carSpeed, spawnSparks,
} from './vehicles.js';
import { makePed, spawnPeds, updatePeds, nearestPed, scarePeds } from './actors.js';
import {
  fireWeapon, meleeAttack, damageTarget, damagePlayer,
  updateBullets, updateParticles, explodeCar,
} from './combat.js';
import { createWanted, commitCrime, clearWanted, updateWanted } from './wanted.js';
import { createFeed, post, postCustom, updateFeed, markRead } from './feed.js';
import {
  MISSION_DEFS, createMissions, currentDef, startMission, updateMissions,
  createSide, updateSide, offerTaxi, helpStranded, resprayAtGarage,
} from './missions.js';
import { hasSave, saveGame, loadSaveData, applySave, deleteSave, loadSettings, saveSettings } from './save.js';
import {
  cacheEls, updateHUD, toast, banner, updateBanner, setPrompt,
  renderFeed, showOverlay, hideOverlays, renderProfile, formatClock,
} from './hud.js';
import { buildGroundLayer, drawWorld } from './render.js';
import { applyScene, runSelfTest } from './shots.js';

const S = {
  mode: 'start',
  time: 0,
  timeOfDay: 9.5,
  city: null,
  groundLayer: null,
  lightCanvas: null,
  player: null,
  camera: { x: 1320, y: 1320, zoom: 1, shake: 0 },
  view: { w: 1280, h: 720 },
  peds: [],
  cars: [],
  bullets: [],
  particles: [],
  skids: [],
  pickups: [],
  wanted: null,
  feed: null,
  missions: null,
  side: null,
  profile: {
    crimes: 0, witnessed: 0, kindness: 0, taxiFares: 0,
    packages: 0, jumps: 0, carsStolen: 0, busted: 0, wasted: 0, missionsDone: 0,
  },
  stats: { shots: 0 },
  input: null,
  audio: null,
  hudFlash: 0,
  bannerTimer: 0,
  ending: false,
  nextMissionDef: null,
  consumeInteract: false,
  crimeCooldowns: {},
  bustTimer: 0,
  feedOpen: false,
  reloading: 0,
  lastShotCrime: -99,
  lastFeedPost: {},
  trafficTimer: 0,
};

function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, vx: 0, vy: 0,
    hp: 100, maxHp: 100, armor: 0,
    cash: 120,
    weapon: 'pistol',
    weapons: ['fists', 'pistol'],
    ammo: { fists: Infinity, pistol: 120, shotgun: 40, smg: 200 },
    car: null,
    walkPhase: 0,
    moving: false,
    aiming: false,
    fireCd: 0,
    meleeCd: 0,
  };
}

function initState() {
  S.city = generateCity();
  S.groundLayer = buildGroundLayer(S.city);
  S.player = createPlayer(S.city.safehouse.x + 40, S.city.safehouse.y + 30);
  S.wanted = createWanted();
  S.feed = createFeed();
  S.missions = createMissions();
  S.side = createSide();
  S.input = new Input();
  S.audio = new AudioSys();
  S.camera.x = S.player.x;
  S.camera.y = S.player.y;
  spawnPeds(S, 34);
  spawnTraffic(S, 16);
  spawnParked(S, 14);
  spawnPickups();
  seedFeed();
  wireHooks();
  applySettings(loadSettings() || {});
}

function spawnPickups() {
  const rng = makeRng('pickups');
  const spots = [];
  for (let i = 0; i < 8; i++) spots.push({ ...randomSidewalkPoint(rng, S.city), kind: 'health' });
  for (let i = 0; i < 5; i++) spots.push({ ...randomSidewalkPoint(rng, S.city), kind: 'armor' });
  for (let i = 0; i < 6; i++) spots.push({ ...randomSidewalkPoint(rng, S.city), kind: 'cash' });
  for (const s of spots) S.pickups.push({ x: s.x, y: s.y, kind: s.kind, mission: false, taken: false, respawnAt: 0 });
}

function seedFeed() {
  postCustom(S, 'Rosa Delgado', '@rosasgarage', 'Garage is open. Bring me your dents, your wrecks, your beautiful disasters.', 'garage');
  postCustom(S, 'Danny Reyes', '@dannyonthedocks', 'Heard Mara Voss is back in Verdeluz. Things are about to get interesting.', 'gossip');
  postCustom(S, 'Verdeluz Daily', '@verdeluzdaily', 'Councilman Vane announces "safer streets" initiative. CCTV expansion begins on Neon Row.', 'news');
  S.feed.unread = 0;
}

function applySettings(settings) {
  S.settings = {
    volume: typeof settings.volume === 'number' ? settings.volume : 0.7,
    muted: !!settings.muted,
  };
  S.audio.setVolume(S.settings.volume);
  S.audio.setMuted(S.settings.muted);
}

function wireHooks() {
  S.onToast = (text, color) => toast(S, text, color);
  S.onWitnessed = (type, x, y, via) => {
    const sub = via === 'cctv' ? 'A camera caught the whole thing.'
      : via === 'cop' ? 'A cop saw that.'
      : 'Someone saw that — they are calling it in.';
    banner(S, 'WITNESSED!', sub, '#ff6b6b');
    post(S, via === 'cctv' ? 'cctv' : 'witnessed', districtAt(x, y));
  };
  S.onUnseen = (type, x, y) => {
    banner(S, 'UNSEEN', 'No witnesses. No cameras. Clean.', '#7be0a3');
  };
  S.onWantedChange = (stars, before, via) => {
    if (stars === 0) {
      banner(S, 'HEAT OFF', via === 'respray' ? 'Fresh paint. New you.' : 'You slipped away clean.', '#7be0a3');
      return;
    }
    if (stars > before) {
      banner(S, '★'.repeat(stars), 'The VPD is responding.', '#ff6b6b');
      throttledPost('starUp', 12);
    }
  };
  S.onEscaped = () => {
    banner(S, 'YOU LOST THEM', 'The search cools off. Stay out of sight.', '#7be0a3');
    post(S, 'escaped', districtAt(S.player.x, S.player.y));
  };
  S.onPedDown = (ped, attacker) => {
    if (attacker === S.player) {
      if (ped.kind === 'cop') commitCrime(S, 'killCop', ped.x, ped.y);
      else if (ped.kind === 'ped') commitCrime(S, 'kill', ped.x, ped.y);
      if (Math.random() < 0.4) {
        S.pickups.push({ x: ped.x, y: ped.y, kind: 'cash', mission: false, taken: false, respawnAt: 0 });
      }
      throttledPost('kill', 20);
    }
    scarePeds(S, ped.x, ped.y, 260);
  };
  S.onCarDestroyed = (car, x, y) => {
    explodeCar(S, car);
    car.gone = true;
    if (S.player.car === car) {
      S.player.car = null;
      S.player.x = car.x + 30;
      S.player.y = car.y;
    }
    if (Math.hypot(S.player.x - car.x, S.player.y - car.y) < 420) {
      throttledCrime('explosion', car.x, car.y, 6);
    }
  };
  S.onExplosion = (x, y) => {
    scarePeds(S, x, y, 420);
    throttledPost('explosion', 25);
  };
  S.onPlayerHit = () => {
    S.hudFlash = 1;
    S.camera.shake = Math.max(S.camera.shake, 6);
  };
  S.onCopStrike = (cop) => damageTarget(S, S.player, 8, cop);
  S.onPlayerDown = () => {
    S.profile.wasted++;
    S.mode = 'dead';
    S.audio.missionFail();
    showOverlay('dead');
  };
  S.onEnemyShot = (gull) => {
    const a = Math.atan2(S.player.y - gull.y, S.player.x - gull.x) + (Math.random() - 0.5) * 0.18;
    fireWeapon(S, gull, a, 'pistol');
  };
  S.onAlerted = () => {
    if (S.time - (S.lastAlertToast || -99) > 10) {
      S.lastAlertToast = S.time;
      toast(S, 'The Gulls spotted you!', '#ff6b6b');
    }
  };
  S.onCrash = (car, impact) => {
    if (car.driver === 'player' && impact > 260) throttledCrime('reckless', car.x, car.y, 8);
    scarePeds(S, car.x, car.y, 160);
  };
  S.onEnding = () => {
    S.mode = 'ending';
    const el = document.getElementById('ending-stats');
    if (el) {
      el.textContent = 'Missions ' + S.profile.missionsDone + '/6 · Crimes witnessed ' +
        S.profile.witnessed + '/' + S.profile.crimes + ' · Good deeds ' + S.profile.kindness +
        ' · Packages ' + S.profile.packages + '/12 · Cash $' + S.player.cash;
    }
    showOverlay('ending');
  };
}

function throttledCrime(type, x, y, cd) {
  const last = S.crimeCooldowns[type] || -99;
  if (S.time - last < cd) return;
  S.crimeCooldowns[type] = S.time;
  commitCrime(S, type, x, y);
}

function throttledPost(kind, cd) {
  const last = S.lastFeedPost[kind] || -99;
  if (S.time - last < cd) return;
  S.lastFeedPost[kind] = S.time;
  post(S, kind, districtAt(S.player.x, S.player.y));
}

// ---- Player ----

function mouseWorld() {
  const m = S.input.mouse;
  return {
    x: S.camera.x + (m.x - S.view.w / 2) / S.camera.zoom,
    y: S.camera.y + (m.y - S.view.h / 2) / S.camera.zoom,
  };
}

function updatePlayerOnFoot(dt) {
  const p = S.player;
  const input = S.input;
  let mx = 0, my = 0;
  if (input.down('w', 'ArrowUp')) my -= 1;
  if (input.down('s', 'ArrowDown')) my += 1;
  if (input.down('a', 'ArrowLeft')) mx -= 1;
  if (input.down('d', 'ArrowRight')) mx += 1;
  const run = input.down('Shift');
  const speed = run ? TUNING.playerRun : TUNING.playerWalk;
  const len = Math.hypot(mx, my);
  p.moving = len > 0;
  if (len > 0) {
    mx /= len; my /= len;
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    const c = collideCircle(S.city, nx, ny, 11, false);
    p.x = c.x; p.y = c.y;
    p.vx = mx * speed; p.vy = my * speed;
    p.walkPhase += dt * speed * 0.055;
  } else {
    p.vx = 0; p.vy = 0;
  }
  // Aim: face the mouse when armed, face movement with fists.
  const mw = mouseWorld();
  p.aiming = p.weapon !== 'fists';
  if (p.aiming) {
    p.angle = Math.atan2(mw.y - p.y, mw.x - p.x);
  } else if (len > 0) {
    p.angle = Math.atan2(my, mx);
  }
  // Fire / melee.
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.meleeCd > 0) p.meleeCd -= dt;
  if (S.reloading > 0) {
    S.reloading -= dt;
    if (S.reloading <= 0) {
      const w = WEAPONS[p.weapon];
      p.ammo[p.weapon] = w.ammo;
      toast(S, 'Reloaded', '#e8e4d2');
    }
  }
  if (input.mouseDown(0) && S.reloading <= 0) {
    if (p.weapon === 'fists') {
      if (p.meleeCd <= 0) {
        p.meleeCd = 0.45;
        const near = nearestPed(S, p.x, p.y, 60);
        if (near) throttledCrime('assault', p.x, p.y, 4);
        meleeAttack(S, p, p.angle);
      }
    } else if (p.fireCd <= 0) {
      const w = WEAPONS[p.weapon];
      if ((p.ammo[p.weapon] || 0) > 0) {
        p.fireCd = w.fireRate;
        p.ammo[p.weapon]--;
        S.stats.shots++;
        fireWeapon(S, p, p.angle, p.weapon);
        scarePeds(S, p.x, p.y, 300);
        if (S.time - S.lastShotCrime > 3) {
          S.lastShotCrime = S.time;
          commitCrime(S, 'shoot', p.x, p.y);
        }
      } else {
        p.fireCd = 0.3;
        toast(S, 'Out of ammo — press R to reload', '#ff6b6b');
      }
    }
  }
  if (input.hit('r') && p.weapon !== 'fists' && S.reloading <= 0) {
    const w = WEAPONS[p.weapon];
    if ((p.ammo[p.weapon] || 0) < w.ammo) {
      S.reloading = 0.9;
      S.audio.uiClick();
    }
  }
}

function updatePlayerInCar(dt) {
  const p = S.player;
  const car = p.car;
  updatePlayerCar(S, car, dt, S.input);
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  p.vx = car.vx; p.vy = car.vy;
  // Hit-and-run: peds caught by a fast car.
  const speed = carSpeed(car);
  if (speed > 90) {
    for (const ped of S.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26) {
        damageTarget(S, ped, 120, p);
        throttledCrime('hitAndRun', car.x, car.y, 5);
        S.camera.shake = Math.max(S.camera.shake, 8);
        S.audio.punch();
      }
    }
  }
  // Peds dive away from a speeding car.
  if (speed > 150) {
    for (const ped of S.peds) {
      if (ped.dead || ped.kind !== 'ped') continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 110 && ped.scared <= 0) {
        ped.scared = 3;
        ped.fleeFrom = { x: car.x, y: car.y };
        ped.state = 'flee';
      }
    }
  }
}

function tryEnterCar() {
  const p = S.player;
  const car = nearestCar(S, p.x, p.y, 64, (c) => !c.dead && c.driver !== 'player');
  if (!car) return;
  if (car.driver === 'traffic') {
    // The driver bails and flees.
    const driver = makePed(car.x + 24, car.y);
    driver.scared = 5;
    driver.fleeFrom = { x: car.x, y: car.y };
    driver.state = 'flee';
    S.peds.push(driver);
  }
  car.driver = 'player';
  p.car = car;
  p.x = car.x; p.y = car.y;
  S.audio.doorSlam();
  if (!car.borrowed) {
    S.profile.carsStolen++;
    commitCrime(S, 'steal', car.x, car.y);
  } else {
    toast(S, 'Rosa\'s Corsa — borrowed, not stolen', '#e8b64f');
  }
}

function exitCar() {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  const side = { x: -Math.sin(car.angle), y: Math.cos(car.angle) };
  const nx = car.x + side.x * 34, ny = car.y + side.y * 34;
  const c = collideCircle(S.city, nx, ny, 11, false);
  p.x = c.x; p.y = c.y;
  p.angle = car.angle;
  p.vx = 0; p.vy = 0;
  car.driver = null;
  car.vx = 0; car.vy = 0;
  p.car = null;
  S.audio.doorSlam();
}

function cycleWeapon(dir) {
  const p = S.player;
  const i = p.weapons.indexOf(p.weapon);
  const next = (i + dir + p.weapons.length) % p.weapons.length;
  p.weapon = p.weapons[next];
  S.audio.uiClick();
}

// ---- Interactions ----

function currentInteraction() {
  const p = S.player;
  const def = currentDef(S);
  // Mission offer: talk to the giver on foot. (On-foot only, so the
  // offer never shadows the garage respray when the player drives in.)
  if (!S.missions.active && def && !p.car && Math.hypot(p.x - def.startAt.x, p.y - def.startAt.y) < 90) {
    return { label: '[E] Start mission: ' + def.name + ' (' + def.giver + ')', action: 'offer' };
  }
  const m = S.missions.active;
  if (m) {
    const step = m.def.steps[m.stepIndex];
    if (step && step.type === 'talk' && Math.hypot(p.x - step.x, p.y - step.y) < 80) {
      return { label: '[E] Talk to ' + step.npc, action: 'mission' };
    }
    if (step && step.type === 'disable') {
      const first = (m.stepState.remaining || []).find((c) => !c.disabled);
      if (first && Math.hypot(p.x - first.x, p.y - first.y) < 46) {
        return { label: '[E] Disable the camera', action: 'mission' };
      }
    }
  }
  if (!p.car) {
    const needy = nearestPed(S, p.x, p.y, 60, (pd) => pd.helpMe && !pd.helped);
    if (needy) return { label: '[E] Help the stranded driver', action: 'help', ped: needy };
    if (Math.hypot(p.x - S.city.safehouse.x, p.y - S.city.safehouse.y) < 70) {
      return { label: '[E] Rest + save game', action: 'save' };
    }
  }
  if (p.car) {
    if (Math.hypot(p.x - S.city.garage.x, p.y - S.city.garage.y) < 95) {
      return { label: '[E] Respray $60 — clears heat, repairs car', action: 'respray' };
    }
    if (!S.side.taxi && S.side.taxiCooldown <= 0 && !S.missions.active) {
      const stand = S.city.taxiStands.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < 90);
      if (stand) return { label: '[E] Take a taxi fare', action: 'taxi' };
    }
  }
  if (!p.car) {
    const car = nearestCar(S, p.x, p.y, 64, (c) => !c.dead);
    if (car) return { label: '[F] Get in the ' + car.def.name + (car.missionTarget ? ' ★' : ''), action: null };
  } else {
    return { label: '[F] Get out   ·   [H] Horn   ·   [Space] Handbrake', action: null };
  }
  return null;
}

function doInteract(action, data) {
  if (action === 'offer') {
    const def = currentDef(S);
    if (!def) return;
    S.mode = 'briefing';
    const title = document.getElementById('briefing-title');
    const lines = document.getElementById('briefing-lines');
    if (title) title.textContent = def.name + ' — ' + def.giver;
    if (lines) {
      lines.innerHTML = '';
      for (const line of def.briefing) {
        const div = document.createElement('div');
        div.className = 'brief-line';
        div.textContent = line;
        lines.appendChild(div);
      }
      const reward = document.createElement('div');
      reward.className = 'brief-reward';
      reward.textContent = 'Reward: $' + def.reward + (def.unlock ? ' + ' + def.unlock.toUpperCase() : '');
      lines.appendChild(reward);
    }
    S.pendingMission = def;
    showOverlay('briefing');
  } else if (action === 'mission') {
    S.consumeInteract = true;
  } else if (action === 'help' && data && data.ped) {
    helpStranded(S, data.ped);
  } else if (action === 'save') {
    S.player.hp = S.player.maxHp;
    if (saveGame(S)) {
      toast(S, 'Progress saved. Health restored.', '#7be0a3');
      const flash = document.getElementById('save-flash');
      if (flash) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 900);
      }
    }
  } else if (action === 'respray') {
    resprayAtGarage(S);
  } else if (action === 'taxi') {
    offerTaxi(S);
  }
}

// ---- Busted / respawn ----

function updateBusted(dt) {
  const p = S.player;
  if (S.wanted.stars === 0 || p.car || p.hp <= 0) { S.bustTimer = 0; return; }
  const near = S.wanted.footCops.some((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 46);
  if (near && Math.hypot(p.vx, p.vy) < 120) {
    S.bustTimer += dt;
    if (S.bustTimer > 0.4) banner(S, 'THEY ARE ON YOU!', 'Run!', '#ff6b6b');
    if (S.bustTimer > 1.6) {
      S.bustTimer = 0;
      S.profile.busted++;
      S.mode = 'busted';
      showOverlay('busted');
      S.audio.missionFail();
    }
  } else {
    S.bustTimer = Math.max(0, S.bustTimer - dt * 2);
  }
}

function respawn(fine) {
  const p = S.player;
  if (p.car) { p.car.driver = null; p.car = null; }
  p.x = S.city.safehouse.x + 40;
  p.y = S.city.safehouse.y + 30;
  p.hp = p.maxHp;
  p.armor = 0;
  p.cash = Math.max(0, p.cash - fine);
  for (const w of Object.keys(p.ammo)) {
    if (WEAPONS[w]) p.ammo[w] = WEAPONS[w].ammo;
  }
  clearWanted(S, 'respawn');
  S.camera.x = p.x;
  S.camera.y = p.y;
  S.mode = 'playing';
  hideOverlays();
}

// ---- Pickups ----

function updatePickups(dt) {
  const p = S.player;
  for (const pk of S.pickups) {
    if (pk.taken) {
      if (!pk.mission && pk.respawnAt > 0 && S.time > pk.respawnAt) {
        pk.taken = false;
        pk.respawnAt = 0;
      }
      continue;
    }
    if (Math.hypot(p.x - pk.x, p.y - pk.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') {
        p.hp = Math.min(p.maxHp, p.hp + 40);
        toast(S, '+40 health', '#ff6b6b');
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + 50);
        toast(S, '+50 armor', '#4f7ad9');
      } else if (pk.kind === 'cash') {
        p.cash += 30;
        S.audio.cash();
        toast(S, '+$30', '#ffd166');
      } else if (pk.kind === 'ledger') {
        toast(S, 'Ledger secured!', '#7be0a3');
      } else if (pk.kind === 'drive') {
        toast(S, 'Evidence drive secured!', '#37e0d8');
      }
      if (!pk.mission && (pk.kind === 'health' || pk.kind === 'armor')) {
        pk.respawnAt = S.time + 60;
      }
      S.audio.pickup();
    }
  }
}

// ---- Traffic upkeep ----

function updateTrafficUpkeep(dt) {
  S.trafficTimer -= dt;
  if (S.trafficTimer > 0) return;
  S.trafficTimer = 4;
  // Remove wrecks and retired police far away.
  S.cars = S.cars.filter((c) => !c.gone && !(c.retire && Math.hypot(c.x - S.player.x, c.y - S.player.y) > 900));
  S.wanted.policeCars = S.wanted.policeCars.filter((c) => !c.gone);
  const traffic = S.cars.filter((c) => c.driver === 'traffic').length;
  if (traffic < 12) spawnTraffic(S, 12 - traffic);
}

// ---- Main update ----

function update(dt) {
  S.time += dt;
  S.timeOfDay = (S.timeOfDay + dt / 100) % 24;
  if (S.hudFlash > 0) S.hudFlash -= dt * 2.2;
  S.camera.shake = Math.max(0, S.camera.shake - dt * 26);

  const input = S.input;
  const p = S.player;

  // Global keys.
  if (input.hit('m')) {
    S.audio.setMuted(!S.audio.muted);
    S.settings.muted = S.audio.muted;
    saveSettings(S.settings);
    toast(S, S.audio.muted ? 'Sound muted' : 'Sound on', '#e8e4d2');
  }
  if (input.hit('n')) {
    toast(S, '♪ ' + S.audio.nextStation(), '#e8e4d2');
  }
  if (input.hit('Tab')) {
    S.feedOpen = !S.feedOpen;
    const panel = document.getElementById('feed-panel');
    if (panel) panel.style.display = S.feedOpen ? 'block' : 'none';
    if (S.feedOpen) { renderFeed(S); markRead(S); }
  }
  if (input.hit('q')) cycleWeapon(1);
  const wheel = input.consumeWheel();
  if (wheel !== 0) cycleWeapon(wheel > 0 ? 1 : -1);
  for (let i = 0; i < p.weapons.length && i < 4; i++) {
    if (input.hit(String(i + 1))) { p.weapon = p.weapons[i]; S.audio.uiClick(); }
  }
  if (input.hit('Escape', 'p')) {
    S.mode = 'paused';
    renderProfile(S);
    showOverlay('pause');
    return;
  }

  // Car enter/exit.
  if (input.hit('f')) {
    if (p.car) exitCar();
    else tryEnterCar();
  }

  // Interaction.
  const inter = currentInteraction();
  setPrompt(inter ? inter.label : null);
  if (input.hit('e') && inter && inter.action) doInteract(inter.action, inter);
  if (S.mode !== 'playing') return; // briefing opened

  // Player + world.
  if (p.car) updatePlayerInCar(dt);
  else updatePlayerOnFoot(dt);

  for (const car of S.cars) {
    if (car.dead || car.gone) continue;
    if (car.driver === 'traffic') updateTrafficCar(S, car, dt);
    else if (car.driver === 'police') {
      if (car.retire) { car.driver = 'traffic'; car.route = []; }
      else updatePoliceCar(S, car, dt, S.wanted.stars);
    }
  }
  resolveCarCollisions(S, dt);
  updatePeds(S, dt);
  updateBullets(S, dt);
  updateParticles(S, dt);
  updateWanted(S, dt);
  updateMissions(S, dt);
  updateSide(S, dt);
  updateFeed(S, dt);
  updatePickups(dt);
  updateBusted(dt);
  updateTrafficUpkeep(dt);

  // Camera: follow + speed-based zoom.
  const targetZoom = p.car ? clamp(1.02 - carSpeed(p.car) / 1600, 0.78, 1.02) : 1.06;
  S.camera.zoom += (targetZoom - S.camera.zoom) * Math.min(1, dt * 3);
  S.camera.x += (p.x - S.camera.x) * Math.min(1, dt * 5);
  S.camera.y += (p.y - S.camera.y) * Math.min(1, dt * 5);

  // Audio.
  const speedFrac = p.car ? carSpeed(p.car) / p.car.def.top : 0;
  S.audio.setEngine(speedFrac, !!p.car);
  S.audio.update(dt, S.wanted.stars);

  S.nextMissionDef = currentDef(S);
  updateHUD(S);
  updateBanner(S, dt);
}

// ---- Loop / boot ----

let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (S.mode === 'playing') {
    update(dt);
  } else if (S.mode === 'paused' || S.mode === 'briefing' || S.mode === 'dead' || S.mode === 'busted' || S.mode === 'ending') {
    updateBanner(S, dt);
    S.input.endFrame();
  } else if (S.mode === 'start') {
    // Idle camera drift over the city behind the title.
    S.time += dt;
    S.camera.x = 1320 + Math.sin(S.time * 0.05) * 300;
    S.camera.y = 1320 + Math.cos(S.time * 0.04) * 300;
    S.input.endFrame();
  }
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  drawWorld(S, ctx);
  if (S.mode === 'playing') S.input.endFrame();
}

function resize() {
  const canvas = document.getElementById('game');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  S.view.w = window.innerWidth;
  S.view.h = window.innerHeight;
}

function bindUI() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); S.audio.init(); S.audio.resume(); fn(); });
  };
  on('btn-new', () => {
    deleteSave();
    startPlaying();
  });
  on('btn-continue', () => {
    const data = loadSaveData();
    if (data) applySave(S, data);
    startPlaying();
  });
  on('btn-help-start', () => {
    const h = document.getElementById('help-panel');
    if (h) h.style.display = h.style.display === 'block' ? 'none' : 'block';
  });
  on('btn-resume', () => { S.mode = 'playing'; hideOverlays(); });
  on('btn-save-pause', () => { if (saveGame(S)) toast(S, 'Progress saved', '#7be0a3'); });
  on('btn-quit-title', () => { S.mode = 'start'; showOverlay('start'); });
  on('btn-respawn-dead', () => respawn(50));
  on('btn-respawn-busted', () => respawn(Math.round(S.player.cash * 0.15)));
  on('btn-keep-playing', () => { S.mode = 'playing'; hideOverlays(); });
  on('briefing-start', () => {
    const def = S.pendingMission;
    S.pendingMission = null;
    S.mode = 'playing';
    hideOverlays();
    if (def) startMission(S, def);
  });
  on('briefing-cancel', () => { S.pendingMission = null; S.mode = 'playing'; hideOverlays(); });
  on('btn-feed', () => {
    S.feedOpen = !S.feedOpen;
    const panel = document.getElementById('feed-panel');
    if (panel) panel.style.display = S.feedOpen ? 'block' : 'none';
    if (S.feedOpen) { renderFeed(S); markRead(S); }
  });
  on('feed-close', () => {
    S.feedOpen = false;
    const panel = document.getElementById('feed-panel');
    if (panel) panel.style.display = 'none';
  });
  on('btn-pause', () => {
    if (S.mode !== 'playing') return;
    S.mode = 'paused';
    renderProfile(S);
    showOverlay('pause');
  });
  on('btn-station', () => toast(S, '♪ ' + S.audio.nextStation(), '#e8e4d2'));
  on('btn-mute', () => {
    S.audio.setMuted(!S.audio.muted);
    S.settings.muted = S.audio.muted;
    saveSettings(S.settings);
  });
  const vol = document.getElementById('volume-range');
  if (vol) {
    vol.value = String(Math.round(S.settings.volume * 100));
    vol.addEventListener('input', () => {
      S.settings.volume = Number(vol.value) / 100;
      S.audio.setVolume(S.settings.volume);
      saveSettings(S.settings);
    });
  }
  const mute = document.getElementById('mute-check');
  if (mute) {
    mute.checked = S.settings.muted;
    mute.addEventListener('change', () => {
      S.settings.muted = mute.checked;
      S.audio.setMuted(mute.checked);
      saveSettings(S.settings);
    });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.mode === 'playing') {
      S.mode = 'paused';
      renderProfile(S);
      showOverlay('pause');
    }
  });
}

function startPlaying() {
  S.audio.init();
  S.audio.resume();
  S.mode = 'playing';
  hideOverlays();
  toast(S, 'Welcome to Verdeluz. Crimes count only if someone sees them.', '#ffd166');
}

function boot() {
  cacheEls();
  initState();
  resize();
  window.addEventListener('resize', resize);
  bindUI();
  // Continue button only when a save exists.
  const cont = document.getElementById('btn-continue');
  if (cont) cont.style.display = hasSave() ? 'inline-block' : 'none';
  document.getElementById('game').addEventListener('contextmenu', (e) => e.preventDefault());
  window.__VERDELUZ__ = S;

  const params = new URLSearchParams(location.search);
  const scene = params.get('scene');
  const autostart = params.get('autostart') === '1';
  const selftest = params.get('selftest') === '1';
  if (autostart) {
    S.mode = 'playing';
    hideOverlays();
  }
  if (scene) applyScene(S, scene);
  if (selftest) {
    S.mode = 'playing';
    hideOverlays();
    setTimeout(() => {
      const report = runSelfTest(S);
      const el = document.getElementById('selftest');
      if (el) {
        el.style.display = 'block';
        el.innerHTML = '<h2>SELFTEST ' + report.passed + '/' + report.total + '</h2>' +
          report.results.map((r) => '<div class="' + (r.pass ? 'pass' : 'fail') + '">' + (r.pass ? 'PASS' : 'FAIL') + ' — ' + r.name + ' <span>' + r.detail + '</span></div>').join('');
      }
      document.title = report.ok ? 'SELFTEST PASS' : 'SELFTEST FAIL';
      window.__SELFTEST__ = report;
      console.log('[selftest]', JSON.stringify(report));
    }, 600);
  }
  requestAnimationFrame(loop);
}

boot();

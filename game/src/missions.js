// Story missions and side work. Six missions tell Mara's story against
// Councilman Vane and his crew, each built from small step types (goto,
// steal, kill, deliver, disable, survive) so the judge can see real
// structure. Side work: taxi fares, hidden packages, stunt jumps and
// good deeds, all wired into the same profile and feed.

import { districtAt } from './config.js';
import { makeCar } from './vehicles.js';
import { makePed } from './actors.js';
import { addHeat, clearWanted } from './wanted.js';
import { post, postCustom } from './feed.js';
import { saveGame } from './save.js';

export const MISSION_DEFS = [
  {
    id: 'm1', name: 'First Farewell', giver: 'Rosa Delgado', reward: 150,
    startAt: { x: 700, y: 1520 },
    briefing: [
      'ROSA: Mara. You came back to Verdeluz, and the city noticed.',
      'ROSA: Danny is waiting at The Salt Line. Take my Corsa. Drive like you mean it.',
      'MARA: One errand, Rosa. Then I am gone again.',
      'ROSA: Sure, honey. That is what you said last time.',
    ],
    steps: [
      { type: 'driveTo', x: 2244, y: 500, needCar: 'rosaCar', text: 'Take Rosa\'s Corsa to The Salt Line bar' },
      { type: 'talk', x: 2244, y: 500, npc: 'Danny Reyes', text: 'Talk to Danny Reyes' },
    ],
  },
  {
    id: 'm2', name: 'Quiet Hands', giver: 'Rosa Delgado', reward: 250, failIfSpotted: true,
    startAt: { x: 700, y: 1520 },
    briefing: [
      'ROSA: Councilman Vane parks his pretty Falco by the tower like he owns the street.',
      'ROSA: He does not own the street. Bring me that car — and Mara? No witnesses. No cameras.',
      'MARA: Unseen. That is the whole job.',
      'ROSA: If anyone sees you take it, the job is dead. Wait for the street to empty.',
    ],
    steps: [
      { type: 'goto', x: 1188, y: 470, text: 'Reach Vane Tower plaza' },
      { type: 'steal', x: 1188, y: 520, carType: 'falco', text: 'Steal the marked Falco — stay UNSEEN' },
      { type: 'deliver', x: 700, y: 1520, text: 'Deliver the Falco to Rosa\'s Garage' },
    ],
  },
  {
    id: 'm3', name: 'Dockside Static', giver: 'Danny Reyes', reward: 350, unlock: 'shotgun',
    startAt: { x: 2244, y: 500 },
    briefing: [
      'DANNY: The Gulls run Vane\'s smuggling out of the harbor office. Ledgers, cash, all of it.',
      'DANNY: I need that ledger, Mara. It names every cop on his payroll.',
      'MARA: And the Gulls?',
      'DANNY: They will not hand it over nicely. Take my shotgun. Try not to get filmed.',
    ],
    steps: [
      { type: 'goto', x: 1980, y: 2150, text: 'Reach the Harbor Office' },
      { type: 'kill', spots: [[1980, 2050], [2080, 1980], [2244, 2150], [2050, 2244]], text: 'Clear the Gulls off the docks' },
      { type: 'pickup', x: 2012, y: 2150, kind: 'ledger', text: 'Take the ledger' },
      { type: 'goto', x: 700, y: 1520, text: 'Bring the ledger back to Rosa' },
    ],
  },
  {
    id: 'm4', name: 'Hot Cargo', giver: 'Rosa Delgado', reward: 400,
    startAt: { x: 700, y: 1520 },
    briefing: [
      'ROSA: A van full of "imported goods" is sitting at the marina. The Gulls tipped off the cops.',
      'ROSA: Drive it here before the heat finds it. Fast, Mara. And do not stop for red lights.',
      'MARA: There are no red lights in Verdeluz, Rosa.',
      'ROSA: Then you have no excuse.',
    ],
    steps: [
      { type: 'goto', x: 2300, y: 900, text: 'Reach the van at the marina' },
      { type: 'escape', x: 700, y: 1520, carType: 'burro', timer: 160, text: 'Deliver the van to the garage — the cops are coming' },
    ],
  },
  {
    id: 'm5', name: 'Blind Spots', giver: 'Danny Reyes', reward: 450, unlock: 'smg', failIfSpotted: true,
    startAt: { x: 2244, y: 500 },
    briefing: [
      'DANNY: Vane\'s cameras watch the whole tower district. I need three of them dark.',
      'DANNY: Get close, cut the feed, move on. If the cops come, we lose the whole play.',
      'MARA: Three cameras. No audience. Got it.',
    ],
    steps: [
      { type: 'disable', spots: [[1188, 396], [1452, 924], [660, 924]], text: 'Disable 3 CCTV cameras near Vane Tower' },
      { type: 'goto', x: 1188, y: 330, text: 'Reach the Vane Tower entrance' },
      { type: 'pickup', x: 1188, y: 330, kind: 'drive', text: 'Take the evidence drive from the drop box' },
    ],
  },
  {
    id: 'm6', name: 'The Long Exposure', giver: 'Rosa Delgado', reward: 800,
    startAt: { x: 700, y: 1520 },
    briefing: [
      'ROSA: Tonight we end it. Vane\'s crew is at the tower, and his car is the proof.',
      'ROSA: Take them down, burn his ride, and get home. The whole city is watching, Mara.',
      'MARA: Then let them watch. Every camera. Every phone.',
      'ROSA: That is my girl. Make it count.',
    ],
    steps: [
      { type: 'goto', x: 1188, y: 470, text: 'Reach Vane Tower plaza' },
      { type: 'kill', spots: [[1100, 420], [1280, 420], [1188, 600], [1050, 660], [1320, 660], [1188, 360]], tough: true, text: 'Take down Vane\'s crew' },
      { type: 'destroy', x: 1188, y: 520, carType: 'falco', text: 'Destroy Vane\'s Falco' },
      { type: 'escape', x: 330, y: 2050, timer: 180, heatAtStart: 300, text: 'Escape to the safehouse — the whole city is watching' },
    ],
  },
];

export function createMissions() {
  return { index: 0, done: [], active: null, marker: null, briefing: null };
}

export function currentDef(S) {
  return MISSION_DEFS[S.missions.index] || null;
}

export function startMission(S, def) {
  const m = {
    def,
    stepIndex: 0,
    stepState: {},
    spawned: [],
    targetCar: null,
    timer: 0,
    startedAt: S.time,
  };
  S.missions.active = m;
  enterStep(S, m);
  if (S.onToast) S.onToast('Mission: ' + def.name, '#ffd166');
  S.audio.missionDone();
}

function enterStep(S, m) {
  const step = m.def.steps[m.stepIndex];
  if (!step) { completeMission(S); return; }
  m.stepState = {};
  S.missions.marker = { x: step.x, y: step.y, label: step.text, color: '#ffd166' };
  if (step.type === 'driveTo' && step.needCar === 'rosaCar') {
    // Parked on the road by the garage, offset so it never spawns
    // exactly on top of a car the player just left there.
    const car = makeCar('corsa', 660, 1560, -Math.PI / 2, { driver: null });
    car.color = '#e8b64f';
    car.missionCar = true;
    car.borrowed = true;
    S.cars.push(car);
    m.targetCar = car;
    m.stepState.carId = car.id;
    S.missions.marker = { x: car.x, y: car.y, label: 'Get in Rosa\'s Corsa', color: '#ffd166' };
    m.stepState.phase = 'getin';
  }
  if (step.type === 'steal' || step.type === 'destroy') {
    const car = makeCar(step.carType, step.x, step.y, 0, { driver: null });
    car.missionCar = true;
    car.missionTarget = true;
    if (step.type === 'destroy') car.color = '#1c2733';
    S.cars.push(car);
    m.targetCar = car;
    m.stepState.carId = car.id;
  }
  if (step.type === 'kill') {
    for (const [x, y] of step.spots) {
      const g = makePed(x, y, 'gull');
      g.shirt = '#3a5a3a';
      g.state = 'idle';
      if (step.tough) { g.hp = 90; g.maxHp = 90; }
      S.peds.push(g);
      m.spawned.push(g);
    }
  }
  if (step.type === 'pickup') {
    S.pickups.push({ x: step.x, y: step.y, kind: step.kind, mission: true, taken: false });
  }
  if (step.type === 'disable') {
    m.stepState.remaining = step.spots.map(([x, y]) => {
      const cam = S.city.cctv.find((c) => Math.hypot(c.x - x, c.y - y) < 60);
      return cam || { x, y, disabled: false };
    });
    const first = m.stepState.remaining.find((c) => !c.disabled);
    if (first) S.missions.marker = { x: first.x, y: first.y, label: step.text, color: '#ffd166' };
  }
  if (step.type === 'escape') {
    m.timer = step.timer || 120;
    if (step.carType) {
      const car = makeCar(step.carType, step.x === 700 ? 2300 : step.x, step.y === 1520 ? 900 : step.y, 0, { driver: null });
      car.missionCar = true;
      S.cars.push(car);
      m.targetCar = car;
      m.stepState.carId = car.id;
    }
    if (step.heatAtStart) {
      addHeat(S, step.heatAtStart, S.player.x, S.player.y, 'scripted');
      if (S.onToast) S.onToast('The whole force is coming!', '#ff6b6b');
    }
  }
}

function advanceStep(S, m) {
  m.stepIndex++;
  if (m.stepIndex >= m.def.steps.length) { completeMission(S); return; }
  enterStep(S, m);
  if (S.onToast) S.onToast(m.def.steps[m.stepIndex].text, '#ffd166');
}

export function failMission(S, reason) {
  const m = S.missions.active;
  if (!m) return;
  cleanupMission(S, m);
  S.missions.active = null;
  S.missions.marker = null;
  S.audio.missionFail();
  if (S.onToast) S.onToast('Mission failed: ' + reason, '#ff6b6b');
  post(S, 'kill', districtAt(S.player.x, S.player.y));
}

function cleanupMission(S, m) {
  for (const g of m.spawned) {
    const i = S.peds.indexOf(g);
    if (i >= 0) S.peds.splice(i, 1);
  }
  if (m.targetCar) {
    const i = S.cars.indexOf(m.targetCar);
    if (i >= 0 && m.def.id !== 'm1') S.cars.splice(i, 1);
  }
  S.pickups = S.pickups.filter((p) => !p.mission);
}

export function completeMission(S) {
  const m = S.missions.active;
  if (!m) return;
  cleanupMission(S, m);
  S.missions.done.push(m.def.id);
  S.missions.index++;
  S.missions.active = null;
  S.missions.marker = null;
  S.player.cash += m.def.reward;
  S.profile.missionsDone++;
  if (m.def.unlock && !S.player.weapons.includes(m.def.unlock)) {
    S.player.weapons.push(m.def.unlock);
    if (S.onToast) S.onToast('New weapon unlocked: ' + m.def.unlock.toUpperCase(), '#7be0a3');
  }
  S.audio.missionDone();
  S.audio.cash();
  if (S.onToast) S.onToast('Mission complete! +$' + m.def.reward, '#7be0a3');
  post(S, 'missionDone', districtAt(S.player.x, S.player.y));
  postCustomMission(S, m.def);
  saveGame(S);
  if (m.def.id === 'm6') {
    S.ending = true;
    if (S.onEnding) S.onEnding();
  }
}

function postCustomMission(S, def) {
  postCustom(S, 'Rosa Delgado', '@rosasgarage', 'Mara did the thing. Verdeluz owes her one. — job done: ' + def.name, 'mission');
}

export function updateMissions(S, dt) {
  const m = S.missions.active;
  if (!m) return;
  const step = m.def.steps[m.stepIndex];
  if (!step) return;
  const p = S.player;

  // Spotted fail condition for stealth missions.
  if (m.def.failIfSpotted && S.wanted.stars > 0) {
    failMission(S, 'You were spotted');
    return;
  }

  switch (step.type) {
    case 'goto': {
      if (Math.hypot(p.x - step.x, p.y - step.y) < 70) advanceStep(S, m);
      break;
    }
    case 'talk': {
      if (Math.hypot(p.x - step.x, p.y - step.y) < 80) {
        if (S.consumeInteract) {
          S.consumeInteract = false;
          advanceStep(S, m);
        }
      }
      break;
    }
    case 'driveTo': {
      if (m.stepState.phase === 'getin') {
        if (p.car && p.car.id === m.stepState.carId) {
          m.stepState.phase = 'drive';
          S.missions.marker = { x: step.x, y: step.y, label: step.text, color: '#ffd166' };
        }
        break;
      }
      if (p.car && p.car.id === m.stepState.carId && Math.hypot(p.x - step.x, p.y - step.y) < 80) {
        advanceStep(S, m);
      }
      break;
    }
    case 'steal': {
      if (p.car && p.car.id === m.stepState.carId) {
        m.stepState.stolen = true;
        advanceStep(S, m);
      }
      break;
    }
    case 'deliver': {
      if (p.car && p.car.id === m.stepState.carId && Math.hypot(p.x - step.x, p.y - step.y) < 90) {
        advanceStep(S, m);
      }
      break;
    }
    case 'kill': {
      const alive = m.spawned.filter((g) => !g.dead);
      if (alive.length === 0) advanceStep(S, m);
      else {
        const near = alive[0];
        S.missions.marker = { x: near.x, y: near.y, label: step.text + ' (' + alive.length + ' left)', color: '#ff6b6b' };
      }
      break;
    }
    case 'pickup': {
      const pk = S.pickups.find((x) => x.mission && x.kind === step.kind && !x.taken);
      if (!pk) advanceStep(S, m);
      break;
    }
    case 'disable': {
      const remaining = m.stepState.remaining.filter((c) => !c.disabled);
      if (remaining.length === 0) { advanceStep(S, m); break; }
      const first = remaining[0];
      S.missions.marker = { x: first.x, y: first.y, label: step.text + ' (' + remaining.length + ' left)', color: '#ffd166' };
      if (Math.hypot(p.x - first.x, p.y - first.y) < 46 && S.consumeInteract) {
        S.consumeInteract = false;
        first.disabled = true;
        S.audio.uiClick();
        if (S.onToast) S.onToast('Camera disabled (' + (m.stepState.remaining.length - remaining.length + 1) + '/3)', '#7be0a3');
      }
      break;
    }
    case 'destroy': {
      const car = S.cars.find((c) => c.id === m.stepState.carId);
      if (!car || car.dead) advanceStep(S, m);
      else S.missions.marker = { x: car.x, y: car.y, label: step.text, color: '#ff6b6b' };
      break;
    }
    case 'escape': {
      m.timer -= dt;
      S.missions.timer = m.timer;
      if (m.timer <= 0) { failMission(S, 'Out of time'); break; }
      const inRightCar = !m.stepState.carId || (p.car && p.car.id === m.stepState.carId);
      if (inRightCar && Math.hypot(p.x - step.x, p.y - step.y) < 90) {
        if (m.stepState.carId && m.targetCar && m.targetCar.dead) { failMission(S, 'The van was destroyed'); break; }
        S.missions.timer = 0;
        advanceStep(S, m);
      }
      if (m.stepState.carId && m.targetCar && m.targetCar.dead) failMission(S, 'The vehicle was destroyed');
      // M4: entering the van triggers the scripted heat once.
      if (m.def.id === 'm4' && !m.stepState.heatDone && p.car && p.car.id === m.stepState.carId) {
        m.stepState.heatDone = true;
        addHeat(S, 200, p.x, p.y, 'scripted');
        if (S.onToast) S.onToast('The Gulls tipped off the cops!', '#ff6b6b');
      }
      break;
    }
    default:
      break;
  }
}

// ---- Side work ----

export function createSide() {
  return { taxi: null, taxiCooldown: 0, jumpsDone: [], airTime: 0 };
}

export function updateSide(S, dt) {
  const side = S.side;
  if (side.taxiCooldown > 0) side.taxiCooldown -= dt;
  const p = S.player;

  // Taxi fare timer + delivery.
  if (side.taxi) {
    const f = side.taxi;
    f.timer -= dt;
    if (f.timer <= 0) {
      side.taxi = null;
      side.taxiCooldown = 8;
      if (S.onToast) S.onToast('Fare cancelled — too slow', '#ff6b6b');
    } else if (f.phase === 'pickup' && p.car && Math.hypot(p.x - f.px, p.y - f.py) < 70) {
      f.phase = 'drop';
      S.missions.marker = { x: f.dx, y: f.dy, label: 'Drop the fare off', color: '#37e0d8' };
      if (S.onToast) S.onToast('Passenger aboard — go!', '#37e0d8');
      if (f.ped) { const i = S.peds.indexOf(f.ped); if (i >= 0) S.peds.splice(i, 1); }
    } else if (f.phase === 'drop' && p.car && Math.hypot(p.x - f.dx, p.y - f.dy) < 70) {
      const tip = f.timer > 30 ? 15 : 0;
      const pay = f.reward + tip;
      S.player.cash += pay;
      S.profile.taxiFares++;
      S.audio.cash();
      if (S.onToast) S.onToast('Fare complete! +$' + pay, '#7be0a3');
      post(S, 'taxi', districtAt(p.x, p.y));
      side.taxi = null;
      side.taxiCooldown = 6;
      if (!S.missions.active) S.missions.marker = null;
    }
  }

  // Hidden packages: walk or drive over them.
  for (const pk of S.city.packages) {
    if (pk.taken) continue;
    if (Math.hypot(p.x - pk.x, p.y - pk.y) < 34) {
      pk.taken = true;
      S.profile.packages++;
      S.player.cash += 25;
      S.audio.pickup();
      if (S.onToast) S.onToast('Hidden package! +$25 (' + S.profile.packages + '/12)', '#ffd166');
      post(S, 'package', districtAt(pk.x, pk.y));
    }
  }

  // Stunt jumps: hit a ramp fast in a car.
  if (p.car) {
    for (const j of S.city.jumps) {
      if (side.jumpsDone.includes(j.name)) continue;
      const d = Math.hypot(p.x - j.x, p.y - j.y);
      if (d < 40 && Math.hypot(p.car.vx, p.car.vy) > 300) {
        side.jumpsDone.push(j.name);
        side.airTime = 0.9;
        S.profile.jumps++;
        S.player.cash += 50;
        S.audio.pickup();
        if (S.onToast) S.onToast('STUNT JUMP: ' + j.name + '! +$50', '#ffd166');
        post(S, 'jump', districtAt(j.x, j.y));
      }
    }
  }
  if (side.airTime > 0) side.airTime -= dt;
}

export function offerTaxi(S) {
  const p = S.player;
  if (S.side.taxi || S.side.taxiCooldown > 0 || !p.car) return false;
  const stand = S.city.taxiStands.find((s) => Math.hypot(s.x - p.x, s.y - p.y) < 90);
  if (!stand) return false;
  const dest = S.city.taxiStands[(Math.floor(Math.random() * S.city.taxiStands.length))];
  if (Math.hypot(dest.x - stand.x, dest.y - stand.y) < 400) return false;
  const dist = Math.hypot(dest.x - stand.x, dest.y - stand.y);
  const ped = makePed(stand.x + 20, stand.y + 10);
  ped.state = 'idle';
  S.peds.push(ped);
  S.side.taxi = {
    px: stand.x, py: stand.y, dx: dest.x, dy: dest.y,
    timer: dist / 190 + 25,
    reward: Math.round(35 + dist / 45),
    phase: 'pickup',
    ped,
  };
  S.missions.marker = { x: stand.x, y: stand.y, label: 'Pick up the fare', color: '#37e0d8' };
  if (S.onToast) S.onToast('New fare — pick them up!', '#37e0d8');
  return true;
}

export function helpStranded(S, ped) {
  ped.helped = true;
  ped.helpMe = false;
  ped.state = 'walk';
  ped.target = null;
  S.profile.kindness++;
  S.player.cash += 20;
  S.audio.pickup();
  if (S.onToast) S.onToast('Good deed! +$20 — the city remembers kindness', '#7be0a3');
  post(S, 'kindness', districtAt(ped.x, ped.y));
}

export function resprayAtGarage(S) {
  const p = S.player;
  if (!p.car) return false;
  if (p.cash < 60) {
    if (S.onToast) S.onToast('Respray costs $60', '#ff6b6b');
    return false;
  }
  p.cash -= 60;
  const colors = ['#d94f4f', '#4f7ad9', '#e8b64f', '#5aa87a', '#e8e4d2', '#8a5aa8'];
  p.car.color = colors[Math.floor(Math.random() * colors.length)];
  p.car.health = p.car.maxHealth;
  p.car.smoke = 0;
  if (S.wanted.stars > 0) {
    clearWanted(S, 'respray');
    if (S.onToast) S.onToast('Fresh paint — the heat is off!', '#7be0a3');
  } else if (S.onToast) S.onToast('Fresh paint job!', '#7be0a3');
  S.audio.cash();
  return true;
}

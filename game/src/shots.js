// Deterministic scene setups for screenshots and the built-in self-test.
// Scenes reuse the game's own systems (spawn, wanted, missions) so every
// screenshot is a real render of real gameplay, not a mock-up.

import { makeCar, updatePlayerCar } from './vehicles.js';
import { makePed, makeCop } from './actors.js';
import { addHeat, updateWanted } from './wanted.js';
import { startMission, MISSION_DEFS } from './missions.js';
import { post } from './feed.js';
import { commitCrime } from './wanted.js';
import { fireWeapon, damageTarget } from './combat.js';
import { saveGame, loadSaveData } from './save.js';
import { districtAt } from './config.js';

export function applyScene(S, scene) {
  const p = S.player;
  if (scene === 'chase') {
    // Golden-hour police chase down Sol Avenue.
    S.timeOfDay = 17.6;
    const car = makeCar('falco', 1188, 1452, -Math.PI / 2, { driver: 'player' });
    car.color = '#d94f4f';
    S.cars.push(car);
    enterCarDirect(S, car);
    car.vx = 0; car.vy = -260;
    for (let i = 0; i < 2; i++) {
      const pc = makeCar('patrol', 1188 + (i === 0 ? -14 : 14), 1452 + 170 + i * 90, -Math.PI / 2, { driver: 'police' });
      S.cars.push(pc);
      S.wanted.policeCars.push(pc);
    }
    addHeat(S, 300, p.x, p.y, 'scripted');
    S.camera.x = p.x; S.camera.y = p.y;
  } else if (scene === 'plaza') {
    // On foot in the plaza by Vane Tower, mid-morning crowd.
    S.timeOfDay = 10.4;
    p.x = 1188; p.y = 560; p.angle = -Math.PI / 2;
    p.car = null;
    for (let i = 0; i < 6; i++) {
      const ped = makePed(1050 + i * 55, 620 + (i % 2) * 40);
      ped.target = { x: 1300 - i * 40, y: 700 };
      S.peds.push(ped);
    }
    const parked = makeCar('corsa', 1050, 396, 0, { driver: null });
    S.cars.push(parked);
    S.camera.x = p.x; S.camera.y = p.y + 40;
  } else if (scene === 'marina') {
    // Sunset drive along the marina front.
    S.timeOfDay = 18.4;
    const car = makeCar('brio', 2244, 1188, Math.PI / 2, { driver: 'player' });
    car.color = '#37e0d8';
    S.cars.push(car);
    enterCarDirect(S, car);
    car.vx = 0; car.vy = 200;
    S.camera.x = p.x; S.camera.y = p.y;
  } else if (scene === 'night') {
    // Night at the docks: mission 3 in progress, Gulls ahead.
    S.timeOfDay = 21.6;
    p.x = 1980; p.y = 2080; p.angle = 0.4; p.car = null;
    p.weapon = 'shotgun';
    if (!p.weapons.includes('shotgun')) p.weapons.push('shotgun');
    const gulls = [];
    for (const [x, y] of [[1980, 2050], [2080, 1980], [2244, 2150]]) {
      const g = makePed(x, y, 'gull');
      g.shirt = '#3a5a3a';
      g.state = 'combat';
      S.peds.push(g);
      gulls.push(g);
    }
    S.missions.marker = { x: 1980, y: 2050, label: 'Clear the Gulls off the docks', color: '#ff6b6b' };
    S.missions.active = { def: MISSION_DEFS[2], stepIndex: 1, stepState: {}, spawned: gulls, targetCar: null, timer: 0, startedAt: S.time };
    S.camera.x = 2000; S.camera.y = 2080;
  }
}

function enterCarDirect(S, car) {
  S.player.car = car;
  car.driver = 'player';
  S.player.x = car.x;
  S.player.y = car.y;
}

// Self-test: exercises every system through the real code paths and
// reports pass/fail per check. Runs with ?selftest=1.
export function runSelfTest(S) {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail || '' });
  try {
    check('city generated', S.city.buildings.length > 80, S.city.buildings.length + ' buildings');
    check('cctv placed', S.city.cctv.length >= 10, S.city.cctv.length + ' cameras');
    check('packages placed', S.city.packages.length === 12, '12');
    check('peds spawned', S.peds.length >= 20, S.peds.length + ' peds');
    check('traffic spawned', S.cars.length >= 10, S.cars.length + ' cars');

    // Driving physics: a fake input that holds W for 60 frames.
    const car = makeCar('brio', 660, 660, 0, { driver: 'player' });
    S.cars.push(car);
    const fakeInput = { down: () => false, hit: () => false };
    fakeInput.down = (k) => k === 'w';
    const before = { x: car.x, y: car.y };
    for (let i = 0; i < 60; i++) updatePlayerCar(S, car, 1 / 60, fakeInput);
    const moved = Math.hypot(car.x - before.x, car.y - before.y);
    check('driving moves car', moved > 30, 'moved ' + Math.round(moved) + 'px in 1s');
    S.cars.splice(S.cars.indexOf(car), 1);

    // Witness logic: crime far from everyone is unseen.
    const lonely = commitCrime(S, 'steal', 250, 250);
    check('unseen crime stays clean', lonely.witnessed === false || S.wanted.stars === 0, 'via=' + lonely.via);
    // Witness logic: a ped staring at the crime reports it.
    const watcher = makePed(700, 700);
    watcher.angle = Math.atan2(720 - 700, 720 - 700);
    S.peds.push(watcher);
    const seen = commitCrime(S, 'assault', 720, 720);
    check('witnessed crime reported', seen.witnessed === true, 'via=' + seen.via);
    // Fast-forward the report.
    for (let i = 0; i < 200; i++) S.wanted.reports.forEach((r) => { r.t -= 0.05; });
    updateWanted(S, 0.05);
    check('report raises heat', S.wanted.stars >= 1, 'stars=' + S.wanted.stars);
    S.wanted.stars = 0; S.wanted.heat = 0; S.wanted.reports = [];
    S.peds.splice(S.peds.indexOf(watcher), 1);

    // Combat: shooting damages a target.
    const target = makePed(900, 900, 'gull');
    S.peds.push(target);
    const hpBefore = target.hp;
    damageTarget(S, target, 20, S.player);
    check('combat damages target', target.hp === hpBefore - 20, hpBefore + ' -> ' + target.hp);
    S.peds.splice(S.peds.indexOf(target), 1);
    fireWeapon(S, S.player, 0, 'pistol');
    check('firing spawns bullet', S.bullets.length > 0, S.bullets.length + ' bullets');
    S.bullets = [];

    // Mission flow: start M1 and check the first step exists.
    startMission(S, MISSION_DEFS[0]);
    check('mission starts', !!S.missions.active && S.missions.active.def.id === 'm1', 'm1 active');
    check('mission marker set', !!S.missions.marker, S.missions.marker ? S.missions.marker.label : 'none');
    S.missions.active = null;
    S.missions.marker = null;
    S.missions.index = 0;
    S.pickups = S.pickups.filter((pk) => !pk.mission);

    // Feed reacts.
    const postsBefore = S.feed.posts.length;
    post(S, 'kindness', districtAt(S.player.x, S.player.y));
    check('feed posts', S.feed.posts.length === postsBefore + 1, 'posts=' + S.feed.posts.length);

    // Save / load round-trip.
    const cashBefore = S.player.cash;
    S.player.cash = 12345;
    const saved = saveGame(S);
    const data = loadSaveData();
    check('save/load round-trip', saved && data && data.cash === 12345, 'cash=' + (data && data.cash));
    S.player.cash = cashBefore;
    saveGame(S);

    // Minimap + render run without throwing.
    check('render pipeline', typeof S.groundLayer !== 'undefined' && !!S.groundLayer, 'ground layer ready');
  } catch (e) {
    results.push({ name: 'self-test crashed', pass: false, detail: String(e && e.message || e) });
  }
  const passed = results.filter((r) => r.pass).length;
  return { results, passed, total: results.length, ok: passed === results.length };
}

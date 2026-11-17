// Solmar Heat — staged screenshot scenes. One job: put the real game into a
// photogenic state for ?shot=cover|drive|foot|mission, deterministically, so
// the screenshots are honest frames of the game itself.
import { makeRng, range } from './rng.js';
import { makeCar, enterCar } from './entities.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { nearestRoadPoint } from './city.js';

function placeTrafficNear(state, rng, cx, cy, n) {
  state.traffic = [];
  for (let i = 0; i < n; i += 1) {
    const a = range(rng, 0, Math.PI * 2);
    const x = cx + Math.cos(a) * range(rng, 180, 520);
    const y = cy + Math.sin(a) * range(rng, 180, 520);
    const p = nearestRoadPoint(state.city, x, y);
    if (!p) continue;
    const bodyType = i % 4 === 0 ? 'taxi' : i % 4 === 1 ? 'sport' : 'sedan';
    const color = bodyType === 'taxi' ? '#f2c200' : ['#d9392b', '#2b6fd9', '#e8a13a', '#37b24d'][i % 4];
    const car = makeCar(p.x, p.y, p.vertical ? Math.PI / 2 : 0, color, 'traffic', bodyType);
    car.speed = range(rng, 100, 220);
    state.traffic.push(car);
  }
}

function placePedsNear(state, rng, cx, cy, n) {
  state.peds = [];
  for (let i = 0; i < n; i += 1) {
    const a = range(rng, 0, Math.PI * 2);
    const x = cx + Math.cos(a) * range(rng, 120, 420);
    const y = cy + Math.sin(a) * range(rng, 120, 320);
    const p = nearestRoadPoint(state.city, x, y);
    if (!p) continue;
    state.peds.push({
      x: p.vertical ? p.x + 62 : p.x,
      y: p.vertical ? p.y : p.y + 62,
      angle: range(rng, 0, Math.PI * 2),
      speed: 40,
      name: 'Warga',
      color: ['#e8590c', '#2b8a3e', '#1971c2'][i % 3],
      fleeing: 0,
      walkPhase: range(rng, 0, Math.PI * 2),
    });
  }
}

function setCamera(state) {
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
}

// Stage one named scene. Returns false for an unknown name.
export function stageShot(name, state) {
  const rng = makeRng(7);
  state.screen = 'play';
  state.dialogue = null;
  state.dialogueTimer = 0;
  state.hintTimer = 0;
  if (name === 'cover') {
    // Downtown chase: player car, three police cars, wanted 3, mission live.
    state.missionIndex = 0;
    startMission(state, 0);
    const car = makeCar(1400, 1000, 0, '#d9392b', 'player');
    car.speed = 320;
    enterCar(state.player, car);
    state.player.x = 1400;
    state.player.y = 1000;
    state.wanted = 3;
    state.wantedTimer = 26;
    addWanted(state, 'shoot');
    state.wanted = 3; // addWanted adds heat; pin the staged level back to 3.
    state.dialogue = null;
    state.dialogueTimer = 0;
    state.police = [];
    for (let i = 0; i < 3; i += 1) {
      const pc = makeCar(1400 - 180 - i * 90, 1000 + (i - 1) * 70, 0, '#1f6feb', 'police');
      pc.siren = true;
      pc.speed = 340;
      state.police.push(pc);
    }
    placeTrafficNear(state, rng, 1400, 1000, 6);
    placePedsNear(state, rng, 1400, 1000, 8);
    state.message = 'WANTED LEVEL 3 — polisi mengejarmu!';
    state.messageTimer = 5;
    setCamera(state);
    return true;
  }
  if (name === 'drive') {
    // Coastal highway drive: traffic ahead, pedestrians on the sidewalk, sea right.
    state.missionIndex = 1;
    startMission(state, 1);
    state.dialogue = null;
    state.dialogueTimer = 0;
    const car = makeCar(2600, 1400, -Math.PI / 2, '#2b6fd9', 'player');
    car.speed = 380;
    enterCar(state.player, car);
    state.player.x = 2600;
    state.player.y = 1400;
    placeTrafficNear(state, rng, 2600, 1200, 7);
    placePedsNear(state, rng, 2700, 1300, 10);
    state.message = 'Bawa mobil curian ke garasi!';
    state.messageTimer = 5;
    setCamera(state);
    return true;
  }
  if (name === 'foot') {
    // On foot at the beach: cash pickup, a guard, wanted 1, police closing in.
    state.missionIndex = 3;
    startMission(state, 3);
    state.player.x = 2940;
    state.player.y = 1500;
    state.player.onFoot = true;
    state.player.car = null;
    state.player.angle = Math.PI / 2;
    state.wanted = 1;
    state.wantedTimer = 26;
    addWanted(state, 'shoot');
    state.wanted = 1; // pin the staged level back to 1.
    state.dialogue = null;
    state.dialogueTimer = 0;
    state.police = [];
    const pc = makeCar(2760, 1420, 0, '#1f6feb', 'police');
    pc.siren = true;
    pc.speed = 200;
    state.police.push(pc);
    placeTrafficNear(state, rng, 2700, 1500, 3);
    placePedsNear(state, rng, 2940, 1500, 6);
    state.pickups = [{ x: 2990, y: 1560, kind: 'cash', taken: false, bob: 0 }];
    state.guards = [{ x: 2900, y: 1620, angle: 0, health: 50, shootCooldown: 1, alive: true, speed: 90 }];
    state.message = 'Ambil uang di gudang pelabuhan!';
    state.messageTimer = 5;
    setCamera(state);
    return true;
  }
  if (name === 'mission') {
    // Mission briefing moment: dialogue box, target car marked, marina behind.
    state.missionIndex = 1;
    startMission(state, 1);
    state.player.x = 2500;
    state.player.y = 700;
    state.player.onFoot = true;
    state.player.car = null;
    state.player.angle = 0;
    state.dialogue = ['Misi 2 — Mobil Panas', 'Kane: "Butuh mobil cepat. Curi yang merah di parkiran marina."'];
    state.dialogueTimer = 99;
    placeTrafficNear(state, rng, 2560, 640, 4);
    placePedsNear(state, rng, 2500, 700, 6);
    state.message = 'Curi mobil sport merah itu!';
    state.messageTimer = 5;
    setCamera(state);
    return true;
  }
  return false;
}

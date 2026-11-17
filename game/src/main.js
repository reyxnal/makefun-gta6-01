// Vela Mar — Countdown Getaway. Boot, chase camera, game loop, combat
// triggers, stealing, wanted wiring, countdown clock, saving and the
// deterministic screenshot staging used by ?shot= presets.
import * as THREE from 'three';
import { TUNING, PLACES, MISSIONS, TOKEN_SPOTS, districtAt, distance2D, clampNumber, lerpNumber } from './config.js';
import { CityBuilder } from './city.js';
import { AudioEngine } from './audio.js';
import { InputState } from './input.js';
import { Player, PedestrianSystem, EnemySquad, rayHitActors } from './actors.js';
import { Car, TrafficSystem, PoliceSystem, WantedSystem, spawnParkedCars } from './vehicles.js';
import { MissionSystem, saveGameState, loadGameState, hasSaveGame, clearSaveGame } from './missions.js';
import { Hud } from './hud.js';

const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot');
const SEED = Number(params.get('seed') || 7);
const LOW_QUALITY = params.get('low') === '1';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(LOW_QUALITY ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !LOW_QUALITY;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
const city = new CityBuilder(scene, SEED);
city.buildAll();
const audio = new AudioEngine();
const input = new InputState(canvas);
const hud = new Hud();
const player = new Player(scene, PLACES.spawn.x, PLACES.spawn.z);
const peds = new PedestrianSystem(scene, city, 26);
const enemies = new EnemySquad(scene, city);
const parked = spawnParkedCars(scene, city);
const traffic = new TrafficSystem(scene, city, 14);
const police = new PoliceSystem(scene, city);
const wanted = new WantedSystem();

let gameState = 'menu'; // menu | playing | paused | busted | wasted
let cash = 120;
let rep = 0;
let tokensTaken = 0;
let elapsed = 0;
let sunriseShown = false;
let camYaw = Math.PI * 0.9;
let camPitch = 0.32;
let camDist = 9;
let shake = 0;
let vignetteTimer = 0;
let shootWantedCooldown = 0;
let marker = null;
let freeCars = new Set();
let qualityHigh = !LOW_QUALITY;
let frameCount = 0;

input.onFirstGesture = () => { audio.resumeAudio(); audio.startMusic(); };

const missions = new MissionSystem({
  onMissionStart(m) {
    hud.showBanner(m.title, m.steps[0].label);
    hud.feed('NEW MISSION: ' + m.title);
  },
  showDialogue(lines, done) { hud.showDialogue(lines, done); },
  onStepStart(step) {
    const m = missions.currentMission();
    if (m) hud.showBanner(m.title, step.label);
    if (step.kind === 'finale') {
      missions.deliaAboard = true;
      hud.feed('DELIA IS RIDING WITH YOU — GO, GO, GO!');
    }
  },
  onGatesReset(step) { city.setCheckpointGates(step.gates); city.setActiveGate(0); },
  onActiveGate(i) { city.setActiveGate(i); },
  onGateHit(i, total) {
    audio.playOneShot('pickup');
    hud.feed('GATE ' + i + ' / ' + total + ' — KEEP PUSHING!');
    const step = missions.currentStep();
    const gate = step.gates[i - 1];
    if (gate) city.particles.burst(gate[0], 3, gate[1], 0xffd23e, 26, 5, 4);
  },
  onGateProgress(i, total, tLeft) {
    const m = missions.currentMission();
    const mm = Math.floor(tLeft / 60); const ss = String(Math.floor(tLeft % 60)).padStart(2, '0');
    if (m) hud.showBanner(m.title, 'GATE ' + (i + 1) + ' / ' + total + '  •  ' + mm + ':' + ss + ' LEFT');
  },
  onCheckpointTimeout() {
    hud.showSplash('TIME UP', 'The loop resets — run it again, faster.', 2.5);
    hud.feed('FESTIVAL RUN FAILED — GATES RESET');
  },
  onSpawnEnemies() { enemies.spawnCrew(); hud.feed('HOLLOW TIDES CREW SPOTTED AT THE DOCKS'); },
  onSetWanted(n) { wanted.setStars(n); hud.feed('WANTED LEVEL ' + n + ' — POLICE INBOUND'); },
  onMissionComplete(m) {
    cash += m.reward;
    rep += 5;
    city.clearGates();
    city.setBeacon(0, 0, false);
    marker = null;
    audio.playOneShot('splash');
    hud.showSplash('MISSION COMPLETE', '+$' + m.reward + '  •  ' + m.doneLine, 4);
    hud.feed(m.doneLine);
    if (m.id === 'festival-run') {
      freeCars.add('garageCometa');
      hud.feed('UNLOCKED: the teal Cometa GT at Voss Garage is yours — no heat.');
    }
    if (m.id === 'dockside-deal' && city.caseMesh) city.caseMesh.visible = true;
    missions.caseHeld = false;
    missions.deliaAboard = false;
    persistGame();
  },
  onCasePickup() {
    audio.playOneShot('pickup');
    hud.feed('CASE SECURED — GET IT TO VOSS GARAGE');
    if (city.caseMesh) city.caseMesh.visible = false;
    city.particles.burst(PLACES.docksCase.x, 2, PLACES.docksCase.z, 0xffd23e, 20, 4, 4);
  },
  onAllMissionsDone() {
    hud.showSplash('SUNRISE OVER VELA MAR', 'All five jobs done. The city is yours — free roam, chase the tokens, keep the night alive.', 6);
    hud.showBanner('FREE ROAM', 'Vela Mar is yours — tokens, jumps and joyrides remain.');
    city.setBeacon(0, 0, false);
    marker = null;
    persistGame();
  },
  setMarker(x, z, color) {
    if (x === undefined || z === undefined) {
      const stageCar = parked.find((c) => c.id === 'stageCometa');
      if (stageCar) { x = stageCar.x; z = stageCar.z; } else return;
    }
    city.setBeacon(x, z, true, color);
    marker = { x, z };
  },
  enemiesAlive: () => enemies.aliveCount(),
  wantedStars: () => wanted.stars,
});

function persistGame() {
  saveGameState({
    cash, rep, tokensTaken,
    missionIndex: missions.missionIndex,
    stepIndex: missions.stepIndex,
    finishedAll: missions.finishedAll,
    health: player.health,
    x: player.x, z: player.z,
    elapsed,
    tokens: city.tokens.map((t) => t.taken),
    freeCars: [...freeCars],
  });
}

function applySave(save) {
  cash = save.cash ?? 120;
  rep = save.rep ?? 0;
  tokensTaken = save.tokensTaken ?? 0;
  elapsed = save.elapsed ?? 0;
  player.health = save.health ?? TUNING.playerHealth;
  player.x = save.x ?? PLACES.spawn.x;
  player.z = save.z ?? PLACES.spawn.z;
  freeCars = new Set(save.freeCars || []);
  if (Array.isArray(save.tokens)) {
    save.tokens.forEach((taken, i) => {
      if (taken && city.tokens[i]) { city.tokens[i].taken = true; city.tokens[i].mesh.visible = false; }
    });
  }
  missions.missionIndex = save.missionIndex ?? 0;
  missions.stepIndex = save.stepIndex ?? 0;
  missions.finishedAll = !!save.finishedAll;
  missions.active = !missions.finishedAll;
  if (missions.finishedAll) {
    hud.showBanner('FREE ROAM', 'Vela Mar is yours.');
  } else {
    const m = missions.currentMission();
    if (m) {
      hud.showBanner(m.title, (m.steps[missions.stepIndex] || {}).label || '');
      missions.stepStarted = false;
    }
  }
  player.syncMesh();
}

function startGame(fromSave) {
  const save = fromSave ? loadGameState() : null;
  hud.hideStart();
  hud.showHud();
  input.enabled = true;
  audio.resumeAudio();
  audio.startMusic();
  gameState = 'playing';
  if (save) {
    applySave(save);
    hud.feed('SAVE LOADED — WELCOME BACK TO VELA MAR');
  } else {
    missions.startChain();
  }
  document.getElementById('fadeBlack').style.opacity = '0';
}

function nearestEnterableCar() {
  let best = null; let bestD = TUNING.carEnterRange;
  const all = [...parked, ...traffic.cars, ...police.units];
  for (const car of all) {
    if (car === player.inCar) continue;
    const d = distance2D(player.x, player.z, car.x, car.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function tryEnterOrSteal() {
  if (player.inCar) {
    player.exitCar(city);
    audio.playOneShot('click');
    return;
  }
  const car = nearestEnterableCar();
  if (!car) return;
  if (car.police) {
    hud.feed('LOCKED — A VMPD UNIT CANNOT BE STOLEN');
    audio.playOneShot('click');
    return;
  }
  const isSteal = !player.ownedCars.has(car.id) && !freeCars.has(car.id);
  if (car.traffic) {
    traffic.cars = traffic.cars.filter((c) => c !== car);
    delete car.traffic;
  }
  player.enterCar(car);
  player.ownedCars.add(car.id);
  audio.playOneShot('click');
  if (isSteal) {
    wanted.raise(TUNING.stealWanted, (n) => hud.feed('CAR STOLEN — WANTED LEVEL ' + n));
    hud.feed('STOLE THE ' + car.spec.name.toUpperCase() + ' — WITNESSES CALLED IT IN');
    peds.scare(car.x, car.z, 22);
  } else {
    hud.feed('DRIVING THE ' + car.spec.name.toUpperCase());
  }
}

function shootWeapon() {
  if (!player.tryShoot()) return;
  const dir = { x: Math.sin(camYaw), z: Math.cos(camYaw) };
  player.heading = camYaw;
  const origin = { x: player.x + dir.x * 0.8, z: player.z + dir.z * 0.8 };
  const muzzle = { x: player.x + dir.x * 1.1, y: 1.4, z: player.z + dir.z * 1.1 };
  city.particles.burst(muzzle.x, muzzle.y, muzzle.z, 0xffd23e, 6, 3, 1);
  audio.playOneShot('gunshot');
  shake = Math.min(0.5, shake + 0.14);
  peds.scare(player.x, player.z, 30);
  if (shootWantedCooldown <= 0) {
    wanted.raise(TUNING.shootWanted, (n) => hud.feed('SHOTS FIRED — WANTED LEVEL ' + n));
    shootWantedCooldown = 6;
  }
  const targets = [...enemies.enemies.map((e) => ({ ...e, isEnemy: true })), ...peds.peds.map((p) => ({ ...p, isPed: true, pedRef: p }))];
  const hit = rayHitActors(origin, dir, targets, 60);
  if (hit) {
    const hx = origin.x + dir.x * hit.distance;
    const hz = origin.z + dir.z * hit.distance;
    city.particles.burst(hx, 1.4, hz, 0xff4030, 14, 4, 3);
    if (hit.actor.isEnemy) {
      const real = enemies.enemies.find((e) => e.x === hit.actor.x && e.z === hit.actor.z && !e.dead);
      if (real) enemies.damageEnemy(real, TUNING.pistolDamage, () => {
        hud.feed('RIVAL DOWN — ' + enemies.aliveCount() + ' LEFT');
        cash += 25;
      });
    } else if (hit.actor.isPed) {
      peds.knockDown(hit.actor.pedRef);
      wanted.raise(1, (n) => hud.feed('PEDESTRIAN HIT — WANTED LEVEL ' + n));
    }
  } else {
    city.particles.burst(origin.x + dir.x * 30, 1, origin.z + dir.z * 30, 0xc8c8c8, 5, 2, 1);
  }
}

function punchAttack() {
  if (!player.tryPunch()) return;
  audio.playOneShot('punch');
  shake = Math.min(0.4, shake + 0.08);
  const reach = 2.5;
  for (const e of enemies.enemies) {
    if (e.dead) continue;
    if (distance2D(player.x, player.z, e.x, e.z) < reach) {
      enemies.damageEnemy(e, TUNING.punchDamage, () => hud.feed('RIVAL DOWN — ' + enemies.aliveCount() + ' LEFT'));
      city.particles.burst(e.x, 1.4, e.z, 0xffd23e, 8, 3, 2);
      return;
    }
  }
  for (const p of peds.peds) {
    if (p.downTimer > 0) continue;
    if (distance2D(player.x, player.z, p.x, p.z) < reach) {
      peds.knockDown(p);
      wanted.raise(1, (n) => hud.feed('ASSAULT — WANTED LEVEL ' + n));
      return;
    }
  }
}

function respawnAfterIncident(kind) {
  const fine = kind === 'busted' ? 150 : 100;
  cash = Math.max(0, cash - fine);
  if (player.inCar) player.exitCar(city);
  player.health = TUNING.playerHealth;
  wanted.clear();
  police.clearAll();
  audio.setSiren(false);
  if (kind === 'busted') {
    player.x = -118; player.z = -118;
    hud.feed('RELEASED NEAR VMPD HQ — FINE $' + fine);
  } else {
    player.x = PLACES.clinic.x; player.z = PLACES.clinic.z - 12;
    hud.feed('PATCHED UP AT THE MARINA CLINIC — BILL $' + fine);
  }
  if (missions.currentMission() && missions.currentMission().id === 'dockside-deal') {
    missions.caseHeld = false;
    if (city.caseMesh) city.caseMesh.visible = true;
  }
  missions.restartCurrentStep();
  player.syncMesh();
  gameState = 'playing';
}

function updateCamera(dt) {
  const target = player.inCar
    ? { x: player.inCar.x, y: 2.4, z: player.inCar.z }
    : { x: player.x, y: 2.1, z: player.z };
  const wantDist = player.inCar ? 12.5 : 8.5;
  camDist = lerpNumber(camDist, wantDist, Math.min(1, dt * 3));
  const speedKick = player.inCar ? clampNumber(Math.abs(player.inCar.speed) / 40, 0, 1) : 0;
  camera.fov = lerpNumber(camera.fov, 62 + speedKick * 10, Math.min(1, dt * 4));
  camera.updateProjectionMatrix();
  const cx = target.x - Math.sin(camYaw) * Math.cos(camPitch) * camDist;
  const cz = target.z - Math.cos(camYaw) * Math.cos(camPitch) * camDist;
  const cy = target.y + Math.sin(camPitch) * camDist;
  shake = Math.max(0, shake - dt * 1.6);
  const shx = (Math.random() - 0.5) * shake;
  const shy = (Math.random() - 0.5) * shake;
  camera.position.set(cx + shx, Math.max(1.4, cy + shy), cz);
  camera.lookAt(target.x, target.y, target.z);
}

function updatePlaying(dt) {
  elapsed += dt;
  shootWantedCooldown = Math.max(0, shootWantedCooldown - dt);
  vignetteTimer = Math.max(0, vignetteTimer - dt);
  hud.showVignette(vignetteTimer > 0 || player.health < 30);
  const dayPhase = clampNumber(elapsed / TUNING.nightSeconds, 0, 1);
  city.setDayPhase(dayPhase);
  if (elapsed >= TUNING.nightSeconds && !sunriseShown) {
    sunriseShown = true;
    hud.showSplash('SUNRISE', 'The night is over — but Vela Mar never really sleeps.', 4);
  }
  // Camera input.
  const { dx, dy } = input.consumeMouseDelta();
  camYaw -= dx * 0.0026;
  camPitch = clampNumber(camPitch + dy * 0.002, 0.08, 1.1);
  if (input.isDown('ArrowLeft')) camYaw += dt * 1.8;
  if (input.isDown('ArrowRight')) camYaw -= dt * 1.8;

  if (hud.dialogueVisible) {
    if (input.wasPressed('KeyE') || input.consumeClick()) {
      audio.playOneShot('click');
      hud.advanceDialogue();
    }
  } else if (player.inCar) {
    const car = player.inCar;
    const throttle = input.axisForward();
    const steer = -input.axisStrafe();
    const handbrake = input.isDown('Space');
    const nitro = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    car.drive(dt, throttle, steer, handbrake, nitro, city, (impact) => {
      audio.playOneShot('crash');
      shake = Math.min(0.7, shake + impact * 0.02);
      city.particles.burst(car.x, 1, car.z, 0xffa83d, 16, 5, 3);
      vignetteTimer = Math.max(vignetteTimer, 0.25);
    });
    player.x = car.x; player.z = car.z;
    if (input.wasPressed('KeyE')) tryEnterOrSteal();
    if (input.wasPressed('KeyH')) audio.playOneShot('horn');
    audio.setEngine(clampNumber(Math.abs(car.speed) / 38, 0, 1), true);
    // Ramp jump: launch over the stunt ramp.
    if (distance2D(car.x, car.z, PLACES.jumpRamp.x, PLACES.jumpRamp.z) < 4 && Math.abs(car.speed) > 18) {
      hud.feed('STUNT JUMP!');
      city.particles.burst(car.x, 2, car.z, 0x7dffb0, 20, 6, 5);
    }
  } else {
    const fwd = input.axisForward();
    const strafe = input.axisStrafe();
    const sin = Math.sin(camYaw); const cos = Math.cos(camYaw);
    const moveX = sin * fwd + cos * strafe;
    const moveZ = cos * fwd - sin * strafe;
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    player.updateOnFoot(dt, moveX, moveZ, sprint, input.wasPressed('Space'), city);
    if (input.wasPressed('KeyE')) tryEnterOrSteal();
    if (input.wasPressed('KeyF')) punchAttack();
    if (input.wasPressed('KeyR')) { if (player.startReload()) hud.feed('RELOADING…'); }
    if (input.mouseDown || input.consumeClick()) shootWeapon();
    audio.setEngine(0, false);
  }
  player.updateTimers(dt);

  // Interact prompt.
  if (!player.inCar && !hud.dialogueVisible) {
    const car = nearestEnterableCar();
    if (car) {
      if (car.police) hud.showInteract('VMPD UNIT — LOCKED');
      else if (player.ownedCars.has(car.id) || freeCars.has(car.id)) hud.showInteract('E — DRIVE THE ' + car.spec.name.toUpperCase());
      else hud.showInteract('E — STEAL THE ' + car.spec.name.toUpperCase() + '  (+1 ★)');
    } else hud.hideInteract();
  } else hud.hideInteract();

  // Pedestrian collisions with fast cars.
  const fastCars = [];
  if (player.inCar) fastCars.push(player.inCar);
  for (const u of police.units) fastCars.push(u);
  for (const c of traffic.cars) fastCars.push(c);
  for (const p of peds.peds) {
    if (p.downTimer > 0) continue;
    for (const car of fastCars) {
      if (Math.abs(car.speed) > 6 && distance2D(p.x, p.z, car.x, car.z) < 2.1) {
        peds.knockDown(p);
        city.particles.burst(p.x, 1.2, p.z, 0xff4030, 12, 4, 3);
        if (car === player.inCar) {
          wanted.raise(TUNING.hitPedWanted, (n) => hud.feed('PEDESTRIAN HIT — WANTED LEVEL ' + n));
          audio.playOneShot('crash');
        }
        break;
      }
    }
  }

  // Tokens.
  for (const t of city.tokens) {
    if (t.taken) continue;
    if (distance2D(player.x, player.z, t.x, t.z) < 2.8) {
      t.taken = true;
      t.mesh.visible = false;
      tokensTaken += 1;
      cash += 50;
      rep += 1;
      audio.playOneShot('pickup');
      hud.feed('FESTIVAL TOKEN ' + tokensTaken + '/8 — +$50');
      city.particles.burst(t.x, 2.2, t.z, 0xffd23e, 22, 4, 4);
    }
  }

  // Traffic + pedestrians + enemies.
  const playerCar = player.inCar;
  traffic.update(dt, { x: player.x, z: player.z }, playerCar, () => {
    audio.playOneShot('crash');
    city.particles.burst(playerCar.x, 1, playerCar.z, 0xffa83d, 10, 4, 2);
  });
  peds.update(dt, fastCars);
  enemies.update(dt, player, (enemy, dist) => {
    const hitChance = clampNumber(0.6 - dist * 0.012, 0.15, 0.6);
    audio.playOneShot('gunshot');
    city.particles.burst(enemy.x, 1.5, enemy.z, 0xffd23e, 5, 3, 1);
    if (Math.random() < hitChance) {
      const dead = player.takeDamage(9);
      vignetteTimer = 0.6;
      shake = Math.min(0.6, shake + 0.2);
      hud.feed('HIT! HEALTH ' + Math.round(player.health));
      if (dead) { gameState = 'wasted'; hud.showWasted(); }
    }
  });
  enemies.collectPickups(player, (pk) => {
    if (pk.kind === 'cash') { cash += 60; hud.feed('PICKED UP +$60'); }
    else { player.mag = TUNING.pistolMagazine; player.reloading = false; hud.feed('AMMO RESTOCKED'); }
    audio.playOneShot('pickup');
  });

  // Wanted + police.
  const nearestPolice = police.nearestDistance(player.x, player.z);
  const inLayLow = distance2D(player.x, player.z, PLACES.layLow.x, PLACES.layLow.z) < 12;
  wanted.update(dt, nearestPolice < 48, inLayLow);
  audio.setSiren(wanted.stars > 0 && police.units.length > 0);
  const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
  const pres = police.update(dt, player.x, player.z, playerSpeed, wanted.stars, () => {
    audio.playOneShot('crash');
    shake = Math.min(0.6, shake + 0.25);
  });
  if (pres.busted) {
    gameState = 'busted';
    hud.showBusted();
    audio.setSiren(false);
  }

  // Missions.
  missions.update(dt, { player });
  const mp = missions.markerPosition();
  if (mp && isFinite(mp.x) && isFinite(mp.z) && missions.active) marker = mp;

  // HUD refresh.
  const clockMinutes = TUNING.startClockMinutes + (elapsed / TUNING.nightSeconds) * (TUNING.sunriseClockMinutes - TUNING.startClockMinutes);
  hud.setClock(clockMinutes, TUNING.nightSeconds - elapsed);
  hud.setCash(cash);
  hud.setRep(rep);
  hud.setTokens(tokensTaken);
  hud.setStars(wanted.stars);
  hud.setHealth(player.health, TUNING.playerHealth);
  hud.setAmmo(player.mag, player.reloading);
  hud.setVehicle(player.inCar ? player.inCar.spec.name : null, player.inCar ? Math.abs(player.inCar.speed) * 3.2 : 0);
  hud.setZone(player.x, player.z);
  const step = missions.currentStep();
  hud.drawMinimap({
    playerX: player.x, playerZ: player.z, heading: player.inCar ? player.inCar.heading : player.heading,
    cars: [...parked, ...traffic.cars], police: police.units, enemies: enemies.enemies,
    tokens: city.tokens, marker,
    gates: step && step.kind === 'checkpoints' ? step.gates.slice(missions.gateIndex) : null,
  });
  hud.updateSplash(dt);
  city.followShadowTarget(player.x, player.z);
  updateCamera(dt);
}

function updateMenuCamera(dt) {
  const t = performance.now() / 1000;
  const cx = Math.sin(t * 0.08) * 34;
  const cz = Math.cos(t * 0.08) * 34 + 4;
  camera.position.set(cx, 14, cz);
  camera.lookAt(0, 4, -6);
  city.setDayPhase(0.18);
}

const clock = new THREE.Clock();
function gameLoop() {
  requestAnimationFrame(gameLoop);
  const dt = Math.min(clock.getDelta(), 0.05);
  frameCount += 1;
  if (gameState === 'playing') updatePlaying(dt);
  else if (gameState === 'menu') updateMenuCamera(dt);
  city.update(dt);
  audio.updateMusic();
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    hud.feed(muted ? 'SOUND OFF' : 'SOUND ON');
  }
  if (input.wasPressed('KeyP') && gameState === 'playing') {
    persistGame();
    hud.feed('GAME SAVED');
    audio.playOneShot('click');
  }
  if (input.wasPressed('Escape')) {
    if (gameState === 'playing') {
      gameState = 'paused';
      hud.showPause('CASH $' + Math.round(cash) + '  •  REP ' + rep + '  •  ' + (missions.currentMission() ? missions.currentMission().title : 'FREE ROAM'));
      if (document.exitPointerLock) document.exitPointerLock();
    } else if (gameState === 'paused') {
      gameState = 'playing';
      hud.hidePause();
    }
  }
  renderer.render(scene, camera);
  input.endFrame();
  if (frameCount === 3) {
    document.getElementById('fadeBlack').style.opacity = '0';
    window.__gameReady = true;
  }
}

function setQuality(high) {
  qualityHigh = high;
  renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
  renderer.shadowMap.enabled = high;
  city.setShadowsEnabled(high);
  scene.traverse((obj) => { if (obj.material) obj.material.needsUpdate = true; });
  document.getElementById('btnQuality').textContent = 'QUALITY: ' + (high ? 'HIGH' : 'LOW');
}

function bindMenus() {
  document.getElementById('btnStart').addEventListener('click', () => { clearSaveGame(); startGame(false); });
  document.getElementById('btnContinue').addEventListener('click', () => startGame(true));
  document.getElementById('btnResume').addEventListener('click', () => { gameState = 'playing'; hud.hidePause(); });
  document.getElementById('btnSave').addEventListener('click', () => { persistGame(); hud.feed('GAME SAVED'); });
  document.getElementById('btnQuality').addEventListener('click', () => setQuality(!qualityHigh));
  document.getElementById('btnRestart').addEventListener('click', () => { clearSaveGame(); window.location.reload(); });
  document.getElementById('btnBusted').addEventListener('click', () => { hud.hideBusted(); respawnAfterIncident('busted'); });
  document.getElementById('btnWasted').addEventListener('click', () => { hud.hideWasted(); respawnAfterIncident('wasted'); });
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Deterministic staging for screenshots and automated checks. Runs only
// when ?shot= is present; normal play never touches this path.
function stageShot(kind) {
  hud.hideStart();
  hud.showHud();
  input.enabled = true;
  gameState = 'playing';
  document.getElementById('fadeBlack').style.opacity = '0';
  const enterCarById = (id) => {
    const car = parked.find((c) => c.id === id);
    if (car) { player.enterCar(car); player.ownedCars.add(car.id); player.x = car.x; player.z = car.z; }
    return car;
  };
  if (kind === 'cover') {
    elapsed = TUNING.nightSeconds * 0.25;
    const car = enterCarById('stageCometa');
    if (car) { car.x = 0; car.z = -60; car.heading = Math.PI; car.speed = 24; car.syncMesh(); player.x = 0; player.z = -60; }
    camYaw = Math.PI; camPitch = 0.3;
    wanted.setStars(3);
    police.spawnNear(0, -60); police.spawnNear(0, -60); police.spawnNear(0, -60);
    const spots = [[5, -108], [-5, -118], [4, -18]];
    police.units.forEach((u, i) => {
      if (spots[i]) { u.x = spots[i][0]; u.z = spots[i][1]; u.heading = Math.atan2(player.x - u.x, player.z - u.z); u.syncMesh(); }
    });
    missions.missionIndex = 1; missions.stepIndex = 0; missions.active = true;
    missions.stepStarted = false;
    const m = missions.currentMission();
    hud.showBanner(m.title, 'GATE 1 / 5  •  2:30 LEFT');
    city.setCheckpointGates(m.steps[0].gates);
    city.setActiveGate(0);
    marker = { x: 0, z: -150 };
    city.setBeacon(0, -150, true, 0xffd23e);
    hud.feed('LUMEN FM: THE LOOP IS LIVE!');
    cash = 940; rep = 12;
  } else if (kind === 'city') {
    elapsed = TUNING.nightSeconds * 0.12;
    player.x = 8; player.z = 34; player.heading = Math.PI;
    camYaw = Math.PI; camPitch = 0.3;
    missions.missionIndex = 0; missions.stepIndex = 0; missions.active = true;
    missions.stepStarted = false;
    hud.showBanner(MISSIONS[0].title, MISSIONS[0].steps[0].label);
    marker = { x: 16, z: 27 };
    city.setBeacon(16, 27, true, 0xffd23e);
    cash = 120; rep = 0;
  } else if (kind === 'drive') {
    elapsed = TUNING.nightSeconds * 0.3;
    const car = enterCarById('garageCometa');
    if (car) { car.x = -100; car.z = 150; car.heading = Math.PI / 2; car.speed = 26; car.syncMesh(); player.x = -100; player.z = 150; }
    camYaw = Math.PI / 2; camPitch = 0.28;
    missions.missionIndex = 1; missions.stepIndex = 0; missions.active = true;
    missions.stepStarted = false;
    hud.showBanner('FREE ROAM — MARINA LUZ', 'Cruise the boardwalk. Tokens glow gold.');
    cash = 640; rep = 8; tokensTaken = 3;
    city.tokens[5].taken = true; city.tokens[5].mesh.visible = false;
    city.tokens[6].taken = true; city.tokens[6].mesh.visible = false;
    city.tokens[7].taken = true; city.tokens[7].mesh.visible = false;
  } else if (kind === 'mission') {
    elapsed = TUNING.nightSeconds * 0.58;
    player.x = 130; player.z = 58; player.heading = Math.PI / 2;
    camYaw = Math.PI / 2; camPitch = 0.3;
    wanted.setStars(1);
    enemies.spawnCrew();
    missions.missionIndex = 2; missions.stepIndex = 1; missions.active = true;
    missions.stepStarted = true;
    hud.showBanner(MISSIONS[2].title, 'Take down the Hollow Tides crew');
    marker = { x: 158, z: 58 };
    city.setBeacon(158, 58, true, 0xff5b6e);
    cash = 1540; rep = 18;
    hud.feed('HOLLOW TIDES CREW SPOTTED AT THE DOCKS');
  }
  player.syncMesh();
  updateCamera(0.05);
  setTimeout(() => { window.__shotReady = true; }, 600);
}

bindMenus();
hud.showStart(hasSaveGame());
if (SHOT) stageShot(SHOT);
else if (params.get('autostart') === '1') startGame(false);
gameLoop();

// Hooks for automated verification. Read-only from outside except the
// small staging helpers the playtest uses; normal players never see them.
window.__game = {
  player, wanted, missions, police, traffic, parked, enemies, peds, city, hud, input,
  get state() { return gameState; },
  get cash() { return cash; },
  get elapsed() { return elapsed; },
  get camYaw() { return camYaw; },
  startGame, stageShot, tryEnterOrSteal, shootWeapon, punchAttack, persistGame,
  setWanted(n) { wanted.setStars(n); },
  teleport(x, z) { if (player.inCar) { player.inCar.x = x; player.inCar.z = z; player.inCar.syncMesh(); } player.x = x; player.z = z; player.syncMesh(); },
};

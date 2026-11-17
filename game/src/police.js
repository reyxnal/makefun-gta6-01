// Solmar Heat — wanted level and police. One job: turn crimes into stars,
// spawn police cars that chase and ram, and let the heat cool off.
import { MAX_WANTED, WANTED_DECAY_SECONDS, PALETTE, dist, clamp } from './config.js';
import { makeCar, driveCar, collideCars } from './entities.js';
import { nearestRoadPoint } from './city.js';
import { setSiren } from './audio.js';

const CRIME_HEAT = {
  'steal': 1,
  'hit-ped': 2,
  'shoot': 1,
  'ram-police': 1,
  'speeding': 0,
};

export function addWanted(state, crime) {
  const heat = CRIME_HEAT[crime] || 0;
  if (heat <= 0) return;
  state.wanted = clamp(state.wanted + heat, 0, MAX_WANTED);
  state.wantedTimer = WANTED_DECAY_SECONDS;
  state.lastCrime = crime;
  if (state.wanted >= 1) state.message = `WANTED LEVEL ${state.wanted} — polisi mengejarmu!`;
  syncPolice(state);
}

export function policeTargetCount(wanted) {
  return wanted <= 0 ? 0 : wanted <= 1 ? 1 : wanted <= 2 ? 2 : wanted <= 3 ? 3 : wanted <= 4 ? 4 : 6;
}

function syncPolice(state) {
  const want = policeTargetCount(state.wanted);
  while (state.police.length < want) {
    const a = Math.random() * Math.PI * 2;
    const x = state.player.x + Math.cos(a) * 800;
    const y = state.player.y + Math.sin(a) * 800;
    const p = nearestRoadPoint(state.city, Math.max(150, Math.min(2850, x)), Math.max(150, Math.min(2250, y)));
    const car = makeCar(p ? p.x : x, p ? p.y : y, 0, PALETTE.police, 'police');
    car.siren = true;
    car.cruise = 420;
    state.police.push(car);
  }
  while (state.police.length > want) state.police.pop();
  setSiren(state.police.length > 0);
}

// Police chase: steer toward the player, ram their car, or chase on foot.
export function updatePolice(state, dt) {
  const { police, player, city } = state;
  if (state.wanted > 0) {
    state.wantedTimer -= dt;
    if (state.wantedTimer <= 0 && !state.playerInDanger) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.wantedTimer = WANTED_DECAY_SECONDS;
      syncPolice(state);
      if (state.wanted === 0) state.message = 'Panas mereda. Polisi kehilangan jejakmu.';
    }
  }
  const target = player.car || player;
  for (let i = 0; i < police.length; i += 1) {
    const car = police[i];
    const d = dist(car.x, car.y, target.x, target.y);
    if (d > 1600) {
      const a = Math.random() * Math.PI * 2;
      const p = nearestRoadPoint(city, player.x + Math.cos(a) * 700, player.y + Math.sin(a) * 700);
      if (p) {
        car.x = p.x;
        car.y = p.y;
      }
      continue;
    }
    const desired = Math.atan2(target.y - car.y, target.x - car.x);
    let steer = 0;
    const diff = ((desired - car.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (diff > 0.08) steer = 1;
    else if (diff < -0.08) steer = -1;
    const throttle = d > 60 ? 1 : 0.3;
    driveCar(car, throttle, steer, dt, city, false);
    if (player.car && collideCars(car, player.car)) {
      state.crime('ram-police');
      player.car.hp -= 2;
    }
    if (!player.car && d < 34) {
      // Busted on foot: the officer tackles the player.
      state.player.health -= 18 * dt;
      state.message = 'Polisi menangkapmu! Lari!';
    }
  }
  for (let i = 0; i < police.length; i += 1) {
    for (let j = i + 1; j < police.length; j += 1) collideCars(police[i], police[j]);
    for (let j = 0; j < state.traffic.length; j += 1) collideCars(police[i], state.traffic[j]);
  }
}

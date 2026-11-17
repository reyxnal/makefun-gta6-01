// Solmar Heat — rendering. One job: draw the world, the HUD, the minimap and
// the menus on one canvas. Nothing here changes game state.
import { WORLD_W, WORLD_H, ROAD_W, BEACH_X, SEA_X, PALETTE, MISSIONS } from './config.js';
import { missionMarker } from './missions.js';

export function resizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  return { w, h, dpr };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, state, view) {
  const { city, camera } = state;
  const { w, h, dpr } = view;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  // Sun-soaked sky tint behind everything.
  ctx.fillStyle = '#ffe9b8';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 - camera.x, h / 2 - camera.y);

  // Ground: grass, then sand and sea on the east edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(camera.x - w / 2 - 40, camera.y - h / 2 - 40, w + 80, h + 80);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, 0, SEA_X - BEACH_X, WORLD_H);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(SEA_X, 0, WORLD_W - SEA_X, WORLD_H);
  ctx.fillStyle = PALETTE.seaDeep;
  for (let y = 0; y < WORLD_H; y += 130) {
    ctx.fillRect(SEA_X + 30, y + 40, 180, 8);
  }

  // Parks.
  for (let i = 0; i < city.parks.length; i += 1) {
    const p = city.parks[i];
    ctx.fillStyle = PALETTE.park;
    roundRect(ctx, p.x, p.y, p.w, p.h, 18);
    ctx.fill();
    ctx.fillStyle = '#5d8f43';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Roads + sidewalks + lane dashes.
  ctx.fillStyle = PALETTE.sidewalk;
  for (let i = 0; i < city.vRoads.length; i += 1) {
    ctx.fillRect(city.vRoads[i] - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD_H);
  }
  for (let i = 0; i < city.hRoads.length; i += 1) {
    ctx.fillRect(0, city.hRoads[i] - ROAD_W / 2 - 14, BEACH_X, ROAD_W + 28);
  }
  ctx.fillStyle = PALETTE.road;
  for (let i = 0; i < city.vRoads.length; i += 1) {
    ctx.fillRect(city.vRoads[i] - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  }
  for (let i = 0; i < city.hRoads.length; i += 1) {
    ctx.fillRect(0, city.hRoads[i] - ROAD_W / 2, BEACH_X, ROAD_W);
  }
  ctx.fillStyle = PALETTE.lane;
  for (let i = 0; i < city.vRoads.length; i += 1) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(city.vRoads[i] - 2, y, 4, 30);
  }
  for (let i = 0; i < city.hRoads.length; i += 1) {
    for (let x = 0; x < BEACH_X; x += 64) ctx.fillRect(x, city.hRoads[i] - 2, 30, 4);
  }

  // Buildings with roof, wall edge and a sun shadow.
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 8);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h / 2 - 6, 12, 12);
    }
  }

  // Palms.
  for (let i = 0; i < city.palms.length; i += 1) {
    const p = city.palms[i];
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(p.x - 2, p.y - 2, 4, 12);
    ctx.fillStyle = '#2f9e44';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40c057';
    ctx.beginPath();
    ctx.arc(p.x - 4, p.y - 8, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPickups(ctx, state);
  drawCars(ctx, state);
  drawPeds(ctx, state);
  drawGuards(ctx, state);
  drawPlayer(ctx, state);
  drawTracers(ctx, state);
  drawMarker(ctx, state);

  ctx.restore();
  drawHud(ctx, state, view);
  ctx.restore();
}

function drawCars(ctx, state) {
  const all = [...state.traffic, ...state.police];
  for (let i = 0; i < all.length; i += 1) drawCar(ctx, all[i], false);
}

function drawCar(ctx, car, isPlayer) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -car.length / 2 + 4, -car.width / 2 + 5, car.length, car.width, 8);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, -8, -car.width / 2 + 4, 20, car.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(car.length / 2 - 8, -car.width / 2 + 3, 4, 6);
  ctx.fillRect(car.length / 2 - 8, car.width / 2 - 9, 4, 6);
  if (car.bodyType === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -car.width / 2 - 2, 12, 5);
    ctx.fillStyle = '#f2c200';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -car.width / 2 + 2);
  }
  if (car.bodyType === 'sport') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-car.length / 2 - 3, -car.width / 2 + 2, 4, car.width - 4);
  }
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(-car.length / 2, -car.width / 2 + 2, 4, 6);
    ctx.fillRect(-car.length / 2, car.width / 2 - 8, 4, 6);
  }
  if (car.kind === 'police' || car.siren) {
    const t = (performance.now() / 300) % 2;
    ctx.fillStyle = t < 1 ? '#ff2222' : '#2266ff';
    ctx.beginPath();
    ctx.arc(-4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, -car.width / 2 - 6);
  }
  if (car.targetCar) {
    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▼ TARGET', 0, -car.width / 2 - 8);
  }
  ctx.restore();
}

function drawPeds(ctx, state) {
  for (let i = 0; i < state.peds.length; i += 1) {
    const p = state.peds[i];
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4 - 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGuards(ctx, state) {
  for (let i = 0; i < state.guards.length; i += 1) {
    const g = state.guards[i];
    if (!g.alive) continue;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(-11, -16, 22, 4);
    ctx.fillStyle = '#51cf66';
    ctx.fillRect(-11, -16, 22 * Math.max(0, g.health / 50), 4);
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(Math.cos(g.angle) * 5, Math.sin(g.angle) * 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.car) {
    drawCar(ctx, p.car, true);
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invulnerable > 0 && Math.floor(p.invulnerable * 12) % 2 === 0) ctx.globalAlpha = 0.4;
  const bob = p.moving ? Math.sin(performance.now() / 90) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e03131';
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe8cc';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5 - 1, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5 - 4, 6, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPickups(ctx, state) {
  for (let i = 0; i < state.pickups.length; i += 1) {
    const pk = state.pickups[i];
    if (pk.taken) continue;
    const y = pk.y + Math.sin(pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, y);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2b8a3e';
      roundRect(ctx, -10, -7, 20, 14, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e03131';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    } else {
      ctx.fillStyle = '#f2c200';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', 0, 3);
    }
    ctx.restore();
  }
}

function drawTracers(ctx, state) {
  for (let i = 0; i < state.tracers.length; i += 1) {
    const t = state.tracers[i];
    ctx.strokeStyle = t.enemy ? 'rgba(255,80,80,0.9)' : 'rgba(255,220,80,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  for (let i = 0; i < state.hitMarkers.length; i += 1) {
    const hm = state.hitMarkers[i];
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hm.x - 8, hm.y);
    ctx.lineTo(hm.x + 8, hm.y);
    ctx.moveTo(hm.x, hm.y - 8);
    ctx.lineTo(hm.x, hm.y + 8);
    ctx.stroke();
  }
}

function drawMarker(ctx, state) {
  const mk = missionMarker(state);
  if (!mk || state.screen !== 'play') return;
  const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
  ctx.save();
  ctx.translate(mk.x, mk.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ffd43b';
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(12, -12);
  ctx.lineTo(-12, -12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffd43b';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffd43b';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mk.label, 0, -44);
  ctx.restore();
  // Off-screen direction arrow at the screen edge.
  const p = state.player;
  const dx = mk.x - p.x;
  const dy = mk.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d > 500) {
    const a = Math.atan2(dy, dx);
    const ex = state.camera.x + Math.cos(a) * 300;
    const ey = state.camera.y + Math.sin(a) * 200;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,212,59,0.9)';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -9);
    ctx.lineTo(-8, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawHud(ctx, state, view) {
  const { w, h } = view;
  const p = state.player;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'left';
  // Cash + health, top left.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 220, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#51cf66';
  ctx.fillText('$' + p.money.toLocaleString('en-US'), 24, 38);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText('AMMO ' + p.ammo, 24, 60);
  ctx.fillStyle = '#343a40';
  ctx.fillRect(110, 50, 100, 12);
  ctx.fillStyle = p.health > 30 ? '#51cf66' : '#e03131';
  ctx.fillRect(110, 50, 100 * Math.max(0, p.health / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('HP', 110, 47);

  // Wanted stars, top right.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, w - 212, 12, 200, 44, 10);
  ctx.fill();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? '#ffd43b' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', w - 190 + i * 36, 44);
  }

  // Mission objective, bottom centre.
  const m = state.mission;
  if (m && state.screen === 'play') {
    const text = m.def.objective;
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, w / 2 - tw / 2, h - 96, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.textAlign = 'center';
    ctx.fillText('◆ ' + text, w / 2, h - 73);
    const d = Math.round(Math.hypot(p.x - m.def.x, p.y - m.def.y));
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(m.def.title + '  •  ' + d + 'm' + (m.timer > 0 ? '  •  ' + Math.ceil(m.timer) + ' dtk' : ''), w / 2, h - 52);
  }

  // Speed when driving.
  if (p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, w - 132, h - 96, 120, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + '', w - 72, h - 62);
    ctx.font = '12px sans-serif';
    ctx.fillText('km/jam', w - 72, h - 46);
  }

  // Message toast.
  if (state.message && state.messageTimer > 0) {
    ctx.font = 'bold 17px sans-serif';
    const tw = ctx.measureText(state.message).width + 30;
    ctx.fillStyle = 'rgba(20,20,30,0.75)';
    roundRect(ctx, w / 2 - tw / 2, 70, tw, 36, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, w / 2, 94);
  }

  // Dialogue box (right of the minimap, so the two never overlap).
  if (state.dialogue && state.dialogueTimer > 0) {
    ctx.fillStyle = 'rgba(10,10,20,0.78)';
    roundRect(ctx, 200, h - 182, w - 224, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.dialogue[0], 216, h - 156);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(state.dialogue[1], 216, h - 132);
  }

  // Controls hint.
  if (state.screen === 'play' && state.hintTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD jalan / nyetir • E masuk-keluar mobil • Klik tembak • Spasi pukul • M bisu • Esc jeda', 14, h - 14);
  }

  drawMinimap(ctx, state, view);
}

function drawMinimap(ctx, state, view) {
  const { w, h } = view;
  const size = 168;
  const mx = 14;
  const my = h - size - 14;
  const sx = size / WORLD_W;
  const sy = size / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, mx - 4, my - 4, size + 8, size + 8, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  ctx.fillStyle = '#7fae5a';
  ctx.fillRect(mx, my, size, size);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(mx + BEACH_X * sx, my, (WORLD_W - BEACH_X) * sx, size);
  ctx.fillStyle = '#2f9dc4';
  ctx.fillRect(mx + SEA_X * sx, my, (WORLD_W - SEA_X) * sx, size);
  ctx.fillStyle = '#3a3f4a';
  for (let i = 0; i < state.city.vRoads.length; i += 1) {
    ctx.fillRect(mx + state.city.vRoads[i] * sx - 2, my, 4, size);
  }
  for (let i = 0; i < state.city.hRoads.length; i += 1) {
    ctx.fillRect(mx, my + state.city.hRoads[i] * sy - 2, size, 4);
  }
  const mk = missionMarker(state);
  if (mk) {
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(mx + mk.x * sx, my + mk.y * sy, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < state.police.length; i += 1) {
    ctx.fillStyle = '#2266ff';
    ctx.fillRect(mx + state.police[i].x * sx - 2, my + state.police[i].y * sy - 2, 5, 5);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e03131';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR BAY', mx, my - 8);
}

export function drawMenu(ctx, state, view) {
  const { w, h } = view;
  ctx.fillStyle = '#0f2a43';
  ctx.fillRect(0, 0, w, h);
  // Sun-soaked gradient sky.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#ff9e57');
  g.addColorStop(0.45, '#ffd43b');
  g.addColorStop(1, '#2f9dc4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(w - 180, 130, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, h - 190, w, 190);
  ctx.fillStyle = '#1b2a3a';
  for (let i = 0; i < 14; i += 1) {
    const bw = 60 + ((i * 37) % 50);
    const bh = 60 + ((i * 53) % 110);
    ctx.fillRect(30 + i * 92, h - 190 - bh + 110, bw, bh);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR HEAT', w / 2, 170);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#7a2e00';
  ctx.fillText('Getaway Driver of Solmar Bay', w / 2, 210);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Kota matahari. Lima misi. Satu pengkhianatan. Lari atau lawan.', w / 2, 250);
  const buttons = state.menuButtons;
  for (let i = 0; i < buttons.length; i += 1) {
    const b = buttons[i];
    ctx.fillStyle = b.hover ? '#ffd43b' : 'rgba(0,0,0,0.55)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.fillStyle = b.hover ? '#111' : '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 32);
  }
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('WASD gerak • E masuk / curi mobil • Klik kiri tembak • Spasi pukul • Esc jeda • M bisu', w / 2, h - 60);
  ctx.fillText('Simpan otomatis tiap misi selesai. Semua orisinal — kota, nama, dan cerita buatan sendiri.', w / 2, h - 34);
}

export function drawOverlay(ctx, state, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  if (state.screen === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('JEDA', w / 2, h / 2 - 20);
    ctx.font = '16px sans-serif';
    ctx.fillText('Esc untuk lanjut • Misi tersimpan otomatis', w / 2, h / 2 + 20);
  } else if (state.screen === 'wasted') {
    ctx.fillStyle = '#e03131';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('WASTED', w / 2, h / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Klik untuk coba lagi dari misi terakhir', w / 2, h / 2 + 20);
  } else if (state.screen === 'won') {
    ctx.fillStyle = '#ffd43b';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('SOLMAR HEAT — TAMAT', w / 2, h / 2 - 30);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('Rae Vega menghilang ke laut. Total uang: $' + state.player.money.toLocaleString('en-US'), w / 2, h / 2 + 10);
    ctx.font = '15px sans-serif';
    ctx.fillText('Klik untuk main lagi dari awal', w / 2, h / 2 + 44);
  } else if (state.screen === 'failed') {
    ctx.fillStyle = '#ff922b';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('MISI GAGAL', w / 2, h / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Klik untuk mengulang misi ini', w / 2, h / 2 + 20);
  }
}

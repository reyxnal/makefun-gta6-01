// Canvas 2D renderer: a top-down city with fake-3D extruded buildings,
// day/night lighting, sun-angle shadows, animated water, headlights,
// sirens and particles. The static ground (roads, blocks, beach) is
// pre-rendered once to an offscreen canvas; everything else is drawn
// per frame with view culling.

import { WORLD, PALETTE, clamp, lerp } from './config.js';
import { buildingsNear, isWater } from './city.js';

const GROUND_SCALE = 0.5;

export function sunInfo(timeOfDay) {
  // Returns light level 0..1 and shadow direction/length.
  const t = timeOfDay;
  let light;
  if (t < 5.5 || t > 20.5) light = 0.12;
  else if (t < 7) light = lerp(0.12, 0.9, (t - 5.5) / 1.5);
  else if (t < 18) light = 0.95;
  else if (t < 20.5) light = lerp(0.95, 0.12, (t - 18) / 2.5);
  else light = 0.12;
  const sunAngle = ((t - 6) / 12) * Math.PI; // east -> west
  const shadowLen = clamp(1.2 - light, 0.15, 1.1);
  return {
    light,
    shadowX: Math.cos(sunAngle + Math.PI / 2) * shadowLen,
    shadowY: Math.sin(sunAngle + Math.PI / 2) * shadowLen * 0.6 + 0.35,
  };
}

export function buildGroundLayer(city) {
  const w = WORLD.size * GROUND_SCALE, h = WORLD.size * GROUND_SCALE;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.scale(GROUND_SCALE, GROUND_SCALE);
  // Base ground.
  g.fillStyle = PALETTE.grass;
  g.fillRect(0, 0, WORLD.size, WORLD.size);
  // Block bases (dirt/concrete under buildings).
  const centers = city.centers;
  for (let i = 0; i < centers.length - 1; i++) {
    for (let j = 0; j < centers.length - 1; j++) {
      const x0 = centers[i] + WORLD.roadHalf;
      const y0 = centers[j] + WORLD.roadHalf;
      const x1 = centers[i + 1] - WORLD.roadHalf;
      const y1 = centers[j + 1] - WORLD.roadHalf;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const district = city.buildings.find((b) => Math.abs(b.x + b.w / 2 - cx) < 60 && Math.abs(b.y + b.h / 2 - cy) < 60)?.district;
      g.fillStyle = district === 'Verde Park' ? '#6fae62' : PALETTE.sidewalk;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Beach sand.
  g.fillStyle = PALETTE.sand;
  g.fillRect(0, WORLD.beachY, WORLD.size, WORLD.size - WORLD.beachY);
  // Water base.
  g.fillStyle = PALETTE.water;
  g.fillRect(0, WORLD.waterY, WORLD.size, WORLD.size - WORLD.waterY);
  g.fillRect(WORLD.waterX, 0, WORLD.size - WORLD.waterX, WORLD.size);
  // Boardwalk strip.
  g.fillStyle = '#b98d5e';
  g.fillRect(0, WORLD.beachY - 14, WORLD.size, 14);
  // Roads.
  g.fillStyle = PALETTE.asphalt;
  for (const c of centers) {
    g.fillRect(c - WORLD.roadHalf, 0, WORLD.roadHalf * 2, WORLD.size);
    g.fillRect(0, c - WORLD.roadHalf, WORLD.size, WORLD.roadHalf * 2);
  }
  // Lane dashes.
  g.fillStyle = PALETTE.laneDash;
  for (const c of centers) {
    for (let d = 40; d < WORLD.size; d += 64) {
      g.fillRect(c - 2, d, 4, 26);
      g.fillRect(d, c - 2, 26, 4);
    }
  }
  // Crosswalks at intersections.
  g.fillStyle = 'rgba(232,228,210,0.55)';
  for (const cx of centers) {
    for (const cy of centers) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(cx + k * 14 - 4, cy - WORLD.roadHalf + 4, 8, 10);
        g.fillRect(cx + k * 14 - 4, cy + WORLD.roadHalf - 14, 8, 10);
        g.fillRect(cx - WORLD.roadHalf + 4, cy + k * 14 - 4, 10, 8);
        g.fillRect(cx + WORLD.roadHalf - 14, cy + k * 14 - 4, 10, 8);
      }
    }
  }
  return cv;
}

function viewRect(S) {
  const vw = S.view.w / S.camera.zoom, vh = S.view.h / S.camera.zoom;
  return {
    x: S.camera.x - vw / 2 - 120, y: S.camera.y - vh / 2 - 120,
    w: vw + 240, h: vh + 240,
  };
}

function inView(v, x, y, r = 0) {
  return x + r > v.x && x - r < v.x + v.w && y + r > v.y && y - r < v.y + v.h;
}

export function drawWorld(S, ctx) {
  const { camera, view } = S;
  const sun = sunInfo(S.timeOfDay);
  // Keep the camera inside the world so no void shows at the edges.
  const vw = view.w / camera.zoom, vh = view.h / camera.zoom;
  camera.x = clamp(camera.x, vw / 2 - 60, WORLD.size - vw / 2 + 60);
  camera.y = clamp(camera.y, vh / 2 - 60, WORLD.size - vh / 2 + 60);
  const v = viewRect(S);
  ctx.save();
  ctx.fillStyle = '#16323e';
  ctx.fillRect(0, 0, view.w, view.h);
  // Camera transform with shake.
  const shakeX = (Math.random() - 0.5) * camera.shake;
  const shakeY = (Math.random() - 0.5) * camera.shake;
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x + shakeX, -camera.y + shakeY);

  // Ground layer.
  ctx.drawImage(S.groundLayer, 0, 0, WORLD.size, WORLD.size);
  drawWater(S, ctx, v);
  drawSkids(S, ctx, v);
  drawPiers(S, ctx, v);
  drawProps(S, ctx, v, sun);
  drawBuildings(S, ctx, v, sun);
  drawTrees(S, ctx, v, sun);
  drawCctv(S, ctx, v);
  drawPackages(S, ctx, v);
  drawPickups(S, ctx, v);
  drawJumps(S, ctx, v);
  drawCars(S, ctx, v, sun);
  drawPeds(S, ctx, v, sun);
  drawPlayer(S, ctx, v, sun);
  drawBullets(S, ctx, v);
  drawParticles(S, ctx, v);
  drawMissionMarker(S, ctx, v);
  ctx.restore();

  drawLighting(S, ctx, sun);
  drawVignette(S, ctx);
}

function drawWater(S, ctx, v) {
  const t = S.time;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  const x0 = Math.max(v.x, 0), x1 = Math.min(v.x + v.w, WORLD.size);
  // Southern water.
  for (let y = WORLD.waterY + 30; y < WORLD.size; y += 46) {
    if (y < v.y || y > v.y + v.h) continue;
    ctx.beginPath();
    for (let x = x0; x < x1; x += 18) {
      const yy = y + Math.sin(x * 0.02 + t * 1.4 + y) * 3;
      if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Eastern water.
  for (let x = WORLD.waterX + 30; x < WORLD.size; x += 46) {
    if (x < v.x || x > v.x + v.w) continue;
    ctx.beginPath();
    for (let y = Math.max(v.y, 0); y < Math.min(v.y + v.h, WORLD.size); y += 18) {
      const xx = x + Math.sin(y * 0.02 + t * 1.2 + x) * 3;
      if (y === Math.max(v.y, 0)) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
    }
    ctx.stroke();
  }
  // Shore foam.
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  for (let x = x0; x < x1; x += 12) {
    const yy = WORLD.waterY + Math.sin(x * 0.03 + t * 2) * 3;
    if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
  }
  ctx.stroke();
}

function drawSkids(S, ctx, v) {
  ctx.fillStyle = 'rgba(20,20,20,0.5)';
  for (const s of S.skids) {
    if (!inView(v, s.x, s.y, 20)) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = clamp(s.life / 6, 0, 0.6);
    ctx.fillRect(-12, -8, 24, 4);
    ctx.fillRect(-12, 4, 24, 4);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPiers(S, ctx, v) {
  for (const p of S.city.piers) {
    if (!inView(v, p.x + p.w / 2, p.y + p.h / 2, 120)) continue;
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let x = p.x + 12; x < p.x + p.w; x += 24) ctx.fillRect(x, p.y, 2, p.h);
  }
  for (const b of S.city.boats) {
    if (!inView(v, b.x, b.y, 60)) continue;
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(S.time * 1.3 + b.x) * 2);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-8, -6, 16, 12);
    ctx.restore();
  }
}

function drawProps(S, ctx, v, sun) {
  for (const pr of S.city.props) {
    if (!inView(v, pr.x, pr.y, 40)) continue;
    if (pr.kind === 'bench') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(pr.x - 14 + sun.shadowX * 6, pr.y - 4 + sun.shadowY * 6, 28, 8);
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(pr.x - 14, pr.y - 5, 28, 10);
    } else if (pr.kind === 'fountain') {
      ctx.fillStyle = '#9ab8c8';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9f0ff';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.55 + Math.sin(S.time * 3) * 2, 0, Math.PI * 2); ctx.fill();
    } else if (pr.kind === 'umbrella') {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(pr.x + 6, pr.y + 6, 18, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Lamps.
  for (const l of S.city.lamps) {
    if (!inView(v, l.x, l.y, 30)) continue;
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    if (sun.light < 0.5) {
      ctx.fillStyle = 'rgba(255, 230, 150, 0.9)';
      ctx.beginPath(); ctx.arc(l.x, l.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Palms on the beach.
  for (const pl of S.city.palms) {
    if (!inView(v, pl.x, pl.y, 50)) continue;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pl.x + sun.shadowX * 22, pl.y + sun.shadowY * 22);
    ctx.lineTo(pl.x + pl.lean * 30 + sun.shadowX * 22, pl.y - 26 + sun.shadowY * 22);
    ctx.stroke();
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pl.x, pl.y);
    ctx.lineTo(pl.x + pl.lean * 30, pl.y - 26);
    ctx.stroke();
    ctx.fillStyle = '#3f8a4f';
    const tx = pl.x + pl.lean * 30, ty = pl.y - 26;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + S.time * 0.1;
      ctx.beginPath();
      ctx.ellipse(tx + Math.cos(a) * 12, ty + Math.sin(a) * 8, 13, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBuildings(S, ctx, v, sun) {
  const list = buildingsNear(S.city, S.camera.x, S.camera.y, Math.max(v.w, v.h) * 0.75);
  list.sort((a, b) => (a.y + a.h) - (b.y + b.h));
  const night = sun.light < 0.5;
  for (const b of list) {
    if (!inView(v, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    const shx = sun.shadowX * b.hgt * 0.55, shy = sun.shadowY * b.hgt * 0.55;
    // Shadow.
    ctx.fillStyle = 'rgba(20,24,32,0.28)';
    ctx.fillRect(b.x + shx, b.y + shy, b.w, b.h);
    // South + east walls (extrusion).
    const ex = 9, ey = 11;
    ctx.fillStyle = shade(b.wall, -28);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + ex, b.y + b.h + ey); ctx.lineTo(b.x + ex, b.y + b.h + ey);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = shade(b.wall, -14);
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w + ex, b.y + ey);
    ctx.lineTo(b.x + b.w + ex, b.y + b.h + ey); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath(); ctx.fill();
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Inner roof border + skylights + vents so roofs read as places.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    ctx.fillStyle = 'rgba(160,190,205,0.55)';
    ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, 18, 12);
    ctx.fillRect(b.x + b.w * 0.62, b.y + b.h * 0.55, 14, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 14, 10);
    ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.6, 12, 12);
    // Tall towers get a rooftop ring.
    if (b.hgt > 95) {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Lit windows at night on the south wall.
    if (night && b.lit) {
      ctx.fillStyle = 'rgba(255, 220, 130, 0.85)';
      const n = Math.floor(b.w / 26);
      for (let i = 0; i < n; i++) {
        if ((i * 7 + Math.floor(b.x)) % 3 === 0) continue;
        ctx.fillRect(b.x + 8 + i * 26, b.y + b.h + 2, 12, 5);
      }
    }
    // Neon sign.
    if (b.neon) {
      ctx.save();
      ctx.shadowColor = b.neon;
      ctx.shadowBlur = night ? 14 : 5;
      ctx.fillStyle = b.neon;
      ctx.fillRect(b.x + b.w / 2 - 4, b.y - 4, 8, 6);
      ctx.restore();
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255);
  const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
  const b = clamp((n & 0xff) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawTrees(S, ctx, v, sun) {
  for (const t of S.city.trees) {
    if (!inView(v, t.x, t.y, 40)) continue;
    ctx.fillStyle = 'rgba(20,24,32,0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x + sun.shadowX * 16, t.y + sun.shadowY * 16, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a4a2e';
    ctx.beginPath(); ctx.arc(t.x, t.y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a8a3f';
    ctx.beginPath(); ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5da34f';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.35, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCctv(S, ctx, v) {
  for (const c of S.city.cctv) {
    if (!inView(v, c.x, c.y, 320)) continue;
    // View cone (faint red when live, grey when disabled).
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, 260, c.angle - 0.6, c.angle + 0.6);
    ctx.closePath();
    ctx.fillStyle = c.disabled ? 'rgba(120,120,120,0.05)' : 'rgba(255,80,80,0.07)';
    ctx.fill();
    ctx.fillStyle = '#2d3a4a';
    ctx.fillRect(c.x - 3, c.y - 3, 6, 6);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(0, -4, 14, 8);
    ctx.restore();
    if (!c.disabled) {
      const blink = Math.sin(S.time * 3 + c.blink) > 0;
      ctx.fillStyle = blink ? '#ff4444' : '#7a2020';
      ctx.beginPath(); ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPackages(S, ctx, v) {
  for (const pk of S.city.packages) {
    if (pk.taken || !inView(v, pk.x, pk.y, 40)) continue;
    const pulse = 1 + Math.sin(S.time * 3 + pk.id) * 0.25;
    ctx.save();
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(pk.x - 6 * pulse, pk.y - 6 * pulse, 12 * pulse, 12 * pulse);
    ctx.restore();
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(pk.x - 2, pk.y - 6 * pulse, 4, 12 * pulse);
  }
}

function drawPickups(S, ctx, v) {
  for (const pk of S.pickups) {
    if (pk.taken || !inView(v, pk.x, pk.y, 40)) continue;
    const bob = Math.sin(S.time * 2.5 + pk.x) * 3;
    const colors = { ledger: '#7be0a3', drive: '#37e0d8', health: '#ff6b6b', armor: '#4f7ad9', cash: '#ffd166' };
    ctx.save();
    ctx.shadowColor = colors[pk.kind] || '#fff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = colors[pk.kind] || '#fff';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : '$', pk.x, pk.y + bob + 1);
  }
}

function drawJumps(S, ctx, v) {
  for (const j of S.city.jumps) {
    if (!inView(v, j.x, j.y, 60)) continue;
    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.rotate(j.angle);
    ctx.fillStyle = '#e8b64f';
    ctx.beginPath();
    ctx.moveTo(-24, 14); ctx.lineTo(24, 14); ctx.lineTo(14, -14); ctx.lineTo(-14, -14);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * 14 - 3, -10, 6, 20);
    ctx.restore();
  }
}

function drawCarShape(ctx, car, isPlayer, night) {
  const def = car.def;
  const L = def.len, W = def.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(20,24,32,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 5, L * 0.55, W * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14181e';
  const wy = W / 2 - 2;
  const wx = L * 0.3;
  const steer = isPlayer ? car.steer * 0.5 : 0;
  for (const [x, y, front] of [[wx, -wy, true], [wx, wy, true], [-wx, -wy, false], [-wx, wy, false]]) {
    ctx.save();
    ctx.translate(x, y);
    if (front) ctx.rotate(steer);
    ctx.fillRect(-7, -3.5, 14, 7);
    ctx.restore();
  }
  // Body.
  const bodyGrad = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
  bodyGrad.addColorStop(0, shade(car.color, 18));
  bodyGrad.addColorStop(0.5, car.color);
  bodyGrad.addColorStop(1, shade(car.color, -22));
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, -L / 2, -W / 2, L, W, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cabin + windshield.
  ctx.fillStyle = '#22303e';
  roundRect(ctx, -L * 0.12, -W * 0.36, L * 0.3, W * 0.72, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.5)';
  roundRect(ctx, L * 0.1, -W * 0.34, L * 0.08, W * 0.68, 3);
  ctx.fill();
  // Headlights / tail lights.
  ctx.fillStyle = night ? '#fff8d0' : '#f5f0d0';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 7);
  ctx.fillRect(L / 2 - 3, W / 2 - 11, 3, 7);
  ctx.fillStyle = '#d94f4f';
  ctx.fillRect(-L / 2, -W / 2 + 4, 3, 7);
  ctx.fillRect(-L / 2, W / 2 - 11, 3, 7);
  // Taxi sign / police lightbar.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-8, -5, 16, 10);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (car.type === 'patrol') {
    const phase = Math.sin(car.sirenPhase) > 0;
    ctx.fillStyle = phase ? '#ff4444' : '#4488ff';
    ctx.fillRect(-10, -W / 2 + 2, 20, 6);
    ctx.fillStyle = phase ? '#4488ff' : '#ff4444';
    ctx.fillRect(-10, W / 2 - 8, 20, 6);
    ctx.fillStyle = '#e8e4d2';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VPD', 0, 3);
  }
  // Damage: cracks + dents.
  if (car.health < car.maxHealth * 0.5) {
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.moveTo(L * 0.2, -W * 0.3); ctx.lineTo(L * 0.05, 0); ctx.lineTo(L * 0.25, W * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  // Headlight beams at night.
  if (night) {
    const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    const grad = ctx.createRadialGradient(car.x + fx * L * 0.5, car.y + fy * L * 0.5, 8, car.x + fx * L * 0.5, car.y + fy * L * 0.5, 130);
    grad.addColorStop(0, 'rgba(255,244,190,0.35)');
    grad.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(car.x + fx * L * 0.5, car.y + fy * L * 0.5);
    ctx.arc(car.x + fx * L * 0.5, car.y + fy * L * 0.5, 130, car.angle - 0.35, car.angle + 0.35);
    ctx.closePath();
    ctx.fill();
  }
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

function drawCars(S, ctx, v, sun) {
  const night = sun.light < 0.5;
  const cars = S.cars.slice().sort((a, b) => a.y - b.y);
  for (const car of cars) {
    if (car.dead || !inView(v, car.x, car.y, 80)) continue;
    const isPlayer = S.player.car === car;
    // Mission target outline.
    if (car.missionTarget && !isPlayer) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,209,102,' + (0.5 + Math.sin(S.time * 4) * 0.3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(car.x, car.y, car.def.len * 0.65, car.def.wid * 0.8, car.angle, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Stunt-jump airtime: lift the car with a shrinking shadow.
    if (isPlayer && S.side.airTime > 0) {
      const lift = Math.sin((0.9 - S.side.airTime) / 0.9 * Math.PI) * 26;
      ctx.save();
      ctx.translate(0, -lift);
      ctx.scale(1 + lift * 0.004, 1 + lift * 0.004);
      drawCarShape(ctx, car, true, night);
      ctx.restore();
    } else {
      drawCarShape(ctx, car, isPlayer, night);
    }
  }
}

function drawPerson(ctx, x, y, angle, shirt, pants, skin, walkPhase, moving, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(20,24,32,0.28)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  // Legs (two feet stepping).
  const step = moving ? Math.sin(walkPhase) * 4 : 0;
  ctx.fillStyle = pants;
  ctx.fillRect(-4 - step, -6, 7, 5);
  ctx.fillRect(-4 + step, 1, 7, 5);
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arms: forward when aiming/shooting.
  ctx.fillStyle = skin;
  if (opts.aiming) {
    ctx.fillRect(8, -6, 9, 4);
    ctx.fillRect(8, 2, 9, 4);
    if (opts.gun) {
      ctx.fillStyle = '#1c2733';
      ctx.fillRect(16, -2, 8, 3);
    }
  } else {
    ctx.fillRect(2, -10, 6, 4);
    ctx.fillRect(2, 6, 6, 4);
  }
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(2, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair / cap.
  ctx.fillStyle = opts.hair || '#2d2a26';
  ctx.beginPath();
  ctx.arc(-1, 0, 6.5, Math.PI * 0.6, Math.PI * 1.4);
  ctx.fill();
  if (opts.cap) {
    ctx.fillStyle = opts.cap;
    ctx.beginPath(); ctx.arc(2, 0, 7, -Math.PI / 2, Math.PI / 2); ctx.fill();
  }
  ctx.restore();
}

function drawPeds(S, ctx, v, sun) {
  const list = S.peds.slice().sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!inView(v, p.x, p.y, 40)) continue;
    if (p.dead) {
      ctx.fillStyle = 'rgba(20,24,32,0.3)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 13, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.shirt;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 11, 6, p.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const moving = p.speed > 5;
    const aiming = p.kind === 'gull' && p.state === 'combat';
    drawPerson(ctx, p.x, p.y, p.angle, p.shirt, p.pants, p.skin, p.walkPhase, moving, {
      aiming, gun: aiming, cap: p.kind === 'cop' ? '#101820' : null,
      hair: p.kind === 'gull' ? '#3a2d20' : undefined,
    });
    // Witness "!" — the player can SEE who is about to report them.
    if (p.witnessFlash > 0) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 22 - Math.sin(S.time * 8) * 2);
    }
    if (p.helpMe && !p.helped) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', p.x, p.y - 22);
    }
  }
}

function drawPlayer(S, ctx, v, sun) {
  const p = S.player;
  if (p.car || p.hp <= 0) return;
  const aiming = p.weapon !== 'fists' && p.aiming;
  drawPerson(ctx, p.x, p.y, p.angle, '#e8590c', '#2d3a4a', '#e0ac82', p.walkPhase, p.moving, {
    aiming, gun: aiming, hair: '#1c2733',
  });
  // Aim line (short, subtle) when aiming with a gun.
  if (aiming) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
    ctx.lineTo(p.x + Math.cos(p.angle) * 130, p.y + Math.sin(p.angle) * 130);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawBullets(S, ctx, v) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of S.bullets) {
    if (!inView(v, b.x, b.y, 20)) continue;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
}

function drawParticles(S, ctx, v) {
  for (const p of S.particles) {
    if (!inView(v, p.x, p.y, 40)) continue;
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.kind === 'flash') {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a), 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'swipe') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 1.4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawMissionMarker(S, ctx, v) {
  const m = S.missions.marker;
  if (!m) return;
  const bob = Math.sin(S.time * 3) * 5;
  // Beacon column.
  const grad = ctx.createLinearGradient(m.x, m.y - 140, m.x, m.y);
  grad.addColorStop(0, 'rgba(255,209,102,0)');
  grad.addColorStop(1, 'rgba(255,209,102,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(m.x - 10, m.y - 140, 20, 140);
  // Diamond.
  ctx.save();
  ctx.translate(m.x, m.y - 26 + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = m.color || '#ffd166';
  ctx.shadowColor = m.color || '#ffd166';
  ctx.shadowBlur = 12;
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  // Ground ring.
  ctx.strokeStyle = m.color || '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(m.x, m.y, 26 + Math.sin(S.time * 3) * 4, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawLighting(S, ctx, sun) {
  if (sun.light > 0.85) return;
  const { view } = S;
  if (!S.lightCanvas || S.lightCanvas.width !== view.w || S.lightCanvas.height !== view.h) {
    S.lightCanvas = document.createElement('canvas');
    S.lightCanvas.width = view.w;
    S.lightCanvas.height = view.h;
  }
  const lc = S.lightCanvas.getContext('2d');
  const darkness = clamp(0.62 - sun.light * 0.55, 0.08, 0.62);
  lc.globalCompositeOperation = 'source-over';
  lc.clearRect(0, 0, view.w, view.h);
  lc.fillStyle = 'rgba(10,14,34,' + darkness.toFixed(3) + ')';
  lc.fillRect(0, 0, view.w, view.h);
  // Punch light holes: player + nearby lamps + headlights.
  lc.globalCompositeOperation = 'destination-out';
  const toScreen = (x, y) => ({
    x: (x - S.camera.x) * S.camera.zoom + view.w / 2,
    y: (y - S.camera.y) * S.camera.zoom + view.h / 2,
  });
  const punch = (sx, sy, r, strength) => {
    const g = lc.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.beginPath(); lc.arc(sx, sy, r, 0, Math.PI * 2); lc.fill();
  };
  const pp = toScreen(S.player.x, S.player.y);
  punch(pp.x, pp.y, 260, 0.9);
  for (const l of S.city.lamps) {
    const sp = toScreen(l.x, l.y);
    if (sp.x < -80 || sp.x > view.w + 80 || sp.y < -80 || sp.y > view.h + 80) continue;
    punch(sp.x, sp.y, 110, 0.75);
  }
  for (const car of S.cars) {
    if (car.dead) continue;
    const sp = toScreen(car.x, car.y);
    if (sp.x < -160 || sp.x > view.w + 160 || sp.y < -160 || sp.y > view.h + 160) continue;
    punch(sp.x, sp.y, 130, 0.55);
  }
  ctx.drawImage(S.lightCanvas, 0, 0);
}

function drawVignette(S, ctx) {
  const { view } = S;
  // Damage flash.
  if (S.hudFlash > 0) {
    ctx.fillStyle = 'rgba(200,30,30,' + (S.hudFlash * 0.28).toFixed(3) + ')';
    ctx.fillRect(0, 0, view.w, view.h);
  }
  // Soft edge vignette for cinematic feel.
  const g = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.42, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);
}

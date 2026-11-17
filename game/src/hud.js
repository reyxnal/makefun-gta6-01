// DOM HUD: health/armor/cash/clock, wanted stars, weapon + radio, the
// live minimap, toasts, witness banners, the Chatter feed panel, and all
// overlay screens (start, pause, briefing, busted, ending). The world is
// canvas; everything readable at a glance is DOM.

import { WORLD, WEAPONS, districtAt } from './config.js';
import { wantedLabel } from './wanted.js';

const MM = 180;
const MM_SCALE = MM / 2640;

let els = {};
let minimapStatic = null;
let toastSeq = 0;

export function cacheEls() {
  const ids = [
    'hud', 'health-fill', 'armor-fill', 'cash', 'clock', 'district-label',
    'stars', 'wanted-label', 'evade-tag', 'weapon-name', 'ammo-count',
    'station-name', 'minimap', 'objective', 'mission-timer', 'prompt',
    'toasts', 'banner', 'banner-main', 'banner-sub', 'feed-panel',
    'feed-list', 'feed-badge', 'overlay-start', 'overlay-pause',
    'overlay-dead', 'overlay-busted', 'overlay-ending', 'overlay-briefing',
    'briefing-title', 'briefing-lines', 'briefing-start', 'profile-panel',
    'help-panel', 'center-msg', 'save-flash',
  ];
  els = {};
  for (const id of ids) els[id] = document.getElementById(id);
  return els;
}

export function formatClock(t) {
  const h = Math.floor(t) % 24;
  const m = Math.floor((t % 1) * 60);
  const icon = (t < 5.5 || t > 20.5) ? '☾' : (t < 7 || t > 18) ? '◐' : '☀';
  return icon + ' ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function buildMinimapStatic(S) {
  const cv = document.createElement('canvas');
  cv.width = MM; cv.height = MM;
  const g = cv.getContext('2d');
  g.fillStyle = '#5c7a4a';
  g.fillRect(0, 0, MM, MM);
  g.fillStyle = '#d9c48a';
  g.fillRect(0, WORLD.beachY * MM_SCALE, MM, MM - WORLD.beachY * MM_SCALE);
  g.fillStyle = '#3d8fa8';
  g.fillRect(0, WORLD.waterY * MM_SCALE, MM, MM - WORLD.waterY * MM_SCALE);
  g.fillRect(WORLD.waterX * MM_SCALE, 0, MM - WORLD.waterX * MM_SCALE, MM);
  g.fillStyle = '#8d99a8';
  for (const c of S.city.centers) {
    g.fillRect((c - 26) * MM_SCALE, 0, 52 * MM_SCALE, MM);
    g.fillRect(0, (c - 26) * MM_SCALE, MM, 52 * MM_SCALE);
  }
  g.fillStyle = '#6b7686';
  for (const b of S.city.buildings) {
    g.fillRect(b.x * MM_SCALE, b.y * MM_SCALE, Math.max(1, b.w * MM_SCALE), Math.max(1, b.h * MM_SCALE));
  }
  minimapStatic = cv;
}

export function drawMinimap(S) {
  const cv = els['minimap'];
  if (!cv) return;
  if (!minimapStatic) buildMinimapStatic(S);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, MM, MM);
  g.drawImage(minimapStatic, 0, 0);
  const px = (x) => x * MM_SCALE, py = (y) => y * MM_SCALE;

  // CCTV cones.
  for (const c of S.city.cctv) {
    g.beginPath();
    g.moveTo(px(c.x), py(c.y));
    g.arc(px(c.x), py(c.y), 260 * MM_SCALE, c.angle - 0.6, c.angle + 0.6);
    g.closePath();
    g.fillStyle = c.disabled ? 'rgba(140,140,140,0.12)' : 'rgba(255,70,70,0.14)';
    g.fill();
  }
  // Garage + safehouse.
  g.fillStyle = '#e8b64f';
  g.fillRect(px(S.city.garage.x) - 3, py(S.city.garage.y) - 3, 6, 6);
  g.fillStyle = '#7be0a3';
  g.fillRect(px(S.city.safehouse.x) - 3, py(S.city.safehouse.y) - 3, 6, 6);
  // Hidden packages nearby.
  g.fillStyle = '#ffd166';
  for (const pk of S.city.packages) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - S.player.x, pk.y - S.player.y) > 700) continue;
    g.beginPath(); g.arc(px(pk.x), py(pk.y), 2.5, 0, Math.PI * 2); g.fill();
  }
  // Police.
  for (const car of S.wanted.policeCars) {
    if (car.dead) continue;
    g.fillStyle = '#ff4444';
    g.beginPath(); g.arc(px(car.x), py(car.y), 3.5, 0, Math.PI * 2); g.fill();
  }
  for (const cop of S.wanted.footCops) {
    if (cop.dead) continue;
    g.fillStyle = '#ff8844';
    g.beginPath(); g.arc(px(cop.x), py(cop.y), 2.5, 0, Math.PI * 2); g.fill();
  }
  // Gulls (only while a mission is active).
  if (S.missions.active) {
    g.fillStyle = '#ff2222';
    for (const p of S.peds) {
      if (p.dead || p.kind !== 'gull') continue;
      g.beginPath(); g.arc(px(p.x), py(p.y), 2.5, 0, Math.PI * 2); g.fill();
    }
  }
  // Mission marker (pulsing).
  const m = S.missions.marker;
  if (m) {
    const r = 5 + Math.sin(S.time * 5) * 1.5;
    g.fillStyle = m.color || '#ffd166';
    g.beginPath(); g.arc(px(m.x), py(m.y), r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 1;
    g.stroke();
  }
  // Player arrow.
  g.save();
  g.translate(px(S.player.x), py(S.player.y));
  g.rotate(S.player.angle);
  g.fillStyle = '#fff';
  g.strokeStyle = '#1c2733';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(6, 0); g.lineTo(-4, -4); g.lineTo(-2, 0); g.lineTo(-4, 4);
  g.closePath();
  g.fill(); g.stroke();
  g.restore();
  // North + view frame.
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = 'bold 10px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('N', 5, 12);
}

export function updateHUD(S) {
  if (!els['hud']) return;
  const p = S.player;
  els['health-fill'].style.width = Math.max(0, p.hp) + '%';
  els['health-fill'].style.background = p.hp > 30 ? '#7be0a3' : '#ff6b6b';
  els['armor-fill'].style.width = Math.max(0, p.armor) + '%';
  els['cash'].textContent = '$' + p.cash.toLocaleString('en-US');
  els['clock'].textContent = formatClock(S.timeOfDay);
  els['district-label'].textContent = districtAt(p.x, p.y);

  const stars = S.wanted.stars;
  let starHtml = '';
  for (let i = 0; i < 6; i++) {
    starHtml += '<span class="star' + (i < stars ? ' on' : '') + '">★</span>';
  }
  els['stars'].innerHTML = starHtml;
  els['wanted-label'].textContent = stars > 0 ? wantedLabel(stars) : 'CLEAN';
  els['wanted-label'].className = stars > 0 ? 'wanted-hot' : 'wanted-clean';
  els['evade-tag'].style.display = S.wanted.evading ? 'inline' : 'none';

  const w = WEAPONS[p.weapon];
  els['weapon-name'].textContent = w.name;
  els['ammo-count'].textContent = w.ammo === Infinity ? '∞' : String(p.ammo[p.weapon] || 0);
  els['station-name'].textContent = '♪ ' + S.audio.stationName();

  // Objective.
  const m = S.missions.active;
  if (m) {
    const step = m.def.steps[m.stepIndex];
    els['objective'].textContent = '★ ' + m.def.name + ' — ' + (step ? step.text : '');
    els['objective'].style.display = 'block';
  } else if (S.side.taxi) {
    els['objective'].textContent = '🚕 Taxi fare — ' + (S.side.taxi.phase === 'pickup' ? 'pick up the passenger' : 'drop them off');
    els['objective'].style.display = 'block';
  } else {
    const def = S.nextMissionDef;
    els['objective'].textContent = def ? '◆ Next job: ' + def.name + ' — see ' + def.giver : '◆ All missions complete — Verdeluz is yours';
    els['objective'].style.display = 'block';
  }
  if (S.missions.timer > 0) {
    els['mission-timer'].textContent = '⏱ ' + Math.ceil(S.missions.timer) + 's';
    els['mission-timer'].style.display = 'block';
  } else {
    els['mission-timer'].style.display = 'none';
  }

  // Feed badge.
  els['feed-badge'].textContent = S.feed.unread > 0 ? String(S.feed.unread) : '';
  els['feed-badge'].style.display = S.feed.unread > 0 ? 'inline-block' : 'none';

  drawMinimap(S);
}

export function toast(S, text, color) {
  const box = els['toasts'];
  if (!box) return;
  const id = ++toastSeq;
  const div = document.createElement('div');
  div.className = 'toast';
  div.id = 'toast-' + id;
  div.style.borderLeftColor = color || '#ffd166';
  div.textContent = text;
  box.appendChild(div);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => {
    const el = document.getElementById('toast-' + id);
    if (el) { el.classList.add('toast-out'); setTimeout(() => el.remove(), 400); }
  }, 3600);
}

let bannerTimer = 0;
export function banner(S, main, sub, color) {
  const b = els['banner'];
  if (!b) return;
  els['banner-main'].textContent = main;
  els['banner-main'].style.color = color || '#fff';
  els['banner-sub'].textContent = sub || '';
  b.classList.add('banner-show');
  bannerTimer = 2.4;
  S.bannerTimer = bannerTimer;
}

export function updateBanner(S, dt) {
  if (S.bannerTimer > 0) {
    S.bannerTimer -= dt;
    if (S.bannerTimer <= 0 && els['banner']) els['banner'].classList.remove('banner-show');
  }
}

export function setPrompt(text) {
  const el = els['prompt'];
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

export function renderFeed(S) {
  const list = els['feed-list'];
  if (!list) return;
  list.innerHTML = '';
  const posts = S.feed.posts.slice(0, 14);
  for (const post of posts) {
    const div = document.createElement('div');
    div.className = 'post';
    const head = document.createElement('div');
    head.className = 'post-head';
    const name = document.createElement('strong');
    name.textContent = post.author;
    const handle = document.createElement('span');
    handle.className = 'post-handle';
    handle.textContent = ' ' + post.handle + ' · ' + formatClock(post.time);
    head.appendChild(name);
    head.appendChild(handle);
    const body = document.createElement('div');
    body.className = 'post-body';
    body.textContent = post.text;
    const foot = document.createElement('div');
    foot.className = 'post-foot';
    foot.textContent = '♥ ' + post.likes + (post.tag ? '   #' + post.tag : '');
    div.appendChild(head);
    div.appendChild(body);
    div.appendChild(foot);
    list.appendChild(div);
  }
  if (posts.length === 0) {
    list.textContent = 'No posts yet. Go make some news.';
  }
}

export function showOverlay(name) {
  const map = {
    start: 'overlay-start', pause: 'overlay-pause', dead: 'overlay-dead',
    busted: 'overlay-busted', ending: 'overlay-ending', briefing: 'overlay-briefing',
  };
  for (const key of Object.keys(map)) {
    const el = els[map[key]];
    if (el) el.style.display = key === name ? 'flex' : 'none';
  }
  if (els['hud']) els['hud'].style.display = (name === 'start') ? 'none' : 'block';
}

export function hideOverlays() {
  showOverlay(null);
  if (els['hud']) els['hud'].style.display = 'block';
}

export function renderProfile(S) {
  const el = els['profile-panel'];
  if (!el) return;
  const pr = S.profile;
  const rows = [
    ['Missions completed', pr.missionsDone + ' / 6'],
    ['Crimes committed', pr.crimes],
    ['Crimes witnessed', pr.witnessed],
    ['Unseen crimes', Math.max(0, pr.crimes - pr.witnessed)],
    ['Good deeds', pr.kindness],
    ['Taxi fares', pr.taxiFares],
    ['Hidden packages', pr.packages + ' / 12'],
    ['Stunt jumps', pr.jumps + ' / 3'],
    ['Cars stolen', pr.carsStolen],
    ['Times busted', pr.busted],
    ['Times wasted', pr.wasted],
  ];
  const verdict = pr.kindness >= 3 && pr.witnessed <= pr.crimes / 2
    ? 'The city whispers about a ghost with a good heart.'
    : pr.witnessed > 5
      ? 'The city knows your face. Every camera does too.'
      : 'The city is still deciding what to think of you.';
  el.innerHTML = '<h3>CRIMINAL PROFILE — MARA VOSS</h3>' +
    rows.map(([k, v]) => '<div class="profile-row"><span>' + k + '</span><b>' + v + '</b></div>').join('') +
    '<p class="profile-verdict">' + verdict + '</p>';
}

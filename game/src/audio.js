// Solmar Heat — all sound is synthesised with WebAudio. One job: engine hum,
// sirens, gunshots, pickups and a small bassline loop. No audio files, no network.
let ctx = null;
let master = null;
let musicTimer = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let muted = false;
let musicOn = false;

const MUSIC_NOTES = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 65.41, 58.27, 49];
let musicStep = 0;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    return false;
  }
  return true;
}

export function initAudio() {
  if (!ensure()) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return true;
}

export function audioReady() {
  return ctx !== null;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* audio is best-effort */ }
}

function noiseBurst(dur, vol, lowpass) {
  if (!ctx || muted) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  } catch { /* audio is best-effort */ }
}

export function sfxPickup() {
  blip(660, 0.12, 'sine', 0.25, 990);
}
export function sfxMission() {
  blip(523, 0.15, 'triangle', 0.3);
  setTimeout(() => blip(784, 0.25, 'triangle', 0.3), 140);
}
export function sfxShot() {
  noiseBurst(0.14, 0.4, 1800);
}
export function sfxPunch() {
  noiseBurst(0.08, 0.25, 500);
}
export function sfxCrash() {
  noiseBurst(0.25, 0.4, 700);
}
export function sfxSteal() {
  blip(220, 0.1, 'square', 0.2, 440);
}
export function sfxWasted() {
  blip(196, 0.5, 'sawtooth', 0.25, 98);
}
export function sfxClick() {
  blip(880, 0.06, 'sine', 0.18);
}

export function setEngine(speedRatio, driving) {
  if (!ctx || muted) {
    stopEngine();
    return;
  }
  try {
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      engineOsc.connect(f);
      f.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    const target = driving ? 0.05 + speedRatio * 0.09 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + speedRatio * 110, ctx.currentTime, 0.1);
  } catch { /* audio is best-effort */ }
}

export function stopEngine() {
  if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

export function setSiren(on) {
  if (!ctx || muted || !on) {
    if (sirenGain) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    return;
  }
  try {
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      let hi = false;
      setInterval(() => {
        if (!sirenOsc) return;
        hi = !hi;
        sirenOsc.frequency.setTargetAtTime(hi ? 880 : 660, ctx.currentTime, 0.05);
      }, 420);
    }
    sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
  } catch { /* audio is best-effort */ }
}

export function startMusic() {
  if (!ensure() || musicOn) return;
  musicOn = true;
  musicTimer = setInterval(() => {
    if (muted || !ctx) return;
    const note = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
    musicStep += 1;
    if (note > 0) blip(note, 0.22, 'triangle', 0.16);
    if (musicStep % 4 === 0) blip(note * 2, 0.12, 'sine', 0.08);
  }, 240);
}

export function stopMusic() {
  musicOn = false;
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}
export function isMuted() {
  return muted;
}

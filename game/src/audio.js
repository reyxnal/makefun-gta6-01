// Original synthesized sound: WebAudio oscillators and filtered noise only.
// No audio files, no samples, nothing fetched. Everything guards a missing context.

const BASS_LINE = [110.0, 110.0, 130.81, 98.0, 110.0, 146.83, 130.81, 98.0];
const ARP_NOTES = [440.0, 523.25, 659.25, 523.25, 587.33, 659.25, 783.99, 659.25];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicOn = false;
    this.step = 0;
    this.nextNoteTime = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  ensureContext() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.34;
      this.musicGain.connect(this.master);
    } catch (err) { this.ctx = null; return false; }
    return true;
  }

  resumeAudio() {
    if (!this.ensureContext()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  startMusic() {
    if (!this.ensureContext() || this.musicOn) return;
    this.musicOn = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
  }

  updateMusic() {
    if (!this.musicOn || !this.ctx) return;
    const stepDur = 0.21;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const t = this.nextNoteTime;
      const i = this.step % 8;
      this.playBassNote(BASS_LINE[i], t, stepDur);
      if (i % 2 === 0) this.playArpNote(ARP_NOTES[i], t, stepDur * 1.6);
      if (i % 4 === 0) this.playHat(t);
      if (i === 0) this.playKick(t);
      this.nextNoteTime += stepDur;
      this.step += 1;
    }
  }

  playBassNote(freq, t, dur) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    osc.connect(f); f.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  playArpNote(freq, t, dur) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  playHat(t) {
    const src = this.makeNoiseSource(0.05);
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.005, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t);
  }

  playKick(t) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.14);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + 0.16);
  }

  makeNoiseSource(dur) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  playOneShot(kind) {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;
    if (kind === 'gunshot') {
      const src = this.makeNoiseSource(0.16);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } else if (kind === 'punch') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.1);
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.13);
    } else if (kind === 'pickup') {
      [660, 880, 1320].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = freq;
        const st = t + i * 0.07;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.18, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.01, st + 0.18);
        osc.connect(g); g.connect(this.master);
        osc.start(st); osc.stop(st + 0.2);
      });
    } else if (kind === 'horn') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = 370;
      g.gain.setValueAtTime(0.12, t);
      g.gain.setValueAtTime(0.12, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.24);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.26);
    } else if (kind === 'crash') {
      const src = this.makeNoiseSource(0.3);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 700;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.45, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start(t);
    } else if (kind === 'click') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 880;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.07);
      osc.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.08);
    } else if (kind === 'splash') {
      [523, 659, 784, 1046].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle'; osc.frequency.value = freq;
        const st = t + i * 0.09;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.2, st + 0.03);
        g.gain.exponentialRampToValueAtTime(0.01, st + 0.3);
        osc.connect(g); g.connect(this.master);
        osc.start(st); osc.stop(st + 0.32);
      });
    }
  }

  setEngine(speedRatio, driving) {
    if (!this.ensureContext()) return;
    if (driving && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineGain.gain.value = 0.05;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (!driving && this.engineOsc) {
      try { this.engineOsc.stop(); } catch (err) { /* already stopped */ }
      this.engineOsc = null; this.engineGain = null;
      return;
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + speedRatio * 130;
      this.engineGain.gain.value = 0.04 + speedRatio * 0.06;
    }
  }

  setSiren(active) {
    if (!this.ensureContext()) return;
    if (active && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenLfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 750;
      this.sirenLfo.frequency.value = 1.4;
      lfoGain.gain.value = 180;
      this.sirenLfo.connect(lfoGain); lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain.gain.value = 0.05;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start(); this.sirenLfo.start();
    } else if (!active && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo.stop(); } catch (err) { /* already stopped */ }
      this.sirenOsc = null; this.sirenGain = null; this.sirenLfo = null;
    }
  }
}

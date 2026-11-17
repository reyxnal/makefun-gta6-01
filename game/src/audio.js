// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, sirens, gunshots, UI chimes and three procedural radio
// stations built from oscillators, filtered noise and a step sequencer.

const STATIONS = [
  {
    name: 'SOL FM · Sunset Drive',
    bpm: 96, root: 220.0, scale: [0, 3, 5, 7, 10, 12, 15],
    wave: 'sawtooth', bass: 'triangle', sparkle: true,
  },
  {
    name: 'MARINA FM · Night Tide',
    bpm: 76, root: 174.61, scale: [0, 2, 4, 7, 9, 12, 14],
    wave: 'sine', bass: 'sine', sparkle: false,
  },
  {
    name: 'GULL ROCK · Static Youth',
    bpm: 132, root: 146.83, scale: [0, 3, 5, 6, 7, 10, 12],
    wave: 'square', bass: 'sawtooth', sparkle: false,
  },
];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
    this.station = 0;
    this.musicOn = true;
    this.muted = false;
    this.volume = 0.7;
    this.step = 0;
    this.nextNoteTime = 0;
    this.started = false;
    this.noiseBuffer = null;
  }

  init() {
    if (this.started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.34;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._startEngine();
      this._startSiren();
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.started = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station].name;
  }

  stationName() {
    return STATIONS[this.station].name;
  }

  _startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);
    this.engineOsc.start();
  }

  _startSiren() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxGain);
    this.sirenOsc.start();
  }

  setEngine(speedFrac, on) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const target = on ? 0.05 + 0.075 * Math.min(1, Math.abs(speedFrac)) : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(48 + 110 * Math.min(1, Math.abs(speedFrac)), t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(240 + 900 * Math.min(1, Math.abs(speedFrac)), t, 0.06);
  }

  setSiren(on, dist) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const vol = on ? Math.max(0, 0.055 * (1 - Math.min(1, dist / 900))) : 0;
    this.sirenGain.gain.setTargetAtTime(vol, t, 0.1);
  }

  _blip(freq, dur, type, vol, when = 0) {
    if (!this.started) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type = 'lowpass', when = 0) {
    if (!this.started) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  shot() { this._noise(0.14, 0.5, 1800, 'lowpass'); this._blip(160, 0.08, 'square', 0.25); }
  punch() { this._noise(0.09, 0.4, 300, 'lowpass'); this._blip(90, 0.09, 'sine', 0.4); }
  horn() { this._blip(370, 0.28, 'square', 0.16); this._blip(466, 0.28, 'square', 0.12); }
  crash() { this._noise(0.3, 0.5, 500, 'lowpass'); this._blip(70, 0.25, 'sine', 0.4); }
  pickup() { this._blip(880, 0.09, 'sine', 0.3); this._blip(1320, 0.14, 'sine', 0.3, 0.08); }
  uiClick() { this._blip(660, 0.06, 'sine', 0.18); }
  doorSlam() { this._noise(0.08, 0.35, 400, 'lowpass'); }
  alarm() { this._blip(1046, 0.12, 'square', 0.14); this._blip(1046, 0.12, 'square', 0.14, 0.18); }
  explosion() {
    this._noise(0.9, 0.7, 240, 'lowpass');
    this._blip(55, 0.7, 'sine', 0.6);
    this._noise(0.4, 0.3, 3000, 'highpass', 0.05);
  }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => this._blip(f, 0.22, 'triangle', 0.3, i * 0.11));
  }
  missionFail() {
    [392, 330, 262].forEach((f, i) => this._blip(f, 0.3, 'triangle', 0.28, i * 0.16));
  }
  starUp() { this._blip(520, 0.1, 'square', 0.2); this._blip(780, 0.16, 'square', 0.2, 0.09); }
  phoneBuzz() { this._blip(196, 0.09, 'sawtooth', 0.14); this._blip(196, 0.09, 'sawtooth', 0.14, 0.14); }
  cash() { this._blip(1174, 0.08, 'sine', 0.25); this._blip(1568, 0.16, 'sine', 0.25, 0.07); }

  // Step-sequencer music: schedule a bar ahead, keep it cheap.
  update(dt, wanted) {
    if (!this.started || !this.musicOn) return;
    if (this.sirenGain && this.sirenGain.gain.value > 0.005) {
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 880 : 660, this.ctx.currentTime, 0.02);
      }
    }
    const st = STATIONS[this.station];
    const spb = 60 / st.bpm / 2; // eighth notes
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const t = this.nextNoteTime;
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const chordRoots = [0, -4, 5, -2]; // semitone walk
      const root = st.root * Math.pow(2, chordRoots[bar] / 12);
      if (s === 0 || s === 8) this._pad(root, st, t, spb * 8, wanted);
      if (s % 4 === 0) this._bassNote(root / 2, st, t, spb * 2);
      if (s % 2 === 0) this._hat(t, s % 4 === 2 ? 0.05 : 0.028);
      if (st.sparkle && (s === 6 || s === 14)) {
        const deg = st.scale[(bar * 2 + s) % st.scale.length];
        this._pluck(root * 2 * Math.pow(2, deg / 12), t);
      }
      if (s === 4 || s === 12) this._kick(t);
      this.nextNoteTime += spb;
      this.step++;
    }
  }

  _pad(freq, st, t, dur, wanted) {
    const ctx = this.ctx;
    [0, 3, 7].forEach((semi) => {
      const o = ctx.createOscillator();
      o.type = st.wave;
      o.frequency.value = freq * Math.pow(2, semi / 12);
      o.detune.value = (Math.random() - 0.5) * 8;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = wanted > 0 ? 900 : 620;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.3);
      g.gain.setTargetAtTime(0.0001, t + dur * 0.7, 0.3);
      o.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + dur + 0.6);
    });
  }

  _bassNote(freq, st, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = st.bass;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11, t);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.6, 0.12);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.2);
  }

  _hat(t, vol) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t); src.stop(t + 0.08);
  }

  _kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.2);
  }

  _pluck(freq, t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.55);
  }
}

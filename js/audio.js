/* Tiny procedural audio engine — no external assets. */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambience = null;
    this.mapId = 'jungle';
    this.t = 0;
    this.chirpTimer = 3;
    this.drone = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    return !this.muted;
  }

  startAmbience() {
    if (!this.ctx || this.ambience) return;
    const buffer = this.noiseBuffer(3);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 0.4;
    const gain = this.ctx.createGain(); gain.gain.value = 0.05;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.ambience = { src, filter, gain };
    this.chirpTimer = 2.5;
  }

  setMap(mapId) {
    this.mapId = mapId;
    if (!this.ctx || !this.ambience) return;
    const f = mapId === 'jungle' ? 500 : mapId === 'savanna' ? 900 : 260;
    this.ambience.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
    this.ambience.gain.gain.setTargetAtTime(mapId === 'savanna' ? 0.07 : 0.045, this.ctx.currentTime, 0.4);
    if (this.drone) { try { this.drone.stop(); } catch {} this.drone = null; }
    if (mapId === 'temple') {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 55;
      g.gain.value = 0.018;
      const lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain();
      lfo.frequency.value = 0.08; lg.gain.value = 4;
      lfo.connect(lg).connect(osc.frequency);
      osc.connect(g).connect(this.master);
      osc.start(); lfo.start();
      this.drone = osc;
      this.droneLfo = lfo;
    }
  }

  noiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  update(dt) {
    if (!this.ctx || this.muted) return;
    this.t += dt;
    this.chirpTimer -= dt;
    if (this.chirpTimer <= 0) {
      this.chirpTimer = this.mapId === 'jungle' ? 3.5 + Math.random() * 5 : this.mapId === 'savanna' ? 7 + Math.random() * 8 : 9 + Math.random() * 9;
      if (this.mapId === 'jungle') this.chirp();
      else if (this.mapId === 'temple') this.bell();
      else this.windGust();
    }
  }

  env(node, gain, attack, decay, peak = 1) {
    const t = this.ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.start(t);
    node.stop(t + attack + decay + 0.05);
  }

  chirp() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    const base = 1300 + Math.random() * 1600;
    o.frequency.setValueAtTime(base, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), this.ctx.currentTime + 0.07);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, this.ctx.currentTime + 0.15);
    o.connect(g).connect(this.master);
    this.env(o, g, 0.01, 0.18, 0.035);
  }

  bell() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 196;
    o.connect(g).connect(this.master);
    this.env(o, g, 0.01, 1.8, 0.025);
  }

  windGust() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(1.4);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
    const g = this.ctx.createGain();
    src.connect(f).connect(g).connect(this.master);
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 0.4);
    g.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 1.3);
    src.start(); src.stop(this.ctx.currentTime + 1.4);
  }

  ui() {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = 720;
    o.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.06);
    o.connect(g).connect(this.master);
    this.env(o, g, 0.005, 0.08, 0.03);
  }

  tick(urgent = false) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = urgent ? 880 : 520;
    o.connect(g).connect(this.master);
    this.env(o, g, 0.004, 0.06, urgent ? 0.045 : 0.025);
  }

  ability(kind) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (kind === 'roar') {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.6);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      o.connect(f).connect(g).connect(this.master);
      this.env(o, g, 0.02, 0.9, 0.14);
      const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuffer(0.7);
      const nf = this.ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 900;
      const ng = this.ctx.createGain();
      n.connect(nf).connect(ng).connect(this.master);
      ng.gain.setValueAtTime(0.09, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
      n.start(t); n.stop(t + 0.7);
    } else {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.22);
      o.connect(g).connect(this.master);
      this.env(o, g, 0.01, 0.25, 0.05);
      const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuffer(0.4);
      const nf = this.ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1200;
      const ng = this.ctx.createGain();
      n.connect(nf).connect(ng).connect(this.master);
      ng.gain.setValueAtTime(0.035, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      n.start(t); n.stop(t + 0.4);
    }
  }

  capture() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.35);
    o.connect(g).connect(this.master);
    this.env(o, g, 0.005, 0.4, 0.12);
    const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuffer(0.3);
    const nf = this.ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 500;
    const ng = this.ctx.createGain();
    n.connect(nf).connect(ng).connect(this.master);
    ng.gain.setValueAtTime(0.1, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.start(t); n.stop(t + 0.32);
  }

  step() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuffer(0.08);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 480;
    const g = this.ctx.createGain();
    n.connect(f).connect(g).connect(this.master);
    g.gain.setValueAtTime(0.018, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    n.start(t); n.stop(t + 0.09);
  }

  hornStart() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [220, 330, 440].forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      o.connect(g).connect(this.master);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.03 + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.start(t); o.stop(t + 0.8);
    });
  }

  result(win) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = win ? [261.6, 329.6, 392, 523.3] : [261.6, 233.1, 196, 155.6];
    notes.forEach((f, i) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      o.connect(g).connect(this.master);
      g.gain.setValueAtTime(0.0001, t + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.055, t + i * 0.11 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + (win ? 0.9 : 0.55));
      o.start(t + i * 0.11); o.stop(t + i * 0.11 + 1.0);
    });
  }
}

// All sound is synthesized with the Web Audio API — no samples, echoing Howard
// Delman's hand-wired discrete sound board. The signature piece is the two-note
// bass heartbeat that accelerates as a wave thins out.

import {
  HEARTBEAT_SLOW_TICKS, HEARTBEAT_FAST_TICKS, WIDTH,
} from './constants.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;     // false only if Web Audio is unavailable
    this.volume = 0.6;       // 0..1 from settings
    this.muted = false;
    this.thrustGain = null;
    this.saucerNodes = null;
    this.beatTimer = 0;
    this.beatToggle = 0;
  }

  /** Create / resume the context. Must be triggered by a user gesture. */
  resume() {
    if (!this.enabled) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._targetGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _targetGain() {
    return this.muted ? 0 : this.volume * 0.5;
  }

  applyGain() {
    if (this.master) this.master.gain.value = this._targetGain();
  }

  applySettings(settings) {
    this.volume = settings.volume;
    this.muted = settings.muted;
    this.applyGain();
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyGain();
  }

  setMuted(b) {
    this.muted = b;
    this.applyGain();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.applyGain();
    return !this.muted;
  }

  /** Output node for a sound at world-x: a stereo panner feeding the master. */
  _panNode(x) {
    if (x == null || typeof this.ctx.createStereoPanner !== 'function') return this.master;
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, (x / WIDTH) * 2 - 1));
    p.connect(this.master);
    return p;
  }

  // ---- One-shot effects ----------------------------------------------------
  _tone(type, freq, dur, gain = 0.3, freqEnd = freq, dest = this.master) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur);
  }

  _noiseBurst(dur, gain, filterFreq, dest = this.master) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const frames = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp).connect(g).connect(dest);
    src.start(t);
    src.stop(t + dur);
  }

  fire() { this._tone('square', 880, 0.12, 0.18, 220); }
  saucerFire(x) { this._tone('sawtooth', 520, 0.16, 0.16, 160, this._panNode(x)); }

  explosion(size, x) {
    const map = { large: [0.55, 900], medium: [0.4, 1400], small: [0.28, 2200] };
    const [dur, freq] = map[size] || map.small;
    this._noiseBurst(dur, 0.5, freq, this._panNode(x));
  }

  shipExplode(x) {
    const dest = this._panNode(x);
    this._noiseBurst(0.8, 0.6, 700, dest);
    this._tone('triangle', 160, 0.8, 0.3, 40, dest);
  }

  extraLife() {
    this._tone('square', 660, 0.12, 0.22);
    setTimeout(() => this._tone('square', 990, 0.16, 0.22), 110);
  }

  hyperspace() { this._tone('sawtooth', 1200, 0.4, 0.2, 80); }

  beat(which) {
    this._tone('triangle', which === 0 ? 70 : 95, 0.16, 0.5, which === 0 ? 55 : 75);
  }

  // ---- Continuous loops ----------------------------------------------------
  thrust(on) {
    if (!this.ctx) return;
    if (on && !this.thrustGain) {
      const src = this._whiteNoiseLoop();
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 380;
      const g = this.ctx.createGain();
      g.gain.value = 0.12;
      src.connect(lp).connect(g).connect(this.master);
      src.start();
      this.thrustGain = { src, g };
    } else if (!on && this.thrustGain) {
      const { src, g } = this.thrustGain;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      src.stop(this.ctx.currentTime + 0.2);
      this.thrustGain = null;
    }
  }

  saucerSound(kind, x) {
    if (!this.ctx) return;
    this.stopSaucer();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = kind === 'small' ? 420 : 230;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = kind === 'small' ? 9 : 5;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = kind === 'small' ? 60 : 35;
    const g = this.ctx.createGain();
    g.gain.value = 0.09;
    const panner = typeof this.ctx.createStereoPanner === 'function'
      ? this.ctx.createStereoPanner() : null;
    lfo.connect(lfoGain).connect(osc.frequency);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, ((x ?? WIDTH / 2) / WIDTH) * 2 - 1));
      osc.connect(g).connect(panner).connect(this.master);
    } else {
      osc.connect(g).connect(this.master);
    }
    osc.start();
    lfo.start();
    this.saucerNodes = { osc, lfo, g, panner };
  }

  /** Pan the looping saucer drone to follow it across the screen. */
  updateSaucerPan(x) {
    const p = this.saucerNodes && this.saucerNodes.panner;
    if (p) p.pan.value = Math.max(-1, Math.min(1, (x / WIDTH) * 2 - 1));
  }

  stopSaucer() {
    if (this.saucerNodes) {
      const { osc, lfo } = this.saucerNodes;
      const t = this.ctx.currentTime + 0.05;
      osc.stop(t);
      lfo.stop(t);
      this.saucerNodes = null;
    }
  }

  _whiteNoiseLoop() {
    const frames = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    return src;
  }

  /** Advance the heartbeat. `active` true while a wave is in progress. */
  heartbeat(active, rocksRemaining, initialRocks) {
    if (!this.ctx || !active || initialRocks <= 0) {
      this.beatTimer = HEARTBEAT_SLOW_TICKS;
      return;
    }
    const frac = Math.max(0, Math.min(1, rocksRemaining / initialRocks));
    const interval = HEARTBEAT_FAST_TICKS + (HEARTBEAT_SLOW_TICKS - HEARTBEAT_FAST_TICKS) * frac;
    if (--this.beatTimer <= 0) {
      this.beat(this.beatToggle);
      this.beatToggle ^= 1;
      this.beatTimer = interval;
    }
  }
}

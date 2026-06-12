// All sound is synthesized with the Web Audio API — no samples, echoing Howard
// Delman's hand-wired discrete sound board. The signature piece is the two-note
// bass heartbeat that accelerates as a wave thins out.

import {
  HEARTBEAT_SLOW_TICKS, HEARTBEAT_FAST_TICKS,
} from './constants.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
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
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    if (!this.master) return this.enabled;
    this.enabled = !this.enabled;
    this.master.gain.value = this.enabled ? 0.35 : 0;
    return this.enabled;
  }

  // ---- One-shot effects ----------------------------------------------------
  _tone(type, freq, dur, gain = 0.3, freqEnd = freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  _noiseBurst(dur, gain, filterFreq) {
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
    src.connect(lp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  fire() { this._tone('square', 880, 0.12, 0.18, 220); }
  saucerFire() { this._tone('sawtooth', 520, 0.16, 0.16, 160); }

  explosion(size) {
    const map = { large: [0.55, 900], medium: [0.4, 1400], small: [0.28, 2200] };
    const [dur, freq] = map[size] || map.small;
    this._noiseBurst(dur, 0.5, freq);
  }

  shipExplode() {
    this._noiseBurst(0.8, 0.6, 700);
    this._tone('triangle', 160, 0.8, 0.3, 40);
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

  saucerSound(kind) {
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
    lfo.connect(lfoGain).connect(osc.frequency);
    osc.connect(g).connect(this.master);
    osc.start();
    lfo.start();
    this.saucerNodes = { osc, lfo, g };
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

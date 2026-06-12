// Small helpers around randomness. `rand`/`pick` use Math.random; `Rng` is a
// seedable generator so tests can be deterministic when they need to be.

export function rand(min, max) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Mulberry32 — tiny, fast, seedable PRNG returning [0,1). */
export class Rng {
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  next() {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }
}

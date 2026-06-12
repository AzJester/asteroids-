import { add, scale } from '../util/vec.js';
import { wrap } from '../util/wrap.js';
import { rand, randInt } from '../util/rng.js';
import { glow, PHOSPHOR } from '../render.js';

// The original's ship death: the hull's line segments separate, drift, and spin
// until they fade. Each Debris is one such segment.
export class Debris {
  constructor(a, b, baseVel) {
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.pos = mid;
    this.a = { x: a.x - mid.x, y: a.y - mid.y };
    this.b = { x: b.x - mid.x, y: b.y - mid.y };
    this.vel = {
      x: baseVel.x * 0.4 + rand(-0.9, 0.9),
      y: baseVel.y * 0.4 + rand(-0.9, 0.9),
    };
    this.angle = 0;
    this.spin = rand(-0.07, 0.07);
    this.maxLife = randInt(90, 150);
    this.life = this.maxLife;
    this.alive = true;
  }

  /** Shatter a ship into one Debris per hull segment. */
  static fromSegments(segments, vel) {
    return segments.map(([a, b]) => new Debris(a, b, vel));
  }

  update() {
    this.pos = add(this.pos, this.vel);
    this.vel = scale(this.vel, 0.985);
    this.angle += this.spin;
    wrap(this.pos);
    if (--this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const rot = (p) => ({
      x: this.pos.x + p.x * cos - p.y * sin,
      y: this.pos.y + p.x * sin + p.y * cos,
    });
    const a = rot(this.a);
    const b = rot(this.b);
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    glow(ctx, PHOSPHOR, 1.6, 7);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
}

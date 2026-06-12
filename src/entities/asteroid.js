import {
  WIDTH, HEIGHT, ASTEROID, ASTEROID_SPAWN_MARGIN,
} from '../constants.js';
import { add, fromAngle } from '../util/vec.js';
import { wrap } from '../util/wrap.js';
import { rand, randInt } from '../util/rng.js';
import { glow, strokePath } from '../render.js';

export class Asteroid {
  constructor(size, pos, vel) {
    this.size = size;
    const cfg = ASTEROID[size];
    this.radius = cfg.radius;
    this.score = cfg.score;
    this.pos = { x: pos.x, y: pos.y };
    this.vel = { x: vel.x, y: vel.y };
    this.angle = rand(0, Math.PI * 2);
    this.spin = rand(-0.03, 0.03);
    this.alive = true;
    this.shape = makeShape(this.radius);
  }

  /** Spawn an asteroid of `size` at `pos` with a random size-appropriate drift. */
  static spawn(size, pos) {
    const [lo, hi] = ASTEROID[size].speed;
    const vel = fromAngle(rand(0, Math.PI * 2), rand(lo, hi));
    return new Asteroid(size, pos, vel);
  }

  /** Build a fresh wave of `count` large rocks, kept clear of `avoid` (the ship). */
  static field(count, avoid = { x: WIDTH / 2, y: HEIGHT / 2 }) {
    const rocks = [];
    for (let i = 0; i < count; i++) {
      let pos;
      do {
        pos = { x: rand(0, WIDTH), y: rand(0, HEIGHT) };
      } while (Math.hypot(pos.x - avoid.x, pos.y - avoid.y) < ASTEROID_SPAWN_MARGIN);
      rocks.push(Asteroid.spawn('large', pos));
    }
    return rocks;
  }

  update() {
    this.pos = add(this.pos, this.vel);
    this.angle += this.spin;
    wrap(this.pos);
  }

  /** Break apart on a hit: 2 children one size down, or none for a small rock. */
  split() {
    const cfg = ASTEROID[this.size];
    if (!cfg.child) return [];
    const children = [];
    for (let i = 0; i < cfg.children; i++) {
      children.push(Asteroid.spawn(cfg.child, this.pos));
    }
    return children;
  }

  draw(ctx) {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const pts = this.shape.map((p) => ({
      x: this.pos.x + p.x * cos - p.y * sin,
      y: this.pos.y + p.x * sin + p.y * cos,
    }));
    ctx.save();
    glow(ctx, '#cfeaff', 1.6, 7);
    strokePath(ctx, pts, true);
    ctx.restore();
  }
}

// A jagged closed polygon: vertices around a circle with random radial jitter.
function makeShape(radius) {
  const n = randInt(9, 13);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * rand(0.72, 1.18);
    pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  return pts;
}

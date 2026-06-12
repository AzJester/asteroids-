import {
  WIDTH, HEIGHT, SHIP_RADIUS, SHIP_ROT_STEP, SHIP_ROT_SPEED, SHIP_THRUST,
  SHIP_DRAG, SHIP_MAX_SPEED, SHIP_INVULN_TICKS,
} from '../constants.js';
import { add, scale, fromAngle, clampLength } from '../util/vec.js';
import { wrap } from '../util/wrap.js';
import { glow, strokePath, PHOSPHOR } from '../render.js';

// Local-space outline, pointing along +x. Rotated by the (quantized) heading.
const HULL = [
  { x: SHIP_RADIUS, y: 0 },                       // nose
  { x: -SHIP_RADIUS * 0.8, y: SHIP_RADIUS * 0.6 }, // left rear
  { x: -SHIP_RADIUS * 0.5, y: 0 },                 // tail notch
  { x: -SHIP_RADIUS * 0.8, y: -SHIP_RADIUS * 0.6 },// right rear
];
const FLAME = [
  { x: -SHIP_RADIUS * 0.5, y: SHIP_RADIUS * 0.28 },
  { x: -SHIP_RADIUS * 1.15, y: 0 },
  { x: -SHIP_RADIUS * 0.5, y: -SHIP_RADIUS * 0.28 },
];

export class Ship {
  constructor(x = WIDTH / 2, y = HEIGHT / 2) {
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.headingFloat = -Math.PI / 2; // start pointing up
    this.radius = SHIP_RADIUS;
    this.thrusting = false;
    this.invuln = SHIP_INVULN_TICKS;
    this.alive = true;
  }

  /** Heading quantized to 5° steps — the vector-hardware aiming quirk. */
  get heading() {
    return Math.round(this.headingFloat / SHIP_ROT_STEP) * SHIP_ROT_STEP;
  }

  rotate(dir) {
    this.headingFloat += dir * SHIP_ROT_SPEED;
  }

  thrust() {
    this.thrusting = true;
    this.vel = add(this.vel, fromAngle(this.heading, SHIP_THRUST));
  }

  /** World position of the nose — where bullets are born. */
  nose() {
    return add(this.pos, fromAngle(this.heading, SHIP_RADIUS));
  }

  integrate() {
    this.vel = clampLength(scale(this.vel, SHIP_DRAG), SHIP_MAX_SPEED);
    this.pos = add(this.pos, this.vel);
    wrap(this.pos);
    if (this.invuln > 0) this.invuln--;
  }

  get invulnerable() {
    return this.invuln > 0;
  }

  draw(ctx) {
    // Blink while invulnerable.
    if (this.invuln > 0 && Math.floor(this.invuln / 6) % 2 === 0) return;

    const a = this.heading;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const toWorld = (p) => ({
      x: this.pos.x + p.x * cos - p.y * sin,
      y: this.pos.y + p.x * sin + p.y * cos,
    });

    ctx.save();
    glow(ctx, PHOSPHOR, 1.8, 9);
    strokePath(ctx, HULL.map(toWorld), true);
    if (this.thrusting && Math.random() > 0.25) {
      strokePath(ctx, FLAME.map(toWorld), false);
    }
    ctx.restore();
  }
}

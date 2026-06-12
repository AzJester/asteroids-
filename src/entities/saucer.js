import {
  WIDTH, HEIGHT, SAUCER, SAUCER_BULLET_SPEED, SAUCER_BULLET_LIFE_TICKS,
  SAUCER_VERTICAL_CHANCE,
} from '../constants.js';
import { add, fromAngle, angleOf } from '../util/vec.js';
import { wrappedDelta } from '../util/wrap.js';
import { rand } from '../util/rng.js';
import { Bullet } from './bullet.js';
import { glow, strokePath } from '../render.js';

const SAUCER_BULLET_COLOR = '#ff9b6b';

export class Saucer {
  constructor(kind, fromLeft) {
    const cfg = SAUCER[kind];
    this.kind = kind;
    this.radius = cfg.radius;
    this.score = cfg.score;
    this.speed = cfg.speed;
    this.aimError = cfg.aimError;
    this.fireInterval = cfg.fireInterval;
    this.fireTimer = cfg.fireInterval;
    this.dir = fromLeft ? 1 : -1;
    this.pos = { x: fromLeft ? -cfg.radius : WIDTH + cfg.radius, y: rand(80, HEIGHT - 80) };
    this.vel = { x: this.speed * this.dir, y: 0 };
    this.traveled = 0;
    this.alive = true;
  }

  static spawn(kind) {
    return new Saucer(kind, Math.random() < 0.5);
  }

  update() {
    // Occasionally juke vertically — the saucer never travels in a clean line.
    if (Math.random() < SAUCER_VERTICAL_CHANCE) {
      this.vel.y = this.speed * (Math.random() < 0.5 ? -0.7 : 0.7) * (Math.random() < 0.4 ? 0 : 1);
    }
    this.pos = add(this.pos, this.vel);
    this.traveled += Math.abs(this.vel.x);
    // Wrap vertically; despawn once it has fully crossed the screen.
    if (this.pos.y < 0) this.pos.y += HEIGHT;
    else if (this.pos.y >= HEIGHT) this.pos.y -= HEIGHT;
    if (this.traveled > WIDTH + this.radius * 2) this.alive = false;
    if (this.fireTimer > 0) this.fireTimer--;
  }

  get readyToFire() {
    return this.fireTimer <= 0 && this.alive;
  }

  /**
   * Fire a shot. The small saucer aims at the player (with a little error); the
   * large saucer sprays loosely. Either way one shot can be lethal.
   */
  fire(target) {
    this.fireTimer = this.fireInterval;
    let angle;
    if (this.kind === 'small' && target) {
      const d = wrappedDelta(this.pos, target);
      angle = angleOf(d) + rand(-this.aimError, this.aimError);
    } else {
      angle = rand(0, Math.PI * 2);
    }
    const vel = fromAngle(angle, SAUCER_BULLET_SPEED);
    return new Bullet(this.pos, vel, SAUCER_BULLET_LIFE_TICKS, false, SAUCER_BULLET_COLOR);
  }

  draw(ctx) {
    const r = this.radius;
    const body = [
      { x: -r, y: 0 }, { x: -r * 0.45, y: r * 0.45 }, { x: r * 0.45, y: r * 0.45 },
      { x: r, y: 0 }, { x: r * 0.45, y: -r * 0.45 }, { x: -r * 0.45, y: -r * 0.45 },
    ];
    const dome = [
      { x: -r * 0.45, y: -r * 0.45 }, { x: -r * 0.2, y: -r * 0.85 },
      { x: r * 0.2, y: -r * 0.85 }, { x: r * 0.45, y: -r * 0.45 },
    ];
    const toWorld = (p) => ({ x: this.pos.x + p.x, y: this.pos.y + p.y });
    ctx.save();
    glow(ctx, '#ffd28a', 1.7, 9);
    strokePath(ctx, body.map(toWorld), true);
    strokePath(ctx, dome.map(toWorld), false);
    ctx.beginPath();
    ctx.moveTo(this.pos.x - r, this.pos.y);
    ctx.lineTo(this.pos.x + r, this.pos.y);
    ctx.stroke();
    ctx.restore();
  }
}

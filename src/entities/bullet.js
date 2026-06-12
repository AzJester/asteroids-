import { BULLET_RADIUS } from '../constants.js';
import { add } from '../util/vec.js';
import { wrap } from '../util/wrap.js';
import { glow, dot } from '../render.js';

// A single shot. Used for both the player and the saucers; `friendly` decides who
// it can hurt. Bullets wrap around the screen, which is what makes the classic
// wrap-around saucer kill possible.
export class Bullet {
  constructor(pos, vel, life, friendly = true, color = '#d7f7ff') {
    this.pos = { x: pos.x, y: pos.y };
    this.vel = { x: vel.x, y: vel.y };
    this.life = life;
    this.friendly = friendly;
    this.color = color;
    this.radius = BULLET_RADIUS;
    this.alive = true;
  }

  update() {
    this.pos = add(this.pos, this.vel);
    wrap(this.pos);
    if (--this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    ctx.save();
    glow(ctx, this.color, 2, 8);
    dot(ctx, this.pos.x, this.pos.y, this.radius);
    ctx.restore();
  }
}

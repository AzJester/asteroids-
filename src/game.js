import {
  WIDTH, HEIGHT, MAX_BULLETS, BULLET_SPEED, BULLET_LIFE_TICKS, FIRE_COOLDOWN_TICKS,
  START_LIVES, EXTRA_LIFE_EVERY, SCORE_CEILING, RESPAWN_DELAY_TICKS,
  HYPERSPACE_DEATH_CHANCE, HYPERSPACE_COOLDOWN_TICKS, SAUCER_SPAWN_MIN_TICKS,
  SAUCER_SPAWN_MAX_TICKS, SMALL_SAUCER_ONLY_SCORE, waveAsteroidCount,
} from './constants.js';
import { add, fromAngle, dist } from './util/vec.js';
import { wrap } from './util/wrap.js';
import { rand, randInt } from './util/rng.js';
import { circleHit } from './util/collision.js';
import { Ship } from './entities/ship.js';
import { Bullet } from './entities/bullet.js';
import { Asteroid } from './entities/asteroid.js';
import { Saucer } from './entities/saucer.js';
import { glow, strokePath, dot, text, PHOSPHOR } from './render.js';

const HS_KEY = 'asteroids.highscore';

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.highScore = loadHighScore();
    this.state = 'attract'; // 'attract' | 'playing' | 'gameover'
    this.paused = false;
    this._resetRun();
  }

  _resetRun() {
    this.ship = null;
    this.bullets = [];
    this.enemyBullets = [];
    this.asteroids = [];
    this.saucers = [];
    this.particles = [];
    this.score = 0;
    this.lives = START_LIVES;
    this.wave = 0;
    this.initialRocks = waveAsteroidCount(1);
    this.nextExtraLife = EXTRA_LIFE_EVERY;
    this.respawnTimer = 0;
    this.fireCooldown = 0;
    this.hyperCooldown = 0;
    this.waveTimer = 0;
    this.saucerTimer = randInt(SAUCER_SPAWN_MIN_TICKS, SAUCER_SPAWN_MAX_TICKS);
  }

  start() {
    this._resetRun();
    this.state = 'playing';
    this.paused = false;
    this.spawnWave();
    this.ship = new Ship();
  }

  spawnWave() {
    this.wave++;
    const count = waveAsteroidCount(this.wave);
    const avoid = this.ship ? this.ship.pos : { x: WIDTH / 2, y: HEIGHT / 2 };
    this.asteroids = Asteroid.field(count, avoid);
    this.initialRocks = count;
    this.waveTimer = 0;
  }

  // ---- Main per-tick update ------------------------------------------------
  update(input) {
    if (input.tap('KeyM')) this.audio.toggleMute();
    if (input.tap('KeyP') && this.state === 'playing') this.paused = !this.paused;

    if (this.state !== 'playing') {
      this.audio.thrust(false);
      this._updateParticles();
      if (input.tap('Enter', 'NumpadEnter')) this.start();
      return;
    }
    if (this.paused) {
      this.audio.thrust(false);
      return;
    }

    this._updateShip(input);
    this._updateProjectiles();
    for (const a of this.asteroids) a.update();
    this._updateSaucers();
    this._maybeSpawnSaucer();
    this._collide();
    this._cull();
    this._updateParticles();
    this._maybeNextWave();

    const beating = this.ship && this.asteroids.length > 0;
    this.audio.heartbeat(beating, this.asteroids.length, this.initialRocks);
  }

  _updateShip(input) {
    if (!this.ship) {
      this.audio.thrust(false);
      if (this.respawnTimer > 0 && --this.respawnTimer <= 0) this._tryRespawn();
      return;
    }
    const s = this.ship;
    s.thrusting = false;
    if (input.down('ArrowLeft', 'KeyA')) s.rotate(-1);
    if (input.down('ArrowRight', 'KeyD')) s.rotate(1);
    if (input.down('ArrowUp', 'KeyW')) {
      s.thrust();
      this.audio.thrust(true);
    } else {
      this.audio.thrust(false);
    }

    if (this.fireCooldown > 0) this.fireCooldown--;
    if (input.down('Space') && this.fireCooldown <= 0 && this.bullets.length < MAX_BULLETS) {
      this._fire();
    }

    if (this.hyperCooldown > 0) this.hyperCooldown--;
    if (input.tap('ShiftLeft', 'ShiftRight', 'KeyH') && this.hyperCooldown <= 0) {
      this._hyperspace();
    }

    s.integrate();
  }

  _fire() {
    const s = this.ship;
    const vel = add(fromAngle(s.heading, BULLET_SPEED), s.vel);
    this.bullets.push(new Bullet(s.nose(), vel, BULLET_LIFE_TICKS, true, PHOSPHOR));
    this.fireCooldown = FIRE_COOLDOWN_TICKS;
    this.audio.fire();
  }

  _hyperspace() {
    this.hyperCooldown = HYPERSPACE_COOLDOWN_TICKS;
    this.audio.hyperspace();
    if (Math.random() < HYPERSPACE_DEATH_CHANCE) {
      this._killShip();
      return;
    }
    this.ship.pos = { x: rand(40, WIDTH - 40), y: rand(40, HEIGHT - 40) };
    this.ship.vel = { x: 0, y: 0 };
    this.ship.invuln = 45;
  }

  _updateProjectiles() {
    for (const b of this.bullets) b.update();
    for (const b of this.enemyBullets) b.update();
  }

  _updateSaucers() {
    for (const sc of this.saucers) {
      sc.update();
      if (sc.readyToFire && this.ship) {
        this.enemyBullets.push(sc.fire(this.ship.pos));
        this.audio.saucerFire();
      }
    }
  }

  _maybeSpawnSaucer() {
    if (this.saucers.length > 0 || !this.ship) return;
    if (--this.saucerTimer > 0) return;
    let kind;
    if (this.score >= SMALL_SAUCER_ONLY_SCORE) {
      kind = 'small';
    } else {
      const smallProb = Math.min(0.55, (this.score / SMALL_SAUCER_ONLY_SCORE) * 0.55);
      kind = Math.random() < smallProb ? 'small' : 'large';
    }
    this.saucers.push(Saucer.spawn(kind));
    this.audio.saucerSound(kind);
    this.saucerTimer = randInt(SAUCER_SPAWN_MIN_TICKS, SAUCER_SPAWN_MAX_TICKS);
  }

  // ---- Collisions ----------------------------------------------------------
  _collide() {
    // Player bullets vs asteroids.
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const a of this.asteroids) {
        if (!a.alive) continue;
        if (circleHit(b, a)) {
          b.alive = false;
          this._destroyAsteroid(a, true);
          break;
        }
      }
    }
    // Player bullets vs saucers.
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const sc of this.saucers) {
        if (!sc.alive) continue;
        if (circleHit(b, sc)) {
          b.alive = false;
          sc.alive = false;
          this._addScore(sc.score);
          this.audio.explosion('medium');
          this._spawnBurst(sc.pos, 16, 3);
        }
      }
    }
    // Saucer bullets vs asteroids (chaos) and vs ship.
    for (const b of this.enemyBullets) {
      if (!b.alive) continue;
      for (const a of this.asteroids) {
        if (!a.alive) continue;
        if (circleHit(b, a)) {
          b.alive = false;
          this._destroyAsteroid(a, false);
          break;
        }
      }
    }
    for (const b of this.enemyBullets) {
      if (b.alive && this.ship && !this.ship.invulnerable && circleHit(b, this.ship)) {
        b.alive = false;
        this._killShip();
      }
    }
    // Ship vs asteroids and ship vs saucers.
    if (this.ship && !this.ship.invulnerable) {
      for (const a of this.asteroids) {
        if (a.alive && circleHit(this.ship, a)) {
          this._destroyAsteroid(a, false);
          this._killShip();
          break;
        }
      }
    }
    if (this.ship && !this.ship.invulnerable) {
      for (const sc of this.saucers) {
        if (sc.alive && circleHit(this.ship, sc)) {
          sc.alive = false;
          this._addScore(sc.score);
          this._spawnBurst(sc.pos, 16, 3);
          this._killShip();
          break;
        }
      }
    }
  }

  _destroyAsteroid(a, scoring) {
    a.alive = false;
    if (scoring) this._addScore(a.score);
    this.audio.explosion(a.size);
    this._spawnBurst(a.pos, a.size === 'large' ? 14 : a.size === 'medium' ? 10 : 7, 2.6);
    for (const child of a.split()) this.asteroids.push(child);
  }

  _killShip() {
    if (!this.ship || this.ship.invulnerable) return;
    this._spawnBurst(this.ship.pos, 20, 3.4);
    this.audio.shipExplode();
    this.audio.thrust(false);
    this.ship = null;
    this.lives--;
    if (this.lives <= 0) this._gameOver();
    else this.respawnTimer = RESPAWN_DELAY_TICKS;
  }

  _tryRespawn() {
    const center = { x: WIDTH / 2, y: HEIGHT / 2 };
    const clear = this.asteroids.every((a) => dist(a.pos, center) > 130)
      && this.saucers.every((s) => dist(s.pos, center) > 170);
    if (clear) this.ship = new Ship();
    else this.respawnTimer = 12; // not safe yet — check again shortly
  }

  _gameOver() {
    this.state = 'gameover';
    this.audio.stopSaucer();
    this.audio.thrust(false);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.highScore);
    }
  }

  _addScore(pts) {
    this.score += pts;
    while (this.score >= this.nextExtraLife) {
      this.lives++;
      this.audio.extraLife();
      this.nextExtraLife += EXTRA_LIFE_EVERY;
    }
    if (this.score > this.highScore) this.highScore = this.score;
  }

  _cull() {
    this.bullets = this.bullets.filter((b) => b.alive);
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
    this.asteroids = this.asteroids.filter((a) => a.alive);
    const hadSaucer = this.saucers.length > 0;
    this.saucers = this.saucers.filter((s) => s.alive);
    if (hadSaucer && this.saucers.length === 0) this.audio.stopSaucer();
  }

  _maybeNextWave() {
    if (this.asteroids.length > 0) return;
    if (this.waveTimer === 0) this.waveTimer = 110;
    else if (--this.waveTimer <= 0) this.spawnWave();
  }

  _spawnBurst(pos, count, speed) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        pos: { x: pos.x, y: pos.y },
        vel: fromAngle(rand(0, Math.PI * 2), rand(0.6, speed)),
        life: randInt(16, 34),
      });
    }
  }

  _updateParticles() {
    for (const p of this.particles) {
      p.pos = add(p.pos, p.vel);
      wrap(p.pos);
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---- Rendering -----------------------------------------------------------
  render(ctx) {
    for (const a of this.asteroids) a.draw(ctx);
    for (const sc of this.saucers) sc.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const b of this.enemyBullets) b.draw(ctx);
    this._drawParticles(ctx);
    if (this.ship) this.ship.draw(ctx);

    this._drawHud(ctx);
    if (this.state === 'attract') this._drawAttract(ctx);
    else if (this.state === 'gameover') this._drawGameOver(ctx);
    else if (this.paused) text(ctx, 'PAUSED', WIDTH / 2, HEIGHT / 2, 40, 'center');
  }

  _drawParticles(ctx) {
    ctx.save();
    glow(ctx, PHOSPHOR, 1, 6);
    for (const p of this.particles) dot(ctx, p.pos.x, p.pos.y, 1.6);
    ctx.restore();
  }

  _drawHud(ctx) {
    text(ctx, pad(this.score % SCORE_CEILING), 24, 44, 28, 'left');
    text(ctx, `HI ${pad(this.highScore % SCORE_CEILING)}`, WIDTH / 2, 32, 18, 'center');
    const reserves = Math.max(0, this.lives - (this.ship ? 1 : 0));
    drawLives(ctx, reserves);
  }

  _drawAttract(ctx) {
    text(ctx, 'ASTEROIDS', WIDTH / 2, HEIGHT / 2 - 40, 72, 'center');
    text(ctx, 'PRESS ENTER TO PLAY', WIDTH / 2, HEIGHT / 2 + 30, 26, 'center');
    text(ctx, '← → ROTATE   ↑ THRUST   SPACE FIRE   SHIFT HYPERSPACE',
      WIDTH / 2, HEIGHT - 70, 16, 'center');
    text(ctx, 'P PAUSE   M MUTE', WIDTH / 2, HEIGHT - 44, 16, 'center');
  }

  _drawGameOver(ctx) {
    text(ctx, 'GAME OVER', WIDTH / 2, HEIGHT / 2 - 20, 64, 'center');
    text(ctx, `SCORE ${pad(this.score % SCORE_CEILING)}`, WIDTH / 2, HEIGHT / 2 + 34, 26, 'center');
    text(ctx, 'PRESS ENTER TO PLAY AGAIN', WIDTH / 2, HEIGHT / 2 + 80, 22, 'center');
  }
}

// ---- Module helpers --------------------------------------------------------
function pad(score) {
  return String(score).padStart(5, '0');
}

function drawLives(ctx, count) {
  ctx.save();
  glow(ctx, PHOSPHOR, 1.6, 7);
  for (let i = 0; i < count; i++) {
    const x = 30 + i * 26;
    const y = 78;
    const pts = [
      { x, y: y - 12 }, { x: x - 8, y: y + 10 }, { x, y: y + 5 }, { x: x + 8, y: y + 10 },
    ];
    strokePath(ctx, pts, true);
  }
  ctx.restore();
}

function loadHighScore() {
  try {
    return parseInt(localStorage.getItem(HS_KEY), 10) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore(score) {
  try {
    localStorage.setItem(HS_KEY, String(score));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

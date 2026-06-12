import {
  WIDTH, HEIGHT, MAX_BULLETS, BULLET_SPEED, BULLET_LIFE_TICKS, FIRE_COOLDOWN_TICKS,
  START_LIVES, EXTRA_LIFE_EVERY, SCORE_CEILING, RESPAWN_DELAY_TICKS,
  HYPERSPACE_DEATH_CHANCE, HYPERSPACE_COOLDOWN_TICKS, SAUCER_SPAWN_MIN_TICKS,
  SAUCER_SPAWN_MAX_TICKS, SMALL_SAUCER_ONLY_SCORE, waveAsteroidCount,
  smallSaucerAimError, DEMO_ROCKS, GAMEOVER_TO_ATTRACT_TICKS, ENTRY_ALPHABET,
} from './constants.js';
import { add, fromAngle, dist } from './util/vec.js';
import { wrap, wrappedDelta } from './util/wrap.js';
import { rand, randInt } from './util/rng.js';
import { circleHit } from './util/collision.js';
import { Ship } from './entities/ship.js';
import { Bullet } from './entities/bullet.js';
import { Asteroid } from './entities/asteroid.js';
import { Saucer } from './entities/saucer.js';
import { Debris } from './entities/debris.js';
import * as leaderboard from './leaderboard.js';
import { glow, strokePath, dot, text, PHOSPHOR } from './render.js';

// Silent stand-in for the audio engine; attract-mode demo plays through this so
// the cabinet stays quiet until a game starts.
const SILENT = new Proxy({}, { get: () => () => {} });

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.board = leaderboard.load();
    this.state = 'attract'; // 'attract' | 'playing' | 'entry' | 'gameover'
    this.paused = false;
    this.tick = 0;
    this._resetRun();
    this._initDemo();
  }

  /** Sounds route here: real audio while playing, silence in attract/menus. */
  get sfx() {
    return this.state === 'playing' && !this.paused ? this.audio : SILENT;
  }

  get highScore() {
    return this.board.length > 0 ? this.board[0].score : 0;
  }

  _resetRun() {
    this.ship = null;
    this.bullets = [];
    this.enemyBullets = [];
    this.asteroids = [];
    this.saucers = [];
    this.particles = [];
    this.debris = [];
    this.score = 0;
    this.lives = START_LIVES;
    this.wave = 0;
    this.initialRocks = waveAsteroidCount(1);
    this.nextExtraLife = EXTRA_LIFE_EVERY;
    this.respawnTimer = 0;
    this.fireCooldown = 0;
    this.hyperCooldown = 0;
    this.waveTimer = 0;
    this.gameoverTimer = 0;
    this.saucerTimer = randInt(SAUCER_SPAWN_MIN_TICKS, SAUCER_SPAWN_MAX_TICKS);
  }

  _initDemo() {
    this._resetRun();
    this.ship = new Ship();
    this.asteroids = Asteroid.field(DEMO_ROCKS, this.ship.pos);
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
    this.tick++;
    if (input.tap('KeyM')) this.audio.toggleMute();

    switch (this.state) {
      case 'attract':
        this._updateAttract(input);
        break;
      case 'playing':
        this._updatePlaying(input);
        break;
      case 'entry':
        this._updateEntry(input);
        this._updateAmbient();
        break;
      case 'gameover':
        this._updateGameOver(input);
        this._updateAmbient();
        break;
    }
  }

  _updatePlaying(input) {
    if (input.tap('KeyP')) this.paused = !this.paused;
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
    this._updateDebris();
    this._maybeNextWave();

    const beating = this.ship && this.asteroids.length > 0;
    this.sfx.heartbeat(beating, this.asteroids.length, this.initialRocks);
  }

  // ---- Attract-mode demo: a simple AI flies the ship behind the title ------
  _updateAttract(input) {
    if (input.tap('Enter', 'NumpadEnter')) {
      this.start();
      return;
    }

    if (!this.ship) {
      if (this.respawnTimer > 0 && --this.respawnTimer <= 0) {
        this.ship = new Ship();
      }
    } else {
      this._demoPilot();
      this.ship.integrate();
    }

    this._updateProjectiles();
    for (const a of this.asteroids) a.update();
    if (this.asteroids.length === 0) {
      this.asteroids = Asteroid.field(DEMO_ROCKS, this.ship ? this.ship.pos : undefined);
    }
    this._collide();
    this._cull();
    this._updateParticles();
    this._updateDebris();
  }

  _demoPilot() {
    const s = this.ship;
    s.thrusting = false;
    if (this.fireCooldown > 0) this.fireCooldown--;

    // Aim at the nearest rock (across the torus seam).
    let nearest = null;
    let best = Infinity;
    for (const a of this.asteroids) {
      const d = wrappedDelta(s.pos, a.pos);
      const len = Math.hypot(d.x, d.y);
      if (len < best) {
        best = len;
        nearest = d;
      }
    }
    if (!nearest) return;

    const want = Math.atan2(nearest.y, nearest.x);
    let diff = want - s.headingFloat;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) > 0.05) s.rotate(Math.sign(diff));
    if (Math.abs(diff) < 0.15 && this.fireCooldown <= 0 && this.bullets.length < MAX_BULLETS) {
      this._fire();
    }
    // Nudge away when a rock gets close; otherwise drift with an occasional puff.
    if (best < 110 && Math.abs(diff) > Math.PI * 0.6) s.thrust();
    else if (Math.random() < 0.01) s.thrust();
  }

  // ---- Initials entry -------------------------------------------------------
  _beginEntry() {
    this.state = 'entry';
    this.entry = { chars: ['A', 'A', 'A'], slot: 0 };
  }

  _updateEntry(input) {
    const e = this.entry;
    const cycle = (dir) => {
      const i = ENTRY_ALPHABET.indexOf(e.chars[e.slot]);
      const n = ENTRY_ALPHABET.length;
      e.chars[e.slot] = ENTRY_ALPHABET[(i + dir + n) % n];
    };

    if (input.tap('ArrowUp', 'ArrowRight')) cycle(1);
    if (input.tap('ArrowDown', 'ArrowLeft')) cycle(-1);
    // Direct typing (letters only — Space is the "lock" button below).
    if (input.typedChar && input.typedChar !== ' '
        && ENTRY_ALPHABET.includes(input.typedChar)) {
      e.chars[e.slot] = input.typedChar;
      if (e.slot < 2) e.slot++;
    }
    if (input.tap('Backspace') && e.slot > 0) e.slot--;
    if (input.tap('Space', 'Enter', 'NumpadEnter')) {
      if (e.slot < 2) {
        e.slot++;
      } else {
        this.board = leaderboard.insert(this.board, e.chars.join(''), this.score);
        leaderboard.save(this.board);
        this.state = 'gameover';
        this.gameoverTimer = GAMEOVER_TO_ATTRACT_TICKS;
      }
    }
  }

  _updateGameOver(input) {
    if (input.tap('Enter', 'NumpadEnter')) {
      this.start();
      return;
    }
    if (this.gameoverTimer > 0 && --this.gameoverTimer <= 0) {
      this.state = 'attract';
      this._initDemo();
    }
  }

  /** Keep leftovers drifting on the entry/game-over screens. */
  _updateAmbient() {
    this.audio.thrust(false);
    for (const a of this.asteroids) a.update();
    for (const sc of this.saucers) sc.update();
    this._updateProjectiles();
    this._cull();
    this._updateParticles();
    this._updateDebris();
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
      this.sfx.thrust(true);
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
    this.sfx.fire();
  }

  _hyperspace() {
    this.hyperCooldown = HYPERSPACE_COOLDOWN_TICKS;
    this.sfx.hyperspace();
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
        this.sfx.saucerFire();
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
    const saucer = Saucer.spawn(kind);
    if (kind === 'small') saucer.aimError = smallSaucerAimError(this.score);
    this.saucers.push(saucer);
    this.sfx.saucerSound(kind);
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
          this.sfx.explosion('medium');
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
    this.sfx.explosion(a.size);
    this._spawnBurst(a.pos, a.size === 'large' ? 14 : a.size === 'medium' ? 10 : 7, 2.6);
    for (const child of a.split()) this.asteroids.push(child);
  }

  _killShip() {
    if (!this.ship || this.ship.invulnerable) return;
    // The classic death: the hull breaks into drifting, spinning line segments.
    this.debris.push(...Debris.fromSegments(this.ship.segments(), this.ship.vel));
    this._spawnBurst(this.ship.pos, 10, 2.2);
    this.sfx.shipExplode();
    this.audio.thrust(false);
    this.ship = null;
    this.respawnTimer = RESPAWN_DELAY_TICKS;

    if (this.state !== 'playing') return; // demo deaths cost nothing
    this.lives--;
    if (this.lives <= 0) this._gameOver();
  }

  _tryRespawn() {
    const center = { x: WIDTH / 2, y: HEIGHT / 2 };
    const clear = this.asteroids.every((a) => dist(a.pos, center) > 130)
      && this.saucers.every((s) => dist(s.pos, center) > 170);
    if (clear) this.ship = new Ship();
    else this.respawnTimer = 12; // not safe yet — check again shortly
  }

  _gameOver() {
    this.audio.stopSaucer();
    this.audio.thrust(false);
    if (leaderboard.qualifies(this.board, this.score)) {
      this._beginEntry();
    } else {
      this.state = 'gameover';
      this.gameoverTimer = GAMEOVER_TO_ATTRACT_TICKS;
    }
  }

  _addScore(pts) {
    if (this.state !== 'playing') return; // demo kills don't score
    this.score += pts;
    while (this.score >= this.nextExtraLife) {
      this.lives++;
      this.sfx.extraLife();
      this.nextExtraLife += EXTRA_LIFE_EVERY;
    }
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

  _updateDebris() {
    for (const d of this.debris) d.update();
    this.debris = this.debris.filter((d) => d.alive);
  }

  // ---- Rendering -----------------------------------------------------------

  /** Entities only — drawn into the phosphor-trail buffer. */
  renderWorld(ctx) {
    for (const a of this.asteroids) a.draw(ctx);
    for (const sc of this.saucers) sc.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const b of this.enemyBullets) b.draw(ctx);
    for (const d of this.debris) d.draw(ctx);
    this._drawParticles(ctx);
    if (this.ship) this.ship.draw(ctx);
  }

  /** HUD and screens — drawn crisply above the trail buffer. */
  renderHud(ctx) {
    if (this.state === 'playing' || this.state === 'entry' || this.state === 'gameover') {
      text(ctx, pad(this.score % SCORE_CEILING), 24, 52, 26, 'left');
      text(ctx, `HI ${pad(this.highScore % SCORE_CEILING)}`, WIDTH / 2, 40, 14, 'center');
    }
    if (this.state === 'playing') {
      drawLives(ctx, Math.max(0, this.lives - 1));
      if (this.paused) text(ctx, 'PAUSED', WIDTH / 2, HEIGHT / 2, 40, 'center');
    } else if (this.state === 'attract') {
      this._drawAttract(ctx);
    } else if (this.state === 'entry') {
      this._drawEntry(ctx);
    } else if (this.state === 'gameover') {
      this._drawGameOver(ctx);
    }
  }

  _drawParticles(ctx) {
    ctx.save();
    glow(ctx, PHOSPHOR, 1, 6);
    for (const p of this.particles) dot(ctx, p.pos.x, p.pos.y, 1.6);
    ctx.restore();
  }

  _drawAttract(ctx) {
    text(ctx, 'ASTEROIDS', WIDTH / 2, 200, 64, 'center');
    if (Math.floor(this.tick / 40) % 2 === 0) {
      text(ctx, 'PRESS ENTER TO PLAY', WIDTH / 2, 280, 22, 'center');
    }
    this._drawBoard(ctx, WIDTH / 2, 360, 5);
    text(ctx, '← → ROTATE  ↑ THRUST  SPACE FIRE  SHIFT HYPERSPACE',
      WIDTH / 2, HEIGHT - 76, 13, 'center');
    text(ctx, 'P PAUSE  M MUTE', WIDTH / 2, HEIGHT - 48, 13, 'center');
  }

  _drawEntry(ctx) {
    const e = this.entry;
    text(ctx, 'NEW HIGH SCORE', WIDTH / 2, HEIGHT / 2 - 110, 36, 'center');
    text(ctx, pad(this.score % SCORE_CEILING), WIDTH / 2, HEIGHT / 2 - 64, 24, 'center');
    text(ctx, 'ENTER YOUR INITIALS', WIDTH / 2, HEIGHT / 2 - 20, 18, 'center');

    const size = 52;
    const gap = 70;
    const x0 = WIDTH / 2 - gap;
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * gap;
      const blink = i === e.slot && Math.floor(this.tick / 16) % 2 === 0;
      if (!blink) text(ctx, e.chars[i], x, HEIGHT / 2 + 60, size, 'center');
      text(ctx, '_', x, HEIGHT / 2 + 72, size, 'center');
    }
    text(ctx, 'ROTATE TO CHANGE - FIRE TO LOCK', WIDTH / 2, HEIGHT / 2 + 130, 14, 'center');
  }

  _drawGameOver(ctx) {
    text(ctx, 'GAME OVER', WIDTH / 2, 220, 56, 'center');
    text(ctx, `SCORE ${pad(this.score % SCORE_CEILING)}`, WIDTH / 2, 274, 22, 'center');
    this._drawBoard(ctx, WIDTH / 2, 340, 5);
    text(ctx, 'PRESS ENTER TO PLAY AGAIN', WIDTH / 2, HEIGHT - 90, 20, 'center');
  }

  _drawBoard(ctx, cx, y0, count) {
    if (this.board.length === 0) return;
    text(ctx, 'HIGH SCORES', cx, y0, 20, 'center');
    const rows = this.board.slice(0, count);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const line = `${String(i + 1).padStart(2, ' ')} ${r.initials} ${pad(r.score % SCORE_CEILING)}`;
      text(ctx, line, cx, y0 + 34 + i * 28, 16, 'center');
    }
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
    const y = 84;
    const pts = [
      { x, y: y - 12 }, { x: x - 8, y: y + 10 }, { x, y: y + 5 }, { x: x + 8, y: y + 10 },
    ];
    strokePath(ctx, pts, true);
  }
  ctx.restore();
}

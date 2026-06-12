import {
  WIDTH, HEIGHT, MAX_BULLETS, BULLET_SPEED, BULLET_LIFE_TICKS, FIRE_COOLDOWN_TICKS,
  SCORE_CEILING, RESPAWN_DELAY_TICKS, HYPERSPACE_DEATH_CHANCE,
  HYPERSPACE_COOLDOWN_TICKS, SAUCER_SPAWN_MIN_TICKS, SAUCER_SPAWN_MAX_TICKS,
  SMALL_SAUCER_ONLY_SCORE, waveAsteroidCount, smallSaucerAimError, DEMO_ROCKS,
  GAMEOVER_TO_ATTRACT_TICKS, ENTRY_ALPHABET, LEADERBOARD_MAX,
  SHAKE_SHIP_DEATH, SHAKE_SAUCER, SHAKE_LARGE_ROCK, SHAKE_DECAY, PLAYER_BANNER_TICKS,
} from './constants.js';
import {
  DIFFICULTY, DIFFICULTY_ORDER, ACTION_LABELS, saveSettings, sanitizeKeymap,
} from './settings.js';
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
import * as remote from './remote-leaderboard.js';
import { glow, strokePath, dot, text, PHOSPHOR } from './render.js';

// Silent stand-in for the audio engine; attract-mode demo plays through this so
// the cabinet stays quiet until a game starts.
const SILENT = new Proxy({}, { get: () => () => {} });

export class Game {
  constructor(audio, settings) {
    this.audio = audio;
    this.settings = settings;
    this.diff = DIFFICULTY[settings.difficulty];
    this.board = leaderboard.load();
    this.globalBoard = null;
    this.state = 'attract'; // attract | playing | entry | gameover | settings | remap
    this.paused = false;
    this.tick = 0;
    this.shake = 0;
    this.banner = null;
    this.menuIndex = 0;
    this._initDemo();
    this._refreshGlobal();
  }

  // ---- Per-player state via the active player ------------------------------
  _newPlayer() {
    return { score: 0, lives: this.diff.lives, nextExtraLife: this.diff.extraLife, world: null };
  }

  get player() { return this.players[this.current]; }
  get score() { return this.player.score; }
  set score(v) { this.player.score = v; }
  get lives() { return this.player.lives; }
  set lives(v) { this.player.lives = v; }
  get nextExtraLife() { return this.player.nextExtraLife; }
  set nextExtraLife(v) { this.player.nextExtraLife = v; }

  /** Sounds route here: real audio while playing, silence in attract/menus. */
  get sfx() {
    return this.state === 'playing' && !this.paused ? this.audio : SILENT;
  }

  /** The board shown on attract/game-over: global when available, else local. */
  get boardForDisplay() {
    if (remote.isConfigured() && this.globalBoard) {
      return { rows: this.globalBoard, label: 'GLOBAL HIGH SCORES' };
    }
    return { rows: this.board, label: remote.isConfigured() ? 'HIGH SCORES - LOCAL' : 'HIGH SCORES' };
  }

  get highScore() {
    const rows = this.boardForDisplay.rows;
    return rows.length > 0 ? rows[0].score : 0;
  }

  _refreshGlobal() {
    if (!remote.isConfigured()) return;
    remote.fetchTop(LEADERBOARD_MAX).then((rows) => {
      if (rows) this.globalBoard = rows;
    }).catch(() => {});
  }

  _nextSaucerDelay() {
    return Math.round(randInt(SAUCER_SPAWN_MIN_TICKS, SAUCER_SPAWN_MAX_TICKS) * this.diff.saucerSpawn);
  }

  /** Reset the active world (entities + timers); does not touch player scores. */
  _clearWorld() {
    this.ship = null;
    this.bullets = [];
    this.enemyBullets = [];
    this.asteroids = [];
    this.saucers = [];
    this.particles = [];
    this.debris = [];
    this.wave = 0;
    this.initialRocks = waveAsteroidCount(1);
    this.respawnTimer = 0;
    this.fireCooldown = 0;
    this.hyperCooldown = 0;
    this.waveTimer = 0;
    this.gameoverTimer = 0;
    this.saucerTimer = this._nextSaucerDelay();
  }

  _initDemo() {
    this.numPlayers = 1;
    this.current = 0;
    this.players = [this._newPlayer()];
    this.banner = null;
    this._clearWorld();
    this.ship = new Ship();
    this.asteroids = Asteroid.field(DEMO_ROCKS, this.ship.pos);
  }

  start(numPlayers = 1) {
    this.diff = DIFFICULTY[this.settings.difficulty]; // honor any settings change
    this.numPlayers = numPlayers;
    this.current = 0;
    this.players = Array.from({ length: numPlayers }, () => this._newPlayer());
    this.state = 'playing';
    this.paused = false;
    this.banner = null;
    this._clearWorld();
    this.spawnWave();
    this.ship = new Ship();
    if (numPlayers > 1) this._setBanner('PLAYER 1');
  }

  spawnWave() {
    this.wave++;
    const count = waveAsteroidCount(this.wave);
    const avoid = this.ship ? this.ship.pos : { x: WIDTH / 2, y: HEIGHT / 2 };
    this.asteroids = Asteroid.field(count, avoid);
    this.initialRocks = count;
    this.waveTimer = 0;
  }

  addShake(mag) {
    if (this.settings.reduceMotion) return;
    this.shake = Math.max(this.shake, mag);
  }

  _setBanner(textStr) {
    this.banner = { text: textStr, timer: PLAYER_BANNER_TICKS };
  }

  // ---- Main per-tick update ------------------------------------------------
  update(input) {
    this.tick++;
    this.shake *= SHAKE_DECAY;
    if (this.shake < 0.3) this.shake = 0;

    if (input.tap('KeyM') && this.state !== 'remap') {
      this.audio.toggleMute();
      this.settings.muted = this.audio.muted;
      saveSettings(this.settings);
    }

    switch (this.state) {
      case 'attract': this._updateAttract(input); break;
      case 'playing': this._updatePlaying(input); break;
      case 'entry': this._updateEntry(input); this._updateAmbient(); break;
      case 'gameover': this._updateGameOver(input); this._updateAmbient(); break;
      case 'settings': this._updateSettings(input); this._updateAmbient(); break;
      case 'remap': this._updateRemap(input); this._updateAmbient(); break;
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
    if (this.banner && --this.banner.timer <= 0) this.banner = null;

    const beating = this.ship && this.asteroids.length > 0;
    this.sfx.heartbeat(beating, this.asteroids.length, this.initialRocks);
  }

  // ---- Attract-mode demo: a simple AI flies the ship behind the title ------
  _updateAttract(input) {
    if (input.tap('Enter', 'NumpadEnter')) { this.start(1); return; }
    if (input.tap('Digit2', 'Numpad2')) { this.start(2); return; }
    if (input.tap('KeyS')) { this.state = 'settings'; this.menuIndex = 0; return; }

    if (!this.ship) {
      if (this.respawnTimer > 0 && --this.respawnTimer <= 0) this.ship = new Ship();
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

    let nearest = null;
    let best = Infinity;
    for (const a of this.asteroids) {
      const d = wrappedDelta(s.pos, a.pos);
      const len = Math.hypot(d.x, d.y);
      if (len < best) { best = len; nearest = d; }
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
    if (best < 110 && Math.abs(diff) > Math.PI * 0.6) s.thrust();
    else if (Math.random() < 0.01) s.thrust();
  }

  // ---- Settings menu --------------------------------------------------------
  _settingsRows() {
    const s = this.settings;
    const save = () => saveSettings(s);
    return [
      {
        label: 'VOLUME', value: `${Math.round(s.volume * 100)}`,
        left: () => { this.audio.setVolume(s.volume - 0.1); s.volume = this.audio.volume; save(); },
        right: () => { this.audio.setVolume(s.volume + 0.1); s.volume = this.audio.volume; save(); },
      },
      {
        label: 'SOUND', value: s.muted ? 'OFF' : 'ON',
        toggle: () => { s.muted = !s.muted; this.audio.setMuted(s.muted); save(); },
      },
      {
        label: 'CRT FILTER', value: s.crt ? 'ON' : 'OFF',
        toggle: () => { s.crt = !s.crt; save(); },
      },
      {
        label: 'REDUCE MOTION', value: s.reduceMotion ? 'ON' : 'OFF',
        toggle: () => { s.reduceMotion = !s.reduceMotion; save(); },
      },
      {
        label: 'DIFFICULTY', value: DIFFICULTY[s.difficulty].label,
        left: () => this._cycleDifficulty(-1), right: () => this._cycleDifficulty(1),
      },
      { label: 'CONTROLS', value: 'REMAP', activate: () => this._beginRemap() },
      { label: 'RESET LOCAL SCORES', value: '', activate: () => { this.board = []; leaderboard.save(this.board); } },
      { label: 'BACK', value: '', activate: () => this._exitSettings() },
    ];
  }

  _updateSettings(input) {
    const rows = this._settingsRows();
    const n = rows.length;
    if (input.tap('ArrowUp')) this.menuIndex = (this.menuIndex - 1 + n) % n;
    if (input.tap('ArrowDown')) this.menuIndex = (this.menuIndex + 1) % n;
    const row = rows[this.menuIndex];
    if (input.tap('ArrowLeft')) { if (row.left) row.left(); else if (row.toggle) row.toggle(); }
    if (input.tap('ArrowRight')) { if (row.right) row.right(); else if (row.toggle) row.toggle(); }
    if (input.tap('Space', 'Enter', 'NumpadEnter')) {
      if (row.activate) row.activate();
      else if (row.toggle) row.toggle();
      else if (row.right) row.right();
    }
    if (input.tap('Escape', 'KeyS')) this._exitSettings();
  }

  _cycleDifficulty(dir) {
    const i = DIFFICULTY_ORDER.indexOf(this.settings.difficulty);
    const ni = (i + dir + DIFFICULTY_ORDER.length) % DIFFICULTY_ORDER.length;
    this.settings.difficulty = DIFFICULTY_ORDER[ni];
    this.diff = DIFFICULTY[this.settings.difficulty];
    saveSettings(this.settings);
  }

  _exitSettings() {
    saveSettings(this.settings);
    this.state = 'attract';
  }

  _beginRemap() {
    this.state = 'remap';
    this.remap = {
      actions: ['rotateLeft', 'rotateRight', 'thrust', 'fire', 'hyperspace'],
      idx: 0,
      pending: {},
    };
  }

  _updateRemap(input) {
    if (input.tap('Escape')) { this.state = 'settings'; return; }
    const code = [...input.tapped].find((c) => c !== 'Escape');
    if (!code) return;
    const action = this.remap.actions[this.remap.idx];
    this.remap.pending[action] = [code];
    this.remap.idx++;
    if (this.remap.idx >= this.remap.actions.length) {
      this.settings.keymap = sanitizeKeymap(this.remap.pending);
      saveSettings(this.settings);
      this.state = 'settings';
    }
  }

  // ---- Initials entry -------------------------------------------------------
  _updateEntry(input) {
    const e = this.entry;
    const cycle = (dir) => {
      const i = ENTRY_ALPHABET.indexOf(e.chars[e.slot]);
      const n = ENTRY_ALPHABET.length;
      e.chars[e.slot] = ENTRY_ALPHABET[(i + dir + n) % n];
    };

    if (input.tap('ArrowUp', 'ArrowRight')) cycle(1);
    if (input.tap('ArrowDown', 'ArrowLeft')) cycle(-1);
    if (input.typedChar && input.typedChar !== ' ' && ENTRY_ALPHABET.includes(input.typedChar)) {
      e.chars[e.slot] = input.typedChar;
      if (e.slot < 2) e.slot++;
    }
    if (input.tap('Backspace') && e.slot > 0) e.slot--;
    if (input.tap('Space', 'Enter', 'NumpadEnter')) {
      if (e.slot < 2) {
        e.slot++;
      } else {
        const initials = e.chars.join('');
        this.board = leaderboard.insert(this.board, initials, e.score);
        leaderboard.save(this.board);
        this._submitRemote(initials, e.score);
        this.entryQueue.shift();
        this._beginNextEntry();
      }
    }
  }

  _submitRemote(initials, score) {
    if (!remote.isConfigured()) return;
    remote.submit(initials, score).then((ok) => { if (ok) this._refreshGlobal(); });
  }

  _updateGameOver(input) {
    if (input.tap('Enter', 'NumpadEnter')) { this.start(this.numPlayers); return; }
    if (this.gameoverTimer > 0 && --this.gameoverTimer <= 0) {
      this.state = 'attract';
      this._initDemo();
    }
  }

  /** Keep leftovers drifting on the non-playing screens. */
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
    const km = this.settings.keymap;
    s.thrusting = false;
    if (input.down(...km.rotateLeft)) s.rotate(-1);
    if (input.down(...km.rotateRight)) s.rotate(1);
    if (input.down(...km.thrust)) {
      s.thrust();
      this.sfx.thrust(true);
    } else {
      this.audio.thrust(false);
    }

    if (this.fireCooldown > 0) this.fireCooldown--;
    if (input.down(...km.fire) && this.fireCooldown <= 0 && this.bullets.length < MAX_BULLETS) {
      this._fire();
    }

    if (this.hyperCooldown > 0) this.hyperCooldown--;
    if (input.tap(...km.hyperspace) && this.hyperCooldown <= 0) this._hyperspace();

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
    if (Math.random() < HYPERSPACE_DEATH_CHANCE) { this._killShip(); return; }
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
      this.audio.updateSaucerPan(sc.pos.x);
      if (sc.readyToFire && this.ship) {
        this.enemyBullets.push(sc.fire(this.ship.pos));
        this.sfx.saucerFire(sc.pos.x);
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
    if (kind === 'small') saucer.aimError = smallSaucerAimError(this.score) * this.diff.saucerAim;
    saucer.fireInterval = Math.max(12, Math.round(saucer.fireInterval * this.diff.saucerFire));
    saucer.fireTimer = saucer.fireInterval;
    this.saucers.push(saucer);
    this.sfx.saucerSound(kind, saucer.pos.x);
    this.saucerTimer = this._nextSaucerDelay();
  }

  // ---- Collisions ----------------------------------------------------------
  _collide() {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const a of this.asteroids) {
        if (!a.alive) continue;
        if (circleHit(b, a)) { b.alive = false; this._destroyAsteroid(a, true); break; }
      }
    }
    for (const b of this.bullets) {
      if (!b.alive) continue;
      for (const sc of this.saucers) {
        if (!sc.alive) continue;
        if (circleHit(b, sc)) {
          b.alive = false;
          sc.alive = false;
          this._addScore(sc.score);
          this.sfx.explosion('medium', sc.pos.x);
          this.addShake(SHAKE_SAUCER);
          this._spawnBurst(sc.pos, 16, 3);
        }
      }
    }
    for (const b of this.enemyBullets) {
      if (!b.alive) continue;
      for (const a of this.asteroids) {
        if (!a.alive) continue;
        if (circleHit(b, a)) { b.alive = false; this._destroyAsteroid(a, false); break; }
      }
    }
    for (const b of this.enemyBullets) {
      if (b.alive && this.ship && !this.ship.invulnerable && circleHit(b, this.ship)) {
        b.alive = false;
        this._killShip();
      }
    }
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
          this.sfx.explosion('medium', sc.pos.x);
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
    this.sfx.explosion(a.size, a.pos.x);
    if (a.size === 'large') this.addShake(SHAKE_LARGE_ROCK);
    this._spawnBurst(a.pos, a.size === 'large' ? 14 : a.size === 'medium' ? 10 : 7, 2.6);
    for (const child of a.split()) this.asteroids.push(child);
  }

  _killShip() {
    if (!this.ship || this.ship.invulnerable) return;
    const sx = this.ship.pos.x;
    this.debris.push(...Debris.fromSegments(this.ship.segments(), this.ship.vel));
    this._spawnBurst(this.ship.pos, 10, 2.2);
    this.sfx.shipExplode(sx);
    this.audio.thrust(false);
    this.addShake(SHAKE_SHIP_DEATH);
    this.ship = null;

    if (this.state !== 'playing') { this.respawnTimer = RESPAWN_DELAY_TICKS; return; }

    this.lives--;
    this.audio.stopSaucer();
    const next = this._nextPlayerWithLives();
    if (next === -1) { this._gameOver(); return; }
    if (next === this.current) this.respawnTimer = RESPAWN_DELAY_TICKS;
    else this._switchTo(next);
  }

  _nextPlayerWithLives() {
    const n = this.numPlayers;
    for (let i = 1; i <= n; i++) {
      const idx = (this.current + i) % n;
      if (this.players[idx].lives > 0) return idx;
    }
    return -1;
  }

  _switchTo(next) {
    this.players[this.current].world = this._snapshotWorld();
    this.current = next;
    this._loadWorld(this.players[next].world);
    this.players[next].world = null;
    this.respawnTimer = RESPAWN_DELAY_TICKS;
    this._setBanner(`PLAYER ${next + 1}`);
  }

  _snapshotWorld() {
    return {
      asteroids: this.asteroids,
      saucers: this.saucers,
      wave: this.wave,
      initialRocks: this.initialRocks,
      saucerTimer: this.saucerTimer,
    };
  }

  _loadWorld(w) {
    // Live shots and effects never carry between turns.
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.debris = [];
    this.ship = null;
    if (!w) {
      this.saucers = [];
      this.wave = 0;
      this.spawnWave();
      this.saucerTimer = this._nextSaucerDelay();
    } else {
      this.asteroids = w.asteroids;
      this.saucers = w.saucers;
      this.wave = w.wave;
      this.initialRocks = w.initialRocks;
      this.saucerTimer = w.saucerTimer;
    }
  }

  _tryRespawn() {
    const center = { x: WIDTH / 2, y: HEIGHT / 2 };
    const clear = this.asteroids.every((a) => dist(a.pos, center) > 130)
      && this.saucers.every((s) => dist(s.pos, center) > 170);
    if (clear) this.ship = new Ship();
    else this.respawnTimer = 12;
  }

  _gameOver() {
    this.audio.stopSaucer();
    this.audio.thrust(false);
    this.entryQueue = this.players
      .map((p, i) => ({ i, score: p.score }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score);
    this._beginNextEntry();
  }

  _beginNextEntry() {
    while (this.entryQueue.length && !leaderboard.qualifies(this.board, this.entryQueue[0].score)) {
      this.entryQueue.shift();
    }
    if (this.entryQueue.length === 0) {
      this.state = 'gameover';
      this.gameoverTimer = GAMEOVER_TO_ATTRACT_TICKS;
      return;
    }
    const e = this.entryQueue[0];
    this.state = 'entry';
    this.entry = { chars: ['A', 'A', 'A'], slot: 0, score: e.score, playerIndex: e.i };
  }

  _addScore(pts) {
    if (this.state !== 'playing') return;
    this.score += pts;
    while (this.score >= this.nextExtraLife) {
      this.lives++;
      this.sfx.extraLife();
      this.nextExtraLife += this.diff.extraLife;
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
  renderWorld(ctx) {
    for (const a of this.asteroids) a.draw(ctx);
    for (const sc of this.saucers) sc.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const b of this.enemyBullets) b.draw(ctx);
    for (const d of this.debris) d.draw(ctx);
    this._drawParticles(ctx);
    if (this.ship) this.ship.draw(ctx);
  }

  renderHud(ctx) {
    if (this.state === 'playing' || this.state === 'entry' || this.state === 'gameover') {
      text(ctx, pad(this.score % SCORE_CEILING), 24, 52, 26, 'left');
      text(ctx, `HI ${pad(this.highScore % SCORE_CEILING)}`, WIDTH / 2, 40, 14, 'center');
    }
    if (this.state === 'playing') {
      drawLives(ctx, Math.max(0, this.lives - 1));
      if (this.numPlayers > 1) this._drawPlayerScores(ctx);
      if (this.banner) {
        text(ctx, this.banner.text, WIDTH / 2, HEIGHT / 2 - 40, 40, 'center');
      }
      if (this.paused) text(ctx, 'PAUSED', WIDTH / 2, HEIGHT / 2, 40, 'center');
    } else if (this.state === 'attract') {
      this._drawAttract(ctx);
    } else if (this.state === 'entry') {
      this._drawEntry(ctx);
    } else if (this.state === 'gameover') {
      this._drawGameOver(ctx);
    } else if (this.state === 'settings') {
      this._drawSettings(ctx);
    } else if (this.state === 'remap') {
      this._drawRemap(ctx);
    }
  }

  _drawPlayerScores(ctx) {
    for (let i = 0; i < this.numPlayers; i++) {
      const active = i === this.current;
      const label = `P${i + 1} ${pad(this.players[i].score % SCORE_CEILING)}`;
      const y = 56 + i * 22;
      ctx.save();
      if (!active) ctx.globalAlpha = 0.5;
      text(ctx, label, WIDTH - 24, y, 16, 'right');
      ctx.restore();
    }
  }

  _drawParticles(ctx) {
    ctx.save();
    glow(ctx, PHOSPHOR, 1, 6);
    for (const p of this.particles) dot(ctx, p.pos.x, p.pos.y, 1.6);
    ctx.restore();
  }

  _drawAttract(ctx) {
    text(ctx, 'ASTEROIDS', WIDTH / 2, 190, 64, 'center');
    if (Math.floor(this.tick / 40) % 2 === 0) {
      text(ctx, '1 PLAYER - ENTER     2 PLAYERS - 2', WIDTH / 2, 256, 18, 'center');
    }
    const board = this.boardForDisplay;
    this._drawBoard(ctx, WIDTH / 2, 320, 5, board);
    text(ctx, '← → ROTATE  ↑ THRUST  SPACE FIRE  SHIFT HYPERSPACE',
      WIDTH / 2, HEIGHT - 84, 13, 'center');
    text(ctx, 'S SETTINGS    P PAUSE    M MUTE', WIDTH / 2, HEIGHT - 56, 13, 'center');
  }

  _drawEntry(ctx) {
    const e = this.entry;
    const who = this.numPlayers > 1 ? `PLAYER ${e.playerIndex + 1} - ` : '';
    text(ctx, 'NEW HIGH SCORE', WIDTH / 2, HEIGHT / 2 - 110, 36, 'center');
    text(ctx, `${who}${pad(e.score % SCORE_CEILING)}`, WIDTH / 2, HEIGHT / 2 - 64, 22, 'center');
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
    text(ctx, 'GAME OVER', WIDTH / 2, 200, 56, 'center');
    if (this.numPlayers > 1) {
      for (let i = 0; i < this.numPlayers; i++) {
        text(ctx, `PLAYER ${i + 1}  ${pad(this.players[i].score % SCORE_CEILING)}`,
          WIDTH / 2, 252 + i * 28, 20, 'center');
      }
    } else {
      text(ctx, `SCORE ${pad(this.players[0].score % SCORE_CEILING)}`, WIDTH / 2, 252, 22, 'center');
    }
    this._drawBoard(ctx, WIDTH / 2, 330, 5, this.boardForDisplay);
    text(ctx, 'PRESS ENTER TO PLAY AGAIN', WIDTH / 2, HEIGHT - 80, 20, 'center');
  }

  _drawSettings(ctx) {
    text(ctx, 'SETTINGS', WIDTH / 2, 150, 48, 'center');
    const rows = this._settingsRows();
    const y0 = 250;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const y = y0 + i * 46;
      const sel = i === this.menuIndex;
      const prefix = sel ? '> ' : '  ';
      ctx.save();
      if (!sel) ctx.globalAlpha = 0.65;
      text(ctx, `${prefix}${r.label}`, WIDTH / 2 - 280, y, 22, 'left');
      if (r.value) text(ctx, r.value, WIDTH / 2 + 280, y, 22, 'right');
      ctx.restore();
    }
    text(ctx, '↑↓ SELECT   ← → CHANGE   ENTER / S BACK', WIDTH / 2, HEIGHT - 70, 14, 'center');
  }

  _drawRemap(ctx) {
    text(ctx, 'REMAP CONTROLS', WIDTH / 2, 180, 40, 'center');
    const r = this.remap;
    for (let i = 0; i < r.actions.length; i++) {
      const action = r.actions[i];
      const done = i < r.idx;
      const cur = i === r.idx;
      const key = done ? r.pending[action][0] : (cur ? '_' : '-');
      ctx.save();
      if (!cur && !done) ctx.globalAlpha = 0.5;
      text(ctx, `${ACTION_LABELS[action]}`, WIDTH / 2 - 220, 270 + i * 44, 22, 'left');
      text(ctx, prettyKey(key), WIDTH / 2 + 220, 270 + i * 44, 22, 'right');
      ctx.restore();
    }
    text(ctx, 'PRESS A KEY FOR THE HIGHLIGHTED ACTION   -   ESC CANCELS',
      WIDTH / 2, HEIGHT - 70, 14, 'center');
  }

  _drawBoard(ctx, cx, y0, count, board = this.boardForDisplay) {
    text(ctx, board.label, cx, y0, 20, 'center');
    if (board.rows.length === 0) {
      text(ctx, 'NO SCORES YET', cx, y0 + 40, 16, 'center');
      return;
    }
    const rows = board.rows.slice(0, count);
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

/** Shorten common key codes for display (KeyA -> A, ArrowLeft -> ←). */
function prettyKey(code) {
  if (!code || code === '?' || code === '-') return code || '-';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = {
    ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
    Space: 'SPACE', ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT',
    ControlLeft: 'LCTRL', ControlRight: 'RCTRL', Enter: 'ENTER',
  };
  return map[code] || code.toUpperCase();
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

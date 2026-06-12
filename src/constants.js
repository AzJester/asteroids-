// All tuning values live here. This file is pure data + pure functions so it can
// be imported by both the browser game and the Node unit tests.

export const WIDTH = 1024;
export const HEIGHT = 768;
export const FIXED_STEP = 1000 / 60; // ms of simulation advanced per fixed tick
export const MAX_STEPS_PER_FRAME = 5; // clamp to avoid spiral-of-death after a stall

// ---- Ship ------------------------------------------------------------------
export const SHIP_RADIUS = 14;
export const SHIP_ROT_STEP = Math.PI / 36;     // 5 degrees — the vector-hardware quirk
export const SHIP_ROT_SPEED = (150 * Math.PI) / 180 / 60; // ~150 deg/s, in rad/tick
export const SHIP_THRUST = 0.17;               // px/tick^2 acceleration
export const SHIP_DRAG = 0.992;                // velocity retained per tick — long glide
export const SHIP_MAX_SPEED = 8;               // px/tick
export const SHIP_INVULN_TICKS = 180;          // ~3 s of blinking invulnerability
export const RESPAWN_DELAY_TICKS = 90;         // pause before respawn attempt
export const HYPERSPACE_DEATH_CHANCE = 0.25;   // reentry gamble
export const HYPERSPACE_COOLDOWN_TICKS = 30;

// ---- Bullets ---------------------------------------------------------------
export const MAX_BULLETS = 4;
export const BULLET_SPEED = 10;        // px/tick
export const BULLET_LIFE_TICKS = 70;   // finite travel range, then it fades
export const FIRE_COOLDOWN_TICKS = 7;
export const BULLET_RADIUS = 2;

// ---- Asteroids -------------------------------------------------------------
export const ASTEROID = {
  large:  { radius: 42, score: 20,  speed: [0.5, 1.4], child: 'medium', children: 2 },
  medium: { radius: 22, score: 50,  speed: [0.9, 2.2], child: 'small',  children: 2 },
  small:  { radius: 11, score: 100, speed: [1.6, 3.4], child: null,     children: 0 },
};
export const START_ROCKS = 4;
export const ROCKS_PER_WAVE = 2;
export const MAX_ROCKS = 11;
export const ASTEROID_SPAWN_MARGIN = 110; // keep new rocks away from the ship spawn

/** Number of large asteroids a (1-indexed) wave starts with. */
export function waveAsteroidCount(wave) {
  return Math.min(START_ROCKS + (wave - 1) * ROCKS_PER_WAVE, MAX_ROCKS);
}

// ---- Saucers ---------------------------------------------------------------
export const SAUCER = {
  large: { radius: 20, score: 200,  speed: 2.0, fireInterval: 80, aimError: 0.45 },
  small: { radius: 11, score: 1000, speed: 2.4, fireInterval: 55, aimError: 0.12 },
};
export const SAUCER_BULLET_SPEED = 7;
export const SAUCER_BULLET_LIFE_TICKS = 75;
export const SAUCER_VERTICAL_CHANCE = 0.012; // per tick chance to change vy
export const SMALL_SAUCER_ONLY_SCORE = 10000; // after this, only small saucers spawn
export const SAUCER_SPAWN_MIN_TICKS = 360;    // ~6 s
export const SAUCER_SPAWN_MAX_TICKS = 900;    // ~15 s

/**
 * The small saucer's aim error (radians) shrinks as the score climbs — in the
 * original the saucer becomes a near-perfect shot deep into a run, which is
 * what forces expert players to keep moving after 10,000.
 */
export function smallSaucerAimError(score) {
  const t = Math.min(1, score / 40000);
  return Math.max(0.03, SAUCER.small.aimError - t * (SAUCER.small.aimError - 0.03));
}

// ---- Meta ------------------------------------------------------------------
export const START_LIVES = 3;
export const EXTRA_LIFE_EVERY = 10000;
export const SCORE_CEILING = 100000; // display rolls over at 99,990

// ---- Heartbeat -------------------------------------------------------------
export const HEARTBEAT_SLOW_TICKS = 60; // full wave: ~1 beat/s
export const HEARTBEAT_FAST_TICKS = 18; // nearly cleared: rapid panic pulse

// ---- Presentation ----------------------------------------------------------
export const PHOSPHOR_FADE = 0.45;       // per-frame fade of the trail buffer
export const DEMO_ROCKS = 6;             // attract-mode field size
export const GAMEOVER_TO_ATTRACT_TICKS = 720; // ~12 s, then back to attract demo

// ---- Leaderboard -----------------------------------------------------------
export const LEADERBOARD_MAX = 10;
export const ENTRY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ';

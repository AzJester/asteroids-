# Asteroids (1979) — Build Plan

A faithful recreation of Atari's 1979 vector arcade classic, built with **HTML5
Canvas 2D + vanilla JavaScript (ES modules)** — no framework, no build step.

## Guiding principle
Recreate the arcade original's *feel*, not just its rules: Ed Logg's tuned ship
momentum (between "no friction" and "too much friction") and Howard Delman's
relentless two-note bass heartbeat that speeds up as a wave thins. We target the
**original 1979 behavior**, explicitly *not* Deluxe — saucers do not target the
asteroids (corner-lurking stays viable), hyperspace exists (no shield), and the
score display rolls over at 99,990.

## Tech
- HTML5 Canvas 2D, vanilla JS ES modules. Runs via a static server
  (`npm start` → `python3 -m http.server`) because browsers block modules over
  `file://`.
- Web Audio API for all 13 SFX + heartbeat, fully synthesized (no audio files).
- localStorage for the persistent high score.
- Fixed-timestep simulation (60 Hz) decoupled from `requestAnimationFrame`.
- One logical coordinate space (1024×768) scaled/letterboxed to the window.

## Faithful mechanics
- 5° rotation steps (firing angle quantized → the documented "gap" quirk).
- Ship momentum: thrust adds acceleration along the facing; drag + max speed; you
  keep gliding when you stop thrusting.
- Screen wraps on every edge; bullets wrap too (enables wrap-around saucer kills).
- 4 shots max on screen, each with finite range/lifetime.
- Rocks split: large→2 medium, medium→2 small, small→destroyed; fragments faster.
- Two saucers: large (200 pts, loose/random fire) and small (1,000 pts, aims at
  the player). Saucer bullets wrap and can break asteroids (chaos), but saucers
  do not aim at rocks. After 10,000 pts only small saucers spawn.
- Hyperspace: teleport to a random spot with ~25% chance of death on reentry.
- Scoring: 20 / 50 / 100 (L/M/S rock), 200 (large saucer), 1,000 (small saucer).
- 3 starting ships, +1 extra ship per 10,000 points.
- Each cleared wave reloads a denser field (4 rocks, +2/wave, cap 11); the
  heartbeat tempo scales with rocks remaining.

## Architecture
```
index.html            canvas + module bootstrap
src/
  main.js             canvas setup, scaling, fixed-step RAF loop
  constants.js        all tuning values
  game.js             state machine, waves, score, lives, spawns
  input.js            keyboard (held + edge-tapped)
  audio.js            Web Audio synth: 13 SFX + heartbeat scheduler
  render.js           vector-glow drawing helpers
  entities/{ship,bullet,asteroid,saucer}.js
  util/{vec,wrap,collision,rng}.js   pure logic (unit-tested)
test/                 node:test unit tests for pure logic
```

## Controls
← / → rotate · ↑ thrust · Space fire · Shift or H hyperspace · Enter start/restart
· P pause.

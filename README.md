# Asteroids (1979)

A faithful, dependency-free recreation of Atari's 1979 vector arcade classic,
built with **HTML5 Canvas 2D + vanilla JavaScript (ES modules)**. All sound is
synthesized live with the Web Audio API — no images, no audio files, no build
step.

**Play it now: https://azjester.github.io/asteroids-/**

## Run locally

Browsers block ES modules loaded over `file://`, so serve the folder over HTTP:

```bash
npm start          # python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, `php -S localhost:8000`, etc.).

### Controls

| Action            | Keyboard                 | Gamepad (standard)        |
| ----------------- | ------------------------ | ------------------------- |
| Rotate left/right | ← / →  (or A / D)         | D-pad / left stick        |
| Thrust            | ↑  (or W)                 | B, RT, or D-pad up        |
| Fire              | Space                    | A                         |
| Hyperspace        | Shift  (or H)             | X                         |
| 1-player start    | Enter                    | Start                     |
| 2-player start    | 2                        | —                         |
| Settings          | S                        | —                         |
| Pause             | P                        | —                         |
| Mute              | M                        | —                         |

Gameplay keys are remappable in **Settings**. On touch devices, on-screen
buttons appear automatically and tapping the field starts a game.

### Two-player

Press `2` on the title screen for classic alternating play: players swap on each
death (each keeps their own score, lives, and board state) until both are out.

### Settings (press `S`)

Volume, sound on/off, **CRT filter**, **reduce motion** (disables screen shake
and phosphor trails), **difficulty** (Easy / Normal / Hard — affects starting
lives, saucer aggression, and the extra-life threshold), full **key remapping**,
and reset-local-scores. All persisted to `localStorage`.

### Install / offline (PWA)

The game ships a web manifest + service worker, so it can be **installed to a
phone or desktop home screen and played offline**. Open the Pages link and use
your browser's "Install app" / "Add to Home Screen".

### Extras beyond the cabinet

- **Attract mode** — a simple AI flies the ship behind the title, like the demo
  loop that lured quarters in 1979.
- **Phosphor trails** — moving objects leave the brief ghosting of a vector CRT.
- **Ship break-up death** — the hull splits into drifting, spinning line
  segments, as in the original.
- **Top-10 leaderboard** with arcade-style 3-initial entry. Local by default; an
  optional **global online board** (cross-device) can be enabled by pointing it
  at a Supabase project — see [`supabase/README.md`](./supabase/README.md). Until
  configured, it cleanly uses the local board.
- **CRT presentation** — scanlines, vignette, and screen shake (all toggleable).

## What's faithful to the original

- **Ship momentum** — thrust accelerates along the nose, drag + a max-speed cap
  give the signature "keep gliding, thrust against your own drift" feel.
- **5° rotation steps** — the heading is quantized to 5° increments, reproducing
  the vector-hardware aiming quirk where a rock can hide between two firing
  angles.
- **Screen wrap on every edge**, including bullets — which makes the classic
  wrap-around saucer kill possible.
- **4 shots on screen**, each with a finite range/lifetime, so you must aim.
- **Splitting rocks** — large → 2 medium → 2 small → dust; fragments move faster.
- **Two saucers** — the large saucer (200 pts) fires loosely; the small saucer
  (1,000 pts) tracks and aims at you. After 10,000 points only small saucers
  appear. Saucer bullets wrap and can shatter asteroids into chaos. (This is the
  1979 behavior — saucers do **not** target the rocks, so corner-lurking still
  works; that anti-lurking change was Deluxe.)
- **Hyperspace** — teleports to a random spot with a ~25% chance of death on
  reentry.
- **Scoring** — 20 / 50 / 100 for large / medium / small rocks, 200 for the large
  saucer, 1,000 for the small one. An extra ship every 10,000 points; the score
  display rolls over at 99,990.
- **The bass heartbeat** — the two-note pulse that speeds up as a wave thins out.
- Each cleared wave reloads a denser field (4 rocks, +2 per wave, capped at 11).

## Project layout

```
index.html              canvas + module bootstrap
src/
  main.js               canvas setup, scaling, fixed-step (60 Hz) RAF loop
  constants.js          all tuning values (the "feel")
  game.js               state machine, waves, score, lives, spawns, collisions
  input.js              keyboard (held + edge-tapped)
  audio.js              Web Audio synthesis: SFX + heartbeat scheduler
  render.js             vector-glow drawing helpers
  entities/             ship, bullet, asteroid, saucer
  util/                 vec, wrap, collision, rng (pure logic, unit-tested)
test/                   node:test unit tests for the pure logic
```

## Tests

```bash
npm test                 # unit tests (node --test)
npm run test:browser     # headless Chromium smoke test (needs: npx playwright install chromium)
```

CI runs both on every pull request and push to `main`; pushes to `main` also
deploy the game to GitHub Pages.

The simulation runs on a fixed 60 Hz timestep decoupled from the render loop, so
physics feel identical regardless of display refresh rate.

import {
  WIDTH, HEIGHT, FIXED_STEP, MAX_STEPS_PER_FRAME, PHOSPHOR_FADE,
} from './constants.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Game } from './game.js';
import { initTouch } from './touch.js';
import { pollGamepads } from './gamepad.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Offscreen buffer for world entities. Instead of clearing it, each frame fades
// it toward black — moving objects leave the short phosphor trails of a vector
// CRT. The HUD is drawn directly on the main canvas so text stays crisp.
const world = document.createElement('canvas');
const wctx = world.getContext('2d');

const audio = new Audio();
const input = new Input(window);
input.onFirstInput = () => audio.resume();
const game = new Game(audio);
initTouch(input);

// Exposed for the headless browser smoke test.
window.__game = game;

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let dpr = 1;
let wq = 1; // world-buffer quality multiplier

function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  scale = Math.min(w / WIDTH, h / HEIGHT);
  offsetX = (w - WIDTH * scale) / 2;
  offsetY = (h - HEIGHT * scale) / 2;

  wq = Math.max(0.5, Math.min(2, dpr * scale));
  world.width = Math.round(WIDTH * wq);
  world.height = Math.round(HEIGHT * wq);
}
window.addEventListener('resize', resize);
resize();

// Don't let the game run (and kill the player) in a background tab/window.
window.addEventListener('blur', () => {
  if (game.state === 'playing') game.paused = true;
});

// Tapping the field starts the game on touch devices (no Enter key there).
canvas.addEventListener('pointerdown', () => {
  if (game.state !== 'playing') input.tapVirtual('Enter');
});

function render() {
  // Fade the trail buffer, then draw this frame's entities into it.
  wctx.setTransform(wq, 0, 0, wq, 0, 0);
  wctx.fillStyle = `rgba(0, 0, 0, ${PHOSPHOR_FADE})`;
  wctx.fillRect(0, 0, WIDTH, HEIGHT);
  game.renderWorld(wctx);

  // Clear the device surface and blit the trail buffer, letterboxed.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
  ctx.drawImage(world, 0, 0, world.width, world.height, 0, 0, WIDTH, HEIGHT);

  // Faint play-field border, then the crisp HUD layer.
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 180, 210, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();
  game.renderHud(ctx);
}

let acc = 0;
let last = performance.now();
function frame(now) {
  let dtMs = now - last;
  last = now;
  if (dtMs > 250) dtMs = 250; // tab was backgrounded — don't fast-forward forever
  acc += dtMs;

  pollGamepads(input);

  let steps = 0;
  while (acc >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
    game.update(input);
    input.endTick();
    acc -= FIXED_STEP;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) acc = 0;

  render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

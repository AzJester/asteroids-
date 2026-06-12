import { WIDTH, HEIGHT, FIXED_STEP, MAX_STEPS_PER_FRAME } from './constants.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Game } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const audio = new Audio();
const input = new Input(window);
input.onFirstInput = () => audio.resume();
const game = new Game(audio);

let scale = 1;
let offsetX = 0;
let offsetY = 0;
let dpr = 1;

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
}
window.addEventListener('resize', resize);
resize();

function render() {
  // Clear the whole device surface to black.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Switch to letterboxed logical space (1024x768) for all game drawing.
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);

  // Faint play-field border.
  ctx.save();
  ctx.strokeStyle = 'rgba(120,180,210,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  game.render(ctx);
}

let acc = 0;
let last = performance.now();
function frame(now) {
  let dtMs = now - last;
  last = now;
  if (dtMs > 250) dtMs = 250; // tab was backgrounded — don't fast-forward forever
  acc += dtMs;

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

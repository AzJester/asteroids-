// Toroidal screen wrapping. The playfield is a torus: leaving one edge brings you
// back on the opposite edge. Pure functions — used by the game and the tests.

import { WIDTH, HEIGHT } from '../constants.js';

/** Wrap a position in-place onto the [0,WIDTH) x [0,HEIGHT) torus. */
export function wrap(pos, width = WIDTH, height = HEIGHT) {
  if (pos.x < 0) pos.x += width;
  else if (pos.x >= width) pos.x -= width;
  if (pos.y < 0) pos.y += height;
  else if (pos.y >= height) pos.y -= height;
  return pos;
}

/**
 * Shortest wrapped delta from a to b on the torus (each component in
 * [-size/2, size/2]). Used for saucer aiming across the screen seam.
 */
export function wrappedDelta(a, b, width = WIDTH, height = HEIGHT) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (dx > width / 2) dx -= width;
  else if (dx < -width / 2) dx += width;
  if (dy > height / 2) dy -= height;
  else if (dy < -height / 2) dy += height;
  return { x: dx, y: dy };
}

// Collision + asteroid-splitting logic. Kept pure (no DOM, no rendering) so the
// core rules are unit-tested directly.

import { ASTEROID } from '../constants.js';
import { dist } from './vec.js';

/** Circle-vs-circle overlap test. */
export function circleHit(a, b) {
  return dist(a.pos, b.pos) <= a.radius + b.radius;
}

/**
 * Describe what happens when an asteroid of `size` is hit: the points scored and
 * the child size to spawn (or null when it's destroyed outright). This is the
 * canonical split table — large→2 medium, medium→2 small, small→gone.
 */
export function splitResult(size) {
  const cfg = ASTEROID[size];
  return {
    score: cfg.score,
    childSize: cfg.child,
    childCount: cfg.children,
  };
}

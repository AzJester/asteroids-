// Minimal 2D vector helpers. Pure functions — safe to import in Node tests.

export function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a, s) {
  return { x: a.x * s, y: a.y * s };
}

export function fromAngle(angle, mag = 1) {
  return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag };
}

export function length(a) {
  return Math.hypot(a.x, a.y);
}

export function angleOf(a) {
  return Math.atan2(a.y, a.x);
}

/** Clamp a vector's magnitude to `max`, returning a new vector. */
export function clampLength(a, max) {
  const len = length(a);
  if (len <= max || len === 0) return { x: a.x, y: a.y };
  const s = max / len;
  return { x: a.x * s, y: a.y * s };
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

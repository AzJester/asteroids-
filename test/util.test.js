import { test } from 'node:test';
import assert from 'node:assert/strict';

import { add, scale, fromAngle, length, clampLength, dist } from '../src/util/vec.js';
import { wrap, wrappedDelta } from '../src/util/wrap.js';
import { WIDTH, HEIGHT } from '../src/constants.js';

test('vec add / scale', () => {
  assert.deepEqual(add({ x: 1, y: 2 }, { x: 3, y: -1 }), { x: 4, y: 1 });
  assert.deepEqual(scale({ x: 2, y: -3 }, 2), { x: 4, y: -6 });
});

test('vec fromAngle has the requested magnitude', () => {
  const v = fromAngle(Math.PI / 3, 5);
  assert.ok(Math.abs(length(v) - 5) < 1e-9);
});

test('clampLength caps magnitude but keeps short vectors', () => {
  assert.ok(Math.abs(length(clampLength({ x: 30, y: 40 }, 10)) - 10) < 1e-9);
  assert.deepEqual(clampLength({ x: 3, y: 4 }, 100), { x: 3, y: 4 });
});

test('dist is symmetric and correct', () => {
  assert.equal(dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('wrap maps off-screen positions back onto the torus', () => {
  assert.deepEqual(wrap({ x: -5, y: 10 }), { x: WIDTH - 5, y: 10 });
  assert.deepEqual(wrap({ x: WIDTH + 3, y: HEIGHT + 2 }), { x: 3, y: 2 });
});

test('wrappedDelta picks the shortest path across the seam', () => {
  const d = wrappedDelta({ x: 10, y: 0 }, { x: WIDTH - 10, y: 0 });
  assert.equal(d.x, -20);
});

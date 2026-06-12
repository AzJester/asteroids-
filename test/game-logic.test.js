import { test } from 'node:test';
import assert from 'node:assert/strict';

import { circleHit, splitResult } from '../src/util/collision.js';
import {
  waveAsteroidCount, smallSaucerAimError, ASTEROID, SAUCER, MAX_ROCKS,
} from '../src/constants.js';
import { Asteroid } from '../src/entities/asteroid.js';

test('circleHit detects overlap by radius sum', () => {
  const a = { pos: { x: 0, y: 0 }, radius: 10 };
  const b = { pos: { x: 15, y: 0 }, radius: 10 };
  const c = { pos: { x: 25, y: 0 }, radius: 10 };
  assert.equal(circleHit(a, b), true);
  assert.equal(circleHit(a, c), false); // exactly touching counts; 25 > 20 does not
});

test('splitResult follows the canonical L->M->S->gone table', () => {
  assert.deepEqual(splitResult('large'), { score: 20, childSize: 'medium', childCount: 2 });
  assert.deepEqual(splitResult('medium'), { score: 50, childSize: 'small', childCount: 2 });
  assert.deepEqual(splitResult('small'), { score: 100, childSize: null, childCount: 0 });
});

test('asteroid scores match the original point values', () => {
  assert.equal(ASTEROID.large.score, 20);
  assert.equal(ASTEROID.medium.score, 50);
  assert.equal(ASTEROID.small.score, 100);
});

test('wave size starts at 4 and grows by 2, capped', () => {
  assert.equal(waveAsteroidCount(1), 4);
  assert.equal(waveAsteroidCount(2), 6);
  assert.equal(waveAsteroidCount(3), 8);
  assert.equal(waveAsteroidCount(100), MAX_ROCKS);
});

test('splitting a large rock yields two medium rocks', () => {
  const a = Asteroid.spawn('large', { x: 100, y: 100 });
  const kids = a.split();
  assert.equal(kids.length, 2);
  assert.ok(kids.every((k) => k.size === 'medium'));
});

test('splitting a small rock yields nothing', () => {
  const a = Asteroid.spawn('small', { x: 100, y: 100 });
  assert.equal(a.split().length, 0);
});

test('small saucer aim tightens as score climbs, with a floor', () => {
  assert.equal(smallSaucerAimError(0), SAUCER.small.aimError);
  assert.ok(smallSaucerAimError(20000) < smallSaucerAimError(0));
  assert.equal(smallSaucerAimError(40000), 0.03);
  assert.equal(smallSaucerAimError(999999), 0.03); // never below the floor
});

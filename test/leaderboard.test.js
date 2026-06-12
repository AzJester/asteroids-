import { test } from 'node:test';
import assert from 'node:assert/strict';

import { qualifies, insert, load, save } from '../src/leaderboard.js';
import { LEADERBOARD_MAX } from '../src/constants.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

test('qualifies: empty board accepts any positive score, rejects zero', () => {
  assert.equal(qualifies([], 10), true);
  assert.equal(qualifies([], 0), false);
});

test('qualifies: full board requires beating the lowest entry', () => {
  const board = Array.from({ length: LEADERBOARD_MAX }, (_, i) => ({
    initials: 'AAA',
    score: (LEADERBOARD_MAX - i) * 100,
  }));
  assert.equal(qualifies(board, 100), false); // ties the lowest — no spot
  assert.equal(qualifies(board, 150), true);
});

test('insert keeps the board sorted descending and capped', () => {
  let board = [];
  for (const s of [300, 100, 200, 500, 400]) board = insert(board, 'ABC', s);
  assert.deepEqual(board.map((e) => e.score), [500, 400, 300, 200, 100]);

  for (let i = 0; i < 20; i++) board = insert(board, 'ZZZ', i);
  assert.equal(board.length, LEADERBOARD_MAX);
  assert.equal(board[0].score, 500);
});

test('load returns [] for empty or corrupted storage', () => {
  assert.deepEqual(load(fakeStorage()), []);
  assert.deepEqual(load(fakeStorage({ 'asteroids.leaderboard': 'not json' })), []);
});

test('load migrates the legacy single high-score key', () => {
  const board = load(fakeStorage({ 'asteroids.highscore': '4250' }));
  assert.deepEqual(board, [{ initials: '---', score: 4250 }]);
});

test('save/load round-trips', () => {
  const storage = fakeStorage();
  const board = [{ initials: 'EDL', score: 99990 }];
  save(board, storage);
  assert.deepEqual(load(storage), board);
});

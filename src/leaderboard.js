// Arcade-style top-10 leaderboard persisted to localStorage. The pure functions
// (qualifies / insert) take the board as data so they are unit-testable; load
// and save isolate the storage access.

import { LEADERBOARD_MAX } from './constants.js';

const KEY = 'asteroids.leaderboard';
const LEGACY_KEY = 'asteroids.highscore';

/** Does `score` earn a spot on the board? */
export function qualifies(board, score) {
  if (score <= 0) return false;
  if (board.length < LEADERBOARD_MAX) return true;
  return score > board[board.length - 1].score;
}

/** Insert an entry, keeping the board sorted descending and capped. */
export function insert(board, initials, score) {
  const next = [...board, { initials, score }];
  next.sort((a, b) => b.score - a.score);
  return next.slice(0, LEADERBOARD_MAX);
}

export function load(storage = getStorage()) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((e) => e && typeof e.score === 'number' && typeof e.initials === 'string')
          .slice(0, LEADERBOARD_MAX);
      }
    }
    // Migrate the old single high-score key if present.
    const legacy = parseInt(storage.getItem(LEGACY_KEY), 10);
    if (legacy > 0) return [{ initials: '---', score: legacy }];
  } catch {
    /* corrupted or unavailable storage — start fresh */
  }
  return [];
}

export function save(board, storage = getStorage()) {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(board));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

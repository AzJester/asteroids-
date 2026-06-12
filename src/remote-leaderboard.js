// Global online leaderboard client (Supabase REST). When unconfigured every
// call short-circuits so the game runs on the local board alone. The pure
// helpers (isConfigured / sanitizeInitials / validScore / buildTopUrl) are
// unit-tested; the fetch wrappers are thin and best-effort.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
import { SCORE_CEILING, LEADERBOARD_MAX } from './constants.js';

export function isConfigured(url = SUPABASE_URL, key = SUPABASE_ANON_KEY) {
  return Boolean(url) && Boolean(key);
}

/** Force initials to exactly three A–Z/space characters. */
export function sanitizeInitials(raw) {
  const up = String(raw || '').toUpperCase().replace(/[^A-Z ]/g, '');
  return (up + 'AAA').slice(0, 3);
}

export function validScore(n) {
  return Number.isInteger(n) && n >= 0 && n < SCORE_CEILING;
}

export function buildTopUrl(base = SUPABASE_URL, limit = LEADERBOARD_MAX) {
  const root = base.replace(/\/$/, '');
  return `${root}/rest/v1/scores?select=initials,score&order=score.desc&limit=${limit}`;
}

function headers() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
}

/** Returns an array of {initials, score} or null on any failure. */
export async function fetchTop(limit = LEADERBOARD_MAX) {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(buildTopUrl(SUPABASE_URL, limit), { headers: headers() });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    return rows
      .filter((r) => r && typeof r.initials === 'string' && Number.isFinite(r.score))
      .map((r) => ({ initials: sanitizeInitials(r.initials), score: r.score }));
  } catch {
    return null;
  }
}

/** Best-effort submit. Returns true on success, false otherwise. */
export async function submit(initials, score) {
  if (!isConfigured()) return false;
  const clean = sanitizeInitials(initials);
  if (!validScore(score)) return false;
  try {
    const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/scores`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify({ initials: clean, score }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

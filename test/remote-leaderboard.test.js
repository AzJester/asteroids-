import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isConfigured, sanitizeInitials, validScore, buildTopUrl,
} from '../src/remote-leaderboard.js';
import { SCORE_CEILING } from '../src/constants.js';

test('isConfigured requires both url and key', () => {
  assert.equal(isConfigured('', ''), false);
  assert.equal(isConfigured('https://x.supabase.co', ''), false);
  assert.equal(isConfigured('', 'anonkey'), false);
  assert.equal(isConfigured('https://x.supabase.co', 'anonkey'), true);
});

test('default config ships disabled (local-only board)', () => {
  // With no project configured, the live export must report not-configured so
  // the game never tries to hit a blank URL.
  assert.equal(isConfigured(), false);
});

test('sanitizeInitials yields exactly three A-Z/space chars', () => {
  assert.equal(sanitizeInitials('edl'), 'EDL');
  assert.equal(sanitizeInitials('a'), 'AAA');
  assert.equal(sanitizeInitials(''), 'AAA');
  assert.equal(sanitizeInitials('toolong'), 'TOO');
  assert.equal(sanitizeInitials('a1!b'), 'ABA'); // strips non-letters then pads
});

test('validScore accepts in-range integers only', () => {
  assert.equal(validScore(0), true);
  assert.equal(validScore(99990), true);
  assert.equal(validScore(SCORE_CEILING), false); // ceiling is exclusive
  assert.equal(validScore(-1), false);
  assert.equal(validScore(12.5), false);
  assert.equal(validScore(NaN), false);
});

test('buildTopUrl forms a sorted, limited REST query', () => {
  const url = buildTopUrl('https://abc.supabase.co/', 10);
  assert.equal(
    url,
    'https://abc.supabase.co/rest/v1/scores?select=initials,score&order=score.desc&limit=10',
  );
});

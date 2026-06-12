import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  defaultSettings, loadSettings, saveSettings, sanitizeKeymap,
  DEFAULT_KEYMAP, DIFFICULTY,
} from '../src/settings.js';

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    data,
  };
}

test('defaults are sane', () => {
  const s = defaultSettings();
  assert.equal(s.difficulty, 'normal');
  assert.equal(s.crt, true);
  assert.equal(s.muted, false);
  assert.ok(s.volume > 0 && s.volume <= 1);
  assert.deepEqual(Object.keys(s.keymap).sort(), Object.keys(DEFAULT_KEYMAP).sort());
});

test('load returns defaults for empty storage', () => {
  assert.deepEqual(loadSettings(fakeStorage()), defaultSettings());
});

test('load clamps volume and rejects bad difficulty', () => {
  const s = loadSettings(fakeStorage({
    'asteroids.settings': JSON.stringify({ volume: 5, difficulty: 'impossible' }),
  }));
  assert.equal(s.volume, 1);
  assert.equal(s.difficulty, 'normal'); // invalid -> default
});

test('save/load round-trips a customized config', () => {
  const storage = fakeStorage();
  const s = defaultSettings();
  s.volume = 0.3;
  s.muted = true;
  s.crt = false;
  s.difficulty = 'hard';
  s.keymap.fire = ['KeyZ'];
  saveSettings(s, storage);
  assert.deepEqual(loadSettings(storage), s);
});

test('sanitizeKeymap fills missing actions from defaults and keeps valid ones', () => {
  const km = sanitizeKeymap({ fire: ['KeyZ'], thrust: [], bogus: ['KeyQ'] });
  assert.deepEqual(km.fire, ['KeyZ']);          // valid override kept
  assert.deepEqual(km.thrust, DEFAULT_KEYMAP.thrust); // empty -> default
  assert.deepEqual(km.rotateLeft, DEFAULT_KEYMAP.rotateLeft); // missing -> default
  assert.equal('bogus' in km, false);           // unknown action dropped
});

test('every difficulty preset has the required fields', () => {
  for (const key of Object.keys(DIFFICULTY)) {
    const d = DIFFICULTY[key];
    for (const f of ['label', 'lives', 'extraLife', 'saucerFire', 'saucerAim', 'saucerSpawn']) {
      assert.ok(f in d, `${key} missing ${f}`);
    }
  }
});

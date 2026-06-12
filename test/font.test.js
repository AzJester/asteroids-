import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GLYPHS, textWidth } from '../src/font.js';

// Every string the game renders. If a new screen adds text, add it here so the
// coverage check below keeps the font honest.
const UI_STRINGS = [
  'ASTEROIDS',
  'PRESS ENTER TO PLAY',
  'PRESS ENTER TO PLAY AGAIN',
  'GAME OVER',
  'PAUSED',
  'HIGH SCORES',
  'NEW HIGH SCORE',
  'ENTER YOUR INITIALS',
  'ROTATE TO CHANGE - FIRE TO LOCK',
  '← → ROTATE  ↑ THRUST  SPACE FIRE  SHIFT HYPERSPACE',
  '1 PLAYER - ENTER     2 PLAYERS - 2',
  'S SETTINGS    P PAUSE    M MUTE',
  'GLOBAL HIGH SCORES',
  'HIGH SCORES - LOCAL',
  'NO SCORES YET',
  'SETTINGS',
  '↑↓ SELECT   ← → CHANGE   ENTER / S BACK',
  'VOLUME SOUND CRT FILTER REDUCE MOTION DIFFICULTY CONTROLS REMAP',
  'RESET LOCAL SCORES   BACK   ON OFF EASY NORMAL HARD',
  'REMAP CONTROLS',
  'PRESS A KEY FOR THE HIGHLIGHTED ACTION   -   ESC CANCELS',
  'ROTATE LEFT  ROTATE RIGHT  THRUST  FIRE  HYPERSPACE',
  'PLAYER 1  PLAYER 2  P1 00000  P2 99990',
  'LSHIFT RSHIFT LCTRL RCTRL',
  'HI 00000',
  '0123456789',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '---',
  '_',
];

test('every character used by the UI has a glyph', () => {
  const missing = new Set();
  for (const str of UI_STRINGS) {
    for (const ch of str.toUpperCase()) {
      if (!(ch in GLYPHS)) missing.add(ch);
    }
  }
  assert.deepEqual([...missing], [], `missing glyphs: ${[...missing].join(' ')}`);
});

test('glyph data is well-formed polylines', () => {
  for (const [ch, glyph] of Object.entries(GLYPHS)) {
    for (const line of glyph) {
      assert.ok(line.length >= 2, `glyph ${ch} has a degenerate polyline`);
      for (const pt of line) {
        assert.equal(pt.length, 2, `glyph ${ch} has a malformed point`);
      }
    }
  }
});

test('textWidth scales with length and size', () => {
  assert.equal(textWidth('', 24), 0);
  assert.ok(textWidth('AAA', 24) > textWidth('AA', 24));
  assert.ok(textWidth('AA', 48) > textWidth('AA', 24));
});

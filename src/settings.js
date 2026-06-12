// User settings, persisted to localStorage. Pure load/save with storage
// injected so the logic is unit-testable. Difficulty presets and the default
// key bindings live here too.

const KEY = 'asteroids.settings';

export const DIFFICULTY = {
  easy:   { label: 'EASY',   lives: 4, extraLife: 7000,  saucerFire: 1.45, saucerAim: 1.7, saucerSpawn: 1.35 },
  normal: { label: 'NORMAL', lives: 3, extraLife: 10000, saucerFire: 1.0,  saucerAim: 1.0, saucerSpawn: 1.0 },
  hard:   { label: 'HARD',   lives: 3, extraLife: 12000, saucerFire: 0.7,  saucerAim: 0.55, saucerSpawn: 0.7 },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

// Action -> default key codes. Gameplay reads these; menus stay on fixed keys.
export const DEFAULT_KEYMAP = {
  rotateLeft: ['ArrowLeft', 'KeyA'],
  rotateRight: ['ArrowRight', 'KeyD'],
  thrust: ['ArrowUp', 'KeyW'],
  fire: ['Space'],
  hyperspace: ['ShiftLeft', 'ShiftRight', 'KeyH'],
};

export const ACTION_LABELS = {
  rotateLeft: 'ROTATE LEFT',
  rotateRight: 'ROTATE RIGHT',
  thrust: 'THRUST',
  fire: 'FIRE',
  hyperspace: 'HYPERSPACE',
};

export function defaultSettings() {
  return {
    volume: 0.6,         // 0..1, mapped to audio master gain
    muted: false,
    crt: true,           // scanline / vignette overlay
    reduceMotion: false, // disables screen shake + phosphor trails
    difficulty: 'normal',
    keymap: cloneKeymap(DEFAULT_KEYMAP),
  };
}

export function loadSettings(storage = getStorage()) {
  const s = defaultSettings();
  if (!storage) return s;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return s;
    const parsed = JSON.parse(raw);
    if (typeof parsed.volume === 'number') s.volume = clamp01(parsed.volume);
    if (typeof parsed.muted === 'boolean') s.muted = parsed.muted;
    if (typeof parsed.crt === 'boolean') s.crt = parsed.crt;
    if (typeof parsed.reduceMotion === 'boolean') s.reduceMotion = parsed.reduceMotion;
    if (DIFFICULTY[parsed.difficulty]) s.difficulty = parsed.difficulty;
    if (parsed.keymap) s.keymap = sanitizeKeymap(parsed.keymap);
  } catch {
    /* corrupt — fall back to defaults */
  }
  return s;
}

export function saveSettings(s, storage = getStorage()) {
  if (!storage) return;
  try {
    storage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

/** Merge a stored keymap over the defaults so missing actions stay bound. */
export function sanitizeKeymap(km) {
  const out = cloneKeymap(DEFAULT_KEYMAP);
  for (const action of Object.keys(DEFAULT_KEYMAP)) {
    const v = km[action];
    if (Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === 'string')) {
      out[action] = [...v];
    }
  }
  return out;
}

function cloneKeymap(km) {
  const out = {};
  for (const k of Object.keys(km)) out[k] = [...km[k]];
  return out;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function getStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

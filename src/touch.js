// On-screen touch controls. Shown only on touch devices, and context-aware:
// gameplay buttons while playing, a d-pad + OK/BACK in menus, and big choice
// pills on the title screen. Each button injects a key code into Input, so the
// game logic stays device-agnostic. Multi-touch works because every button
// captures its own pointer.

const BUTTONS = [
  // Gameplay (held).
  { id: 'rotL', label: '◀', code: 'ArrowLeft', hold: true },
  { id: 'rotR', label: '▶', code: 'ArrowRight', hold: true },
  { id: 'thrust', label: 'THR', code: 'ArrowUp', hold: true },
  { id: 'fire', label: 'FIRE', code: 'Space', hold: true, cls: 'big' },
  { id: 'hyp', label: 'HYP', code: 'KeyH', cls: 'small' },
  { id: 'pause', label: 'II', code: 'KeyP', cls: 'small' },
  // Menu d-pad + actions (tapped).
  { id: 'up', label: '▲', code: 'ArrowUp', cls: 'small' },
  { id: 'down', label: '▼', code: 'ArrowDown', cls: 'small' },
  { id: 'left', label: '◀', code: 'ArrowLeft', cls: 'small' },
  { id: 'right', label: '▶', code: 'ArrowRight', cls: 'small' },
  { id: 'ok', label: 'OK', code: 'Enter' },
  { id: 'back', label: 'BACK', code: 'Escape', cls: 'small' },
  // Title-screen choices + fullscreen.
  { id: 'oneP', label: '1 PLAYER', code: 'Enter', cls: 'pill' },
  { id: 'twoP', label: '2 PLAYERS', code: 'Digit2', cls: 'pill' },
  { id: 'settingsBtn', label: 'SETTINGS', code: 'KeyS', cls: 'pill' },
  { id: 'full', label: '⛶', code: null, action: 'fullscreen', cls: 'small' },
];

// Which button ids are visible in each game state.
const LAYOUT = {
  attract: ['oneP', 'twoP', 'settingsBtn', 'full'],
  playing: ['rotL', 'rotR', 'thrust', 'fire', 'hyp', 'pause'],
  settings: ['up', 'down', 'left', 'right', 'ok', 'back'],
  remap: ['back'],
  entry: ['up', 'down', 'left', 'right', 'ok'],
  gameover: ['ok', 'full'],
};

export function isTouchDevice() {
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

function buzz(ms) {
  try { navigator.vibrate && navigator.vibrate(ms); } catch { /* ignore */ }
}

function toggleFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    }
  } catch { /* fullscreen may be blocked; ignore */ }
}

export function initTouch(input) {
  // Wire the rotate-device hint's dismiss button regardless of device, so it
  // works if portrait emulation is active.
  const dismiss = document.getElementById('rh-dismiss');
  if (dismiss) dismiss.addEventListener('click', () => document.body.classList.add('rh-dismissed'));

  if (!isTouchDevice()) return { sync() {} };
  document.body.classList.add('touch');

  const els = {};
  for (const def of BUTTONS) {
    const el = document.createElement('div');
    el.id = `tb-${def.id}`;
    el.className = `touch-btn${def.cls ? ` ${def.cls}` : ''}`;
    el.textContent = def.label;

    const press = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      buzz(def.hold ? 8 : 14);
      if (def.action === 'fullscreen') toggleFullscreen();
      else if (def.hold) input.applyVirtual(def.code, true);
      else input.tapVirtual(def.code);
    };
    const release = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      el.classList.remove('active');
      if (def.hold) input.applyVirtual(def.code, false);
    };

    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    els[def.id] = { el, def, release };
    document.body.appendChild(el);
  }

  let lastVisible = new Set();

  return {
    /** Show the buttons for `state`, releasing any held button being hidden. */
    sync(state) {
      const visible = new Set(LAYOUT[state] || []);
      if (sameSet(visible, lastVisible)) return;
      for (const id of Object.keys(els)) {
        const { el, def, release } = els[id];
        const show = visible.has(id);
        if (show) {
          el.style.display = 'flex';
        } else if (el.style.display !== 'none') {
          if (def.hold) release(); // don't leave a hidden button "held down"
          el.style.display = 'none';
        }
      }
      lastVisible = visible;
    },
  };
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// Gamepad support via the standard-mapping Gamepad API. Polled once per frame;
// state transitions are injected into Input as virtual key presses.
//
// Mapping: D-pad / left stick = rotate · A (0) = fire · B (1) or RT (7) = thrust
//          X (2) = hyperspace · Start (9) = start / restart

const DEADZONE = 0.4;
const prev = new Map();

export function pollGamepads(input) {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads
    ? navigator.getGamepads()
    : [];

  const state = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    Space: false,
    KeyH: false,
    Enter: false,
  };

  for (const pad of pads) {
    if (!pad || pad.mapping !== 'standard') continue;
    const btn = (i) => Boolean(pad.buttons[i] && pad.buttons[i].pressed);
    const axis = pad.axes[0] || 0;
    state.ArrowLeft ||= btn(14) || axis < -DEADZONE;
    state.ArrowRight ||= btn(15) || axis > DEADZONE;
    state.ArrowUp ||= btn(1) || btn(7) || btn(12);
    state.Space ||= btn(0);
    state.KeyH ||= btn(2);
    state.Enter ||= btn(9);
  }

  for (const [code, isDown] of Object.entries(state)) {
    if (prev.get(code) !== isDown) {
      input.applyVirtual(code, isDown);
      prev.set(code, isDown);
    }
  }
}

// Input: tracks keys currently held plus keys "tapped" this tick (edge
// triggered, ignoring auto-repeat). Game code reads held state for continuous
// actions (rotate/thrust/fire) and taps for one-shots (hyperspace/start/pause).
// Touch buttons and gamepads inject the same key codes via applyVirtual, so the
// rest of the game never knows which device produced an action.

const PREVENT = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
]);

export class Input {
  constructor(target = window) {
    this.held = new Set();
    this.tapped = new Set();
    this.onFirstInput = null;
    this._firstSeen = false;

    target.addEventListener('keydown', (e) => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) this.tapped.add(e.code);
      this.held.add(e.code);
      this._noteFirstInput();
      // Direct typing for the initials-entry screen.
      if (e.key.length === 1) this.typedChar = e.key.toUpperCase();
    });

    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });

    // Releasing focus shouldn't leave a key "stuck" thrusting forever.
    target.addEventListener('blur', () => this.held.clear());
  }

  down(...codes) {
    return codes.some((c) => this.held.has(c));
  }

  tap(...codes) {
    return codes.some((c) => this.tapped.has(c));
  }

  /** Press/release a key from a non-keyboard source (touch button, gamepad). */
  applyVirtual(code, isDown) {
    if (isDown) {
      if (!this.held.has(code)) this.tapped.add(code);
      this.held.add(code);
      this._noteFirstInput();
    } else {
      this.held.delete(code);
    }
  }

  /** One-shot tap from a non-keyboard source (e.g. tapping the canvas). */
  tapVirtual(code) {
    this.tapped.add(code);
    this._noteFirstInput();
  }

  /** Clear per-tick taps. Called once per simulation step. */
  endTick() {
    this.tapped.clear();
    this.typedChar = null;
  }

  _noteFirstInput() {
    if (!this._firstSeen) {
      this._firstSeen = true;
      if (this.onFirstInput) this.onFirstInput();
    }
  }
}

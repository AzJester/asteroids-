// Keyboard input: tracks keys currently held plus keys "tapped" this tick (edge
// triggered, ignoring auto-repeat). Game code reads held state for continuous
// actions (rotate/thrust/fire) and taps for one-shots (hyperspace/start/pause).

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
      if (!this._firstSeen) {
        this._firstSeen = true;
        if (this.onFirstInput) this.onFirstInput();
      }
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

  /** Clear per-tick taps. Called once per simulation step. */
  endTick() {
    this.tapped.clear();
  }
}

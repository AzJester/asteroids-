// On-screen touch controls, shown only on touch-capable devices. Each button
// injects a key code into Input, so the game logic is device-agnostic.

const BUTTONS = [
  { label: '←',    code: 'ArrowLeft',  style: { left: '20px',  bottom: '28px' },  size: 76 },
  { label: '→',    code: 'ArrowRight', style: { left: '112px', bottom: '28px' },  size: 76 },
  { label: 'HYP',  code: 'KeyH',       style: { right: '24px', bottom: '208px' }, size: 56 },
  { label: '↑',    code: 'ArrowUp',    style: { right: '112px', bottom: '110px' }, size: 76 },
  { label: 'FIRE', code: 'Space',      style: { right: '20px', bottom: '28px' },  size: 90 },
];

export function isTouchDevice() {
  return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

export function initTouch(input) {
  if (!isTouchDevice()) return;

  for (const def of BUTTONS) {
    const el = document.createElement('div');
    el.textContent = def.label;
    el.className = 'touch-btn';
    el.style.width = `${def.size}px`;
    el.style.height = `${def.size}px`;
    el.style.lineHeight = `${def.size}px`;
    el.style.fontSize = def.label.length > 1 ? `${def.size * 0.28}px` : `${def.size * 0.45}px`;
    Object.assign(el.style, def.style);

    const press = (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      el.classList.add('active');
      input.applyVirtual(def.code, true);
    };
    const release = (e) => {
      e.preventDefault();
      el.classList.remove('active');
      input.applyVirtual(def.code, false);
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    document.body.appendChild(el);
  }
}

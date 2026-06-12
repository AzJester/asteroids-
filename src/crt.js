// Cheap CRT post-processing drawn over the finished frame in device pixels:
// horizontal scanlines + a corner vignette, with a faint brightness flicker.
// The scanline pattern and vignette gradient are cached and only rebuilt when
// the canvas size changes, so this stays nearly free per frame.

let scanCanvas = null;
let scanKey = '';
let vignette = null;
let vignetteKey = '';

function buildScanlines(h) {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = Math.max(2, Math.round(h));
  const g = c.getContext('2d');
  // One dark line every 3 device pixels.
  g.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = 0; y < c.height; y += 3) g.fillRect(0, y, 4, 1);
  return c;
}

function buildVignette(ctx, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const inner = Math.min(w, h) * 0.32;
  const outer = Math.hypot(cx, cy);
  const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  return grad;
}

/**
 * @param ctx    main canvas 2D context (identity transform expected)
 * @param w,h    device-pixel dimensions of the canvas
 * @param tick   frame counter, drives the subtle flicker
 */
export function drawCRT(ctx, w, h, tick = 0) {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Scanlines (tiled vertically from a tiny cached strip).
  const sk = `${Math.round(h)}`;
  if (!scanCanvas || scanKey !== sk) {
    scanCanvas = buildScanlines(h);
    scanKey = sk;
  }
  const pattern = ctx.createPattern(scanCanvas, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }

  // Vignette.
  const vk = `${Math.round(w)}x${Math.round(h)}`;
  if (!vignette || vignetteKey !== vk) {
    vignette = buildVignette(ctx, w, h);
    vignetteKey = vk;
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // Faint brightness flicker, like an analog tube.
  const flicker = 0.015 + 0.015 * Math.sin(tick * 0.3);
  if (flicker > 0) {
    ctx.fillStyle = `rgba(180, 220, 235, ${flicker})`;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
}

export function invalidateCRT() {
  scanCanvas = null;
  vignette = null;
  scanKey = '';
  vignetteKey = '';
}

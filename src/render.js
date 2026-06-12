// Vector-glow drawing helpers. The arcade look is thin luminous lines on black,
// so everything strokes (never fills) with a soft shadow glow.

import { drawText } from './font.js';

export const PHOSPHOR = '#d7f7ff';

/** Configure the context for glowing vector strokes. */
export function glow(ctx, color = PHOSPHOR, width = 1.6, blur = 8) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

/** Stroke a closed/open polyline given as an array of {x,y} points. */
export function strokePath(ctx, points, close = true) {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
}

/** A small filled dot (used for bullets), kept glowing. */
export function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Glowing vector-font text. `y` is the baseline. */
export function text(ctx, str, x, y, size = 24, align = 'left') {
  ctx.save();
  glow(ctx, PHOSPHOR, Math.max(1.2, size / 18), 7);
  drawText(ctx, str, x, y, size, align);
  ctx.restore();
}

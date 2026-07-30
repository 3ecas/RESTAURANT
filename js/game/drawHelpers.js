// Shared canvas primitives. Deliberately dependency-free (no import of registry.js or any
// object type file) so both render.js and individual js/objects/*.js files can use these
// without creating an import cycle.

import { SCALE } from '../core/constants.js';

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function badge(ctx, x, y, num, color) {
  ctx.beginPath();
  ctx.arc(x, y, 7 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.round(9 * SCALE) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), x, y + 1);
}

// a small circle with an icon centered inside — used for anything shown floating above a
// character's head (carried items, order/status bubbles), so it reads as one clean shape
// instead of a bare emoji that can look off-center depending on the glyph
export function iconBadge(ctx, x, y, icon, bgColor) {
  ctx.beginPath();
  ctx.arc(x, y, 10 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 1.5 * SCALE;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();
  ctx.font = Math.round(12 * SCALE) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y);
}

// the little bottom-of-tile progress strip used by stoves, farm crops, and chickens —
// same look everywhere, just a different fill color per use
export function progressBar(ctx, px, py, cellSize, pct, fillColor) {
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(px + 3, py + cellSize - 7, cellSize - 6, 4);
  ctx.fillStyle = fillColor;
  ctx.fillRect(px + 3, py + cellSize - 7, (cellSize - 6) * Math.min(1, pct), 4);
}

// the small checkmark shown in the top-right corner when something just finished
export function readyCheckmark(ctx, px, py, cellSize) {
  ctx.font = Math.round(10 * SCALE) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✅', px + cellSize - 7, py + 7);
}

// Shared shape for anything a chair can pair up with to seat a customer: a table, or a
// counter used as bar seating (see World.chairsForTables / tableOfChair). Order-taking,
// food delivery, and bussing are all handled directly by waiter.js — this type itself just
// carries the dirty-plate state it reads/writes.

import { SCALE } from '../../core/constants.js';

function drawDirtyOverlay(ctx, obj, px, py, cellSize) {
  if (!obj.dirty) return;
  ctx.font = Math.round(11 * SCALE) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🍴', px + cellSize / 2, py + 9);
}

export function makeSeatingSurface({ type, name, icon, cost, color, fixedStock, image }) {
  return {
    type, name, icon, color, cost, category: 'Furniture', fixedStock, image,
    seatingSurface: true,
    createState(base) { return Object.assign(base, { dirty: false, claimedDirty: false }); },
    drawExtra(ctx, obj, px, py, cellSize) { drawDirtyOverlay(ctx, obj, px, py, cellSize); },
  };
}

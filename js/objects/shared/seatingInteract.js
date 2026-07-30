// Shared shape for anything a chair can pair up with to seat a customer: a table, or a
// counter/wall used as bar seating (see World.chairsForTables / tableOfChair).

import { SCALE } from '../../core/constants.js';

// interacting with the seating surface itself: take orders / deliver food for the whole
// table, falling back to picking up a dirty plate if nothing else applies
export function interactTable(table, ctx) {
  const { game, player } = ctx;
  if (game.serveTable(table)) return true;
  if (table.dirty && !player.carrying) {
    table.dirty = false;
    table.claimedDirty = false;
    player.carrying = { kind: 'dirty' };
    return true;
  }
  return false;
}

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
    interact(obj, ctx) { return interactTable(obj, ctx); },
    drawExtra(ctx, obj, px, py, cellSize) { drawDirtyOverlay(ctx, obj, px, py, cellSize); },
  };
}

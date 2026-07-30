// Paying Booth — customers pay here automatically on their way out; the player just
// collects whatever's accumulated.

import { badge } from '../game/drawHelpers.js';

export const payingBooth = {
  type: 'payingBooth',
  name: 'Paying Booth',
  icon: '💳',
  color: '#f2d675',
  cost: 55,
  category: 'Appliances',
  image: 'ASSETS/TERMINAL PAYMENT.png',

  createState(base) {
    return Object.assign(base, { collected: 0 });
  },

  canRemove(obj) { return obj.collected <= 0; },

  interact(obj, ctx) {
    if (obj.collected > 0) {
      ctx.game.addMoney(obj.collected);
      obj.collected = 0;
      return true;
    }
    return false;
  },

  drawExtra(ctx, obj, px, py, cellSize) {
    if (obj.collected > 0) badge(ctx, px + cellSize - 8, py + 7, '$' + obj.collected, '#2e7d32');
  },
};

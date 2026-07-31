// Order Stand — the hand-off point between cooking and delivery: chefs drop cooked dishes
// here (entities/staffRoles/chef.js), waiters pick them up to deliver (staffRoles/waiter.js).

import { badge } from '../game/drawHelpers.js';

export const orderStand = {
  type: 'orderStand',
  name: 'Order Stand',
  icon: '🧾',
  color: '#d8c98a',
  cost: 55,
  category: 'Appliances',
  image: 'ASSETS/ORDER STAND.png',

  createState(base) {
    return Object.assign(base, { pending: [], ready: [] });
  },

  canRemove(obj) { return !(obj.pending.length || obj.ready.length); },

  drawExtra(ctx, obj, px, py, cellSize) {
    if (obj.pending.length > 0) badge(ctx, px + 8, py + 7, obj.pending.length, '#e05252');
    if (obj.ready.length > 0) badge(ctx, px + cellSize - 8, py + 7, obj.ready.length, '#4caf50');
  },
};

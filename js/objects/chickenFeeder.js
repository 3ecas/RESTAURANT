// Chicken Feeder — stocked with wheat from a fridge by a rancher; chickens eat from it
// automatically (see chicken.js's tickChickenHunger).

import { badge } from '../game/drawHelpers.js';

export const FEEDER_CAPACITY = 10;

export const chickenFeeder = {
  type: 'chickenFeeder',
  name: 'Chicken Feeder',
  icon: '🥣',
  color: '#c9a878',
  cost: 28,
  category: 'Ranching',

  createState(base) {
    return Object.assign(base, { wheat: 0 });
  },

  drawExtra(ctx, obj, px, py, cellSize) {
    badge(ctx, px + cellSize - 8, py + 7, obj.wheat || 0, '#c9a227');
  },
};

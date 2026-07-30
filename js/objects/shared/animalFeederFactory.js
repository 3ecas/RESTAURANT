// Shared shape for every animal feeder (chicken feeder, cow trough, ...) — stocked with a
// feed ingredient by a rancher (see entities/staffRoles/rancher.js); the matching animal
// eats from it automatically (see ranchAnimalFactory.js's tickAnimalHunger).

import { badge } from '../../game/drawHelpers.js';

export function makeAnimalFeeder({ type, name, icon, cost, capacity }) {
  return {
    type, name, icon, color: '#c9a878', cost, category: 'Ranching', capacity,

    createState(base) {
      return Object.assign(base, { stock: 0 });
    },

    drawExtra(ctx, obj, px, py, cellSize) {
      badge(ctx, px + cellSize - 8, py + 7, obj.stock || 0, '#c9a227');
    },
  };
}

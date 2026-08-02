// Beehive — spawns 5 bees on placement (see Game.spawnBeesForHive, js/game/input.js's
// placement hook). Bees pollinate nearby growing crops (entities/bee.js) and bring back 1
// honey each; the farmer collects accumulated honey here and carries it to the fridge
// (entities/staffRoles/farmer.js's priority-3 collectHoney task).

import { progressBar } from '../game/drawHelpers.js';

export const beehive = {
  type: 'beehive', name: 'Beehive', icon: '🐝', color: '#f0b429', cost: 120,
  category: 'Farming', requiresUnlock: true,

  createState(base) {
    return Object.assign(base, { honey: 0, honeyCapacity: 15, claimed: false });
  },
  drawExtra(ctx, obj, px, py, cellSize) {
    progressBar(ctx, px, py, cellSize, obj.honey / obj.honeyCapacity, '#f0b429');
  },
};

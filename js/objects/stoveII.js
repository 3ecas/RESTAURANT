// Stove II — unlocked by an achievement reward (see data/achievements.js), not purchasable
// from the start. 2 concurrent slots, 30% faster than a base Stove.

import { makeStove } from './shared/stoveFactory.js';

export const stoveII = Object.assign(
  makeStove({ type: 'stoveII', name: 'Stove II', cost: 150, slotCount: 2, tierMultiplier: 1.3 }),
  { requiresUnlock: true },
);

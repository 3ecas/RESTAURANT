// Stove III — unlocked by an achievement reward (see data/achievements.js), not purchasable
// from the start. 3 concurrent slots, 60% faster than a base Stove.

import { makeStove } from './shared/stoveFactory.js';

export const stoveIII = Object.assign(
  makeStove({ type: 'stoveIII', name: 'Stove III', cost: 350, slotCount: 3, tierMultiplier: 1.6 }),
  { requiresUnlock: true },
);

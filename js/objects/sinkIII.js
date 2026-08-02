// Sink III — holds up to 75 water (see shared/sinkFactory.js). Unlocked by restaurant level
// (see data/levels.js), not purchasable from the start.

import { makeSink } from './shared/sinkFactory.js';

export const sinkIII = Object.assign(
  makeSink({ type: 'sinkIII', name: 'Sink III', cost: 250, capacity: 75 }),
  { requiresUnlock: true },
);

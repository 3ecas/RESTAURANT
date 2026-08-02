// Sink II — holds up to 25 water (see shared/sinkFactory.js). Unlocked by restaurant level
// (see data/levels.js), not purchasable from the start.

import { makeSink } from './shared/sinkFactory.js';

export const sinkII = Object.assign(
  makeSink({ type: 'sinkII', name: 'Sink II', cost: 100, capacity: 25 }),
  { requiresUnlock: true },
);

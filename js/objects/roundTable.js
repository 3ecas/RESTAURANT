// Round Table — a pricier cosmetic alternative to the regular Table, same seating behavior.
// Unlocked by restaurant level (see data/levels.js), not purchasable from the start.
import { makeSeatingSurface } from './shared/seatingInteract.js';

export const roundTable = Object.assign(
  makeSeatingSurface({ type: 'roundTable', name: 'Round Table', icon: '⭕', cost: 22, color: '#6b4423' }),
  { requiresUnlock: true },
);

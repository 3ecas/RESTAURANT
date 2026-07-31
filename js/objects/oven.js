// Oven — a final bake station, mechanically identical to a Stove (see shared/stoveFactory.js:
// slots, a cook timer, chef speed bonus baked in) but targeted specifically by recipes whose
// `process` ends in 'oven' rather than 'stove' (see data/recipes.js).

import { makeStove } from './shared/stoveFactory.js';

export const oven = makeStove({
  type: 'oven', name: 'Oven', cost: 90, slotCount: 1, tierMultiplier: 1,
  icon: '🍞', color: '#8a5a3a',
});

// Prep Counter — mixes/preps ingredients as a step in a multi-step recipe (see
// data/recipes.js's `process`, e.g. Bread's wheat+water get mixed here before baking).

import { makePrepStation } from './shared/prepStationFactory.js';

export const prepCounter = makePrepStation({
  type: 'prepCounter', name: 'Prep Counter', icon: '🥄', cost: 35, color: '#c9b28a',
});

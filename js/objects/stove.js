import { makeStove } from './shared/stoveFactory.js';

export const stove = makeStove({
  type: 'stove', name: 'Stove', cost: 65, slotCount: 1, tierMultiplier: 1, image: 'ASSETS/STOVE.png',
});

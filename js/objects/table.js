// Table — regular seating, paired with an adjacent chair (see chair.js / World.tableOfChair)

import { makeSeatingSurface } from './shared/seatingInteract.js';

export const table = makeSeatingSurface({
  type: 'table', name: 'Table', icon: '🍽️', cost: 15, color: '#8a6b3f', image: 'ASSETS/TABLE.png',
});

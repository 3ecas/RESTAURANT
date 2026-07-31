// Counter — doubles as bar seating: a chair placed next to one pairs with it exactly
// like a table (see shared/seatingInteract.js).

import { makeSeatingSurface } from './shared/seatingInteract.js';

export const counter = makeSeatingSurface({
  type: 'counter', name: 'Counter', icon: '🧱', cost: 5, color: '#3a332a', fixedStock: 15, image: 'ASSETS/COUNTER.png',
});

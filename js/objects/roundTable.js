// Round Table — a pricier cosmetic alternative to the regular Table, same seating behavior
import { makeSeatingSurface } from './shared/seatingInteract.js';

export const roundTable = makeSeatingSurface({
  type: 'roundTable', name: 'Round Table', icon: '⭕', cost: 22, color: '#6b4423',
});

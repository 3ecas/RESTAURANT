// Sink — base tier. Holds up to 5 water at a time (see shared/sinkFactory.js).

import { makeSink } from './shared/sinkFactory.js';

export const sink = makeSink({
  type: 'sink', name: 'Sink', cost: 40, capacity: 5, image: 'ASSETS/SINK.png',
});

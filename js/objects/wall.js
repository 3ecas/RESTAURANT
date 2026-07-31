// Wall — a plain structural barrier for enclosing a room. Blocks movement, isn't seating
// (that's the Counter, see objects/counter.js). See shared/wallFactory.js for the
// orientation-detection / near-wall-flattening logic shared with objects/windowWall.js.

import { makeWallLike } from './shared/wallFactory.js';

// TODO: swap in real horizontal/vertical art once available — both constants currently
// point at the same placeholder icon.
const IMAGE_HORIZONTAL = 'ASSETS/WALL BASIC.png';
const IMAGE_VERTICAL = 'ASSETS/WALL BASIC.png';

export const wall = makeWallLike({
  type: 'wall', name: 'Wall', cost: 4,
  imageHorizontal: IMAGE_HORIZONTAL, imageVertical: IMAGE_VERTICAL,
});

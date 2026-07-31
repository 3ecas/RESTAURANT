// Window Wall — a decorative variant of Wall (see objects/wall.js) with a window built in.
// Same orientation-detection / near-wall-flattening behavior, shares wall runs with plain
// Wall seamlessly (see shared/wallFactory.js's WALL_LIKE_TYPES).

import { makeWallLike } from './shared/wallFactory.js';

// TODO: swap in real horizontal/vertical art once available — both constants currently
// point at the same placeholder icon.
const IMAGE_HORIZONTAL = 'ASSETS/WALL BASIC WINDOW.png';
const IMAGE_VERTICAL = 'ASSETS/WALL BASIC WINDOW.png';

export const windowWall = makeWallLike({
  type: 'windowWall', name: 'Window Wall', cost: 8,
  imageHorizontal: IMAGE_HORIZONTAL, imageVertical: IMAGE_VERTICAL,
});

// Window Wall — a decorative variant of Wall (see objects/wall.js) with a window built in.
// Same shape-detection / rotation behavior, shares wall runs with plain Wall seamlessly
// (see shared/wallFactory.js's WALL_LIKE_TYPES).

import { makeWallLike } from './shared/wallFactory.js';

// TODO: only one placeholder block sprite right now, used for every shape — see wall.js.
export const windowWall = makeWallLike({
  type: 'windowWall', name: 'Window Wall', cost: 8,
  images: { straight: 'ASSETS/WALL BASIC WINDOW.png' },
});

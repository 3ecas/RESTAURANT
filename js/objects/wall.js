// Wall — a plain structural barrier for enclosing a room. Blocks movement, isn't seating
// (that's the Counter, see objects/counter.js). See shared/wallFactory.js for the
// shape-detection / rotation logic shared with objects/windowWall.js.

import { makeWallLike } from './shared/wallFactory.js';

// TODO: "DEAD END.png" (the `end` shape, a single stub) is still blank in ASSETS/WALL BASIC/ —
// draw it and add it below. Everything else (isolated) falls back to `straight` until drawn too.
export const wall = makeWallLike({
  type: 'wall', name: 'Wall', cost: 4,
  images: {
    straight: 'ASSETS/WALL BASIC/STRAIGHT.png',
    sideways: 'ASSETS/WALL BASIC/SIDEWAYS.png',
    corner: 'ASSETS/WALL BASIC/CORNER.png',
    tee: 'ASSETS/WALL BASIC/T JUNCTION.png',
    cross: 'ASSETS/WALL BASIC/+ JUNCTION.png',
  },
});

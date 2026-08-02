// Shared shape for wall-like structural barriers (see objects/wall.js, objects/windowWall.js)
// — solid, non-seating, single-cell tiles. Auto-classifies each segment into one of 6
// standard tile-autotiling shapes from its 4 cardinal neighbors (classify, below), so you
// never place "the corner one" vs "the straight one" by hand — and a mixed run of plain +
// window walls still reads as one continuous line (see WALL_LIKE_TYPES).
//
// Each shape needs only ONE sprite, drawn in a fixed "canonical" facing — the actual facing
// is produced by rotating that sprite 0/90/180/270°, covering all orientations of that
// shape from a single image (see getRotationDeg). That's 6 sprites total instead of 16.
// Canonical facings an artist should draw each shape in (N is up, rotation is clockwise):
//   isolated — no connections at all (a standalone post/pillar)
//   end      — connects only to the N side (a dead end, open on S/E/W)
//   straight — connects N+S (a vertical run)
//   corner   — connects N+E (an L opening to the top-right)
//   tee      — connects E+S+W (a T with the missing side to the N)
//   cross    — connects all 4 sides (only one facing needed, never rotated)

const WALL_LIKE_TYPES = new Set(['wall', 'windowWall']);
// A door is a gap cut INTO a wall run, not a place the wall terminates — so for shape
// purposes (only), a wall segment next to a door should read the same as one next to more
// wall, not dead-end into an `end` cap. Doesn't affect anything else about doors (still
// walkable, still its own sprite).
const CONTINUES_WALL_TYPES = new Set([...WALL_LIKE_TYPES, 'door']);
const SHAPES = ['isolated', 'end', 'straight', 'corner', 'tee', 'cross'];

function continuesWall(cell) {
  return !!cell && CONTINUES_WALL_TYPES.has(cell.type);
}

function neighbors(obj, world) {
  return {
    n: continuesWall(world.cellAt(obj.x, obj.y - 1)),
    e: continuesWall(world.cellAt(obj.x + 1, obj.y)),
    s: continuesWall(world.cellAt(obj.x, obj.y + 1)),
    w: continuesWall(world.cellAt(obj.x - 1, obj.y)),
  };
}

// classifies a wall segment from which of its 4 cardinal neighbors are also wall-like:
// 0 connections = isolated post, 1 = dead end, 2 opposite = straight run, 2 adjacent =
// corner, 3 = T-junction, 4 = cross. Standard 4-neighbor "blob" autotiling.
function classify(obj, world) {
  const { n, e, s, w } = neighbors(obj, world);
  const count = [n, e, s, w].filter(Boolean).length;

  if (count === 0) return { shape: 'isolated', rotation: 0 };

  if (count === 1) {
    if (n) return { shape: 'end', rotation: 0 };
    if (e) return { shape: 'end', rotation: 90 };
    if (s) return { shape: 'end', rotation: 180 };
    return { shape: 'end', rotation: 270 }; // w
  }

  if (count === 2) {
    if (n && s) return { shape: 'straight', rotation: 0 };
    if (e && w) return { shape: 'straight', rotation: 90 };
    if (n && e) return { shape: 'corner', rotation: 0 };
    if (e && s) return { shape: 'corner', rotation: 90 };
    if (s && w) return { shape: 'corner', rotation: 180 };
    return { shape: 'corner', rotation: 270 }; // w && n
  }

  if (count === 3) {
    if (!n) return { shape: 'tee', rotation: 0 };
    if (!e) return { shape: 'tee', rotation: 90 };
    if (!s) return { shape: 'tee', rotation: 180 };
    return { shape: 'tee', rotation: 270 }; // !w
  }

  return { shape: 'cross', rotation: 0 };
}

// The actual "wall basic" art (ASSETS/WALL BASIC/*.png) isn't drawn in the canonical facings
// above — each piece was drawn in whatever orientation was natural by eye. Checked by sampling
// pixels: straight is drawn E+W (canonical is N+S, a 90° difference), corner is drawn S+W
// (canonical is N+E, a 180° difference), tee is drawn E+S+W (matches canonical exactly, no
// difference). cross is 4-fold symmetric so any difference is invisible; isolated/end never
// rotate. This table cancels each piece's own drawn-orientation out so classify()'s rotation
// still lands the art in the right place — if a future sprite set is drawn straight-is-N+S /
// corner-is-N+E, its offsets here would just be 0.
const ART_ROTATION_OFFSET = { isolated: 0, end: 0, straight: 90, corner: 180, tee: 0, cross: 0 };

// `straight` is a special case: unlike the other shapes, its N-S (vertical) facing isn't just
// its E-W (horizontal) sprite rotated 90° — a wall running along the left/right side of a room
// shows a different face than one running along the top/bottom (same reason `corner`/`tee`
// pieces can't be freely rotated either, in principle, but those haven't needed a fix yet).
// `images.sideways`, if supplied, is used as-is (never rotated) for that N-S case; otherwise
// it falls back to the rotated `straight` sprite same as before.

// `images` only needs to supply the shapes you actually have art for — anything missing
// falls back to `images.straight` (or whatever's first) so nothing 404s or looks broken
// while you're still filling out the set. Add more entries as you draw more shapes; no
// other code needs to change.
export function makeWallLike({ type, name, cost, fixedStock, images }) {
  const fallback = images.straight || images.isolated || Object.values(images)[0];
  const resolved = {};
  for (const shape of SHAPES) resolved[shape] = images[shape] || fallback;
  const sideways = images.sideways || null;

  // classify()'s straight case returns rotation 0 for N+S (vertical) and 90 for E+W
  // (horizontal) — see the canonical-facings comment up top.
  function isVerticalStraight(shape, rotation) {
    return shape === 'straight' && rotation === 0;
  }

  return {
    type, name, icon: '🧱', color: '#707070', cost, category: 'Furniture', fixedStock,
    image: resolved.straight, // static fallback for contexts with no instance/neighbors (e.g. the shop icon)

    getImageSrc(obj, world) {
      const { shape, rotation } = classify(obj, world);
      if (sideways && isVerticalStraight(shape, rotation)) return sideways;
      return resolved[shape];
    },

    getRotationDeg(obj, world) {
      const { shape, rotation } = classify(obj, world);
      if (sideways && isVerticalStraight(shape, rotation)) return 0; // drawn already-vertical
      return (rotation - ART_ROTATION_OFFSET[shape] + 360) % 360;
    },
  };
}

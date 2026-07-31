// Shared shape for wall-like structural barriers (see objects/wall.js, objects/windowWall.js)
// — solid, non-seating, plain single-cell tiles (20x20 sprites, same footprint as everything
// else). Auto-picks a horizontal- or vertical-run sprite from its neighbors (see
// chooseOrientation) — you never place "the horizontal one" vs "the vertical one" by hand,
// and a mixed run of plain + window walls still reads as one continuous line.

const WALL_LIKE_TYPES = new Set(['wall', 'windowWall']);

function isWallLike(cell) {
  return !!cell && WALL_LIKE_TYPES.has(cell.type);
}

// horizontal if there's a wall-like neighbor immediately west or east (this segment
// continues a left-right run); vertical if there's one north or south instead (continues an
// up-down run). No wall-like neighbors at all (freshly placed, alone) defaults to
// horizontal. A corner (both a horizontal AND a vertical neighbor) also resolves to
// horizontal, since there's no dedicated corner sprite.
function chooseOrientation(obj, world) {
  if (isWallLike(world.cellAt(obj.x - 1, obj.y)) || isWallLike(world.cellAt(obj.x + 1, obj.y))) return 'horizontal';
  if (isWallLike(world.cellAt(obj.x, obj.y - 1)) || isWallLike(world.cellAt(obj.x, obj.y + 1))) return 'vertical';
  return 'horizontal';
}

export function makeWallLike({ type, name, cost, imageHorizontal, imageVertical, fixedStock }) {
  return {
    type, name, icon: '🧱', color: '#707070', cost, category: 'Furniture', fixedStock,

    getImageSrc(obj, world) {
      return chooseOrientation(obj, world) === 'horizontal' ? imageHorizontal : imageVertical;
    },
  };
}

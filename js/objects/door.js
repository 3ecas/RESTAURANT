// Door — the only entrance; not purchasable (there's always exactly one, pre-placed) and
// movable only, never stored/sold. Occupies 2 horizontally-adjacent cells, so it owns its
// own placement/removal/entrance-cell logic instead of the generic single-cell defaults
// in core/world.js.

export const door = {
  type: 'door',
  name: 'Door',
  icon: '🚪',
  color: 'rgba(120, 200, 120, 0.9)',
  walkthrough: true,
  storable: false,

  canPlace(world, x, y) {
    return world.isBuildable(x, y) && world.isBuildable(x + 1, y);
  },

  place(world, obj, x, y) {
    const x2 = x + 1;
    if (!world.inBounds(x, y) || !world.inBounds(x2, y)) return false;
    if (world.grid[y][x] !== null || world.grid[y][x2] !== null) return false;
    obj.x = x;
    obj.y = y;
    world.grid[y][x] = obj;
    world.grid[y][x2] = obj;
    world.objects.push(obj);
    return true;
  },

  removeCells(world, obj) {
    world.grid[obj.y][obj.x] = null;
    world.grid[obj.y][obj.x + 1] = null;
  },

  entranceCells(obj) {
    return [{ x: obj.x, y: obj.y }, { x: obj.x + 1, y: obj.y }];
  },
};

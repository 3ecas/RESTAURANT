// Oak Chair — a pricier cosmetic alternative to the regular Chair, same behavior: walkthrough
// furniture whose interaction defers to its paired table/counter (see World.tableOfChair).

export const oakChair = {
  type: 'oakChair',
  name: 'Oak Chair',
  icon: '🪑',
  color: '#8a5a2b',
  cost: 32,
  category: 'Furniture',
  walkthrough: true,
  isChair: true,

  createState(base) {
    return Object.assign(base, { occupied: null });
  },

  interact(obj, ctx) {
    const table = ctx.world.tableOfChair(obj);
    if (!table) return false;
    return ctx.game.serveTable(table);
  },
};

// Chair — walkthrough furniture; interacting defers to its paired table/counter
// (see World.tableOfChair). Note: unlike interacting with the table directly, interacting
// via the chair never picks up a dirty plate — only serveTable applies here.

export const chair = {
  type: 'chair',
  name: 'Chair',
  icon: '🪑',
  color: '#6b5a3f',
  cost: 25,
  category: 'Furniture',
  image: 'ASSETS/CHAIR.png',
  walkthrough: true,

  createState(base) {
    return Object.assign(base, { occupied: null });
  },

  interact(obj, ctx) {
    const table = ctx.world.tableOfChair(obj);
    if (!table) return false;
    return ctx.game.serveTable(table);
  },
};

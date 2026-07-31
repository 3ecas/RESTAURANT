// Chair — walkthrough furniture; pairs with an adjacent table/counter to seat a customer
// (see World.tableOfChair / chairsForTables).

export const chair = {
  type: 'chair',
  name: 'Chair',
  icon: '🪑',
  color: '#6b5a3f',
  cost: 25,
  category: 'Furniture',
  image: 'ASSETS/CHAIR.png',
  walkthrough: true,
  isChair: true,

  createState(base) {
    return Object.assign(base, { occupied: null });
  },
};

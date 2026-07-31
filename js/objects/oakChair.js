// Oak Chair — a pricier cosmetic alternative to the regular Chair, same behavior: walkthrough
// furniture that pairs with an adjacent table/counter (see World.tableOfChair).

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
};

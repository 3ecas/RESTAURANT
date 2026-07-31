// Fridge — any fridge works, they all share the same ingredient stock (see Game.ingredients).
// Ingredient/cost was already reserved when the customer ordered (Customer 'thinking'), so
// fetching here is just the physical hand-off, not another availability check.

export const fridge = {
  type: 'fridge',
  name: 'Fridge',
  icon: '🧊',
  color: '#bfe3ea',
  cost: 45,
  category: 'Appliances',
  image: 'ASSETS/FRIDGE.png',

  interact(obj, ctx) {
    const { player, world } = ctx;
    if (!player.carrying) {
      const stand = world.findObjects('orderStand').find(s => s.pending.length > 0);
      if (!stand) return false;
      const order = stand.pending.shift();
      player.carrying = { kind: 'ingredient', recipe: order.recipe, step: 0 };
      return true;
    }
    if (player.carrying.kind === 'ingredient') {
      const stand = world.findObjects('orderStand')[0];
      if (stand) {
        stand.pending.unshift({ recipe: player.carrying.recipe });
      }
      player.carrying = null;
      return true;
    }
    return false;
  },
};

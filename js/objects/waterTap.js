// Water Tap — an always-on source of water, not part of any recipe's cooking process (see
// data/recipes.js's `process`). Water is a real tracked ingredient like any other (it can
// run out, gets reserved when a customer orders, etc.) but topping the stock back up is
// instant and unlimited — there's no farming/fishing/raising involved, just a tap to visit.

export const waterTap = {
  type: 'waterTap',
  name: 'Water Tap',
  icon: '🚰',
  color: '#9fd3e0',
  cost: 18,
  category: 'Appliances',

  interact(obj, ctx) {
    const { player, game } = ctx;
    if (player.carrying) return false;
    game.ingredients.water = (game.ingredients.water || 0) + 1;
    return true;
  },
};

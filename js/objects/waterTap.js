// Water Tap — an always-on source of water, not part of any recipe's cooking process (see
// data/recipes.js's `process`). Water is a real tracked ingredient like any other (it can
// run out, gets reserved when a customer orders, etc.) but topping the stock back up is
// instant, unlimited, and automatic — no farming/fishing/raising, and no staff required;
// each placed tap just quietly refills the shared stock on its own (see tickWaterTap below,
// called from Game.update the same way tickFarmGrowth/tickCooking are).

const REGEN_INTERVAL = 1500; // ms between each +1 water this tap adds to the shared stock

export function tickWaterTap(tap, dt, game) {
  tap.regenTimer -= dt;
  if (tap.regenTimer <= 0) {
    game.ingredients.water = (game.ingredients.water || 0) + 1;
    tap.regenTimer = REGEN_INTERVAL;
  }
}

export const waterTap = {
  type: 'waterTap',
  name: 'Water Tap',
  icon: '🚰',
  color: '#9fd3e0',
  cost: 18,
  category: 'Appliances',

  createState(base) {
    return Object.assign(base, { regenTimer: REGEN_INTERVAL });
  },
};

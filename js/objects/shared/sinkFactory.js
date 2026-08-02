// Shared shape for every sink tier — the water source: quietly refills the shared water
// stock on its own (no chef trip needed, same idea as a Fridge but automatic), up to its own
// `capacity`. Water regen from ALL placed sinks (any tier) stops once the shared stock hits
// the combined capacity of every sink on the grid — see tickSinkWater's totalCapacity param,
// computed once per tick in Game.update rather than re-derived per sink. Also where waiters
// drop dirty plates while bussing tables (entities/staffRoles/waiter.js).

const REGEN_INTERVAL = 1500; // ms between each +1 water this sink adds to the shared stock

export function tickSinkWater(sink, dt, game, totalCapacity) {
  sink.regenTimer -= dt;
  if (sink.regenTimer <= 0) {
    sink.regenTimer = REGEN_INTERVAL;
    if (game.ingredients.water < totalCapacity) {
      game.ingredients.water = (game.ingredients.water || 0) + 1;
    }
  }
}

export function makeSink({ type, name, cost, capacity, icon = '🚰', color = '#a9c9d8', image }) {
  return {
    type, name, icon, color, cost, category: 'Appliances', image,
    isSink: true, capacity,

    createState(base) {
      return Object.assign(base, { regenTimer: REGEN_INTERVAL });
    },
  };
}

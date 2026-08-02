// Cost curves for hiring and training staff

// gathering roles (farmer/rancher/fisherman) cost more than service roles to hire — their
// output feeds the pricier, ingredient-hungry recipes (see data/recipes.js), so the staff
// that gather for them should cost a bit more to bring on too
const HIRE_BASE_COST = { waiter: 100, chef: 100, farmer: 150, rancher: 150, fisherman: 150 };
const HIRE_GROWTH = 3; // each additional hire of the same role costs 3x the previous one

export function getHireCost(game, role) {
  // counts both already-working staff and any of the same role still waiting in the quick
  // bar to be placed — otherwise hiring a pile without placing them would dodge the ramp
  const n = game.staff.filter(s => s.role === role).length
    + game.staffInventory.filter(s => s.role === role).length;
  const base = HIRE_BASE_COST[role] ?? 100;
  return Math.round(base * Math.pow(HIRE_GROWTH, n));
}

// cost/time to train from `level` to `level + 1` — cheap at first, steep near max level
export function staffTrainCost(level) {
  return 20 * level * level;
}
export function staffTrainTime(level) {
  return 5000 * level; // ms
}

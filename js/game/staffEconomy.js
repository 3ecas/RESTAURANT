// Cost curves for hiring and training staff

const HIRE_BASE_COST = 10;

export function getHireCost(game, role) {
  const n = game.staff.filter(s => s.role === role).length;
  return HIRE_BASE_COST * Math.pow(10, n);
}

// cost/time to train from `level` to `level + 1` — cheap at first, steep near max level
export function staffTrainCost(level) {
  return 20 * level * level;
}
export function staffTrainTime(level) {
  return 5000 * level; // ms
}

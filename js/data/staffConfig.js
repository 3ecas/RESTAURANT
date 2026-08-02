// Staff leveling — formula-based per-role speed/capacity/work-speed scaling, uncapped.
// Training cost/time (see game/staffEconomy.js) already grows without bound on its own, so
// the level itself no longer needs an artificial ceiling — it's just increasingly expensive
// to keep leveling up, which is the point for a game meant to be played over weeks/months.

export const NAMES = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Drew', 'Skyler'];
export const STAFF_BASE_SPEED = 48;
export const STAFF_MAX_LEVEL = Infinity;

const FAST_ROLES = new Set(['waiter']);

// waiter gets a flat +30% base on top of its own steeper +8%/level curve — at level 1 the
// old formula (1.08x) was barely faster than everyone else's 1.06x, so taking an order felt
// slow even though the role was nominally "fast". +6%/level for the rest — roughly tracks
// the old fixed 5-level tables at level 5, then keeps climbing instead of flatlining there
export function speedMultiplier(role, level) {
  if (FAST_ROLES.has(role)) return 1.3 + 0.08 * level;
  return 1 + 0.06 * level;
}

// chef: stove cook speed. rancher: animal-shack process speed. fisherman: catch speed.
// baked into whatever they're working on at the moment it starts (see chef.js/rancher.js/
// fisherman.js), not read continuously. A fresh chef deliberately starts slower than doing
// it yourself (< 1x) — hiring one isn't an instant win — and only overtakes manual play
// after a few levels of training; rancher/fisherman keep the old always-at-or-above-1x curve.
export function workMultiplier(role, level) {
  if (role === 'chef') return 0.75 + 0.07 * level;
  if (role === 'rancher' || role === 'fisherman') return 1 + 0.06 * level;
  return 1;
}

// how many items they carry in one trip before heading back. Farmer's cap still delivers
// early (see farmer.js) whenever there's nothing left to harvest or plant, so a farmer with
// only 1-2 plots delivers promptly instead of hoarding for a batch.
export function carryCapacity(role, level) {
  if (role === 'farmer') return 5 + Math.floor(level * 0.8);
  if (FAST_ROLES.has(role)) return 2 + Math.floor(level * 0.8);
  return 1;
}

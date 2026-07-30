// Global tunable numbers not owned by any single staff role or object type. Per-object
// timers/capacities (crop grow time, chicken feeding, stove cook speed multipliers, etc.)
// live with their owning object instead — see js/objects/*.js.

export const MAX_WAITING = 6; // most customers that can stand at the door waiting for a seat

export const THINK_TIME = 1500; // ms a seated customer takes to decide their order
export const EAT_TIME = 4500; // ms a customer takes to eat once served

export const SHOP_REFRESH_INTERVAL = 5 * 60 * 1000; // shop restocks every 5 minutes

// customer arrivals come in a fresh batch every minute instead of a constant trickle — a
// random count (6-16) is picked at the start of each minute and spread evenly across it, so
// they arrive gradually rather than all piling up outside at once. See Game.startSpawnCycle.
export const SPAWN_CYCLE_MS = 60 * 1000;
export const SPAWN_MIN_PER_CYCLE = 6;
export const SPAWN_MAX_PER_CYCLE = 16;

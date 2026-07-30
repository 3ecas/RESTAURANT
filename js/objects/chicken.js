// Chicken — fed a few times by a rancher (from a chicken feeder) to grow, then processed at
// the animal shack; reverts to a chick and starts again once collected.

import { progressBar, readyCheckmark } from '../game/drawHelpers.js';

export const CHICKEN_FEEDS_TO_GROW = 3; // total wheat a chicken eats per growth cycle
export const CHICKEN_EAT_INTERVAL = Math.round(25000 / CHICKEN_FEEDS_TO_GROW); // ~25s total to grow, fed promptly

// ticks a chicken's hunger — eats from any feeder that has wheat, a little at a time, not
// too much, just enough. Called from Game.update for every chicken each frame.
export function tickChickenHunger(chicken, dt, world) {
  if (chicken.grown) return;
  chicken.hungerCooldown -= dt;
  if (chicken.hungerCooldown > 0) return;
  const feeder = world.findObjects('chickenFeeder').find(f => (f.wheat || 0) > 0);
  if (feeder) {
    feeder.wheat -= 1;
    chicken.fed += 1;
    chicken.hungerCooldown = CHICKEN_EAT_INTERVAL;
    if (chicken.fed >= CHICKEN_FEEDS_TO_GROW) chicken.grown = true;
  } else {
    chicken.hungerCooldown = 500; // no food available right now — check back soon
  }
}

export const chicken = {
  type: 'chicken',
  name: 'Chicken',
  icon: '🐤',
  color: '#f2e2b6',
  cost: 32,
  category: 'Ranching',

  createState(base) {
    return Object.assign(base, { fed: 0, grown: false, hungerCooldown: 0, claimed: false });
  },

  getIcon(obj) { return obj.grown ? '🐓' : '🐤'; },

  canRemove(obj) { return !obj.grown; },
  canMove(obj) { return !obj.grown; },

  drawExtra(ctx, obj, px, py, cellSize) {
    if (!obj.grown) progressBar(ctx, px, py, cellSize, obj.fed / CHICKEN_FEEDS_TO_GROW, '#e0b04a');
    else readyCheckmark(ctx, px, py, cellSize);
  },
};

// Shared shape for every ranch animal (chicken, cow, ...) — feeding/growth/processing
// parameters differ per type, but the state machine is identical: fed a few times by a
// rancher (from a matching feeder) -> grown -> collected -> processed at the Animal Shack
// -> banked as an ingredient. See entities/staffRoles/rancher.js for the actual work loop.

import { progressBar, readyCheckmark } from '../../game/drawHelpers.js';

// `yields` is a list of { name, qty } — processing a chicken, say, banks both meat and a
// couple of eggs, not just one ingredient (mirrors RECIPES' multi-ingredient shape)
export function makeRanchAnimal({
  type, name, cost, babyIcon, grownIcon,
  feedsToGrow, growTimeMs, processTimeMs,
  feederType, feedIngredient, yields,
}) {
  const eatInterval = Math.round(growTimeMs / feedsToGrow);
  return {
    type, name, icon: babyIcon, color: '#f2e2b6', cost, category: 'Ranching',
    isAnimal: true, feederType, feedIngredient, yields, processTimeMs, feedsToGrow, eatInterval,

    createState(base) {
      return Object.assign(base, { fed: 0, grown: false, hungerCooldown: 0, claimed: false });
    },

    getIcon(obj) { return obj.grown ? grownIcon : babyIcon; },

    canRemove(obj) { return !obj.grown; },
    canMove(obj) { return !obj.grown; },

    drawExtra(ctx, obj, px, py, cellSize) {
      if (!obj.grown) progressBar(ctx, px, py, cellSize, obj.fed / feedsToGrow, '#e0b04a');
      else readyCheckmark(ctx, px, py, cellSize);
    },
  };
}

// ticks one animal's hunger — eats from any matching feeder that has stock, a little at a
// time, not too much, just enough. Called from Game.update for every animal of every type.
export function tickAnimalHunger(animal, animalType, dt, world) {
  if (animal.grown) return;
  animal.hungerCooldown -= dt;
  if (animal.hungerCooldown > 0) return;
  const feeder = world.findObjects(animalType.feederType).find(f => (f.stock || 0) > 0);
  if (feeder) {
    feeder.stock -= 1;
    animal.fed += 1;
    animal.hungerCooldown = animalType.eatInterval;
    if (animal.fed >= animalType.feedsToGrow) animal.grown = true;
  } else {
    animal.hungerCooldown = 500; // no food available right now — check back soon
  }
}

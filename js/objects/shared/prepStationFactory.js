// Shared shape for a "prep" step in a multi-step recipe (see data/recipes.js's `process`
// field) — a Water Tap, Prep Counter, etc. Unlike a Stove/Oven, these are stateless and
// instant: no slots, no timer, just a checkpoint that advances the carried order's `step`
// if this station is genuinely the next thing that order needs. Nothing to do otherwise —
// this deliberately doesn't accept ingredients out of order.

import { getRecipe } from '../../data/recipes.js';

export function makePrepStation({ type, name, icon, cost, color }) {
  return {
    type, name, icon, color, cost, category: 'Appliances',

    interact(obj, ctx) {
      const { player } = ctx;
      if (!player.carrying || player.carrying.kind !== 'ingredient') return false;
      const recipe = getRecipe(player.carrying.recipe);
      if (!recipe) return false;
      const process = recipe.process || ['stove'];
      const step = player.carrying.step || 0;
      if (process[step] !== type) return false;
      player.carrying.step = step + 1;
      return true;
    },
  };
}

// Stove — cooks one order at a time. cookMultiplier is baked in by whoever starts the cook
// (see entities/staffRoles/chef.js) so a chef's speed bonus sticks even after they walk off.

import { getRecipe } from '../data/recipes.js';
import { progressBar, readyCheckmark } from '../game/drawHelpers.js';

// advances cook progress and flips to ready — called from Game.update for every stove
// each frame. The chef's speed bonus (cookMultiplier) is baked in once when cooking starts
// (see entities/staffRoles/chef.js), so it keeps applying even after the chef walks off.
export function tickCooking(stove, dt) {
  if (!stove.cooking) return;
  const recipe = getRecipe(stove.recipe);
  stove.progress += dt * (stove.cookMultiplier || 1);
  if (recipe && stove.progress >= recipe.cookTime) {
    stove.cooking = false;
    stove.ready = true;
  }
}

export const stove = {
  type: 'stove',
  name: 'Stove',
  icon: '🔥',
  color: '#e0a678',
  cost: 65,
  category: 'Appliances',
  image: 'ASSETS/STOVE.png',

  createState(base) {
    return Object.assign(base, { cooking: false, recipe: null, progress: 0, ready: false, reservedBy: null, collectedBy: null, cookMultiplier: 1 });
  },

  canRemove(obj) { return !obj.cooking; },
  canMove(obj) { return !obj.cooking; },

  interact(obj, ctx) {
    const { player } = ctx;
    if (player.carrying && player.carrying.kind === 'ingredient' && !obj.cooking && !obj.ready && !obj.reservedBy) {
      obj.cooking = true;
      obj.recipe = player.carrying.recipe;
      obj.progress = 0;
      obj.reservedBy = 'player';
      obj.cookMultiplier = 1; // no chef speed bonus when the player cooks it themselves
      player.carrying = null;
      return true;
    }
    if (!player.carrying && obj.ready) {
      player.carrying = { kind: 'cooked', recipe: obj.recipe };
      obj.ready = false;
      obj.recipe = null;
      obj.reservedBy = null;
      obj.collectedBy = null;
      return true;
    }
    // note: deliberately no "put a cooked dish back on an idle stove" case — the order
    // stand has unlimited capacity, so there's never a real reason to park it here, and
    // doing so used to silently swallow the interact when a stove happened to be checked
    // before a nearby order stand
    return false;
  },

  drawExtra(ctx, obj, px, py, cellSize) {
    if (!obj.cooking && !obj.ready) return;
    const recipe = getRecipe(obj.recipe);
    const pct = obj.ready ? 1 : obj.progress / (recipe ? recipe.cookTime : 1);
    progressBar(ctx, px, py, cellSize, pct, obj.ready ? '#6fce6f' : '#ffd76b');
    if (obj.ready) readyCheckmark(ctx, px, py, cellSize);
  },
};

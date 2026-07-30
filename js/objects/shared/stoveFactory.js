// Shared shape for every stove tier — cooks `slotCount` orders concurrently instead of just
// one, and applies its own `tierMultiplier` on top of whatever chef cooked it (see
// entities/staffRoles/chef.js). A slot's cookMultiplier is baked in once when cooking starts
// so it keeps applying even after the chef walks off (see tickCooking below).

import { getRecipe } from '../../data/recipes.js';
import { progressBar, readyCheckmark, badge } from '../../game/drawHelpers.js';

function makeSlot() {
  return { cooking: false, recipe: null, progress: 0, ready: false, reservedBy: null, collectedBy: null, cookMultiplier: 1 };
}

export function makeStove({ type, name, cost, slotCount, tierMultiplier, image }) {
  return {
    type, name, icon: '🔥', color: '#e0a678', cost, category: 'Appliances', image,
    isStove: true, slotCount, tierMultiplier,

    createState(base) {
      return Object.assign(base, { slots: Array.from({ length: slotCount }, makeSlot) });
    },

    canRemove(obj) { return !obj.slots.some(s => s.cooking); },
    canMove(obj) { return !obj.slots.some(s => s.cooking); },

    interact(obj, ctx) {
      const { player } = ctx;
      if (player.carrying && player.carrying.kind === 'ingredient') {
        const slot = obj.slots.find(s => !s.cooking && !s.ready && !s.reservedBy);
        if (slot) {
          slot.cooking = true;
          slot.recipe = player.carrying.recipe;
          slot.progress = 0;
          slot.reservedBy = 'player';
          slot.cookMultiplier = tierMultiplier; // the stove's own speed still applies even without a chef
          player.carrying = null;
          return true;
        }
      }
      if (!player.carrying) {
        const slot = obj.slots.find(s => s.ready);
        if (slot) {
          player.carrying = { kind: 'cooked', recipe: slot.recipe };
          slot.ready = false;
          slot.recipe = null;
          slot.reservedBy = null;
          slot.collectedBy = null;
          return true;
        }
      }
      // note: deliberately no "put a cooked dish back on an idle stove" case — see stove.js's
      // original comment, still applies: the order stand has unlimited capacity
      return false;
    },

    drawExtra(ctx, obj, px, py, cellSize) {
      const readyCount = obj.slots.filter(s => s.ready).length;
      const activeCount = obj.slots.filter(s => s.cooking || s.ready).length;
      // progress bar tracks whichever slot is furthest along (ready counts as 100%)
      let bestSlot = null, bestPct = -1;
      for (const s of obj.slots) {
        if (!s.cooking && !s.ready) continue;
        const recipe = getRecipe(s.recipe);
        const pct = s.ready ? 1 : s.progress / (recipe ? recipe.cookTime : 1);
        if (pct > bestPct) { bestPct = pct; bestSlot = s; }
      }
      if (bestSlot) progressBar(ctx, px, py, cellSize, bestPct, bestSlot.ready ? '#6fce6f' : '#ffd76b');
      if (readyCount > 0) readyCheckmark(ctx, px, py, cellSize);
      // a multi-slot stove also shows how many of its slots are in use, so it's clear at a
      // glance it's working on more than one order
      if (slotCount > 1 && activeCount > 0) {
        badge(ctx, px + 8, py + 7, activeCount, '#e0a678');
      }
    },
  };
}

// advances cook progress on every slot and flips each to ready independently — called from
// Game.update for every stove of every tier each frame.
export function tickCooking(stove, dt) {
  for (const slot of stove.slots) {
    if (!slot.cooking) continue;
    const recipe = getRecipe(slot.recipe);
    slot.progress += dt * (slot.cookMultiplier || 1);
    if (recipe && slot.progress >= recipe.cookTime) {
      slot.cooking = false;
      slot.ready = true;
    }
  }
}

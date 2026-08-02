// Chef: fetches the next pending order's ingredient from a fridge, then cooks it at a stove.
// Generalized over STOVE_TYPES (see objects/registry.js) so adding a new stove tier needs no
// changes here.

import { getRecipe } from '../../data/recipes.js';
import { STOVE_TYPES, getObjectType } from '../../objects/registry.js';

// highest tierMultiplier (fastest cook speed) first, so a chef choosing where to cook always
// tries the best available stove before falling back to a slower one — otherwise a chef would
// just take whichever stove happens to come first in placement order, base tier included
function allStoves(world) {
  return STOVE_TYPES
    .flatMap(t => world.findObjects(t.type))
    .sort((a, b) => (getObjectType(b.type).tierMultiplier || 1) - (getObjectType(a.type).tierMultiplier || 1));
}

// not cooking, not reserved by another chef already walking an order over, and not sitting
// on an already-finished dish nobody's collected yet
function isOpenSlot(slot) {
  return !slot.reservedBy && !slot.cooking && !slot.ready;
}

function hasOpenSlot(world) {
  return allStoves(world).some(stove => stove.slots.some(isOpenSlot));
}

// by the time an order reaches `pending`, the customer already reserved its ingredients
// (see Customer 'thinking') — so the chef doesn't need to re-check availability here, just
// fetch it from whichever fridge is closest (and reachable). Once it's cooking the chef's
// job there is done — they don't stand around waiting; they (or another idle chef) collect
// it once it's ready.
export function updateChef(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    // priority 1: collect a slot that finished cooking while this chef was off doing
    // something else — otherwise a finished dish could sit there forever uncollected
    for (const stove of allStoves(world)) {
      const slotIndex = stove.slots.findIndex(s => s.ready && !s.collectedBy);
      if (slotIndex !== -1) {
        const path = world.pathToAdjacent(staff.gx, staff.gy, stove.x, stove.y);
        if (path) {
          stove.slots[slotIndex].collectedBy = staff;
          staff.task = { stove, slotIndex };
          staff.setPath(path);
          staff.phase = 'toCollectStove';
        }
        return;
      }
    }

    // priority 2: an ingredient already in hand — walk it to an open stove slot
    if (staff.carrying && staff.carrying.kind === 'ingredient') {
      for (const stove of allStoves(world)) {
        const slotIndex = stove.slots.findIndex(isOpenSlot);
        if (slotIndex !== -1) {
          const path = world.pathToAdjacent(staff.gx, staff.gy, stove.x, stove.y);
          if (path) {
            stove.slots[slotIndex].reservedBy = staff;
            staff.task = { stove, slotIndex, recipe: getRecipe(staff.carrying.recipe) };
            staff.setPath(path);
            staff.phase = 'toStove';
          }
          return;
        }
      }
      return; // every stove's full — just keep holding it and recheck next tick
    }

    // priority 3: start a brand-new pending order — but only if a stove could actually take
    // it once fetched. Otherwise this (or another idle chef) would grab a fridge trip for
    // nothing and end up standing around holding an ingredient with nowhere to cook it.
    if (!hasOpenSlot(world)) return;
    const stand = world.findObjects('orderStand').find(s => s.pending.length > 0);
    if (stand) {
      const order = stand.pending[0];
      const recipe = getRecipe(order.recipe);
      if (recipe) {
        // nearestReachableObject (not nearestObject) — a closer fridge that's boxed in
        // must not block a farther, actually-reachable one
        const fridge = world.nearestReachableObject('fridge', staff.gx, staff.gy);
        if (fridge) {
          const path = world.pathToAdjacent(staff.gx, staff.gy, fridge.x, fridge.y);
          if (path) {
            stand.pending.shift();
            staff.task = { order };
            staff.setPath(path);
            staff.phase = 'toFridge';
          }
        }
      }
    }
  } else if (staff.phase === 'toFridge') {
    if (!staff.hasPath) {
      staff.carrying = { kind: 'ingredient', recipe: staff.task.order.recipe };
      staff.task = {};
      staff.phase = 'idle'; // re-enter idle so priority 2 routes it to a stove
    }
  } else if (staff.phase === 'toStove') {
    if (!staff.hasPath) {
      const { stove, slotIndex, recipe } = staff.task;
      const slot = stove.slots[slotIndex];
      const tierMultiplier = getObjectType(stove.type).tierMultiplier || 1;
      slot.cooking = true;
      slot.recipe = recipe.id;
      slot.progress = 0;
      slot.cookMultiplier = staff.workMultiplier * tierMultiplier; // baked in now, so it sticks even after we walk off
      slot.reservedBy = null;
      staff.carrying = null;
      staff.task = {};
      staff.phase = 'idle'; // free to start another order or do anything else right away
    }
  } else if (staff.phase === 'toCollectStove') {
    if (!staff.hasPath) {
      const { stove, slotIndex } = staff.task;
      const slot = stove.slots[slotIndex];
      if (!slot.ready) {
        // another chef already collected it — look for other work
        slot.collectedBy = null;
        staff.task = {};
        staff.phase = 'idle';
        return;
      }
      staff.carrying = { kind: 'cooked', recipe: slot.recipe };
      slot.ready = false;
      slot.recipe = null;
      slot.collectedBy = null;
      slot.cookMultiplier = 1;
      const stand = world.findObjects('orderStand')[0];
      const path = stand ? world.pathToAdjacent(staff.gx, staff.gy, stand.x, stand.y) : null;
      staff.task = { stand };
      staff.setPath(path || []);
      staff.phase = 'toStand';
    }
  } else if (staff.phase === 'toStand') {
    if (!staff.hasPath) {
      if (staff.task.stand) staff.task.stand.ready.push({ recipe: staff.carrying.recipe, claimedBy: null });
      staff.carrying = null;
      staff.task = {};
      staff.phase = 'idle';
    }
  }
}

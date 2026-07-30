// Chef: fetches the next pending order's ingredient from a fridge, cooks it, collects it.
// Generalized over STOVE_TYPES (see objects/registry.js) the same way farmer.js generalizes
// over FARM_CROP_TYPES — a stove with more than one slot (see objects/shared/stoveFactory.js)
// just means more candidates to search, nothing role-specific changes.

import { getRecipe } from '../../data/recipes.js';
import { STOVE_TYPES, getObjectType } from '../../objects/registry.js';

function allStoves(world) {
  return STOVE_TYPES.flatMap(t => world.findObjects(t.type));
}

// by the time an order reaches `pending`, the customer already reserved its ingredient
// and paid its cook cost (see Customer 'thinking') — so the chef doesn't need to re-check
// availability here, just fetch it from whichever fridge is closest (and reachable) and
// cook it. once the ingredient's on the stove the chef's job there is done — they don't
// stand around waiting for it; they (or another idle chef) collect it once it's ready.
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
    // priority 2: start cooking the next pending order on any free slot, any stove tier
    const stand = world.findObjects('orderStand').find(s => s.pending.length > 0);
    if (stand) {
      const order = stand.pending[0];
      const recipe = getRecipe(order.recipe);
      if (recipe) {
        // nearestReachableObject (not nearestObject) — a closer fridge that's boxed in
        // must not block a farther, actually-reachable one
        const fridge = world.nearestReachableObject('fridge', staff.gx, staff.gy);
        let target = null;
        for (const stove of allStoves(world)) {
          const slotIndex = stove.slots.findIndex(s => !s.reservedBy && !s.cooking && !s.ready);
          if (slotIndex !== -1) { target = { stove, slotIndex }; break; }
        }
        if (fridge && target) {
          const path = world.pathToAdjacent(staff.gx, staff.gy, fridge.x, fridge.y);
          if (path) {
            stand.pending.shift();
            target.stove.slots[target.slotIndex].reservedBy = staff;
            staff.task = { order, recipe, stove: target.stove, slotIndex: target.slotIndex };
            staff.setPath(path);
            staff.phase = 'toFridge';
          }
        }
      }
    }
  } else if (staff.phase === 'toFridge') {
    if (!staff.hasPath) {
      staff.carrying = { kind: 'ingredient', recipe: staff.task.recipe.id };
      const { stove, slotIndex } = staff.task;
      const path = world.pathToAdjacent(staff.gx, staff.gy, stove.x, stove.y);
      if (path) {
        staff.setPath(path);
        staff.phase = 'toStove';
      } else {
        const stand = world.findObjects('orderStand')[0];
        if (stand) stand.pending.unshift(staff.task.order);
        stove.slots[slotIndex].reservedBy = null;
        staff.carrying = null;
        staff.task = {};
        staff.phase = 'idle';
      }
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
        // someone else (e.g. the player) already collected it — look for other work
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

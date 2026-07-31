// Chef: fetches the next pending order's ingredient from a fridge, then walks it through
// whatever stations its recipe's `process` requires (see data/recipes.js — most recipes are
// just ['stove'], but a multi-step one like Bread is ['prepCounter', 'oven']), collecting it
// once the final station's done. Generalized over STOVE_TYPES (see objects/registry.js) the
// same way farmer.js generalizes over FARM_CROP_TYPES — adding a new stove tier, or a new
// multi-step recipe, needs no changes here.

import { getRecipe } from '../../data/recipes.js';
import { STOVE_TYPES, getObjectType } from '../../objects/registry.js';

function allStoves(world) {
  return STOVE_TYPES.flatMap(t => world.findObjects(t.type));
}

function processOf(recipe) {
  return recipe.process || ['stove'];
}

// by the time an order reaches `pending`, the customer already reserved its ingredients
// (see Customer 'thinking') — so the chef doesn't need to re-check availability here, just
// fetch it from whichever fridge is closest (and reachable) and carry it through its
// process. Once it's cooking the chef's job there is done — they don't stand around
// waiting; they (or another idle chef) collect it once it's ready.
export function updateChef(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    // priority 1: collect a final station's slot that finished cooking while this chef was
    // off doing something else — otherwise a finished dish could sit there forever uncollected
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

    // priority 2: an order already in hand — walk it to whatever its process needs next
    if (staff.carrying && staff.carrying.kind === 'ingredient') {
      const recipe = getRecipe(staff.carrying.recipe);
      const process = processOf(recipe);
      const step = staff.carrying.step || 0;
      const stationType = process[step];
      const isFinal = step === process.length - 1;

      if (isFinal) {
        for (const stove of world.findObjects(stationType)) {
          const slotIndex = stove.slots.findIndex(s => !s.reservedBy && !s.cooking && !s.ready);
          if (slotIndex !== -1) {
            const path = world.pathToAdjacent(staff.gx, staff.gy, stove.x, stove.y);
            if (path) {
              stove.slots[slotIndex].reservedBy = staff;
              staff.task = { stove, slotIndex, recipe };
              staff.setPath(path);
              staff.phase = 'toFinalStation';
            }
            return;
          }
        }
      } else {
        // a prep station (Water Tap, Prep Counter, ...) is stateless and instant — no slot
        // to reserve, just walk to the nearest reachable one
        const station = world.nearestReachableObject(stationType, staff.gx, staff.gy);
        if (station) {
          const path = world.pathToAdjacent(staff.gx, staff.gy, station.x, station.y);
          if (path) {
            staff.task = { station };
            staff.setPath(path);
            staff.phase = 'toPrepStation';
          }
        }
      }
      return;
    }

    // priority 3: start a brand-new pending order — fetch its ingredients from the fridge
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
      staff.carrying = { kind: 'ingredient', recipe: staff.task.order.recipe, step: 0 };
      staff.task = {};
      staff.phase = 'idle'; // re-enter idle so priority 2 routes it to its first station
    }
  } else if (staff.phase === 'toPrepStation') {
    if (!staff.hasPath) {
      // instant hand-off — prep stations are stateless, just a checkpoint in the process
      staff.carrying.step = (staff.carrying.step || 0) + 1;
      staff.task = {};
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFinalStation') {
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

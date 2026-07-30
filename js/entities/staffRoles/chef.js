// Chef: fetches the next pending order's ingredient from a fridge, cooks it, collects it

import { getRecipe } from '../../data/recipes.js';

// by the time an order reaches `pending`, the customer already reserved its ingredient
// and paid its cook cost (see Customer 'thinking') — so the chef doesn't need to re-check
// availability here, just fetch it from whichever fridge is closest (and reachable) and
// cook it. once the ingredient's on the stove the chef's job there is done — they don't
// stand around waiting for it; they (or another idle chef) collect it once it's ready.
export function updateChef(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    // priority 1: collect a stove that finished cooking while this chef was off doing
    // something else — otherwise a finished dish could sit there forever uncollected
    const readyStove = world.findObjects('stove').find(s => s.ready && !s.collectedBy);
    if (readyStove) {
      const path = world.pathToAdjacent(staff.gx, staff.gy, readyStove.x, readyStove.y);
      if (path) {
        readyStove.collectedBy = staff;
        staff.task = { stove: readyStove };
        staff.setPath(path);
        staff.phase = 'toCollectStove';
      }
      return;
    }
    // priority 2: start cooking the next pending order on any free stove
    const stand = world.findObjects('orderStand').find(s => s.pending.length > 0);
    if (stand) {
      const order = stand.pending[0];
      const recipe = getRecipe(order.recipe);
      if (recipe) {
        // nearestReachableObject (not nearestObject) — a closer fridge that's boxed in
        // must not block a farther, actually-reachable one
        const fridge = world.nearestReachableObject('fridge', staff.gx, staff.gy);
        const stove = world.findObjects('stove').find(s => !s.reservedBy && !s.cooking && !s.ready);
        if (fridge && stove) {
          const path = world.pathToAdjacent(staff.gx, staff.gy, fridge.x, fridge.y);
          if (path) {
            stand.pending.shift();
            stove.reservedBy = staff;
            staff.task = { order, recipe, stove };
            staff.setPath(path);
            staff.phase = 'toFridge';
          }
        }
      }
    }
  } else if (staff.phase === 'toFridge') {
    if (!staff.hasPath) {
      staff.carrying = { kind: 'ingredient', recipe: staff.task.recipe.id };
      const stove = staff.task.stove;
      const path = world.pathToAdjacent(staff.gx, staff.gy, stove.x, stove.y);
      if (path) {
        staff.setPath(path);
        staff.phase = 'toStove';
      } else {
        const stand = world.findObjects('orderStand')[0];
        if (stand) stand.pending.unshift(staff.task.order);
        stove.reservedBy = null;
        staff.carrying = null;
        staff.task = {};
        staff.phase = 'idle';
      }
    }
  } else if (staff.phase === 'toStove') {
    if (!staff.hasPath) {
      const stove = staff.task.stove;
      stove.cooking = true;
      stove.recipe = staff.task.recipe.id;
      stove.progress = 0;
      stove.cookMultiplier = staff.workMultiplier; // baked in now, so it sticks even after we walk off
      stove.reservedBy = null;
      staff.carrying = null;
      staff.task = {};
      staff.phase = 'idle'; // free to start another order or do anything else right away
    }
  } else if (staff.phase === 'toCollectStove') {
    if (!staff.hasPath) {
      const stove = staff.task.stove;
      if (!stove.ready) {
        // someone else (e.g. the player) already collected it — look for other work
        stove.collectedBy = null;
        staff.task = {};
        staff.phase = 'idle';
        return;
      }
      staff.carrying = { kind: 'cooked', recipe: stove.recipe };
      stove.ready = false;
      stove.recipe = null;
      stove.collectedBy = null;
      stove.cookMultiplier = 1;
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

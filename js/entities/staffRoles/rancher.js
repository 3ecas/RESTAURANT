// Rancher: collect grown animals of any type -> animal shack (process) -> fridge (deliver),
// and keep every feeder stocked from the fridge's supply so animals have something to eat.
// Generalized over ANIMAL_TYPES (see objects/registry.js) the same way farmer.js generalizes
// over FARM_CROP_TYPES — adding a new animal (see objects/cow.js) needs no changes here.

import { ANIMAL_TYPES, getObjectType } from '../../objects/registry.js';
import { headToFridge } from './shared.js';

// every animal type stores which feeder type it uses (t.feederType) but not that feeder's
// capacity — that lives on the feeder's own definition (see objects/shared/animalFeederFactory.js)
function feederCapacity(animalType) {
  return getObjectType(animalType.feederType).capacity;
}

export function updateRancher(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    const item = staff.carryItems[0];
    if (item && item.kind === 'rawAnimal') {
      _headToShack(staff, world);
      return;
    }
    if (item && item.kind === 'feed') {
      _headToFeeder(staff, world);
      return;
    }
    // anything else being carried is already-processed goods (kind is the yield
    // ingredient's own name, e.g. 'chicken'/'milk' — see 'processingAnimal' below)
    if (item) {
      headToFridge(staff, world);
      return;
    }
    // priority 1: collect a grown animal, any type
    for (const t of ANIMAL_TYPES) {
      const grown = world.findObjects(t.type).find(a => a.grown && !a.claimed);
      if (grown) {
        const path = world.pathToAdjacent(staff.gx, staff.gy, grown.x, grown.y);
        if (path) {
          grown.claimed = true;
          staff.task = { animal: grown, animalType: t };
          staff.setPath(path);
          staff.phase = 'toAnimal';
        }
        return;
      }
    }
    // priority 2: top up a feeder that's running low, using its feed ingredient from the
    // nearest reachable fridge (nearestReachableObject — a closer fridge that's boxed in
    // must not block a farther, actually-reachable one)
    for (const t of ANIMAL_TYPES) {
      const feeder = world.findObjects(t.feederType).find(f => (f.stock || 0) < feederCapacity(t));
      if (feeder && (game.ingredients[t.feedIngredient] || 0) > 0) {
        const fridge = world.nearestReachableObject('fridge', staff.gx, staff.gy);
        if (fridge) {
          const path = world.pathToAdjacent(staff.gx, staff.gy, fridge.x, fridge.y);
          if (path) {
            staff.task = { feeder, animalType: t };
            staff.setPath(path);
            staff.phase = 'toFridgeForFeed';
          }
        }
        return;
      }
    }
  } else if (staff.phase === 'toAnimal') {
    if (!staff.hasPath) {
      const animal = staff.task.animal;
      // collecting resets it to a baby — it isn't destroyed, just starts growing again
      animal.grown = false;
      animal.fed = 0;
      animal.hungerCooldown = 0;
      animal.claimed = false;
      staff.carryItems = [{ kind: 'rawAnimal', animalType: staff.task.animalType }];
      staff.updateCarryVisual();
      staff.task = {};
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toShack') {
    if (!staff.hasPath) {
      // task was cleared back in 'toAnimal' — the animal type rides along on the carried
      // item itself instead, since carryItems (unlike task) survives across phases
      staff.busyTimer = staff.carryItems[0].animalType.processTimeMs / staff.workMultiplier;
      staff.phase = 'processingAnimal';
    }
  } else if (staff.phase === 'processingAnimal') {
    staff.busyTimer -= dt;
    if (staff.busyTimer <= 0) {
      // a single animal can yield more than one ingredient (e.g. chicken -> meat + eggs) —
      // one carried item per unit, same convention the 'toFridge' phase already expects
      const { yields } = staff.carryItems[0].animalType;
      staff.carryItems = yields.flatMap(y => Array.from({ length: y.qty }, () => ({ kind: y.name })));
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFridge') {
    if (!staff.hasPath) {
      for (const item of staff.carryItems) {
        game.ingredients[item.kind] = (game.ingredients[item.kind] || 0) + 1;
      }
      staff.carryItems = [];
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFridgeForFeed') {
    if (!staff.hasPath) {
      // grab as much feed as the feeder can still take in one trip — up to its full
      // capacity, capped by whatever's actually in stock
      const { feeder, animalType } = staff.task;
      const capacity = feederCapacity(animalType);
      const need = capacity - (feeder.stock || 0);
      const take = Math.min(capacity, need, game.ingredients[animalType.feedIngredient] || 0);
      if (take > 0) {
        game.ingredients[animalType.feedIngredient] -= take;
        staff.carryItems = Array.from({ length: take }, () => ({ kind: 'feed', animalType }));
        staff.updateCarryVisual();
      } else {
        staff.task = {};
      }
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFeeder') {
    if (!staff.hasPath) {
      const feeder = staff.task.feeder;
      const capacity = feederCapacity(staff.task.animalType);
      feeder.stock = Math.min(capacity, (feeder.stock || 0) + staff.carryItems.length);
      staff.carryItems = [];
      staff.updateCarryVisual();
      staff.task = {};
      staff.phase = 'idle';
    }
  }
}

// if there's no animal shack (or no path to it) yet, just keep the animal and retry next tick
function _headToShack(staff, world) {
  const shack = world.findObjects('animalShack')[0];
  if (!shack) return;
  const path = world.pathToAdjacent(staff.gx, staff.gy, shack.x, shack.y);
  if (!path) return;
  staff.setPath(path);
  staff.phase = 'toShack';
}

// if there's no matching feeder (or no path to it) yet, just keep the feed and retry next tick
function _headToFeeder(staff, world) {
  const { animalType } = staff.carryItems[0];
  const capacity = feederCapacity(animalType);
  const feeder = world.findObjects(animalType.feederType).find(f => (f.stock || 0) < capacity)
    || world.findObjects(animalType.feederType)[0];
  if (!feeder) return;
  const path = world.pathToAdjacent(staff.gx, staff.gy, feeder.x, feeder.y);
  if (!path) return;
  staff.task = { feeder, animalType };
  staff.setPath(path);
  staff.phase = 'toFeeder';
}

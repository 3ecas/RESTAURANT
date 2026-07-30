// Rancher: collect grown chickens -> animal shack (process) -> fridge (deliver), and keep
// the feeder stocked from the fridge's wheat supply so chickens have something to eat

import { FEEDER_CAPACITY } from '../../objects/chickenFeeder.js';
import { CHICKEN_PROCESS_TIME } from '../../objects/animalShack.js';
import { headToFridge } from './shared.js';

export function updateRancher(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    const item = staff.carryItems[0];
    if (item && item.kind === 'chicken') {
      headToFridge(staff, world);
      return;
    }
    if (item && item.kind === 'raw_chicken') {
      _headToShack(staff, world);
      return;
    }
    if (item && item.kind === 'wheat_feed') {
      _headToFeeder(staff, world);
      return;
    }
    // priority 1: collect a grown chicken
    const grownChicken = world.findObjects('chicken').find(c => c.grown && !c.claimed);
    if (grownChicken) {
      const path = world.pathToAdjacent(staff.gx, staff.gy, grownChicken.x, grownChicken.y);
      if (path) {
        grownChicken.claimed = true;
        staff.task = { chicken: grownChicken };
        staff.setPath(path);
        staff.phase = 'toChicken';
      }
      return;
    }
    // priority 2: top up a feeder that's running low, using wheat from the nearest
    // reachable fridge (nearestReachableObject — a closer fridge that's boxed in must not
    // block a farther, actually-reachable one)
    const feeder = world.findObjects('chickenFeeder').find(f => (f.wheat || 0) < FEEDER_CAPACITY);
    if (feeder && (game.ingredients.wheat || 0) > 0) {
      const fridge = world.nearestReachableObject('fridge', staff.gx, staff.gy);
      if (fridge) {
        const path = world.pathToAdjacent(staff.gx, staff.gy, fridge.x, fridge.y);
        if (path) {
          staff.task = { feeder };
          staff.setPath(path);
          staff.phase = 'toFridgeForFeed';
        }
      }
    }
  } else if (staff.phase === 'toChicken') {
    if (!staff.hasPath) {
      const chicken = staff.task.chicken;
      // collecting resets it to a chick — it isn't destroyed, just starts growing again
      chicken.grown = false;
      chicken.fed = 0;
      chicken.hungerCooldown = 0;
      chicken.claimed = false;
      staff.task = {};
      staff.carryItems = [{ kind: 'raw_chicken' }];
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toShack') {
    if (!staff.hasPath) {
      staff.busyTimer = CHICKEN_PROCESS_TIME / staff.workMultiplier;
      staff.phase = 'processingChicken';
    }
  } else if (staff.phase === 'processingChicken') {
    staff.busyTimer -= dt;
    if (staff.busyTimer <= 0) {
      staff.carryItems = [{ kind: 'chicken' }];
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFridge') {
    if (!staff.hasPath) {
      game.ingredients.chicken = (game.ingredients.chicken || 0) + staff.carryItems.length;
      staff.carryItems = [];
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFridgeForFeed') {
    if (!staff.hasPath) {
      // grab as much wheat as the feeder can still take in one trip — up to its full
      // 10-unit capacity, capped by whatever's actually in stock
      const feeder = staff.task.feeder;
      const need = FEEDER_CAPACITY - (feeder.wheat || 0);
      const take = Math.min(FEEDER_CAPACITY, need, game.ingredients.wheat || 0);
      if (take > 0) {
        game.ingredients.wheat -= take;
        staff.carryItems = Array.from({ length: take }, () => ({ kind: 'wheat_feed' }));
        staff.updateCarryVisual();
      } else {
        staff.task = {};
      }
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFeeder') {
    if (!staff.hasPath) {
      const feeder = staff.task.feeder;
      feeder.wheat = Math.min(FEEDER_CAPACITY, (feeder.wheat || 0) + staff.carryItems.length);
      staff.carryItems = [];
      staff.updateCarryVisual();
      staff.task = {};
      staff.phase = 'idle';
    }
  }
}

// if there's no animal shack (or no path to it) yet, just keep the chicken and retry next tick
function _headToShack(staff, world) {
  const shack = world.findObjects('animalShack')[0];
  if (!shack) return;
  const path = world.pathToAdjacent(staff.gx, staff.gy, shack.x, shack.y);
  if (!path) return;
  staff.setPath(path);
  staff.phase = 'toShack';
}

// if there's no feeder (or no path to it) yet, just keep the wheat and retry next tick
function _headToFeeder(staff, world) {
  const feeder = world.findObjects('chickenFeeder').find(f => (f.wheat || 0) < FEEDER_CAPACITY)
    || world.findObjects('chickenFeeder')[0];
  if (!feeder) return;
  const path = world.pathToAdjacent(staff.gx, staff.gy, feeder.x, feeder.y);
  if (!path) return;
  staff.task = { feeder };
  staff.setPath(path);
  staff.phase = 'toFeeder';
}

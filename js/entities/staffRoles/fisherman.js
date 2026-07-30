// Fisherman: catch -> freezer, one fish at a time — fish a random cell next to water for
// 3-8s, then carry the catch straight to a freezer (that's the only stop, no extra prep).
// Which fish gets caught is random (see data/fishTypes.js) — the carried item's `kind` is
// the actual ingredient name, so depositing it at the freezer is generic, no per-fish code.

import { pickFishCatch } from '../../data/fishTypes.js';

export function updateFisherman(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    const item = staff.carryItems[0];
    if (item) {
      _headToFreezer(staff, world);
      return;
    }
    const spots = world.fishingSpots();
    if (spots.length === 0) return; // no reachable water yet
    const spot = spots[Math.floor(Math.random() * spots.length)];
    const path = world.pathTo(staff.gx, staff.gy, spot.x, spot.y);
    if (path) {
      staff.setPath(path);
      staff.phase = 'toWater';
    }
  } else if (staff.phase === 'toWater') {
    if (!staff.hasPath) {
      staff.busyTimer = (3000 + Math.random() * 5000) / staff.workMultiplier; // 3-8s, faster with level
      staff.phase = 'fishing';
    }
  } else if (staff.phase === 'fishing') {
    staff.busyTimer -= dt;
    if (staff.busyTimer <= 0) {
      staff.carryItems = [{ kind: pickFishCatch() }];
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toFreezer') {
    if (!staff.hasPath) {
      for (const item of staff.carryItems) {
        game.ingredients[item.kind] = (game.ingredients[item.kind] || 0) + 1;
      }
      staff.carryItems = [];
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  }
}

// if there's no freezer (or no path to it) yet, just keep the raw catch and retry next tick
function _headToFreezer(staff, world) {
  const freezer = world.findObjects('freezer')[0];
  if (!freezer) return;
  const path = world.pathToAdjacent(staff.gx, staff.gy, freezer.x, freezer.y);
  if (!path) return;
  staff.setPath(path);
  staff.phase = 'toFreezer';
}

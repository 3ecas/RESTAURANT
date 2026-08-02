// Farmer: harvests matured crops, replants empty plots, deposits the harvest at a fridge

import { FARM_CROP_TYPES } from '../../objects/registry.js';
import { headToFridge } from './shared.js';

export function updateFarmer(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    if (staff.carryItems.length >= staff.carryCapacity()) {
      headToFridge(staff, world);
      return;
    }
    // priority 1: harvest anything that's matured, across every crop type
    for (const crop of FARM_CROP_TYPES) {
      const readyPlot = world.findObjects(crop.type).find(p => p.ready && !p.claimed);
      if (readyPlot) {
        readyPlot.claimed = true;
        staff.task = { plot: readyPlot, action: 'harvest', crop: crop.crop };
        const path = world.pathToAdjacent(staff.gx, staff.gy, readyPlot.x, readyPlot.y);
        staff.setPath(path || []);
        staff.phase = 'toPlot';
        return;
      }
    }
    // priority 2: replant any empty plot so production doesn't stall
    for (const crop of FARM_CROP_TYPES) {
      const emptyPlot = world.findObjects(crop.type).find(p => !p.planted && !p.claimed);
      if (emptyPlot) {
        emptyPlot.claimed = true;
        staff.task = { plot: emptyPlot, action: 'plant', crop: crop.crop };
        const path = world.pathToAdjacent(staff.gx, staff.gy, emptyPlot.x, emptyPlot.y);
        staff.setPath(path || []);
        staff.phase = 'toPlot';
        return;
      }
    }
    // priority 3: collect honey from any hive that has some waiting
    const hive = world.findObjects('beehive').find(h => h.honey > 0 && !h.claimed);
    if (hive) {
      hive.claimed = true;
      staff.task = { plot: hive, action: 'collectHoney' };
      const path = world.pathToAdjacent(staff.gx, staff.gy, hive.x, hive.y);
      staff.setPath(path || []);
      staff.phase = 'toPlot';
      return;
    }
    if (staff.carryItems.length > 0) headToFridge(staff, world);
  } else if (staff.phase === 'toPlot') {
    if (!staff.hasPath) {
      const plot = staff.task.plot;
      if (staff.task.action === 'harvest') {
        if (!plot.ready) {
          plot.claimed = false;
        } else {
          // harvesting doesn't unplant it — it just starts growing the next crop right away
          plot.ready = false;
          plot.progress = 0;
          plot.claimed = false;
          staff.carryItems.push({ kind: staff.task.crop });
          staff.updateCarryVisual();
        }
      } else if (staff.task.action === 'collectHoney') {
        const take = Math.min(plot.honey, staff.carryCapacity() - staff.carryItems.length);
        for (let i = 0; i < take; i++) staff.carryItems.push({ kind: 'honey' });
        staff.updateCarryVisual();
        plot.honey -= take;
        plot.claimed = false;
      } else { // plant
        if (plot.planted) {
          plot.claimed = false;
        } else {
          plot.planted = true;
          plot.progress = 0;
          plot.ready = false;
          plot.claimed = false;
        }
      }
      staff.task = {};
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
  }
}

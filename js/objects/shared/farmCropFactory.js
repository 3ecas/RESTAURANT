// Shared shape for every farmable plot type (farmPlot, tomatoFarm, cabbageFarm, cornFarm,
// potatoFarm) — only the crop it produces and its icons actually differ between them.

import { progressBar, readyCheckmark } from '../../game/drawHelpers.js';

export const FARM_GROW_TIME = 28000; // 28s for a planted crop to be ready to harvest

export function tickFarmGrowth(plot, dt) {
  if (plot.growthBoostRemaining > 0) plot.growthBoostRemaining = Math.max(0, plot.growthBoostRemaining - dt);
  if (plot.planted && !plot.ready) {
    const speed = plot.growthBoostRemaining > 0 ? 1.25 : 1; // bee pollination, see entities/bee.js
    plot.progress += dt * speed;
    if (plot.progress >= FARM_GROW_TIME) plot.ready = true;
  }
}

export function makeFarmCrop({ type, name, shopIcon, cost, crop, readyIcon }) {
  return {
    type, name, icon: shopIcon, color: '#6b4f36', cost, category: 'Farming',
    crop, readyIcon,
    walkthrough: true,

    // starts growing the moment it's placed — no separate "plant" step needed
    createState(base) {
      return Object.assign(base, { planted: true, progress: 0, ready: false, claimed: false, growthBoostRemaining: 0 });
    },

    getIcon(obj) {
      return obj.ready ? readyIcon : obj.planted ? '🌱' : '🟫';
    },

    canRemove(obj) { return !obj.ready; },
    canMove(obj) { return !obj.ready; },

    drawExtra(ctx, obj, px, py, cellSize) {
      if (obj.planted && !obj.ready) progressBar(ctx, px, py, cellSize, obj.progress / FARM_GROW_TIME, '#8bc34a');
      if (obj.ready) readyCheckmark(ctx, px, py, cellSize);
    },
  };
}

// Hired staff: shared leveling/carrying mechanics; per-role behavior lives in ./staffRoles/*

import { Mover } from './mover.js';
import { NAMES, STAFF_BASE_SPEED, STAFF_MAX_LEVEL, SPEED_MULT_BY_LEVEL, CAPACITY_BY_LEVEL, WORK_MULT_BY_LEVEL } from '../data/staffConfig.js';
import { updateWaiter } from './staffRoles/waiter.js';
import { updateChef } from './staffRoles/chef.js';
import { updateCleaner } from './staffRoles/cleaner.js';
import { updateFarmer } from './staffRoles/farmer.js';
import { updateFisherman } from './staffRoles/fisherman.js';
import { updateRancher } from './staffRoles/rancher.js';

let _staffId = 1;

export class StaffMember extends Mover {
  constructor(x, y, role) {
    super(x, y);
    this.id = _staffId++;
    this.role = role; // waiter, chef, cleaner, farmer, rancher, fisherman
    this.name = NAMES[Math.floor(Math.random() * NAMES.length)] + ' #' + this.id;
    this.phase = 'idle';
    this.busyTimer = 0;
    this.task = {};
    this.level = 1;
    this.training = null; // { remaining, total } ms, while leveling up
    this.carryItems = []; // waiter/cleaner: batch of items currently carried
    this.applyLevelStats();
  }

  applyLevelStats() {
    const lvl = Math.min(this.level, STAFF_MAX_LEVEL);
    const speedTable = SPEED_MULT_BY_LEVEL[this.role];
    this.speed = STAFF_BASE_SPEED * (speedTable ? speedTable[lvl - 1] : 1);
    // chef: stove cook speed. rancher: shack process speed. fisherman: catch speed. baked
    // into whatever they're working on at the moment it starts, not read continuously —
    // see chef.js/rancher.js/fisherman.js
    const workTable = WORK_MULT_BY_LEVEL[this.role];
    this.workMultiplier = workTable ? workTable[lvl - 1] : 1;
  }

  // how many items they carry in one trip before heading back. Farmer's table-driven cap
  // still delivers early (see farmer.js) whenever there's nothing left to harvest or plant,
  // so a farmer with only 1-2 plots delivers promptly instead of hoarding for a batch.
  carryCapacity() {
    const lvl = Math.min(this.level, STAFF_MAX_LEVEL);
    const capTable = CAPACITY_BY_LEVEL[this.role];
    return capTable ? capTable[lvl - 1] : 1;
  }

  updateCarryVisual() {
    if (this.carryItems.length === 0) { this.carrying = null; return; }
    const first = this.carryItems[0];
    this.carrying = { kind: first.kind, recipe: first.recipe, count: this.carryItems.length };
  }

  update(dt, world, game) {
    if (this.training) {
      this.training.remaining -= dt;
      if (this.training.remaining <= 0) {
        this.level = Math.min(STAFF_MAX_LEVEL, this.level + 1);
        this.applyLevelStats();
        this.training = null;
      }
    }
    this.stepMove(dt);
    if (this.role === 'waiter') updateWaiter(this, dt, world, game);
    else if (this.role === 'chef') updateChef(this, dt, world, game);
    else if (this.role === 'cleaner') updateCleaner(this, dt, world, game);
    else if (this.role === 'farmer') updateFarmer(this, dt, world, game);
    else if (this.role === 'fisherman') updateFisherman(this, dt, world, game);
    else if (this.role === 'rancher') updateRancher(this, dt, world, game);
  }
}

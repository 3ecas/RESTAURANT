// Hired staff: shared leveling/carrying mechanics; per-role behavior lives in ./staffRoles/*

import { Mover } from './mover.js';
import { NAMES, STAFF_BASE_SPEED, STAFF_MAX_LEVEL, speedMultiplier, workMultiplier, carryCapacity as carryCapacityFor } from '../data/staffConfig.js';
import { updateWaiter } from './staffRoles/waiter.js';
import { updateChef } from './staffRoles/chef.js';
import { updateFarmer } from './staffRoles/farmer.js';
import { updateFisherman } from './staffRoles/fisherman.js';
import { updateRancher } from './staffRoles/rancher.js';

let _staffId = 1;

export class StaffMember extends Mover {
  constructor(x, y, role) {
    super(x, y);
    this.id = _staffId++;
    this.role = role; // waiter, chef, farmer, rancher, fisherman
    this.name = NAMES[Math.floor(Math.random() * NAMES.length)] + ' #' + this.id;
    this.phase = 'idle';
    this.busyTimer = 0;
    this.task = {};
    this.level = 1;
    this.training = null; // { remaining, total } ms, while leveling up
    this.carryItems = []; // waiter: batch of items currently carried (dishes to deliver, or dirty plates to bus)
    this.applyLevelStats();
  }

  applyLevelStats() {
    this.speed = STAFF_BASE_SPEED * speedMultiplier(this.role, this.level);
    // chef: stove cook speed. rancher: shack process speed. fisherman: catch speed. baked
    // into whatever they're working on at the moment it starts, not read continuously —
    // see chef.js/rancher.js/fisherman.js
    this.workMultiplier = workMultiplier(this.role, this.level);
  }

  carryCapacity() {
    return carryCapacityFor(this.role, this.level);
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
    else if (this.role === 'farmer') updateFarmer(this, dt, world, game);
    else if (this.role === 'fisherman') updateFisherman(this, dt, world, game);
    else if (this.role === 'rancher') updateRancher(this, dt, world, game);
  }
}

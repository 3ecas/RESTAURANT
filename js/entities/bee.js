// A beehive's bee — the only entity in the game that doesn't walk a grid-BFS path (see
// entities/mover.js, which every other mover extends). Bees free-roam in pixel space with a
// random wiggle, bounded near their home hive, opportunistically pollinating nearby growing
// crops (see objects/shared/farmCropFactory.js's growthBoostRemaining) before heading home to
// deposit 1 honey and heading back out. Spawned via Game.spawnBeesForHive, ticked from
// Game.update, drawn in game/render.js's y-sorted drawables list alongside staff/customers.

import { CELL } from '../core/constants.js';
import { FARM_CROP_TYPES } from '../objects/registry.js';

const WANDER_SPEED = 30, RETURN_SPEED = 55;
const WANDER_RADIUS = CELL * 3, POLLINATE_RADIUS = 20, ARRIVE_THRESHOLD = 4;
const BOOST_MS = 15000;

export class Bee {
  constructor(hive) {
    this.hive = hive; // live world.objects reference — always read hive.x/.y live, never cache
    this.px = hive.x * CELL + CELL / 2;
    this.py = hive.y * CELL + CELL / 2;
    this.angle = Math.random() * Math.PI * 2;
    this.phase = 'wander'; // 'wander' | 'returning'
  }
  update(dt, world) {
    if (this.phase === 'wander') this._wander(dt, world);
    else this._returnToHive(dt);
  }
  _wander(dt, world) {
    this.angle += (Math.random() - 0.5) * 1.2;
    const hx = this.hive.x * CELL + CELL / 2, hy = this.hive.y * CELL + CELL / 2;
    if (Math.hypot(this.px - hx, this.py - hy) > WANDER_RADIUS) {
      this.angle = Math.atan2(hy - this.py, hx - this.px) + (Math.random() - 0.5) * 0.6;
    }
    const step = WANDER_SPEED * dt / 1000;
    this.px += Math.cos(this.angle) * step;
    this.py += Math.sin(this.angle) * step;
    const target = this._findPollinationTarget(world);
    if (target) { target.growthBoostRemaining = BOOST_MS; this.phase = 'returning'; }
  }
  _returnToHive(dt) {
    const hx = this.hive.x * CELL + CELL / 2, hy = this.hive.y * CELL + CELL / 2;
    const dx = hx - this.px, dy = hy - this.py, dist = Math.hypot(dx, dy);
    const step = RETURN_SPEED * dt / 1000;
    if (dist <= Math.max(step, ARRIVE_THRESHOLD)) {
      this.px = hx; this.py = hy;
      this.hive.honey = Math.min(this.hive.honeyCapacity, this.hive.honey + 1);
      this.phase = 'wander';
    } else {
      this.px += dx / dist * step; this.py += dy / dist * step;
    }
  }
  _findPollinationTarget(world) {
    for (const cropType of FARM_CROP_TYPES) {
      for (const plot of world.findObjects(cropType.type)) {
        if (!plot.planted || plot.ready || plot.growthBoostRemaining > 0) continue;
        const px = plot.x * CELL + CELL / 2, py = plot.y * CELL + CELL / 2;
        if (Math.hypot(this.px - px, this.py - py) <= POLLINATE_RADIUS) return plot;
      }
    }
    return null;
  }
}

// The player-controlled character — WASD (free movement, cancels any click-path) plus
// click-to-move/click-to-interact pathing (see game/input.js)

import { CELL, SCALE } from '../core/constants.js';

export class Player {
  constructor(x, y) {
    this.px = x * CELL + CELL / 2;
    this.py = y * CELL + CELL / 2;
    this.facing = 'down';
    this.carrying = null;
    this.speed = 120;
    this.path = []; // click-to-move path; WASD cancels it, it never overrides WASD
    this.pendingInteractTarget = null; // object to auto-interact with once the path finishes
  }
  get cellX() { return Math.floor(this.px / CELL); }
  get cellY() { return Math.floor(this.py / CELL); }
  setPath(path) { this.path = path ? path.slice() : []; }
  get hasPath() { return this.path.length > 0; }
  update(dt, world, keys) {
    let vx = 0, vy = 0;
    if (keys.has('w')) vy -= 1;
    if (keys.has('s')) vy += 1;
    if (keys.has('a')) vx -= 1;
    if (keys.has('d')) vx += 1;
    if (vx !== 0 || vy !== 0) {
      // manual movement always takes over and cancels any click-to-move path in progress
      this.path = [];
      this.pendingInteractTarget = null;
      const len = Math.hypot(vx, vy);
      vx /= len; vy /= len;
      if (Math.abs(vx) > Math.abs(vy)) this.facing = vx > 0 ? 'right' : 'left';
      else this.facing = vy > 0 ? 'down' : 'up';
      const hw = 10 * SCALE, hh = 10 * SCALE;
      const nx = this.px + vx * this.speed * dt / 1000;
      const ny = this.py + vy * this.speed * dt / 1000;
      if (this._free(world, nx, this.py, hw, hh)) this.px = nx;
      if (this._free(world, this.px, ny, hw, hh)) this.py = ny;
      return;
    }
    if (this.path.length > 0) {
      const next = this.path[0];
      const tx = next.x * CELL + CELL / 2, ty = next.y * CELL + CELL / 2;
      const dx = tx - this.px, dy = ty - this.py;
      const dist = Math.hypot(dx, dy);
      const step = this.speed * dt / 1000;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else if (dy !== 0) this.facing = dy > 0 ? 'down' : 'up';
      if (dist <= step || dist === 0) {
        this.px = tx; this.py = ty;
        this.path.shift();
      } else {
        this.px += dx / dist * step;
        this.py += dy / dist * step;
      }
    }
  }
  _free(world, cx, cy, hw, hh) {
    const pts = [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx - hw, cy + hh], [cx + hw, cy + hh]];
    for (const [px, py] of pts) {
      const gx = Math.floor(px / CELL), gy = Math.floor(py / CELL);
      if (!world.isWalkable(gx, gy)) return false;
    }
    return true;
  }
}

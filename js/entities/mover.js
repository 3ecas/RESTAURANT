// Base class for anything that walks a BFS path across the grid one cell at a time

import { CELL } from '../core/constants.js';

export class Mover {
  constructor(x, y) {
    this.gx = x; this.gy = y;
    this.px = x * CELL + CELL / 2;
    this.py = y * CELL + CELL / 2;
    this.facing = 'down';
    this.path = [];
    this.speed = 70;
    this.carrying = null; // {kind:'ingredient'|'cooked'|'dirty', recipe}
  }
  setPath(path) { this.path = path ? path.slice() : []; }
  get hasPath() { return this.path.length > 0; }
  stepMove(dt) {
    if (this.path.length === 0) return false;
    const next = this.path[0];
    const tx = next.x * CELL + CELL / 2, ty = next.y * CELL + CELL / 2;
    const dx = tx - this.px, dy = ty - this.py;
    const dist = Math.hypot(dx, dy);
    const step = this.speed * dt / 1000;
    if (dist <= step || dist === 0) {
      this.px = tx; this.py = ty; this.gx = next.x; this.gy = next.y;
      this.path.shift();
    } else {
      this.px += dx / dist * step;
      this.py += dy / dist * step;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';
    }
    return true;
  }
}

// Grid, world map, pathfinding — one open field, buildable everywhere

const COLS = 21;
const ROWS = 21;
const CELL = 40;
const SCALE = CELL / 32; // grows the fixed-pixel visuals (characters, badges, text) along with the cell size

// object types that never block movement — anyone can walk straight over them
const WALKTHROUGH_TYPES = new Set(['door', 'chair']);

const DIRS = [
  { x: 0, y: -1, name: 'up' },
  { x: 0, y: 1, name: 'down' },
  { x: -1, y: 0, name: 'left' },
  { x: 1, y: 0, name: 'right' },
];

// anything a chair can pair up with to seat a customer — a table, or a counter (bar seating)
const SEATING_SURFACE_TYPES = new Set(['table', 'wall']);

class World {
  constructor() {
    this.grid = [];
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      for (let x = 0; x < COLS; x++) row.push(null);
      this.grid.push(row);
    }
    this.objects = [];
    this.customers = [];
    this.water = new Set(); // "x,y" keys — irregular pond terrain, never walkable/buildable
  }

  isWater(x, y) {
    return this.water.has(x + ',' + y);
  }

  // grows a single irregular pond (capped at maxSize cells) on empty ground, via random
  // blob growth from one seed cell — every water cell always touches another one.
  // always confined to the top band of the map so water reliably appears along the top edge.
  generateWater(maxSize) {
    const topBand = Math.max(4, Math.floor(ROWS * 0.25));
    const size = 1 + Math.floor(Math.random() * maxSize);
    let seed = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      const x = Math.floor(Math.random() * COLS);
      const y = Math.floor(Math.random() * topBand);
      if (this.grid[y][x] === null && !this.isWater(x, y)) { seed = { x, y }; break; }
    }
    if (!seed) return;

    const blob = [seed];
    const frontier = [seed];
    while (blob.length < size && frontier.length > 0) {
      const idx = Math.floor(Math.random() * frontier.length);
      const cell = frontier[idx];
      const dirs = DIRS.slice().sort(() => Math.random() - 0.5);
      let grew = false;
      for (const d of dirs) {
        const nx = cell.x + d.x, ny = cell.y + d.y;
        if (!this.inBounds(nx, ny) || ny >= topBand) continue;
        if (this.grid[ny][nx] !== null || this.isWater(nx, ny)) continue;
        if (blob.some(c => c.x === nx && c.y === ny)) continue;
        const next = { x: nx, y: ny };
        blob.push(next);
        frontier.push(next);
        grew = true;
        break;
      }
      if (!grew) frontier.splice(idx, 1);
    }

    for (const c of blob) this.water.add(c.x + ',' + c.y);
  }

  // the entrance is just the placed 'door' object (2x1) — no door placed means no entrance
  get door() {
    return this.findObjects('door')[0] || null;
  }

  get entranceCells() {
    const door = this.door;
    if (!door) return [];
    return [{ x: door.x, y: door.y }, { x: door.x + 1, y: door.y }];
  }

  isReservedCell(x, y) {
    return this.entranceCells.some(e => e.x === x && e.y === y);
  }

  inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  cellAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.grid[y][x];
  }

  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    if (this.isWater(x, y)) return false;
    const cell = this.grid[y][x];
    if (cell !== null && !WALKTHROUGH_TYPES.has(cell.type)) return false;
    return true;
  }

  // walkable, not a reserved cell (entrance), and not already occupied — used for build placement
  isBuildable(x, y) {
    return this.isWalkable(x, y) && !this.isReservedCell(x, y) && this.grid[y][x] === null;
  }

  // door-specific: needs both of its cells free
  canPlaceDoor(x, y) {
    return this.isBuildable(x, y) && this.isBuildable(x + 1, y);
  }

  place(obj, x, y) {
    if (obj.type === 'door') {
      const x2 = x + 1;
      if (!this.inBounds(x, y) || !this.inBounds(x2, y)) return false;
      if (this.grid[y][x] !== null || this.grid[y][x2] !== null) return false;
      obj.x = x;
      obj.y = y;
      this.grid[y][x] = obj;
      this.grid[y][x2] = obj;
      this.objects.push(obj);
      return true;
    }
    if (!this.inBounds(x, y) || this.grid[y][x] !== null) return false;
    obj.x = x;
    obj.y = y;
    this.grid[y][x] = obj;
    this.objects.push(obj);
    return true;
  }

  removeAt(x, y) {
    const obj = this.cellAt(x, y);
    if (!obj) return null;
    if (obj.type === 'door') {
      this.grid[obj.y][obj.x] = null;
      this.grid[obj.y][obj.x + 1] = null;
    } else {
      this.grid[y][x] = null;
    }
    this.objects = this.objects.filter(o => o !== obj);
    return obj;
  }

  findObjects(type) {
    return this.objects.filter(o => o.type === type);
  }

  // whichever object of this type is physically closest to (fromX, fromY) — lets staff
  // always use the nearest fridge/appliance to them instead of always the first one placed
  nearestObject(type, fromX, fromY) {
    const candidates = this.findObjects(type);
    if (candidates.length === 0) return null;
    let best = candidates[0], bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.abs(c.x - fromX) + Math.abs(c.y - fromY);
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
  }

  randomEntranceCell() {
    const cells = this.entranceCells;
    if (cells.length === 0) return null;
    return cells[Math.floor(Math.random() * cells.length)];
  }

  nearestEntranceCell(fromX, fromY) {
    const cells = this.entranceCells;
    if (cells.length === 0) return { x: fromX, y: fromY };
    let best = cells[0], bestDist = Infinity;
    for (const e of cells) {
      const d = Math.abs(e.x - fromX) + Math.abs(e.y - fromY);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  // any of the 4 neighboring cells works — appliances can be used from any side
  pathToAdjacent(sx, sy, tx, ty) {
    const targets = new Set();
    for (const d of DIRS) {
      const nx = tx + d.x, ny = ty + d.y;
      if (this.isWalkable(nx, ny)) targets.add(nx + ',' + ny);
    }
    if (targets.size === 0) return null;
    if (sx === tx && sy === ty) return [];
    return this._bfs(sx, sy, (x, y) => targets.has(x + ',' + y));
  }

  pathTo(sx, sy, tx, ty) {
    if (!this.isWalkable(tx, ty)) return null;
    return this._bfs(sx, sy, (x, y) => x === tx && y === ty);
  }

  _bfs(sx, sy, isGoal) {
    const startKey = sx + ',' + sy;
    if (isGoal(sx, sy)) return [];
    const visited = new Set([startKey]);
    const prev = new Map();
    const queue = [{ x: sx, y: sy }];
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      for (const d of DIRS) {
        const nx = cur.x + d.x, ny = cur.y + d.y;
        const key = nx + ',' + ny;
        if (visited.has(key)) continue;
        if (!this.isWalkable(nx, ny)) continue;
        visited.add(key);
        prev.set(key, cur);
        if (isGoal(nx, ny)) {
          const path = [{ x: nx, y: ny }];
          let ck = key;
          let p = prev.get(ck);
          while (p) {
            path.unshift(p);
            ck = p.x + ',' + p.y;
            p = prev.get(ck);
          }
          path.shift();
          return path;
        }
        queue.push({ x: nx, y: ny });
      }
    }
    return null;
  }

  // every object customers can sit and be served at — tables and counters/walls with a chair
  seatingSurfaces() {
    return this.objects.filter(o => SEATING_SURFACE_TYPES.has(o.type));
  }

  chairsForTables() {
    const result = [];
    for (const chair of this.findObjects('chair')) {
      for (const d of DIRS) {
        const neighbor = this.cellAt(chair.x + d.x, chair.y + d.y);
        if (neighbor && SEATING_SURFACE_TYPES.has(neighbor.type)) {
          result.push({ chair, table: neighbor });
          break;
        }
      }
    }
    return result;
  }

  tableOfChair(chair) {
    for (const d of DIRS) {
      const neighbor = this.cellAt(chair.x + d.x, chair.y + d.y);
      if (neighbor && SEATING_SURFACE_TYPES.has(neighbor.type)) return neighbor;
    }
    return null;
  }

  // every chair seated around the given table/counter — lets one interaction serve the whole group
  chairsOfTable(table) {
    return this.findObjects('chair').filter(chair => this.tableOfChair(chair) === table);
  }

  // every walkable cell that touches at least one water cell — where a fisherman can fish from
  fishingSpots() {
    const spots = [];
    const seen = new Set();
    for (const key of this.water) {
      const [wx, wy] = key.split(',').map(Number);
      for (const d of DIRS) {
        const nx = wx + d.x, ny = wy + d.y;
        const k = nx + ',' + ny;
        if (seen.has(k)) continue;
        seen.add(k);
        if (this.isWalkable(nx, ny)) spots.push({ x: nx, y: ny });
      }
    }
    return spots;
  }
}

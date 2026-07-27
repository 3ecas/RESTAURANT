// Grid, world map (lots), pathfinding

const LOT_SIZE = 7;
const LOTS_PER_SIDE = 3;
const COLS = LOT_SIZE * LOTS_PER_SIDE; // 21
const ROWS = LOT_SIZE * LOTS_PER_SIDE; // 21
const CELL = 32;
const MAX_QUEUE = 6;

const DIRS = [
  { x: 0, y: -1, name: 'up' },
  { x: 0, y: 1, name: 'down' },
  { x: -1, y: 0, name: 'left' },
  { x: 1, y: 0, name: 'right' },
];
const OPPOSITE_DIR = { up: 'down', down: 'up', left: 'right', right: 'left' };

// appliances that can only be used by approaching from one specific side (obj.side)
const SINGLE_SIDE_TYPES = new Set(['stove', 'fridge']);

function usableSides(obj) {
  if (SINGLE_SIDE_TYPES.has(obj.type)) {
    const d = DIRS.find(d => d.name === obj.side);
    return d ? [d] : DIRS;
  }
  return DIRS;
}

// the 8 lots surrounding the home lot (meta-grid coords, col/row 0-2). Diagonals
// require both their adjacent side-lots to already be owned.
const EXPANSION_LOTS = [
  { key: 'N', label: 'North', col: 1, row: 0, requires: [] },
  { key: 'S', label: 'South', col: 1, row: 2, requires: [] },
  { key: 'W', label: 'West', col: 0, row: 1, requires: [] },
  { key: 'E', label: 'East', col: 2, row: 1, requires: [] },
  { key: 'NW', label: 'Northwest', col: 0, row: 0, requires: ['N', 'W'] },
  { key: 'NE', label: 'Northeast', col: 2, row: 0, requires: ['N', 'E'] },
  { key: 'SW', label: 'Southwest', col: 0, row: 2, requires: ['S', 'W'] },
  { key: 'SE', label: 'Southeast', col: 2, row: 2, requires: ['S', 'E'] },
];
const LOT_BASE_COST = 100;
const LOT_COST_MULTIPLIER = 3;

// single escalating price for whichever expansion lot is purchased next
function lotPurchaseCost(world) {
  const owned = EXPANSION_LOTS.filter(l => world.lots[l.row][l.col]).length;
  return LOT_BASE_COST * Math.pow(LOT_COST_MULTIPLIER, owned);
}

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

    // [row][col], meta-grid of lots; home (1,1) always owned
    this.lots = [
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ];

    const homeX0 = LOT_SIZE, homeY0 = LOT_SIZE;
    this.entranceCells = [
      { x: homeX0 + 2, y: homeY0 + LOT_SIZE - 1 },
      { x: homeX0 + 3, y: homeY0 + LOT_SIZE - 1 },
    ];
  }

  lotOwned(col, row) {
    if (col < 0 || col > 2 || row < 0 || row > 2) return false;
    return this.lots[row][col];
  }

  lotOf(x, y) {
    return { col: Math.floor(x / LOT_SIZE), row: Math.floor(y / LOT_SIZE) };
  }

  // fixed waiting-line cells: rightmost aligns under the rightmost entrance cell,
  // extending left, one row below/outside the home lot
  queueSpot(index) {
    const front = this.entranceCells[this.entranceCells.length - 1];
    return { x: front.x - index, y: front.y + 1 };
  }

  isReservedCell(x, y) {
    if (this.entranceCells.some(e => e.x === x && e.y === y)) return true;
    for (let i = 0; i < MAX_QUEUE; i++) {
      const q = this.queueSpot(i);
      if (q.x === x && q.y === y) return true;
    }
    return false;
  }

  inBounds(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  isLocked(x, y) {
    if (this.isReservedCell(x, y)) return false;
    const { col, row } = this.lotOf(x, y);
    return !this.lotOwned(col, row);
  }

  cellAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.grid[y][x];
  }

  isWalkable(x, y) {
    if (!this.inBounds(x, y)) return false;
    if (this.grid[y][x] !== null) return false;
    if (this.isLocked(x, y)) return false;
    return true;
  }

  // walkable AND not a reserved cell (entrance/queue) - used for build placement
  isBuildable(x, y) {
    return this.isWalkable(x, y) && !this.isReservedCell(x, y);
  }

  place(obj, x, y) {
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
    this.grid[y][x] = null;
    this.objects = this.objects.filter(o => o !== obj);
    return obj;
  }

  findObjects(type) {
    return this.objects.filter(o => o.type === type);
  }

  randomEntranceCell() {
    return this.entranceCells[Math.floor(Math.random() * this.entranceCells.length)];
  }

  nearestEntranceCell(fromX, fromY) {
    let best = this.entranceCells[0], bestDist = Infinity;
    for (const e of this.entranceCells) {
      const d = Math.abs(e.x - fromX) + Math.abs(e.y - fromY);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  // pass the target object as `obj` to restrict candidate cells to its usable side(s)
  pathToAdjacent(sx, sy, tx, ty, obj) {
    const dirs = obj ? usableSides(obj) : DIRS;
    const targets = new Set();
    for (const d of dirs) {
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

  chairsForTables() {
    const result = [];
    for (const chair of this.findObjects('chair')) {
      for (const d of DIRS) {
        const neighbor = this.cellAt(chair.x + d.x, chair.y + d.y);
        if (neighbor && neighbor.type === 'table') {
          result.push({ chair, table: neighbor });
          break;
        }
      }
    }
    return result;
  }
}

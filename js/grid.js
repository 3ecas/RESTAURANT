// Grid, world map, pathfinding — a pointy-top hexagonal grid, "odd-r" offset coordinates
// (each odd row is shifted half a hex to the right). Every cell is addressed by integer
// (col, row) exactly like the old square grid was, but each cell now has 6 neighbors
// instead of 4, and their offsets depend on whether the row is even or odd.

const COLS = 21;
const ROWS = 21;
const HEX_SIZE = 26; // center-to-corner radius
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;   // horizontal distance between same-parity columns
const HEX_VERT = HEX_SIZE * 1.5;             // vertical distance between rows
const SCALE = HEX_SIZE / 26; // grows the fixed-pixel visuals (characters, badges, text) with hex size

// object types that never block movement — anyone can walk straight over them
const WALKTHROUGH_TYPES = new Set(['door', 'chair', 'farmPlot', 'tomatoFarm']);

// the 6 hex directions, named by their visual position for a pointy-top hex.
// offsets differ by row parity (odd-r offset coordinates) — see hexNeighbors().
const HEX_DIR_NAMES = ['NE', 'E', 'SE', 'SW', 'W', 'NW'];
const OPPOSITE_DIR = { NE: 'SW', SW: 'NE', E: 'W', W: 'E', SE: 'NW', NW: 'SE' };
const HEX_EDGE_ANGLE_DEG = { NE: -60, E: 0, SE: 60, SW: 120, W: 180, NW: 240 };

const HEX_NEIGHBOR_OFFSETS_EVEN = { NE: [0, -1], E: [1, 0], SE: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
const HEX_NEIGHBOR_OFFSETS_ODD = { NE: [1, -1], E: [1, 0], SE: [1, 1], SW: [0, 1], W: [-1, 0], NW: [0, -1] };

function hexNeighbors(col, row) {
  const table = (row & 1) ? HEX_NEIGHBOR_OFFSETS_ODD : HEX_NEIGHBOR_OFFSETS_EVEN;
  return HEX_DIR_NAMES.map(name => {
    const [dx, dy] = table[name];
    return { name, x: col + dx, y: row + dy };
  });
}

function hexNeighborAt(col, row, dirName) {
  const table = (row & 1) ? HEX_NEIGHBOR_OFFSETS_ODD : HEX_NEIGHBOR_OFFSETS_EVEN;
  const [dx, dy] = table[dirName];
  return { x: col + dx, y: row + dy };
}

// offset (odd-r) -> axial, used for true hex-distance calculations
function offsetToAxial(col, row) {
  const q = col - (row - (row & 1)) / 2;
  const r = row;
  return { q, r };
}

function hexDistance(ax, ay, bx, by) {
  const A = offsetToAxial(ax, ay), B = offsetToAxial(bx, by);
  return (Math.abs(A.q - B.q) + Math.abs(A.q + A.r - B.q - B.r) + Math.abs(A.r - B.r)) / 2;
}

// ---- pixel <-> hex conversion (pointy-top, odd-r offset) ----

function hexToPixel(col, row) {
  const x = HEX_WIDTH * (col + 0.5 * (row & 1)) + HEX_WIDTH / 2;
  const y = HEX_VERT * row + HEX_SIZE;
  return { x, y };
}

function axialToOffset(q, r) {
  const col = q + (r - (r & 1)) / 2;
  const row = r;
  return { x: col, y: row };
}

function axialRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const xd = Math.abs(rx - x), yd = Math.abs(ry - y), zd = Math.abs(rz - z);
  if (xd > yd && xd > zd) rx = -ry - rz;
  else if (yd > zd) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}

function pixelToHex(px, py) {
  const x = px - HEX_WIDTH / 2;
  const y = py - HEX_SIZE;
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / HEX_SIZE;
  const r = (2 / 3 * y) / HEX_SIZE;
  const rounded = axialRound(q, r);
  const off = axialToOffset(rounded.q, rounded.r);
  return { x: Math.round(off.x), y: Math.round(off.y) };
}

function hexCorners(cx, cy, size) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 180 * (60 * i - 90);
    corners.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return corners;
}

// anything a chair can pair up with to seat a customer — a table, or a counter (bar seating)
const SEATING_SURFACE_TYPES = new Set(['table', 'wall']);

// chandelier: customers seated within this radius eat faster and pay a bit extra
const CHANDELIER_RADIUS = 3;
const CHANDELIER_EAT_SPEEDUP = 1.3; // 30% faster
const CHANDELIER_MONEY_BONUS = 0.10; // +10% on payment

// appliances that can only be used by approaching from one specific side (obj.side) —
// currently unused (nothing sets obj.side), kept for future use
const SINGLE_SIDE_TYPES = new Set();

function usableSides(obj) {
  if (SINGLE_SIDE_TYPES.has(obj.type) && obj.side) {
    return [obj.side];
  }
  return HEX_DIR_NAMES;
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
      const neighbors = hexNeighbors(cell.x, cell.y).sort(() => Math.random() - 0.5);
      let grew = false;
      for (const n of neighbors) {
        const nx = n.x, ny = n.y;
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

  // the entrance is just the placed 'door' object (spanning 2 hex-adjacent cells) — no
  // door placed means no entrance
  get door() {
    return this.findObjects('door')[0] || null;
  }

  get entranceCells() {
    const door = this.door;
    if (!door) return [];
    return [{ x: door.x, y: door.y }, { x: door.x2, y: door.y2 }];
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

  // door-specific: needs both of its hex-adjacent cells free
  canPlaceDoor(x, y) {
    const second = hexNeighborAt(x, y, 'E');
    return this.isBuildable(x, y) && this.isBuildable(second.x, second.y);
  }

  place(obj, x, y) {
    if (obj.type === 'door') {
      const second = hexNeighborAt(x, y, 'E');
      if (!this.inBounds(x, y) || !this.inBounds(second.x, second.y)) return false;
      if (this.grid[y][x] !== null || this.grid[second.y][second.x] !== null) return false;
      obj.x = x; obj.y = y;
      obj.x2 = second.x; obj.y2 = second.y;
      this.grid[y][x] = obj;
      this.grid[second.y][second.x] = obj;
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
      this.grid[obj.y2][obj.x2] = null;
    } else {
      this.grid[y][x] = null;
    }
    this.objects = this.objects.filter(o => o !== obj);
    return obj;
  }

  findObjects(type) {
    return this.objects.filter(o => o.type === type);
  }

  // nearest object of a type to a given cell (hex distance) — falls back to the first
  // one found if there's a tie or distance can't be computed
  nearestObject(type, fromX, fromY) {
    const objs = this.findObjects(type);
    if (objs.length === 0) return null;
    let best = objs[0], bestDist = Infinity;
    for (const o of objs) {
      const d = hexDistance(fromX, fromY, o.x, o.y);
      if (d < bestDist) { bestDist = d; best = o; }
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
      const d = hexDistance(fromX, fromY, e.x, e.y);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }

  // pass the target object as `obj` to restrict candidate cells to its usable side(s)
  pathToAdjacent(sx, sy, tx, ty, obj) {
    const sideNames = obj ? usableSides(obj) : HEX_DIR_NAMES;
    const targets = new Set();
    for (const n of hexNeighbors(tx, ty)) {
      if (!sideNames.includes(n.name)) continue;
      if (this.isWalkable(n.x, n.y)) targets.add(n.x + ',' + n.y);
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
      for (const n of hexNeighbors(cur.x, cur.y)) {
        const nx = n.x, ny = n.y;
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
      for (const n of hexNeighbors(chair.x, chair.y)) {
        const neighbor = this.cellAt(n.x, n.y);
        if (neighbor && SEATING_SURFACE_TYPES.has(neighbor.type)) {
          result.push({ chair, table: neighbor });
          break;
        }
      }
    }
    return result;
  }

  tableOfChair(chair) {
    for (const n of hexNeighbors(chair.x, chair.y)) {
      const neighbor = this.cellAt(n.x, n.y);
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
      for (const n of hexNeighbors(wx, wy)) {
        const k = n.x + ',' + n.y;
        if (seen.has(k)) continue;
        seen.add(k);
        if (this.isWalkable(n.x, n.y)) spots.push({ x: n.x, y: n.y });
      }
    }
    return spots;
  }

  isNearChandelier(x, y) {
    return this.findObjects('chandelier').some(ch => hexDistance(ch.x, ch.y, x, y) <= CHANDELIER_RADIUS);
  }
}

// Main game: setup, input, buy/place/move/store/sell, land expansion, loop, rendering

const ROTATE_ORDER = ['up', 'right', 'down', 'left'];

class Game {
  constructor() {
    this.world = new World();
    this.money = 0;
    this.staff = [];
    this.inventory = []; // bought/stored objects not currently on the grid
    this.heldObject = null; // the single object currently in-hand, ready to place
    this.contextTarget = null;
    this.hoverCell = null;
    this.menuOpen = false;
    this.keys = new Set();
    this.spawnTimer = 3000;
    this.isOpen = true;

    this.setupLevel();
    this.player = new Player(8, 10);
  }

  setupLevel() {
    const w = this.world;
    w.place(createObject('fridge'), 8, 8);
    w.place(createObject('stove'), 9, 8);
    w.place(createObject('orderStand'), 10, 8);
    w.place(createObject('sink'), 11, 8);
    w.place(createObject('payingBooth'), 12, 8);
    w.place(createObject('spawnPoint'), 7, 7);

    w.place(createObject('table'), 10, 11);
    w.place(createObject('chair'), 10, 10);
    w.place(createObject('chair'), 10, 12);
  }

  addMoney(amount) {
    this.money += amount;
    updateMoneyUI(this);
  }

  openMenu() {
    this.menuOpen = true;
    document.getElementById('menu').classList.remove('hidden');
  }
  closeMenu() {
    this.menuOpen = false;
    document.getElementById('menu').classList.add('hidden');
  }
  toggleMenu() {
    if (this.menuOpen) this.closeMenu(); else this.openMenu();
  }

  // ---- buying / placing / moving / storing / selling ----

  buyItem(type) {
    const def = getItemDef(type);
    if (!def || this.money < def.cost) return;
    this.addMoney(-def.cost);
    this.inventory.push(createObject(type));
    refreshObjectsTab(this);
  }

  beginPlacing(obj) {
    if (this.heldObject) return;
    this.inventory = this.inventory.filter(o => o !== obj);
    this.heldObject = obj;
    this.closeMenu();
    updateHoldingUI(this);
    refreshObjectsTab(this);
  }

  relocateObject(obj) {
    hideContextMenu();
    if (this.heldObject || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.heldObject = obj;
    this.closeMenu();
    updateHoldingUI(this);
    refreshObjectsTab(this);
  }

  storeObject(obj) {
    hideContextMenu();
    if (!this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.inventory.push(obj);
    refreshObjectsTab(this);
  }

  sellObject(obj) {
    hideContextMenu();
    const def = getItemDef(obj.type);
    if (!def || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.addMoney(Math.floor(def.cost * 0.5));
    refreshObjectsTab(this);
  }

  rotateObject(obj) {
    hideContextMenu();
    if (!SINGLE_SIDE_TYPES.has(obj.type)) return;
    const i = ROTATE_ORDER.indexOf(obj.side);
    obj.side = ROTATE_ORDER[(i + 1) % ROTATE_ORDER.length];
  }

  evictCustomersFrom(obj) {
    for (const c of this.world.customers) {
      if (c.chair === obj || c.table === obj) {
        if (c.chair) c.chair.occupied = null;
        c.claimed = false;
        c.state = 'leaving';
        const ec = this.world.nearestEntranceCell(c.gx, c.gy);
        const path = this.world.pathTo(c.gx, c.gy, ec.x, ec.y);
        c.setPath(path || []);
      }
    }
  }

  canRemoveObject(obj) {
    if (obj.type === 'stove' && obj.cooking) return false;
    if (obj.type === 'orderStand' && (obj.pending.length || obj.ready.length)) return false;
    if (obj.type === 'payingBooth' && obj.collected > 0) return false;
    return true;
  }

  // ---- land expansion ----

  purchaseLot(key) {
    const lot = EXPANSION_LOTS.find(l => l.key === key);
    if (!lot) return;
    if (this.world.lots[lot.row][lot.col]) return;
    const eligible = lot.requires.every(rk => {
      const rl = EXPANSION_LOTS.find(l => l.key === rk);
      return this.world.lots[rl.row][rl.col];
    });
    if (!eligible) return;
    const cost = lotPurchaseCost(this.world);
    if (this.money < cost) return;
    this.addMoney(-cost);
    this.world.lots[lot.row][lot.col] = true;
    renderShopMap(this);
  }

  // ---- staff ----

  hireStaff(role) {
    const cost = getHireCost(this, role);
    if (this.money < cost) return;
    this.addMoney(-cost);
    const spot = this.findSpawnSpot();
    const s = new StaffMember(spot.x, spot.y, role);
    this.staff.push(s);
    renderStaffTable(this);
    updateStaffCountUI(this);
    renderStaffHireButtons(this);
  }

  fireStaff(id) {
    const s = this.staff.find(s => s.id === id);
    if (s && s.task && s.task.stove) s.task.stove.reservedBy = null;
    this.staff = this.staff.filter(s => s.id !== id);
    renderStaffTable(this);
    updateStaffCountUI(this);
    renderStaffHireButtons(this);
  }

  findSpawnSpot() {
    const sp = this.world.findObjects('spawnPoint')[0];
    if (sp) {
      for (const d of DIRS) {
        const nx = sp.x + d.x, ny = sp.y + d.y;
        if (this.world.isWalkable(nx, ny)) return { x: nx, y: ny };
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.world.isWalkable(x, y)) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  }

  // ---- customer spawning / queueing ----

  trySpawnGroup() {
    if (!this.isOpen) return;
    const groupSize = 1 + Math.floor(Math.random() * 6);
    let freeSeats = this.world.chairsForTables().filter(ct => !ct.chair.occupied && !ct.table.dirty);
    let waitingCount = this.world.customers.filter(c => c.state === 'waitingInLine').length;
    for (let i = 0; i < groupSize; i++) {
      if (freeSeats.length > 0) {
        const idx = Math.floor(Math.random() * freeSeats.length);
        const seat = freeSeats.splice(idx, 1)[0];
        this.spawnSeatedCustomer(seat);
      } else if (waitingCount < MAX_QUEUE) {
        this.spawnWaitingCustomer(waitingCount);
        waitingCount++;
      } else {
        break;
      }
    }
  }

  spawnSeatedCustomer(seat) {
    const entrance = this.world.randomEntranceCell();
    const path = this.world.pathToAdjacent(entrance.x, entrance.y, seat.chair.x, seat.chair.y);
    if (!path) return;
    const c = new Customer(entrance.x, entrance.y);
    c.chair = seat.chair;
    c.table = seat.table;
    seat.chair.occupied = c;
    c.setPath(path);
    this.world.customers.push(c);
  }

  spawnWaitingCustomer(queueIndex) {
    const entrance = this.world.randomEntranceCell();
    const spot = this.world.queueSpot(queueIndex);
    const path = this.world.pathTo(entrance.x, entrance.y, spot.x, spot.y);
    const c = new Customer(entrance.x, entrance.y);
    c.state = 'waitingInLine';
    c.queueSlot = queueIndex;
    c.setPath(path || []);
    this.world.customers.push(c);
  }

  promoteWaitingCustomers() {
    const waiting = this.world.customers.filter(c => c.state === 'waitingInLine').sort((a, b) => a.queueSlot - b.queueSlot);
    if (waiting.length === 0) return;
    const freeSeats = this.world.chairsForTables().filter(ct => !ct.chair.occupied && !ct.table.dirty);
    let promoted = false;
    for (const seat of freeSeats) {
      if (waiting.length === 0) break;
      const cust = waiting.shift();
      seat.chair.occupied = cust;
      cust.chair = seat.chair;
      cust.table = seat.table;
      cust.queueSlot = null;
      cust.state = 'walkingToSeat';
      const path = this.world.pathToAdjacent(cust.gx, cust.gy, seat.chair.x, seat.chair.y);
      cust.setPath(path || []);
      promoted = true;
    }
    if (promoted) this.reflowQueue();
  }

  reflowQueue() {
    const waiting = this.world.customers.filter(c => c.state === 'waitingInLine').sort((a, b) => a.queueSlot - b.queueSlot);
    waiting.forEach((c, i) => {
      if (c.queueSlot !== i) {
        c.queueSlot = i;
        const spot = this.world.queueSpot(i);
        const path = this.world.pathTo(c.gx, c.gy, spot.x, spot.y);
        c.setPath(path || []);
      }
    });
  }

  // ---- player interaction ----

  interact() {
    const world = this.world;
    const player = this.player;
    const cx = player.cellX, cy = player.cellY;
    for (const d of DIRS) {
      const obj = world.cellAt(cx + d.x, cy + d.y);
      if (!obj) continue;
      if (SINGLE_SIDE_TYPES.has(obj.type) && OPPOSITE_DIR[d.name] !== obj.side) continue;
      if (this.tryInteractWith(obj)) return;
    }
  }

  tryInteractWith(obj) {
    const world = this.world;
    const player = this.player;

    if (obj.type === 'chair' && obj.occupied) {
      const customer = obj.occupied;
      if (customer.state === 'waitingOrder' && !player.carrying) {
        const stand = world.findObjects('orderStand')[0];
        if (!stand) return false;
        stand.pending.push({ recipe: customer.order, chair: customer.chair, table: customer.table });
        customer.state = 'waitingFood';
        return true;
      }
      if (customer.state === 'waitingFood' && player.carrying && player.carrying.kind === 'cooked' &&
          player.carrying.chair === customer.chair) {
        customer.state = 'eating';
        customer.timer = EAT_TIME;
        player.carrying = null;
        return true;
      }
      return false;
    }

    if (obj.type === 'payingBooth' && obj.collected > 0) {
      this.addMoney(obj.collected);
      obj.collected = 0;
      return true;
    }

    if (obj.type === 'fridge') {
      if (!player.carrying) {
        const stand = world.findObjects('orderStand').find(s => s.pending.length > 0);
        if (!stand) return false;
        const order = stand.pending.shift();
        player.carrying = { kind: 'ingredient', recipe: order.recipe, chair: order.chair, table: order.table };
        return true;
      }
      if (player.carrying.kind === 'ingredient') {
        const stand = world.findObjects('orderStand')[0];
        if (stand) {
          stand.pending.unshift({ recipe: player.carrying.recipe, chair: player.carrying.chair, table: player.carrying.table });
        }
        player.carrying = null;
        return true;
      }
      return false;
    }

    if (obj.type === 'stove') {
      if (player.carrying && player.carrying.kind === 'ingredient' && !obj.cooking && !obj.ready && !obj.reservedBy) {
        obj.cooking = true;
        obj.recipe = player.carrying.recipe;
        obj.progress = 0;
        obj.reservedBy = 'player';
        obj.orderChair = player.carrying.chair;
        obj.orderTable = player.carrying.table;
        player.carrying = null;
        return true;
      }
      if (!player.carrying && obj.ready) {
        player.carrying = { kind: 'cooked', recipe: obj.recipe, chair: obj.orderChair, table: obj.orderTable };
        obj.ready = false;
        obj.recipe = null;
        obj.reservedBy = null;
        obj.orderChair = null;
        obj.orderTable = null;
        return true;
      }
      if (player.carrying && player.carrying.kind === 'cooked' && !obj.cooking && !obj.ready && !obj.reservedBy) {
        obj.ready = true;
        obj.recipe = player.carrying.recipe;
        obj.orderChair = player.carrying.chair;
        obj.orderTable = player.carrying.table;
        obj.reservedBy = 'player';
        player.carrying = null;
        return true;
      }
      return false;
    }

    if (obj.type === 'orderStand') {
      if (player.carrying && player.carrying.kind === 'cooked') {
        obj.ready.push({ recipe: player.carrying.recipe, chair: player.carrying.chair, table: player.carrying.table, claimedBy: null });
        player.carrying = null;
        return true;
      }
      if (!player.carrying && obj.ready.length) {
        const dish = obj.ready.shift();
        player.carrying = { kind: 'cooked', recipe: dish.recipe, chair: dish.chair, table: dish.table };
        return true;
      }
      return false;
    }

    if (obj.type === 'table' && obj.dirty && !player.carrying) {
      obj.dirty = false;
      obj.claimedDirty = false;
      player.carrying = { kind: 'dirty' };
      return true;
    }

    if (obj.type === 'sink' && player.carrying && player.carrying.kind === 'dirty') {
      player.carrying = null;
      return true;
    }

    return false;
  }

  update(dt) {
    this.player.update(dt, this.world, this.keys);

    for (const stove of this.world.findObjects('stove')) {
      if (stove.cooking) {
        const recipe = getRecipe(stove.recipe);
        stove.progress += dt;
        if (recipe && stove.progress >= recipe.cookTime) {
          stove.cooking = false;
          stove.ready = true;
        }
      }
    }

    for (const s of this.staff) s.update(dt, this.world, this);

    for (const c of this.world.customers) c.update(dt, this.world, this);
    this.world.customers = this.world.customers.filter(c => c.state !== 'done');

    this.promoteWaitingCustomers();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.trySpawnGroup();
      this.spawnTimer = 6000 + Math.random() * 6000;
    }
  }
}

// ---------- boilerplate: canvas, input, loop, rendering ----------

const canvas = document.getElementById('gameCanvas');
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;
const ctx = canvas.getContext('2d');

const game = new Game();
initUI(game);

function canvasCellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  return { gx: Math.floor(mx / CELL), gy: Math.floor(my / CELL) };
}

document.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') e.target.blur();
});

window.addEventListener('keydown', (e) => {
  const tag = document.activeElement && document.activeElement.tagName;
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(k)) {
    game.keys.add(k);
  } else if (k === ' ') {
    e.preventDefault();
    if (!e.repeat) game.interact();
  } else if (k === 'e') {
    game.toggleMenu();
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd'].includes(k)) game.keys.delete(k);
});

canvas.addEventListener('mousemove', (e) => {
  const { gx, gy } = canvasCellFromEvent(e);
  game.hoverCell = game.world.inBounds(gx, gy) ? { x: gx, y: gy } : null;
});
canvas.addEventListener('mouseleave', () => { game.hoverCell = null; });

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (game.heldObject) return;
  const { gx, gy } = canvasCellFromEvent(e);
  const obj = game.world.cellAt(gx, gy);
  if (!obj) { hideContextMenu(); return; }
  game.contextTarget = obj;
  showContextMenu(game, obj, e.clientX, e.clientY);
});

document.addEventListener('click', (e) => {
  const menu = document.getElementById('contextMenu');
  if (menu.classList.contains('hidden')) return;
  if (!menu.contains(e.target)) hideContextMenu();
});

document.getElementById('ctxMove').addEventListener('click', () => { if (game.contextTarget) game.relocateObject(game.contextTarget); });
document.getElementById('ctxRotate').addEventListener('click', () => { if (game.contextTarget) game.rotateObject(game.contextTarget); });
document.getElementById('ctxStore').addEventListener('click', () => { if (game.contextTarget) game.storeObject(game.contextTarget); });
document.getElementById('ctxSell').addEventListener('click', () => { if (game.contextTarget) game.sellObject(game.contextTarget); });

canvas.addEventListener('click', (e) => {
  if (!document.getElementById('contextMenu').classList.contains('hidden')) return;
  if (!game.heldObject) return;
  const { gx, gy } = canvasCellFromEvent(e);
  if (!game.world.inBounds(gx, gy)) return;
  if (game.world.isBuildable(gx, gy)) {
    game.world.place(game.heldObject, gx, gy);
    game.heldObject = null;
    updateHoldingUI(game);
    refreshObjectsTab(game);
  }
});

const OBJECT_STYLE = {
  fridge:      { color: '#bfe3ea', icon: '🧊' },
  stove:       { color: '#e0a678', icon: '🔥' },
  orderStand:  { color: '#d8c98a', icon: '🧾' },
  sink:        { color: '#a9c9d8', icon: '🚰' },
  payingBooth: { color: '#f2d675', icon: '💳' },
  table:       { color: '#8a6b3f', icon: '🍽️' },
  chair:       { color: '#6b5a3f', icon: '🪑' },
  wall:        { color: '#3a332a', icon: '🧱' },
  spawnPoint:  { color: '#9c9c9c', icon: '👤' },
};
const ROLE_COLOR = { waiter: '#3fae55', chef: '#f5f5f5', cleaner: '#1a1a1a' };
const ROLE_OUTLINE = { waiter: '#245c30', chef: '#999999', cleaner: '#666666' };
const PLAYER_COLOR = '#3f7fff';
const PLAYER_OUTLINE = '#1f3f99';
const CUSTOMER_COLOR = '#9e9e9e';
const CUSTOMER_OUTLINE = '#5a5a5a';

function drawGrid() {
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, ROWS * CELL);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(COLS * CELL, y * CELL);
    ctx.stroke();
  }
}

// unowned lots are simply not revealed yet — no padlocks, no fog, just hidden
function drawUnrevealedLots() {
  ctx.fillStyle = '#5b4f3a';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (game.world.lots[row][col]) continue;
      ctx.fillRect(col * LOT_SIZE * CELL, row * LOT_SIZE * CELL, LOT_SIZE * CELL, LOT_SIZE * CELL);
    }
  }
  // re-reveal always-accessible cells (e.g. the queue strip) that happen to sit in an unowned lot
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < MAX_QUEUE; i++) {
    const q = game.world.queueSpot(i);
    const { col, row } = game.world.lotOf(q.x, q.y);
    if (game.world.lotOwned(col, row)) continue;
    ctx.strokeRect(q.x * CELL, q.y * CELL, CELL, CELL);
  }
}

function drawReservedTint() {
  ctx.fillStyle = 'rgba(120, 200, 120, 0.25)';
  for (const e of game.world.entranceCells) ctx.fillRect(e.x * CELL, e.y * CELL, CELL, CELL);
  ctx.fillStyle = 'rgba(210, 200, 130, 0.18)';
  for (let i = 0; i < MAX_QUEUE; i++) {
    const q = game.world.queueSpot(i);
    ctx.fillRect(q.x * CELL, q.y * CELL, CELL, CELL);
  }
}

function drawObject(obj) {
  const style = OBJECT_STYLE[obj.type];
  const px = obj.x * CELL, py = obj.y * CELL;
  ctx.fillStyle = style.color;
  roundRect(px + 2, py + 2, CELL - 4, CELL - 4, 5);
  ctx.fill();
  ctx.font = Math.floor(CELL * 0.6) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.icon, px + CELL / 2, py + CELL / 2);

  if (obj.type === 'stove' && (obj.cooking || obj.ready)) {
    const recipe = getRecipe(obj.recipe);
    const pct = obj.ready ? 1 : Math.min(1, obj.progress / (recipe ? recipe.cookTime : 1));
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 3, py + CELL - 7, CELL - 6, 4);
    ctx.fillStyle = obj.ready ? '#6fce6f' : '#ffd76b';
    ctx.fillRect(px + 3, py + CELL - 7, (CELL - 6) * pct, 4);
    if (obj.ready) {
      ctx.font = '10px sans-serif';
      ctx.fillText('✅', px + CELL - 7, py + 7);
    }
  }

  if (obj.type === 'orderStand') {
    if (obj.pending.length > 0) badge(px + 8, py + 7, obj.pending.length, '#e05252');
    if (obj.ready.length > 0) badge(px + CELL - 8, py + 7, obj.ready.length, '#4caf50');
  }

  if (obj.type === 'table' && obj.dirty) {
    ctx.font = '11px sans-serif';
    ctx.fillText('🍴', px + CELL / 2, py + 9);
  }

  if (obj.type === 'payingBooth' && obj.collected > 0) {
    badge(px + CELL - 8, py + 7, '$' + obj.collected, '#2e7d32');
  }

  if (SINGLE_SIDE_TYPES.has(obj.type)) drawSideIndicator(px, py, obj.side);
}

function drawSideIndicator(px, py, side) {
  const cx = px + CELL / 2, cy = py + CELL / 2;
  const points = {
    up:    [[cx - 5, py + 4], [cx + 5, py + 4], [cx, py - 3]],
    down:  [[cx - 5, py + CELL - 4], [cx + 5, py + CELL - 4], [cx, py + CELL + 3]],
    left:  [[px + 4, cy - 5], [px + 4, cy + 5], [px - 3, cy]],
    right: [[px + CELL - 4, cy - 5], [px + CELL - 4, cy + 5], [px + CELL + 3, cy]],
  };
  const tri = points[side];
  if (!tri) return;
  ctx.beginPath();
  ctx.moveTo(tri[0][0], tri[0][1]);
  ctx.lineTo(tri[1][0], tri[1][1]);
  ctx.lineTo(tri[2][0], tri[2][1]);
  ctx.closePath();
  ctx.fillStyle = '#ffd76b';
  ctx.fill();
}

function badge(x, y, num, color) {
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(num), x, y + 1);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarried(px, py, carrying) {
  if (!carrying) return;
  const icons = { ingredient: '🥕', cooked: '🍚', dirty: '🍴' };
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icons[carrying.kind] || '?', px, py - 15);
}

function drawCharacter(px, py, color, outline, carrying, label) {
  ctx.beginPath();
  ctx.arc(px, py, 10, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = outline;
  ctx.stroke();
  drawCarried(px, py, carrying);
  if (label) {
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, px, py + 16);
  }
}

function drawCustomer(c) {
  let bubble = null;
  if (c.state === 'thinking' || c.state === 'waitingOrder') bubble = '❗';
  else if (c.state === 'waitingFood') bubble = '⏳';
  drawCharacter(c.px, c.py, CUSTOMER_COLOR, CUSTOMER_OUTLINE, null);
  if (c.state === 'waitingInLine') {
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#dfe6ee';
    ctx.fillText('#' + (c.queueSlot + 1), c.px, c.py - 15);
  } else if (bubble) {
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = bubble === '❗' ? '#ffd76b' : '#dfe6ee';
    ctx.fillText(bubble, c.px, c.py - 16);
  }
}

function drawHeldPreview() {
  if (!game.heldObject || !game.hoverCell) return;
  const { x, y } = game.hoverCell;
  const valid = game.world.isBuildable(x, y);
  const style = OBJECT_STYLE[game.heldObject.type] || { color: '#888', icon: '❔' };
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = valid ? style.color : '#e05252';
  roundRect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4, 5);
  ctx.fill();
  ctx.font = Math.floor(CELL * 0.6) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.icon, x * CELL + CELL / 2, y * CELL + CELL / 2);
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawUnrevealedLots();
  drawReservedTint();
  for (const obj of game.world.objects) drawObject(obj);

  const drawables = [
    { py: game.player.py, draw: () => drawCharacter(game.player.px, game.player.py, PLAYER_COLOR, PLAYER_OUTLINE, game.player.carrying) },
    ...game.world.customers.map(c => ({ py: c.py, draw: () => drawCustomer(c) })),
    ...game.staff.map(s => ({ py: s.py, draw: () => drawCharacter(s.px, s.py, ROLE_COLOR[s.role], ROLE_OUTLINE[s.role], s.carrying, s.role) })),
  ];
  drawables.sort((a, b) => a.py - b.py);
  for (const d of drawables) d.draw();

  drawHeldPreview();
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  game.update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

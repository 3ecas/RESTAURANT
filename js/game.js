// Main game: setup, input, buy/place/move/store/sell, land expansion, loop, rendering

const ROTATE_ORDER = ['up', 'right', 'down', 'left'];
const MAX_WAITING = 6; // most customers that can stand at the door waiting for a seat

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
    this.staffUIRefresh = 0; // throttles the staff table redraw while training counts down
    this.ordersUIRefresh = 0; // throttles the orders panel redraw
    this.ingredients = { wheat: 0, shrimp: 0 }; // ingredient stock, consumed by recipes that need them — starts empty, so only rice (which needs nothing) is ever ordered until you have some

    this.setupLevel();
    this.player = new Player(8, 10);
  }

  // recipes with no `ingredient` are always cookable (e.g. plain rice)
  canCookRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe || !recipe.ingredient) return true;
    return (this.ingredients[recipe.ingredient] || 0) > 0;
  }

  consumeIngredient(recipeId) {
    const recipe = getRecipe(recipeId);
    if (recipe && recipe.ingredient) this.ingredients[recipe.ingredient]--;
  }

  refundIngredient(recipeId) {
    const recipe = getRecipe(recipeId);
    if (recipe && recipe.ingredient) this.ingredients[recipe.ingredient]++;
  }

  setupLevel() {
    const w = this.world;
    // only the structural bits are pre-placed — everything else starts in storage
    // so the player builds their own layout from scratch
    w.place(createObject('door'), 9, 13);
    w.place(createObject('spawnPoint'), 7, 7);
    w.generateWater(15);

    this.inventory.push(
      createObject('fridge'),
      createObject('prepStation'),
      createObject('stove'),
      createObject('orderStand'),
      createObject('sink'),
      createObject('payingBooth'),
      createObject('table'),
      createObject('chair'),
      createObject('chair')
    );
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
    refreshObjectsTab(this);
  }

  relocateObject(obj) {
    hideContextMenu();
    if (this.heldObject || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.heldObject = obj;
    this.closeMenu();
    refreshObjectsTab(this);
  }

  storeObject(obj) {
    hideContextMenu();
    if (obj.type === 'door' || !this.canRemoveObject(obj)) return;
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
    if (obj.type === 'farmPlot' && obj.planted) return false;
    return true;
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
    renderStaffPanels(this);
  }

  fireStaff(id) {
    const s = this.staff.find(s => s.id === id);
    if (s && s.task && s.task.stove) s.task.stove.reservedBy = null;
    this.staff = this.staff.filter(s => s.id !== id);
    renderStaffTable(this);
    renderStaffPanels(this);
  }

  trainStaff(id) {
    const s = this.staff.find(s => s.id === id);
    if (!s || s.training || s.level >= STAFF_MAX_LEVEL) return;
    const cost = staffTrainCost(s.level);
    if (this.money < cost) return;
    this.addMoney(-cost);
    const time = staffTrainTime(s.level);
    s.training = { remaining: time, total: time };
    renderStaffTable(this);
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

  // ---- customer spawning ----

  trySpawnGroup() {
    if (!this.isOpen) return;
    if (!this.world.door) return; // door is mid-move, nowhere for customers to appear
    const groupSize = 1 + Math.floor(Math.random() * 6);
    let freeSeats = this.world.chairsForTables().filter(ct => !ct.chair.occupied && !ct.table.dirty);
    let waitingCount = this.world.customers.filter(c => c.state === 'waitingAtDoor').length;
    for (let i = 0; i < groupSize; i++) {
      if (freeSeats.length > 0) {
        const idx = Math.floor(Math.random() * freeSeats.length);
        const seat = freeSeats.splice(idx, 1)[0];
        this.spawnSeatedCustomer(seat);
      } else if (waitingCount < MAX_WAITING) {
        this.spawnWaitingCustomer();
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

  // no line-up: the customer just stands at the door until a seat opens up
  spawnWaitingCustomer() {
    const entrance = this.world.randomEntranceCell();
    const c = new Customer(entrance.x, entrance.y);
    c.state = 'waitingAtDoor';
    this.world.customers.push(c);
  }

  promoteWaitingCustomers() {
    const waiting = this.world.customers.filter(c => c.state === 'waitingAtDoor').sort((a, b) => a.id - b.id);
    if (waiting.length === 0) return;
    const freeSeats = this.world.chairsForTables().filter(ct => !ct.chair.occupied && !ct.table.dirty);
    for (const seat of freeSeats) {
      if (waiting.length === 0) break;
      const cust = waiting.shift();
      seat.chair.occupied = cust;
      cust.chair = seat.chair;
      cust.table = seat.table;
      cust.state = 'walkingToSeat';
      const path = this.world.pathToAdjacent(cust.gx, cust.gy, seat.chair.x, seat.chair.y);
      cust.setPath(path || []);
    }
  }

  // ---- player interaction ----

  interact() {
    const world = this.world;
    const player = this.player;
    const cx = player.cellX, cy = player.cellY;
    // touching the object's own cell (e.g. standing on a walkthrough chair) counts as contact too
    const here = world.cellAt(cx, cy);
    if (here && this.tryInteractWith(here)) return;
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

    if (obj.type === 'chair' || obj.type === 'table') {
      const table = obj.type === 'table' ? obj : world.tableOfChair(obj);
      if (!table) return false;
      if (this.serveTable(table)) return true;
      if (obj.type === 'table' && obj.dirty && !player.carrying) {
        obj.dirty = false;
        obj.claimedDirty = false;
        player.carrying = { kind: 'dirty' };
        return true;
      }
      return false;
    }

    if (obj.type === 'payingBooth' && obj.collected > 0) {
      this.addMoney(obj.collected);
      obj.collected = 0;
      return true;
    }

    if (obj.type === 'farmPlot') {
      if (!obj.planted) {
        obj.planted = true;
        obj.progress = 0;
        obj.ready = false;
        return true;
      }
      if (obj.ready) {
        obj.ready = false;
        obj.planted = false;
        obj.progress = 0;
        this.ingredients.wheat = (this.ingredients.wheat || 0) + 1;
        return true;
      }
      return false;
    }

    if (obj.type === 'prepStation') {
      if (!player.carrying) {
        const stand = world.findObjects('orderStand').find(s => s.pending.some(o => getRecipe(o.recipe).needsPrep && this.canCookRecipe(o.recipe)));
        if (!stand) return false;
        const idx = stand.pending.findIndex(o => getRecipe(o.recipe).needsPrep && this.canCookRecipe(o.recipe));
        const order = stand.pending.splice(idx, 1)[0];
        this.consumeIngredient(order.recipe);
        player.carrying = { kind: 'prepped', recipe: order.recipe };
        return true;
      }
      if (player.carrying.kind === 'prepped') {
        const stand = world.findObjects('orderStand')[0];
        if (stand) stand.pending.unshift({ recipe: player.carrying.recipe });
        this.refundIngredient(player.carrying.recipe);
        player.carrying = null;
        return true;
      }
      return false;
    }

    if (obj.type === 'fridge') {
      if (!player.carrying) {
        const stand = world.findObjects('orderStand').find(s => s.pending.some(o => !getRecipe(o.recipe).needsPrep && this.canCookRecipe(o.recipe)));
        if (!stand) return false;
        const idx = stand.pending.findIndex(o => !getRecipe(o.recipe).needsPrep && this.canCookRecipe(o.recipe));
        const order = stand.pending.splice(idx, 1)[0];
        this.consumeIngredient(order.recipe);
        player.carrying = { kind: 'ingredient', recipe: order.recipe };
        return true;
      }
      if (player.carrying.kind === 'prepped') {
        player.carrying = { kind: 'ingredient', recipe: player.carrying.recipe };
        return true;
      }
      if (player.carrying.kind === 'ingredient') {
        const stand = world.findObjects('orderStand')[0];
        if (stand) {
          stand.pending.unshift({ recipe: player.carrying.recipe });
        }
        this.refundIngredient(player.carrying.recipe);
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
        player.carrying = null;
        return true;
      }
      if (!player.carrying && obj.ready) {
        player.carrying = { kind: 'cooked', recipe: obj.recipe };
        obj.ready = false;
        obj.recipe = null;
        obj.reservedBy = null;
        return true;
      }
      if (player.carrying && player.carrying.kind === 'cooked' && !obj.cooking && !obj.ready && !obj.reservedBy) {
        obj.ready = true;
        obj.recipe = player.carrying.recipe;
        obj.reservedBy = 'player';
        player.carrying = null;
        return true;
      }
      return false;
    }

    if (obj.type === 'orderStand') {
      if (player.carrying && player.carrying.kind === 'cooked') {
        obj.ready.push({ recipe: player.carrying.recipe, claimedBy: null });
        player.carrying = null;
        return true;
      }
      if (!player.carrying && obj.ready.length) {
        const dish = obj.ready.shift();
        player.carrying = { kind: 'cooked', recipe: dish.recipe };
        return true;
      }
      return false;
    }

    if (obj.type === 'sink' && player.carrying && player.carrying.kind === 'dirty') {
      player.carrying = null;
      return true;
    }

    return false;
  }

  // one interaction handles the whole table: take every pending order at once, and
  // deliver whatever the player's carrying to any matching customer seated there
  serveTable(table) {
    const world = this.world;
    const player = this.player;
    const chairs = world.chairsOfTable(table);
    let did = false;

    if (!player.carrying) {
      const stand = world.findObjects('orderStand')[0];
      if (stand) {
        for (const chair of chairs) {
          const customer = chair.occupied;
          if (customer && customer.state === 'waitingOrder') {
            stand.pending.push({ recipe: customer.order });
            customer.state = 'waitingFood';
            did = true;
          }
        }
      }
    }

    if (player.carrying && player.carrying.kind === 'cooked') {
      const customer = chairs.map(c => c.occupied).find(c => c && c.state === 'waitingFood' && c.order === player.carrying.recipe);
      if (customer) {
        customer.state = 'eating';
        customer.timer = EAT_TIME;
        player.carrying = null;
        did = true;
      }
    }

    return did;
  }

  update(dt) {
    this.player.update(dt, this.world, this.keys);

    for (const stove of this.world.findObjects('stove')) {
      if (stove.cooking) {
        const recipe = getRecipe(stove.recipe);
        const chef = stove.reservedBy;
        const cookMultiplier = (chef && chef.role === 'chef') ? chef.cookMultiplier : 1;
        stove.progress += dt * cookMultiplier;
        if (recipe && stove.progress >= recipe.cookTime) {
          stove.cooking = false;
          stove.ready = true;
        }
      }
    }

    for (const plot of this.world.findObjects('farmPlot')) {
      if (plot.planted && !plot.ready) {
        plot.progress += dt;
        if (plot.progress >= FARM_GROW_TIME) plot.ready = true;
      }
    }

    for (const s of this.staff) s.update(dt, this.world, this);

    if (this.staff.some(s => s.training)) {
      this.staffUIRefresh -= dt;
      if (this.staffUIRefresh <= 0) {
        this.staffUIRefresh = 500;
        renderStaffTable(this);
      }
    }

    this.ordersUIRefresh -= dt;
    if (this.ordersUIRefresh <= 0) {
      this.ordersUIRefresh = 400;
      renderOrdersPanel(this);
    }

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
  } else if (k === 'escape') {
    cancelHeldObject(game);
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
  const canPlace = game.heldObject.type === 'door'
    ? game.world.canPlaceDoor(gx, gy)
    : game.world.isBuildable(gx, gy);
  if (canPlace) {
    game.world.place(game.heldObject, gx, gy);
    game.heldObject = null;
    refreshObjectsTab(game);
  }
});

const OBJECT_STYLE = {
  fridge:      { color: '#bfe3ea', icon: '🧊' },
  prepStation: { color: '#d9a066', icon: '🔪' },
  stove:       { color: '#e0a678', icon: '🔥' },
  orderStand:  { color: '#d8c98a', icon: '🧾' },
  sink:        { color: '#a9c9d8', icon: '🚰' },
  payingBooth: { color: '#f2d675', icon: '💳' },
  table:       { color: '#8a6b3f', icon: '🍽️' },
  chair:       { color: '#6b5a3f', icon: '🪑' },
  wall:        { color: '#3a332a', icon: '🧱' },
  spawnPoint:  { color: '#9c9c9c', icon: '👤' },
  door:        { color: 'rgba(120, 200, 120, 0.9)', icon: '🚪' },
  farmPlot:    { color: '#6b4f36', icon: '🟫' },
};
const ROLE_COLOR = { waiter: '#3fae55', chef: '#f5f5f5', cleaner: '#1a1a1a', farmer: '#c9a227', rancher: '#8b5e3c', fisherman: '#3f8fae' };
const ROLE_OUTLINE = { waiter: '#245c30', chef: '#999999', cleaner: '#666666', farmer: '#7a621a', rancher: '#5a3c22', fisherman: '#245a70' };
const PLAYER_COLOR = '#3f7fff';
const PLAYER_OUTLINE = '#1f3f99';
const CUSTOMER_COLOR = '#9e9e9e';
const CUSTOMER_OUTLINE = '#5a5a5a';

// one open field, buildable everywhere — just an outline around the whole playable area
function drawGrid() {
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, COLS * CELL - 2, ROWS * CELL - 2);
}

function drawWater() {
  ctx.fillStyle = '#3a6ea5';
  for (const key of game.world.water) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
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
  const icon = obj.type === 'farmPlot' ? (obj.ready ? '🌾' : obj.planted ? '🌱' : style.icon) : style.icon;
  ctx.fillText(icon, px + CELL / 2, py + CELL / 2);

  if (obj.type === 'farmPlot' && obj.planted && !obj.ready) {
    const pct = Math.min(1, obj.progress / FARM_GROW_TIME);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 3, py + CELL - 7, CELL - 6, 4);
    ctx.fillStyle = '#8bc34a';
    ctx.fillRect(px + 3, py + CELL - 7, (CELL - 6) * pct, 4);
  }
  if (obj.type === 'farmPlot' && obj.ready) {
    ctx.font = Math.round(10 * SCALE) + 'px sans-serif';
    ctx.fillText('✅', px + CELL - 7, py + 7);
  }

  if (obj.type === 'stove' && (obj.cooking || obj.ready)) {
    const recipe = getRecipe(obj.recipe);
    const pct = obj.ready ? 1 : Math.min(1, obj.progress / (recipe ? recipe.cookTime : 1));
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 3, py + CELL - 7, CELL - 6, 4);
    ctx.fillStyle = obj.ready ? '#6fce6f' : '#ffd76b';
    ctx.fillRect(px + 3, py + CELL - 7, (CELL - 6) * pct, 4);
    if (obj.ready) {
      ctx.font = Math.round(10 * SCALE) + 'px sans-serif';
      ctx.fillText('✅', px + CELL - 7, py + 7);
    }
  }

  if (obj.type === 'orderStand') {
    if (obj.pending.length > 0) badge(px + 8, py + 7, obj.pending.length, '#e05252');
    if (obj.ready.length > 0) badge(px + CELL - 8, py + 7, obj.ready.length, '#4caf50');
  }

  // current ingredient stock lives on the fridge, not the HUD
  if (obj.type === 'fridge') {
    badge(px + CELL - 8, py + CELL - 8, game.ingredients.wheat || 0, '#c9a227');
    badge(px + 8, py + CELL - 8, game.ingredients.shrimp || 0, '#6fa8c9');
  }

  if (obj.type === 'table' && obj.dirty) {
    ctx.font = Math.round(11 * SCALE) + 'px sans-serif';
    ctx.fillText('🍴', px + CELL / 2, py + 9);
  }

  if (obj.type === 'payingBooth' && obj.collected > 0) {
    badge(px + CELL - 8, py + 7, '$' + obj.collected, '#2e7d32');
  }

  if (SINGLE_SIDE_TYPES.has(obj.type)) drawSideIndicator(px, py, obj.side);
}

function drawSideIndicator(px, py, side) {
  const cx = px + CELL / 2, cy = py + CELL / 2;
  const a = 5 * SCALE, b = 4 * SCALE, c = 3 * SCALE;
  const points = {
    up:    [[cx - a, py + b], [cx + a, py + b], [cx, py - c]],
    down:  [[cx - a, py + CELL - b], [cx + a, py + CELL - b], [cx, py + CELL + c]],
    left:  [[px + b, cy - a], [px + b, cy + a], [px - c, cy]],
    right: [[px + CELL - b, cy - a], [px + CELL - b, cy + a], [px + CELL + c, cy]],
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
  ctx.arc(x, y, 7 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + Math.round(9 * SCALE) + 'px sans-serif';
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
  const icons = { ingredient: '🥕', cooked: '🍚', dirty: '🍴', wheat: '🌾', prepped: '🔪' };
  const recipe = carrying.recipe ? getRecipe(carrying.recipe) : null;
  const icon = ((carrying.kind === 'cooked' || carrying.kind === 'prepped') && recipe) ? recipe.icon : (icons[carrying.kind] || '?');
  ctx.font = Math.round(12 * SCALE) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, px, py - 15 * SCALE);
  if (carrying.count > 1) badge(px + 9 * SCALE, py - 20 * SCALE, carrying.count, '#3f7fff');
}

function drawCharacter(px, py, color, outline, carrying, label) {
  ctx.beginPath();
  ctx.arc(px, py, 10 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5 * SCALE;
  ctx.strokeStyle = outline;
  ctx.stroke();
  drawCarried(px, py, carrying);
  if (label) {
    ctx.font = Math.round(8 * SCALE) + 'px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, px, py + 16 * SCALE);
  }
}

function drawCustomer(c) {
  let bubble = null;
  if (c.state === 'thinking' || c.state === 'waitingOrder') bubble = '❗';
  else if (c.state === 'waitingFood') bubble = '⏳';
  drawCharacter(c.px, c.py, CUSTOMER_COLOR, CUSTOMER_OUTLINE, null);
  if (bubble) {
    ctx.font = 'bold ' + Math.round(13 * SCALE) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = bubble === '❗' ? '#ffd76b' : '#dfe6ee';
    ctx.fillText(bubble, c.px, c.py - 16 * SCALE);
  }
}

function drawDoor(obj) {
  const style = OBJECT_STYLE.door;
  const px = obj.x * CELL, py = obj.y * CELL;
  ctx.fillStyle = style.color;
  roundRect(px + 2, py + 2, CELL * 2 - 4, CELL - 4, 5);
  ctx.fill();
  ctx.font = Math.floor(CELL * 0.6) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(style.icon, px + CELL, py + CELL / 2);
}

function drawHeldPreview() {
  if (!game.heldObject || !game.hoverCell) return;
  const { x, y } = game.hoverCell;
  const style = OBJECT_STYLE[game.heldObject.type] || { color: '#888', icon: '❔' };
  if (game.heldObject.type === 'door') {
    const valid = game.world.canPlaceDoor(x, y);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = valid ? style.color : '#e05252';
    roundRect(x * CELL + 2, y * CELL + 2, CELL * 2 - 4, CELL - 4, 5);
    ctx.fill();
    ctx.font = Math.floor(CELL * 0.6) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.icon, x * CELL + CELL, y * CELL + CELL / 2);
    ctx.globalAlpha = 1;
    return;
  }
  const valid = game.world.isBuildable(x, y);
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
  drawWater();
  for (const obj of game.world.objects) {
    if (obj.type === 'door') drawDoor(obj); else drawObject(obj);
  }

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

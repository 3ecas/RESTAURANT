// Main game: setup, input, buy/place/move/store/sell, land expansion, loop, rendering

const MAX_WAITING = 6; // most customers that can stand at the door waiting for a seat

class Game {
  constructor() {
    this.world = new World();
    this.money = 0;
    this.staff = [];
    this.inventory = []; // bought/stored objects not currently on the grid
    this.heldObject = null; // the single object currently in-hand, ready to place
    this.heldFromInventory = false; // true while placing from a storage stack — keeps refilling after each placement
    this.contextTarget = null;
    this.hoverCell = null;
    this.menuOpen = false;
    this.keys = new Set();
    this.spawnTimer = 3000;
    this.isOpen = true;
    this.staffUIRefresh = 0; // throttles the staff table redraw while training counts down
    this.wasTraining = false;
    this.ordersUIRefresh = 0; // throttles the orders panel redraw
    this.ingredients = { wheat: 0, shrimp: 0, chicken: 0, tomato: 0 }; // ingredient stock, consumed by recipes that need them — starts empty, so only rice (which needs nothing) is ever ordered until you have some

    this.setupLevel();
    this.player = new Player(8, 10);
  }

  // recipes with no `ingredient` need nothing else; rice (no ingredient) is always
  // cookable — the floor everyone falls back to. cooking never costs money.
  canCookRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return false;
    if (recipe.ingredient && (this.ingredients[recipe.ingredient] || 0) <= 0) return false;
    return true;
  }

  // reserves the ingredient stock the moment a customer decides to order this — so a
  // second customer can't also "order" the last unit of something
  commitRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return;
    if (recipe.ingredient) this.ingredients[recipe.ingredient]--;
  }

  // undoes commitRecipe — used when a customer who already committed to an order leaves
  // without ever eating it (evicted mid-wait, etc.)
  releaseRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return;
    if (recipe.ingredient) this.ingredients[recipe.ingredient]++;
  }

  setupLevel() {
    const w = this.world;
    w.place(createObject('door'), 9, 13);
    w.place(createObject('spawnPoint'), 7, 7);
    w.generateWater(15);

    // a minimal starting kitchen is pre-placed — spread out a bit, except the fridge and
    // stove (kept side by side) and the paying booth (kept right next to the door)
    w.place(createObject('fridge'), 9, 7);
    w.place(createObject('stove'), 10, 7);
    w.place(createObject('orderStand'), 12, 7);
    w.place(createObject('sink'), 14, 7);
    w.place(createObject('payingBooth'), 11, 13);
    w.place(createObject('table'), 9, 10);
    w.place(createObject('chair'), 9, 9);
    w.place(createObject('chair'), 9, 11);
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
    refreshStorageUI(this);
  }

  // picks up one item of this type from storage — the hotbar/expand panel call this.
  // canvas click-to-place keeps refilling from the same stack until it runs out
  beginPlacingType(type) {
    if (this.heldObject) return;
    const idx = this.inventory.findIndex(o => o.type === type);
    if (idx === -1) return;
    this.heldObject = this.inventory.splice(idx, 1)[0];
    this.heldFromInventory = true;
    this.closeMenu();
    refreshStorageUI(this);
  }

  relocateObject(obj) {
    hideContextMenu();
    if (this.heldObject || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.heldObject = obj;
    this.heldFromInventory = false; // relocating one specific object — not a storage stack
    this.closeMenu();
    refreshStorageUI(this);
  }

  storeObject(obj) {
    hideContextMenu();
    if (obj.type === 'door' || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.inventory.push(obj);
    refreshStorageUI(this);
  }

  sellObject(obj) {
    hideContextMenu();
    const def = getItemDef(obj.type);
    if (!def || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.addMoney(Math.floor(def.cost * 0.5));
    refreshStorageUI(this);
  }

  evictCustomersFrom(obj) {
    for (const c of this.world.customers) {
      if (c.chair === obj || c.table === obj) {
        // they'd already committed to this order (reserved its ingredient/cost) but never
        // got to eat it — give that back rather than losing it to a customer who's leaving
        if (c.state === 'waitingOrder' || c.state === 'waitingFood') this.releaseRecipe(c.order);
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
    if (FARM_CROPS.some(c => c.type === obj.type) && obj.ready) return false;
    if (obj.type === 'chicken' && obj.grown) return false;
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
      if (this.tryInteractWith(obj)) return;
    }
  }

  tryInteractWith(obj) {
    const world = this.world;
    const player = this.player;

    if (obj.type === 'chair' || SEATING_SURFACE_TYPES.has(obj.type)) {
      const table = SEATING_SURFACE_TYPES.has(obj.type) ? obj : world.tableOfChair(obj);
      if (!table) return false;
      if (this.serveTable(table)) return true;
      if (SEATING_SURFACE_TYPES.has(obj.type) && obj.dirty && !player.carrying) {
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

    const farmCrop = FARM_CROPS.find(c => c.type === obj.type);
    if (farmCrop) {
      if (!obj.planted) {
        obj.planted = true;
        obj.progress = 0;
        obj.ready = false;
        return true;
      }
      if (obj.ready && !player.carrying) {
        // harvesting doesn't unplant it — it just starts growing the next crop right away.
        // the crop itself still has to be carried to the fridge to count as stock
        obj.ready = false;
        obj.progress = 0;
        player.carrying = { kind: farmCrop.crop };
        return true;
      }
      return false;
    }

    // any fridge works — they all share the same stock. Ingredient/cost was already
    // reserved when the customer ordered, so fetching here is just the physical hand-off
    if (obj.type === 'fridge') {
      if (player.carrying && FARM_CROPS.some(c => c.crop === player.carrying.kind)) {
        const kind = player.carrying.kind;
        this.ingredients[kind] = (this.ingredients[kind] || 0) + 1;
        player.carrying = null;
        return true;
      }
      if (!player.carrying) {
        const stand = world.findObjects('orderStand').find(s => s.pending.length > 0);
        if (!stand) return false;
        const order = stand.pending.shift();
        player.carrying = { kind: 'ingredient', recipe: order.recipe };
        return true;
      }
      if (player.carrying.kind === 'ingredient') {
        const stand = world.findObjects('orderStand')[0];
        if (stand) {
          stand.pending.unshift({ recipe: player.carrying.recipe });
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
      // note: deliberately no "put a cooked dish back on an idle stove" case — the order
      // stand has unlimited capacity, so there's never a real reason to park it here, and
      // doing so used to silently swallow the interact when a stove happened to be checked
      // before a nearby order stand
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

    // taking an order doesn't need a free hand — only a dirty plate or nothing at all
    if (!player.carrying || player.carrying.kind === 'dirty') {
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

    for (const crop of FARM_CROPS) {
      for (const plot of this.world.findObjects(crop.type)) {
        if (plot.planted && !plot.ready) {
          plot.progress += dt;
          if (plot.progress >= FARM_GROW_TIME) plot.ready = true;
        }
      }
    }

    // chickens eat from any feeder that has wheat, a little at a time — not too much, just enough
    for (const chicken of this.world.findObjects('chicken')) {
      if (chicken.grown) continue;
      chicken.hungerCooldown -= dt;
      if (chicken.hungerCooldown > 0) continue;
      const feeder = this.world.findObjects('chickenFeeder').find(f => (f.wheat || 0) > 0);
      if (feeder) {
        feeder.wheat -= 1;
        chicken.fed += 1;
        chicken.hungerCooldown = CHICKEN_EAT_INTERVAL;
        if (chicken.fed >= CHICKEN_FEEDS_TO_GROW) chicken.grown = true;
      } else {
        chicken.hungerCooldown = 500; // no food available right now — check back soon
      }
    }

    for (const s of this.staff) s.update(dt, this.world, this);

    // keep refreshing while anyone is training, plus one guaranteed extra render the moment
    // the last one finishes — otherwise the panel freezes on its last "Xs left" text forever,
    // since the training-in-progress check that gates this block just went false
    const anyTraining = this.staff.some(s => s.training);
    if (anyTraining || this.wasTraining) {
      this.staffUIRefresh -= dt;
      if (this.staffUIRefresh <= 0 || !anyTraining) {
        this.staffUIRefresh = 500;
        renderStaffTable(this);
      }
    }
    this.wasTraining = anyTraining;

    this.ordersUIRefresh -= dt;
    if (this.ordersUIRefresh <= 0) {
      this.ordersUIRefresh = 400;
      renderOrdersPanel(this);
      renderIngredientsBox(this);
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
    const placedType = game.heldObject.type;
    game.world.place(game.heldObject, gx, gy);
    game.heldObject = null;
    // placing from a storage stack? keep going — pull the next one of the same type
    // straight into hand so multiple can be placed without reopening any menu
    if (game.heldFromInventory) {
      const idx = game.inventory.findIndex(o => o.type === placedType);
      if (idx !== -1) game.heldObject = game.inventory.splice(idx, 1)[0];
      else game.heldFromInventory = false;
    }
    refreshStorageUI(game);
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
  door:        { color: 'rgba(120, 200, 120, 0.9)', icon: '🚪' },
  farmPlot:    { color: '#6b4f36', icon: '🟫' },
  tomatoFarm:  { color: '#6b4f36', icon: '🟫' },
  freezer:     { color: '#bcd9e8', icon: '❄️' },
  chicken:      { color: '#f2e2b6', icon: '🐤' },
  chickenFeeder:{ color: '#c9a878', icon: '🥣' },
  animalShack:  { color: '#a67c52', icon: '🛖' },
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
  const farmCrop = FARM_CROPS.find(c => c.type === obj.type);
  let icon = style.icon;
  if (farmCrop) icon = obj.ready ? farmCrop.readyIcon : obj.planted ? '🌱' : style.icon;
  else if (obj.type === 'chicken') icon = obj.grown ? '🐓' : '🐤';
  ctx.fillText(icon, px + CELL / 2, py + CELL / 2);

  if (farmCrop && obj.planted && !obj.ready) {
    const pct = Math.min(1, obj.progress / FARM_GROW_TIME);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 3, py + CELL - 7, CELL - 6, 4);
    ctx.fillStyle = '#8bc34a';
    ctx.fillRect(px + 3, py + CELL - 7, (CELL - 6) * pct, 4);
  }
  if (farmCrop && obj.ready) {
    ctx.font = Math.round(10 * SCALE) + 'px sans-serif';
    ctx.fillText('✅', px + CELL - 7, py + 7);
  }

  if (obj.type === 'chicken' && !obj.grown) {
    const pct = Math.min(1, obj.fed / CHICKEN_FEEDS_TO_GROW);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 3, py + CELL - 7, CELL - 6, 4);
    ctx.fillStyle = '#e0b04a';
    ctx.fillRect(px + 3, py + CELL - 7, (CELL - 6) * pct, 4);
  }
  if (obj.type === 'chicken' && obj.grown) {
    ctx.font = Math.round(10 * SCALE) + 'px sans-serif';
    ctx.fillText('✅', px + CELL - 7, py + 7);
  }
  if (obj.type === 'chickenFeeder') {
    badge(px + CELL - 8, py + 7, obj.wheat || 0, '#c9a227');
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

  if (SEATING_SURFACE_TYPES.has(obj.type) && obj.dirty) {
    ctx.font = Math.round(11 * SCALE) + 'px sans-serif';
    ctx.fillText('🍴', px + CELL / 2, py + 9);
  }

  if (obj.type === 'payingBooth' && obj.collected > 0) {
    badge(px + CELL - 8, py + 7, '$' + obj.collected, '#2e7d32');
  }
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
  const icons = { ingredient: '🥕', cooked: '🍚', dirty: '🍴', wheat: '🌾', tomato: '🍅', raw_fish: '🐟', raw_chicken: '🐤', chicken: '🍗', wheat_feed: '🌾' };
  const recipe = carrying.recipe ? getRecipe(carrying.recipe) : null;
  const icon = (carrying.kind === 'cooked' && recipe) ? recipe.icon : (icons[carrying.kind] || '?');
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
  let isAlert = false;
  if (c.state === 'thinking' || c.state === 'waitingOrder') { bubble = '❗'; isAlert = true; }
  else if (c.state === 'waitingFood') {
    // show what they actually ordered instead of a generic waiting icon
    const recipe = getRecipe(c.order);
    bubble = recipe ? recipe.icon : '⏳';
  }
  drawCharacter(c.px, c.py, CUSTOMER_COLOR, CUSTOMER_OUTLINE, null);
  if (bubble) {
    ctx.font = 'bold ' + Math.round(13 * SCALE) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isAlert ? '#ffd76b' : '#dfe6ee';
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

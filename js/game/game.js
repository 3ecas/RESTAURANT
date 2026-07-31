// The Game class: world/money/inventory state, buy/place/store/sell, staff hire/fire/train,
// customer spawning, and the per-tick simulation update. There's no player character — the
// restaurant runs entirely on hired staff; the only "input" is building/buying/hiring.

import { COLS, ROWS, CELL } from '../core/constants.js';
import { World } from '../core/world.js';
import { getObjectType, createObject, ITEM_DEFS, FARM_CROP_TYPES, ANIMAL_TYPES, STOVE_TYPES } from '../objects/registry.js';
import { tickFarmGrowth } from '../objects/shared/farmCropFactory.js';
import { tickCooking } from '../objects/shared/stoveFactory.js';
import { tickAnimalHunger } from '../objects/shared/ranchAnimalFactory.js';
import { tickWaterTap } from '../objects/waterTap.js';
import { getRecipe, isRecipeUnlocked } from '../data/recipes.js';
import { MAX_WAITING, SHOP_REFRESH_INTERVAL, SPAWN_CYCLE_MS, SPAWN_MIN_PER_CYCLE, SPAWN_MAX_PER_CYCLE } from '../data/balance.js';
import { Customer } from '../entities/customer.js';
import { StaffMember } from '../entities/staffMember.js';
import { FloatingText } from '../entities/floatingText.js';
import { getHireCost, staffTrainCost, staffTrainTime } from './staffEconomy.js';
import { renderPalette } from '../ui/paletteUI.js';
import { refreshStorageUI } from '../ui/hotbarUI.js';
import { renderStaffTable, renderStaffPanels } from '../ui/staffUI.js';
import { renderOrdersPanel } from '../ui/ordersUI.js';
import { renderIngredientsBox } from '../ui/ingredientsUI.js';
import { renderRecipeTable } from '../ui/recipeUI.js';
import { updateMoneyUI } from '../ui/statusUI.js';
import { hideContextMenu } from '../ui/contextMenuUI.js';
import { STAFF_MAX_LEVEL } from '../data/staffConfig.js';
import { checkAchievements } from './achievements.js';
import { renderAchievements } from '../ui/achievementsUI.js';

export class Game {
  constructor() {
    this.world = new World();
    // just enough to hire one chef + one waiter + one cleaner right away (100 each, see
    // staffEconomy.js's getHireCost) — those three are the minimum needed for the
    // restaurant to run itself now that there's no player to fill in manually
    this.money = 300;
    this.staff = []; // hired AND placed — actually working
    this.staffInventory = []; // hired but not yet placed — waiting in the quick bar, see hireStaff/beginPlacingStaff
    this.heldStaff = null; // the role currently in-hand, ready to place (parallel to heldObject)
    this.inventory = []; // bought/stored objects not currently on the grid
    this.heldObject = null; // the single object currently in-hand, ready to place
    this.heldFromInventory = false; // true while placing from a storage stack — keeps refilling after each placement
    this.contextTarget = null;
    this.hoverCell = null;
    this.menuOpen = false;
    this.camera = { x: 0, y: 0 }; // pixel offset of the viewport's top-left within the world; panned via right-mouse-drag (see game/input.js)
    this.viewportW = COLS * CELL; // current canvas size in px — kept in sync by main.js's resize handler (setViewportSize)
    this.viewportH = ROWS * CELL;
    this.startSpawnCycle(); // first batch of arrivals for this minute
    this.isOpen = true;
    this.staffUIRefresh = 0; // throttles the staff table redraw while training counts down
    this.wasTraining = false;
    this.ordersUIRefresh = 0; // throttles the orders panel redraw
    this.ingredients = {
      wheat: 0, shrimp: 0, chicken: 0, tomato: 0, cabbage: 0, corn: 0, potato: 0,
      carrot: 0, onion: 0, pumpkin: 0, salmon: 0, milk: 0,
      cod: 0, tuna: 0, egg: 0, beef: 0, water: 0,
    }; // ingredient stock, consumed by recipes that need them — starts empty, so only rice (which needs nothing) is ever ordered until you have some
    this.shopStock = {}; // how many of each shop item are currently available to buy
    this.shopRefreshTimer = SHOP_REFRESH_INTERVAL;
    this.floatingTexts = []; // transient "+$X" payment popups (see entities/floatingText.js)

    // achievements: sequential deadlines, not experience — see data/achievements.js. Must be
    // set up before refreshShopStock() below, since renderPalette() reads unlockedStoveTiers.
    this.stats = { customersServed: 0, totalRevenue: 0 };
    this.achievementIndex = 0;
    this.completedAchievementIds = [];
    this.unlockedRecipes = new Set(); // recipe ids unlocked via achievement rewards
    this.unlockedStoveTiers = new Set(['stove']); // stove types purchasable in the shop

    this.refreshShopStock();

    this.setupLevel();
  }

  // recipes with no ingredients need nothing else; rice is always cookable — the floor
  // everyone falls back to. cooking never costs money. locked-and-not-yet-unlocked recipes
  // (see data/achievements.js) are never cookable regardless of ingredients on hand.
  canCookRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return false;
    if (!isRecipeUnlocked(this, recipe)) return false;
    return recipe.ingredients.every(ing => (this.ingredients[ing.name] || 0) >= ing.qty);
  }

  // reserves the ingredient stock the moment a customer decides to order this — so a
  // second customer can't also "order" the last unit of something
  commitRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return;
    for (const ing of recipe.ingredients) this.ingredients[ing.name] -= ing.qty;
  }

  // undoes commitRecipe — used when a customer who already committed to an order leaves
  // without ever eating it (evicted mid-wait, etc.)
  releaseRecipe(recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe) return;
    for (const ing of recipe.ingredients) this.ingredients[ing.name] += ing.qty;
  }

  // the shop only ever stocks a handful of each item at a time — restocked randomly
  // (0-3 of each) on a timer, so you can't just buy an unlimited pile of chairs. A type can
  // opt into a fixed restock amount instead (see e.g. objects/floorTile.js) for cheap
  // staples that shouldn't be a bottleneck.
  refreshShopStock() {
    for (const def of ITEM_DEFS) {
      this.shopStock[def.type] = def.fixedStock ?? Math.floor(Math.random() * 4);
    }
    renderPalette(this);
  }

  setupLevel() {
    const w = this.world;

    // a fully enclosed starting room — 10 wide x 6 tall, walled on all sides except a
    // single 1-cell entrance. The top-left interior corner is a black & white tiled kitchen
    // nook holding the core appliances; the rest of the room is wood-floored dining space
    // with a small 3-seat bar along the right wall.
    const ROOM_X = 6, ROOM_Y = 6, ROOM_W = 10, ROOM_H = 6;
    const DOOR_X = ROOM_X + 5, DOOR_Y = ROOM_Y + ROOM_H - 1; // centered on the bottom wall
    const WINDOW_XS = [ROOM_X + 3, ROOM_X + 6]; // two window walls, symmetric along the top wall

    for (let x = ROOM_X; x < ROOM_X + ROOM_W; x++) {
      for (let y = ROOM_Y; y < ROOM_Y + ROOM_H; y++) {
        const onBoundary = x === ROOM_X || x === ROOM_X + ROOM_W - 1 || y === ROOM_Y || y === ROOM_Y + ROOM_H - 1;
        if (!onBoundary) continue;
        if (x === DOOR_X && y === DOOR_Y) w.place(createObject('door'), x, y);
        else if (y === ROOM_Y && WINDOW_XS.includes(x)) w.place(createObject('windowWall'), x, y);
        else w.place(createObject('wall'), x, y);
      }
    }

    // kitchen nook: fridge, stove, sink, order stand on black & white tile
    const KITCHEN_X = ROOM_X + 1, KITCHEN_Y = ROOM_Y + 1, KITCHEN_W = 3, KITCHEN_H = 3;
    for (let x = KITCHEN_X; x < KITCHEN_X + KITCHEN_W; x++) {
      for (let y = KITCHEN_Y; y < KITCHEN_Y + KITCHEN_H; y++) {
        w.placeFloorTile(x, y, 'floorTileBW');
      }
    }
    // one appliance in each corner of the 3x3 nook, leaving the whole middle row + middle
    // column open as a connected walkway — every corner touches 1-2 boundary walls, so
    // packing anything else against its remaining open side(s) would wall it off entirely
    w.place(createObject('fridge'), KITCHEN_X, KITCHEN_Y);
    w.place(createObject('sink'), KITCHEN_X + 2, KITCHEN_Y);
    w.place(createObject('orderStand'), KITCHEN_X, KITCHEN_Y + 2);
    w.place(createObject('stove'), KITCHEN_X + 2, KITCHEN_Y + 2);

    // the rest of the interior: wood floor dining area
    for (let x = ROOM_X + 1; x < ROOM_X + ROOM_W - 1; x++) {
      for (let y = ROOM_Y + 1; y < ROOM_Y + ROOM_H - 1; y++) {
        const inKitchen = x >= KITCHEN_X && x < KITCHEN_X + KITCHEN_W && y >= KITCHEN_Y && y < KITCHEN_Y + KITCHEN_H;
        if (inKitchen) continue;
        w.placeFloorTile(x, y, 'floorTile');
      }
    }

    // a small 3-seat bar along the right interior wall
    const BAR_X = ROOM_X + ROOM_W - 2;
    for (let i = 0; i < 3; i++) {
      const y = ROOM_Y + 2 + i;
      w.place(createObject('counter'), BAR_X, y);
      w.place(createObject('chair'), BAR_X - 1, y);
    }

    w.generateWater(15);
  }

  // called by main.js whenever the canvas is resized (the viewport fills the browser
  // window, capped at the world's own pixel size — see main.js's resizeCanvas)
  setViewportSize(w, h) {
    this.viewportW = w;
    this.viewportH = h;
    this.clampCamera();
  }

  // keeps the camera from ever panning past the world's edges — the world can be bigger
  // than the current viewport (see setViewportSize above), so this is what makes the map
  // border (drawn in render.js) an actual hard boundary rather than just a visual line
  clampCamera() {
    const maxX = Math.max(0, COLS * CELL - this.viewportW);
    const maxY = Math.max(0, ROWS * CELL - this.viewportH);
    this.camera.x = Math.min(Math.max(this.camera.x, 0), maxX);
    this.camera.y = Math.min(Math.max(this.camera.y, 0), maxY);
  }

  addMoney(amount) {
    this.money += amount;
    updateMoneyUI(this);
  }

  spawnFloatingText(x, y, text, color) {
    this.floatingTexts.push(new FloatingText(x, y, text, color));
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
    const def = getObjectType(type);
    if (!def || def.cost == null || this.money < def.cost) return;
    if (def.requiresUnlock && !this.unlockedStoveTiers.has(type)) return;
    if ((this.shopStock[type] || 0) <= 0) return;
    this.shopStock[type]--;
    this.addMoney(-def.cost); // also re-renders the palette, reflecting the new stock count
    this.inventory.push(createObject(type));
    refreshStorageUI(this);
  }

  // picks up one item of this type from storage — the hotbar/expand panel call this.
  // canvas click-to-place keeps refilling from the same stack until it runs out
  beginPlacingType(type) {
    if (this.heldObject || this.heldStaff) return;
    const idx = this.inventory.findIndex(o => o.type === type);
    if (idx === -1) return;
    this.heldObject = this.inventory.splice(idx, 1)[0];
    this.heldFromInventory = true;
    this.closeMenu();
    refreshStorageUI(this);
  }

  relocateObject(obj) {
    hideContextMenu();
    if (this.heldObject || this.heldStaff || !this.canMoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.heldObject = obj;
    this.heldFromInventory = false; // relocating one specific object — not a storage stack
    this.closeMenu();
    refreshStorageUI(this);
  }

  storeObject(obj) {
    hideContextMenu();
    const t = getObjectType(obj.type);
    if ((t && t.storable === false) || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    this.inventory.push(obj);
    refreshStorageUI(this);
  }

  sellObject(obj) {
    hideContextMenu();
    const def = getObjectType(obj.type);
    if (!def || def.cost == null || !this.canRemoveObject(obj)) return;
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

  // gates Store/Sell — both destroy the object, so anything it's currently holding
  // (pending orders, collected cash, a ready crop/chicken) would just be lost. Delegates to
  // the object type's own canRemove hook (default: always removable).
  canRemoveObject(obj) {
    const t = getObjectType(obj.type);
    return t && t.canRemove ? t.canRemove(obj) : true;
  }

  // gates Move — relocating keeps the same object (and everything on/in it), so an order
  // stand's pending orders are safe to carry along. Delegates to the object type's own
  // canMove hook (default: always movable).
  canMoveObject(obj) {
    const t = getObjectType(obj.type);
    return t && t.canMove ? t.canMove(obj) : true;
  }

  // ---- staff ----

  // buys one staff member of this role — they go into the roster waiting to be placed (see
  // the quick bar / beginPlacingStaff below), not straight onto the grid. They don't work,
  // draw, or update until actually placed.
  hireStaff(role) {
    const cost = getHireCost(this, role);
    if (this.money < cost) return;
    this.addMoney(-cost);
    this.staffInventory.push({ role });
    renderStaffPanels(this);
    refreshStorageUI(this);
  }

  // picks up one staff member of this role from the roster waiting to be placed — the
  // quick bar calls this, exactly like beginPlacingType does for furniture
  beginPlacingStaff(role) {
    if (this.heldObject || this.heldStaff) return;
    const idx = this.staffInventory.findIndex(s => s.role === role);
    if (idx === -1) return;
    this.staffInventory.splice(idx, 1);
    this.heldStaff = role;
    this.closeMenu();
    refreshStorageUI(this);
  }

  // drops the held staff member onto the grid at (gx,gy) and puts them to work
  placeHeldStaff(gx, gy) {
    const role = this.heldStaff;
    this.heldStaff = null;
    const s = new StaffMember(gx, gy, role);
    this.staff.push(s);
    renderStaffTable(this);
    renderStaffPanels(this);
    // keep going — pull the next one of the same role straight into hand, same as
    // continuePlacingFromStack does for furniture
    const idx = this.staffInventory.findIndex(x => x.role === role);
    if (idx !== -1) {
      this.staffInventory.splice(idx, 1);
      this.heldStaff = role;
    }
    refreshStorageUI(this);
  }

  fireStaff(id) {
    const s = this.staff.find(s => s.id === id);
    if (s && s.task && s.task.stove && s.task.slotIndex != null) {
      s.task.stove.slots[s.task.slotIndex].reservedBy = null;
    }
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

  // ---- customer spawning ----

  // picks a fresh arrival count (6-16) for the next minute and paces individual arrivals
  // evenly across it — called once at game start and again every time the cycle runs out
  startSpawnCycle() {
    this.spawnCycleMsLeft = SPAWN_CYCLE_MS;
    this.spawnRemaining = SPAWN_MIN_PER_CYCLE + Math.floor(Math.random() * (SPAWN_MAX_PER_CYCLE - SPAWN_MIN_PER_CYCLE + 1));
    this.nextArrivalTimer = this.spawnCycleMsLeft / this.spawnRemaining;
  }

  trySpawnOne() {
    if (!this.isOpen) return;
    if (!this.world.door) return; // door is mid-move, nowhere for customers to appear
    const freeSeats = this.world.chairsForTables().filter(ct => !ct.chair.occupied && !ct.table.dirty);
    if (freeSeats.length > 0) {
      const seat = freeSeats[Math.floor(Math.random() * freeSeats.length)];
      this.spawnSeatedCustomer(seat);
      return;
    }
    const waitingCount = this.world.customers.filter(c => c.state === 'waitingAtDoor').length;
    if (waitingCount < MAX_WAITING) this.spawnWaitingCustomer();
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

  update(dt) {
    for (const t of STOVE_TYPES) {
      for (const stove of this.world.findObjects(t.type)) tickCooking(stove, dt);
    }

    for (const t of FARM_CROP_TYPES) {
      for (const plot of this.world.findObjects(t.type)) tickFarmGrowth(plot, dt);
    }

    for (const t of ANIMAL_TYPES) {
      for (const animal of this.world.findObjects(t.type)) tickAnimalHunger(animal, t, dt, this.world);
    }

    for (const tap of this.world.findObjects('waterTap')) tickWaterTap(tap, dt, this);

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

    this.floatingTexts = this.floatingTexts.filter(f => f.update(dt));

    this.promoteWaitingCustomers();

    // arrivals are paced evenly across the current 1-minute cycle rather than trickling in
    // continuously — a fresh, independently-random count (6-16) starts the moment the
    // minute is up, regardless of whether the previous cycle finished spawning everyone
    this.spawnCycleMsLeft -= dt;
    this.nextArrivalTimer -= dt;
    if (this.nextArrivalTimer <= 0 && this.spawnRemaining > 0) {
      this.trySpawnOne();
      this.spawnRemaining--;
      if (this.spawnRemaining > 0) {
        this.nextArrivalTimer = Math.max(0, this.spawnCycleMsLeft) / this.spawnRemaining;
      }
    }
    if (this.spawnCycleMsLeft <= 0) this.startSpawnCycle();

    this.shopRefreshTimer -= dt;
    if (this.shopRefreshTimer <= 0) {
      this.shopRefreshTimer = SHOP_REFRESH_INTERVAL;
      this.refreshShopStock();
    }

    // a reward can unlock a shop item (stove tier) or a recipe, so both those panels need
    // a fresh render the moment a milestone lands — not just whenever they'd redraw anyway
    if (checkAchievements(this)) {
      renderAchievements(this);
      renderPalette(this);
      renderRecipeTable(this);
    }
  }
}

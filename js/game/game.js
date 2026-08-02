// The Game class: world/money/inventory state, buy/place/store/sell, staff hire/fire/train,
// customer spawning, and the per-tick simulation update. There's no player character — the
// restaurant runs entirely on hired staff; the only "input" is building/buying/hiring.

import { COLS, ROWS, CELL } from '../core/constants.js';
import { World } from '../core/world.js';
import { getObjectType, createObject, ITEM_DEFS, FARM_CROP_TYPES, ANIMAL_TYPES, STOVE_TYPES, SINK_TYPES } from '../objects/registry.js';
import { tickFarmGrowth } from '../objects/shared/farmCropFactory.js';
import { tickCooking } from '../objects/shared/stoveFactory.js';
import { tickAnimalHunger } from '../objects/shared/ranchAnimalFactory.js';
import { tickSinkWater } from '../objects/shared/sinkFactory.js';
import { getRecipe, isRecipeUnlocked } from '../data/recipes.js';
import { MAX_WAITING, SHOP_REFRESH_INTERVAL, SPAWN_CYCLE_MS, SPAWN_MIN_PER_CYCLE, SPAWN_MAX_PER_CYCLE } from '../data/balance.js';
import { Customer } from '../entities/customer.js';
import { StaffMember } from '../entities/staffMember.js';
import { Bee } from '../entities/bee.js';
import { FloatingText } from '../entities/floatingText.js';
import { getHireCost, staffTrainCost, staffTrainTime } from './staffEconomy.js';
import { renderPalette, updateShopRefreshCountdown } from '../ui/paletteUI.js';
import { refreshStorageUI } from '../ui/hotbarUI.js';
import { renderStaffPanels, GATED_ROLES } from '../ui/staffUI.js';
import { renderOrdersPanel } from '../ui/ordersUI.js';
import { renderIngredientsBox } from '../ui/ingredientsUI.js';
import { renderRecipeTable } from '../ui/recipeUI.js';
import { updateMoneyUI, updateXpBarUI } from '../ui/statusUI.js';
import { hideContextMenu } from '../ui/contextMenuUI.js';
import { STAFF_MAX_LEVEL } from '../data/staffConfig.js';
import { checkAchievements } from './achievements.js';
import { renderAchievements } from '../ui/achievementsUI.js';
import { checkLevelUp } from './leveling.js';
import { renderLevels } from '../ui/levelsUI.js';

export class Game {
  constructor() {
    this.world = new World();
    // starting capital for shop purchases and additional hires — the starting kit itself
    // (staff + furniture, see setupLevel) is free and separate from this
    this.money = 300;
    this.staff = []; // hired AND placed — actually working
    this.bees = []; // spawned by beehives (see spawnBeesForHive), free-roaming (entities/bee.js)
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
    this.ordersUIRefresh = 0; // throttles the orders panel + ingredients box + shop countdown redraw
    this.ingredients = {
      wheat: 0, shrimp: 0, chicken: 0, tomato: 0, cabbage: 0, corn: 0, potato: 0,
      carrot: 0, onion: 0, pumpkin: 0, salmon: 0, milk: 0,
      cod: 0, tuna: 0, egg: 0, beef: 0, water: 0, honey: 0,
    }; // ingredient stock, consumed by recipes that need them — starts empty, so only rice (which needs nothing) is ever ordered until you have some
    this.shopStock = {}; // how many of each shop item are currently available to buy
    this.shopRefreshTimer = SHOP_REFRESH_INTERVAL;
    this.floatingTexts = []; // transient "+$X" payment popups (see entities/floatingText.js)

    // achievements: sequential deadlines, cash-only, fully separate from unlocking — see
    // data/achievements.js. Content unlocks come from restaurantLevel instead (see
    // data/levels.js / game/leveling.js), driven by lifetime revenue. Both must be set up
    // before refreshShopStock() below, since renderPalette() reads unlockedObjectTypes.
    this.stats = { customersServed: 0, totalRevenue: 0 };
    this.achievementIndex = 0;
    this.completedAchievementIds = [];
    this.restaurantLevel = 1;
    this.unlockedRecipes = new Set(); // recipe ids unlocked via level-up rewards
    this.unlockedObjectTypes = new Set(); // object types (any category) unlocked via level-up rewards

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

    w.generateWaterPlots(); // 1-3 small fishing ponds along the top of the map

    // nothing pre-placed on the grid — you build your own room from a free starting kit
    // instead (waiting in the quick bar, bottom center): a chef and a waiter ready to place,
    // the 4 core appliances, and enough wall/window/door/table/chairs for a modest first room.
    this.staffInventory.push({ role: 'chef' }, { role: 'waiter' });

    const STARTER_KIT = [
      ['fridge', 1], ['stove', 1], ['sink', 1], ['orderStand', 1],
      ['wall', 30], ['windowWall', 4], ['door', 1], ['table', 1], ['chair', 2],
    ];
    for (const [type, count] of STARTER_KIT) {
      for (let i = 0; i < count; i++) this.inventory.push(createObject(type));
    }
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
    if (def.requiresUnlock && !this.unlockedObjectTypes.has(type)) return;
    if ((this.shopStock[type] || 0) <= 0) return;
    this.shopStock[type]--;
    this.addMoney(-def.cost); // also re-renders the palette, reflecting the new stock count
    this.inventory.push(createObject(type));
    refreshStorageUI(this);
  }

  // called from game/input.js right after a beehive lands on the grid
  spawnBeesForHive(hive) {
    for (let i = 0; i < 5; i++) this.bees.push(new Bee(hive));
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
    if (obj.type === 'beehive') this.bees = this.bees.filter(b => b.hive !== obj);
    this.inventory.push(obj);
    refreshStorageUI(this);
  }

  sellObject(obj) {
    hideContextMenu();
    const def = getObjectType(obj.type);
    if (!def || def.cost == null || !this.canRemoveObject(obj)) return;
    this.evictCustomersFrom(obj);
    this.world.removeAt(obj.x, obj.y);
    if (obj.type === 'beehive') this.bees = this.bees.filter(b => b.hive !== obj);
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

  // called when closing (see ui/ui.js's toggleOpenBtn handler) — anyone still just standing
  // at the door (never got a seat) leaves right away instead of continuing to wait for one
  // that's never coming. Doesn't touch anyone already seated: they haven't been promised
  // anything the closure breaks, so they keep eating/waiting to finish normally — trySpawnOne
  // already refuses new arrivals while closed, so nothing new joins this queue in the meantime.
  evictDoorQueue() {
    for (const c of this.world.customers) {
      if (c.state === 'waitingAtDoor') {
        c.state = 'leaving';
        c.setPath([]); // already standing right at the entrance — nowhere to walk, just go
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
    if (GATED_ROLES.has(role) && !this.unlockedObjectTypes.has(role)) return;
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
    if (s) this.releaseStaffClaims(s);
    this.staff = this.staff.filter(s => s.id !== id);
    renderStaffPanels(this);
  }

  // firing mid-task must let go of whatever that task was holding — otherwise the claim
  // (a stove slot, a ready dish, a customer, a dirty table, a crop/hive plot) points at a
  // staff member that no longer exists and can never be released by anyone else, silently
  // stranding that resource forever (e.g. a stove slot stuck "ready" with no collector left
  // is also permanently non-open, which stops chefs from ever starting a new order on it).
  // Every role's task shape is enumerated here rather than guessed generically, since each
  // one already carries direct references to exactly what it's claimed.
  releaseStaffClaims(s) {
    const t = s.task || {};
    if (t.stove && t.slotIndex != null) {
      const slot = t.stove.slots[t.slotIndex];
      if (slot.reservedBy === s) slot.reservedBy = null;
      if (slot.collectedBy === s) slot.collectedBy = null;
    }
    if (t.plot) t.plot.claimed = false; // farmer: harvest/plant/collectHoney
    if (t.animal) t.animal.claimed = false; // rancher
    if (t.customers) t.customers.forEach(c => { c.claimed = false; }); // waiter: taking an order
    if (t.table) t.table.claimedDirty = false; // waiter: bussing
    if (t.matches) t.matches.forEach(m => { m.dish.claimedBy = null; m.customer.deliveryClaimed = false; }); // waiter: about to pick up
    if (s.carryItems) s.carryItems.forEach(item => { if (item.customer) item.customer.deliveryClaimed = false; }); // waiter: mid-delivery
  }

  trainStaff(id) {
    const s = this.staff.find(s => s.id === id);
    if (!s || s.training || s.level >= STAFF_MAX_LEVEL) return;
    const cost = staffTrainCost(s.level);
    if (this.money < cost) return;
    this.addMoney(-cost);
    const time = staffTrainTime(s.level);
    s.training = { remaining: time, total: time };
    renderStaffPanels(this);
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

    // regen from every placed sink (any tier) shares one cap: the sum of all their capacities
    const allSinks = SINK_TYPES.flatMap(t => this.world.findObjects(t.type));
    const totalSinkCapacity = allSinks.reduce((sum, s) => sum + getObjectType(s.type).capacity, 0);
    for (const sinkObj of allSinks) tickSinkWater(sinkObj, dt, this, totalSinkCapacity);

    for (const b of this.bees) b.update(dt, this.world);

    for (const s of this.staff) s.update(dt, this.world, this);

    // keep refreshing while anyone is training, plus one guaranteed extra render the moment
    // the last one finishes — otherwise the panel freezes on its last "Xs left" text forever,
    // since the training-in-progress check that gates this block just went false
    const anyTraining = this.staff.some(s => s.training);
    if (anyTraining || this.wasTraining) {
      this.staffUIRefresh -= dt;
      if (this.staffUIRefresh <= 0 || !anyTraining) {
        this.staffUIRefresh = 500;
        renderStaffPanels(this);
      }
    }
    this.wasTraining = anyTraining;

    this.ordersUIRefresh -= dt;
    if (this.ordersUIRefresh <= 0) {
      this.ordersUIRefresh = 400;
      renderOrdersPanel(this);
      renderIngredientsBox(this);
      updateShopRefreshCountdown(this);
      updateXpBarUI(this); // ticks up with revenue even between level-ups (see below)
      renderAchievements(this); // same idea — the active achievement's bar ticks up live too
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

    // level-ups are the primary unlock gate now (appliances, recipes) — see data/levels.js /
    // game/leveling.js. A reward can unlock a shop item or a recipe, so both those panels
    // need a fresh render the moment one lands, not just whenever they'd redraw anyway.
    if (checkLevelUp(this)) {
      renderLevels(this);
      renderPalette(this);
      renderRecipeTable(this);
      updateXpBarUI(this); // instant reset to the new level's 0%, not a up-to-400ms-stale bar
    }

    // achievements are a separate, cash-only milestone chain now, fully decoupled from
    // unlocking — the money reward already re-renders everything it touches via
    // addMoney -> updateMoneyUI, so this only needs to refresh its own tab
    if (checkAchievements(this)) {
      renderAchievements(this);
    }
  }
}

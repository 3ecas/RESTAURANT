// The Game class: world/money/inventory state, buy/place/store/sell, staff hire/fire/train,
// customer spawning, player interaction, and the per-tick simulation update.

import { COLS, ROWS, DIRS } from '../core/constants.js';
import { World } from '../core/world.js';
import { getObjectType, createObject, ITEM_DEFS, FARM_CROP_TYPES, ANIMAL_TYPES, STOVE_TYPES } from '../objects/registry.js';
import { tickFarmGrowth } from '../objects/shared/farmCropFactory.js';
import { tickCooking } from '../objects/shared/stoveFactory.js';
import { tickAnimalHunger } from '../objects/shared/ranchAnimalFactory.js';
import { getRecipe, isRecipeUnlocked } from '../data/recipes.js';
import { MAX_WAITING, SHOP_REFRESH_INTERVAL, EAT_TIME, SPAWN_CYCLE_MS, SPAWN_MIN_PER_CYCLE, SPAWN_MAX_PER_CYCLE } from '../data/balance.js';
import { Player } from '../entities/player.js';
import { Customer } from '../entities/customer.js';
import { StaffMember } from '../entities/staffMember.js';
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
    this.money = 50;
    this.staff = [];
    this.inventory = []; // bought/stored objects not currently on the grid
    this.heldObject = null; // the single object currently in-hand, ready to place
    this.heldFromInventory = false; // true while placing from a storage stack — keeps refilling after each placement
    this.contextTarget = null;
    this.hoverCell = null;
    this.menuOpen = false;
    this.keys = new Set();
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

    // achievements: sequential deadlines, not experience — see data/achievements.js. Must be
    // set up before refreshShopStock() below, since renderPalette() reads unlockedStoveTiers.
    this.stats = { customersServed: 0, totalRevenue: 0 };
    this.achievementIndex = 0;
    this.completedAchievementIds = [];
    this.unlockedRecipes = new Set(); // recipe ids unlocked via achievement rewards
    this.unlockedStoveTiers = new Set(['stove']); // stove types purchasable in the shop

    this.refreshShopStock();

    this.setupLevel();
    this.player = new Player(8, 10);
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
    w.place(createObject('door'), 9, 14);
    w.place(createObject('spawnPoint'), 7, 7);
    w.generateWater(15);

    // a minimal starting kitchen is pre-placed — spread out a bit, except the fridge and
    // stove (kept side by side) and the paying booth (kept right next to the door)
    w.place(createObject('fridge'), 9, 7);
    w.place(createObject('stove'), 10, 7);
    w.place(createObject('orderStand'), 12, 7);
    w.place(createObject('sink'), 14, 7);
    w.place(createObject('payingBooth'), 11, 13);
    w.place(createObject('table'), 9, 11);
    w.place(createObject('chair'), 8, 11);
    w.place(createObject('chair'), 10, 11);
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
    if (this.heldObject || !this.canMoveObject(obj)) return;
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
  // stand's pending orders and a paying booth's collected cash are safe to carry along.
  // Delegates to the object type's own canMove hook (default: always movable).
  canMoveObject(obj) {
    const t = getObjectType(obj.type);
    return t && t.canMove ? t.canMove(obj) : true;
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

  // ---- player interaction ----

  interact() {
    const world = this.world;
    const player = this.player;
    const cx = player.cellX, cy = player.cellY;
    // facing/adjacent targets take priority — otherwise standing on a walkable object
    // (a ready farm plot, say) while facing something else (a fridge) would silently
    // hijack the interact into harvesting instead of reaching the thing you meant to use
    for (const d of DIRS) {
      const obj = world.cellAt(cx + d.x, cy + d.y);
      if (!obj) continue;
      if (this.tryInteractWith(obj)) return;
    }
    // nothing adjacent responded — fall back to whatever's directly underfoot
    // (e.g. a walkthrough chair, or a farm plot you're standing on)
    const here = world.cellAt(cx, cy);
    if (here) this.tryInteractWith(here);
  }

  // delegates entirely to the object type's own interact hook (see js/objects/*.js) — Game
  // doesn't know what a fridge or a stove does, just how to ask it to handle an interaction
  tryInteractWith(obj) {
    const t = getObjectType(obj.type);
    if (!t || !t.interact) return false;
    return t.interact(obj, { player: this.player, world: this.world, game: this });
  }

  // one interaction handles the whole table: take every pending order at once, and
  // deliver whatever the player's carrying to any matching customer seated there.
  // Called by chair.js/table.js/wall.js's interact hooks (see shared/seatingInteract.js).
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
    if (this.player.pendingInteractTarget && !this.player.hasPath) {
      this.interact();
      this.player.pendingInteractTarget = null;
    }

    for (const t of STOVE_TYPES) {
      for (const stove of this.world.findObjects(t.type)) tickCooking(stove, dt);
    }

    for (const t of FARM_CROP_TYPES) {
      for (const plot of this.world.findObjects(t.type)) tickFarmGrowth(plot, dt);
    }

    for (const t of ANIMAL_TYPES) {
      for (const animal of this.world.findObjects(t.type)) tickAnimalHunger(animal, t, dt, this.world);
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

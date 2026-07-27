// Recipes, placeable object defs, player, customers, staff

const FARM_GROW_TIME = 20000; // 20s for a planted crop to be ready to harvest

// customers always try the priciest recipe first and work their way down until
// they find one whose ingredient is in stock; rice needs nothing so it's the floor
const RECIPES = [
  { id: 'bread', name: 'Bread', icon: '🍞', cost: 8, price: 12, cookTime: 10000, ingredient: 'wheat', needsPrep: false, enabled: true },
  { id: 'shrimp', name: 'Shrimp', icon: '🦐', cost: 0, price: 9, cookTime: 7000, ingredient: 'shrimp', needsPrep: true, enabled: true },
  { id: 'rice', name: 'Rice', icon: '🍚', cost: 0, price: 5, cookTime: 8000, ingredient: null, needsPrep: false, enabled: true },
];

function getRecipe(id) { return RECIPES.find(r => r.id === id); }

const ITEM_DEFS = [
  { type: 'fridge', name: 'Fridge', icon: '🧊', cost: 20 },
  { type: 'prepStation', name: 'Prep Station', icon: '🔪', cost: 25 },
  { type: 'stove', name: 'Stove', icon: '🔥', cost: 30 },
  { type: 'orderStand', name: 'Order Stand', icon: '🧾', cost: 25 },
  { type: 'sink', name: 'Sink', icon: '🚰', cost: 20 },
  { type: 'payingBooth', name: 'Paying Booth', icon: '💳', cost: 25 },
  { type: 'table', name: 'Table', icon: '🍽️', cost: 15 },
  { type: 'chair', name: 'Chair', icon: '🪑', cost: 25 },
  { type: 'wall', name: 'Counter', icon: '🧱', cost: 5 },
  { type: 'farmPlot', name: 'Farm Plot', icon: '🟫', cost: 20 },
];

function getItemDef(type) { return ITEM_DEFS.find(i => i.type === type); }

let _objId = 1;
function createObject(type) {
  const base = { type, x: 0, y: 0, id: _objId++ };
  switch (type) {
    case 'sink': return Object.assign(base, { washing: false, progress: 0 });
    case 'fridge': return Object.assign(base, { side: 'down' });
    case 'stove': return Object.assign(base, { cooking: false, recipe: null, progress: 0, ready: false, reservedBy: null, side: 'down' });
    case 'orderStand': return Object.assign(base, { pending: [], ready: [] });
    case 'payingBooth': return Object.assign(base, { collected: 0 });
    case 'table': return Object.assign(base, { dirty: false, claimedDirty: false });
    case 'chair': return Object.assign(base, { occupied: null });
    case 'farmPlot': return Object.assign(base, { planted: false, progress: 0, ready: false, claimed: false });
    case 'spawnPoint': return base;
    default: return base;
  }
}

class Mover {
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

class Player {
  constructor(x, y) {
    this.px = x * CELL + CELL / 2;
    this.py = y * CELL + CELL / 2;
    this.facing = 'down';
    this.carrying = null;
    this.speed = 120;
  }
  get cellX() { return Math.floor(this.px / CELL); }
  get cellY() { return Math.floor(this.py / CELL); }
  update(dt, world, keys) {
    let vx = 0, vy = 0;
    if (keys.has('w')) vy -= 1;
    if (keys.has('s')) vy += 1;
    if (keys.has('a')) vx -= 1;
    if (keys.has('d')) vx += 1;
    if (vx === 0 && vy === 0) return;
    const len = Math.hypot(vx, vy);
    vx /= len; vy /= len;
    if (Math.abs(vx) > Math.abs(vy)) this.facing = vx > 0 ? 'right' : 'left';
    else this.facing = vy > 0 ? 'down' : 'up';
    const hw = 10 * SCALE, hh = 10 * SCALE;
    const nx = this.px + vx * this.speed * dt / 1000;
    const ny = this.py + vy * this.speed * dt / 1000;
    if (this._free(world, nx, this.py, hw, hh)) this.px = nx;
    if (this._free(world, this.px, ny, hw, hh)) this.py = ny;
  }
  _free(world, cx, cy, hw, hh) {
    const pts = [[cx - hw, cy - hh], [cx + hw, cy - hh], [cx - hw, cy + hh], [cx + hw, cy + hh]];
    for (const [px, py] of pts) {
      if (px < 0 || py < 0 || px >= COLS * CELL || py >= ROWS * CELL) return false;
      const gx = Math.floor(px / CELL), gy = Math.floor(py / CELL);
      if (!world.isWalkable(gx, gy)) return false;
    }
    return true;
  }
}

let _custId = 1;
const THINK_TIME = 1500;
const EAT_TIME = 4500;

class Customer extends Mover {
  constructor(x, y) {
    super(x, y);
    this.id = _custId++;
    this.state = 'walkingToSeat'; // waitingAtDoor, walkingToSeat, thinking, waitingOrder, waitingFood, eating, walkingToPay, leaving, done
    this.timer = 0;
    this.order = null;
    this.chair = null;
    this.table = null;
    this.claimed = false;
    this.deliveryClaimed = false; // reserved by a waiter who's bringing this exact order
    this.payBooth = null;
    this.speed = 40;
  }

  update(dt, world, game) {
    this.stepMove(dt);
    switch (this.state) {
      case 'waitingAtDoor':
        break; // handled externally by Game's seat promotion
      case 'walkingToSeat':
        if (!this.hasPath) {
          if (this.gx === this.chair.x && this.gy === this.chair.y) {
            this.state = 'thinking';
            this.timer = THINK_TIME;
          } else {
            this.setPath([{ x: this.chair.x, y: this.chair.y }]);
          }
        }
        break;
      case 'thinking':
        this.timer -= dt;
        if (this.timer <= 0) {
          // always reach for the priciest recipe first, falling back to cheaper ones
          // whose ingredient isn't in stock — plain rice needs nothing, so it's the floor
          const enabled = RECIPES.filter(r => r.enabled).sort((a, b) => b.price - a.price);
          const affordable = enabled.find(r => !r.ingredient || (game.ingredients[r.ingredient] || 0) > 0);
          const fallback = enabled[enabled.length - 1] || RECIPES.find(r => r.id === 'rice') || RECIPES[0];
          this.order = (affordable || fallback).id;
          this.state = 'waitingOrder';
          this.claimed = false;
        }
        break;
      case 'waitingOrder':
      case 'waitingFood':
        break;
      case 'eating':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.table.dirty = true;
          this.table.claimedDirty = false;
          this.chair.occupied = null;
          const booth = world.findObjects('payingBooth')[0];
          const boothPath = booth ? world.pathToAdjacent(this.gx, this.gy, booth.x, booth.y) : null;
          if (booth && boothPath) {
            this.payBooth = booth;
            this.state = 'walkingToPay';
            this.setPath(boothPath);
          } else {
            this.state = 'leaving';
            const ec = world.nearestEntranceCell(this.gx, this.gy);
            const path = world.pathTo(this.gx, this.gy, ec.x, ec.y);
            this.setPath(path || []);
          }
        }
        break;
      case 'walkingToPay':
        if (!this.hasPath) {
          const recipe = getRecipe(this.order);
          this.payBooth.collected += recipe.price;
          this.state = 'leaving';
          const ec = world.nearestEntranceCell(this.gx, this.gy);
          const path = world.pathTo(this.gx, this.gy, ec.x, ec.y);
          this.setPath(path || []);
        }
        break;
      case 'leaving':
        if (!this.hasPath) this.state = 'done';
        break;
    }
  }
}

let _staffId = 1;
const NAMES = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Drew', 'Skyler'];
const STAFF_BASE_SPEED = 48;
const STAFF_MAX_LEVEL = 10;
const STAFF_SPEED_PER_LEVEL = 0.05; // +5% movement speed per level
const STAFF_COOK_SPEED_PER_LEVEL = 0.06; // +6% cooking speed per level (chef only)

class StaffMember extends Mover {
  constructor(x, y, role) {
    super(x, y);
    this.id = _staffId++;
    this.role = role; // waiter, chef, cleaner, farmer, rancher, fisherman (rancher/fisherman have no job yet)
    this.name = NAMES[Math.floor(Math.random() * NAMES.length)] + ' #' + this.id;
    this.phase = 'idle';
    this.busyTimer = 0;
    this.task = {};
    this.level = 1;
    this.training = null; // { remaining, total } ms, while leveling up
    this.carryItems = []; // waiter/cleaner: batch of items currently carried
    this.applyLevelStats();
  }

  applyLevelStats() {
    this.speed = STAFF_BASE_SPEED * (1 + STAFF_SPEED_PER_LEVEL * (this.level - 1));
    this.cookMultiplier = 1 + STAFF_COOK_SPEED_PER_LEVEL * (this.level - 1);
  }

  // waiter/cleaner: how many plates they can carry in one trip; farmer has a flat cap
  carryCapacity() {
    if (this.role === 'farmer') return 5;
    if (this.role !== 'waiter' && this.role !== 'cleaner') return 1;
    return Math.ceil(this.level / 2);
  }

  updateCarryVisual() {
    if (this.carryItems.length === 0) { this.carrying = null; return; }
    const first = this.carryItems[0];
    this.carrying = { kind: first.kind, recipe: first.recipe, count: this.carryItems.length };
  }

  update(dt, world, game) {
    if (this.training) {
      this.training.remaining -= dt;
      if (this.training.remaining <= 0) {
        this.level = Math.min(STAFF_MAX_LEVEL, this.level + 1);
        this.applyLevelStats();
        this.training = null;
      }
    }
    this.stepMove(dt);
    if (this.role === 'waiter') this.updateWaiter(dt, world, game);
    else if (this.role === 'chef') this.updateChef(dt, world, game);
    else if (this.role === 'cleaner') this.updateCleaner(dt, world, game);
    else if (this.role === 'farmer') this.updateFarmer(dt, world, game);
  }

  updateWaiter(dt, world, game) {
    if (this.phase === 'idle') {
      const stands = world.findObjects('orderStand');
      for (const stand of stands) {
        // match any ready dish to any customer waiting on that same recipe — no need to
        // deliver back to whoever originally ordered it, and no need to go in order
        const availableDishes = stand.ready.filter(d => !d.claimedBy);
        if (availableDishes.length === 0) continue;
        const matches = [];
        const used = new Set();
        for (const dish of availableDishes) {
          if (matches.length >= this.carryCapacity()) break;
          const customer = world.customers.find(c => c.state === 'waitingFood' && c.order === dish.recipe && !c.deliveryClaimed && !used.has(c));
          if (customer) {
            matches.push({ dish, customer });
            used.add(customer);
          }
        }
        if (matches.length > 0) {
          const path = world.pathToAdjacent(this.gx, this.gy, stand.x, stand.y);
          if (path) {
            matches.forEach(m => { m.dish.claimedBy = this; m.customer.deliveryClaimed = true; });
            this.task = { type: 'deliver', stand, matches };
            this.setPath(path);
            this.phase = 'toStandPickup';
            return;
          }
        }
      }
      const customer = world.customers.find(c => c.state === 'waitingOrder' && !c.claimed);
      if (customer) {
        // take orders from everyone else already ready at the same table too, not just this one seat
        const table = world.tableOfChair(customer.chair);
        const tableCustomers = table
          ? world.chairsOfTable(table).map(c => c.occupied).filter(c => c && c.state === 'waitingOrder' && !c.claimed)
          : [customer];
        const path = world.pathToAdjacent(this.gx, this.gy, customer.chair.x, customer.chair.y);
        if (path) {
          tableCustomers.forEach(c => { c.claimed = true; });
          this.task = { type: 'takeOrder', customers: tableCustomers };
          this.setPath(path);
          this.phase = 'toCustomerOrder';
        }
      }
    } else if (this.phase === 'toStandPickup') {
      if (!this.hasPath) {
        this.carryItems = [];
        for (const m of this.task.matches) {
          const idx = this.task.stand.ready.indexOf(m.dish);
          if (idx !== -1) {
            this.task.stand.ready.splice(idx, 1);
            this.carryItems.push({ kind: 'cooked', recipe: m.dish.recipe, customer: m.customer });
          } else {
            m.customer.deliveryClaimed = false;
          }
        }
        this.updateCarryVisual();
        this.task = {};
        if (this.carryItems.length === 0) {
          this.phase = 'idle';
        } else {
          this.phase = 'toDeliver';
          this._advanceWaiterDelivery(world);
        }
      }
    } else if (this.phase === 'toDeliver') {
      if (!this.hasPath) {
        const item = this.carryItems.shift();
        this.updateCarryVisual();
        if (item) {
          const customer = item.customer;
          customer.deliveryClaimed = false;
          if (customer.state === 'waitingFood' && customer.order === item.recipe) {
            customer.state = 'eating';
            customer.timer = EAT_TIME;
          }
        }
        this._advanceWaiterDelivery(world);
      }
    } else if (this.phase === 'toCustomerOrder') {
      if (!this.hasPath) {
        const stand = world.findObjects('orderStand')[0];
        for (const customer of this.task.customers) {
          if (customer.state === 'waitingOrder') {
            if (stand) stand.pending.push({ recipe: customer.order });
            customer.state = 'waitingFood';
          }
          customer.claimed = false;
        }
        this.task = {};
        this.phase = 'idle';
      }
    }
  }

  // walk the remaining carried batch to the next customer in line, one delivery at a time
  _advanceWaiterDelivery(world) {
    if (this.carryItems.length === 0) {
      this.phase = 'idle';
      return;
    }
    const next = this.carryItems[0];
    const path = world.pathToAdjacent(this.gx, this.gy, next.customer.chair.x, next.customer.chair.y);
    if (path) {
      this.setPath(path);
    } else {
      next.customer.deliveryClaimed = false;
      this.carryItems.shift();
      this.updateCarryVisual();
      this._advanceWaiterDelivery(world);
    }
  }

  updateChef(dt, world, game) {
    if (this.phase === 'idle') {
      const stand = world.findObjects('orderStand').find(s => s.pending.some(o => game.canCookRecipe(o.recipe)));
      if (stand) {
        const idx = stand.pending.findIndex(o => game.canCookRecipe(o.recipe));
        const order = stand.pending[idx];
        const recipe = getRecipe(order.recipe);
        if (recipe) {
          const fridge = world.findObjects('fridge')[0];
          const stove = world.findObjects('stove').find(s => !s.reservedBy);
          const prepStation = recipe.needsPrep ? world.findObjects('prepStation')[0] : null;
          if (fridge && stove && (!recipe.needsPrep || prepStation)) {
            const target = recipe.needsPrep ? prepStation : fridge;
            const path = recipe.needsPrep
              ? world.pathToAdjacent(this.gx, this.gy, target.x, target.y)
              : world.pathToAdjacent(this.gx, this.gy, target.x, target.y, fridge);
            if (path) {
              stand.pending.splice(idx, 1);
              game.consumeIngredient(order.recipe);
              stove.reservedBy = this;
              this.task = { order, recipe, stove };
              this.setPath(path);
              this.phase = recipe.needsPrep ? 'toPrep' : 'toFridge';
            }
          }
        }
      }
    } else if (this.phase === 'toPrep') {
      if (!this.hasPath) {
        this.carrying = { kind: 'prepped', recipe: this.task.recipe.id };
        const fridge = world.findObjects('fridge')[0];
        const path = fridge ? world.pathToAdjacent(this.gx, this.gy, fridge.x, fridge.y, fridge) : null;
        if (path) {
          this.setPath(path);
          this.phase = 'toFridge';
        } else {
          const stand = world.findObjects('orderStand')[0];
          if (stand) stand.pending.unshift(this.task.order);
          game.refundIngredient(this.task.order.recipe);
          this.task.stove.reservedBy = null;
          this.carrying = null;
          this.phase = 'idle';
        }
      }
    } else if (this.phase === 'toFridge') {
      if (!this.hasPath) {
        this.carrying = { kind: 'ingredient', recipe: this.task.recipe.id };
        const stove = this.task.stove;
        const path = world.pathToAdjacent(this.gx, this.gy, stove.x, stove.y, stove);
        if (path) {
          this.setPath(path);
          this.phase = 'toStove';
        } else {
          const stand = world.findObjects('orderStand')[0];
          if (stand) stand.pending.unshift(this.task.order);
          game.refundIngredient(this.task.order.recipe);
          stove.reservedBy = null;
          this.carrying = null;
          this.phase = 'idle';
        }
      }
    } else if (this.phase === 'toStove') {
      if (!this.hasPath) {
        this.carrying = null;
        this.task.stove.cooking = true;
        this.task.stove.recipe = this.task.recipe.id;
        this.task.stove.progress = 0;
        this.phase = 'cooking';
      }
    } else if (this.phase === 'cooking') {
      if (this.task.stove.ready) {
        this.task.stove.ready = false;
        this.task.stove.recipe = null;
        this.carrying = { kind: 'cooked', recipe: this.task.recipe.id };
        const stand = world.findObjects('orderStand')[0];
        const path = world.pathToAdjacent(this.gx, this.gy, stand.x, stand.y);
        this.task.stand = stand;
        this.setPath(path || []);
        this.phase = 'toStand';
      }
    } else if (this.phase === 'toStand') {
      if (!this.hasPath) {
        this.task.stand.ready.push({ recipe: this.task.order.recipe, claimedBy: null });
        this.carrying = null;
        this.task.stove.reservedBy = null;
        this.phase = 'idle';
      }
    }
  }

  updateCleaner(dt, world, game) {
    if (this.phase === 'idle') {
      if (this.carryItems.length >= this.carryCapacity()) {
        this._headToSink(world);
        return;
      }
      const table = world.findObjects('table').find(t => t.dirty && !t.claimedDirty);
      if (table) {
        table.claimedDirty = true;
        this.task = { table };
        const path = world.pathToAdjacent(this.gx, this.gy, table.x, table.y);
        this.setPath(path || []);
        this.phase = 'toTable';
      } else if (this.carryItems.length > 0) {
        this._headToSink(world);
      }
    } else if (this.phase === 'toTable') {
      if (!this.hasPath) {
        if (!this.task.table.dirty) {
          this.task.table.claimedDirty = false;
          this.task = {};
          this.phase = 'idle';
          return;
        }
        this.task.table.dirty = false;
        this.task.table.claimedDirty = false;
        this.carryItems.push({ kind: 'dirty' });
        this.updateCarryVisual();
        this.task = {};
        this.phase = 'idle';
      }
    } else if (this.phase === 'toSink') {
      if (!this.hasPath) {
        this.carryItems = [];
        this.updateCarryVisual();
        this.phase = 'idle';
      }
    }
  }

  _headToSink(world) {
    const sink = world.findObjects('sink')[0];
    if (sink) {
      const path = world.pathToAdjacent(this.gx, this.gy, sink.x, sink.y);
      this.setPath(path || []);
      this.phase = 'toSink';
    } else {
      this.carryItems = [];
      this.updateCarryVisual();
    }
  }

  updateFarmer(dt, world, game) {
    if (this.phase === 'idle') {
      if (this.carryItems.length >= this.carryCapacity()) {
        this._headToFridge(world);
        return;
      }
      const plot = world.findObjects('farmPlot').find(p => p.ready && !p.claimed);
      if (plot) {
        plot.claimed = true;
        this.task = { plot };
        const path = world.pathToAdjacent(this.gx, this.gy, plot.x, plot.y);
        this.setPath(path || []);
        this.phase = 'toPlot';
      } else if (this.carryItems.length > 0) {
        this._headToFridge(world);
      }
    } else if (this.phase === 'toPlot') {
      if (!this.hasPath) {
        if (!this.task.plot.ready) {
          this.task.plot.claimed = false;
          this.task = {};
          this.phase = 'idle';
          return;
        }
        this.task.plot.ready = false;
        this.task.plot.planted = false;
        this.task.plot.progress = 0;
        this.task.plot.claimed = false;
        this.carryItems.push({ kind: 'wheat' });
        this.updateCarryVisual();
        this.task = {};
        this.phase = 'idle';
      }
    } else if (this.phase === 'toFridge') {
      if (!this.hasPath) {
        game.ingredients.wheat = (game.ingredients.wheat || 0) + this.carryItems.length;
        this.carryItems = [];
        this.updateCarryVisual();
        this.phase = 'idle';
      }
    }
  }

  _headToFridge(world) {
    const fridge = world.findObjects('fridge')[0];
    if (fridge) {
      const path = world.pathToAdjacent(this.gx, this.gy, fridge.x, fridge.y, fridge);
      this.setPath(path || []);
      this.phase = 'toFridge';
    } else {
      this.carryItems = [];
      this.updateCarryVisual();
    }
  }
}

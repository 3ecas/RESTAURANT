// Recipes, placeable object defs, player, customers, staff

const RECIPES = [
  { id: 'rice', name: 'Rice', icon: '🍚', cost: 0, price: 5, cookTime: 3000, enabled: true },
];

function getRecipe(id) { return RECIPES.find(r => r.id === id); }

const ITEM_DEFS = [
  { type: 'fridge', name: 'Fridge', icon: '🧊', cost: 20 },
  { type: 'stove', name: 'Stove', icon: '🔥', cost: 30 },
  { type: 'orderStand', name: 'Order Stand', icon: '🧾', cost: 25 },
  { type: 'sink', name: 'Sink', icon: '🚰', cost: 20 },
  { type: 'payingBooth', name: 'Paying Booth', icon: '💳', cost: 25 },
  { type: 'table', name: 'Table', icon: '🍽️', cost: 15 },
  { type: 'chair', name: 'Chair', icon: '🪑', cost: 25 },
  { type: 'wall', name: 'Counter', icon: '🧱', cost: 5 },
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
    const hw = 10, hh = 10;
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
    this.state = 'walkingToSeat'; // waitingInLine, walkingToSeat, thinking, waitingOrder, waitingFood, eating, walkingToPay, leaving, done
    this.timer = 0;
    this.order = null;
    this.chair = null;
    this.table = null;
    this.claimed = false;
    this.payBooth = null;
    this.queueSlot = null;
    this.speed = 40;
  }

  update(dt, world, game) {
    this.stepMove(dt);
    switch (this.state) {
      case 'waitingInLine':
        break; // handled externally by Game's queue promotion/reflow
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
          const enabled = RECIPES.filter(r => r.enabled);
          this.order = (enabled.length ? enabled[Math.floor(Math.random() * enabled.length)] : RECIPES[0]).id;
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

class StaffMember extends Mover {
  constructor(x, y, role) {
    super(x, y);
    this.id = _staffId++;
    this.role = role; // waiter, chef, cleaner
    this.name = NAMES[Math.floor(Math.random() * NAMES.length)] + ' #' + this.id;
    this.phase = 'idle';
    this.busyTimer = 0;
    this.task = {};
    this.speed = 48;
  }

  update(dt, world, game) {
    this.stepMove(dt);
    if (this.role === 'waiter') this.updateWaiter(dt, world, game);
    else if (this.role === 'chef') this.updateChef(dt, world, game);
    else if (this.role === 'cleaner') this.updateCleaner(dt, world, game);
  }

  updateWaiter(dt, world, game) {
    if (this.phase === 'idle') {
      const stands = world.findObjects('orderStand');
      for (const stand of stands) {
        const dish = stand.ready.find(d => !d.claimedBy && d.chair.occupied && d.chair.occupied.state === 'waitingFood');
        if (dish) {
          const path = world.pathToAdjacent(this.gx, this.gy, stand.x, stand.y);
          if (path) {
            dish.claimedBy = this;
            this.task = { type: 'deliver', dish, stand };
            this.setPath(path);
            this.phase = 'toStandPickup';
            return;
          }
        }
      }
      const customer = world.customers.find(c => c.state === 'waitingOrder' && !c.claimed);
      if (customer) {
        const path = world.pathToAdjacent(this.gx, this.gy, customer.chair.x, customer.chair.y);
        if (path) {
          customer.claimed = true;
          this.task = { type: 'takeOrder', customer };
          this.setPath(path);
          this.phase = 'toCustomerOrder';
        }
      }
    } else if (this.phase === 'toStandPickup') {
      if (!this.hasPath) {
        const idx = this.task.stand.ready.indexOf(this.task.dish);
        if (idx === -1) {
          this.task = {};
          this.phase = 'idle';
        } else {
          this.task.stand.ready.splice(idx, 1);
          this.carrying = { kind: 'cooked', recipe: this.task.dish.recipe };
          const target = this.task.dish.chair;
          const path = world.pathToAdjacent(this.gx, this.gy, target.x, target.y);
          this.setPath(path || []);
          this.phase = 'toDeliver';
        }
      }
    } else if (this.phase === 'toDeliver') {
      if (!this.hasPath) {
        const customer = this.task.dish.chair.occupied;
        if (customer && customer.state === 'waitingFood') {
          customer.state = 'eating';
          customer.timer = EAT_TIME;
        }
        this.carrying = null;
        this.phase = 'idle';
      }
    } else if (this.phase === 'toCustomerOrder') {
      if (!this.hasPath) {
        const customer = this.task.customer;
        if (customer.state === 'waitingOrder') {
          const stand = world.findObjects('orderStand')[0];
          if (stand) {
            stand.pending.push({ id: Date.now() + Math.random(), recipe: customer.order, chair: customer.chair, table: customer.table });
            customer.state = 'waitingFood';
            customer.claimed = false;
          }
        }
        this.phase = 'idle';
      }
    }
  }

  updateChef(dt, world, game) {
    if (this.phase === 'idle') {
      const stand = world.findObjects('orderStand').find(s => s.pending.length > 0);
      if (stand) {
        const order = stand.pending[0];
        const recipe = getRecipe(order.recipe);
        if (recipe) {
          const fridge = world.findObjects('fridge')[0];
          const stove = world.findObjects('stove').find(s => !s.reservedBy);
          if (fridge && stove) {
            const path = world.pathToAdjacent(this.gx, this.gy, fridge.x, fridge.y, fridge);
            if (path) {
              stand.pending.shift();
              stove.reservedBy = this;
              this.task = { order, recipe, stove };
              this.setPath(path);
              this.phase = 'toFridge';
            }
          }
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
        this.task.stand.ready.push({ recipe: this.task.order.recipe, chair: this.task.order.chair, table: this.task.order.table, claimedBy: null });
        this.carrying = null;
        this.task.stove.reservedBy = null;
        this.phase = 'idle';
      }
    }
  }

  updateCleaner(dt, world, game) {
    if (this.phase === 'idle') {
      const table = world.findObjects('table').find(t => t.dirty && !t.claimedDirty);
      if (table) {
        table.claimedDirty = true;
        this.task = { table };
        const path = world.pathToAdjacent(this.gx, this.gy, table.x, table.y);
        this.setPath(path || []);
        this.phase = 'toTable';
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
        this.carrying = { kind: 'dirty' };
        const sink = world.findObjects('sink')[0];
        if (sink) {
          const path = world.pathToAdjacent(this.gx, this.gy, sink.x, sink.y);
          this.setPath(path || []);
          this.phase = 'toSink';
        } else {
          this.carrying = null;
          this.phase = 'idle';
        }
      }
    } else if (this.phase === 'toSink') {
      if (!this.hasPath) {
        this.carrying = null;
        this.phase = 'idle';
      }
    }
  }
}

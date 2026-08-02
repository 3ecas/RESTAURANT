// Waiter: takes orders from seated customers, delivers finished dishes from the order stand,
// and buses dirty tables (dropping the batch at a sink) whenever neither of those needs doing —
// there's no separate cleaner role, so this is the lowest-priority fallback job.

import { EAT_TIME } from '../../data/balance.js';
import { SINK_TYPES } from '../../objects/registry.js';

export function updateWaiter(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    const stands = world.findObjects('orderStand');
    for (const stand of stands) {
      // match any ready dish to any customer waiting on that same recipe — no need to
      // deliver back to whoever originally ordered it, and no need to go in order
      const availableDishes = stand.ready.filter(d => !d.claimedBy);
      if (availableDishes.length === 0) continue;
      const matches = [];
      const used = new Set();
      for (const dish of availableDishes) {
        if (matches.length >= staff.carryCapacity()) break;
        const customer = world.customers.find(c => c.state === 'waitingFood' && c.order === dish.recipe && !c.deliveryClaimed && !used.has(c));
        if (customer) {
          matches.push({ dish, customer });
          used.add(customer);
        }
      }
      if (matches.length > 0) {
        const path = world.pathToAdjacent(staff.gx, staff.gy, stand.x, stand.y);
        if (path) {
          matches.forEach(m => { m.dish.claimedBy = staff; m.customer.deliveryClaimed = true; });
          staff.task = { type: 'deliver', stand, matches };
          staff.setPath(path);
          staff.phase = 'toStandPickup';
          return;
        }
      }
    }
    // stands.length check: taking an order with no order stand to send it to would just
    // strand the customer in 'waitingFood' forever — nothing would ever queue for a chef to
    // see. Leave them in 'waitingOrder' (harmless — they just keep waiting) until one exists.
    const customer = stands.length > 0 && world.customers.find(c => c.state === 'waitingOrder' && !c.claimed);
    if (customer) {
      // take orders from everyone else already ready at the same table too, not just this one seat
      const table = world.tableOfChair(customer.chair);
      const tableCustomers = table
        ? world.chairsOfTable(table).map(c => c.occupied).filter(c => c && c.state === 'waitingOrder' && !c.claimed)
        : [customer];
      const path = world.pathToAdjacent(staff.gx, staff.gy, customer.chair.x, customer.chair.y);
      if (path) {
        tableCustomers.forEach(c => { c.claimed = true; });
        staff.task = { type: 'takeOrder', customers: tableCustomers };
        staff.setPath(path);
        staff.phase = 'toCustomerOrder';
        return;
      }
    }
    // lowest priority: nothing to serve or take right now, so bus a dirty table instead —
    // batches up to carryCapacity() before heading to the sink, same shape as the delivery loop above
    if (staff.carryItems.length >= staff.carryCapacity()) {
      _headToSink(staff, world);
      return;
    }
    const dirtyTable = world.seatingSurfaces().find(t => t.dirty && !t.claimedDirty);
    if (dirtyTable) {
      dirtyTable.claimedDirty = true;
      staff.task = { table: dirtyTable };
      const path = world.pathToAdjacent(staff.gx, staff.gy, dirtyTable.x, dirtyTable.y);
      staff.setPath(path || []);
      staff.phase = 'toTable';
    } else if (staff.carryItems.length > 0) {
      _headToSink(staff, world);
    }
  } else if (staff.phase === 'toStandPickup') {
    if (!staff.hasPath) {
      staff.carryItems = [];
      for (const m of staff.task.matches) {
        const idx = staff.task.stand.ready.indexOf(m.dish);
        if (idx !== -1) {
          staff.task.stand.ready.splice(idx, 1);
          staff.carryItems.push({ kind: 'cooked', recipe: m.dish.recipe, customer: m.customer });
        } else {
          m.customer.deliveryClaimed = false;
        }
      }
      staff.updateCarryVisual();
      staff.task = {};
      if (staff.carryItems.length === 0) {
        staff.phase = 'idle';
      } else {
        staff.phase = 'toDeliver';
        _advanceWaiterDelivery(staff, world);
      }
    }
  } else if (staff.phase === 'toDeliver') {
    if (!staff.hasPath) {
      const item = staff.carryItems.shift();
      staff.updateCarryVisual();
      if (item) {
        const customer = item.customer;
        customer.deliveryClaimed = false;
        if (customer.state === 'waitingFood' && customer.order === item.recipe) {
          customer.state = 'eating';
          customer.timer = EAT_TIME;
        }
      }
      _advanceWaiterDelivery(staff, world);
    }
  } else if (staff.phase === 'toCustomerOrder') {
    if (!staff.hasPath) {
      const stand = world.findObjects('orderStand')[0];
      for (const customer of staff.task.customers) {
        if (customer.state === 'waitingOrder') {
          if (stand) stand.pending.push({ recipe: customer.order });
          customer.state = 'waitingFood';
        }
        customer.claimed = false;
      }
      staff.task = {};
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toTable') {
    if (!staff.hasPath) {
      if (!staff.task.table.dirty) {
        // someone else already bused it while this waiter was en route
        staff.task.table.claimedDirty = false;
        staff.task = {};
        staff.phase = 'idle';
        return;
      }
      staff.task.table.dirty = false;
      staff.task.table.claimedDirty = false;
      staff.carryItems.push({ kind: 'dirty' });
      staff.updateCarryVisual();
      staff.task = {};
      staff.phase = 'idle';
    }
  } else if (staff.phase === 'toSink') {
    if (!staff.hasPath) {
      staff.carryItems = [];
      staff.updateCarryVisual();
      staff.phase = 'idle';
    }
  }
}

// walk the remaining carried batch to the next customer in line, one delivery at a time
function _advanceWaiterDelivery(staff, world) {
  if (staff.carryItems.length === 0) {
    staff.phase = 'idle';
    return;
  }
  const next = staff.carryItems[0];
  const path = world.pathToAdjacent(staff.gx, staff.gy, next.customer.chair.x, next.customer.chair.y);
  if (path) {
    staff.setPath(path);
  } else {
    next.customer.deliveryClaimed = false;
    staff.carryItems.shift();
    staff.updateCarryVisual();
    _advanceWaiterDelivery(staff, world);
  }
}

// if there's no sink (or no path to it) yet, just keep carrying and retry next tick —
// never silently destroy what's being carried
function _headToSink(staff, world) {
  for (const sink of SINK_TYPES.flatMap(t => world.findObjects(t.type))) {
    const path = world.pathToAdjacent(staff.gx, staff.gy, sink.x, sink.y);
    if (path) {
      staff.setPath(path);
      staff.phase = 'toSink';
      return;
    }
  }
}

// Cleaner: clears dirty tables/counters, drops the batch off at a sink

export function updateCleaner(staff, dt, world, game) {
  if (staff.phase === 'idle') {
    if (staff.carryItems.length >= staff.carryCapacity()) {
      _headToSink(staff, world);
      return;
    }
    const table = world.seatingSurfaces().find(t => t.dirty && !t.claimedDirty);
    if (table) {
      table.claimedDirty = true;
      staff.task = { table };
      const path = world.pathToAdjacent(staff.gx, staff.gy, table.x, table.y);
      staff.setPath(path || []);
      staff.phase = 'toTable';
    } else if (staff.carryItems.length > 0) {
      _headToSink(staff, world);
    }
  } else if (staff.phase === 'toTable') {
    if (!staff.hasPath) {
      if (!staff.task.table.dirty) {
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

// if there's no sink (or no path to it) yet, just keep carrying and retry next tick —
// never silently destroy what's being carried
function _headToSink(staff, world) {
  const sink = world.findObjects('sink')[0];
  if (!sink) return;
  const path = world.pathToAdjacent(staff.gx, staff.gy, sink.x, sink.y);
  if (!path) return;
  staff.setPath(path);
  staff.phase = 'toSink';
}

// Helpers shared by more than one staff role

// if there's no fridge (or no path to it) yet, just keep the carried cargo and retry next
// tick — never silently destroy what's being carried. Uses nearestReachableObject (not
// nearestObject) so a closer-but-boxed-in fridge never blocks a farther, reachable one.
export function headToFridge(staff, world) {
  const fridge = world.nearestReachableObject('fridge', staff.gx, staff.gy);
  if (!fridge) return;
  const path = world.pathToAdjacent(staff.gx, staff.gy, fridge.x, fridge.y);
  if (!path) return;
  staff.setPath(path);
  staff.phase = 'toFridge';
}

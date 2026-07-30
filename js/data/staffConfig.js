// Staff leveling tables — per-role speed/capacity/work-speed multipliers by level

export const NAMES = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie', 'Drew', 'Skyler'];
export const STAFF_BASE_SPEED = 48;
export const STAFF_MAX_LEVEL = 5;

// per-role stat tables, indexed [level1, level2, level3, level4, level5].
// waiter/cleaner: speed bump at 1/2/4/5, +1 capacity at 1, +2 capacity at 3 and again at 5.
// farmer/chef/rancher/fisherman: speed bump at 2/4/5; farmer also gets +2/+2 capacity at 3/5;
// chef/rancher/fisherman get a "does the job faster" percentage at 3, again at 5.
export const SPEED_MULT_BY_LEVEL = {
  waiter:    [1.10, 1.20, 1.20, 1.30, 1.40],
  cleaner:   [1.10, 1.20, 1.20, 1.30, 1.40],
  farmer:    [1.00, 1.10, 1.10, 1.20, 1.30],
  chef:      [1.00, 1.10, 1.10, 1.20, 1.30],
  rancher:   [1.00, 1.10, 1.10, 1.20, 1.30],
  fisherman: [1.00, 1.10, 1.10, 1.20, 1.30],
};
export const CAPACITY_BY_LEVEL = {
  waiter:  [2, 2, 4, 4, 6],
  cleaner: [2, 2, 4, 4, 6],
  farmer:  [5, 5, 7, 7, 9],
};
// chef: stove cook speed. rancher: animal-shack process speed. fisherman: catch speed.
export const WORK_MULT_BY_LEVEL = {
  chef:      [1.00, 1.00, 1.15, 1.15, 1.30],
  rancher:   [1.00, 1.00, 1.15, 1.15, 1.30],
  fisherman: [1.00, 1.10, 1.10, 1.20, 1.30],
};

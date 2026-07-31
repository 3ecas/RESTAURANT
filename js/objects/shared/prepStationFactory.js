// Shared shape for a "prep" step in a multi-step recipe (see data/recipes.js's `process`
// field) — a Prep Counter, etc. Unlike a Stove/Oven, these are stateless and instant: no
// slots, no timer, just a checkpoint. A chef walks an order's carried ingredient through
// each step of its process, advancing `.step` on arrival (see entities/staffRoles/chef.js's
// 'toPrepStation' phase) — nothing here needs to do anything itself.

export function makePrepStation({ type, name, icon, cost, color }) {
  return {
    type, name, icon, color, cost, category: 'Appliances',
  };
}

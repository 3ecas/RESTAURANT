// Door — pre-placed as the starting entrance, and also buyable for extra doorways cut into
// your own walls. Movable and sellable, just never stored/re-bagged into inventory (storable:
// false) — a door works fine mid-move already sitting on the grid, no need for a pickup step.
// A single cell, so it just uses the generic single-cell placement/removal/entrance-cell
// defaults in core/world.js — no overrides needed.
//
// Note: World.door / entranceCells (core/world.js) only ever treat the FIRST door object as
// the customer spawn/exit point — a second door is a fully walkable gap in the wall, just not
// an additional spawn point. Fine for decorative or shortcut doorways; not multi-entrance support.

export const door = {
  type: 'door',
  name: 'Door',
  icon: '🚪',
  color: 'rgba(120, 200, 120, 0.9)',
  cost: 10,
  category: 'Furniture',
  image: 'ASSETS/DOOR.png',
  walkthrough: true,
  storable: false,
};

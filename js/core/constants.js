// Grid geometry and shared type-sets used across the whole game

export const COLS = 21;
export const ROWS = 21;
export const CELL = 40;
export const SCALE = CELL / 32; // grows the fixed-pixel visuals (characters, badges, text) along with the cell size

export const DIRS = [
  { x: 0, y: -1, name: 'up' },
  { x: 0, y: 1, name: 'down' },
  { x: -1, y: 0, name: 'left' },
  { x: 1, y: 0, name: 'right' },
];

// NOTE: WALKTHROUGH_TYPES and SEATING_SURFACE_TYPES used to live here as hardcoded sets.
// They're now derived per-object-type (see js/objects/registry.js) from each type's own
// `walkthrough`/`seatingSurface` flag, so adding a new walkthrough or seating type doesn't
// require touching this file.

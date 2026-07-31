// Grid geometry and shared type-sets used across the whole game

// world size — the full buildable field, bigger than what's ever on screen at once
export const COLS = 36;
export const ROWS = 30;
export const CELL = 40;
export const SCALE = CELL / 32; // grows the fixed-pixel visuals (characters, badges, text) along with the cell size

// the canvas viewport itself is sized dynamically to fill the browser window (see
// main.js/resizeCanvas), capped at the world's own pixel size — the camera pans within it
// via right-mouse-drag (see game/input.js) whenever the world is bigger than the window

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

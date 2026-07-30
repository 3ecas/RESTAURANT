// Door — the only entrance; not purchasable (there's always exactly one, pre-placed) and
// movable only, never stored/sold. A single cell, so it just uses the generic single-cell
// placement/removal/entrance-cell defaults in core/world.js — no overrides needed.

export const door = {
  type: 'door',
  name: 'Door',
  icon: '🚪',
  color: 'rgba(120, 200, 120, 0.9)',
  walkthrough: true,
  storable: false,
};

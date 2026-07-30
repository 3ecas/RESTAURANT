// Storage quick bar (bottom center) + its expanded, category-grouped view

import { getItemDef } from '../objects/registry.js';
import { CATEGORY_ORDER } from './itemCategories.js';
import { iconHtml } from './uiHelpers.js';

const HOTBAR_SIZE = 9;

function inventoryCounts(game) {
  const counts = {};
  const order = [];
  game.inventory.forEach(o => {
    if (!(o.type in counts)) order.push(o.type);
    counts[o.type] = (counts[o.type] || 0) + 1;
  });
  return { counts, order };
}

function buildHotbarSlot(game, type, count) {
  const def = getItemDef(type);
  const slot = document.createElement('div');
  slot.className = 'hotbarSlot';
  const isHeld = !!game.heldObject && game.heldFromInventory && game.heldObject.type === type;
  if (isHeld) slot.classList.add('active');
  else if (game.heldObject) slot.classList.add('disabled');
  slot.title = def ? def.name : type;
  slot.innerHTML = `${iconHtml(type, def ? def.icon : '❔', 'hotbarIcon')}${count > 1 ? `<span class="hotbarCount">${count}</span>` : ''}`;
  slot.addEventListener('click', () => game.beginPlacingType(type));
  return slot;
}

// refills every time storage changes: a fixed 9-slot quick bar (bottom center) plus the
// expandable panel that lists everything, grouped by category
export function refreshStorageUI(game) {
  renderHotbar(game);
  renderHotbarExpand(game);
}

export function renderHotbar(game) {
  const el = document.getElementById('hotbarSlots');
  if (!el) return;
  el.innerHTML = '';
  const { counts, order } = inventoryCounts(game);
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const type = order[i];
    if (type) {
      el.appendChild(buildHotbarSlot(game, type, counts[type]));
    } else {
      const empty = document.createElement('div');
      empty.className = 'hotbarSlot empty';
      el.appendChild(empty);
    }
  }
}

export function renderHotbarExpand(game) {
  const el = document.getElementById('hotbarExpandBody');
  if (!el) return;
  el.innerHTML = '';
  const { counts, order } = inventoryCounts(game);
  if (order.length === 0) {
    el.innerHTML = '<div class="hotbarExpandEmpty">Nothing in storage.</div>';
    return;
  }
  CATEGORY_ORDER.forEach(cat => {
    const inCat = order.filter(t => (getItemDef(t)?.category || 'Other') === cat);
    if (inCat.length === 0) return;
    const section = document.createElement('div');
    section.className = 'hotbarCategory';
    const header = document.createElement('div');
    header.className = 'hotbarCategoryHeader';
    header.textContent = cat;
    section.appendChild(header);
    const row = document.createElement('div');
    row.className = 'hotbarCategoryRow';
    inCat.forEach(type => row.appendChild(buildHotbarSlot(game, type, counts[type])));
    section.appendChild(row);
    el.appendChild(section);
  });
  // anything not in a known category (shouldn't normally happen) still shows up
  const leftover = order.filter(t => !getItemDef(t)?.category);
  if (leftover.length > 0) {
    const section = document.createElement('div');
    section.className = 'hotbarCategory';
    const header = document.createElement('div');
    header.className = 'hotbarCategoryHeader';
    header.textContent = 'Other';
    section.appendChild(header);
    const row = document.createElement('div');
    row.className = 'hotbarCategoryRow';
    leftover.forEach(type => row.appendChild(buildHotbarSlot(game, type, counts[type])));
    section.appendChild(row);
    el.appendChild(section);
  }
}

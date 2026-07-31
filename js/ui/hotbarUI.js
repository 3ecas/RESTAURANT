// Storage quick bar (bottom center) + its expanded, category-grouped view. Also where
// purchased-but-unplaced staff show up: hire one from the Staff tab, then click its slot
// here and click a tile to put them to work (see Game.beginPlacingStaff/placeHeldStaff).

import { getItemDef } from '../objects/registry.js';
import { CATEGORY_ORDER } from './itemCategories.js';
import { iconHtml } from './uiHelpers.js';
import { ROLE_ICON, ROLE_LABEL } from './staffUI.js';

const HOTBAR_SIZE = 9;
const STAFF_CATEGORY = 'Staff';

function inventoryCounts(game) {
  const counts = {};
  const order = [];
  game.inventory.forEach(o => {
    if (!(o.type in counts)) order.push(o.type);
    counts[o.type] = (counts[o.type] || 0) + 1;
  });
  return { counts, order };
}

function staffCounts(game) {
  const counts = {};
  const order = [];
  game.staffInventory.forEach(s => {
    if (!(s.role in counts)) order.push(s.role);
    counts[s.role] = (counts[s.role] || 0) + 1;
  });
  return { counts, order };
}

function buildHotbarSlot(game, type, count) {
  const def = getItemDef(type);
  const slot = document.createElement('div');
  slot.className = 'hotbarSlot';
  const isHeld = !!game.heldObject && game.heldFromInventory && game.heldObject.type === type;
  if (isHeld) slot.classList.add('active');
  else if (game.heldObject || game.heldStaff) slot.classList.add('disabled');
  slot.title = def ? def.name : type;
  slot.innerHTML = `${iconHtml(type, def ? def.icon : '❔', 'hotbarIcon')}${count > 1 ? `<span class="hotbarCount">${count}</span>` : ''}`;
  slot.addEventListener('click', () => game.beginPlacingType(type));
  return slot;
}

function buildStaffSlot(game, role, count) {
  const slot = document.createElement('div');
  slot.className = 'hotbarSlot';
  const isHeld = game.heldStaff === role;
  if (isHeld) slot.classList.add('active');
  else if (game.heldObject || game.heldStaff) slot.classList.add('disabled');
  slot.title = ROLE_LABEL[role] || role;
  slot.innerHTML = `<span class="hotbarIcon">${ROLE_ICON[role] || '🧑'}</span>${count > 1 ? `<span class="hotbarCount">${count}</span>` : ''}`;
  slot.addEventListener('click', () => game.beginPlacingStaff(role));
  return slot;
}

function buildCategorySection(label, fill) {
  const section = document.createElement('div');
  section.className = 'hotbarCategory';
  const header = document.createElement('div');
  header.className = 'hotbarCategoryHeader';
  header.textContent = label;
  section.appendChild(header);
  const row = document.createElement('div');
  row.className = 'hotbarCategoryRow';
  fill(row);
  section.appendChild(row);
  return section;
}

// refills every time storage (or the staff roster) changes: a fixed 9-slot quick bar
// (bottom center) plus the expandable panel that lists everything, grouped by category
export function refreshStorageUI(game) {
  renderHotbar(game);
  renderHotbarExpand(game);
}

export function renderHotbar(game) {
  const el = document.getElementById('hotbarSlots');
  if (!el) return;
  el.innerHTML = '';
  const { counts, order } = inventoryCounts(game);
  const staff = staffCounts(game);
  // items and unplaced staff share the same fixed slots — staff first, so a newly hired
  // worker is always easy to find
  const combined = [
    ...staff.order.map(role => ({ isStaff: true, key: role })),
    ...order.map(type => ({ isStaff: false, key: type })),
  ];
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const entry = combined[i];
    if (entry) {
      el.appendChild(entry.isStaff ? buildStaffSlot(game, entry.key, staff.counts[entry.key]) : buildHotbarSlot(game, entry.key, counts[entry.key]));
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
  const staff = staffCounts(game);
  if (order.length === 0 && staff.order.length === 0) {
    el.innerHTML = '<div class="hotbarExpandEmpty">Nothing in storage.</div>';
    return;
  }
  if (staff.order.length > 0) {
    el.appendChild(buildCategorySection(STAFF_CATEGORY, row => {
      staff.order.forEach(role => row.appendChild(buildStaffSlot(game, role, staff.counts[role])));
    }));
  }
  CATEGORY_ORDER.forEach(cat => {
    const inCat = order.filter(t => (getItemDef(t)?.category || 'Other') === cat);
    if (inCat.length === 0) return;
    el.appendChild(buildCategorySection(cat, row => {
      inCat.forEach(type => row.appendChild(buildHotbarSlot(game, type, counts[type])));
    }));
  });
  // anything not in a known category (shouldn't normally happen) still shows up
  const leftover = order.filter(t => !getItemDef(t)?.category);
  if (leftover.length > 0) {
    el.appendChild(buildCategorySection('Other', row => {
      leftover.forEach(type => row.appendChild(buildHotbarSlot(game, type, counts[type])));
    }));
  }
}

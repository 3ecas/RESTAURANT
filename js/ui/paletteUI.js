// The Shop tab's item palette, grouped by category

import { ITEM_DEFS } from '../objects/registry.js';
import { CATEGORY_ORDER } from './itemCategories.js';
import { iconHtml } from './uiHelpers.js';

function buildPaletteItem(game, def) {
  const stock = game.shopStock[def.type] || 0;
  const affordable = game.money >= def.cost;
  const canBuy = affordable && stock > 0;
  const div = document.createElement('div');
  div.className = 'paletteItem' + (canBuy ? '' : ' disabled');
  const stockLabel = stock > 0
    ? `<div class="stock">x${stock} in stock</div>`
    : `<div class="stock outOfStock">Out of stock</div>`;
  div.innerHTML = `${iconHtml(def.type, def.icon, 'icon')}${def.name}<div class="cost">$${def.cost}</div>${stockLabel}`;
  if (canBuy) div.addEventListener('click', () => game.buyItem(def.type));
  return div;
}

function buildPaletteCategory(game, label, defs) {
  const section = document.createElement('div');
  section.className = 'hotbarCategory';
  const header = document.createElement('div');
  header.className = 'hotbarCategoryHeader';
  header.textContent = label;
  section.appendChild(header);
  const grid = document.createElement('div');
  grid.className = 'paletteGrid';
  defs.forEach(def => grid.appendChild(buildPaletteItem(game, def)));
  section.appendChild(grid);
  return section;
}

// grouped exactly like the storage quick bar's expanded view — same categories, same order
export function renderPalette(game) {
  const el = document.getElementById('palette');
  el.innerHTML = '';
  CATEGORY_ORDER.forEach(cat => {
    const defs = ITEM_DEFS.filter(d => (d.category || 'Other') === cat);
    if (defs.length > 0) el.appendChild(buildPaletteCategory(game, cat, defs));
  });
  const leftover = ITEM_DEFS.filter(d => !d.category);
  if (leftover.length > 0) el.appendChild(buildPaletteCategory(game, 'Other', leftover));
}

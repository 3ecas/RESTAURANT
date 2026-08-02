// The Shop tab's item palette — one sub-tab per category instead of one long scrolling list

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

function buildPaletteGrid(game, defs) {
  const grid = document.createElement('div');
  grid.className = 'paletteGrid';
  defs.forEach(def => grid.appendChild(buildPaletteItem(game, def)));
  return grid;
}

// an item can opt into requiring an unlock (e.g. Stove II/III, Sink II/III — see the
// requiresUnlock flag on objects/*.js, granted by restaurant level-ups, see data/levels.js)
// — until then it simply doesn't show up here at all
function isVisible(game, def) {
  return !def.requiresUnlock || game.unlockedObjectTypes.has(def.type);
}

// renderPalette reruns on every purchase and every shop restock (see statusUI.js's
// updateMoneyUI / game.js's refreshShopStock), which would otherwise snap the shop back to
// the first category mid-browse — this remembers the selection across those re-renders
let activeCategory = null;

// same categories/order as the storage quick bar's expanded view, just shown as sub-tabs
// (one open category at a time) instead of stacked sections in one scrolling list
export function renderPalette(game) {
  const el = document.getElementById('palette');
  el.innerHTML = '';
  const visible = ITEM_DEFS.filter(d => isVisible(game, d));

  const groups = CATEGORY_ORDER
    .map(cat => ({ cat, defs: visible.filter(d => (d.category || 'Other') === cat) }))
    .filter(g => g.defs.length > 0);
  const leftover = visible.filter(d => !d.category);
  if (leftover.length > 0) groups.push({ cat: 'Other', defs: leftover });

  if (groups.length === 0) {
    el.innerHTML = '<div class="hotbarExpandEmpty">Nothing available right now.</div>';
    return;
  }
  if (!groups.some(g => g.cat === activeCategory)) activeCategory = groups[0].cat;

  const tabBar = document.createElement('div');
  tabBar.className = 'subTabBar';
  const content = document.createElement('div');

  groups.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'subTabBtn' + (g.cat === activeCategory ? ' active' : '');
    btn.textContent = g.cat;
    btn.addEventListener('click', () => { activeCategory = g.cat; renderPalette(game); });
    tabBar.appendChild(btn);
    if (g.cat === activeCategory) content.appendChild(buildPaletteGrid(game, g.defs));
  });

  el.appendChild(tabBar);
  el.appendChild(content);
}

// game.shopRefreshTimer counts down continuously (see Game.update) — this just formats
// whatever it's currently at. Called on a short throttle, not every frame (see game.js).
export function updateShopRefreshCountdown(game) {
  const el = document.getElementById('shopRefreshCountdown');
  if (!el) return;
  const totalSec = Math.max(0, Math.ceil(game.shopRefreshTimer / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  el.textContent = `⏱ Next restock in ${min}:${String(sec).padStart(2, '0')}`;
}

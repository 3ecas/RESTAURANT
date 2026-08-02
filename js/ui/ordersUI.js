// The floating Orders panel — a 3-column pipeline board, one card per customer, from the
// moment their order is queued for the kitchen through to eating. A customer's card just
// stops appearing the moment they start leaving — nothing here persists past that; there's
// nothing to clean up since it's recomputed fresh from live game state on every render.

import { getRecipe } from '../data/recipes.js';

const COLUMNS = [
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'delivered', label: 'Delivered' },
];

// stand.pending/ready only track recipe NAMES in a shared pool — nothing ties a specific
// ticket back to the specific customer it's for. So "pending" vs "preparing" per customer is
// a best-effort match: walk waitingFood customers in a stable order (world.customers' own
// order, which is insertion order) and hand out the pool's pending-recipe counts first come
// first served; anyone left over is "preparing" — which covers several real states that all
// look the same from a customer's chair (actively on a stove, sitting ready for a waiter to
// grab, or already being carried over by one) and were previously all mislabeled "Cooking",
// which reads as "a stove is actively working on this" even when it isn't — the chef can be
// fully idle with a pile of "preparing" orders if they've all already finished cooking and
// are just waiting on the (single, one-at-a-time) waiter to physically deliver them.
function classify(customers, stand) {
  const pendingLeft = {};
  if (stand) for (const o of stand.pending) pendingLeft[o.recipe] = (pendingLeft[o.recipe] || 0) + 1;

  const columns = { pending: [], preparing: [], delivered: [] };
  for (const c of customers) {
    if (c.state === 'waitingFood') {
      if (pendingLeft[c.order] > 0) { pendingLeft[c.order]--; columns.pending.push(c); }
      else columns.preparing.push(c);
    } else if (c.state === 'eating') columns.delivered.push(c);
    // everyone else (still deciding, still waiting on a waiter, or already leaving/done)
    // matches none of the above and simply doesn't appear anywhere
  }
  return columns;
}

function buildCard(customer) {
  const div = document.createElement('div');
  div.className = 'orderCard';
  const recipe = getRecipe(customer.order);
  div.innerHTML = `<span class="orderCardIcon">${recipe ? recipe.icon : '❔'}</span><span>${recipe ? recipe.name : customer.order}</span>`;
  return div;
}

export function renderOrdersPanel(game) {
  const list = document.getElementById('ordersList');
  if (!list) return;
  const stand = game.world.findObjects('orderStand')[0];
  const columns = classify(game.world.customers, stand);

  list.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'ordersColumns';
  COLUMNS.forEach(({ key, label }) => {
    const entries = columns[key];
    const col = document.createElement('div');
    col.className = 'ordersColumn';
    const header = document.createElement('div');
    header.className = 'ordersColumnHeader';
    header.textContent = `${label} (${entries.length})`;
    col.appendChild(header);
    const body = document.createElement('div');
    body.className = 'ordersColumnBody';
    if (entries.length === 0) body.innerHTML = '<div class="orderEmpty">—</div>';
    else entries.forEach(c => body.appendChild(buildCard(c)));
    col.appendChild(body);
    grid.appendChild(col);
  });
  list.appendChild(grid);
}

// The floating Orders panel — what's cooking vs. ready to deliver

import { getRecipe } from '../data/recipes.js';

// green = ready to deliver, grey = still waiting to be cooked
export function renderOrdersPanel(game) {
  const list = document.getElementById('ordersList');
  if (!list) return;
  const stand = game.world.findObjects('orderStand')[0];

  if (!stand || (stand.pending.length === 0 && stand.ready.length === 0)) {
    list.innerHTML = '<div class="orderEmpty">No active orders.</div>';
    return;
  }

  const counts = {}; // "recipe|status" -> count
  stand.ready.forEach(o => {
    const key = o.recipe + '|ready';
    counts[key] = (counts[key] || 0) + 1;
  });
  stand.pending.forEach(o => {
    const key = o.recipe + '|pending';
    counts[key] = (counts[key] || 0) + 1;
  });

  const rows = Object.entries(counts).map(([key, count]) => {
    const [recipe, status] = key.split('|');
    return { recipe, status, count };
  });
  rows.sort((a, b) => (a.status === b.status ? 0 : a.status === 'ready' ? -1 : 1));

  list.innerHTML = '';
  rows.forEach(row => {
    const def = getRecipe(row.recipe);
    const div = document.createElement('div');
    div.className = 'orderRow ' + (row.status === 'ready' ? 'orderReady' : 'orderPending');
    const label = row.status === 'ready' ? 'to deliver' : 'waiting to cook';
    div.innerHTML = `<span>${def ? def.icon : '❔'} ${def ? def.name : row.recipe}</span><span>${label} ×${row.count}</span>`;
    list.appendChild(div);
  });
}

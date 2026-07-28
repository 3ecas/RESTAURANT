// DOM/UI wiring — all functions take the global `game` instance

function initUI(game) {
  document.querySelectorAll('.tabBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tabPanel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('closeMenu').addEventListener('click', () => game.closeMenu());

  document.getElementById('toggleOpenBtn').addEventListener('click', () => {
    game.isOpen = !game.isOpen;
    updateOpenStatusUI(game);
  });

  document.getElementById('toggleOrdersBtn').addEventListener('click', () => {
    document.getElementById('ordersPanel').classList.toggle('hidden');
    renderOrdersPanel(game);
  });
  document.getElementById('closeOrders').addEventListener('click', () => {
    document.getElementById('ordersPanel').classList.add('hidden');
  });

  document.getElementById('hotbarExpandBtn').addEventListener('click', () => {
    document.getElementById('hotbarExpandPanel').classList.toggle('hidden');
    renderHotbarExpand(game);
  });

  renderPalette(game);
  renderRecipeTable(game);
  renderStaffPanels(game);
  renderStaffTable(game);
  refreshStorageUI(game);
  renderOrdersPanel(game);
  renderIngredientsBox(game);
  updateMoneyUI(game);
  updateOpenStatusUI(game);
}

// puts a held object back — into storage if it came from there (its x/y are meaningless
// leftovers, never a real spot to restore), otherwise back where it was relocated from —
// bound to Escape
function cancelHeldObject(game) {
  if (game.heldObject) {
    if (game.heldFromInventory) {
      game.inventory.push(game.heldObject);
    } else {
      const placed = game.world.place(game.heldObject, game.heldObject.x, game.heldObject.y);
      if (!placed) game.inventory.push(game.heldObject);
    }
    game.heldObject = null;
  }
  game.heldFromInventory = false;
  refreshStorageUI(game);
}

// green = ready to deliver, grey = still waiting to be cooked
function renderOrdersPanel(game) {
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

function buildPaletteItem(game, def) {
  const affordable = game.money >= def.cost;
  const div = document.createElement('div');
  div.className = 'paletteItem' + (affordable ? '' : ' disabled');
  div.innerHTML = `<span class="icon">${def.icon}</span>${def.name}<div class="cost">$${def.cost}</div>`;
  div.addEventListener('click', () => game.buyItem(def.type));
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
function renderPalette(game) {
  const el = document.getElementById('palette');
  el.innerHTML = '';
  CATEGORY_ORDER.forEach(cat => {
    const defs = ITEM_DEFS.filter(d => (ITEM_CATEGORY[d.type] || 'Other') === cat);
    if (defs.length > 0) el.appendChild(buildPaletteCategory(game, cat, defs));
  });
  const leftover = ITEM_DEFS.filter(d => !ITEM_CATEGORY[d.type]);
  if (leftover.length > 0) el.appendChild(buildPaletteCategory(game, 'Other', leftover));
}

const INGREDIENT_ICON = { wheat: '🌾', shrimp: '🦐', chicken: '🍗', tomato: '🍅' };

// always-visible fridge stock, shown in the corner box below the money box —
// only ingredients you actually have any of are listed
function renderIngredientsBox(game) {
  const list = document.getElementById('ingredientsList');
  if (!list) return;
  const keys = Object.keys(game.ingredients).filter(k => (game.ingredients[k] || 0) > 0);
  if (keys.length === 0) {
    list.innerHTML = '<div class="ingredientEmpty">None yet.</div>';
    return;
  }
  list.innerHTML = '';
  keys.forEach(key => {
    const div = document.createElement('div');
    div.className = 'ingredientRow';
    div.innerHTML = `<span>${INGREDIENT_ICON[key] || '❔'} ${key}</span><span>${game.ingredients[key]}</span>`;
    list.appendChild(div);
  });
}

function renderRecipeTable(game) {
  const tbody = document.querySelector('#recipeTable tbody');
  tbody.innerHTML = '';
  RECIPES.forEach(r => {
    const needs = r.ingredient ? `${INGREDIENT_ICON[r.ingredient] || ''} ${r.ingredient}` : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.icon}</td><td>${r.name}</td><td>${needs}</td><td>$${r.price}</td><td>${(r.cookTime / 1000).toFixed(1)}s</td>
      <td><input type="checkbox" ${r.enabled ? 'checked' : ''} data-id="${r.id}" class="recipeToggle"></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.recipeToggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const r = getRecipe(cb.dataset.id);
      r.enabled = cb.checked;
    });
  });
}

const HIRE_BASE_COST = 10;
const HIRE_ROLES = ['waiter', 'chef', 'cleaner', 'farmer', 'rancher', 'fisherman'];
const ROLE_ICON = { waiter: '🤵', chef: '👨‍🍳', cleaner: '🧹', farmer: '👩‍🌾', rancher: '🐄', fisherman: '🎣' };
const ROLE_LABEL = { waiter: 'Waiter', chef: 'Chef', cleaner: 'Cleaner', farmer: 'Farmer', rancher: 'Rancher', fisherman: 'Fisherman' };

function getHireCost(game, role) {
  const n = game.staff.filter(s => s.role === role).length;
  return HIRE_BASE_COST * Math.pow(10, n);
}

// cost/time to train from `level` to `level + 1` — cheap at first, steep near max level
function staffTrainCost(level) {
  return 20 * level * level;
}
function staffTrainTime(level) {
  return 5000 * level; // ms
}

// one horizontal panel per role: a filled slot for each staff member already hired,
// plus one locked slot showing the price to hire the next one
function renderStaffPanels(game) {
  const container = document.getElementById('staffPanels');
  container.innerHTML = '';
  HIRE_ROLES.forEach(role => {
    const hired = game.staff.filter(s => s.role === role);
    const cost = getHireCost(game, role);

    const panel = document.createElement('div');
    panel.className = 'rolePanel';

    const header = document.createElement('div');
    header.className = 'rolePanelHeader';
    header.textContent = `${ROLE_ICON[role]} ${ROLE_LABEL[role]}`;
    panel.appendChild(header);

    const slots = document.createElement('div');
    slots.className = 'rolePanelSlots';

    hired.forEach(s => {
      const slot = document.createElement('div');
      slot.className = 'staffSlot filled';
      slot.innerHTML = `<span class="slotIcon">${ROLE_ICON[role]}</span><span class="slotName">${s.name}</span><span class="slotLevel">Lvl ${s.level}</span>`;
      slots.appendChild(slot);
    });

    const lockedSlot = document.createElement('div');
    const affordable = game.money >= cost;
    lockedSlot.className = 'staffSlot locked' + (affordable ? '' : ' disabled');
    lockedSlot.innerHTML = `<span class="slotIcon">🔒</span><span class="slotCost">$${cost}</span>`;
    lockedSlot.addEventListener('click', () => game.hireStaff(role));
    slots.appendChild(lockedSlot);

    panel.appendChild(slots);
    container.appendChild(panel);
  });
}

function renderStaffTable(game) {
  const tbody = document.querySelector('#staffTable tbody');
  tbody.innerHTML = '';
  game.staff.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.name}</td><td>${ROLE_ICON[s.role]} ${s.role}</td><td>Lvl ${s.level}/${STAFF_MAX_LEVEL}</td><td></td><td></td>`;

    const trainCell = tr.children[3];
    if (s.training) {
      const secsLeft = Math.max(0, Math.ceil(s.training.remaining / 1000));
      trainCell.textContent = `Training… ${secsLeft}s`;
    } else if (s.level >= STAFF_MAX_LEVEL) {
      trainCell.textContent = 'Max level';
    } else {
      const cost = staffTrainCost(s.level);
      const trainBtn = document.createElement('button');
      trainBtn.textContent = `🎓 Train ($${cost}, ${Math.round(staffTrainTime(s.level) / 1000)}s)`;
      trainBtn.className = 'smallBtn';
      trainBtn.disabled = game.money < cost;
      trainBtn.addEventListener('click', () => game.trainStaff(s.id));
      trainCell.appendChild(trainBtn);
    }

    const fireBtn = document.createElement('button');
    fireBtn.textContent = 'Fire';
    fireBtn.className = 'smallBtn';
    fireBtn.addEventListener('click', () => game.fireStaff(s.id));
    tr.children[4].appendChild(fireBtn);

    tbody.appendChild(tr);
  });
}

const HOTBAR_SIZE = 9;

// groups every item type it doesn't otherwise recognize into a generic bucket
const ITEM_CATEGORY = {
  fridge: 'Appliances', stove: 'Appliances', orderStand: 'Appliances', sink: 'Appliances', payingBooth: 'Appliances',
  table: 'Furniture', chair: 'Furniture', wall: 'Furniture',
  farmPlot: 'Farming', tomatoFarm: 'Farming',
  chicken: 'Ranching', chickenFeeder: 'Ranching', animalShack: 'Ranching',
  freezer: 'Fishing',
};
const CATEGORY_ORDER = ['Appliances', 'Furniture', 'Farming', 'Ranching', 'Fishing'];

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
  slot.innerHTML = `<span class="hotbarIcon">${def ? def.icon : '❔'}</span>${count > 1 ? `<span class="hotbarCount">${count}</span>` : ''}`;
  slot.addEventListener('click', () => game.beginPlacingType(type));
  return slot;
}

// refills every time storage changes: a fixed 9-slot quick bar (bottom center) plus the
// expandable panel that lists everything, grouped by category
function refreshStorageUI(game) {
  renderHotbar(game);
  renderHotbarExpand(game);
}

function renderHotbar(game) {
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

function renderHotbarExpand(game) {
  const el = document.getElementById('hotbarExpandBody');
  if (!el) return;
  el.innerHTML = '';
  const { counts, order } = inventoryCounts(game);
  if (order.length === 0) {
    el.innerHTML = '<div class="hotbarExpandEmpty">Nothing in storage.</div>';
    return;
  }
  CATEGORY_ORDER.forEach(cat => {
    const inCat = order.filter(t => (ITEM_CATEGORY[t] || 'Other') === cat);
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
  const leftover = order.filter(t => !ITEM_CATEGORY[t]);
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

function updateMoneyUI(game) {
  document.getElementById('moneyVal').textContent = game.money;
  renderPalette(game);
  renderStaffPanels(game);
  renderStaffTable(game);
}

function updateOpenStatusUI(game) {
  const btn = document.getElementById('toggleOpenBtn');
  const status = document.getElementById('openStatusText');
  if (game.isOpen) {
    btn.textContent = '🔴 Close Restaurant';
    status.textContent = 'Status: OPEN — customers may enter.';
  } else {
    btn.textContent = '🟢 Open Restaurant';
    status.textContent = 'Status: CLOSED — no new customers will enter.';
  }
}

// ---- context menu (right-click on a placed object) ----

function showContextMenu(game, obj, clientX, clientY) {
  const menu = document.getElementById('contextMenu');
  const moveBtn = document.getElementById('ctxMove');
  const storeBtn = document.getElementById('ctxStore');
  const sellBtn = document.getElementById('ctxSell');

  const canRemove = game.canRemoveObject(obj);
  moveBtn.disabled = !canRemove;
  storeBtn.disabled = !canRemove;
  sellBtn.disabled = !canRemove;
  moveBtn.title = canRemove ? '' : 'In use — cannot move right now';
  storeBtn.title = moveBtn.title;
  sellBtn.title = moveBtn.title;

  const def = getItemDef(obj.type);
  sellBtn.style.display = def ? '' : 'none';
  // the door is movable only — the restaurant must always have one, so no store/sell
  storeBtn.style.display = obj.type === 'door' ? 'none' : '';
  menu.classList.remove('hidden');
  menu.style.left = clientX + 'px';
  menu.style.top = clientY + 'px';

  // reposition if it would overflow the viewport
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  });
}

function hideContextMenu() {
  document.getElementById('contextMenu').classList.add('hidden');
}

// DOM/UI wiring — all functions take the global `game` instance

function initUI(game) {
  document.querySelectorAll('.tabBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tabPanel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'objects') refreshObjectsTab(game);
      if (btn.dataset.tab === 'shop') renderShopMap(game);
    });
  });

  document.getElementById('closeMenu').addEventListener('click', () => game.closeMenu());

  document.getElementById('cancelHold').addEventListener('click', () => {
    if (game.heldObject) {
      // try to drop it back exactly where it came from; otherwise just keep it in storage
      const placed = game.world.place(game.heldObject, game.heldObject.x, game.heldObject.y);
      if (!placed) game.inventory.push(game.heldObject);
      game.heldObject = null;
    }
    updateHoldingUI(game);
    refreshObjectsTab(game);
  });

  document.getElementById('toggleOpenBtn').addEventListener('click', () => {
    game.isOpen = !game.isOpen;
    updateOpenStatusUI(game);
  });

  renderPalette(game);
  renderRecipeTable(game);
  renderStaffHireButtons(game);
  renderStaffTable(game);
  refreshObjectsTab(game);
  renderShopMap(game);
  updateMoneyUI(game);
  updateStaffCountUI(game);
  updateHoldingUI(game);
  updateOpenStatusUI(game);
}

function renderPalette(game) {
  const el = document.getElementById('palette');
  el.innerHTML = '';
  ITEM_DEFS.forEach(def => {
    const affordable = game.money >= def.cost;
    const div = document.createElement('div');
    div.className = 'paletteItem' + (affordable ? '' : ' disabled');
    div.innerHTML = `<span class="icon">${def.icon}</span>${def.name}<div class="cost">$${def.cost}</div>`;
    div.addEventListener('click', () => game.buyItem(def.type));
    el.appendChild(div);
  });
}

function renderRecipeTable(game) {
  const tbody = document.querySelector('#recipeTable tbody');
  tbody.innerHTML = '';
  RECIPES.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.icon}</td><td>${r.name}</td><td>$${r.cost}</td><td>$${r.price}</td><td>${(r.cookTime / 1000).toFixed(1)}s</td>
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
const HIRE_ROLES = ['waiter', 'chef', 'cleaner'];
const ROLE_ICON = { waiter: '🤵', chef: '👨‍🍳', cleaner: '🧹' };

function getHireCost(game, role) {
  const n = game.staff.filter(s => s.role === role).length;
  return HIRE_BASE_COST * Math.pow(10, n);
}

function renderStaffHireButtons(game) {
  const row = document.getElementById('hireRow');
  row.innerHTML = '';
  HIRE_ROLES.forEach(role => {
    const cost = getHireCost(game, role);
    const btn = document.createElement('button');
    btn.textContent = `${ROLE_ICON[role]} Hire ${role} ($${cost})`;
    btn.disabled = game.money < cost;
    btn.addEventListener('click', () => game.hireStaff(role));
    row.appendChild(btn);
  });
}

function renderStaffTable(game) {
  const tbody = document.querySelector('#staffTable tbody');
  tbody.innerHTML = '';
  game.staff.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.name}</td><td>${ROLE_ICON[s.role]} ${s.role}</td><td></td>`;
    const fireBtn = document.createElement('button');
    fireBtn.textContent = 'Fire';
    fireBtn.className = 'smallBtn';
    fireBtn.addEventListener('click', () => game.fireStaff(s.id));
    tr.children[2].appendChild(fireBtn);
    tbody.appendChild(tr);
  });
}

const SIDE_ARROW = { up: '↑', down: '↓', left: '←', right: '→' };

function refreshObjectsTab(game) {
  renderInventoryTable(game);
  renderPlacedTable(game);
}

function renderInventoryTable(game) {
  const tbody = document.querySelector('#inventoryTable tbody');
  tbody.innerHTML = '';
  const items = game.heldObject ? [game.heldObject, ...game.inventory] : game.inventory;
  items.forEach((obj, i) => {
    const def = getItemDef(obj.type);
    const isHeld = obj === game.heldObject;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${def ? def.icon : '❔'}</td><td>${def ? def.name : obj.type}${isHeld ? ' (in hand)' : ''}</td><td></td>`;
    if (!isHeld) {
      const btn = document.createElement('button');
      btn.textContent = 'Place';
      btn.className = 'smallBtn';
      btn.disabled = !!game.heldObject;
      btn.addEventListener('click', () => game.beginPlacing(obj));
      tr.children[2].appendChild(btn);
    }
    tbody.appendChild(tr);
  });
  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:#a99c86;">Nothing in storage.</td></tr>';
  }
}

function renderPlacedTable(game) {
  const tbody = document.querySelector('#placedTable tbody');
  tbody.innerHTML = '';
  game.world.objects.forEach(obj => {
    const def = getItemDef(obj.type);
    const label = SINGLE_SIDE_TYPES.has(obj.type) ? `${def.name} (usable from ${SIDE_ARROW[obj.side]})` : (def ? def.name : obj.type);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${def ? def.icon : '📍'}</td><td>${label}</td><td>(${obj.x}, ${obj.y})</td>`;
    tbody.appendChild(tr);
  });
  if (game.world.objects.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:#a99c86;">Nothing placed yet.</td></tr>';
  }
}

function renderShopMap(game) {
  const el = document.getElementById('shopMap');
  el.innerHTML = '';
  const cost = lotPurchaseCost(game.world);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const div = document.createElement('div');
      if (row === 1 && col === 1) {
        div.className = 'lotCell home';
        div.innerHTML = '🏠<br>Home';
        el.appendChild(div);
        continue;
      }
      const lot = EXPANSION_LOTS.find(l => l.col === col && l.row === row);
      const owned = game.world.lots[row][col];
      if (owned) {
        div.className = 'lotCell owned';
        div.innerHTML = `✅<br>${lot.label}`;
      } else {
        const eligible = lot.requires.every(rk => {
          const rl = EXPANSION_LOTS.find(l => l.key === rk);
          return game.world.lots[rl.row][rl.col];
        });
        if (eligible) {
          div.className = 'lotCell buyable' + (game.money < cost ? ' disabled' : '');
          div.innerHTML = `${lot.label}<div class="lotCost">$${cost}</div>`;
          div.addEventListener('click', () => game.purchaseLot(lot.key));
        } else {
          div.className = 'lotCell locked';
          div.innerHTML = `🔒<br>${lot.label}<div class="lotCost">needs ${lot.requires.join(' + ')}</div>`;
        }
      }
      el.appendChild(div);
    }
  }
}

function updateMoneyUI(game) {
  document.getElementById('moneyVal').textContent = game.money;
  renderPalette(game);
  renderStaffHireButtons(game);
}

function updateStaffCountUI(game) {
  const counts = { waiter: 0, chef: 0, cleaner: 0 };
  game.staff.forEach(s => counts[s.role]++);
  document.getElementById('staffCount').textContent =
    `🤵 ${counts.waiter}  👨‍🍳 ${counts.chef}  🧹 ${counts.cleaner}`;
}

function updateHoldingUI(game) {
  const name = game.heldObject ? (getItemDef(game.heldObject.type) ? getItemDef(game.heldObject.type).name : game.heldObject.type) : 'nothing';
  document.getElementById('holdingName').textContent = name;
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
  const rotateBtn = document.getElementById('ctxRotate');
  const storeBtn = document.getElementById('ctxStore');
  const sellBtn = document.getElementById('ctxSell');

  const canRemove = game.canRemoveObject(obj);
  moveBtn.disabled = !canRemove;
  storeBtn.disabled = !canRemove;
  sellBtn.disabled = !canRemove;
  moveBtn.title = canRemove ? '' : 'In use — cannot move right now';
  storeBtn.title = moveBtn.title;
  sellBtn.title = moveBtn.title;

  rotateBtn.style.display = SINGLE_SIDE_TYPES.has(obj.type) ? '' : 'none';
  const def = getItemDef(obj.type);
  sellBtn.style.display = def ? '' : 'none';
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

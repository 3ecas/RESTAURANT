// Top-level DOM wiring — tabs, menu buttons, orders/hotbar panel toggles

import { renderPalette, updateShopRefreshCountdown } from './paletteUI.js';
import { refreshStorageUI, renderHotbarExpand } from './hotbarUI.js';
import { renderStaffPanels } from './staffUI.js';
import { renderOrdersPanel } from './ordersUI.js';
import { renderIngredientsBox } from './ingredientsUI.js';
import { renderRecipeTable } from './recipeUI.js';
import { updateMoneyUI, updateOpenStatusUI, updateXpBarUI } from './statusUI.js';
import { renderAchievements } from './achievementsUI.js';
import { renderLevels } from './levelsUI.js';

export function initUI(game) {
  document.querySelectorAll('.tabBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tabPanel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      game.openMenu();
    });
  });

  document.getElementById('closeMenu').addEventListener('click', () => game.closeMenu());

  document.getElementById('toggleOpenBtn').addEventListener('click', () => {
    game.isOpen = !game.isOpen;
    if (!game.isOpen) game.evictDoorQueue(); // seated customers are unaffected — see Game.evictDoorQueue
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
  updateShopRefreshCountdown(game);
  renderRecipeTable(game);
  renderStaffPanels(game);
  refreshStorageUI(game);
  renderOrdersPanel(game);
  renderIngredientsBox(game);
  renderAchievements(game);
  renderLevels(game);
  updateMoneyUI(game);
  updateOpenStatusUI(game);
  updateXpBarUI(game);
}

// puts a held object (or held staff member) back — into storage if it came from there (its
// x/y are meaningless leftovers, never a real spot to restore), otherwise back where it was
// relocated from — bound to Escape
export function cancelHeldObject(game) {
  if (game.heldObject) {
    if (game.heldFromInventory) {
      game.inventory.push(game.heldObject);
    } else {
      const placed = game.world.place(game.heldObject, game.heldObject.x, game.heldObject.y);
      if (!placed) game.inventory.push(game.heldObject);
    }
    game.heldObject = null;
  }
  if (game.heldStaff) {
    game.staffInventory.push({ role: game.heldStaff });
    game.heldStaff = null;
  }
  game.heldFromInventory = false;
  refreshStorageUI(game);
}

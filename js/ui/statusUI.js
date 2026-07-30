// Money display + open/closed restaurant status

import { renderPalette } from './paletteUI.js';
import { renderStaffPanels, renderStaffTable } from './staffUI.js';

export function updateMoneyUI(game) {
  document.getElementById('moneyVal').textContent = game.money;
  renderPalette(game);
  renderStaffPanels(game);
  renderStaffTable(game);
}

export function updateOpenStatusUI(game) {
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

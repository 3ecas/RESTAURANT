// Money display, open/closed restaurant status, and the always-visible XP bar

import { renderPalette } from './paletteUI.js';
import { renderStaffPanels } from './staffUI.js';
import { levelProgress } from '../data/levels.js';

export function updateMoneyUI(game) {
  document.getElementById('moneyVal').textContent = game.money;
  renderPalette(game);
  renderStaffPanels(game);
}

export function updateXpBarUI(game) {
  const levelEl = document.getElementById('xpBarLevel');
  const fillEl = document.getElementById('xpBarFill');
  const textEl = document.getElementById('xpBarText');
  if (!levelEl || !fillEl || !textEl) return;
  levelEl.textContent = game.restaurantLevel;
  const { atMax, have, span, pct } = levelProgress(game);
  fillEl.style.width = Math.round(pct * 100) + '%';
  textEl.textContent = atMax ? 'Max level' : `$${Math.round(have)} / $${Math.round(span)}`;
}

export function updateOpenStatusUI(game) {
  const btn = document.getElementById('toggleOpenBtn');
  if (!btn) return;
  if (game.isOpen) {
    btn.textContent = '🟢 Open';
    btn.classList.remove('statusClosed');
    btn.classList.add('statusOpen');
  } else {
    btn.textContent = '🔴 Closed';
    btn.classList.remove('statusOpen');
    btn.classList.add('statusClosed');
  }
}

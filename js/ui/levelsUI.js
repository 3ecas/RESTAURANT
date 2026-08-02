// Levels tab: the 100-level restaurant progression, one row per level — done/active/locked,
// same visual pattern as achievementsUI.js. Two differences from that pattern: the active
// row's progress bar tracks revenue WITHIN the current level only (resets to 0% each level,
// rather than a lifetime total creeping toward an ever-receding max), and locked rows show
// their reward too — with 100 of them the roadmap is worth previewing, unlike achievements'
// short list where the surprise mattered more.

import { LEVELS, MAX_LEVEL, levelProgress } from '../data/levels.js';

export function renderLevels(game) {
  const list = document.getElementById('levelsList');
  if (!list) return;
  list.innerHTML = '';

  for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
    const entry = LEVELS[lvl - 1]; // reward for REACHING this level
    const done = lvl < game.restaurantLevel;
    const active = lvl === game.restaurantLevel;
    const row = document.createElement('div');
    row.className = 'levelRow ' + (done ? 'levelDone' : active ? 'levelActive' : 'levelLocked');

    if (done) {
      row.innerHTML = `
        <div class="levelIcon">✅</div>
        <div class="levelBody">
          <div class="levelName">Level ${lvl}</div>
          <div class="levelReward">${entry.label}</div>
        </div>`;
    } else if (active) {
      const { atMax, have, span, pct } = levelProgress(game);
      const nextEntry = atMax ? null : LEVELS[lvl]; // reward for reaching lvl+1
      row.innerHTML = `
        <div class="levelIcon">⭐</div>
        <div class="levelBody">
          <div class="levelName">Level ${lvl}</div>
          <div class="levelProgressBar"><div class="levelProgressFill" style="width:${Math.round(pct * 100)}%"></div></div>
          <div class="levelProgressText">${atMax ? 'Max level reached' : `$${Math.round(have)} / $${Math.round(span)} toward level ${lvl + 1}`}</div>
          ${nextEntry ? `<div class="levelReward">Next: ${nextEntry.label}</div>` : ''}
        </div>`;
    } else {
      row.innerHTML = `
        <div class="levelIcon">🔒</div>
        <div class="levelBody">
          <div class="levelName">Level ${lvl}</div>
          <div class="levelReward">${entry.label}</div>
        </div>`;
    }
    list.appendChild(row);
  }
}

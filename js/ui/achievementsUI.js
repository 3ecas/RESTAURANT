// Achievements tab: completed milestones plus the one currently in progress. No experience
// points here — each one is a deadline (serve N guests, earn $N) that unlocks real content
// the moment it lands (see data/achievements.js / game/achievements.js).

import { ACHIEVEMENTS } from '../data/achievements.js';
import { currentAchievement } from '../game/achievements.js';

const METRIC_LABEL = { customersServed: 'guests served', totalRevenue: 'earned' };

function formatMetricValue(metric, value) {
  return metric === 'totalRevenue' ? `$${value}` : String(value);
}

export function renderAchievements(game) {
  const list = document.getElementById('achievementsList');
  if (!list) return;
  list.innerHTML = '';

  ACHIEVEMENTS.forEach((a, i) => {
    const done = i < game.achievementIndex;
    const active = i === game.achievementIndex;
    const row = document.createElement('div');
    row.className = 'achievementRow ' + (done ? 'achievementDone' : active ? 'achievementActive' : 'achievementLocked');

    if (done) {
      row.innerHTML = `
        <div class="achievementIcon">✅</div>
        <div class="achievementBody">
          <div class="achievementName">${a.name}</div>
          <div class="achievementReward">${a.rewardLabel}</div>
        </div>`;
    } else if (active) {
      const have = game.stats[a.metric] || 0;
      const pct = Math.min(1, have / a.target);
      row.innerHTML = `
        <div class="achievementIcon">🎯</div>
        <div class="achievementBody">
          <div class="achievementName">${a.name}</div>
          <div class="achievementDesc">${a.description}</div>
          <div class="achievementProgressBar"><div class="achievementProgressFill" style="width:${Math.round(pct * 100)}%"></div></div>
          <div class="achievementProgressText">${formatMetricValue(a.metric, have)} / ${formatMetricValue(a.metric, a.target)} ${METRIC_LABEL[a.metric] || ''}</div>
          <div class="achievementReward">Reward: ${a.rewardLabel}</div>
        </div>`;
    } else {
      row.innerHTML = `
        <div class="achievementIcon">🔒</div>
        <div class="achievementBody">
          <div class="achievementName">${a.name}</div>
          <div class="achievementDesc">${a.description}</div>
        </div>`;
    }
    list.appendChild(row);
  });

  if (!currentAchievement(game)) {
    const done = document.createElement('div');
    done.className = 'achievementEmpty';
    done.textContent = 'All achievements completed!';
    list.appendChild(done);
  }
}

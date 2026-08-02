// Achievement progress tracking + reward application. See data/achievements.js for the
// actual milestone list — this file just walks the chain. Achievements are cash-only now
// (fully separate from unlocking — that's data/levels.js / game/leveling.js's job), so
// applying a reward is just a money grant.

import { ACHIEVEMENTS } from '../data/achievements.js';

export function currentAchievement(game) {
  return ACHIEVEMENTS[game.achievementIndex] || null;
}

function applyReward(game, reward) {
  game.addMoney(reward.amount);
}

// call once per tick from Game.update — returns true if an achievement just completed
// (the caller uses that to know when to re-render the Achievements tab)
export function checkAchievements(game) {
  const current = currentAchievement(game);
  if (!current) return false;
  if ((game.stats[current.metric] || 0) < current.target) return false;
  applyReward(game, current.reward);
  game.completedAchievementIds.push(current.id);
  game.achievementIndex++;
  return true;
}

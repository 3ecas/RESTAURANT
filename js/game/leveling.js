// Restaurant level progress + reward application. See data/levels.js for the actual 100-level
// list — this file just walks it and knows how to grant each reward type onto a live Game
// instance. Mirrors game/achievements.js's shape (that file is the cash-only milestone system
// now — fully separate from unlocking, see its own header comment).

import { LEVELS, MAX_LEVEL, xpForLevel } from '../data/levels.js';

function applyLevelReward(game, reward) {
  if (!reward) return; // level 1's starting reward
  if (reward.type === 'unlockObjects') {
    reward.objectTypes.forEach(t => game.unlockedObjectTypes.add(t));
  } else if (reward.type === 'unlockRecipes') {
    reward.recipeIds.forEach(id => game.unlockedRecipes.add(id));
  } else if (reward.type === 'money') {
    game.addMoney(reward.amount);
  } else if (reward.type === 'ingredients') {
    reward.items.forEach(({ name, qty }) => {
      game.ingredients[name] = (game.ingredients[name] || 0) + qty;
    });
  }
}

// call once per tick from Game.update — a single big payment can cross more than one (small,
// early) threshold at once, hence the while loop rather than a single if. Returns true if at
// least one level-up happened (the caller uses that to know when to re-render).
export function checkLevelUp(game) {
  let leveledUp = false;
  while (game.restaurantLevel < MAX_LEVEL && game.stats.totalRevenue >= xpForLevel(game.restaurantLevel + 1)) {
    game.restaurantLevel++;
    applyLevelReward(game, LEVELS[game.restaurantLevel - 1].reward);
    leveledUp = true;
  }
  return leveledUp;
}

import { makeRanchAnimal } from './shared/ranchAnimalFactory.js';

export const chicken = Object.assign(makeRanchAnimal({
  type: 'chicken', name: 'Chicken', cost: 32, babyIcon: '🐤', grownIcon: '🐓',
  feedsToGrow: 3, growTimeMs: 25000, processTimeMs: 6000,
  feederType: 'chickenFeeder', feedIngredient: 'wheat',
  yields: [{ name: 'chicken', qty: 1 }, { name: 'egg', qty: 2 }],
}), { requiresUnlock: true });

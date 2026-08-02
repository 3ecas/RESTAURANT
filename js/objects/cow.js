import { makeRanchAnimal } from './shared/ranchAnimalFactory.js';

export const cow = Object.assign(makeRanchAnimal({
  type: 'cow', name: 'Cow', cost: 48, babyIcon: '🐮', grownIcon: '🐄',
  feedsToGrow: 4, growTimeMs: 35000, processTimeMs: 9000,
  feederType: 'cowFeeder', feedIngredient: 'wheat',
  yields: [{ name: 'milk', qty: 1 }, { name: 'beef', qty: 1 }],
}), { requiresUnlock: true });

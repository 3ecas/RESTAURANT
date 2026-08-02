import { makeFarmCrop } from './shared/farmCropFactory.js';

export const tomatoFarm = Object.assign(makeFarmCrop({
  type: 'tomatoFarm', name: 'Tomato Farm', shopIcon: '🍅', cost: 38, crop: 'tomato', readyIcon: '🍅',
}), { requiresUnlock: true });

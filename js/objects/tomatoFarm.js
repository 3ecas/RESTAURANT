import { makeFarmCrop } from './shared/farmCropFactory.js';

export const tomatoFarm = makeFarmCrop({
  type: 'tomatoFarm', name: 'Tomato Farm', shopIcon: '🍅', cost: 38, crop: 'tomato', readyIcon: '🍅',
});

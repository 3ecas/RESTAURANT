import { makeFarmCrop } from './shared/farmCropFactory.js';

export const pumpkinFarm = makeFarmCrop({
  type: 'pumpkinFarm', name: 'Pumpkin Patch', shopIcon: '🎃', cost: 62, crop: 'pumpkin', readyIcon: '🎃',
});

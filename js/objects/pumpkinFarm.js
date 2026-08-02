import { makeFarmCrop } from './shared/farmCropFactory.js';

export const pumpkinFarm = Object.assign(makeFarmCrop({
  type: 'pumpkinFarm', name: 'Pumpkin Patch', shopIcon: '🎃', cost: 62, crop: 'pumpkin', readyIcon: '🎃',
}), { requiresUnlock: true });

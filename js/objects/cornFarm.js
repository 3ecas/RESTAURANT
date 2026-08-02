import { makeFarmCrop } from './shared/farmCropFactory.js';

export const cornFarm = Object.assign(makeFarmCrop({
  type: 'cornFarm', name: 'Corn Field', shopIcon: '🌽', cost: 46, crop: 'corn', readyIcon: '🌽',
}), { requiresUnlock: true });

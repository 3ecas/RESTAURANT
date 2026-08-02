import { makeFarmCrop } from './shared/farmCropFactory.js';

export const carrotFarm = Object.assign(makeFarmCrop({
  type: 'carrotFarm', name: 'Carrot Patch', shopIcon: '🥕', cost: 54, crop: 'carrot', readyIcon: '🥕',
}), { requiresUnlock: true });

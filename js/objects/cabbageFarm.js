import { makeFarmCrop } from './shared/farmCropFactory.js';

export const cabbageFarm = Object.assign(makeFarmCrop({
  type: 'cabbageFarm', name: 'Cabbage Patch', shopIcon: '🥬', cost: 42, crop: 'cabbage', readyIcon: '🥬',
}), { requiresUnlock: true });

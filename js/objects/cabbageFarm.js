import { makeFarmCrop } from './shared/farmCropFactory.js';

export const cabbageFarm = makeFarmCrop({
  type: 'cabbageFarm', name: 'Cabbage Patch', shopIcon: '🥬', cost: 42, crop: 'cabbage', readyIcon: '🥬',
});

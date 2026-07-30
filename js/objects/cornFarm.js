import { makeFarmCrop } from './shared/farmCropFactory.js';

export const cornFarm = makeFarmCrop({
  type: 'cornFarm', name: 'Corn Field', shopIcon: '🌽', cost: 46, crop: 'corn', readyIcon: '🌽',
});

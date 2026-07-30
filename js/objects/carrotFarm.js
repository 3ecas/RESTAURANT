import { makeFarmCrop } from './shared/farmCropFactory.js';

export const carrotFarm = makeFarmCrop({
  type: 'carrotFarm', name: 'Carrot Patch', shopIcon: '🥕', cost: 54, crop: 'carrot', readyIcon: '🥕',
});

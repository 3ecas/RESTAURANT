import { makeFarmCrop } from './shared/farmCropFactory.js';

export const potatoFarm = makeFarmCrop({
  type: 'potatoFarm', name: 'Potato Patch', shopIcon: '🥔', cost: 50, crop: 'potato', readyIcon: '🥔',
});

import { makeFarmCrop } from './shared/farmCropFactory.js';

export const potatoFarm = Object.assign(makeFarmCrop({
  type: 'potatoFarm', name: 'Potato Patch', shopIcon: '🥔', cost: 50, crop: 'potato', readyIcon: '🥔',
}), { requiresUnlock: true });

import { makeFarmCrop } from './shared/farmCropFactory.js';

export const onionFarm = Object.assign(makeFarmCrop({
  type: 'onionFarm', name: 'Onion Patch', shopIcon: '🧅', cost: 58, crop: 'onion', readyIcon: '🧅',
}), { requiresUnlock: true });

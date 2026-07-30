import { makeFarmCrop } from './shared/farmCropFactory.js';

export const farmPlot = makeFarmCrop({
  type: 'farmPlot', name: 'Wheat Plot', shopIcon: '🌾', cost: 28, crop: 'wheat', readyIcon: '🌾',
});

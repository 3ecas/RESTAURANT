import { makeAnimalFeeder } from './shared/animalFeederFactory.js';

export const FEEDER_CAPACITY = 10;

export const chickenFeeder = makeAnimalFeeder({
  type: 'chickenFeeder', name: 'Chicken Feeder', icon: '🥣', cost: 28, capacity: FEEDER_CAPACITY,
});

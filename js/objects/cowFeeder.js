import { makeAnimalFeeder } from './shared/animalFeederFactory.js';

export const COW_FEEDER_CAPACITY = 10;

export const cowFeeder = Object.assign(makeAnimalFeeder({
  type: 'cowFeeder', name: 'Cow Trough', icon: '🪣', cost: 34, capacity: COW_FEEDER_CAPACITY,
}), { requiresUnlock: true });

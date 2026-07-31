// Sink — cleaners drop dirty plates here (entities/staffRoles/cleaner.js); instant, no wash
// timer currently used.

export const sink = {
  type: 'sink',
  name: 'Sink',
  icon: '🚰',
  color: '#a9c9d8',
  cost: 40,
  category: 'Appliances',
  image: 'ASSETS/SINK.png',

  createState(base) {
    return Object.assign(base, { washing: false, progress: 0 });
  },
};

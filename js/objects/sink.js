// Sink — cleaners (and the player) drop dirty plates here; instant, no wash timer currently used.

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

  interact(obj, ctx) {
    const { player } = ctx;
    if (player.carrying && player.carrying.kind === 'dirty') {
      player.carrying = null;
      return true;
    }
    return false;
  },
};

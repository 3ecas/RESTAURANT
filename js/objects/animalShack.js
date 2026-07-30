// Animal Shack — where a rancher processes any grown animal (chicken, cow, ...) into its
// yield ingredient. Processing time is per-animal-type (see shared/ranchAnimalFactory.js),
// so this object stays animal-agnostic — purely passive from its own perspective.

export const animalShack = {
  type: 'animalShack',
  name: 'Animal Shack',
  icon: '🛖',
  color: '#a67c52',
  cost: 55,
  category: 'Ranching',
};

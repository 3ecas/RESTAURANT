// Animal Shack — where a rancher processes a grown chicken into meat
// (see entities/staffRoles/rancher.js). Purely passive from the object's own perspective.

export const CHICKEN_PROCESS_TIME = 6000; // ms to process a grown chicken

export const animalShack = {
  type: 'animalShack',
  name: 'Animal Shack',
  icon: '🛖',
  color: '#a67c52',
  cost: 55,
  category: 'Ranching',
};

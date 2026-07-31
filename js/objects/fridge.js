// Fridge — any fridge works, they all share the same ingredient stock (see Game.ingredients).
// Ingredient/cost was already reserved when the customer ordered (Customer 'thinking'), so a
// chef fetching from it (entities/staffRoles/chef.js) is just the physical hand-off, not
// another availability check.

export const fridge = {
  type: 'fridge',
  name: 'Fridge',
  icon: '🧊',
  color: '#bfe3ea',
  cost: 45,
  category: 'Appliances',
  image: 'ASSETS/FRIDGE.png',
};

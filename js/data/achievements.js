// Sequential milestones — no experience points, just deadlines to fulfill. Only the current
// one (Game.achievementIndex) is tracked; completing it immediately unlocks the next, and
// each reward is genuinely new content (a faster stove, a recipe, a cash bonus) rather than
// a number going up. Thresholds and rewards escalate down the list on purpose — early ones
// are quick, later ones take a lot more play (and a lot more revenue) to reach.
//
// metric is a key into Game.stats:
//  - customersServed: lifetime count of customers who paid and left happy
//  - totalRevenue: lifetime $ paid by customers (not counting selling items back, or
//    achievement cash rewards themselves)

export const ACHIEVEMENTS = [
  {
    id: 'first10', name: 'First Customers', description: 'Serve 10 guests',
    metric: 'customersServed', target: 10,
    reward: { type: 'unlockStove', stoveType: 'stoveII' },
    rewardLabel: 'Unlocks Stove II (2 slots, cooks 30% faster)',
  },
  {
    id: 'serve25', name: 'Getting Busy', description: 'Serve 25 guests',
    metric: 'customersServed', target: 25,
    reward: { type: 'unlockRecipes', recipeIds: ['mayoShrimp', 'codAndPotato'] },
    rewardLabel: 'Unlocks Mayo Shrimp & Cod & Potato',
  },
  {
    id: 'revenue500', name: 'Local Favorite', description: 'Earn $500 from customers',
    metric: 'totalRevenue', target: 500,
    reward: { type: 'unlockRecipes', recipeIds: ['tunaVeggieBowl', 'chickenStew'] },
    rewardLabel: 'Unlocks Tuna Veggie Bowl & Chicken Stew',
  },
  {
    id: 'serve75', name: 'Steady Growth', description: 'Serve 75 guests',
    metric: 'customersServed', target: 75,
    reward: { type: 'unlockStove', stoveType: 'stoveIII' },
    rewardLabel: 'Unlocks Stove III (3 slots, cooks 60% faster)',
  },
  {
    id: 'revenue2000', name: 'Regional Reputation', description: 'Earn $2,000 from customers',
    metric: 'totalRevenue', target: 2000,
    reward: { type: 'unlockRecipes', recipeIds: ['cowSteak'] },
    rewardLabel: 'Unlocks Cow Steak',
  },
  {
    id: 'serve200', name: 'The Big Leagues', description: 'Serve 200 guests',
    metric: 'customersServed', target: 200,
    reward: { type: 'unlockRecipes', recipeIds: ['lobsterFeast'] },
    rewardLabel: 'Unlocks Lobster Feast',
  },
  {
    id: 'revenue10000', name: 'Restaurant Empire', description: 'Earn $10,000 from customers',
    metric: 'totalRevenue', target: 10000,
    reward: { type: 'money', amount: 1000 },
    rewardLabel: '+$1,000 bonus',
  },
];

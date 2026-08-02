// Sequential milestones — cash-only bonuses, fully separate from unlocking. Only the current
// one (Game.achievementIndex) is tracked; completing it immediately unlocks the next.
// Content unlocks (appliances, recipes) come from restaurantLevel instead — see
// data/levels.js / game/leveling.js. Thresholds and rewards escalate down the list on
// purpose — early ones are quick, later ones take a lot more play (and revenue) to reach.
//
// metric is a key into Game.stats:
//  - customersServed: lifetime count of customers who paid and left happy
//  - totalRevenue: lifetime $ paid by customers (not counting selling items back, or
//    achievement/level cash rewards themselves)

export const ACHIEVEMENTS = [
  {
    id: 'first10', name: 'First Customers', description: 'Serve 10 guests',
    metric: 'customersServed', target: 10,
    reward: { type: 'money', amount: 150 },
    rewardLabel: '+$150 bonus',
  },
  {
    id: 'serve25', name: 'Getting Busy', description: 'Serve 25 guests',
    metric: 'customersServed', target: 25,
    reward: { type: 'money', amount: 300 },
    rewardLabel: '+$300 bonus',
  },
  {
    id: 'revenue500', name: 'Local Favorite', description: 'Earn $500 from customers',
    metric: 'totalRevenue', target: 500,
    reward: { type: 'money', amount: 500 },
    rewardLabel: '+$500 bonus',
  },
  {
    id: 'serve75', name: 'Steady Growth', description: 'Serve 75 guests',
    metric: 'customersServed', target: 75,
    reward: { type: 'money', amount: 800 },
    rewardLabel: '+$800 bonus',
  },
  {
    id: 'revenue2000', name: 'Regional Reputation', description: 'Earn $2,000 from customers',
    metric: 'totalRevenue', target: 2000,
    reward: { type: 'money', amount: 1200 },
    rewardLabel: '+$1,200 bonus',
  },
  {
    id: 'serve200', name: 'The Big Leagues', description: 'Serve 200 guests',
    metric: 'customersServed', target: 200,
    reward: { type: 'money', amount: 1800 },
    rewardLabel: '+$1,800 bonus',
  },
  {
    id: 'revenue10000', name: 'Restaurant Empire', description: 'Earn $10,000 from customers',
    metric: 'totalRevenue', target: 10000,
    reward: { type: 'money', amount: 2500 },
    rewardLabel: '+$2,500 bonus',
  },
];

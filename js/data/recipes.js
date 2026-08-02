// Cookable recipes — customers always try the priciest recipe first and work their way
// down until they find one whose ingredients are all available; rice needs none, so it's
// always the floor. Cooking never costs money — customers only ever pay the price.
// `ingredients` is a list of { name, qty } — combo dishes just list more than one. Every
// recipe cooks the same simple way: a chef fetches from the fridge, then cooks it at a
// stove (see entities/staffRoles/chef.js) — no per-ingredient assembly steps.
// `cookTime` is tiered by ingredient count (kept between 5s and 15s on purpose — anything
// longer just sits there): 0 ingredients (rice) = 5s, 1 = 7s, 2 = 10s, 3 = 13s, 4 = 15s.

export const RECIPES = [
  { id: 'roastChicken', name: 'Roast Chicken', icon: '🍗', price: 15, cookTime: 7000, ingredients: [{ name: 'chicken', qty: 1 }], enabled: true },
  { id: 'bread', name: 'Bread', icon: '🍞', price: 12, cookTime: 10000, ingredients: [{ name: 'wheat', qty: 1 }, { name: 'water', qty: 1 }], enabled: true },
  { id: 'rice', name: 'Rice', icon: '🍚', price: 5, cookTime: 5000, ingredients: [], enabled: true },
  { id: 'tomatoSoup', name: 'Tomato Soup', icon: '🍲', price: 20, cookTime: 10000, ingredients: [{ name: 'tomato', qty: 1 }, { name: 'water', qty: 1 }], enabled: true },
  { id: 'salad', name: 'Salad', icon: '🥗', price: 22, cookTime: 7000, ingredients: [{ name: 'cabbage', qty: 1 }], enabled: true },
  { id: 'grilledCorn', name: 'Grilled Corn', icon: '🌽', price: 24, cookTime: 7000, ingredients: [{ name: 'corn', qty: 1 }], enabled: true },
  { id: 'bakedPotato', name: 'Baked Potato', icon: '🥔', price: 26, cookTime: 10000, ingredients: [{ name: 'potato', qty: 1 }, { name: 'water', qty: 1 }], enabled: true },
  { id: 'carrotSoup', name: 'Carrot Soup', icon: '🥕', price: 28, cookTime: 10000, ingredients: [{ name: 'carrot', qty: 1 }, { name: 'water', qty: 1 }], enabled: true },
  { id: 'onionRings', name: 'Onion Rings', icon: '🧅', price: 30, cookTime: 7000, ingredients: [{ name: 'onion', qty: 1 }], enabled: true },
  { id: 'pumpkinPie', name: 'Pumpkin Pie', icon: '🥧', price: 32, cookTime: 7000, ingredients: [{ name: 'pumpkin', qty: 1 }], enabled: true },
  { id: 'freshMilk', name: 'Fresh Milk', icon: '🥛', price: 10, cookTime: 7000, ingredients: [{ name: 'milk', qty: 1 }], enabled: true },
  // combo dishes — at least two ingredients each, priced well above anything single-ingredient
  { id: 'surfTurf', name: 'Surf & Turf', icon: '🥩', price: 45, cookTime: 10000, ingredients: [{ name: 'chicken', qty: 1 }, { name: 'shrimp', qty: 1 }], enabled: true },
  // absorbed Garden Medley's ingredients (tomato, cabbage, corn) — that recipe no longer
  // exists separately. 6 ingredients is above the 4-tier cookTime scale below, so it's
  // just capped at the hard 15s ceiling like everything else that hits it.
  { id: 'farmhouseStew', name: 'Farmhouse Stew', icon: '🥘', price: 42, cookTime: 15000, ingredients: [{ name: 'wheat', qty: 1 }, { name: 'potato', qty: 1 }, { name: 'water', qty: 1 }, { name: 'tomato', qty: 1 }, { name: 'cabbage', qty: 1 }, { name: 'corn', qty: 1 }], enabled: true },
  { id: 'seafoodChowder', name: 'Seafood Chowder', icon: '🍜', price: 58, cookTime: 15000, ingredients: [{ name: 'shrimp', qty: 1 }, { name: 'corn', qty: 1 }, { name: 'potato', qty: 1 }, { name: 'water', qty: 1 }], enabled: true },
  { id: 'rootVeggieSkewers', name: 'Roasted Root Vegetables', icon: '🍢', price: 48, cookTime: 13000, ingredients: [{ name: 'carrot', qty: 1 }, { name: 'onion', qty: 1 }, { name: 'potato', qty: 1 }], enabled: true },
  { id: 'salmonChowder', name: 'Creamy Salmon Chowder', icon: '🥣', price: 60, cookTime: 13000, ingredients: [{ name: 'salmon', qty: 1 }, { name: 'potato', qty: 1 }, { name: 'milk', qty: 1 }], enabled: true },
  { id: 'pumpkinHarvestPie', name: 'Pumpkin Harvest Pie', icon: '🥮', price: 52, cookTime: 13000, ingredients: [{ name: 'pumpkin', qty: 1 }, { name: 'wheat', qty: 1 }, { name: 'milk', qty: 1 }], enabled: true },
  // fish dishes always need at least one non-fish ingredient too (or several other fish) —
  // that's what justifies fishermen costing more to hire than service staff. All locked —
  // unlocked in sequence by achievements (see data/achievements.js).
  { id: 'mayoShrimp', name: 'Mayo Shrimp', icon: '🍤', price: 34, cookTime: 10000, ingredients: [{ name: 'shrimp', qty: 1 }, { name: 'egg', qty: 2 }], enabled: true, locked: true },
  { id: 'codAndPotato', name: 'Cod & Potato', icon: '🐟', price: 38, cookTime: 10000, ingredients: [{ name: 'cod', qty: 1 }, { name: 'potato', qty: 1 }], enabled: true, locked: true },
  { id: 'tunaVeggieBowl', name: 'Tuna Veggie Bowl', icon: '🍱', price: 46, cookTime: 13000, ingredients: [{ name: 'tuna', qty: 1 }, { name: 'carrot', qty: 1 }, { name: 'onion', qty: 1 }], enabled: true, locked: true },
  { id: 'lobsterFeast', name: 'Lobster Feast', icon: '🦞', price: 95, cookTime: 15000, ingredients: [{ name: 'shrimp', qty: 1 }, { name: 'salmon', qty: 1 }, { name: 'cod', qty: 1 }, { name: 'tuna', qty: 1 }], enabled: true, locked: true },
  // meat combos — meat's easier to come by than fish, so these cost less than the fish combos
  { id: 'cowSteak', name: 'Cow Steak', icon: '🥩', price: 50, cookTime: 13000, ingredients: [{ name: 'beef', qty: 1 }, { name: 'potato', qty: 1 }, { name: 'carrot', qty: 1 }], enabled: true, locked: true },
  { id: 'chickenStew', name: 'Chicken Stew', icon: '🍲', price: 40, cookTime: 13000, ingredients: [{ name: 'chicken', qty: 1 }, { name: 'potato', qty: 1 }, { name: 'onion', qty: 1 }], enabled: true, locked: true },
];

export function getRecipe(id) { return RECIPES.find(r => r.id === id); }

// locked recipes (see data/achievements.js rewards) aren't cookable, orderable, or even
// listed in the Recipes tab until their unlock lands
export function isRecipeUnlocked(game, recipe) {
  return !recipe.locked || game.unlockedRecipes.has(recipe.id);
}

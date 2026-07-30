// Cookable recipes — customers always try the priciest recipe first and work their way
// down until they find one whose ingredients are all available; rice needs none, so it's
// always the floor. Cooking never costs money — customers only ever pay the price.
// `ingredients` is a list of { name, qty } — combo dishes just list more than one.

export const RECIPES = [
  { id: 'roastChicken', name: 'Roast Chicken', icon: '🍗', price: 15, cookTime: 9000, ingredients: [{ name: 'chicken', qty: 1 }], enabled: true },
  { id: 'bread', name: 'Bread', icon: '🍞', price: 8, cookTime: 10000, ingredients: [{ name: 'wheat', qty: 1 }], enabled: true },
  { id: 'shrimp', name: 'Shrimp', icon: '🦐', price: 8, cookTime: 7000, ingredients: [{ name: 'shrimp', qty: 1 }], enabled: true },
  { id: 'rice', name: 'Rice', icon: '🍚', price: 5, cookTime: 8000, ingredients: [], enabled: true },
  { id: 'tomatoSoup', name: 'Tomato Soup', icon: '🍲', price: 20, cookTime: 35000, ingredients: [{ name: 'tomato', qty: 1 }], enabled: true },
  { id: 'salad', name: 'Salad', icon: '🥗', price: 22, cookTime: 18000, ingredients: [{ name: 'cabbage', qty: 1 }], enabled: true },
  { id: 'grilledCorn', name: 'Grilled Corn', icon: '🌽', price: 24, cookTime: 22000, ingredients: [{ name: 'corn', qty: 1 }], enabled: true },
  { id: 'bakedPotato', name: 'Baked Potato', icon: '🥔', price: 26, cookTime: 25000, ingredients: [{ name: 'potato', qty: 1 }], enabled: true },
  // combo dishes — at least two ingredients each, priced well above anything single-ingredient
  { id: 'surfTurf', name: 'Surf & Turf', icon: '🥩', price: 45, cookTime: 26000, ingredients: [{ name: 'chicken', qty: 1 }, { name: 'shrimp', qty: 1 }], enabled: true },
  { id: 'farmhouseStew', name: 'Farmhouse Stew', icon: '🥘', price: 42, cookTime: 28000, ingredients: [{ name: 'wheat', qty: 1 }, { name: 'potato', qty: 1 }], enabled: true },
  { id: 'gardenMedley', name: 'Garden Medley', icon: '🍛', price: 55, cookTime: 32000, ingredients: [{ name: 'tomato', qty: 1 }, { name: 'cabbage', qty: 1 }, { name: 'corn', qty: 1 }], enabled: true },
  { id: 'seafoodChowder', name: 'Seafood Chowder', icon: '🍜', price: 58, cookTime: 34000, ingredients: [{ name: 'shrimp', qty: 1 }, { name: 'corn', qty: 1 }, { name: 'potato', qty: 1 }], enabled: true },
];

export function getRecipe(id) { return RECIPES.find(r => r.id === id); }

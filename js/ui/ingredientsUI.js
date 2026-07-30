// Always-visible fridge stock box (below the money box)

export const INGREDIENT_ICON = {
  wheat: '🌾', shrimp: '🦐', chicken: '🍗', tomato: '🍅', cabbage: '🥬', corn: '🌽', potato: '🥔',
  carrot: '🥕', onion: '🧅', pumpkin: '🎃', salmon: '🐟', milk: '🥛',
  cod: '🐟', tuna: '🐟', egg: '🥚', beef: '🥩',
};

// only ingredients you actually have any of are listed
export function renderIngredientsBox(game) {
  const list = document.getElementById('ingredientsList');
  if (!list) return;
  const keys = Object.keys(game.ingredients).filter(k => (game.ingredients[k] || 0) > 0);
  if (keys.length === 0) {
    list.innerHTML = '<div class="ingredientEmpty">None yet.</div>';
    return;
  }
  list.innerHTML = '';
  keys.forEach(key => {
    const div = document.createElement('div');
    div.className = 'ingredientRow';
    div.innerHTML = `<span>${INGREDIENT_ICON[key] || '❔'} ${key}</span><span>${game.ingredients[key]}</span>`;
    list.appendChild(div);
  });
}

// Recipes tab: enable/disable which dishes customers can order

import { RECIPES, getRecipe } from '../data/recipes.js';
import { INGREDIENT_ICON } from './ingredientsUI.js';

export function renderRecipeTable(game) {
  const tbody = document.querySelector('#recipeTable tbody');
  tbody.innerHTML = '';
  RECIPES.forEach(r => {
    const needs = r.ingredients.length > 0
      ? r.ingredients.map(ing => `${INGREDIENT_ICON[ing.name] || ''} ${ing.name}${ing.qty > 1 ? ' x' + ing.qty : ''}`).join(', ')
      : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.icon}</td><td>${r.name}</td><td>${needs}</td><td>$${r.price}</td><td>${(r.cookTime / 1000).toFixed(1)}s</td>
      <td><input type="checkbox" ${r.enabled ? 'checked' : ''} data-id="${r.id}" class="recipeToggle"></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.recipeToggle').forEach(cb => {
    cb.addEventListener('change', () => {
      const r = getRecipe(cb.dataset.id);
      r.enabled = cb.checked;
    });
  });
}

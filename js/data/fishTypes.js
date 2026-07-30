// Every catch a fisherman can pull from the water — picked at random per catch (weighted so
// the common one dominates and the rarer, pricier one shows up now and then). Fish aren't
// grid objects (there's no "fish farm" plot), so this is a lightweight data config rather
// than a full objects/ type, unlike crops or ranch animals.

export const FISH_TYPES = [
  { ingredient: 'shrimp', weight: 6 },
  { ingredient: 'salmon', weight: 2 },
  { ingredient: 'cod', weight: 2 },
  { ingredient: 'tuna', weight: 1 },
];

export function pickFishCatch() {
  const total = FISH_TYPES.reduce((sum, f) => sum + f.weight, 0);
  let r = Math.random() * total;
  for (const f of FISH_TYPES) {
    if (r < f.weight) return f.ingredient;
    r -= f.weight;
  }
  return FISH_TYPES[0].ingredient;
}

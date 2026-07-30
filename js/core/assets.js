// Image loading — generic loader/cache used both for the grass background and for each
// object type's own pixel-art icon (see each js/objects/*.js file's `image` field, and
// js/objects/registry.js's getIconImageForType).

import { ROWS, COLS } from './constants.js';

// generic memoized image loader — shared by icon images and the grass background
const _imageCache = {};
export function getImage(src) {
  if (!_imageCache[src]) {
    const img = new Image();
    img.src = src;
    _imageCache[src] = img;
  }
  return _imageCache[src];
}

// the undeveloped ground everywhere a floor tile hasn't been placed — 4 hand-drawn variants
// picked at random per cell (weighted so the plain one dominates and the decorated ones,
// which have visible detail, only show up here and there for texture)
export const GRASS_VARIANTS = [
  { src: 'ASSETS/GRASS.png', weight: 6 },
  { src: 'ASSETS/GRASS2.png', weight: 1 },
  { src: 'ASSETS/GRASS3.png', weight: 1 },
  { src: 'ASSETS/GRASS4.png', weight: 1 },
];
export function pickGrassVariant() {
  const total = GRASS_VARIANTS.reduce((sum, v) => sum + v.weight, 0);
  let r = Math.random() * total;
  for (const v of GRASS_VARIANTS) {
    if (r < v.weight) return v.src;
    r -= v.weight;
  }
  return GRASS_VARIANTS[0].src;
}

// fixed per-cell grass look, generated once and shared by every new World so it doesn't
// flicker/reshuffle between frames or on world reset
export function makeGrassVariantGrid() {
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    const row = [];
    for (let x = 0; x < COLS; x++) row.push(pickGrassVariant());
    grid.push(row);
  }
  return grid;
}

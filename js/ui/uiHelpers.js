// Small rendering helpers shared across UI panels

import { getObjectType } from '../objects/registry.js';

// an object type with a pixel-art replacement (see each js/objects/*.js file's `image`
// field) renders as an <img>; everything else keeps using its emoji, unchanged
export function iconHtml(type, iconChar, className) {
  const src = getObjectType(type)?.image;
  return src
    ? `<img class="pixelIcon" src="${src}" alt="">`
    : `<span class="${className}">${iconChar}</span>`;
}

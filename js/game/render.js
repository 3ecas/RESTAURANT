// All canvas drawing: background, floor tiles, placed objects, characters, held-item preview.
// Per-type visuals (color/icon/progress bars/badges) come from js/objects/registry.js —
// this file only knows how to lay a tile/character out, not what any specific type looks like.

import { COLS, ROWS, CELL, SCALE } from '../core/constants.js';
import { getImage } from '../core/assets.js';
import { getObjectType, getIconImageForType, FLOOR_TILE_TYPES } from '../objects/registry.js';
import { getRecipe } from '../data/recipes.js';
import { CARRY_ICONS } from '../data/carryIcons.js';
import { roundRect, badge, iconBadge } from './drawHelpers.js';

export const ROLE_COLOR = { waiter: '#3fae55', chef: '#f5f5f5', cleaner: '#1a1a1a', farmer: '#c9a227', rancher: '#8b5e3c', fisherman: '#3f8fae' };
export const ROLE_OUTLINE = { waiter: '#245c30', chef: '#999999', cleaner: '#666666', farmer: '#7a621a', rancher: '#5a3c22', fisherman: '#245a70' };
export const PLAYER_COLOR = '#3f7fff';
export const PLAYER_OUTLINE = '#1f3f99';
export const CUSTOMER_COLOR = '#9e9e9e';
export const CUSTOMER_OUTLINE = '#5a5a5a';

// the undeveloped ground everywhere — bottom-most layer, below placed floor tiles/objects/characters
function drawGrassBackground(ctx, world) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const img = getImage(world.grassVariant[y][x]);
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x * CELL, y * CELL, CELL, CELL);
      } else {
        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }
}

// flooring the player has bought and placed — sits above the grass, below everything else
function drawFloorTiles(ctx, world) {
  for (const [key, type] of world.floorTiles) {
    const [x, y] = key.split(',').map(Number);
    const img = getIconImageForType(type);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x * CELL, y * CELL, CELL, CELL);
    } else {
      ctx.fillStyle = '#8a6b3f';
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
  }
}

// one open field, buildable everywhere — just an outline around the whole playable area
function drawGrid(ctx) {
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, COLS * CELL - 2, ROWS * CELL - 2);
}

function drawWater(ctx, world) {
  ctx.fillStyle = '#3a6ea5';
  for (const key of world.water) {
    const [x, y] = key.split(',').map(Number);
    ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }
}

function drawObject(ctx, obj) {
  const t = getObjectType(obj.type);
  if (!t) return;
  const px = obj.x * CELL, py = obj.y * CELL;
  const icon = t.getIcon ? t.getIcon(obj) : t.icon;

  const img = getIconImageForType(obj.type);
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, px, py, CELL, CELL);
  } else {
    ctx.fillStyle = t.color;
    roundRect(ctx, px + 2, py + 2, CELL - 4, CELL - 4, 5);
    ctx.fill();
    ctx.font = Math.floor(CELL * 0.6) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, px + CELL / 2, py + CELL / 2);
  }

  if (t.drawExtra) t.drawExtra(ctx, obj, px, py, CELL);
}

function drawCarried(ctx, px, py, carrying) {
  if (!carrying) return;
  const recipe = carrying.recipe ? getRecipe(carrying.recipe) : null;
  const icon = (carrying.kind === 'cooked' && recipe) ? recipe.icon : (CARRY_ICONS[carrying.kind] || '?');
  iconBadge(ctx, px, py - 17 * SCALE, icon, '#2f2a22');
  if (carrying.count > 1) badge(ctx, px + 10 * SCALE, py - 24 * SCALE, carrying.count, '#3f7fff');
}

function drawCharacter(ctx, px, py, color, outline, carrying, label) {
  ctx.beginPath();
  ctx.arc(px, py, 10 * SCALE, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5 * SCALE;
  ctx.strokeStyle = outline;
  ctx.stroke();
  drawCarried(ctx, px, py, carrying);
  if (label) {
    ctx.font = Math.round(8 * SCALE) + 'px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, px, py + 16 * SCALE);
  }
}

function drawCustomer(ctx, c) {
  let bubble = null;
  let isAlert = false;
  if (c.state === 'thinking' || c.state === 'waitingOrder') { bubble = '❗'; isAlert = true; }
  else if (c.state === 'waitingFood') {
    // show what they actually ordered instead of a generic waiting icon
    const recipe = getRecipe(c.order);
    bubble = recipe ? recipe.icon : '⏳';
  }
  drawCharacter(ctx, c.px, c.py, CUSTOMER_COLOR, CUSTOMER_OUTLINE, null);
  if (bubble) {
    iconBadge(ctx, c.px, c.py - 17 * SCALE, bubble, isAlert ? '#ffd76b' : '#2f2a22');
  }
}

function drawHeldPreview(ctx, game) {
  if (!game.heldObject || !game.hoverCell) return;
  const { x, y } = game.hoverCell;
  const type = game.heldObject.type;
  const t = getObjectType(type) || { color: '#888', icon: '❔' };
  // flooring can go down on any non-water cell, occupied or not — everything else
  // still needs a genuinely empty, buildable cell
  const valid = FLOOR_TILE_TYPES.has(type)
    ? game.world.inBounds(x, y) && !game.world.isWater(x, y)
    : game.world.isBuildable(x, y);
  const img = getIconImageForType(type);
  ctx.globalAlpha = 0.6;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x * CELL, y * CELL, CELL, CELL);
    if (!valid) {
      ctx.fillStyle = 'rgba(224,82,82,0.5)';
      roundRect(ctx, x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4, 5);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = valid ? t.color : '#e05252';
    roundRect(ctx, x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4, 5);
    ctx.fill();
    ctx.font = Math.floor(CELL * 0.6) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.icon, x * CELL + CELL / 2, y * CELL + CELL / 2);
  }
  ctx.globalAlpha = 1;
}

export function render(ctx, canvas, game) {
  // clear the physical canvas (viewport-sized) before the world-space transform below —
  // clearRect here isn't affected by the translate since it hasn't been applied yet
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // the world is bigger than the viewport (see core/constants.js) — everything from here
  // down is drawn in world space, shifted by the camera so only the panned-to window shows
  ctx.save();
  ctx.translate(-game.camera.x, -game.camera.y);

  drawGrassBackground(ctx, game.world);
  drawFloorTiles(ctx, game.world);
  drawGrid(ctx);
  drawWater(ctx, game.world);
  for (const obj of game.world.objects) drawObject(ctx, obj);

  const drawables = [
    { py: game.player.py, draw: () => drawCharacter(ctx, game.player.px, game.player.py, PLAYER_COLOR, PLAYER_OUTLINE, game.player.carrying) },
    ...game.world.customers.map(c => ({ py: c.py, draw: () => drawCustomer(ctx, c) })),
    ...game.staff.map(s => ({ py: s.py, draw: () => drawCharacter(ctx, s.px, s.py, ROLE_COLOR[s.role], ROLE_OUTLINE[s.role], s.carrying, s.role) })),
  ];
  drawables.sort((a, b) => a.py - b.py);
  for (const d of drawables) d.draw();

  drawHeldPreview(ctx, game);

  ctx.restore();
}

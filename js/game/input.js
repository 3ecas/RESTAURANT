// Keyboard + mouse wiring: WASD, Space/E/Escape, hover preview, right-click context menu,
// and left-click (place held object, or click-to-move / click-to-interact when empty-handed)

import { CELL } from '../core/constants.js';
import { FLOOR_TILE_TYPES } from '../objects/registry.js';
import { cancelHeldObject } from '../ui/ui.js';
import { showContextMenu, hideContextMenu } from '../ui/contextMenuUI.js';
import { refreshStorageUI } from '../ui/hotbarUI.js';

function canvasCellFromEvent(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  return { gx: Math.floor(mx / CELL), gy: Math.floor(my / CELL) };
}

// after placing one item from a storage stack, keep going — pull the next one of the
// same type straight into hand so multiple can be placed without reopening any menu
function continuePlacingFromStack(game, placedType) {
  game.heldObject = null;
  if (game.heldFromInventory) {
    const idx = game.inventory.findIndex(o => o.type === placedType);
    if (idx !== -1) game.heldObject = game.inventory.splice(idx, 1)[0];
    else game.heldFromInventory = false;
  }
  refreshStorageUI(game);
}

export function setupInput(canvas, game) {
  document.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') e.target.blur();
  });

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(k)) {
      game.keys.add(k);
    } else if (k === ' ') {
      e.preventDefault();
      if (!e.repeat) game.interact();
    } else if (k === 'e') {
      game.toggleMenu();
    } else if (k === 'escape') {
      cancelHeldObject(game);
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(k)) game.keys.delete(k);
  });

  canvas.addEventListener('mousemove', (e) => {
    const { gx, gy } = canvasCellFromEvent(canvas, e);
    game.hoverCell = game.world.inBounds(gx, gy) ? { x: gx, y: gy } : null;
  });
  canvas.addEventListener('mouseleave', () => { game.hoverCell = null; });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (game.heldObject) return;
    const { gx, gy } = canvasCellFromEvent(canvas, e);
    const obj = game.world.cellAt(gx, gy);
    if (!obj) { hideContextMenu(); return; }
    game.contextTarget = obj;
    showContextMenu(game, obj, e.clientX, e.clientY);
  });

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('contextMenu');
    if (menu.classList.contains('hidden')) return;
    if (!menu.contains(e.target)) hideContextMenu();
  });

  document.getElementById('ctxMove').addEventListener('click', () => { if (game.contextTarget) game.relocateObject(game.contextTarget); });
  document.getElementById('ctxStore').addEventListener('click', () => { if (game.contextTarget) game.storeObject(game.contextTarget); });
  document.getElementById('ctxSell').addEventListener('click', () => { if (game.contextTarget) game.sellObject(game.contextTarget); });

  canvas.addEventListener('click', (e) => {
    if (!document.getElementById('contextMenu').classList.contains('hidden')) return;
    const { gx, gy } = canvasCellFromEvent(canvas, e);
    if (!game.world.inBounds(gx, gy)) return;

    if (game.heldObject) {
      // flooring is a background layer, not a world object — it paints onto any
      // in-bounds, non-water cell regardless of what's already placed there
      if (FLOOR_TILE_TYPES.has(game.heldObject.type)) {
        const placedType = game.heldObject.type;
        if (game.world.placeFloorTile(gx, gy, placedType)) continuePlacingFromStack(game, placedType);
        return;
      }
      if (game.world.canPlace(game.heldObject.type, gx, gy)) {
        const placedType = game.heldObject.type;
        game.world.place(game.heldObject, gx, gy);
        continuePlacingFromStack(game, placedType);
      }
      return;
    }

    // not holding anything: left-click to walk there, or to walk up to an object and
    // auto-interact with it (same effect as walking up and pressing SPACE)
    const obj = game.world.cellAt(gx, gy);
    if (obj) {
      const path = game.world.pathToAdjacent(game.player.cellX, game.player.cellY, gx, gy);
      if (path) {
        game.player.setPath(path);
        game.player.pendingInteractTarget = obj;
      }
    } else if (game.world.isWalkable(gx, gy)) {
      const path = game.world.pathTo(game.player.cellX, game.player.cellY, gx, gy);
      if (path) {
        game.player.setPath(path);
        game.player.pendingInteractTarget = null;
      }
    }
  });
}

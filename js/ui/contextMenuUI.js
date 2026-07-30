// Right-click context menu on a placed object (Move / Store / Sell)

import { getItemDef, getObjectType } from '../objects/registry.js';

export function showContextMenu(game, obj, clientX, clientY) {
  const menu = document.getElementById('contextMenu');
  const moveBtn = document.getElementById('ctxMove');
  const storeBtn = document.getElementById('ctxStore');
  const sellBtn = document.getElementById('ctxSell');

  const canMove = game.canMoveObject(obj);
  const canRemove = game.canRemoveObject(obj);
  moveBtn.disabled = !canMove;
  storeBtn.disabled = !canRemove;
  sellBtn.disabled = !canRemove;
  moveBtn.title = canMove ? '' : 'In use — cannot move right now';
  const removeTitle = canRemove ? '' : 'In use — cannot store/sell right now';
  storeBtn.title = removeTitle;
  sellBtn.title = removeTitle;

  const def = getItemDef(obj.type);
  sellBtn.style.display = def ? '' : 'none';
  // a type can opt out of storing (see objects/door.js: movable only, since the restaurant
  // must always have one — no store/sell)
  const t = getObjectType(obj.type);
  storeBtn.style.display = (t && t.storable === false) ? 'none' : '';
  menu.classList.remove('hidden');
  menu.style.left = clientX + 'px';
  menu.style.top = clientY + 'px';

  // reposition if it would overflow the viewport
  requestAnimationFrame(() => {
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
  });
}

export function hideContextMenu() {
  document.getElementById('contextMenu').classList.add('hidden');
}

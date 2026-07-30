// Entry point: boots the canvas, the Game instance, UI, input, and the render loop.

import { COLS, ROWS, CELL } from './core/constants.js';
import { Game } from './game/game.js';
import { initUI } from './ui/ui.js';
import { setupInput } from './game/input.js';
import { render } from './game/render.js';

const canvas = document.getElementById('gameCanvas');
canvas.width = COLS * CELL;
canvas.height = ROWS * CELL;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // keep pixel-art sprites crisp when scaled to fill a cell

const game = new Game();
initUI(game);
setupInput(canvas, game);

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  game.update(dt);
  render(ctx, canvas, game);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

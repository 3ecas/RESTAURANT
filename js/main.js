// Entry point: boots the canvas, the Game instance, UI, input, and the render loop.

import { COLS, ROWS, CELL } from './core/constants.js';
import { Game } from './game/game.js';
import { initUI } from './ui/ui.js';
import { setupInput } from './game/input.js';
import { render } from './game/render.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false; // keep pixel-art sprites crisp when scaled to fill a cell

const game = new Game();

// the viewport fills the whole browser window, capped at the world's own pixel size (no
// point in a canvas bigger than the world it's showing) — re-synced on every resize so
// the camera clamp (see Game.setViewportSize) always matches what's actually on screen
function resizeCanvas() {
  canvas.width = Math.min(window.innerWidth, COLS * CELL);
  canvas.height = Math.min(window.innerHeight, ROWS * CELL);
  game.setViewportSize(canvas.width, canvas.height);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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

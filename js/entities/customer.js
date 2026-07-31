// A seated (or waiting-at-door) customer: order → wait → eat → pay (instant, on the spot) → leave

import { Mover } from './mover.js';
import { RECIPES, getRecipe, isRecipeUnlocked } from '../data/recipes.js';
import { THINK_TIME, EAT_TIME } from '../data/balance.js';

let _custId = 1;

export class Customer extends Mover {
  constructor(x, y) {
    super(x, y);
    this.id = _custId++;
    this.state = 'walkingToSeat'; // waitingAtDoor, walkingToSeat, thinking, waitingOrder, waitingFood, eating, leaving, done
    this.timer = 0;
    this.order = null;
    this.chair = null;
    this.table = null;
    this.claimed = false;
    this.deliveryClaimed = false; // reserved by a waiter who's bringing this exact order
    this.speed = 40;
  }

  update(dt, world, game) {
    this.stepMove(dt);
    switch (this.state) {
      case 'waitingAtDoor':
        break; // handled externally by Game's seat promotion
      case 'walkingToSeat':
        if (!this.hasPath) {
          if (this.gx === this.chair.x && this.gy === this.chair.y) {
            this.state = 'thinking';
            this.timer = THINK_TIME;
          } else {
            this.setPath([{ x: this.chair.x, y: this.chair.y }]);
          }
        }
        break;
      case 'thinking':
        this.timer -= dt;
        if (this.timer <= 0) {
          // always reach for the priciest recipe first, falling back to cheaper ones whose
          // ingredient isn't in stock (or the till can't cover the cost) — plain rice needs
          // neither, so it's the floor. Deciding immediately reserves the ingredient/cost so
          // a second customer can't also "order" the last unit of something already spoken for.
          const enabled = RECIPES.filter(r => r.enabled && isRecipeUnlocked(game, r)).sort((a, b) => b.price - a.price);
          const affordable = enabled.find(r => game.canCookRecipe(r.id));
          const fallback = enabled[enabled.length - 1] || RECIPES.find(r => r.id === 'rice') || RECIPES[0];
          this.order = (affordable || fallback).id;
          game.commitRecipe(this.order);
          this.state = 'waitingOrder';
          this.claimed = false;
        }
        break;
      case 'waitingOrder':
      case 'waitingFood':
        break;
      case 'eating':
        this.timer -= dt;
        if (this.timer <= 0) {
          this.table.dirty = true;
          this.table.claimedDirty = false;
          this.chair.occupied = null;
          // paying is instant, on the spot — no booth to walk to. A little "+$X" gold text
          // pops up over their head and fades out to make the payment feel tangible.
          const recipe = getRecipe(this.order);
          game.addMoney(recipe.price);
          game.spawnFloatingText(this.px, this.py, '+$' + recipe.price, '#ffd700');
          // achievements track lifetime totals here, at the moment the customer actually pays
          game.stats.customersServed += 1;
          game.stats.totalRevenue += recipe.price;
          this.state = 'leaving';
          const ec = world.nearestEntranceCell(this.gx, this.gy);
          const path = world.pathTo(this.gx, this.gy, ec.x, ec.y);
          this.setPath(path || []);
        }
        break;
      case 'leaving':
        if (!this.hasPath) this.state = 'done';
        break;
    }
  }
}

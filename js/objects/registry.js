// Central registry — aggregates every object type file into the lookups the rest of the
// game needs (shop listing, factory, walkthrough/seating sets, farm-crop list, images).
// Adding a new placeable type means: write js/objects/yourType.js, add it to the import
// list below. Nothing else needs to change.

import { getImage } from '../core/assets.js';

import { fridge } from './fridge.js';
import { stove } from './stove.js';
import { orderStand } from './orderStand.js';
import { sink } from './sink.js';
import { payingBooth } from './payingBooth.js';
import { table } from './table.js';
import { chair } from './chair.js';
import { wall } from './wall.js';
import { door } from './door.js';
import { farmPlot } from './farmPlot.js';
import { tomatoFarm } from './tomatoFarm.js';
import { cabbageFarm } from './cabbageFarm.js';
import { cornFarm } from './cornFarm.js';
import { potatoFarm } from './potatoFarm.js';
import { freezer } from './freezer.js';
import { chicken } from './chicken.js';
import { chickenFeeder } from './chickenFeeder.js';
import { animalShack } from './animalShack.js';
import { spawnPoint } from './spawnPoint.js';
import { floorTile } from './floorTile.js';
import { floorTileBW } from './floorTileBW.js';

export const OBJECT_TYPES = [
  fridge, stove, orderStand, sink, payingBooth,
  table, chair, wall, door,
  farmPlot, tomatoFarm, cabbageFarm, cornFarm, potatoFarm,
  freezer, chicken, chickenFeeder, animalShack,
  spawnPoint, floorTile, floorTileBW,
];

const BY_TYPE = new Map(OBJECT_TYPES.map(t => [t.type, t]));

export function getObjectType(type) {
  return BY_TYPE.get(type);
}

// every type with a cost is purchasable in the shop/hotbar — the type definition itself
// doubles as its "item def" (name/icon/cost are all right there on it)
export const ITEM_DEFS = OBJECT_TYPES.filter(t => t.cost != null);
export function getItemDef(type) {
  const t = getObjectType(type);
  return t && t.cost != null ? t : undefined;
}

export const FLOOR_TILE_TYPES = new Set(OBJECT_TYPES.filter(t => t.isFloor).map(t => t.type));
export const WALKTHROUGH_TYPES = new Set(OBJECT_TYPES.filter(t => t.walkthrough).map(t => t.type));
export const SEATING_SURFACE_TYPES = new Set(OBJECT_TYPES.filter(t => t.seatingSurface).map(t => t.type));

// full type definitions (not just names) — farmer.js/game.js need both the grid type name
// (t.type) and the ingredient it produces (t.crop)
export const FARM_CROP_TYPES = OBJECT_TYPES.filter(t => t.crop);

let _objId = 1;
export function createObject(type) {
  const base = { type, x: 0, y: 0, id: _objId++ };
  const t = getObjectType(type);
  return t && t.createState ? t.createState(base) : base;
}

export function getIconImageForType(type) {
  const t = getObjectType(type);
  return t && t.image ? getImage(t.image) : null;
}

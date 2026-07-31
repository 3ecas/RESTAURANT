// Central registry — aggregates every object type file into the lookups the rest of the
// game needs (shop listing, factory, walkthrough/seating sets, farm-crop list, images).
// Adding a new placeable type means: write js/objects/yourType.js, add it to the import
// list below. Nothing else needs to change.

import { getImage } from '../core/assets.js';

import { fridge } from './fridge.js';
import { stove } from './stove.js';
import { stoveII } from './stoveII.js';
import { stoveIII } from './stoveIII.js';
import { oven } from './oven.js';
import { waterTap } from './waterTap.js';
import { prepCounter } from './prepCounter.js';
import { orderStand } from './orderStand.js';
import { sink } from './sink.js';
import { table } from './table.js';
import { chair } from './chair.js';
import { counter } from './counter.js';
import { wall } from './wall.js';
import { windowWall } from './windowWall.js';
import { door } from './door.js';
import { farmPlot } from './farmPlot.js';
import { tomatoFarm } from './tomatoFarm.js';
import { cabbageFarm } from './cabbageFarm.js';
import { cornFarm } from './cornFarm.js';
import { potatoFarm } from './potatoFarm.js';
import { carrotFarm } from './carrotFarm.js';
import { onionFarm } from './onionFarm.js';
import { pumpkinFarm } from './pumpkinFarm.js';
import { freezer } from './freezer.js';
import { chicken } from './chicken.js';
import { chickenFeeder } from './chickenFeeder.js';
import { cow } from './cow.js';
import { cowFeeder } from './cowFeeder.js';
import { animalShack } from './animalShack.js';
import { floorTile } from './floorTile.js';
import { floorTileBW } from './floorTileBW.js';
import { roundTable } from './roundTable.js';
import { oakChair } from './oakChair.js';
import { pottedPlant } from './pottedPlant.js';

export const OBJECT_TYPES = [
  fridge, stove, stoveII, stoveIII, oven, waterTap, prepCounter, orderStand, sink,
  table, chair, counter, wall, windowWall, door,
  roundTable, oakChair, pottedPlant,
  farmPlot, tomatoFarm, cabbageFarm, cornFarm, potatoFarm, carrotFarm, onionFarm, pumpkinFarm,
  freezer, chicken, chickenFeeder, cow, cowFeeder, animalShack,
  floorTile, floorTileBW,
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
export const CHAIR_TYPES = new Set(OBJECT_TYPES.filter(t => t.isChair).map(t => t.type));

// full type definitions (not just names) — farmer.js/game.js need both the grid type name
// (t.type) and the ingredient it produces (t.crop)
export const FARM_CROP_TYPES = OBJECT_TYPES.filter(t => t.crop);

// full type definitions for every ranch animal (chicken, cow, ...) — rancher.js/game.js need
// the grid type name plus its feeder/yield config (see objects/shared/ranchAnimalFactory.js)
export const ANIMAL_TYPES = OBJECT_TYPES.filter(t => t.isAnimal);

// full type definitions for every stove tier — chef.js/game.js need the grid type name plus
// its slot/speed config (see objects/shared/stoveFactory.js)
export const STOVE_TYPES = OBJECT_TYPES.filter(t => t.isStove);

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

// like getIconImageForType, but lets a type compute its image dynamically from its own
// position/neighbors instead of a fixed path — see objects/wall.js's getImageSrc, which
// picks a horizontal- vs vertical-run sprite based on which way its neighboring walls
// extend. `obj` only needs `.type`, `.x`, `.y` — a placement-preview stand-in works fine.
export function getIconImageForObject(obj, world) {
  const t = getObjectType(obj.type);
  if (!t) return null;
  const src = t.getImageSrc ? t.getImageSrc(obj, world) : t.image;
  return src ? getImage(src) : null;
}

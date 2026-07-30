// Wood floor — background layer, not a grid object (see World.placeFloorTile). Cheap
// staple, so it restocks to a fixed amount instead of the usual random 0-3.

export const floorTile = {
  type: 'floorTile',
  name: 'Wood Floor',
  icon: '🟫',
  cost: 3,
  category: 'Flooring',
  isFloor: true,
  fixedStock: 15,
  image: 'ASSETS/WOODEN FLOOR.png',
};

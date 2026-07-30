// Black & white floor — background layer, not a grid object (see World.placeFloorTile).
// Cheap staple, so it restocks to a fixed amount instead of the usual random 0-3.

export const floorTileBW = {
  type: 'floorTileBW',
  name: 'B&W Floor',
  icon: '⬜',
  cost: 3,
  category: 'Flooring',
  isFloor: true,
  fixedStock: 15,
  image: 'ASSETS/BLACK WHITE FLOOR.png',
};

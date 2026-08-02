// Restaurant-wide leveling — 100 levels, driven entirely by lifetime revenue (see
// game/leveling.js's checkLevelUp, called from Game.update). This is the primary content
// gate now: appliances/recipes unlock here, not through achievements (see data/achievements.js,
// which is a fully separate, cash-only milestone system as of this file's introduction).
//
// xpForLevel(n) gives the CUMULATIVE revenue needed to REACH level n (level 1 is free — you
// start there). Same quadratic-ish shape as staffEconomy.js's staffTrainCost, just stretched
// across a fixed 100-level curve instead of an uncapped per-step cost: cheap early (level 5
// is a few thousand dollars, well within a first session), unbounded-feeling late (level 100
// is millions — realistically months of casual play), matching the "played over weeks/months"
// pacing already established for staff training (see data/staffConfig.js).
export const MAX_LEVEL = 100;

const XP_BASE = 200;
const XP_POWER = 2.3;
export function xpForLevel(n) {
  return Math.round(XP_BASE * Math.pow(n - 1, XP_POWER));
}

// current level's progress toward the next one — shared by the Levels tab (ui/levelsUI.js)
// and the always-visible XP bar (ui/statusUI.js) so this math only lives in one place
export function levelProgress(game) {
  const lvl = game.restaurantLevel;
  const atMax = lvl >= MAX_LEVEL;
  const floor = xpForLevel(lvl);
  const ceil = atMax ? floor : xpForLevel(lvl + 1);
  const have = Math.max(0, game.stats.totalRevenue - floor);
  const span = Math.max(1, ceil - floor);
  const pct = atMax ? 1 : Math.min(1, have / span);
  return { atMax, have, span, pct };
}

// LEVELS[i] describes level i+1 (LEVELS[0] = level 1's reward, etc.) — see
// game/leveling.js's checkLevelUp for how this gets applied.
//
// Farm crops, ranching, and fishing are gated here too (as of this revision) — wheat
// (farmPlot) is the sole exception, free from level 1. Recipes needing a not-yet-unlocked
// ingredient just stay uncookable until the supply exists (entities/customer.js already falls
// back to cheaper recipes, down to rice, based on live ingredient stock — not a separate
// "is this recipe unlocked" gate), so gating the crop/animal/appliance object alone is always
// sufficient; recipes.js itself never needs to change. Ranching (chicken, chickenFeeder, cow,
// cowFeeder, animalShack, plus the 'rancher' hire role) unlocks as one block at level 20;
// fishing (freezer, plus the 'fisherman' hire role) unlocks as one block at level 30 — see
// ui/staffUI.js's GATED_ROLES for how role names share the same unlockedObjectTypes Set as
// object types (no string collision between the two namespaces).
//
// Reward types: 'unlockObjects' (objectTypes, array of `type` strings and/or role names — use
// an array even for a single item), 'unlockRecipes' (recipeIds, array — usually one), 'money'
// (amount), 'ingredients' (items: [{name, qty}]). Level 1 has reward: null (starting level,
// nothing to grant).
export const LEVELS = [
  {"reward":null,"label":"Starting level"},
  {"reward":{"type":"unlockObjects","objectTypes":["tomatoFarm"]},"label":"Unlocks tomatoFarm"},
  {"reward":{"type":"unlockObjects","objectTypes":["pottedPlant"]},"label":"Unlocks pottedPlant"},
  {"reward":{"type":"money","amount":400},"label":"+$400"},
  {"reward":{"type":"unlockObjects","objectTypes":["cabbageFarm"]},"label":"Unlocks cabbageFarm"},
  {"reward":{"type":"ingredients","items":[{"name":"wheat","qty":7},{"name":"tomato","qty":7}]},"label":"+7 wheat, +7 tomato"},
  {"reward":{"type":"unlockRecipes","recipeIds":["mayoShrimp"]},"label":"Unlocks mayoShrimp"},
  {"reward":{"type":"money","amount":1600},"label":"+$1600"},
  {"reward":{"type":"unlockObjects","objectTypes":["cornFarm"]},"label":"Unlocks cornFarm"},
  {"reward":{"type":"ingredients","items":[{"name":"potato","qty":9},{"name":"corn","qty":9}]},"label":"+9 potato, +9 corn"},
  {"reward":{"type":"unlockObjects","objectTypes":["roundTable"]},"label":"Unlocks roundTable"},
  {"reward":{"type":"money","amount":3600},"label":"+$3600"},
  {"reward":{"type":"unlockObjects","objectTypes":["potatoFarm"]},"label":"Unlocks potatoFarm"},
  {"reward":{"type":"ingredients","items":[{"name":"carrot","qty":11},{"name":"onion","qty":11}]},"label":"+11 carrot, +11 onion"},
  {"reward":{"type":"unlockObjects","objectTypes":["beehive"]},"label":"Unlocks beehive"},
  {"reward":{"type":"unlockRecipes","recipeIds":["codAndPotato"]},"label":"Unlocks codAndPotato"},
  {"reward":{"type":"money","amount":7225},"label":"+$7225"},
  {"reward":{"type":"unlockObjects","objectTypes":["carrotFarm"]},"label":"Unlocks carrotFarm"},
  {"reward":{"type":"ingredients","items":[{"name":"pumpkin","qty":13},{"name":"cabbage","qty":13}]},"label":"+13 pumpkin, +13 cabbage"},
  {"reward":{"type":"unlockObjects","objectTypes":["chicken","chickenFeeder","cow","cowFeeder","animalShack","rancher"]},"label":"Unlocks Ranching: chicken, chickenFeeder, cow, cowFeeder, animalShack, rancher"},
  {"reward":{"type":"money","amount":11025},"label":"+$11025"},
  {"reward":{"type":"unlockObjects","objectTypes":["sinkII"]},"label":"Unlocks sinkII"},
  {"reward":{"type":"ingredients","items":[{"name":"shrimp","qty":15},{"name":"egg","qty":15}]},"label":"+15 shrimp, +15 egg"},
  {"reward":{"type":"unlockObjects","objectTypes":["onionFarm"]},"label":"Unlocks onionFarm"},
  {"reward":{"type":"money","amount":15625},"label":"+$15625"},
  {"reward":{"type":"unlockObjects","objectTypes":["oakChair"]},"label":"Unlocks oakChair"},
  {"reward":{"type":"ingredients","items":[{"name":"salmon","qty":17},{"name":"milk","qty":17}]},"label":"+17 salmon, +17 milk"},
  {"reward":{"type":"unlockObjects","objectTypes":["pumpkinFarm"]},"label":"Unlocks pumpkinFarm"},
  {"reward":{"type":"money","amount":21025},"label":"+$21025"},
  {"reward":{"type":"unlockObjects","objectTypes":["freezer","fisherman"]},"label":"Unlocks Fishing: freezer, fisherman"},
  {"reward":{"type":"ingredients","items":[{"name":"cod","qty":19},{"name":"beef","qty":19}]},"label":"+19 cod, +19 beef"},
  {"reward":{"type":"money","amount":25600},"label":"+$25600"},
  {"reward":{"type":"unlockRecipes","recipeIds":["chickenStew"]},"label":"Unlocks chickenStew"},
  {"reward":{"type":"ingredients","items":[{"name":"tuna","qty":21},{"name":"wheat","qty":21}]},"label":"+21 tuna, +21 wheat"},
  {"reward":{"type":"money","amount":30625},"label":"+$30625"},
  {"reward":{"type":"ingredients","items":[{"name":"tomato","qty":22},{"name":"potato","qty":22}]},"label":"+22 tomato, +22 potato"},
  {"reward":{"type":"unlockObjects","objectTypes":["stoveII"]},"label":"Unlocks stoveII"},
  {"reward":{"type":"money","amount":36100},"label":"+$36100"},
  {"reward":{"type":"ingredients","items":[{"name":"corn","qty":23},{"name":"carrot","qty":23}]},"label":"+23 corn, +23 carrot"},
  {"reward":{"type":"money","amount":40000},"label":"+$40000"},
  {"reward":{"type":"ingredients","items":[{"name":"onion","qty":24},{"name":"pumpkin","qty":24}]},"label":"+24 onion, +24 pumpkin"},
  {"reward":{"type":"unlockRecipes","recipeIds":["tunaVeggieBowl"]},"label":"Unlocks tunaVeggieBowl"},
  {"reward":{"type":"money","amount":46225},"label":"+$46225"},
  {"reward":{"type":"ingredients","items":[{"name":"cabbage","qty":26},{"name":"shrimp","qty":26}]},"label":"+26 cabbage, +26 shrimp"},
  {"reward":{"type":"money","amount":50625},"label":"+$50625"},
  {"reward":{"type":"ingredients","items":[{"name":"egg","qty":27},{"name":"salmon","qty":27}]},"label":"+27 egg, +27 salmon"},
  {"reward":{"type":"unlockRecipes","recipeIds":["cowSteak"]},"label":"Unlocks cowSteak"},
  {"reward":{"type":"money","amount":57600},"label":"+$57600"},
  {"reward":{"type":"ingredients","items":[{"name":"milk","qty":28},{"name":"cod","qty":28}]},"label":"+28 milk, +28 cod"},
  {"reward":{"type":"money","amount":62500},"label":"+$62500"},
  {"reward":{"type":"ingredients","items":[{"name":"beef","qty":29},{"name":"tuna","qty":29}]},"label":"+29 beef, +29 tuna"},
  {"reward":{"type":"money","amount":67600},"label":"+$67600"},
  {"reward":{"type":"unlockObjects","objectTypes":["sinkIII"]},"label":"Unlocks sinkIII"},
  {"reward":{"type":"ingredients","items":[{"name":"wheat","qty":31},{"name":"tomato","qty":31}]},"label":"+31 wheat, +31 tomato"},
  {"reward":{"type":"money","amount":75625},"label":"+$75625"},
  {"reward":{"type":"ingredients","items":[{"name":"potato","qty":32},{"name":"corn","qty":32}]},"label":"+32 potato, +32 corn"},
  {"reward":{"type":"money","amount":81225},"label":"+$81225"},
  {"reward":{"type":"ingredients","items":[{"name":"carrot","qty":33},{"name":"onion","qty":33}]},"label":"+33 carrot, +33 onion"},
  {"reward":{"type":"money","amount":87025},"label":"+$87025"},
  {"reward":{"type":"unlockRecipes","recipeIds":["lobsterFeast"]},"label":"Unlocks lobsterFeast"},
  {"reward":{"type":"ingredients","items":[{"name":"pumpkin","qty":34},{"name":"cabbage","qty":34}]},"label":"+34 pumpkin, +34 cabbage"},
  {"reward":{"type":"money","amount":96100},"label":"+$96100"},
  {"reward":{"type":"ingredients","items":[{"name":"shrimp","qty":35},{"name":"egg","qty":35}]},"label":"+35 shrimp, +35 egg"},
  {"reward":{"type":"money","amount":102400},"label":"+$102400"},
  {"reward":{"type":"ingredients","items":[{"name":"salmon","qty":36},{"name":"milk","qty":36}]},"label":"+36 salmon, +36 milk"},
  {"reward":{"type":"money","amount":108900},"label":"+$108900"},
  {"reward":{"type":"ingredients","items":[{"name":"cod","qty":37},{"name":"beef","qty":37}]},"label":"+37 cod, +37 beef"},
  {"reward":{"type":"unlockObjects","objectTypes":["stoveIII"]},"label":"Unlocks stoveIII"},
  {"reward":{"type":"money","amount":119025},"label":"+$119025"},
  {"reward":{"type":"ingredients","items":[{"name":"tuna","qty":39},{"name":"wheat","qty":39}]},"label":"+39 tuna, +39 wheat"},
  {"reward":{"type":"money","amount":126025},"label":"+$126025"},
  {"reward":{"type":"ingredients","items":[{"name":"tomato","qty":40},{"name":"potato","qty":40}]},"label":"+40 tomato, +40 potato"},
  {"reward":{"type":"money","amount":133225},"label":"+$133225"},
  {"reward":{"type":"ingredients","items":[{"name":"corn","qty":41},{"name":"carrot","qty":41}]},"label":"+41 corn, +41 carrot"},
  {"reward":{"type":"money","amount":140625},"label":"+$140625"},
  {"reward":{"type":"ingredients","items":[{"name":"onion","qty":42},{"name":"pumpkin","qty":42}]},"label":"+42 onion, +42 pumpkin"},
  {"reward":{"type":"money","amount":148225},"label":"+$148225"},
  {"reward":{"type":"ingredients","items":[{"name":"cabbage","qty":43},{"name":"shrimp","qty":43}]},"label":"+43 cabbage, +43 shrimp"},
  {"reward":{"type":"money","amount":156025},"label":"+$156025"},
  {"reward":{"type":"ingredients","items":[{"name":"egg","qty":44},{"name":"salmon","qty":44}]},"label":"+44 egg, +44 salmon"},
  {"reward":{"type":"money","amount":164025},"label":"+$164025"},
  {"reward":{"type":"ingredients","items":[{"name":"milk","qty":45},{"name":"cod","qty":45}]},"label":"+45 milk, +45 cod"},
  {"reward":{"type":"money","amount":172225},"label":"+$172225"},
  {"reward":{"type":"ingredients","items":[{"name":"beef","qty":46},{"name":"tuna","qty":46}]},"label":"+46 beef, +46 tuna"},
  {"reward":{"type":"money","amount":180625},"label":"+$180625"},
  {"reward":{"type":"ingredients","items":[{"name":"wheat","qty":47},{"name":"tomato","qty":47}]},"label":"+47 wheat, +47 tomato"},
  {"reward":{"type":"money","amount":189225},"label":"+$189225"},
  {"reward":{"type":"ingredients","items":[{"name":"potato","qty":48},{"name":"corn","qty":48}]},"label":"+48 potato, +48 corn"},
  {"reward":{"type":"money","amount":198025},"label":"+$198025"},
  {"reward":{"type":"ingredients","items":[{"name":"carrot","qty":49},{"name":"onion","qty":49}]},"label":"+49 carrot, +49 onion"},
  {"reward":{"type":"money","amount":207025},"label":"+$207025"},
  {"reward":{"type":"ingredients","items":[{"name":"pumpkin","qty":50},{"name":"cabbage","qty":50}]},"label":"+50 pumpkin, +50 cabbage"},
  {"reward":{"type":"money","amount":216225},"label":"+$216225"},
  {"reward":{"type":"ingredients","items":[{"name":"shrimp","qty":51},{"name":"egg","qty":51}]},"label":"+51 shrimp, +51 egg"},
  {"reward":{"type":"money","amount":225625},"label":"+$225625"},
  {"reward":{"type":"ingredients","items":[{"name":"salmon","qty":52},{"name":"milk","qty":52}]},"label":"+52 salmon, +52 milk"},
  {"reward":{"type":"money","amount":235225},"label":"+$235225"},
  {"reward":{"type":"ingredients","items":[{"name":"cod","qty":53},{"name":"beef","qty":53}]},"label":"+53 cod, +53 beef"},
  {"reward":{"type":"money","amount":245025},"label":"+$245025"},
  {"reward":{"type":"ingredients","items":[{"name":"tuna","qty":54},{"name":"wheat","qty":54}]},"label":"+54 tuna, +54 wheat"}
];

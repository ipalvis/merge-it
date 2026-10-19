/* The South America map (?map=sa): the twelve countries of the mainland plus French Guiana, joined by land.
   Map data: source.mjs -> map.json. */

// prettier-ignore
export default {
  order: 3,
  name: 'South America',              // on the map switch and in the tab title
  unit: 'country', units: 'countries',
  goal: 'South America',
  tagline: 'Drop South American countries into the box. Neighbors stick together. Build the map of South America.',
  tutorial: false,                    // the tutorial is scripted around U.S. states
  testIds: ['PY', 'BO'],
  song: 'bright',
  boxW: 265,                          // taller than wide: this fits it the way Europe's 371 fits Europe
  // Color buckets (index = CSS var --cN); no two neighbors share one
  colorGroups: [
    ['CL','VE'],                                                  // c0 (blue)
    ['BR'],                                                       // c1 (green)
    ['AR','CO'],                                                  // c2 (purple)
    ['PE','PY','SR'],                                             // c3 (tan)
    ['BO','GY'],                                                  // c4 (orange)
    ['EC','UY'],                                                  // c5 (gray)
    ['GF']                                                        // c6 (pink)
  ],
  /* Neighbors that ship pre-joined, so no piece is under the minimum size (scripts/check-levels.mjs) */
  clusters: [
    { name:'Suriname and French Guiana', states:['SR','GF'] }
  ],
  /* Bonus points the first time each is assembled in a round */
  divisions: {
    "the Guianas":["GY","SR","GF"], "the Southern Cone":["AR","CL","PY","UY"], "Gran Colombia":["CO","EC","VE"],
    "the Andean Community":["BO","CO","EC","PE"], "Mercosur's founders":["AR","BR","PY","UY"]
  },
  regions: {
    "the Andes":["VE","CO","EC","PE","BO","CL","AR"],
    "the Pacific coast":["CO","EC","PE","CL"],
    "the Atlantic coast":["GY","SR","GF","BR","UY","AR"]
  },
};

/* The Latin America map (?map=latam): Mexico, Central America, South America (plus French Guiana, Guyana and Suriname
   to fill out the map) and Cuba and Hispaniola. Cuba joins Mexico and Haiti by sea crossings, drawn as little bridges.
   Small countries ship pre-joined so no piece is under the minimum size (scripts/check-levels.mjs), which leaves 11
   pieces; its difficulty rating is in difficulty.json (docs/difficulty.md). Map data: source.mjs -> map.json. */

// prettier-ignore
export default {
  order: 3,
  name: 'Latin America',              // on the map switch and in the tab title
  unit: 'country', units: 'countries',
  goal: 'Latin America',
  tagline: 'Drop the countries of Latin America into the box. Neighbors stick together. Build the map from Mexico and the Caribbean to Patagonia.',
  tutorial: false,                    // the tutorial is scripted around U.S. states
  testIds: ['PY', 'BO'],
  song: 'bright',
  boxW: 336,                          // taller than wide: this fits it the way Europe's 371 fits Europe
  // Color buckets (index = CSS var --cN); no two neighbors share one
  colorGroups: [
    ['MX','CL','VE'],                                             // c0 (blue)
    ['BR','NI','DO'],                                             // c1 (green)
    ['AR','CO','CR'],                                             // c2 (purple)
    ['PE','PY','SR','GT','HT'],                                   // c3 (tan)
    ['BO','GY','HN','CU'],                                        // c4 (orange)
    ['EC','UY','BZ','PA'],                                        // c5 (gray)
    ['GF','SV']                                                   // c6 (pink)
  ],
  /* Neighbors that ship pre-joined, so no piece is smaller than the minimum (Paraguay; scripts/check-levels.mjs):
     Central America as one piece; the islands (Cuba bridged to Hispaniola) with Mexico, their only neighbor; Uruguay
     and Ecuador with a bigger neighbor each; and the three Guianas */
  clusters: [
    { name:'Central America', states:['GT','BZ','SV','HN','NI','CR','PA'] },
    { name:'Mexico and the Greater Antilles', states:['MX','CU','HT','DO'] },
    { name:'Colombia and Ecuador', states:['CO','EC'] },
    { name:'Argentina and Uruguay', states:['AR','UY'] },
    { name:'The Guianas', states:['GY','SR','GF'] }
  ],
  /* Bonus points the first time each is assembled in a round */
  divisions: {
    "the Southern Cone":["AR","CL","PY","UY"], "Gran Colombia":["CO","EC","VE","PA"],
    "the Andean Community":["BO","CO","EC","PE"], "Mercosur's founders":["AR","BR","PY","UY"]
  },
  regions: {
    "the Andes":["VE","CO","EC","PE","BO","CL","AR"],
    "the Pacific coast":["MX","GT","SV","HN","NI","CR","PA","CO","EC","PE","CL"],
    "the Atlantic coast":["GY","SR","GF","BR","UY","AR"]
  },
};

/* The Latin America map (?map=latam): Mexico, Central America, South America (plus French Guiana, Guyana and Suriname
   to fill out the map) and Cuba, Hispaniola and Puerto Rico. The islands join by sea crossings, drawn as little
   bridges: Cuba to Mexico and to Haiti, the Dominican Republic to Puerto Rico. Map data: source.mjs -> map.json.
   Tuned to a difficulty of 3 (the careful simulated player completes it about one game in four; docs/difficulty.md). */

// prettier-ignore
export default {
  order: 3,
  name: 'Latin America',              // on the map switch and in the tab title
  unit: 'country', units: 'countries',
  goal: 'Latin America',
  tagline: 'Drop the countries of Latin America into the box. Neighbors stick together. Build the map from Mexico and the Caribbean to Patagonia.',
  tutorial: false,                    // the tutorial is scripted around U.S. states
  testIds: ['UY', 'AR'],
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
  /* Neighbors that ship pre-joined: the islands as one piece, Cuba bridged to Hispaniola (Haiti and the Dominican
     Republic), so they need only one sea crossing, to Mexico; and the three small Guianas */
  clusters: [
    { name:'The Greater Antilles', states:['CU','HT','DO'] },
    { name:'The Guianas', states:['GY','SR','GF'] }
  ],
  /* Bonus points the first time each is assembled in a round */
  divisions: {
    "Central America":["BZ","GT","HN","SV","NI","CR","PA"], "the Southern Cone":["AR","CL","PY","UY"],
    "Gran Colombia":["CO","EC","VE","PA"], "the Andean Community":["BO","CO","EC","PE"], "Mercosur's founders":["AR","BR","PY","UY"]
  },
  regions: {
    "the Andes":["VE","CO","EC","PE","BO","CL","AR"],
    "the Pacific coast":["MX","GT","SV","HN","NI","CR","PA","CO","EC","PE","CL"],
    "the Atlantic coast":["GY","SR","GF","BR","UY","AR"]
  },
};

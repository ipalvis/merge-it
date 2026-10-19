/* The Central America map (?map=central): Mexico and the seven countries of Central America, joined by land.
   Map data: source.mjs -> map.json. */

// prettier-ignore
export default {
  order: 4,
  name: 'Central America',            // on the map switch and in the tab title
  unit: 'country', units: 'countries',
  goal: 'Central America',
  tagline: 'Drop Mexico and the countries of Central America into the box. Neighbors stick together. Build the map from Mexico to Panama.',
  tutorial: false,                    // the tutorial is scripted around U.S. states
  testIds: ['CR', 'PA'],
  song: 'bright',
  boxW: 532,                          // wider than tall, but capped by height: this fits it the way Europe's 371 fits Europe
  // Color buckets (index = CSS var --cN); no two neighbors share one
  colorGroups: [
    ['MX'],                                                       // c0 (blue)
    ['NI'],                                                       // c1 (green)
    ['CR'],                                                       // c2 (purple)
    ['GT'],                                                       // c3 (tan)
    ['HN'],                                                       // c4 (orange)
    ['BZ','PA'],                                                  // c5 (gray)
    ['SV']                                                        // c6 (pink)
  ],
  /* Neighbors that ship pre-joined, so no piece is under the minimum size (scripts/check-levels.mjs) */
  clusters: [
    { name:'Guatemala and Belize', states:['GT','BZ'] },
    { name:'Honduras and El Salvador', states:['HN','SV'] }
  ],
  /* Bonus points the first time each is assembled in a round */
  divisions: {
    "the Northern Triangle":["GT","SV","HN"], "the Gulf of Fonseca":["SV","HN","NI"], "the southern isthmus":["NI","CR","PA"]
  },
  regions: {
    "Central America":["BZ","GT","SV","HN","NI","CR","PA"]
  },
};

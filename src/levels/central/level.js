/* The Central America map (?map=central): Mexico, the seven countries of Central America, and Cuba and Hispaniola
   (Haiti and the Dominican Republic), which join by bridges across the water: Cuba to Mexico and to Haiti. With 11
   regions, every country is its own piece (scripts/check-levels.mjs). Map data: source.mjs -> map.json. */

// prettier-ignore
export default {
  order: 4,
  name: 'Central America',            // on the map switch and in the tab title
  unit: 'country', units: 'countries',
  goal: 'Central America',
  tagline: 'Drop Mexico and the countries of Central America and the Caribbean into the box. Neighbors stick together. Build the map from Mexico to Panama.',
  tutorial: false,                    // the tutorial is scripted around U.S. states
  testIds: ['CR', 'PA'],
  song: 'bright',
  // Color buckets (index = CSS var --cN); no two neighbors share one
  colorGroups: [
    ['MX'],                                                       // c0 (blue)
    ['NI','DO'],                                                  // c1 (green)
    ['CR'],                                                       // c2 (purple)
    ['GT','HT'],                                                  // c3 (tan)
    ['HN','CU'],                                                  // c4 (orange)
    ['BZ','PA'],                                                  // c5 (gray)
    ['SV']                                                        // c6 (pink)
  ],
  clusters: [],
  /* Bonus points the first time each is assembled in a round */
  divisions: {
    "the Northern Triangle":["GT","SV","HN"], "the Gulf of Fonseca":["SV","HN","NI"], "the southern isthmus":["NI","CR","PA"],
    "the Greater Antilles":["CU","HT","DO"]
  },
  regions: {
    "Central America":["BZ","GT","SV","HN","NI","CR","PA"]
  },
};

/* The original level (?map=us): the contiguous U.S. states. Map data: source.mjs -> map.json. */

// prettier-ignore
export default {
  order: 1,                           // first on the map switch, and the map new players start on
  name: 'U.S.',                       // on the map switch and in the tab title
  unit: 'state', units: 'states',
  goal: 'The Lower 48',
  tagline: 'Drop U.S. states into the box. Neighbors stick together. Build the Lower 48.',
  tutorial: true,                     // the scripted tutorial uses Colorado, Wyoming and Utah
  testIds: ['CO', 'UT'],
  // Color buckets by cultural region (index = CSS var --cN)
  colorGroups: [
    ['WA','OR','ID'],                                             // c0 Pacific Northwest (blue)
    ['MT','WY','CO'],                                             // c1 Rockies (green)
    ['CA','NV','UT','AZ','NM','TX'],                              // c2 Southwest (purple)
    ['ND','SD','NE','KS','OK','MN','IA','MO'],                    // c3 Plains (tan)
    ['WI','MI','IL','IN','OH'],                                   // c4 Midwest (orange)
    ['KY','TN','AR','LA','MS','AL','GA','FL','SC','NC','VA','WV'],// c5 South (gray)
    ['PA','NY','NJ','DE','MD','CT','RI','MA','VT','NH','ME']      // c6 Northeast (pink)
  ],
  /* Tiny neighbors that ship pre-joined */
  clusters: [
    { name:'VT, NH, MA, CT, RI', states:['VT','NH','MA','CT','RI'] },
    { name:'Maryland and Delaware', states:['MD','DE'] }
  ],
  /* Census divisions and regions: bonus points the first time each is assembled in a round */
  divisions: {
    "New England":["CT","ME","MA","NH","RI","VT"], "the Mid-Atlantic":["NJ","NY","PA"],
    "the East North Central":["IL","IN","MI","OH","WI"], "the West North Central":["IA","KS","MN","MO","NE","ND","SD"],
    "the South Atlantic":["DE","FL","GA","MD","NC","SC","VA","WV"], "the East South Central":["AL","KY","MS","TN"],
    "the West South Central":["AR","LA","OK","TX"], "the Mountain West":["AZ","CO","ID","MT","NV","NM","UT","WY"],
    "the Pacific Coast":["CA","OR","WA"]
  },
  regions: {
    "the Northeast":["CT","ME","MA","NH","RI","VT","NJ","NY","PA"],
    "the Midwest":["IL","IN","MI","OH","WI","IA","KS","MN","MO","NE","ND","SD"],
    "the South":["DE","FL","GA","MD","NC","SC","VA","WV","AL","KY","MS","TN","AR","LA","OK","TX"],
    "the West":["AZ","CO","ID","MT","NV","NM","UT","WY","CA","OR","WA"]
  },
};

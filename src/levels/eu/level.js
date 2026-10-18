/* The Europe map (?map=eu): the EU's members and their neighbors that fill out the map (Switzerland, Norway, the
   Western Balkans, Ukraine, Belarus, Moldova and the UK). Malta and Cyprus are left out. Two pairs join across the
   water, drawn as little bridges: Sweden-Denmark (the Øresund Bridge) and the UK-France (the Channel Tunnel).
   Map data: source.mjs -> map.json. */

// prettier-ignore
export default {
  order: 2,
  name: 'Europe',                     // on the map switch and in the tab title
  unit: 'country', units: 'countries',
  goal: 'Europe',
  tagline: 'Drop European countries into the box. Neighbors stick together. Build the map of Europe.',
  tutorial: false,                    // the tutorial is scripted around U.S. states
  testIds: ['ES', 'PT'],
  song: 'calm',                       // a gentler theme than the U.S. level's (see audio/sound.js)
  boxW: 371,                          // Europe is taller than wide: this fits it the way the standard 600 fits the U.S. (96% of the width)
  // Color buckets by region (index = CSS var --cN)
  colorGroups: [
    ['NO','SE','FI','DK','UK','IE'],                              // c0 Northern Europe (blue)
    ['EE','LV','LT','PL','BY'],                                   // c1 Baltic coast (green)
    ['ES','PT','IT','GR'],                                        // c2 Mediterranean (purple)
    ['FR','BE','NL','LU'],                                        // c3 France and Benelux (tan)
    ['DE','AT','CH','CZ'],                                        // c4 Central (orange)
    ['SK','HU','RO','BG','UA','MD'],                              // c5 Danube and the east (gray)
    ['SI','HR','BA','RS','ME','XK','MK','AL']                     // c6 Western Balkans (pink)
  ],
  /* Tiny neighbors that ship pre-joined (Luxembourg alone would be a few pixels across) */
  clusters: [
    { name:'Benelux', states:['BE','NL','LU'] },
    { name:'ME, XK, MK, AL', states:['ME','XK','MK','AL'] },
    { name:'Slovenia and Croatia', states:['SI','HR'] }
  ],
  /* Bonus points the first time each is assembled in a round. Regions follow the UN geoscheme. */
  divisions: {
    "the Nordics":["DK","NO","SE","FI"], "the Baltics":["EE","LV","LT"], "Iberia":["ES","PT"],
    "the DACH countries":["DE","AT","CH"], "the Visegrád Group":["PL","CZ","SK","HU"],
    "the Western Balkans":["AL","BA","ME","MK","RS","XK"], "the British Isles":["UK","IE"], "the EU's founding six":["BE","FR","DE","IT","LU","NL"]
  },
  regions: {
    "Northern Europe":["DK","NO","SE","FI","EE","LV","LT","UK","IE"],
    "Western Europe":["FR","BE","NL","LU","DE","AT","CH"],
    "Eastern Europe":["PL","CZ","SK","HU","RO","BG","UA","BY","MD"],
    "Southern Europe":["ES","PT","IT","GR","SI","HR","BA","RS","ME","XK","MK","AL"]
  },
};

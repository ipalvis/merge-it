/* How map.json is built (by scripts/build-map.mjs; not part of the game bundle): Natural Earth 1:50m countries via
   world-atlas: Mexico, the seven countries of Central America, and Cuba and Hispaniola, in a Lambert azimuthal
   equal-area projection centred on the region. */
import { laea } from '../../../scripts/projections.mjs';

/* Natural Earth name -> [code shown on the piece, display name]. Haiti is in because it shares Hispaniola with the
   Dominican Republic; the smaller islands are left out. */
// prettier-ignore
const COUNTRIES = {
  'Mexico':['MX','Mexico'], 'Belize':['BZ','Belize'], 'Guatemala':['GT','Guatemala'], 'Honduras':['HN','Honduras'],
  'El Salvador':['SV','El Salvador'], 'Nicaragua':['NI','Nicaragua'], 'Costa Rica':['CR','Costa Rica'],
  'Panama':['PA','Panama'],
  'Cuba':['CU','Cuba'], 'Haiti':['HT','Haiti'], 'Dominican Rep.':['DO','Dominican Republic'],
};

export default {
  topo: 'world-atlas/countries-50m.json',
  object: 'countries',
  pick: g =>
    COUNTRIES[g.properties.name]
      ? { id: COUNTRIES[g.properties.name][0], name: COUNTRIES[g.properties.name][1] }
      : null,
  keepIsland: 0.08,
  // The mainland and the Greater Antilles: drops Mexico's far Pacific islands
  region: ([lon, lat]) => lon > -118 && lon < -68 && lat > 7 && lat < 33,
  project: laea(-93, 20), // scale 1000: about the U.S. data's pixel size for a region this big
  // Bridges across water: Cuba to Mexico's Yucatán (the Yucatán Channel) and to Haiti (the Windward Passage)
  links: [
    ['CU', 'MX'],
    ['CU', 'HT'],
  ],
};

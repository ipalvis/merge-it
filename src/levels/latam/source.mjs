/* How map.json is built (by scripts/build-map.mjs; not part of the game bundle): Natural Earth 1:50m countries via
   world-atlas: Latin America, that is Mexico, the seven countries of Central America, the twelve of South America
   plus French Guiana, and Cuba, Hispaniola and Puerto Rico, in a Lambert azimuthal equal-area projection centred on
   the region. */
import { laea } from '../../../scripts/projections.mjs';

/* Natural Earth name -> [code shown on the piece, display name]. French Guiana is part of France: its ring is the
   only part of France inside the region below. The Falklands, Trinidad and the English- and Dutch-speaking Caribbean
   are left out. */
// prettier-ignore
const COUNTRIES = {
  // Mexico and Central America
  'Mexico':['MX','Mexico'], 'Belize':['BZ','Belize'], 'Guatemala':['GT','Guatemala'], 'Honduras':['HN','Honduras'],
  'El Salvador':['SV','El Salvador'], 'Nicaragua':['NI','Nicaragua'], 'Costa Rica':['CR','Costa Rica'],
  'Panama':['PA','Panama'],
  // the Caribbean's Spanish- and French-speaking islands
  'Cuba':['CU','Cuba'], 'Haiti':['HT','Haiti'], 'Dominican Rep.':['DO','Dominican Republic'],
  // South America
  'Argentina':['AR','Argentina'], 'Bolivia':['BO','Bolivia'], 'Brazil':['BR','Brazil'], 'Chile':['CL','Chile'],
  'Colombia':['CO','Colombia'], 'Ecuador':['EC','Ecuador'], 'Guyana':['GY','Guyana'], 'Paraguay':['PY','Paraguay'],
  'Peru':['PE','Peru'], 'Suriname':['SR','Suriname'], 'Uruguay':['UY','Uruguay'], 'Venezuela':['VE','Venezuela'],
  'France':['GF','French Guiana'],
};

export default {
  topo: 'world-atlas/countries-50m.json',
  object: 'countries',
  pick: g =>
    COUNTRIES[g.properties.name]
      ? { id: COUNTRIES[g.properties.name][0], name: COUNTRIES[g.properties.name][1] }
      : null,
  // Drops Tierra del Fuego and Chile's southern islands along with the small ones; the mainland keeps every border
  keepIsland: 0.08,
  // Only the mainland: drops the Galápagos, Easter Island, Mexico's Pacific islands and (for France) everything but
  // French Guiana
  region: ([lon, lat]) => lon > -118 && lon < -34 && lat > -56 && lat < 33,
  // scale 500: the region is about twice Europe's size, so this keeps it at a similar pixel size for simplifying
  project: laea(-75, -10, 500),
  // Neighbors across water: Cuba to Mexico's Yucatán (the Yucatán Channel) and to Haiti (the Windward Passage), and
  // Hispaniola to Puerto Rico (the Mona Passage). Without them the islands could never join the mainland.
  links: [
    ['CU', 'MX'],
    ['CU', 'HT'],
  ],
};

/* How map.json is built (by scripts/build-map.mjs; not part of the game bundle): Natural Earth 1:50m countries via
   world-atlas: the twelve countries of mainland South America plus French Guiana, in a Lambert azimuthal equal-area
   projection centred on the continent. */
import { laea } from '../../../scripts/projections.mjs';

/* Natural Earth name -> [code shown on the piece, display name]. French Guiana is part of France: its ring is the
   only part of France inside the region below. The Falklands and Trinidad are left out. */
// prettier-ignore
const COUNTRIES = {
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
  // Only the continent: drops the Galápagos, Easter Island and (for France) everything but French Guiana
  region: ([lon, lat]) => lon > -82 && lon < -34 && lat > -56 && lat < 13.5,
  // scale 550: the continent is about twice Europe's size, so this keeps it at a similar pixel size for simplifying
  project: laea(-60, -20, 550),
};

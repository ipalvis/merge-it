/* How map.json is built (by scripts/build-map.mjs; not part of the game bundle): Natural Earth 1:50m countries via
   world-atlas: Mexico and the seven countries of Central America, in a Lambert azimuthal equal-area projection
   centred on the region. */
import { laea } from '../../../scripts/projections.mjs';

/* Natural Earth name -> [code shown on the piece, display name]. The Caribbean islands are left out: they'd join
   only by sea crossings, narrower than a connection may be (scripts/check-levels.mjs). */
// prettier-ignore
const COUNTRIES = {
  'Mexico':['MX','Mexico'], 'Belize':['BZ','Belize'], 'Guatemala':['GT','Guatemala'], 'Honduras':['HN','Honduras'],
  'El Salvador':['SV','El Salvador'], 'Nicaragua':['NI','Nicaragua'], 'Costa Rica':['CR','Costa Rica'],
  'Panama':['PA','Panama'],
};

export default {
  topo: 'world-atlas/countries-50m.json',
  object: 'countries',
  pick: g =>
    COUNTRIES[g.properties.name]
      ? { id: COUNTRIES[g.properties.name][0], name: COUNTRIES[g.properties.name][1] }
      : null,
  keepIsland: 0.08,
  // Only the mainland and its nearby islands: drops Mexico's far Pacific islands
  region: ([lon, lat]) => lon > -118 && lon < -77 && lat > 7 && lat < 33,
  project: laea(-97, 20), // scale 1000: about the U.S. data's pixel size for a region this big
};

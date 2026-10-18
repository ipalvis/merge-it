/* How map.json is built (by scripts/build-map.mjs; not part of the game bundle): Natural Earth 1:50m countries via
   world-atlas, projected with the EU's own Lambert azimuthal equal-area (centre 10°E 52°N, as in ETRS89-LAEA). */

/* Natural Earth name -> [code shown on the piece, display name].
   The EU's members plus their neighbors that fill out the map: Switzerland, Norway, the Western Balkans, Ukraine,
   Belarus, Moldova and the UK. Malta and Cyprus are left out (islands far from any neighbor); microstates are skipped. */
// prettier-ignore
const EU_COUNTRIES = {
  'Austria':['AT','Austria'], 'Belgium':['BE','Belgium'], 'Bulgaria':['BG','Bulgaria'], 'Croatia':['HR','Croatia'],
  'Czechia':['CZ','Czechia'], 'Denmark':['DK','Denmark'], 'Estonia':['EE','Estonia'], 'Finland':['FI','Finland'],
  'France':['FR','France'], 'Germany':['DE','Germany'], 'Greece':['GR','Greece'], 'Hungary':['HU','Hungary'],
  'Italy':['IT','Italy'], 'Latvia':['LV','Latvia'], 'Lithuania':['LT','Lithuania'], 'Luxembourg':['LU','Luxembourg'],
  'Netherlands':['NL','Netherlands'], 'Poland':['PL','Poland'], 'Portugal':['PT','Portugal'], 'Romania':['RO','Romania'],
  'Slovakia':['SK','Slovakia'], 'Slovenia':['SI','Slovenia'], 'Spain':['ES','Spain'], 'Sweden':['SE','Sweden'],
  // gap fillers (not EU members)
  'Switzerland':['CH','Switzerland'], 'Norway':['NO','Norway'], 'Serbia':['RS','Serbia'],
  'Bosnia and Herz.':['BA','Bosnia and Herzegovina'], 'Montenegro':['ME','Montenegro'], 'Kosovo':['XK','Kosovo'],
  'Macedonia':['MK','North Macedonia'], 'Albania':['AL','Albania'],
  'Ukraine':['UA','Ukraine'], 'Belarus':['BY','Belarus'], 'Moldova':['MD','Moldova'],
  'United Kingdom':['UK','United Kingdom'], 'Ireland':['IE','Ireland'],
};
/* Natural Earth draws Crimea as part of Russia (where it's de facto controlled). The map shows internationally
   recognised borders, as the EU does, so its polygon moves to Ukraine and is merged in. */
function crimeaToUkraine(topo, tc) {
  const geoms = topo.objects.countries.geometries,
    ru = geoms.find(g => g.properties.name === 'Russia'),
    ua = geoms.find(g => g.properties.name === 'Ukraine');
  const centre = arcs => {
    const ring = tc.feature(topo, { type: 'Polygon', arcs }).geometry.coordinates[0],
      xs = ring.map(p => p[0]),
      ys = ring.map(p => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  };
  const i = ru.arcs.findIndex(arcs => {
    const [lon, lat] = centre(arcs);
    return lon > 32 && lon < 37 && lat > 44 && lat < 46.5;
  });
  if (i < 0) throw new Error('Crimea polygon not found');
  ua.arcs.push(...ru.arcs.splice(i, 1));
  ua.mergeSelf = true; // dissolve the border between the mainland and Crimea
}

/* Lambert azimuthal equal-area, spherical. Scale 1000 puts the map at roughly the same pixel size as the US data,
   so the same simplification tolerances work. y is flipped so north is up on screen. */
function laea([lon, lat]) {
  const r = Math.PI / 180,
    l = (lon - 10) * r,
    p = lat * r,
    p0 = 52 * r;
  const k = Math.sqrt(2 / (1 + Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)));
  return [
    1000 * k * Math.cos(p) * Math.sin(l),
    -1000 * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
  ];
}

export default {
  topo: 'world-atlas/countries-50m.json',
  object: 'countries',
  pick: g =>
    EU_COUNTRIES[g.properties.name]
      ? { id: EU_COUNTRIES[g.properties.name][0], name: EU_COUNTRIES[g.properties.name][1] }
      : null,
  prepare: crimeaToUkraine,
  // Keeps Sicily, Sardinia and Zealand; drops Crete, Corsica and the small Baltic and Adriatic islands
  keepIsland: 0.08,
  keepIslandFor: { UK: 0.05 }, // keeps Northern Ireland, the UK's land border with Ireland
  // Only mainland Europe: drops overseas parts (French Guiana, the Canaries, Svalbard, ...) before projecting
  region: ([lon, lat]) => lon > -12 && lon < 41 && lat > 34 && lat < 72,
  project: laea,
  // Neighbors across water. Sweden reaches the mainland only by the Øresund Bridge (without it Norway, Sweden and
  // Finland could never join the rest), and Great Britain by the Channel Tunnel.
  links: [
    ['SE', 'DK'],
    ['UK', 'FR'],
  ],
};

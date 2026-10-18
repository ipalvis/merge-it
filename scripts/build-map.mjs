/*
 * Regenerates the map data files in src/data/ from public boundary data.
 *   us -> states.json  U.S. Census Bureau boundaries (via us-atlas), already Albers-projected
 *   eu -> eu.json      Natural Earth 1:50m countries (via world-atlas), projected here with the EU's own
 *                      Lambert azimuthal equal-area (centre 10°E 52°N, as in ETRS89-LAEA)
 *
 * For each region (state or country) it writes:
 *   outline   - polygon(s) for drawing, lightly simplified
 *   convex    - the same shape, simplified more and split into convex pieces (Matter.js bodies must be convex)
 *   neighbors - regions that share a border, from TopoJSON arcs, plus any links listed below
 * and, for links across water, the closest points of the two shores (drawn as a sea crossing in the game).
 * Coordinates are shifted so the map starts at (0, 0).
 *
 * Run with `npm run build:map` (both maps) or `node scripts/build-map.mjs eu`.
 * Output is deterministic for the pinned package versions.
 */
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const tc = require('topojson-client');
const decomp = require('poly-decomp');
const simplify = require('simplify-js');

// FIPS code -> postal abbreviation, Lower 48 only
// prettier-ignore
const US_ABBR = { '01':'AL','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','12':'FL','13':'GA','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY' };

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
function crimeaToUkraine(topo) {
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

const MAPS = {
  us: {
    topo: 'us-atlas/states-albers-10m.json',
    object: 'states',
    out: 'states.json',
    pick: g => (US_ABBR[g.id] ? { id: US_ABBR[g.id] } : null),
    keepIsland: 0.12, // islands smaller than this share of the main shape are dropped
  },
  eu: {
    topo: 'world-atlas/countries-50m.json',
    object: 'countries',
    out: 'eu.json',
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
  },
};

const area = r => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

function build(key) {
  const M = MAPS[key];
  const topo = require(M.topo);
  M.prepare?.(topo);
  const geoms = topo.objects[M.object].geometries;
  const picked = geoms.map(M.pick);
  const nb = tc.neighbors(geoms);
  const feats = tc.feature(topo, topo.objects[M.object]).features;

  let minx = 1e9,
    miny = 1e9,
    maxx = -1e9,
    maxy = -1e9;
  const out = [];
  for (let i = 0; i < geoms.length; i++) {
    if (!picked[i]) continue;
    const f = geoms[i].mergeSelf ? { geometry: tc.merge(topo, [geoms[i]]), properties: {} } : feats[i],
      ab = picked[i].id;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let outer = polys.map(p => p[0]);
    if (M.region) outer = outer.filter(r => M.region(r[0]));
    if (M.project) outer = outer.map(r => r.map(M.project));
    const rings = outer.map(r => ({ r, a: Math.abs(area(r)) })).sort((x, y) => y.a - x.a);
    const big = rings[0].a;
    const parts = [];
    for (const { r, a } of rings) {
      if (a < Math.max(big * (M.keepIslandFor?.[ab] ?? M.keepIsland), 40)) continue; // drop small islands
      const simp = tol => {
        const pts = simplify(
          r.slice(0, -1).map(([x, y]) => ({ x, y })),
          tol,
          true,
        ).map(p => [+p.x.toFixed(1), +p.y.toFixed(1)]);
        decomp.makeCCW(pts);
        decomp.removeCollinearPoints(pts, 0.02);
        decomp.removeDuplicatePoints(pts, 0.5);
        return pts;
      };
      const pts = simp(1.2); // drawing outline
      let convex = null; // physics: try tolerances until the shape decomposes cleanly
      for (const t of [3, 2.6, 3.4, 2.2, 4, 1.8, 1.6, 1.4, 5, 6, 1.2, 1]) {
        const p = simp(t);
        if (decomp.isSimple(p)) {
          const c = decomp.quickDecomp(p);
          if (c && c.length) {
            convex = c;
            break;
          }
        }
      }
      if (!convex) {
        console.error('Could not decompose', ab);
        process.exitCode = 1;
        continue;
      }
      convex = convex
        .filter(c => c.length >= 3 && Math.abs(area(c)) > 2)
        .map(c => c.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]));
      for (const [x, y] of pts) {
        minx = Math.min(minx, x);
        maxx = Math.max(maxx, x);
        miny = Math.min(miny, y);
        maxy = Math.max(maxy, y);
      }
      parts.push({ outline: pts, convex });
    }
    const neighbors = [...new Set(nb[i].map(j => picked[j]?.id).filter(n => n && n !== ab))]; // (Crimea made Ukraine border itself)
    out.push({ id: ab, name: picked[i].name ?? f.properties.name, parts, neighbors });
  }
  const links = [];
  for (const [a, b] of M.links ?? []) {
    const A = out.find(s => s.id === a),
      B = out.find(s => s.id === b);
    A.neighbors.push(b);
    B.neighbors.push(a);
    // the crossing: the closest points of the two coasts
    let best = { d: Infinity };
    for (const p of A.parts.flatMap(x => x.outline))
      for (const q of B.parts.flatMap(x => x.outline)) {
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        if (d < best.d) best = { d, pa: p, pb: q };
      }
    links.push({ a, b, pa: best.pa, pb: best.pb });
  }
  const shift = ([x, y]) => [+(x - minx).toFixed(1), +(y - miny).toFixed(1)];
  for (const s of out)
    for (const p of s.parts) {
      p.outline = p.outline.map(shift);
      p.convex = p.convex.map(c => c.map(shift));
    }
  for (const l of links) Object.assign(l, { pa: shift(l.pa), pb: shift(l.pb) });

  const file = new URL('../src/data/' + M.out, import.meta.url);
  const data = { w: +(maxx - minx).toFixed(1), h: +(maxy - miny).toFixed(1), states: out };
  if (links.length) data.links = links;
  writeFileSync(file, JSON.stringify(data));
  console.log(`Wrote ${out.length} regions to src/data/${M.out}`);
}

for (const key of process.argv[2] ? [process.argv[2]] : Object.keys(MAPS)) build(key);

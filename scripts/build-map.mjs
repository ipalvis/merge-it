/*
 * Regenerates each level's map.json (src/levels/<key>/map.json) from public boundary data, following the recipe in
 * the level's source.mjs, which exports:
 *   topo, object     - a TopoJSON file (from an npm package, e.g. us-atlas or world-atlas) and the object in it
 *   pick(geometry)   - { id, name? } for each region to keep (id = the code on the piece), or null to skip it
 *   keepIsland       - islands smaller than this share of a region's main shape are dropped
 *   keepIslandFor    - per-region exceptions to keepIsland (optional)
 *   region([lon,lat])- keep only rings that start inside this area, e.g. to drop overseas territories (optional)
 *   project([lon,lat]) -> [x, y] in map px, y down (optional; for unprojected data such as world-atlas)
 *   prepare(topo, tc)- fix up the boundary data first (optional; tc = topojson-client)
 *   links            - [[a, b], ...] neighbors across water (optional)
 *
 * For each region it writes:
 *   outline   - polygon(s) for drawing, lightly simplified
 *   convex    - the same shape, simplified more and split into convex pieces (Matter.js bodies must be convex)
 *   neighbors - regions that share a border, from TopoJSON arcs, plus any links
 * and, for links across water, the closest points of the two shores (drawn as a sea crossing in the game).
 * Coordinates are shifted so the map starts at (0, 0).
 *
 * Run with `npm run build:map` (every level) or `npm run build:map -- eu`, then `npm run check:levels`.
 * Output is deterministic for the pinned package versions.
 */
import { createRequire } from 'module';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
const require = createRequire(import.meta.url);
const tc = require('topojson-client');
const decomp = require('poly-decomp');
const simplify = require('simplify-js');

const LEVELS = new URL('../src/levels/', import.meta.url);

const area = r => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};

async function build(key) {
  const M = (await import(new URL(`${key}/source.mjs`, LEVELS))).default;
  // a fresh copy each time: prepare() may edit it, and other levels can use the same file
  const topo = JSON.parse(readFileSync(require.resolve(M.topo), 'utf8'));
  M.prepare?.(topo, tc);
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

  const data = { w: +(maxx - minx).toFixed(1), h: +(maxy - miny).toFixed(1), states: out };
  if (links.length) data.links = links;
  writeFileSync(new URL(`${key}/map.json`, LEVELS), JSON.stringify(data));
  console.log(`Wrote ${out.length} regions to src/levels/${key}/map.json`);
}

const keys = readdirSync(LEVELS, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(new URL(`${d.name}/source.mjs`, LEVELS)))
  .map(d => d.name);
const want = process.argv[2];
if (want && !keys.includes(want)) {
  console.error(`No level "${want}" with a source.mjs (have: ${keys.join(', ')})`);
  process.exit(1);
}
for (const key of want ? [want] : keys) await build(key);

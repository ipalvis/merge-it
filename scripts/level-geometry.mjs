/* Level measurements in the game's own units (logical px of the box, the same in every level), shared by
   check-levels.mjs and rate-levels.mjs: the map's scale, each piece's area, and how wide the connection is between
   pieces that can join. */
import { readFileSync } from 'fs';

// The map's scale in the box (map/geometry.js): it fills CFG.mapFill of the box width, or CFG.mapMaxH of its height
const CONFIG = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8'),
  setting = re => +CONFIG.match(re)[1],
  MAP_FILL = setting(/mapFill: ([\d.]+)/),
  MAP_MAX_H = setting(/mapMaxH: ([\d.]+)/),
  STD_BOX_W = setting(/STD_BOX_W = (\d+)/);
export const mapScale = (level, data) => Math.min((MAP_FILL * (level.boxW ?? STD_BOX_W)) / data.w, MAP_MAX_H / data.h);

const polyArea = pts => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
};
const segDist = (px, py, [ax, ay], [bx, by]) => {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
};
const segments = parts => parts.flatMap(p => p.outline.map((a, i) => [a, p.outline[(i + 1) % p.outline.length]]));
/* Length of a's outline that runs along b's (map data units). The two outlines are simplified separately, so a shared
   border can drift apart by up to the build's tolerance on each side: points within NEAR count as on the border. */
const NEAR = 2.5;
function along(a, b) {
  const bs = segments(b.parts);
  let len = 0;
  for (const [p, q] of segments(a.parts)) {
    const on = t => {
      const x = p[0] + (q[0] - p[0]) * t,
        y = p[1] + (q[1] - p[1]) * t;
      return bs.some(([u, v]) => segDist(x, y, u, v) <= NEAR);
    };
    if (on(0.25) && on(0.5) && on(0.75)) len += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return len;
}

/* Pieces as dealt: each cluster, then each region not in one. Returns [{ name, states, area }] (area in logical px²),
   and the connections between pieces that can join: [{ a, b, width, sea }] (width: how long a border they share, in
   logical px; sea: joined by a bridge across water, which has no border to measure). Neighbors join wherever they
   touch, not only along their border; the width is what a player sees, and so aims for. */
export function measureLevel(level, data) {
  const S = mapScale(level, data),
    byId = Object.fromEntries(data.states.map(s => [s.id, s])),
    clustered = new Set((level.clusters ?? []).flatMap(c => c.states));
  const pieces = [
    ...(level.clusters ?? []).map(c => ({ name: `"${c.name}"`, states: c.states.filter(i => byId[i]) })),
    ...data.states.filter(s => !clustered.has(s.id)).map(s => ({ name: s.id, states: [s.id] })),
  ];
  for (const p of pieces)
    p.area = p.states.reduce((t, i) => t + byId[i].parts.reduce((u, q) => u + polyArea(q.outline), 0), 0) * S * S;
  const pieceOf = Object.fromEntries(pieces.flatMap(p => p.states.map(i => [i, p])));
  const sea = new Set((data.links ?? []).flatMap(l => [`${l.a}|${l.b}`, `${l.b}|${l.a}`]));
  const widths = new Map(); // "pieceA|pieceB" -> { width, sea }
  for (const s of data.states)
    for (const n of s.neighbors) {
      const A = pieceOf[s.id],
        B = pieceOf[n];
      if (!B || A === B || s.id > n) continue; // each region pair once
      const key = [A.name, B.name].sort().join('|'),
        w = widths.get(key) ?? { width: 0, sea: false };
      if (sea.has(`${s.id}|${n}`)) w.sea = true;
      else w.width += ((along(s, byId[n]) + along(byId[n], s)) / 2) * S;
      widths.set(key, w);
    }
  const links = [...widths].map(([k, w]) => {
    const [a, b] = k.split('|');
    return { a, b, ...w };
  });
  return { scale: S, pieces, links };
}

import Matter from 'matter-js';
import { CFG, TEST_IDS } from '../config.js';
import { fitLabels, LABEL_FONT } from './labels.js';
import { MAP } from '../levels/index.js';

const { Vertices } = Matter;

const DATA = MAP.data;
const S = Math.min((CFG.mapFill * CFG.boxW) / DATA.w, CFG.mapMaxH / DATA.h);
/* Size of the finished map in the box */
export const MAP_W = DATA.w * S,
  MAP_H = DATA.h * S;
export const STATES = {}; // keyed by id; "state" means one region of the map (a U.S. state, a country, ...)
for (const s of DATA.states) {
  const parts = s.parts.map(p => ({
    outline: p.outline.map(([x, y]) => ({ x: x * S, y: y * S })),
    convex: p.convex.map(c => c.map(([x, y]) => ({ x: x * S, y: y * S }))),
  }));
  const all = parts.flatMap(p => p.outline);
  const bb = {
    minX: Math.min(...all.map(p => p.x)),
    maxX: Math.max(...all.map(p => p.x)),
    minY: Math.min(...all.map(p => p.y)),
    maxY: Math.max(...all.map(p => p.y)),
  };
  const main = parts.reduce((a, b) =>
    Math.abs(Vertices.area(b.outline)) > Math.abs(Vertices.area(a.outline)) ? b : a,
  );
  STATES[s.id] = {
    id: s.id,
    name: s.name,
    parts,
    bb,
    mainOutline: main.outline, // where the label goes (see map/labels.js)
    area: parts.reduce((t, p) => t + Math.abs(Vertices.area(p.outline)), 0),
    neighbors: new Set(s.neighbors),
  };
}
/* Sea crossings (levels whose data lists links): neighbors across water, with the closest points of the two coasts */
for (const s of Object.values(STATES)) s.crossings = [];
for (const { a, b, pa, pb } of DATA.links ?? []) {
  const A = { x: pa[0] * S, y: pa[1] * S },
    B = { x: pb[0] * S, y: pb[1] * S };
  STATES[a].crossings.push({ to: b, from: A, at: B });
  STATES[b].crossings.push({ to: a, from: B, at: A });
}
/* Collision chunks: each state's convex pieces, in map space. */
for (const s of Object.values(STATES))
  s.chunks = s.parts.flatMap(part =>
    part.convex.map(v => ({ state: s.id, verts: v, area: Math.abs(Vertices.area(v)) })),
  );
export const IDS = Object.keys(STATES);
// Fit labels with whatever font is ready now, then again once Public Sans has loaded (its letters are a little
// wider). Listen for the load rather than awaiting it: if the stylesheet applies late, the font isn't even declared yet.
fitLabels(Object.values(STATES));
document.fonts?.load(`800 12px ${LABEL_FONT}`);
document.fonts?.addEventListener('loadingdone', () => fitLabels(Object.values(STATES)));
/* States that must all be connected to complete a round */
export const GOAL_IDS = TEST_IDS ?? IDS;
MAP.colorGroups.forEach((ids, c) =>
  ids.forEach(id => {
    STATES[id].color = c;
  }),
);
/* Pieces: what actually drops. Most are one state; tiny neighbors ship pre-joined. */
const CLUSTERS = MAP.clusters;
export const PIECES = [];
{
  const clustered = new Set(CLUSTERS.flatMap(c => c.states));
  for (const c of CLUSTERS) PIECES.push({ name: c.name, states: c.states });
  for (const id of IDS) if (!clustered.has(id)) PIECES.push({ name: STATES[id].name, states: [id] });
  for (const p of PIECES) {
    const bbs = p.states.map(i => STATES[i].bb);
    p.bb = {
      minX: Math.min(...bbs.map(b => b.minX)),
      maxX: Math.max(...bbs.map(b => b.maxX)),
      minY: Math.min(...bbs.map(b => b.minY)),
      maxY: Math.max(...bbs.map(b => b.maxY)),
    };
  }
}
/* A pre-joined piece acts like one big state: any of its states sticks to anything that borders any state in the piece. */
{
  const UNIT = {};
  for (const p of PIECES) for (const id of p.states) UNIT[id] = p.states;
  for (const id of IDS)
    STATES[id].stickTo = new Set(
      IDS.filter(t => !UNIT[id].includes(t) && UNIT[id].some(x => UNIT[t].some(y => STATES[x].neighbors.has(y)))),
    );
}
/* Smallest circle enclosing pts (Welzl's algorithm, iterative, run on the convex hull to keep it small) */
function enclosingCircle(pts) {
  const P = [...pts].sort((a, b) => a.x - b.x || a.y - b.y),
    cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x),
    half = list => {
      const h = [];
      for (const p of list) {
        while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
        h.push(p);
      }
      return h.slice(0, -1);
    };
  const hull = P.length < 3 ? P : [...half(P), ...half([...P].reverse())];
  const has = (c, p) => Math.hypot(p.x - c.x, p.y - c.y) <= c.r + 1e-7;
  const two = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, r: Math.hypot(a.x - b.x, a.y - b.y) / 2 });
  const three = (a, b, p) => {
    const d = 2 * (a.x * (b.y - p.y) + b.x * (p.y - a.y) + p.x * (a.y - b.y));
    if (Math.abs(d) < 1e-12) {
      // in a line: the circle through the two farthest apart
      const cs = [two(a, b), two(a, p), two(b, p)];
      return cs.reduce((m, q) => (q.r > m.r ? q : m));
    }
    const A = a.x * a.x + a.y * a.y,
      B = b.x * b.x + b.y * b.y,
      C = p.x * p.x + p.y * p.y,
      x = (A * (b.y - p.y) + B * (p.y - a.y) + C * (a.y - b.y)) / d,
      y = (A * (p.x - b.x) + B * (a.x - p.x) + C * (b.x - a.x)) / d;
    return { x, y, r: Math.hypot(a.x - x, a.y - y) };
  };
  let c = null;
  for (let i = 0; i < hull.length; i++) {
    if (c && has(c, hull[i])) continue;
    c = { x: hull[i].x, y: hull[i].y, r: 0 };
    for (let j = 0; j < i; j++) {
      if (has(c, hull[j])) continue;
      c = two(hull[i], hull[j]);
      for (let k = 0; k < j; k++) if (!has(c, hull[k])) c = three(hull[i], hull[j], hull[k]);
    }
  }
  return c;
}
/* A droppable piece: any set of states laid out as on the map, rotated about the centre of its bounding box. */
export function makePiece(states, name) {
  const pts = states.flatMap(id => STATES[id].parts.flatMap(p => p.outline));
  const bb = {
    minX: Math.min(...pts.map(p => p.x)),
    maxX: Math.max(...pts.map(p => p.x)),
    minY: Math.min(...pts.map(p => p.y)),
    maxY: Math.max(...pts.map(p => p.y)),
  };
  // Spin about the centre of the smallest circle around the piece, so the arrow ring hugs it at both ends.
  // (Spinning about the area-weighted centre left long, lopsided pieces like Norway with a big gap on one side.)
  // (The ring also takes in the tip of any sea-crossing stub, so the stub never pokes out of it.)
  const tips = states.flatMap(id =>
    STATES[id].crossings
      .filter(x => !states.includes(x.to))
      .map(x => {
        const d = Math.hypot(x.at.x - x.from.x, x.at.y - x.from.y) || 1,
          L = CFG.crossingStub + CFG.crossingWidth / 2 + 1; // plus the rounded end
        return { x: x.from.x + ((x.at.x - x.from.x) / d) * L, y: x.from.y + ((x.at.y - x.from.y) / d) * L };
      }),
  );
  const { x, y, r: R } = enclosingCircle([...pts, ...tips]),
    c = { x, y };
  return { name, states, bb, pts, c, R };
}
for (const p of PIECES) Object.assign(p, makePiece(p.states, p.name));
/* The pieces dealt each round */
export const DECK = TEST_IDS ? PIECES.filter(p => p.states.every(id => TEST_IDS.includes(id))) : PIECES;
/* Extent of a piece rotated by ang, relative to its centre */
export function extent(pc, ang) {
  const cs = Math.cos(ang),
    sn = Math.sin(ang);
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const p of pc.pts) {
    const dx = p.x - pc.c.x,
      dy = p.y - pc.c.y,
      rx = cs * dx - sn * dy,
      ry = sn * dx + cs * dy;
    if (rx < x0) x0 = rx;
    if (rx > x1) x1 = rx;
    if (ry < y0) y0 = ry;
    if (ry > y1) y1 = ry;
  }
  return { x0, x1, y0, y1 };
}

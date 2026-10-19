import Matter from 'matter-js';
import { BOX, CFG, VH, VW } from '../config.js';
import { onMerged } from '../game/game.js';
import { bridgeChunks, STATES } from '../map/geometry.js';
import { G } from '../state.js';

const { Bodies, Body, Composite, Engine, Events, Sleeping, Vertices } = Matter;

export const ownerOf = {}; // stateId -> group body

export function setupWorld() {
  G.engine = Engine.create({ positionIterations: 10, velocityIterations: 8, enableSleeping: true });
  Sleeping._motionSleepThreshold = CFG.sleepMotion;
  G.engine.gravity.y = CFG.gravity;
  G.world = G.engine.world;
  const T = 400,
    opts = { isStatic: true, friction: 0.6 };
  Composite.add(G.world, [
    Bodies.rectangle(BOX.l - T / 2, VH / 2 - 400, T, VH + 1600, opts),
    Bodies.rectangle(BOX.r + T / 2, VH / 2 - 400, T, VH + 1600, opts),
    Bodies.rectangle(VW / 2, BOX.b + T / 2, VW + 2 * T, T, opts),
  ]);
  G.walls = Composite.allBodies(G.world).filter(b => b.isStatic);
  retryAt.clear();
  Events.on(G.engine, 'collisionStart', onCollide);
  Events.on(G.engine, 'collisionActive', onCollide);
  G.groups = [];
  for (const k in ownerOf) delete ownerOf[k];
}
/* Build one rigid body from a set of states, laid out in their true map positions.
   g.m0 = the map-space point that sits at g.position, so world(m) = pos + R(angle)(m - m0). */
/* Round each convex physics piece's corners so resting contacts don't flip between sharp vertices.
   Radius is capped per corner so short edges aren't eaten away. */
function roundCorners(c) {
  const v = c.map(p => ({ x: p.x, y: p.y }));
  Vertices.clockwiseSort(v);
  const n = v.length,
    radii = [];
  for (let i = 0; i < n; i++) {
    const a = v[(i - 1 + n) % n],
      b = v[i],
      d = v[(i + 1) % n];
    radii.push(
      Math.min(CFG.cornerRadius, 0.3 * Math.hypot(b.x - a.x, b.y - a.y), 0.3 * Math.hypot(d.x - b.x, d.y - b.y)),
    );
  }
  return Vertices.chamfer(v, radii, -1, 2, 5);
}
export function buildGroup(ids) {
  // the states' own shapes, and their bridges across water (solid, so they don't pass through walls or other pieces)
  const chunks = [...ids.flatMap(id => STATES[id].chunks), ...bridgeChunks(new Set(ids))];
  const pieces = [];
  for (const ch of chunks) {
    const verts = roundCorners(ch.verts);
    const p = Body.create({ position: Vertices.centre(verts), vertices: verts });
    p.stateId = ch.state;
    p.bridge = !!ch.bridge;
    pieces.push(p);
  }
  const g = Body.create({
    parts: pieces,
    friction: 0.55,
    frictionStatic: 0.9,
    restitution: 0,
    frictionAir: 0.006,
    slop: 0.08,
  });
  g.ids = new Set(ids);
  g.m0 = { x: g.position.x, y: g.position.y };
  g.born = performance.now();
  return g;
}
export function addGroup(g) {
  Composite.add(G.world, g);
  G.groups.push(g);
  for (const id of g.ids) ownerOf[id] = g;
}
export function removeGroup(g) {
  Composite.remove(G.world, g);
  G.groups = G.groups.filter(x => x !== g);
}
/* Neighbor contact → queue a merge (applied after the physics step) */
let mergeQueue = [];
const retryAt = new Map(); // pair of piece ids -> time a blocked merge may be tried again
// Small shifts to try when a piece's exact map position is occupied (prefer up and sideways)
const SNAP_NUDGES = [
  [0, 0],
  [0, -5],
  [-5, 0],
  [5, 0],
  [0, -10],
  [-10, -5],
  [10, -5],
  [0, -16],
  [-14, 0],
  [14, 0],
  [0, -24],
];
/* Deepest overlap between candidate piece g and everything else (other pieces and the box), ignoring `skip`. */
export function overlapDepth(g, skip) {
  let worst = 0;
  const others = G.groups.filter(o => !skip.includes(o) && Matter.Bounds.overlaps(o.bounds, g.bounds)).concat(G.walls);
  for (const o of others) {
    const ops = o.parts.length > 1 ? o.parts.slice(1) : [o];
    for (const a of g.parts.slice(1))
      for (const b of ops) {
        if (!Matter.Bounds.overlaps(a.bounds, b.bounds)) continue;
        const c = Matter.Collision.collides(a, b);
        if (c && c.depth > worst) {
          worst = c.depth;
          if (worst > CFG.snapTolerance) return worst;
        }
      }
  }
  return worst;
}
function onCollide(e) {
  for (const pair of e.pairs) {
    const a = pair.bodyA,
      b = pair.bodyB;
    if (!a.stateId || !b.stateId || a.parent === b.parent) continue;
    if (STATES[a.stateId].stickTo.has(b.stateId)) mergeQueue.push([a.stateId, b.stateId]);
  }
}
export function processMerges() {
  const q = mergeQueue;
  mergeQueue = [];
  const now = performance.now();
  for (const [sa, sb] of q) {
    const A0 = ownerOf[sa],
      B0 = ownerOf[sb];
    if (!A0 || !B0 || A0 === B0) continue;
    const key = Math.min(A0.id, B0.id) + '|' + Math.max(A0.id, B0.id);
    if ((retryAt.get(key) || 0) > now) continue;
    const g = buildGroup([...A0.ids, ...B0.ids]);
    // Snap into true map position, anchored on the larger piece first, then the smaller,
    // nudging slightly if needed. Never snap into another piece: if there's no room, retry later.
    const hosts = A0.area >= B0.area ? [A0, B0] : [B0, A0];
    let host = null;
    search: for (const H of hosts) {
      const dx = g.m0.x - H.m0.x,
        dy = g.m0.y - H.m0.y,
        c = Math.cos(H.angle),
        s = Math.sin(H.angle);
      const bx = H.position.x + c * dx - s * dy,
        by = H.position.y + s * dx + c * dy;
      Body.setAngle(g, H.angle);
      for (const [ox, oy] of SNAP_NUDGES) {
        Body.setPosition(g, { x: bx + ox, y: by + oy });
        if (overlapDepth(g, [A0, B0]) <= CFG.snapTolerance) {
          host = H;
          break search;
        }
      }
    }
    if (!host) {
      retryAt.set(key, now + CFG.snapRetry);
      continue;
    }
    retryAt.delete(key);
    const m = A0.mass + B0.mass;
    const vA = Body.getVelocity(A0),
      vB = Body.getVelocity(B0);
    Body.setVelocity(g, { x: (vA.x * A0.mass + vB.x * B0.mass) / m, y: (vA.y * A0.mass + vB.y * B0.mass) / m });
    Body.setAngularVelocity(g, Body.getAngularVelocity(host) * 0.5);
    g.born = Math.min(A0.born, B0.born);
    removeGroup(A0);
    removeGroup(B0);
    addGroup(g);
    for (const o of G.groups) if (o.isSleeping) Sleeping.set(o, false); // something may have been resting on what just moved
    G.flashes.push({ g, t: performance.now() });
    onMerged(g);
  }
}

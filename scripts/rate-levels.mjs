/*
 * Difficulty rating: measures each level and plays it many times with simulated players, then rates it 1-5 by how
 * often the aiming player completes the map (the scale is in difficulty.mjs). Writes src/levels/<key>/difficulty.json;
 * docs/difficulty.md explains it all.
 *
 *   npm run rate:levels                    every level, 48 games per player (about 10-15 minutes a level)
 *   npm run rate:levels -- eu --games 96   one level, more games (a steadier win rate, slower)
 *   npm run rate:levels -- --rescore       re-rate from the games already played, after changing the scale
 *   --players aiming   only the player the rating uses (faster, for tuning); --verbose a line per game;
 *   --dry-run          print without writing difficulty.json
 *
 * The games run the real game code in a headless browser (an installed Edge or Chrome; set RATE_BROWSER=chrome or
 * msedge to choose) on a simulated clock and seeded randomness, so they're fast and repeatable. Two players:
 *   aiming  - lands each piece on a region it borders when one is showing on top of the pile; otherwise drops it
 *             upright where it sits on the finished map. Shakes when the pile is over the red line, blends if that
 *             fails. Once every piece is in: shakes, then blends, then banks a loose piece and drops it on a neighbor.
 *   random  - drops anywhere, at any angle; shakes and blends once every piece is in.
 * Both give up when nothing has joined for a while with nothing left to try. Only round 1 is played (later rounds
 * lower the red line).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { inputsHash, rate } from './difficulty.mjs';

const ROOT = new URL('../', import.meta.url);
const LEVELS = new URL('src/levels/', ROOT);
const args = process.argv.slice(2);
const opt = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const games = +opt('--games') || 48,
  players = opt('--players')?.split(',') ?? ['aiming', 'random'], // e.g. --players aiming, to tune faster
  verbose = args.includes('--verbose'), // a line per game
  dryRun = args.includes('--dry-run'), // print the results without writing difficulty.json
  rescore = args.includes('--rescore');
const keys = args.filter((a, i) => !a.startsWith('--') && !['--games', '--players'].includes(args[i - 1]));
const all = readdirSync(LEVELS, { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(new URL(`${d.name}/level.js`, LEVELS)))
  .map(d => d.name);
const todo = keys.length ? keys : all;
for (const k of todo) if (!all.includes(k)) throw new Error(`No level "${k}" (have: ${all.join(', ')})`);

/* ---- in the page: replace the clock, timers and randomness before the game loads ---- */
function virtualTime() {
  let T = 0,
    nextId = 1,
    state = 1;
  const timers = [];
  performance.now = () => T;
  window.setTimeout = (fn, ms = 0, ...a) => {
    const id = nextId++;
    timers.push({ id, at: T + ms, fn: () => fn(...a) });
    return id;
  };
  window.clearTimeout = id => {
    const i = timers.findIndex(t => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  };
  window.requestAnimationFrame = () => 0; // the simulator runs the frames itself
  // mulberry32: small seeded generator
  Math.random = () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__sim = {
    now: () => T,
    seed: s => (state = s * 2654435761),
    advance(ms) {
      const end = T + ms;
      for (;;) {
        let k = -1;
        for (let i = 0; i < timers.length; i++)
          if (timers[i].at <= end && (k < 0 || timers[i].at < timers[k].at)) k = i;
        if (k < 0) break;
        const [t] = timers.splice(k, 1);
        T = Math.max(T, t.at);
        t.fn();
      }
      T = end;
    },
  };
  try {
    localStorage.setItem('merge-it-muted', '1');
    localStorage.setItem('merge-it-tutorial-done', '1');
  } catch (e) {}
}

/* Static measurements, from the game's own geometry */
async function measure() {
  const geo = await import('/src/map/geometry.js'),
    { CFG, BOX } = await import('/src/config.js'),
    { dangerY } = await import('/src/game/game.js');
  const room = CFG.boxW * (BOX.b - dangerY()); // box area below the red line, round 1
  const hull = pts => {
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
    const H = [...half(P), ...half([...P].reverse())];
    let a = 0;
    for (let i = 0; i < H.length; i++) a += H[i].x * H[(i + 1) % H.length].y - H[(i + 1) % H.length].x * H[i].y;
    return Math.abs(a) / 2;
  };
  const S = geo.STATES,
    pieces = geo.DECK.map(p => {
      const area = p.states.reduce((t, id) => t + S[id].area, 0);
      const joins = geo.DECK.filter(q => q !== p && q.states.some(id => p.states.some(x => S[x].stickTo.has(id))));
      return { area, hull: hull(p.pts), span: (2 * p.R) / CFG.boxW, joins: joins.length };
    });
  const total = pieces.reduce((t, p) => t + p.area, 0),
    spans = pieces.map(p => p.span).sort((a, b) => a - b);
  const r2 = x => Math.round(x * 100) / 100;
  return {
    pieces: geo.DECK.length,
    regions: geo.IDS.length,
    fill: r2(total / room), // all the pieces' area as a share of the room below the red line
    mapHeight: r2(geo.MAP_H / (BOX.b - dangerY())), // finished map's height as a share of that room
    solidity: r2(total / pieces.reduce((t, p) => t + p.hull, 0)), // 1 = every piece convex; low = sprawling shapes
    widestPiece: r2(spans.at(-1)), // the biggest piece's spin circle, as a share of the box width
    medianPiece: r2(spans[spans.length >> 1]),
    neighbors: r2(pieces.reduce((t, p) => t + p.joins, 0) / pieces.length), // average pieces each piece can join
    deadEnds: pieces.filter(p => p.joins === 1).length, // pieces with only one partner
    seaLinks: Object.values(S).reduce((t, s) => t + s.crossings.length, 0) / 2,
    boxW: CFG.boxW,
  };
}

/* One game of round 1 with one simulated player; returns how it went */
async function play({ seed, player }) {
  const sim = window.__sim;
  const M = (window.__mods ??= {
    G: (await import('/src/state.js')).G,
    game: await import('/src/game/game.js'),
    aim: await import('/src/game/aim.js'),
    loop: await import('/src/game/loop.js'),
    shake: await import('/src/game/shake.js'),
    blend: await import('/src/game/blend.js'),
    bank: await import('/src/game/bank.js'),
    cfg: await import('/src/config.js'),
    geo: await import('/src/map/geometry.js'),
    world: await import('/src/physics/world.js'),
    // (any copy of Matter will do for checking overlaps: its collision functions work on any bodies)
    Matter: (await import('/node_modules/.vite/deps/matter-js.js')).default,
  });
  const { G, cfg, geo } = M,
    { BOX, CFG } = cfg;
  const STEP = 1000 / 60,
    THINK = 1200, // ms between drops, like a person deciding where to aim
    rnd = Math.random;
  sim.seed(seed);
  M.game.newGame();
  const live = () => G.state === 'playing' || G.state === 'blending';
  const wait = ms => {
    for (let t = 0; t < ms && live(); t += STEP) {
      sim.advance(STEP);
      M.loop.step(sim.now());
    }
    while (G.state === 'blending') {
      sim.advance(STEP);
      M.loop.step(sim.now());
    }
  };
  const line = M.game.dangerY(),
    start = sim.now();
  let peak = 0,
    shakes = 0,
    blends = 0,
    drops = 0,
    joinedOnDrop = 0,
    sawNeighbor = 0, // drops the aiming player could land on a region it borders
    touchedNotJoined = 0, // drops left resting against a region they border without joining (no room to snap in)
    aimedJoin = false;
  // how high the pile sits, counted like the red line counts it: settled pieces past their grace period
  const notePile = () => {
    const rest = G.groups.filter(g => g.speed < 1.2 && sim.now() - g.born > CFG.overflowGrace);
    if (rest.length) peak = Math.max(peak, (BOX.b - Math.min(...rest.map(g => g.bounds.min.y))) / (BOX.b - line));
  };
  const doShake = () => {
    if (G.state !== 'playing' || sim.now() - G.lastShake < CFG.shakeCooldown) return false;
    M.shake.shake();
    shakes++;
    return true;
  };
  const doBlend = () => {
    if (G.state !== 'playing' || G.blendsLeft <= 0) return false;
    M.blend.blendIt();
    blends++;
    return true;
  };
  // The chunk a piece falling straight down over [x0, x1] lands on first: the highest one there (smaller y = higher)
  const chunks = skip => G.groups.filter(g => g !== skip).flatMap(g => g.parts.slice(1));
  const landing = (x0, x1, skip) => {
    let top = BOX.b,
      on = null;
    for (const p of chunks(skip))
      if (p.bounds.max.x > x0 && p.bounds.min.x < x1 && p.bounds.min.y < top) ((top = p.bounds.min.y), (on = p));
    return { top, on };
  };
  const wanted = ids => new Set(ids.flatMap(id => [...geo.STATES[id].stickTo]));
  const aimAt = pc => {
    if (player === 'random') {
      G.aimX = BOX.l + rnd() * CFG.boxW;
      G.aimAngle = rnd() * 2 * Math.PI;
      return;
    }
    // Land it on a region it borders, if one is showing on top of the pile (trying a few turns, and many spots
    // across the box; the lowest landing wins). Otherwise drop it upright where it sits on the finished map, so
    // pieces that will join end up near each other, like building the map in place.
    const want = wanted(pc.states),
      turns = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    for (const g of G.groups) if ([...g.ids].some(id => want.has(id))) turns.push(g.angle);
    let best = null;
    for (const ang of turns) {
      const e = geo.extent(pc, ang),
        lo = BOX.l - e.x0,
        hi = Math.max(lo, BOX.r - e.x1);
      for (let i = 0; i <= 30; i++) {
        const x = lo + ((hi - lo) * i) / 30,
          L = landing(x + e.x0, x + e.x1);
        if (L.on && want.has(L.on.stateId) && (!best || L.top > best.top)) best = { top: L.top, x, ang };
      }
    }
    aimedJoin = !!best;
    G.aimX = best ? best.x : BOX.l + (CFG.boxW - geo.MAP_W) / 2 + pc.c.x;
    G.aimAngle = best ? best.ang : 0;
  };
  // Is this piece resting against a region it borders (an active contact) while still separate from it?
  const touchingNeighbor = g =>
    G.engine.pairs.list.some(p => {
      if (!p.isActive) return false;
      const [a, b] = [p.bodyA, p.bodyB];
      const mine = a.parent === g ? a : b.parent === g ? b : null,
        other = mine === a ? b : a;
      return mine && other.stateId && other.parent !== g && geo.STATES[mine.stateId].stickTo.has(other.stateId);
    });
  // Endgame move: bank a loose piece that borders a region showing on top of the pile, and drop it there
  const bankMove = () => {
    if (player === 'random' || G.state !== 'playing' || G.bankPhase !== 'ready' || G.current) return false;
    const big = G.groups.reduce((a, b) => (b.ids.size > a.ids.size ? b : a));
    for (const L of G.groups.filter(g => g !== big).sort((a, b) => a.ids.size - b.ids.size)) {
      const want = wanted([...L.ids]);
      let showing = false;
      for (let i = 0; i <= 60 && !showing; i++) {
        const x = BOX.l + (CFG.boxW * i) / 60,
          { on } = landing(x - 1, x + 1, L);
        showing = !!on && want.has(on.stateId);
      }
      if (!showing) continue;
      M.bank.askBank(L);
      M.bank.closeBank(true);
      document.getElementById('bankBtn').click(); // take it back out of the bank: now it's the piece to drop
      if (!G.current) return false;
      wait(THINK);
      aimAt(G.current);
      M.aim.clampAim();
      M.aim.drop();
      return true;
    }
    return false;
  };

  // Dropping the deck
  let before = 0,
    dropped = null;
  while (live() && G.current) {
    wait(THINK);
    notePile();
    if (!live() || !G.current) break;
    if (drops && G.groups.length <= before)
      joinedOnDrop++; // the last drop joined something
    else if (dropped && G.groups.includes(dropped) && touchingNeighbor(dropped)) touchedNotJoined++;
    aimAt(G.current);
    if (aimedJoin) sawNeighbor++;
    M.aim.clampAim();
    before = G.groups.length;
    M.aim.drop();
    dropped = G.groups.at(-1);
    drops++;
    if (player === 'aiming' && G.dangerSince !== null) {
      // over the line: shake; if it's still over after two shakes, blend
      doShake();
      wait(1000);
      if (G.dangerSince !== null) {
        doShake();
        wait(1000);
        if (G.dangerSince !== null) doBlend();
      }
    }
  }
  // Every piece is in: shake until the map is done or nothing joins any more; blend when shaking stalls
  const deckDone = sim.now(),
    looseAtDeckEnd = G.groups.length;
  let calm = 0,
    count = G.groups.length;
  while (live() && sim.now() - deckDone < 120000) {
    wait(1200);
    if (!live()) break;
    if (G.groups.length < count) ((count = G.groups.length), (calm = 0));
    else calm++;
    if (calm >= 4 && (doBlend() || bankMove())) calm = 0;
    else if (calm >= 8)
      break; // nothing joins and nothing left to try: a player would give up here
    else doShake();
  }
  const won = G.state === 'clearing' || G.state === 'won';
  const result = won ? 'win' : G.state === 'over' ? 'overflow' : 'stuck';
  const biggest = Math.max(...G.groups.map(g => g.ids.size)) / geo.GOAL_IDS.length;
  // at the end: pairs of pieces resting against a region they border without joining
  const blockedAtEnd = new Set();
  for (const p of G.engine.pairs.list)
    if (p.isActive && p.bodyA.stateId && p.bodyB.stateId && p.bodyA.parent !== p.bodyB.parent)
      if (geo.STATES[p.bodyA.stateId].stickTo.has(p.bodyB.stateId))
        blockedAtEnd.add([p.bodyA.parent.id, p.bodyB.parent.id].sort().join('|'));
  // physics faults at the end: pieces sunk into another piece or a wall (deeper than a merge's snap tolerance), and
  // pieces outside the box
  const sunkGroups = G.groups.filter(g => M.world.overlapDepth(g, [g]) > CFG.snapTolerance),
    sunk = sunkGroups.length,
    // ...and whether a bridge is in it: a sunk piece with a bridge in the overlap
    sunkBridge = sunkGroups.filter(g =>
      g.parts.slice(1).some(a =>
        G.groups
          .filter(o => o !== g)
          .flatMap(o => o.parts.slice(1))
          .concat(G.walls)
          .some(b => (a.bridge || b.bridge) && M.Matter.Collision.collides(a, b)?.depth > CFG.snapTolerance),
      ),
    ).length,
    outside = G.groups.filter(
      g => g.bounds.min.x < BOX.l - 2 || g.bounds.max.x > BOX.r + 2 || g.bounds.max.y > BOX.b + 2,
    ).length;
  G.state = 'over'; // stop here; the next game starts fresh
  return {
    result,
    drops,
    deck: geo.DECK.length,
    peak,
    shakes,
    blends,
    biggest,
    joinRate: joinedOnDrop / Math.max(1, drops - 1),
    sawNeighbor: sawNeighbor / Math.max(1, drops),
    blockedRate: touchedNotJoined / Math.max(1, drops - 1),
    looseAtDeckEnd,
    looseAtEnd: G.groups.length,
    blockedAtEnd: blockedAtEnd.size,
    sunk,
    sunkBridge,
    outside,
    seconds: (sim.now() - start) / 1000,
  };
}

/* ---- run it ---- */
function report(key, out) {
  const a = out.sim.aiming,
    [lo, hi] = out.range;
  console.log(
    `${key}: ${out.rating} ${out.label} (${lo === hi ? 'firmly' : `could be ${lo}-${hi}`}) | aiming player won ${a.wins ?? Math.round(a.winRate * a.games)}/${a.games} | fill ${out.stats.fill}`,
  );
}
// --rescore: re-rate from the games already played (after changing the scale), without playing them again
if (rescore) {
  for (const key of todo) {
    const file = new URL(`${key}/difficulty.json`, LEVELS);
    if (!existsSync(file)) {
      console.log(`${key}: not rated yet`);
      continue;
    }
    const old = JSON.parse(readFileSync(file, 'utf8')),
      { stats, sim, inputs } = old,
      out = { ...rate(sim, stats), stats, sim, inputs };
    if (!dryRun) writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    report(key, out);
  }
  process.exit(0);
}
const server = await createServer({
  root: fileURLToPath(ROOT),
  logLevel: 'error',
  // no file watching or hot reload: editing the game mid-run would reload the page under the simulation
  server: { port: 5287, strictPort: false, hmr: false, watch: null },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const channels = process.env.RATE_BROWSER ? [process.env.RATE_BROWSER] : ['msedge', 'chrome'];
let browser;
for (const channel of channels)
  try {
    browser = await chromium.launch({ channel, headless: true });
    break;
  } catch (e) {}
if (!browser) {
  await server.close();
  throw new Error(`Couldn't start ${channels.join(' or ')}; install one or set RATE_BROWSER`);
}
const avg = a => a.reduce((x, y) => x + y, 0) / (a.length || 1),
  sd = a => Math.sqrt(avg(a.map(x => (x - avg(a)) ** 2)) * (a.length / Math.max(1, a.length - 1))),
  r2 = x => Math.round(x * 100) / 100;
try {
  for (const key of todo) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 950 } });
    page.on('pageerror', e => console.error(`  page error: ${e.message}`));
    await page.addInitScript(virtualTime);
    await page.goto(`${base}?map=${key}`);
    await page.waitForSelector('#levelSwitch button', { state: 'attached' }); // (waitForFunction needs animation frames)
    const stats = await page.evaluate(measure);
    const sim = {};
    for (const player of players) {
      const runs = [];
      for (let seed = 1; seed <= games; seed++) {
        const r = await page.evaluate(play, { seed, player });
        runs.push(r);
        if (verbose)
          console.log(
            `    ${key} ${player} #${seed}: ${r.result} | ${r.drops}/${r.deck} dropped, ${Math.round(r.joinRate * 100)}% joined on landing (saw a neighbor ${Math.round(r.sawNeighbor * 100)}%, touched one but blocked ${Math.round(r.blockedRate * 100)}%) | loose pieces ${r.looseAtDeckEnd} at deck end -> ${r.looseAtEnd} (${r.blockedAtEnd} pairs touching but not joined) | biggest ${Math.round(r.biggest * 100)}% | peak ${Math.round(r.peak * 100)}% | ${r.shakes} shakes ${r.blends} blends | ${r.seconds.toFixed(0)}s`,
          );
      }
      const n = k => runs.filter(r => r.result === k).length;
      sim[player] = {
        games,
        wins: n('win'),
        winRate: r2(n('win') / games), // the whole map assembled
        overflowRate: r2(n('overflow') / games), // the box overflowed
        stuckRate: r2(n('stuck') / games), // every piece in, but the rest never joined
        assembled: r2(avg(runs.map(r => r.biggest))), // share of the map in the biggest piece at the end (a win = 1)
        assembledSE: r2(sd(runs.map(r => r.biggest)) / Math.sqrt(games)), // its standard error
        leftover: r2(avg(runs.map(r => r.looseAtEnd))), // separate pieces still in the box at the end
        joinOnLanding: r2(avg(runs.map(r => r.joinRate))), // drops that joined something as they landed
        pressure: r2(avg(runs.map(r => r.peak))), // highest the settled pile got while dropping, as a share of the room below the line
        shakes: r2(avg(runs.map(r => r.shakes))),
        blends: r2(avg(runs.map(r => r.blends))),
        minutes: r2(avg(runs.map(r => r.seconds)) / 60),
        // physics faults, totals over all games (should be 0): pieces sunk into another piece or a wall, pieces
        // outside the box
        sunk: runs.reduce((t, r) => t + r.sunk, 0),
        sunkAtBridge: runs.reduce((t, r) => t + r.sunkBridge, 0), // ...of those, with a bridge in the overlap
        outside: runs.reduce((t, r) => t + r.outside, 0),
      };
      const s = sim[player],
        faults = s.sunk + s.outside;
      process.stdout.write(
        `  ${key} ${player}: ${n('win')}/${games} won${faults ? ` | PHYSICS FAULTS: ${s.sunk} pieces sunk into others or a wall (${s.sunkAtBridge} at a bridge), ${s.outside} outside the box` : ''}\n`,
      );
    }
    await page.close();
    const out = { ...rate(sim, stats), stats, sim, inputs: inputsHash(key) };
    if (!dryRun) writeFileSync(new URL(`${key}/difficulty.json`, LEVELS), JSON.stringify(out, null, 2) + '\n');
    report(key, out);
    console.log(`  stats ${JSON.stringify(stats)}`);
    for (const p of players) console.log(`  ${p.padEnd(6)} ${JSON.stringify(sim[p])}`);
  }
} finally {
  await browser.close();
  await server.close();
}

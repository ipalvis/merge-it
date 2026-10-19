/*
 * Checks every level in src/levels/ for mistakes that would otherwise only show up in play: a map that can't be
 * completed (regions with no way to join the rest), regions missing from the color groups, pre-joined clusters
 * that don't touch, bonus groups or test ids naming regions that aren't on the map, and so on.
 *
 * Run with `npm run check:levels` (also part of `npm run build`, so a broken level can't deploy).
 * Errors fail the run; warnings are printed but pass.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { inputsHash, ratingInputs } from './difficulty.mjs';
import { measureLevel } from './level-geometry.mjs';

const LEVELS = new URL('../src/levels/', import.meta.url);
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
// Color slots the theme defines (--c0, --c1, ... in styles.css)
const COLORS = new Set(read('../src/styles.css').match(/--c\d+(?=:)/g)).size;
// Songs sound.js knows (the keys of its SONGS table)
const SONGS = [...read('../src/audio/sound.js').matchAll(/^ {4}(\w+): \{/gm)].map(m => m[1]);
// Regions the scripted tutorial uses (game/tutorial.js), so a level with `tutorial: true` must have them
const TUTORIAL_IDS = ['CO', 'WY', 'UT', 'MT', 'AZ', 'NM'];
/* Design rules, in the box's own units (logical px, the same in every level; see level-geometry.mjs). The two
   original maps came first and keep their small pieces (Moldova, New Jersey) and narrow joins (Colorado-Oklahoma, the
   Øresund Bridge); every new level has to follow them.
   - Minimum piece size: every piece (a region, or a pre-joined cluster) at least this big as drawn. Smaller pieces
     are too small to aim at reliably, or to show a code. It's Paraguay's size in the first Latin America map (579),
     rounded down.
   - Minimum connection width: the whole map must be completable using only connections at least this wide (a shared
     border, or a sea crossing's bridge), so no piece depends on a sliver to join: half the width of a minimum-size
     piece. Narrower borders can exist; the map just mustn't need them (Panama to Colombia was 9). */
const MIN_PIECE_AREA = 570,
  MIN_CONNECTION = 12,
  RULES_EXEMPT = new Set(['us', 'eu']);

/* Do these ids form one connected piece using only each other as stepping stones? Returns the separate parts. */
function parts(ids, nb) {
  const left = new Set(ids),
    out = [];
  while (left.size) {
    const [start] = left,
      part = [start],
      seen = new Set(part);
    left.delete(start);
    for (let i = 0; i < part.length; i++)
      for (const n of nb[part[i]] ?? [])
        if (left.has(n) && !seen.has(n)) {
          seen.add(n);
          left.delete(n);
          part.push(n);
        }
    out.push(part);
  }
  return out;
}

let errors = 0;
const orders = new Map();
const keys = readdirSync(LEVELS, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);
for (const key of keys) {
  const err = [],
    warn = [];
  const has = f => existsSync(new URL(`${key}/${f}`, LEVELS));
  for (const f of ['level.js', 'map.json', 'source.mjs']) if (!has(f)) err.push(`missing ${f}`);
  if (!has('level.js') || !has('map.json')) {
    report(key, err, warn);
    continue;
  }
  const L = (await import(new URL(`${key}/level.js`, LEVELS))).default;
  const D = JSON.parse(readFileSync(new URL(`${key}/map.json`, LEVELS), 'utf8'));

  // Settings
  if (typeof L.order !== 'number') err.push('order: needs a number (its place on the map switch)');
  else if (orders.has(L.order)) err.push(`order ${L.order} is also used by ${orders.get(L.order)}`);
  else orders.set(L.order, key);
  for (const f of ['name', 'unit', 'units', 'goal', 'tagline'])
    if (typeof L[f] !== 'string' || !L[f].trim()) err.push(`${f}: needs some text`);
  if (L.song !== undefined && !SONGS.includes(L.song))
    err.push(`song "${L.song}" isn't in audio/sound.js (has: ${SONGS.join(', ')})`);
  if (L.boxW !== undefined && !(L.boxW >= 240 && L.boxW <= 600))
    err.push(`boxW ${L.boxW}: should be 240-600 (600 is the standard box)`);

  // Map data
  const ids = D.states?.map(s => s.id) ?? [];
  if (!(D.w > 0 && D.h > 0) || !ids.length) err.push('map.json: no regions or no size; rebuild it');
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) err.push(`map.json: repeated ids ${ids.filter((x, i) => ids.indexOf(x) !== i)}`);
  const nb = {};
  for (const s of D.states ?? []) {
    nb[s.id] = s.neighbors;
    if (!s.parts?.length || s.parts.some(p => p.outline.length < 3 || !p.convex.length))
      err.push(`${s.id}: has no usable shape in map.json`);
    for (const n of s.neighbors) {
      if (n === s.id) err.push(`${s.id}: lists itself as a neighbor`);
      else if (!idSet.has(n)) err.push(`${s.id}: neighbor ${n} isn't on the map`);
    }
  }
  for (const s of D.states ?? [])
    for (const n of s.neighbors)
      if (idSet.has(n) && !nb[n].includes(s.id)) err.push(`${s.id} lists ${n} as a neighbor but not the reverse`);
  for (const l of D.links ?? [])
    if (!idSet.has(l.a) || !idSet.has(l.b)) err.push(`sea link ${l.a}-${l.b}: not both on the map`);
  const unknown = (where, list) => {
    const bad = list.filter(i => !idSet.has(i));
    if (bad.length) err.push(`${where}: ${bad.join(', ')} not on the map`);
  };

  // The whole map must be joinable, or a round can never be completed
  const islands = parts(ids, nb);
  if (islands.length > 1)
    err.push(
      `the map falls apart into ${islands.length} pieces that can't join (add a sea link in source.mjs?): ` +
        islands.map(p => p.slice(0, 6).join(',') + (p.length > 6 ? ',…' : '')).join(' | '),
    );

  // Colors: every region in exactly one group, no more groups than the theme has colors
  const groups = L.colorGroups ?? [];
  if (groups.length > COLORS) err.push(`colorGroups: ${groups.length} groups, but the theme has ${COLORS} colors`);
  const colored = groups.flat();
  unknown('colorGroups', colored);
  const twice = colored.filter((x, i) => colored.indexOf(x) !== i);
  if (twice.length) err.push(`colorGroups: ${[...new Set(twice)].join(', ')} in more than one group`);
  const uncolored = ids.filter(i => !colored.includes(i));
  if (uncolored.length) err.push(`colorGroups: ${uncolored.join(', ')} in no group`);

  // Clusters ship pre-joined, so their members must touch each other
  const inCluster = new Map();
  for (const c of L.clusters ?? []) {
    unknown(`cluster "${c.name}"`, c.states);
    for (const i of c.states) {
      if (inCluster.has(i)) err.push(`${i} is in two clusters ("${inCluster.get(i)}", "${c.name}")`);
      inCluster.set(i, c.name);
    }
    const p = parts(
      c.states.filter(i => idSet.has(i)),
      nb,
    );
    if (p.length > 1) err.push(`cluster "${c.name}" doesn't hold together: ${p.map(x => x.join(',')).join(' | ')}`);
  }

  // Design rules (see MIN_PIECE_AREA, MIN_CONNECTION): big enough pieces, completable through wide enough connections
  if (!RULES_EXEMPT.has(key) && ids.length && !err.length) {
    const { pieces, links } = measureLevel(L, D);
    for (const p of pieces)
      if (p.area < MIN_PIECE_AREA)
        err.push(
          `piece ${p.name} is ${Math.round((100 * p.area) / MIN_PIECE_AREA)}% of the minimum piece size: pre-join it with a neighbor (clusters)`,
        );
    const wide = {};
    for (const l of links.filter(l => l.width >= MIN_CONNECTION)) {
      (wide[l.a] ??= []).push(l.b);
      (wide[l.b] ??= []).push(l.a);
    }
    const sides = parts(
      pieces.map(p => p.name),
      wide,
    );
    if (sides.length > 1) {
      const side = name => sides.findIndex(s => s.includes(name)),
        narrow = links.filter(l => side(l.a) !== side(l.b)).map(l => `${l.a}-${l.b} ${l.width.toFixed(1)}`);
      err.push(
        `only narrow connections (under ${MIN_CONNECTION}) join ${sides.map(s => s.join(',')).join(' | ')}: ${narrow.join(', ')}. ` +
          'Pre-join across one (clusters), or leave a side out',
      );
    }
  }

  // Bonus groups: names are how the game remembers which were built, so they must be unique
  const seenNames = new Set();
  for (const [kind, sets] of [
    ['divisions', L.divisions ?? {}],
    ['regions', L.regions ?? {}],
  ])
    for (const [name, list] of Object.entries(sets)) {
      if (seenNames.has(name)) err.push(`bonus group "${name}" is named twice`);
      seenNames.add(name);
      unknown(`${kind} "${name}"`, list);
      if (list.length && inCluster.has(list[0]) && list.every(i => inCluster.get(i) === inCluster.get(list[0])))
        err.push(
          `${kind} "${name}" ships pre-joined (cluster "${inCluster.get(list[0])}"), so it would score for free`,
        );
      if (
        parts(
          list.filter(i => idSet.has(i)),
          nb,
        ).length > 1
      )
        warn.push(`${kind} "${name}" isn't contiguous, so it only scores once something joins its parts`);
    }

  // Test mode deals only the test ids and completes when they join, so they must touch
  if (!Array.isArray(L.testIds) || L.testIds.length < 2) err.push('testIds: needs at least two regions');
  else {
    unknown('testIds', L.testIds);
    if (
      parts(
        L.testIds.filter(i => idSet.has(i)),
        nb,
      ).length > 1
    )
      err.push(`testIds ${L.testIds} don't all touch`);
    // (test mode deals only pieces made wholly of test ids, so each must be its own piece or a whole cluster of them)
    const testPieces = new Set(L.testIds.map(i => inCluster.get(i) ?? i));
    for (const c of L.clusters ?? [])
      if (c.states.some(i => L.testIds.includes(i)) && !c.states.every(i => L.testIds.includes(i)))
        err.push(
          `testIds: ${c.states.filter(i => L.testIds.includes(i))} ships pre-joined in "${c.name}", so test mode would never deal it`,
        );
    if (testPieces.size < 2) err.push('testIds: all in one piece, so test mode would have nothing to join');
  }
  if (L.tutorial) unknown('tutorial (game/tutorial.js uses these)', TUTORIAL_IDS);

  // Difficulty rating (scripts/rate-levels.mjs): there, and rated against the current settings and map
  let rated = '';
  if (!has('difficulty.json')) warn.push(`not rated yet: run npm run rate:levels -- ${key}`);
  else {
    const R = JSON.parse(readFileSync(new URL(`${key}/difficulty.json`, LEVELS), 'utf8'));
    rated = `, difficulty ${R.rating} ${R.label}`;
    if (R.inputs !== inputsHash(key))
      warn.push(
        `difficulty rating is out of date (${ratingInputs(key).join(', ')} changed): run npm run rate:levels -- ${key}`,
      );
  }

  report(key, err, warn, `${ids.length} ${L.units ?? 'regions'}${rated}`);
}
function report(key, err, warn, what = '') {
  errors += err.length;
  console.log(
    `${err.length ? '✗' : '✓'} ${key}${what && ` (${what})`}${err.length ? '' : warn.length ? ', with warnings' : ''}`,
  );
  for (const e of err) console.log(`    error: ${e}`);
  for (const w of warn) console.log(`    warning: ${w}`);
}
if (!keys.length) {
  console.log('No levels found in src/levels/');
  errors++;
}
if (errors) {
  console.log(`\n${errors} error${errors > 1 ? 's' : ''}`);
  process.exitCode = 1;
}

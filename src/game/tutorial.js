/*
 * Tutorial: a guided first game on a dimmed screen. Each step lifts the part of the screen it talks about
 * above the dim, and allows only the action it teaches.
 *
 *   1. Drop a state (hold to rotate, let go to drop)
 *   2. Drop a neighbor; the two stick together and the game freezes to explain
 *   3. A third neighbor lands out of reach; Shake the box joins it (guaranteed, see pull/forceMerge)
 *   4. Mid-game pile: bank a piece
 *   5. Every state in, nothing assembled: Blend It!
 *   then a "Let's Play!" card that starts a fresh game.
 *
 * While it runs, G.tut holds the allowed actions and the hooks gameplay modules call:
 * dropped(g), merged(g), shaken(), banked(), blendStart(), blendDone(), tick(now). G.tut is null otherwise.
 */
import Matter from 'matter-js';
import { Sound } from '../audio/sound.js';
import { BOX, CFG, STORAGE_KEYS, VW } from '../config.js';
import { clampAim } from './aim.js';
import { endBlend } from './blend.js';
import { newGame } from './game.js';
import { STATES, makePiece } from '../map/geometry.js';
import { MAP } from '../map/level.js';
import {
  addGroup,
  buildGroup,
  overlapDepth,
  ownerOf,
  processMerges,
  removeGroup,
  setupWorld,
} from '../physics/world.js';
import { G } from '../state.js';
import { $ } from '../ui/dom.js';
import { updateHUD } from '../ui/hud.js';

const { Body, Engine, Events, Sleeping } = Matter;

const STEPS = 5;
const STEP_MS = 1000 / 60;
let T = null; // this run's private state: timers, the active pull, the card's Next action

export function tutorialDone() {
  try {
    return localStorage.getItem(STORAGE_KEYS.tutorialDone) === '1';
  } catch (e) {
    return false;
  }
}
function markDone() {
  try {
    localStorage.setItem(STORAGE_KEYS.tutorialDone, '1');
  } catch (e) {}
}

/* ---------- card, dim and spotlight ---------- */

function show({ step, title, text, next, nextLabel = 'Next', pos = 'mid', skip = true }) {
  const card = $('tutCard');
  $('tutStep').textContent = step ? `Step ${step} of ${STEPS}` : '';
  $('tutStep').hidden = !step;
  $('tutTitle').textContent = title;
  $('tutText').textContent = text;
  $('tutSkip').hidden = !skip;
  const nb = $('tutNext');
  nb.hidden = !next;
  nb.textContent = nextLabel;
  T.onNext = next || null;
  card.dataset.pos = pos;
  T.cardHidden = false;
  card.hidden = false;
  card.classList.remove('pop');
  void card.offsetWidth;
  card.classList.add('pop');
  if (next) nb.focus({ preventScroll: true });
}
function hideCard() {
  T.cardHidden = true;
  $('tutCard').hidden = true;
}
/* Lift these elements above the dim (by id); everything else stays dimmed and can't be tapped */
function spotlight(...ids) {
  for (const el of document.querySelectorAll('.tut-lift')) el.classList.remove('tut-lift');
  for (const id of ids) $(id).classList.add('tut-lift');
}
function allow(...actions) {
  G.tut.allow = new Set(actions);
}
function later(ms, fn) {
  T.timers.push(
    setTimeout(() => {
      if (G.tut) fn();
    }, ms),
  );
}
function clearTimers() {
  for (const t of T.timers) clearTimeout(t);
  T.timers = [];
}
function clearHooks() {
  Object.assign(G.tut, {
    dropped: null,
    merged: null,
    shaken: null,
    banked: null,
    blendStart: null,
    blendDone: null,
  });
}

/* ---------- physics helpers ---------- */

const piece = id => makePiece([id], STATES[id].name);

/* Put g so its bounding box is centred on x with its top at y, inside the walls */
function placeAt(g, x, y) {
  const w = g.bounds.max.x - g.bounds.min.x;
  x = Math.max(BOX.l + w / 2 + 2, Math.min(BOX.r - w / 2 - 2, x));
  Body.setPosition(g, {
    x: g.position.x + x - (g.bounds.min.x + g.bounds.max.x) / 2,
    y: g.position.y + y - g.bounds.min.y,
  });
}
function simulate(ms) {
  for (let t = 0; t < ms; t += STEP_MS)
    for (let i = 0; i < CFG.substeps; i++) {
      Engine.update(G.engine, STEP_MS / CFG.substeps);
      processMerges();
    }
}
/* Build a scene instantly: drop each set of states in turn and let it settle (fast-forwarded, silent) */
function buildPile(specs) {
  G.tut.building = true;
  const made = [];
  for (const { ids, x, angle = 0 } of specs) {
    const g = buildGroup(ids);
    Body.setAngle(g, angle);
    placeAt(g, x, 10);
    for (let lift = 0; lift < 400 && overlapDepth(g, []) > CFG.snapTolerance; lift += 8)
      Body.setPosition(g, { x: g.position.x, y: g.position.y - 8 });
    addGroup(g);
    simulate(1400);
    made.push(g);
  }
  G.tut.building = false;
  G.flashes = [];
  G.last = performance.now();
  return made;
}
/* Gently steer the smaller of two pieces toward the other until they touch and merge.
   Runs on the engine's beforeUpdate, so the force applies on every physics substep. */
function startPull(a, b) {
  T.pull = [a, b];
}
function applyPull() {
  if (!T?.pull) return;
  const A = ownerOf[T.pull[0]],
    B = ownerOf[T.pull[1]];
  if (!A || !B || A === B) return;
  const [s, l] = A.area <= B.area ? [A, B] : [B, A];
  const dx = l.position.x - s.position.x;
  Sleeping.set(s, false);
  Sleeping.set(l, false);
  const k = Math.sign(dx) * Math.min(1, Math.abs(dx) / 60);
  Body.applyForce(s, s.position, { x: k * s.mass * 0.0024, y: -s.mass * 0.0005 });
}
function attachPull() {
  Events.on(G.engine, 'beforeUpdate', applyPull);
}
/* Backstop so the lesson always lands: join the two pieces' groups directly, upright and resting on the pile */
function forceMerge(a, b) {
  const A = ownerOf[a],
    B = ownerOf[b];
  if (!A || !B || A === B) return;
  const g = buildGroup([...A.ids, ...B.ids]);
  const cx = (A.position.x + B.position.x) / 2;
  let placed = false;
  for (const dx of [0, 40, -40, 80, -80, 140, -140, 220, -220]) {
    placeAt(g, cx + dx, 0);
    Body.setPosition(g, { x: g.position.x, y: g.position.y + BOX.b - 2 - g.bounds.max.y });
    for (let lift = 0; lift < 360; lift += 8) {
      if (overlapDepth(g, [A, B]) <= CFG.snapTolerance) {
        placed = true;
        break;
      }
      Body.setPosition(g, { x: g.position.x, y: g.position.y - 8 });
    }
    if (placed) break;
  }
  g.born = Math.min(A.born, B.born);
  removeGroup(A);
  removeGroup(B);
  addGroup(g);
  for (const o of G.groups) if (o.isSleeping) Sleeping.set(o, false);
  G.flashes.push({ g, t: performance.now() });
  Sound.fx.merge(g.ids.size);
  G.tut.merged?.(g);
  updateHUD();
}
const joined = (g, a, b) => g.ids.has(a) && g.ids.has(b);

/* ---------- the steps ---------- */

function resetRound() {
  endBlend();
  setupWorld();
  attachPull();
  G.round = 1;
  G.score = 0;
  G.deck = [];
  G.current = null;
  G.aimX = VW / 2;
  G.aimAngle = 0;
  G.press = null;
  G.blendsLeft = CFG.blendsPerRound;
  G.bank = null;
  G.bankPhase = 'ready';
  G.bankTarget = null;
  G.dangerSince = null;
  G.lastShake = -1e9;
  G.lastDrop = 0;
  G.flashes = [];
  G.tutGlow = null;
  T.pull = null;
  $('bankOverlay').hidden = true;
  $('toast').classList.remove('show');
}

function step1() {
  resetRound();
  G.current = piece('CO');
  clampAim();
  G.state = 'playing';
  allow('drop');
  spotlight('game');
  show({
    step: 1,
    title: 'Drop a state',
    text: 'Move to aim. Press and hold anywhere to rotate the current piece, then let go to drop it.',
  });
  G.tut.dropped = () => {
    G.tut.dropped = null;
    allow();
    later(1000, step2);
  };
  updateHUD();
}

function step2() {
  G.current = piece('WY');
  G.aimAngle = 0;
  clampAim();
  allow('drop');
  show({
    step: 2,
    title: 'Drop a neighbor',
    text: 'Wyoming borders Colorado on the map. Drop it right on top of Colorado.',
  });
  G.tut.dropped = () => {
    G.tut.dropped = null;
    allow();
    later(1000, () => startPull('WY', 'CO')); // landed off to the side: nudge it over
    later(4500, () => forceMerge('WY', 'CO'));
  };
  G.tut.merged = g => {
    if (!joined(g, 'CO', 'WY')) return;
    G.tut.merged = null;
    clearTimers();
    T.pull = null;
    G.tutGlow = g;
    // Freeze once the joined piece has (nearly) come to rest, so it isn't left hanging in mid-air
    const freeze = waited => {
      if (Body.getSpeed(g) > 0.6 && waited < 1200 && G.groups.includes(g))
        return later(100, () => freeze(waited + 100));
      G.state = 'tutorial';
      show({
        step: 2,
        title: 'They stuck together!',
        text: 'States that border each other on the map stick together and snap into place.',
        next: step3,
      });
      updateHUD();
    };
    freeze(0);
  };
  updateHUD();
}

function step3() {
  G.tutGlow = null;
  G.state = 'playing';
  G.current = null;
  allow();
  hideCard();
  // Drop Utah against the far wall, well away from Colorado and Wyoming
  const host = ownerOf.CO,
    g = buildGroup(['UT']),
    w = g.bounds.max.x - g.bounds.min.x,
    left = host.position.x > (BOX.l + BOX.r) / 2;
  placeAt(g, left ? BOX.l + w / 2 + 4 : BOX.r - w / 2 - 4, 14);
  addGroup(g);
  Sound.fx.drop();
  G.tut.merged = m => {
    if (joined(m, 'UT', 'CO')) step3Done();
  };
  later(1400, () => {
    allow('shake');
    spotlight('game', 'shakeBtn');
    show({
      step: 3,
      title: 'Shake the box',
      text: 'Utah borders both of them, but it landed out of reach. Tap Shake the box to jostle the pieces together.',
    });
    updateHUD();
  });
  G.tut.shaken = () => {
    if (T.pull) return;
    startPull('UT', 'CO');
    later(3000, () => forceMerge('UT', 'CO'));
  };
  updateHUD();
}
function step3Done() {
  clearHooks();
  clearTimers();
  T.pull = null;
  allow();
  spotlight('game');
  show({
    step: 3,
    title: 'Connected!',
    text: 'Shaking tosses every piece around, so neighbors get another chance to meet.',
    next: step4,
  });
  updateHUD();
}

function step4() {
  clearHooks();
  clearTimers();
  hideCard();
  resetRound();
  G.state = 'playing';
  const [, , , , fl] = buildPile([
    { ids: ['WA', 'OR', 'CA', 'NV'], x: 80 },
    { ids: ['TX', 'OK', 'LA', 'AR'], x: 320 },
    { ids: ['NY', 'PA', 'NJ', 'VT', 'NH', 'MA', 'CT', 'RI', 'ME'], x: 540 },
    { ids: ['ND', 'SD', 'NE'], x: 190 },
    { ids: ['FL'], x: 330, angle: 0.5 },
  ]);
  G.tutGlow = fl;
  allow('bank');
  spotlight('game', 'bankBtn');
  show({
    step: 4,
    title: 'Bank a piece',
    text: "Florida's neighbors aren't in yet, and it's taking up room. Tap the Bank, then tap Florida to set it aside.",
    pos: 'top',
  });
  G.tut.banked = () => {
    G.tut.banked = null;
    G.tutGlow = null;
    allow('bank', 'drop'); // free to try dropping it back in
    const what = G.bank.states.length === 1 ? `${G.bank.name} is` : 'Those states are';
    show({
      step: 4,
      title: 'Saved for later',
      text: `${what} in the bank. Tap the bank whenever you want to drop it back in. You can also bank the current piece. One bank per round.`,
      next: step5,
      pos: 'top',
    });
    updateHUD();
  };
  updateHUD();
}

function step5() {
  clearHooks();
  clearTimers();
  hideCard();
  resetRound();
  G.state = 'playing';
  // All 48 states in the box, in seven loose chunks
  buildPile([
    { ids: ['TX', 'OK', 'KS', 'NE', 'SD', 'ND'], x: 470, angle: Math.PI / 2 },
    { ids: ['WA', 'OR', 'CA', 'ID', 'NV'], x: 90, angle: -0.4 },
    { ids: ['GA', 'FL', 'SC', 'NC', 'VA', 'WV'], x: 290, angle: Math.PI },
    { ids: ['MI', 'IN', 'OH', 'KY', 'TN', 'MS', 'AL'], x: 560, angle: -Math.PI / 2 },
    { ids: ['MT', 'WY', 'UT', 'CO', 'AZ', 'NM'], x: 150, angle: 2.4 },
    { ids: ['PA', 'NY', 'NJ', 'MD', 'DE', 'VT', 'NH', 'MA', 'CT', 'RI', 'ME'], x: 400, angle: 0.9 },
    { ids: ['MN', 'IA', 'MO', 'AR', 'LA', 'WI', 'IL'], x: 260, angle: -2 },
  ]);
  allow('blend');
  spotlight('game', 'blendBtn');
  show({
    step: 5,
    title: 'Blend It!',
    text: "Every state is in, but the map isn't together yet. Tap Blend It! to put a lid on the box and spin everything around.",
    pos: 'top',
  });
  G.tut.blendStart = () => {
    allow();
    hideCard();
  };
  G.tut.blendDone = () => {
    spotlight('game', 'blendBtn');
    show({
      step: 5,
      title: 'Blend any time',
      text: 'Use Blend It! whenever the pieces need a shuffle. You get 3 blends per round.',
      next: finish,
      pos: 'top',
    });
  };
  updateHUD();
}

function finish() {
  clearHooks();
  clearTimers();
  G.state = 'tutorial';
  allow();
  spotlight();
  show({
    title: "You're ready!",
    text: 'Connect all 48 states to win. If the pile stays above the red line, the game is over.',
    next: play,
    nextLabel: "Let's Play!",
    pos: 'center',
    skip: false,
  });
  updateHUD();
}

/* ---------- start and stop ---------- */

export function startTutorial() {
  Sound.startMusic();
  T = { timers: [], pull: null, onNext: null, cardHidden: true };
  G.tut = {
    allow: new Set(),
    building: false,
    // Keep the card out of the way while the bank picker, bank dialog or a blend is on screen
    tick() {
      const hide = T.cardHidden || ['bankpick', 'banking', 'blending'].includes(G.state),
        card = $('tutCard');
      if (card.hidden !== hide) card.hidden = hide;
    },
  };
  clearHooks();
  document.body.classList.add('tutorial-on');
  $('tutDim').hidden = false;
  step1();
}
export function endTutorial() {
  if (MAP.tutorial) markDone(); // playing a level without the tutorial shouldn't use up the first-run offer
  if (!G.tut) return;
  clearTimers();
  T = null;
  G.tut = null;
  G.tutGlow = null;
  spotlight();
  $('tutCard').hidden = true;
  $('tutDim').hidden = true;
  document.body.classList.remove('tutorial-on');
}
function play() {
  endTutorial();
  newGame();
}

$('tutNext').addEventListener('click', () => {
  const f = T?.onNext;
  if (!f) return;
  T.onNext = null;
  f();
});
$('tutSkip').addEventListener('click', play);

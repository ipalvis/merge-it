import { Sound } from '../audio/sound.js';
import { CFG, STORAGE_KEYS } from '../config.js';
import { endBlend } from './blend.js';
import { DECK, GOAL_IDS } from '../map/geometry.js';
import { MAP } from '../levels/index.js';
import { setupWorld } from '../physics/world.js';
import { G } from '../state.js';
import { launchConfetti, stopConfetti } from '../ui/confetti.js';
import { $ } from '../ui/dom.js';
import { toast, updateHUD } from '../ui/hud.js';

let endless = false,
  roundStart = 0,
  winTimer; // endless: player chose to keep going after winning; roundStart: score when this round began

let doneSets = new Set();
try {
  G.best = +(localStorage.getItem(STORAGE_KEYS.best) || 0);
} catch (e) {}
export const dangerY = () => Math.min(CFG.dangerMax, CFG.dangerY + (G.round - 1) * CFG.dangerStepPerRound);
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function startRound() {
  setupWorld();
  G.blendsLeft = CFG.blendsPerRound;
  G.bank = null;
  G.bankPhase = 'ready';
  G.bankTarget = null;
  $('bankOverlay').hidden = true;
  G.aimAngle = 0;
  G.deck = shuffle([...DECK]);
  doneSets = new Set();
  G.dangerSince = null;
  G.current = G.deck.pop();
  G.lastDrop = 0;
  roundStart = G.score;
  G.state = 'playing';
  updateHUD();
}

export function newGame() {
  Sound.startMusic();
  clearTimeout(G.clearTimer);
  clearTimeout(winTimer);
  stopConfetti();
  $('winOverlay').hidden = true;
  endless = false;
  endBlend();
  G.score = 0;
  G.round = 1;
  startRound();
}
function addScore(n) {
  G.score += n;
  if (G.score > G.best) {
    G.best = G.score;
    try {
      localStorage.setItem(STORAGE_KEYS.best, G.best);
    } catch (e) {}
  }
}
export function onMerged(g) {
  if (G.tut) {
    // tutorial: no scoring, region toasts or round wins; it reacts to the merge itself
    if (!G.tut.building) Sound.fx.merge(g.ids.size);
    G.tut.merged?.(g);
    updateHUD();
    return;
  }
  Sound.fx.merge(g.ids.size);
  addScore(CFG.pts.mergePerState * g.ids.size * G.round);
  for (const [name, ids] of Object.entries(MAP.divisions))
    if (!doneSets.has(name) && ids.every(i => g.ids.has(i))) {
      doneSets.add(name);
      addScore(CFG.pts.division * G.round);
      toast(`You built ${name}`);
      Sound.fx.region();
    }
  for (const [name, ids] of Object.entries(MAP.regions))
    if (!doneSets.has(name) && ids.every(i => g.ids.has(i))) {
      doneSets.add(name);
      addScore(CFG.pts.region * G.round);
      toast(`You built ${name}`);
      Sound.fx.region();
    }
  if (GOAL_IDS.every(id => g.ids.has(id))) completeRound(g);
  updateHUD();
}
function completeRound(g) {
  endBlend();
  G.state = 'clearing';
  g.golden = true;
  addScore(CFG.pts.complete * G.round);
  if (endless) {
    toast(`${MAP.goal} is complete. Round ${G.round + 1} next`);
    G.clearTimer = setTimeout(() => {
      G.round++;
      startRound();
    }, 3200);
    return;
  }
  winTimer = setTimeout(showWin, 900); // let the gold glow land first
}
function showWin() {
  G.state = 'won';
  $('winRoundLbl').textContent = `Round ${G.round} score`;
  $('winRoundScore').textContent = (G.score - roundStart).toLocaleString();
  $('winTotal').textContent = G.round > 1 ? `Total score ${G.score.toLocaleString()}` : '';
  $('winOverlay').hidden = false;
  $('endlessBtn').focus();
  Sound.fx.win();
  launchConfetti();
  updateHUD();
}
export function goEndless() {
  $('winOverlay').hidden = true;
  stopConfetti();
  endless = true;
  Sound.setDuck(1, 0.3);
  G.round++;
  startRound();
  toast(`Endless mode. Round ${G.round}`);
}
export function gameOver(reason) {
  G.state = 'over';
  Sound.fx.lose();
  const big = Math.max(0, ...G.groups.map(g => g.ids.size));
  $('overTitle').textContent = reason === 'giveup' ? 'Run ended' : 'The box overflowed';
  $('overText').textContent =
    `Final score ${G.score.toLocaleString()} in round ${G.round}. Your biggest piece had ${big} of ${GOAL_IDS.length} ${MAP.units}.`;
  $('overOverlay').hidden = false;
  $('againBtn').focus();
  updateHUD();
}

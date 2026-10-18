import Matter from 'matter-js';
import { Sound } from '../audio/sound.js';
import { clampAim } from './aim.js';
import { STATES, makePiece } from '../map/geometry.js';
import { MAP } from '../levels/index.js';
import { ownerOf, removeGroup } from '../physics/world.js';
import { G, tutBlocks } from '../state.js';
import { $ } from '../ui/dom.js';
import { toast, updateHUD } from '../ui/hud.js';

const { Sleeping } = Matter;

/* g is a piece in the box (a group, with .ids) or the piece waiting to drop (G.current, with .states) */
const idsOf = g => (g === G.current ? g.states : [...g.ids]);
export function askBank(g) {
  if (G.state !== 'playing' && G.state !== 'bankpick') return;
  if (G.bankPhase !== 'ready') {
    toast(G.bankPhase === 'holding' ? 'The bank already has a piece' : 'Bank already used this round');
    return;
  }
  G.bankTarget = g;
  G.state = 'banking';
  const ids = idsOf(g),
    waiting = g === G.current;
  $('bankText').textContent =
    ids.length === 1
      ? `${STATES[ids[0]].name} moves to the bank${waiting ? ' instead of dropping' : ''}. Tap the bank whenever you want to drop it back in.`
      : waiting
        ? `${g.name} move to the bank instead of dropping. Tap the bank whenever you want to drop them back in.`
        : `These ${ids.length} connected ${MAP.units} move to the bank together. Tap the bank whenever you want to drop them back in.`;
  $('bankOverlay').hidden = false;
  $('bankYes').focus();
  updateHUD();
}
export function closeBank(yes) {
  $('bankOverlay').hidden = true;
  if (G.state !== 'banking') return;
  const g = G.bankTarget;
  G.bankTarget = null;
  G.state = 'playing';
  G.last = performance.now();
  if (yes && g && g === G.current) {
    // the waiting piece goes straight to the bank; the next one in the deck takes its place
    G.bank = g;
    G.current = G.deck.pop() || null;
    G.aimAngle = 0;
    clampAim();
    G.bankPhase = 'holding';
    Sound.fx.bank();
    if (!G.tut) toast(`${g.name} banked`);
    G.tut?.banked?.();
  } else if (yes && g && G.groups.includes(g)) {
    removeGroup(g);
    for (const id of g.ids) delete ownerOf[id];
    for (const o of G.groups) if (o.isSleeping) Sleeping.set(o, false); // anything resting on it should fall
    const ids = [...g.ids];
    G.bank = makePiece(ids, ids.length === 1 ? STATES[ids[0]].name : `${ids.length} connected ${MAP.units}`);
    G.bankPhase = 'holding';
    Sound.fx.bank();
    if (!G.tut) toast(ids.length === 1 ? `${G.bank.name} banked` : `${ids.length} ${MAP.units} banked`);
    G.tut?.banked?.();
  }
  updateHUD();
}
function useBank() {
  if (G.state !== 'playing' || G.bankPhase !== 'holding') return;
  if (G.current) G.deck.push(G.current); // the waiting piece goes back to the front of the queue
  Sound.fx.unbank();
  G.current = G.bank;
  G.bank = null;
  G.bankPhase = 'spent';
  G.aimAngle = 0;
  clampAim();
  updateHUD();
}
$('bankYes').addEventListener('click', () => closeBank(true));
$('bankNo').addEventListener('click', () => closeBank(false));
/* Tapping the bank: drop a held piece, or start picking a piece to bank (the game pauses while you pick) */
function onBankClick() {
  if (tutBlocks('bank')) return;
  if (G.state === 'bankpick') {
    endBankPick();
    return;
  }
  if (G.bankPhase === 'holding') {
    useBank();
    return;
  }
  if (G.bankPhase === 'ready' && G.state === 'playing') {
    if (!G.groups.length && !G.current) {
      toast('Nothing to bank yet');
      return;
    }
    G.state = 'bankpick';
    G.press = null;
    updateHUD();
  }
}
export function endBankPick() {
  if (G.state === 'bankpick') {
    G.state = 'playing';
    G.last = performance.now();
    updateHUD();
  }
}
$('bankBtn').addEventListener('click', onBankClick);

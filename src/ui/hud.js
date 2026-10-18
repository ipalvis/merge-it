import { CFG } from '../config.js';
import { GOAL_IDS, IDS, MAP_W, STATES } from '../map/geometry.js';
import { drawCrossings, drawState } from '../render/render.js';
import { G } from '../state.js';
import { PREVIEW_PAD } from './canvas.js';
import { $ } from './dom.js';
import { theme } from './theme.js';

let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
}
export function updateHUD() {
  const big = Math.max(0, ...G.groups.map(g => g.ids.size));
  $('score').textContent = G.score.toLocaleString();
  $('best').textContent = G.best.toLocaleString();
  $('round').textContent = G.round;
  $('biggest').textContent = `${big}/${GOAL_IDS.length}`;
  $('bar').style.width = (big / GOAL_IDS.length) * 100 + '%';
  const nxt = G.deck[G.deck.length - 1];
  const before = G.tut || G.state === 'title', // nothing dealt yet
    allDropped = !before && !nxt && !G.current;
  $('nextName').textContent = before ? '—' : nxt ? nxt.name : G.current ? 'Last one' : 'All pieces dropped!';
  $('nextName').classList.toggle('wrap', allDropped); // a message, not a name: wrap it rather than cut it off
  $('shakeBtn').disabled = G.state !== 'playing' || performance.now() - G.lastShake < CFG.shakeCooldown;
  $('blendBtn').disabled = G.state !== 'playing' || G.blendsLeft <= 0;
  $('blendBtn').textContent = G.blendsLeft > 0 ? `Blend It! (${G.blendsLeft})` : 'Blended (0)';
  $('giveUpBtn').disabled = !['playing', 'blending', 'clearing'].includes(G.state);
  drawThumb($('nextCanvas'), nxt);
  const bb = $('bankBtn');
  bb.classList.toggle('full', G.bankPhase === 'holding');
  bb.classList.toggle('empty', G.bankPhase !== 'holding');
  bb.disabled = !(
    (G.bankPhase === 'holding' && G.state === 'playing') ||
    (G.bankPhase === 'ready' && (G.state === 'playing' || G.state === 'bankpick'))
  );
  bb.classList.toggle(
    'pulse',
    G.state === 'playing' && (G.bankPhase === 'holding' || (G.bankPhase === 'ready' && G.groups.length > 0)),
  );
  $('bankLabel').textContent =
    G.bankPhase === 'holding'
      ? 'Tap to drop'
      : G.bankPhase === 'spent'
        ? 'Used'
        : G.state === 'bankpick'
          ? 'Cancel'
          : 'Bank';
  bb.title =
    G.bankPhase === 'holding'
      ? `Drop ${G.bank.name} next`
      : G.bankPhase === 'spent'
        ? 'Bank already used this round'
        : 'Tap, then tap a piece in the box or the current piece to bank it (once per round)';
  drawThumb($('bankCanvas'), G.bank);
  if (!$('mapPreview').hidden) drawMapPreview();
}
/* The finished map, with the current piece (the one about to drop) in gold so players can see where it belongs */
function drawMapPreview() {
  const c = $('previewCanvas'),
    x = c.getContext('2d'),
    dpr = window.devicePixelRatio || 1,
    cssW = c.clientWidth,
    k = (cssW - 2 * PREVIEW_PAD) / MAP_W;
  c.width = Math.round(cssW * dpr);
  c.height = Math.round(c.clientHeight * dpr);
  x.setTransform(dpr * k, 0, 0, dpr * k, dpr * PREVIEW_PAD, dpr * PREVIEW_PAD);
  const current = new Set(G.current?.states);
  for (const id of IDS) {
    const st = STATES[id];
    drawState(x, st, current.has(id) ? theme.gold : theme['c' + st.color], 1 / k, false);
  }
  for (const id of IDS) drawState(x, STATES[id], 'transparent', 0, true);
  drawCrossings(x, new Set(IDS));
}
function drawThumb(c, st) {
  const x = c.getContext('2d');
  x.clearRect(0, 0, c.width, c.height);
  if (!st) return;
  const w = st.bb.maxX - st.bb.minX,
    h = st.bb.maxY - st.bb.minY;
  const k = Math.min((c.width - 20) / w, (c.height - 20) / h);
  x.save();
  x.translate(c.width / 2, c.height / 2);
  x.scale(k, k);
  x.translate(-(st.bb.minX + st.bb.maxX) / 2, -(st.bb.minY + st.bb.maxY) / 2);
  for (const sid of st.states) drawState(x, STATES[sid], theme['c' + STATES[sid].color], 1.5 / k, false);
  x.restore();
}

import { BOX, CFG, VH, VW } from '../config.js';
import { canDrop, hoverY } from '../game/aim.js';
import { dangerY } from '../game/game.js';
import { STATES } from '../map/geometry.js';
import { LABEL_FONT } from '../map/labels.js';
import { G } from '../state.js';
import { canvas, ctx } from '../ui/canvas.js';
import { theme } from '../ui/theme.js';

function path(c, pts) {
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.closePath();
}
export function drawState(c, st, fill, lw, label) {
  for (const p of st.parts) {
    path(c, p.outline);
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = lw;
    c.strokeStyle = theme.stroke;
    c.lineJoin = 'round';
    c.stroke();
  }
  // the code, sized and placed to sit wholly inside the shape (none if it would be too small to read)
  const L = st.label;
  if (!label || L.size < CFG.labelMin) return;
  c.fillStyle = theme.stroke;
  c.font = `800 ${L.size}px ${LABEL_FONT}`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  if (!L.angle) return c.fillText(st.id, L.x + L.ox * L.size, L.y + L.oy * L.size);
  // turned along a long, thin shape (it turns with the piece too, since pieces are drawn in their own frame)
  c.save();
  c.translate(L.x, L.y);
  c.rotate(L.angle);
  c.fillText(st.id, L.ox * L.size, L.oy * L.size);
  c.restore();
}
/* Sea crossings for the states in ids (one piece, drawn in map space), drawn as a little bridge: a light band with a
   dark outline. While the partner isn't joined, half a bridge sticks out from the coast toward it; once it is, the
   bridge spans the water and rests a little way onto both coasts. */
export function drawCrossings(c, ids) {
  const bridge = (x0, y0, x1, y1) => {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.lineWidth = CFG.crossingWidth + 2;
    c.strokeStyle = theme.stroke;
    c.stroke();
    c.lineWidth = CFG.crossingWidth;
    c.strokeStyle = theme.page;
    c.stroke();
  };
  c.save();
  c.lineCap = 'round';
  for (const id of ids)
    for (const x of STATES[id].crossings) {
      const dx = x.at.x - x.from.x,
        dy = x.at.y - x.from.y,
        d = Math.hypot(dx, dy) || 1,
        ux = dx / d,
        uy = dy / d;
      if (!ids.has(x.to))
        bridge(
          x.from.x - ux * 2,
          x.from.y - uy * 2,
          x.from.x + ux * CFG.crossingStub,
          x.from.y + uy * CFG.crossingStub,
        );
      else if (id < x.to) {
        const e = CFG.crossingStub / 2.5; // each joined crossing once
        bridge(x.from.x - ux * e, x.from.y - uy * e, x.at.x + ux * e, x.at.y + uy * e);
      }
    }
  c.restore();
}
function drawGroup(g, now) {
  ctx.save();
  ctx.translate(g.position.x, g.position.y);
  ctx.rotate(g.angle);
  ctx.translate(-g.m0.x, -g.m0.y);
  const f = G.flashes.find(f => f.g === g);
  const glow = f ? Math.max(0, 1 - (now - f.t) / 450) : 0;
  const pick = g === G.bankTarget || g === G.tutGlow;
  if (g.golden || glow || pick) {
    ctx.shadowColor = theme.gold;
    ctx.shadowBlur = g.golden || pick ? 22 : 18 * glow;
  }
  for (const id of g.ids) {
    const st = STATES[id];
    drawState(ctx, st, g.golden ? theme.gold : theme['c' + st.color], 1.1, false);
  }
  ctx.shadowBlur = 0;
  for (const id of g.ids) {
    const st = STATES[id];
    drawState(ctx, st, 'transparent', 0, true);
  }
  drawCrossings(ctx, g.ids);
  ctx.restore();
}
export function render(now) {
  const k = canvas.__k || 1;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  // water inside the box, with a faint graticule
  ctx.fillStyle = theme.box;
  ctx.fillRect(BOX.l, 0, CFG.boxW, BOX.b);
  ctx.strokeStyle = theme['box-line'];
  ctx.lineWidth = 1;
  for (let x = BOX.l + 50; x < BOX.r; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BOX.b);
    ctx.stroke();
  }
  for (let y = BOX.b - 50; y > 0; y -= 50) {
    ctx.beginPath();
    ctx.moveTo(BOX.l, y);
    ctx.lineTo(BOX.r, y);
    ctx.stroke();
  }
  drawDangerLine(now);
  // pieces
  for (const g of G.groups) drawGroup(g, now);
  // aiming preview, circled by rotation arrows that turn with it.
  // While picking a piece to bank, the waiting piece stays on show (glowing: it can be banked too).
  const picking = G.state === 'bankpick' || G.state === 'banking';
  if (G.current && (G.state === 'playing' || picking)) {
    const pc = G.current,
      cy = hoverY(pc),
      ready = canDrop();
    if (!picking) {
      const spinning = G.press && performance.now() - G.press.t0 > CFG.rotateDelay;
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = theme['box-guide'];
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(G.aimX, cy + pc.R + CFG.ringGap);
      ctx.lineTo(G.aimX, BOX.b);
      ctx.stroke();
      ctx.setLineDash([]);
      drawSpinRing(G.aimX, cy, pc.R + CFG.ringGap, G.aimAngle, spinning);
    }
    ctx.globalAlpha = picking || ready ? 0.95 : 0.35;
    ctx.save();
    ctx.translate(G.aimX, cy);
    ctx.rotate(G.aimAngle);
    ctx.translate(-pc.c.x, -pc.c.y);
    const glow = G.state === 'bankpick' ? 12 + 8 * Math.sin(now / 160) : G.bankTarget === pc ? 22 : 0;
    if (glow) {
      ctx.shadowColor = theme.gold;
      ctx.shadowBlur = glow;
    }
    for (const sid of pc.states) drawState(ctx, STATES[sid], theme['c' + STATES[sid].color], 1.1, false);
    ctx.shadowBlur = 0;
    for (const sid of pc.states) drawState(ctx, STATES[sid], 'transparent', 0, true);
    drawCrossings(ctx, new Set(pc.states));
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // the box itself: walls and floor
  ctx.strokeStyle = theme.frame;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(BOX.l - 3, 6);
  ctx.lineTo(BOX.l - 3, BOX.b + 3);
  ctx.lineTo(BOX.r + 3, BOX.b + 3);
  ctx.lineTo(BOX.r + 3, 6);
  ctx.stroke();
  if (G.blend) {
    ctx.beginPath();
    ctx.moveTo(BOX.l - 3, 3);
    ctx.lineTo(BOX.r + 3, 3);
    ctx.stroke();
  } // the lid
  if (G.state === 'bankpick') {
    // picking a piece to bank: the game is paused
    const fs = Math.max(15, 13 / (canvas.__css || 1)),
      msg = 'Tap any piece to bank it',
      top = G.current ? hoverY(G.current) + G.current.R + CFG.ringGap + 10 : 30; // below the waiting piece
    ctx.save();
    ctx.font = `800 ${fs}px "Public Sans", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(msg).width + fs * 1.8,
      h = fs * 2.2;
    ctx.fillStyle = theme.page;
    ctx.globalAlpha = 0.94;
    ctx.beginPath();
    ctx.roundRect(VW / 2 - w / 2, top, w, h, h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = theme.ink;
    ctx.fillText(msg, VW / 2, top + h / 2);
    ctx.restore();
  }
  G.flashes = G.flashes.filter(f => now - f.t < 450);
}
/* The red line. Calm normally; once the pile has sat above it, it blinks hard, faster and faster
   (about 3 to 10 blinks a second) until the box overflows. */
function drawDangerLine(now) {
  const dy = dangerY(),
    since = G.dangerSince;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = theme['box-danger'];
  if (since === null) {
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
  } else {
    const t = Math.max(0, now - since) / 1000,
      L = CFG.overflowLimit / 1000,
      phase = 3 * t + (3.5 * t * t) / L, // integral of a blink rate rising from 3/s to 10/s
      on = phase % 1 < 0.55;
    ctx.lineWidth = on ? 5 : 2;
    ctx.globalAlpha = on ? 1 : 0.2;
    if (on) {
      ctx.shadowColor = theme['box-danger'];
      ctx.shadowBlur = 14;
    }
  }
  ctx.beginPath();
  ctx.moveTo(BOX.l, dy);
  ctx.lineTo(BOX.r, dy);
  ctx.stroke();
  ctx.restore();
}
/* Two large clockwise arrows on a circle around the waiting piece; they turn with it. */
function drawSpinRing(x, y, R, ang, active) {
  const s = Math.max(1, 0.8 / (canvas.__css || 1)); // keep lines and heads visible when the box is drawn small
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.strokeStyle = ctx.fillStyle = active ? theme.gold : theme.frame;
  ctx.globalAlpha = active ? 0.95 : 0.45;
  ctx.lineWidth = 1.6 * s;
  ctx.lineCap = 'round';
  for (const base of [0, Math.PI]) {
    const a0 = base - Math.PI * 0.8,
      a1 = base - Math.PI * 0.12; // each arrow covers a bit over a third of the circle
    ctx.beginPath();
    ctx.arc(0, 0, R, a0, a1);
    ctx.stroke();
    const ex = R * Math.cos(a1),
      ey = R * Math.sin(a1),
      tx = -Math.sin(a1),
      ty = Math.cos(a1),
      nx = Math.cos(a1),
      ny = Math.sin(a1),
      h = 7 * s;
    ctx.beginPath();
    ctx.moveTo(ex + tx * h, ey + ty * h);
    ctx.lineTo(ex + nx * h * 0.6, ey + ny * h * 0.6);
    ctx.lineTo(ex - nx * h * 0.6, ey - ny * h * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

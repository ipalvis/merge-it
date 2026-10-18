/*
 * Labels: each code goes where its text box can be largest while staying entirely inside the region's main shape,
 * and is sized to fit (up to CFG.labelMax). So small regions get a small code instead of none, and odd shapes
 * (Norway, Croatia, Florida) get theirs in the widest spot, not the centroid.
 * Sets st.label = { x, y, size, ox, oy }: draw at (x + ox * size, y + oy * size), centered, alphabetic baseline.
 */
import { CFG } from '../config.js';

export const LABEL_FONT = '"Public Sans", system-ui, sans-serif';
const PAD = 0.9; // map px kept clear between the text and the border (the outline stroke is about 1.1 wide)

function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function edgeDist(poly, x, y) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j],
      b = poly[i],
      dx = b.x - a.x,
      dy = b.y - a.y,
      t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(a.x + t * dx - x, a.y + t * dy - y));
  }
  return best;
}
/* Does segment a-b touch the rectangle [x0,x1] x [y0,y1]? (Liang-Barsky clipping) */
function hitsRect(a, b, x0, y0, x1, y1) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  let t0 = 0,
    t1 = 1;
  for (const [p, q] of [
    [-dx, a.x - x0],
    [dx, x1 - a.x],
    [-dy, a.y - y0],
    [dy, y1 - a.y],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        t0 = Math.max(t0, r);
      } else {
        if (r < t0) return false;
        t1 = Math.min(t1, r);
      }
    }
  }
  return true;
}
/* A rectangle centred inside the shape that no border crosses lies wholly inside it */
function rectFits(poly, x, y, hw, hh) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++)
    if (hitsRect(poly[j], poly[i], x - hw, y - hh, x + hw, y + hh)) return false;
  return true;
}
/* Largest font size whose text box (tw x th per px of font) fits around some point of poly */
function fit(poly, tw, th) {
  const xs = poly.map(p => p.x),
    ys = poly.map(p => p.y),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    y0 = Math.min(...ys),
    y1 = Math.max(...ys),
    step = Math.max(0.4, Math.min(x1 - x0, y1 - y0) / 30);
  // Candidates: grid points well inside the shape (deep points are where a box fits best)
  let cands = [];
  for (let y = y0 + step / 2; y < y1; y += step)
    for (let x = x0 + step / 2; x < x1; x += step)
      if (inside(poly, x, y)) cands.push({ x, y, d: edgeDist(poly, x, y) });
  const deepest = Math.max(0, ...cands.map(c => c.d));
  cands = cands
    .filter(c => c.d >= deepest * 0.5)
    .sort((a, b) => b.d - a.d)
    .slice(0, 200);
  const ok = (c, f) => rectFits(poly, c.x, c.y, (f * tw) / 2 + PAD, (f * th) / 2 + PAD);
  let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, size: 0 };
  for (const c of cands) {
    if (!ok(c, best.size)) continue; // can't beat the best so far
    let lo = best.size,
      hi = CFG.labelMax;
    if (ok(c, hi)) lo = hi;
    else for (let k = 0; k < 10; k++) ok(c, (lo + hi) / 2) ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2);
    if (lo > best.size) best = { x: c.x, y: c.y, size: lo };
    if (best.size >= CFG.labelMax) break;
  }
  return best;
}
export function fitLabels(states) {
  const m = document.createElement('canvas').getContext('2d');
  m.font = `800 100px ${LABEL_FONT}`;
  m.textAlign = 'center';
  m.textBaseline = 'alphabetic';
  for (const st of states) {
    const t = m.measureText(st.id),
      L = t.actualBoundingBoxLeft / 100,
      R = t.actualBoundingBoxRight / 100,
      A = t.actualBoundingBoxAscent / 100,
      D = t.actualBoundingBoxDescent / 100;
    const f = fit(st.mainOutline, L + R, A + D);
    // offsets that put the ink (not the em box) centred on the fitted point
    st.label = { x: f.x, y: f.y, size: f.size, ox: (L - R) / 2, oy: (A - D) / 2 };
  }
}

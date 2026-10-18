import Matter from 'matter-js';
import { Sound } from '../audio/sound.js';
import { CFG, VH, VW } from '../config.js';
import { G, tutBlocks } from '../state.js';
import { canvas } from '../ui/canvas.js';
import { updateHUD } from '../ui/hud.js';

const { Bodies, Composite, Sleeping } = Matter;

/* The box gets a lid and spins. Physically the walls stay put and gravity rotates the opposite way,
   which is the same thing from inside the box and avoids pieces tunneling through moving walls. */
export function blendIt() {
  if (G.state !== 'playing' || G.blendsLeft <= 0 || tutBlocks('blend')) return;
  G.blendsLeft--;
  G.state = 'blending';
  Sound.fx.blend(CFG.blendDuration);
  const T = 400,
    lid = Bodies.rectangle(VW / 2, 6 - T / 2, VW + 2 * T, T, { isStatic: true, friction: 0.6 });
  Composite.add(G.world, lid);
  G.walls.push(lid);
  G.engine.enableSleeping = false; // sleeping pieces would ignore the turning gravity
  for (const g of G.groups) Sleeping.set(g, false);
  G.blend = { t0: performance.now(), lid };
  G.tut?.blendStart?.();
  updateHUD();
}
export function updateBlend(now) {
  const p = Math.min(1, (now - G.blend.t0) / CFG.blendDuration);
  const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; // ease in and out
  const th = e * CFG.blendTurns * 2 * Math.PI; // box angle, clockwise
  G.engine.gravity.x = CFG.gravity * Math.sin(th);
  G.engine.gravity.y = CFG.gravity * Math.cos(th);
  const shrink = Math.min(1, p / 0.12, (1 - p) / 0.12); // shrink in, spin, grow back
  // A narrow box shrinks further, so it never spins wider than its own footprint (the standard box: about 0.68 anyway)
  const small = Math.min(CFG.blendScale, Math.min(VW, VH) / Math.hypot(VW, VH));
  canvas.style.transform = `rotate(${th}rad) scale(${1 - (1 - small) * shrink})`;
  if (p >= 1) {
    endBlend();
    G.state = 'playing';
    G.dangerSince = null;
    for (const g of G.groups) g.born = now; // fresh grace period before the red line counts
    G.tut?.blendDone?.();
    updateHUD();
  }
}
export function endBlend() {
  if (!G.blend) return;
  Composite.remove(G.world, G.blend.lid);
  G.walls = G.walls.filter(w => w !== G.blend.lid);
  G.engine.gravity.x = 0;
  G.engine.gravity.y = CFG.gravity;
  G.engine.enableSleeping = true;
  canvas.style.transform = '';
  G.blend = null;
}

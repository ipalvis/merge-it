import Matter from 'matter-js';
import { CFG } from '../config.js';
import { clampAim } from './aim.js';
import { updateBlend } from './blend.js';
import { dangerY, gameOver } from './game.js';
import { processMerges } from '../physics/world.js';
import { render } from '../render/render.js';
import { Sound } from '../audio/sound.js';
import { G } from '../state.js';

const { Body, Engine, Sleeping } = Matter;

let acc = 0,
  chimedFor = null; // the danger episode (its start time) that already got its warning chime
const STEP = 1000 / 60;
function checkOverflow(now) {
  const dy = dangerY();
  const over = G.groups.some(g => now - g.born > CFG.overflowGrace && g.bounds.min.y < dy && Body.getSpeed(g) < 1.2);
  if (!over) {
    G.dangerSince = null;
    return;
  }
  if (G.dangerSince === null) G.dangerSince = now;
  const left = CFG.overflowLimit - (now - G.dangerSince);
  if (left < 1000 && chimedFor !== G.dangerSince) {
    chimedFor = G.dangerSince;
    Sound.fx.warn(); // one second to go
  }
  if (left < 0) gameOver();
}
function settle(now) {
  for (const g of G.groups) {
    if (g.isSleeping) {
      g.stillSince = null;
      continue;
    }
    if (
      now - g.born > 1000 &&
      Body.getSpeed(g) < CFG.settleSpeed &&
      Math.abs(Body.getAngularVelocity(g)) < CFG.settleSpin
    ) {
      if (g.stillSince == null) g.stillSince = now;
      else if (now - g.stillSince > CFG.settleTime) {
        Sleeping.set(g, true);
        g.stillSince = null;
      }
    } else g.stillSince = null;
  }
}
/* One frame of game logic, without drawing. The difficulty simulator (scripts/rate-levels.mjs) calls this directly
   on a simulated clock. */
export function step(now) {
  if (G.press && G.state === 'playing' && G.current && now - G.press.t0 > CFG.rotateDelay) {
    G.aimAngle += (CFG.rotateSpeed * Math.min(100, now - G.last)) / 1000;
    clampAim();
  }
  if (G.blend) updateBlend(now);
  if (G.engine && (G.state === 'playing' || G.state === 'clearing' || G.state === 'blending')) {
    acc += Math.min(100, now - G.last);
    while (acc >= STEP) {
      for (let i = 0; i < CFG.substeps; i++) {
        Engine.update(G.engine, STEP / CFG.substeps);
        processMerges();
      }
      acc -= STEP;
    }
    if (G.state === 'playing' && !G.tut) checkOverflow(now);
    if (G.state !== 'blending') settle(now);
  }
  G.tut?.tick?.(now);
  G.last = now;
}
export function frame(now) {
  step(now);
  render(now);
  requestAnimationFrame(frame);
}

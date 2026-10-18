/*
 * Entry point: loads every module, wires the control buttons, and starts the game loop.
 * Modules that only register event listeners are imported for their side effects.
 */
import './ui/theme.js';
import './ui/canvas.js';
import './audio/sound.js';
import './input/input.js';
import './game/bank.js';
import './game/preview.js';
import { TEST_IDS } from './config.js';
import { LEVELS, LEVEL_KEY, MAP } from './levels/index.js';
import { blendIt } from './game/blend.js';
import { goEndless, newGame } from './game/game.js';
import { giveUp } from './game/giveUp.js';
import { frame } from './game/loop.js';
import { shake } from './game/shake.js';
import { endTutorial, startTutorial, tutorialDone } from './game/tutorial.js';
import { setupWorld } from './physics/world.js';
import { canvas, fitCanvas } from './ui/canvas.js';
import { $ } from './ui/dom.js';
import { updateHUD } from './ui/hud.js';

$('shakeBtn').addEventListener('click', shake);
$('resetBtn').addEventListener('click', () => {
  endTutorial();
  $('startOverlay').hidden = true;
  $('overOverlay').hidden = true;
  newGame();
});
$('blendBtn').addEventListener('click', blendIt);
$('giveUpBtn').addEventListener('click', giveUp);
/* Title card. New players get "Start Tutorial" (big) or "Skip"; returning players get "Play" (big) or "Tutorial". */
{
  const firstTime = MAP.tutorial && !tutorialDone();
  const play = () => {
    $('startOverlay').hidden = true;
    endTutorial(); // also remembers that the tutorial was offered
    newGame();
    canvas.focus?.();
  };
  const tutorial = () => {
    $('startOverlay').hidden = true;
    startTutorial();
  };
  $('titleTagline').textContent = MAP.tagline; // always shown: it says which map this is
  $('titleSecondary').hidden = !MAP.tutorial;
  $('titlePrimary').textContent = firstTime ? 'Start Tutorial' : 'Play';
  $('titleSecondary').textContent = firstTime ? 'Skip' : 'Tutorial';
  $('titlePrimary').addEventListener('click', firstTime ? tutorial : play);
  $('titleSecondary').addEventListener('click', firstTime ? play : tutorial);
}
$('againBtn').addEventListener('click', () => {
  $('overOverlay').hidden = true;
  newGame();
});
$('restartBtn').addEventListener('click', () => {
  newGame();
});
$('endlessBtn').addEventListener('click', goEndless);
document.title += ` ${MAP.name}`;
/* Map switch: one button per level; choosing another reloads the page on that map (keeping test mode, if on) */
for (const L of Object.values(LEVELS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = L.name;
  b.setAttribute('aria-pressed', L.key === MAP.key);
  b.addEventListener('click', () => {
    if (L.key === MAP.key) return;
    try {
      localStorage.setItem(LEVEL_KEY, L.key);
    } catch (e) {}
    const url = new URL(location.href);
    url.searchParams.set('map', L.key);
    location.assign(url);
  });
  $('levelSwitch').appendChild(b);
}
if (TEST_IDS) document.title += ` (Test: ${TEST_IDS.length} ${MAP.units})`;

fitCanvas();
setupWorld();
updateHUD();
requestAnimationFrame(frame);
// The first layout can run before Public Sans loads; once it has, the header's real height is known, so size the box
// again (on each load: with a late stylesheet the font starts loading only then)
document.fonts?.addEventListener('loadingdone', () => {
  fitCanvas();
  updateHUD();
});

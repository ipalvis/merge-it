/* Finished-map preview: the ? button shows or hides a small panel with the finished map
   and the current piece in gold (drawn by updateHUD). It sits beside the box, or below the controls on narrow
   screens. Shown by default; the player's choice is remembered. Showing and hiding pop like a bubble. */
import { STORAGE_KEYS } from '../config.js';
import { fitCanvas } from '../ui/canvas.js';
import { $ } from '../ui/dom.js';
import { updateHUD } from '../ui/hud.js';

// prettier-ignore
const POP_IN = [
  { transform: 'scale(0.2)', opacity: 0 },
  { transform: 'scale(1.06)', opacity: 1, offset: 0.6 },
  { transform: 'scale(0.98)', offset: 0.82 },
  { transform: 'scale(1)', opacity: 1 },
], POP_OUT = [
  { transform: 'scale(1)', opacity: 1 },
  { transform: 'scale(1.05)', opacity: 1, offset: 0.3 },
  { transform: 'scale(0.2)', opacity: 0 },
], BUTTON_SQUISH = [{ transform: 'scale(1)' }, { transform: 'scale(0.86)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }];

let shown = true,
  anim = null; // the pop in progress, if any
try {
  shown = localStorage.getItem(STORAGE_KEYS.mapPreview) !== '0';
} catch (e) {}
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function apply(animate) {
  const mp = $('mapPreview');
  anim?.cancel();
  anim = null;
  $('previewBtn').setAttribute('aria-pressed', shown);
  $('previewBtn').setAttribute('aria-label', shown ? 'Hide the finished map' : 'Show the finished map');
  if (animate && !calm()) $('previewBtn').animate(BUTTON_SQUISH, { duration: 260, easing: 'ease-out' });
  if (shown) {
    mp.hidden = false;
    fitCanvas(); // below the controls, the panel takes room from the box
    updateHUD();
    if (animate && !calm()) anim = mp.animate(POP_IN, { duration: 380, easing: 'ease-out' });
  } else if (animate && !calm()) {
    // shrink away first, then give the room back
    anim = mp.animate(POP_OUT, { duration: 240, easing: 'ease-in', fill: 'forwards' });
    anim.onfinish = () => {
      mp.hidden = true; // hide before dropping the shrunk end state, or it flashes back for a frame
      anim.cancel();
      anim = null;
      fitCanvas();
    };
  } else {
    mp.hidden = true;
    fitCanvas();
  }
}
$('previewBtn').addEventListener('click', () => {
  shown = !shown;
  try {
    localStorage.setItem(STORAGE_KEYS.mapPreview, shown ? '1' : '0');
  } catch (e) {}
  apply(true);
});
addEventListener('resize', updateHUD); // the panel's canvas is resized by fitCanvas; redraw it
apply(false);

import { fitCanvas } from './canvas.js';
import { $ } from './dom.js';
import { updateHUD } from './hud.js';

export const theme = {};
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of [
    'box',
    'box-line',
    'box-danger',
    'box-guide',
    'ocean',
    'ocean-line',
    'frame',
    'stroke',
    'danger',
    'gold',
    'ink',
    'page',
    'c0',
    'c1',
    'c2',
    'c3',
    'c4',
    'c5',
    'c6',
    'bridge',
    'bridge-line',
  ])
    theme[k] = cs.getPropertyValue('--' + k).trim();
}
function applyTheme(t, save) {
  document.documentElement.dataset.theme = t;
  $('themeToggle').setAttribute('aria-checked', t === 'dark');
  readTheme();
  if (save) updateHUD();
}
{
  const t = 'light';
  document.documentElement.dataset.theme = t;
  document.getElementById('themeToggle').setAttribute('aria-checked', t === 'dark');
}
readTheme();
// Safari sometimes runs this before the stylesheet applies: the colors read empty and every canvas draws black.
// Until they're there, look again each frame; then redraw and re-measure the layout.
if (!theme.box)
  requestAnimationFrame(function whenStyled() {
    if (!getComputedStyle(document.documentElement).getPropertyValue('--box').trim())
      return requestAnimationFrame(whenStyled);
    readTheme();
    fitCanvas();
    updateHUD();
  });
document
  .getElementById('themeToggle')
  .addEventListener('click', () =>
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true),
  );

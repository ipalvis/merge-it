import { VH, VW, VW_STD } from '../config.js';
import { MAP_H, MAP_W } from '../map/geometry.js';

export const PREVIEW_PAD = 8; // css px around the map in the preview panel
const PREVIEW_MIN_H = 120,
  PREVIEW_MAX_H = 200; // preview map height (css px) when it sits below the controls

export const canvas = document.getElementById('game'),
  ctx = canvas.getContext('2d');
export function fitCanvas() {
  const main = document.querySelector('main'),
    stage = document.getElementById('stage'),
    rb = document.getElementById('resetBtn'),
    pb = document.getElementById('previewBtn'),
    mp = document.getElementById('mapPreview'),
    pc = document.getElementById('previewCanvas'),
    bk = document.getElementById('bankBtn'),
    wrap = document.getElementById('boxWrap'),
    cs = getComputedStyle(main),
    gap = parseFloat(cs.rowGap) || 0,
    availW = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // Height left for the box once everything else in the column (except the map preview) has its share
  const availH = () => {
    let used = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    for (const el of main.children) if (el !== stage && el !== mp) used += el.getBoundingClientRect().height + gap;
    return Math.max(240, main.clientHeight - used);
  };
  // The box is drawn at the scale a standard-width box would get (so a narrow box is just narrower), centred
  const scaleFor = h => Math.min(availW / VW_STD, h / VH);
  // Room beside the box decides where things go: reset (and the preview toggle below it) and the bank sit beside it
  // when there's room, otherwise in the top bar and the header; the map preview (up to 240px wide) sits beside it
  // or below the controls
  const margin = (window.innerWidth - VW * scaleFor(availH())) / 2;
  if (margin >= 90) {
    if (rb.parentElement !== wrap) wrap.append(rb, pb);
    rb.classList.add('beside');
    pb.classList.add('beside');
  } else {
    const bar = document.querySelector('.topbar');
    if (rb.parentElement !== bar) document.getElementById('levelSwitch').after(rb, pb); // the map switch stays first
    rb.classList.remove('beside');
    pb.classList.remove('beside');
  }
  if (margin >= 126) {
    if (bk.parentElement !== wrap) wrap.appendChild(bk);
    bk.classList.add('beside');
  } else {
    const nx = document.querySelector('.next');
    if (bk.nextElementSibling !== nx) nx.before(bk);
    bk.classList.remove('beside');
  }
  const room = Math.min(240, margin - 26),
    panelBeside = room >= 150;
  if (panelBeside) {
    if (mp.parentElement !== wrap) wrap.appendChild(mp);
    mp.classList.add('beside');
    pc.style.width = room + 'px';
    pc.style.height = Math.round(((room - 2 * PREVIEW_PAD) * MAP_H) / MAP_W + 2 * PREVIEW_PAD) + 'px';
  } else if (mp.parentElement !== main) {
    main.appendChild(mp);
    mp.classList.remove('beside');
  }
  let h = availH(); // again: moving the bank or reset can change the header's height
  if (!panelBeside && !mp.hidden) {
    // below the controls, the preview only takes the height a full-size box leaves free (but at least PREVIEW_MIN_H)
    let ph = Math.round(Math.min(PREVIEW_MAX_H, Math.max(PREVIEW_MIN_H, h - scaleFor(h) * VH - gap)));
    // ...and no wider than the column beside its captions (a wide map like the U.S. gets shorter instead)
    const textW = mp.querySelector('.mappreview-text').getBoundingClientRect().width || 80,
      maxW = availW - textW - parseFloat(getComputedStyle(mp).columnGap || 0),
      pw = Math.min(maxW, ((ph - 2 * PREVIEW_PAD) * MAP_W) / MAP_H + 2 * PREVIEW_PAD);
    ph = Math.round(((pw - 2 * PREVIEW_PAD) * MAP_H) / MAP_W + 2 * PREVIEW_PAD);
    pc.style.height = ph + 'px';
    pc.style.width = Math.floor(pw) + 'px';
    h = Math.max(240, h - ph - gap);
  }
  const scale = scaleFor(h);
  const cssW = Math.floor(VW * scale),
    cssH = Math.floor(VH * scale),
    dpr = window.devicePixelRatio || 1;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.__k = canvas.width / VW;
  canvas.__css = cssW / VW;
  stage.style.height = cssH + 'px';
}
addEventListener('resize', fitCanvas);

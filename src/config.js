import { LEVEL_KEY, MAP } from './levels/index.js';

/* Test mode: open the game with ?test=1 to deal only the level's two test states; connecting them completes the round.
   Useful for checking the win popup and Endless mode without assembling the whole map.
   A build can also force it on (see .env.single-test), which is how the test artifact is made. */
const FORCE_TEST = import.meta.env.VITE_FORCE_TEST === '1';
export const TEST_IDS = FORCE_TEST || new URLSearchParams(location.search).has('test') ? MAP.testIds : null;

/* Saved data (localStorage). The game was first released as "Suika States", then called "Merge Everything!";
   values saved under the older key names are copied to the current names once (newest name first), so players
   keep their best scores and settings. */
const LEVEL_PREFIX = MAP.key === 'us' ? '' : MAP.key + '-'; // each level keeps its own best score
export const STORAGE_KEYS = {
  best: `merge-it-${LEVEL_PREFIX}${TEST_IDS ? 'test-best' : 'best'}`,
  muted: 'merge-it-muted',
  tutorialDone: 'merge-it-tutorial-done',
  mapPreview: 'merge-it-map-preview', // '0' once the player hides the finished-map preview
  level: LEVEL_KEY, // the last map played (read in levels/index.js, which loads before this file)
};
try {
  for (const key of ['best', 'test-best', 'eu-best', 'eu-test-best', 'muted', 'tutorial-done', 'map-preview']) {
    const to = 'merge-it-' + key;
    if (localStorage.getItem(to) !== null) continue;
    const from = ['merge-everything-' + key, 'suika-states-' + key].find(k => localStorage.getItem(k) !== null);
    if (from) localStorage.setItem(to, localStorage.getItem(from));
  }
} catch (e) {}

const STD_BOX_W = 600; // the U.S. map fills 96% of this width

// prettier-ignore
export const CFG = {
  boxW: MAP.boxW ?? STD_BOX_W, boxH: 560, pad: 12,   // logical box size (inner width/height); a level with a tall map uses a narrower box
  mapFill: 0.96,                      // assembled map width as a share of box width...
  mapMaxH: 360,                       // ...unless that makes it taller than this (tall maps like Europe); must fit under dangerMax
  dangerY: 168, dangerStepPerRound: 25, dangerMax: 190,   // starts 5% of the box lower than originally; 190 is the lowest it can go and still fit the full map
  overflowGrace: 2000, overflowLimit: 2500,
  dropCooldown: 500,
  rotateSpeed: Math.PI,               // radians per second while the waiting piece is held (half a turn per second)
  rotateDelay: 120,                   // ms of holding before it starts to spin, so a quick click drops it unrotated
  labelMax: 14.5, labelMin: 3.5,     // codes on the pieces (see map/labels.js): largest size, and smallest worth drawing (Luxembourg only fits ~1.6px)
  crossingStub: 12, crossingWidth: 4.5,                   // sea crossings (drawn as little bridges): how far half a bridge sticks out while the partner isn't joined, and band width
  ringGap: 3,                         // space between the waiting piece's farthest point and the rotation arrows circling it
  blendsPerRound: 3,                  // Blend It! uses per round (refills when a new round starts)
  blendDuration: 6000, blendTurns: 2, blendScale: 0.68,   // Blend It!: length (ms), full turns, how small the box shrinks while spinning. Slower = pieces tumble along the walls instead of floating
  shakeDuration: 900,                 // how long the box visibly shakes (ms)
  shakeCooldown: 1000,                // Shake is available again this soon after pressing it (just after the shake ends)
  gravity: 1.6,                       // Matter default is 1
  cornerRadius: 2.5,                  // invisible rounding on physics corners (outlines are drawn unrounded)
  snapTolerance: 3,                   // a merge snaps into map position only if that spot overlaps other pieces by at most this many px
  snapRetry: 250,                     // ms to wait before retrying a merge that had no room
  substeps: 3,                        // physics steps per frame; smaller steps stop big pieces from rocking and gaining energy
  sleepMotion: 0.017,                 // Matter's "at rest" threshold, measured per substep (default 0.08 per full step)
  settleSpeed: 0.3, settleSpin: 0.005, settleTime: 500,   // backstop: barely moving this long -> freeze until touched
  pts: { mergePerState: 10, division: 100, region: 250, complete: 1000 }
};
/* A narrower box is drawn at the scale a standard one would get, so pieces look the same size in every level */
export const VW_STD = STD_BOX_W + CFG.pad * 2;
export const VW = CFG.boxW + CFG.pad * 2,
  VH = CFG.boxH + CFG.pad; // logical canvas size
export const BOX = { l: CFG.pad, r: CFG.pad + CFG.boxW, b: CFG.boxH };

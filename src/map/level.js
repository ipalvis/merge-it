/* Which map this game uses: the one the URL names (?map=eu), else the last one played, else the U.S.
   The map switch in the top bar reloads the page with ?map= set. New levels: add a file like us.js (data from
   scripts/build-map.mjs) and list it here, in the order the switch shows them. */
import eu from './eu.js';
import us from './us.js';

export const LEVELS = { us, eu };
export const LEVEL_KEY = 'merge-it-level'; // localStorage: the last map played
let last = null;
try {
  last = localStorage.getItem(LEVEL_KEY);
} catch (e) {}
export const MAP = LEVELS[new URLSearchParams(location.search).get('map')] ?? LEVELS[last] ?? us;
try {
  localStorage.setItem(LEVEL_KEY, MAP.key);
} catch (e) {}

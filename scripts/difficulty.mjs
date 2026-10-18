/* The difficulty scale (docs/difficulty.md), shared by rate-levels.mjs (which rates levels) and check-levels.mjs
   (which flags ratings that are out of date). Changing the scale? `npm run rate:levels -- --rescore` re-rates every
   level from the games it already played, without playing them again. */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

const ROOT = new URL('../', import.meta.url);

/* Rating 1..5 in half steps -> label */
// prettier-ignore
export const SCALE = [
  { label: 'Relaxed', below: 1.75 },
  { label: 'Easy',    below: 2.75 },
  { label: 'Medium',  below: 3.75 },
  { label: 'Hard',    below: 4.75 },
  { label: 'Expert',  below: Infinity },
];
const clamp = x => Math.max(0, Math.min(1, x));
const half = x => Math.round(x * 2) / 2;

/* The rating is how often the aiming player completes the map (its win rate w): 1 when it always does, 3 at about one
   game in four, 4.5-5 when it never does. Among levels that complete equally rarely, a fuller box rates harder: fill
   (all the pieces' area as a share of the room below the red line) adds up to half a point, from nothing at 0.30 to
   the full half at 0.50 and above.
     rating = 1 + (1 - w)^2.2 * (3.5 + 0.5 * crowding),   crowding = (fill - 0.30) / 0.20, kept within 0..1
   The range is the rating at the ends of the win rate's 95% interval, so it shows how far the games' luck could move it. */
export function rateFrom(w, fill, games) {
  const crowding = clamp((fill - 0.3) / 0.2),
    at = p => 1 + Math.pow(1 - clamp(p), 2.2) * (3.5 + 0.5 * crowding),
    se = Math.sqrt(Math.max(w * (1 - w), 1 / games) / games), // (never 0, so 0 wins still leaves some doubt)
    rating = half(at(w));
  return {
    rating,
    label: SCALE.find(s => rating < s.below).label,
    range: [half(at(w + 1.96 * se)), half(at(w - 1.96 * se))],
  };
}
export const rate = (sim, stats) => rateFrom(sim.aiming.winRate, stats.fill, sim.aiming.games);

/* What a rating depends on: when one of these files changes, the rating is out of date */
export const ratingInputs = key => [`src/levels/${key}/level.js`, `src/levels/${key}/map.json`, 'src/config.js'];
export const inputsHash = key =>
  createHash('sha1')
    .update(
      ratingInputs(key)
        .map(f => readFileSync(new URL(f, ROOT), 'utf8').replace(/\r\n/g, '\n'))
        .join('\0'),
    )
    .digest('hex')
    .slice(0, 12);

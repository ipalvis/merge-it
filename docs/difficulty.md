# Difficulty ratings

Every level has a difficulty rating from 1 to 5, in half steps. It's stored in `src/levels/<key>/difficulty.json` and produced by `npm run rate:levels`. This page explains what the ratings mean, how they're measured, and what makes a level easier or harder.

## Current ratings

| Level  | Rating   | Could be | Map completed (careful player) | Fill | Map assembled, on average | Box overflowed |
| ------ | -------- | -------- | ------------------------------ | ---- | ------------------------- | -------------- |
| U.S.   | 5 Expert | 4.5–5    | 0 of 32 games                  | 0.52 | 34%                       | 28% of games   |
| Europe | 4.5 Hard | 4–4.5    | 0 of 32 games                  | 0.33 | 60%                       | never          |

"Could be" is the range the rating would take at either end of the win rate's 95% interval: how far the luck of the games could move it. "Fill" is defined below.

## The scale

**A rating is about how often a careful player completes the map.** That is the aiming player's win rate in round 1, simulated as described below.

| Rating | Label   | Completes the map      |
| ------ | ------- | ---------------------- |
| 1      | Relaxed | every game             |
| 2      | Easy    | about 1 game in 2      |
| 3      | Medium  | about 1 game in 4      |
| 4      | Hard    | about 1 game in 10     |
| 4.5–5  | Expert  | almost never, or never |

Among levels that complete equally rarely, a fuller box rates harder. Fill adds up to half a point: nothing at 0.30 or below, rising to the full half point at 0.50 and above. That is why both maps complete 0 of 32 games, yet the U.S. (fill 0.52) rates 5 and Europe (fill 0.33) 4.5.

```
rating   = 1 + (1 - win rate)^2.2 * (3.5 + 0.5 * crowding), rounded to the nearest half
crowding = (fill - 0.30) / 0.20, kept within 0..1
```

The labels split at 1.75, 2.75, 3.75 and 4.75. The formula lives in `scripts/difficulty.mjs`. After changing the scale, run `npm run rate:levels -- --rescore` to re-rate every level from the games already played, without playing them again.

## How it's measured

`scripts/rate-levels.mjs` plays the real game code in a headless browser, on a simulated clock and with seeded randomness, so the games are fast and repeatable. The game's own rules apply throughout: the red line and its grace period, drop and Shake cooldowns, Blend It!, merges and snapping. Two simulated players play 48 games of round 1 each (the current ratings above used 32):

- **Careful ("aiming") player. The rating uses this one.** If a region it borders is showing on top of the pile, it lands the piece there, trying a few turns and many spots. Otherwise it drops the piece upright where it sits on the finished map, so pieces that will join end up near each other. It shakes when the pile goes over the red line, and blends if shaking doesn't clear it. Once every piece is in, it shakes, then blends, then banks a loose piece and drops it onto a neighbor. It gives up when nothing has joined for a while and nothing is left to try.
- **Careless ("random") player.** It drops each piece anywhere, at any angle, and shakes and blends once every piece is in. It isn't part of the rating; it shows how much careless play costs (how full the box gets, how often it overflows).

Besides wins, `difficulty.json` records:

- how much of the map ends up in the biggest piece;
- how many separate pieces are left;
- how often a drop joins something as it lands;
- the highest the settled pile got;
- how often the box overflowed;
- the shakes and blends used.

## What makes a level harder

### Fill

**Fill** is the total area of all the pieces as a share of the room below the red line (the box width × the height from the floor to the line in round 1). It is the strongest predictor of everything else measured, but a predictor, not the rating: it makes completing more likely, without deciding it. Both maps were rated in boxes from 300 to 600 wide, and with and without pre-joined clusters (16 games per player):

| Variant                   | Fill | Completed | Rating | Map assembled | Overflowed |
| ------------------------- | ---- | --------- | ------ | ------------- | ---------- |
| U.S., box 600 (the level) | 0.52 | 0 of 16   | 5      | 35%           | 31%        |
| U.S., no clusters         | 0.52 | 0 of 16   | 5      | 36%           | 38%        |
| U.S., box 540             | 0.47 | 0 of 16   | 5      | 40%           | 19%        |
| U.S., box 480             | 0.42 | 0 of 16   | 5      | 50%           | 13%        |
| Europe, box 371 (level)   | 0.33 | 0 of 16   | 4.5    | 64%           | 0%         |
| Europe, no clusters       | 0.33 | 0 of 16   | 4.5    | 63%           | 0%         |
| Europe, box 450           | 0.28 | 3 of 16   | 3      | 82%           | 0%         |
| Europe, box 300           | 0.27 | 3 of 16   | 3      | 69%           | 0%         |
| Europe, box 600           | 0.21 | 3 of 16   | 3      | 78%           | 0%         |

Wins only appear below a fill of about 0.30. Above it, a lower fill still means more of the map assembled and fewer overflows, but the map isn't completed.

How the box width affects fill depends on the map's shape:

- **Wide maps** (like the U.S.) fill 96% of the box width (`CFG.mapFill`). The pieces scale with the box, so piece area grows with the width squared while the room grows with the width only. **A narrower box makes a wide map easier**: its pieces get smaller relative to the box's fixed height.
- **Tall maps** (like Europe) are capped by height instead (`CFG.mapMaxH`, 360), so the pieces keep their size whatever the box width. **A wider box makes a tall map easier**: the same pieces get more room.

Set a level's box width with `boxW` in its `level.js` (240–600; 600 is standard). Changing `CFG.mapFill`, `CFG.mapMaxH`, `CFG.boxH` or the red line in `src/config.js` changes fill for every level; re-rate them all after doing that.

### Why maps go unfinished

Most unfinished games end with a few separate pieces lying apart in the pile, not touching. Shake and Blend rarely bring exactly the right borders together, and the bank moves only one piece per round. So anything that leaves fewer loose pieces when the deck runs out makes completing more likely:

- fewer pieces in the deck;
- more neighbors per piece;
- compact shapes;
- room in the box for pieces to land on what they border.

### Other things measured

`difficulty.json` also records these. With only a few maps, their effect isn't separated from fill yet:

- **pieces**: how many drops the deck has. Removing the clusters (5–6 more drops) barely changed either map.
- **solidity**: the pieces' area divided by the area of their convex outlines; 1 means every piece is convex. Sprawling shapes (Norway, Croatia, Florida) pack badly and catch on each other.
- **widestPiece / medianPiece**: a piece's spin circle as a share of the box width.
- **neighbors**: the average number of pieces each piece can join.
- **deadEnds**: pieces that can join only one other piece (Portugal, Maine).
- **seaLinks**: neighbors across water.
- **mapHeight**: the finished map's height as a share of the room below the line. It must stay under 1 for the map to fit.

## Rating a level

1. Run `npm run rate:levels -- <key>` (or with no key for every level). It needs Edge or Chrome installed (set `RATE_BROWSER=chrome` or `msedge` to choose) and takes 10–15 minutes per level. Options:
   - `--games 96` for a steadier win rate;
   - `--players aiming` to tune faster (only the player the rating uses);
   - `--verbose` for a line per game;
   - `--dry-run` to print without writing `difficulty.json`.
2. Commit the new `difficulty.json`.
3. Re-rate after changing the level's `level.js` or `map.json`, or `src/config.js`. `npm run check:levels` (also part of `npm run build`) warns when a rating is out of date or missing.

## Limits

- The players are simulated, not people. A practised human probably aims better than the careful player and completes more often, so read ratings as a comparison between levels, not as a promise about any one player.
- A win rate from 48 games is still rough: at 1 in 4, it could be anywhere from about 1 in 8 to 3 in 8. The "could be" range shows this; use `--games 96` or more when it matters.
- Only round 1 is rated. Later rounds lower the red line, so every level gets harder from round 2.
- Changes to gameplay code (merging, snapping, Shake, Blend) can change every rating without `check:levels` noticing, because it tracks only the level's files and `src/config.js`. Re-rate after gameplay changes.

# Difficulty ratings

Every level has a difficulty rating from 1 to 5, in half steps. It's stored in `src/levels/<key>/difficulty.json` and produced by `npm run rate:levels`. This page explains what the ratings mean, how they're measured, and what makes a level easier or harder.

## Current ratings

| Level           | Rating      | Could be | Map completed (careful player) | Fill | Map assembled, on average | Box overflowed |
| --------------- | ----------- | -------- | ------------------------------ | ---- | ------------------------- | -------------- |
| U.S.            | 5 Expert    | 4.5–5    | 0 of 32 games                  | 0.52 | 34%                       | 28% of games   |
| Europe          | 4.5 Hard    | 4–4.5    | 0 of 32 games                  | 0.33 | 60%                       | never          |
| Central America | 2.5 Easy    | 2–2.5    | 46 of 128 games (36%)          | 0.16 | 82%                       | 2% of games    |
| South America   | 1.5 Relaxed | 1–1.5    | 86 of 128 games (67%)          | 0.41 | 92%                       | never          |

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
- the shakes and blends used;
- physics faults, as totals over all games: pieces that ended a game sunk into another piece or a wall (and how many of those were at a bridge), and pieces that ended up outside the box. These should stay near 0. A few happen on every map with walls and rigid bodies (Europe had 2 or so per 24 games before bridges were solid), and `rate-levels` prints them so a change that makes them common shows up.

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

### Design rules

Three rules make sure every piece can be dropped and joined reliably. Sizes are measured as drawn in the box, in the box's own units, the same in every level. `check-levels` enforces them and says what to change. The U.S. and Europe predate them and are exempt, to keep them as they are; every new level has to follow them.

- **Grouping.** A map of 12 regions or fewer pre-joins nothing: every region is its own piece, small or not, because a short map needs all the pieces it has. A bigger map pre-joins the pieces under the minimum size, and only those.
- **Minimum piece size** (maps of more than 12 regions). Every piece (a region, or a pre-joined cluster) must be at least as big as Uruguay is in South America: 430 square units. Smaller pieces are too small to aim at reliably, or to show a code. Pre-join a small one with a neighbor in `clusters`.
- **Minimum connection width.** The whole map must be completable using only connections at least 12 units wide (half the width of a minimum-size piece), where a connection is the border two pieces share, or a bridge across water. A narrow border can exist, as long as the map doesn't need it: Chile–Peru in South America is 9 wide, but Chile also joins Bolivia and Argentina along wide borders. When the map does need one, pre-join across it, or leave a side out.

How joining works matters here. Two neighbors join wherever they touch, not only along their shared border, and that includes pieces joined by a bridge. The width rule is about what players see. They aim for the border, and a sliver like Panama's looks unreachable. A bridge counts because it shows exactly where the two pieces belong, and it's solid: half a bridge is part of its country's piece, so it rests on walls and other pieces, and dropping its partner onto it joins them.

The rules limit how hard a map can be. With every piece above a fixed size, a map's area in the box caps how many pieces it can have, and the piece count is the main thing that decides how often a map is completed (below). A map meant to be hard needs a lot of land made of mid-sized regions that border each other widely, not a few big countries with small ones around them.

### Building a level to a rating: Latin America

The first Latin America map (Mexico to Patagonia) was built to rate 3, completed about one game in four. Each step below was 64 games of the careful player (128 for the 20-piece version and the 11-piece one):

| Version                                        | Pieces | Sea crossings | Fill | Completed |
| ---------------------------------------------- | ------ | ------------- | ---- | --------- |
| South America only (13 countries)              | 13     | 0             | 0.41 | 75%       |
| + Mexico and Central America (21)              | 21     | 0             | 0.22 | 36%       |
| + Cuba, Haiti, Dominican Republic, Puerto Rico | 25     | 3             | 0.22 | 13%       |
| Haiti and the Dominican Republic pre-joined    | 24     | 3             | 0.22 | 13%       |
| Puerto Rico left out                           | 23     | 2             | 0.22 | 9%        |
| Cuba and Hispaniola pre-joined as one piece    | 22     | 1             | 0.22 | 16%       |
| + the Guianas pre-joined (rated 3)             | 20     | 1             | 0.22 | 20%       |
| the same in a wider box (360)                  | 20     | 1             | 0.21 | 16%       |
| minimum piece size applied (rated 1.5)         | 11     | 0             | 0.22 | 58%       |

The 20-piece version had ten pieces under the minimum size: the seven Central American countries, the islands, Uruguay and Ecuador. Pre-joining them left 11 pieces, and still a poor map: Central America, now one small piece, joined South America only through Panama's 9-wide border with Colombia. That's what the minimum connection width rule came from. The map became two, South America and Central America, each at its own scale, so their countries are bigger in the box and fewer need pre-joining (see Current ratings).

The two maps that came out of it show that how pieces connect matters too. Central America (11 pieces: Mexico through Panama, plus Cuba, Haiti and the Dominican Republic) is mostly one chain, Panama at one end and the Dominican Republic at the other: each piece joins 2.2 others on average. One missed join anywhere along the chain leaves the map unfinished, so it completes 36% of games. South America has 12 pieces that each join 3.8 others, and completes 67%. (An earlier 6-piece Central America, with small countries pre-joined and no islands, completed 31%: the chain, not the piece count, is what makes it harder.)

What it shows:

- **The number of pieces matters more than fill.** South America alone was the fullest box here (0.41) and the easiest map. Adding eight small Central American pieces halved its completion rate, even though fill fell to 0.22.
- **Small islands with one neighbor are hard.** Adding Cuba, Haiti, the Dominican Republic and Puerto Rico cost about as much as adding several land pieces. Not because of the water (pieces joined by a bridge join wherever they touch), but because each island was a small piece with a single neighbor to find. (Measured before bridges were solid.)
- **A chain is harder than a web.** Fewer neighbors per piece, and pieces that join only one other, make a map harder at the same piece count.
- **Pre-joining pieces is the finest tuning knob.** Each cluster removes drops and, for islands, crossings, without changing what the map shows.
- **The box width did little here.** Within a fill of 0.21–0.22, widening the box made no difference beyond the games' luck.

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

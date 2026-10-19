# Merge It! — notes for Claude Code

Browser game: drop the pieces of a map (U.S. states, or the countries of Europe, South America or Central America) into a box; pieces that border each other on the real map stick together. Goal is to assemble the whole map. Plain JavaScript (ES modules), Matter.js physics, Web Audio, bundled with Vite. See README.md for the full project structure.

## Commands

- `npm run dev` — dev server at http://localhost:5173 (hot reload). `?test=1` deals only Colorado + Utah for quick win/Endless checks. `?map=eu` loads the Europe map (Spain + Portugal with `?test=1`), `?map=sa` South America (Paraguay + Bolivia), `?map=central` Central America (Costa Rica + Panama); without `?map=` the game opens on the last map played. Check changes on every map.
- `npm run build` — checks every level (`scripts/check-levels.mjs`), then builds to `dist/` (what Cloudflare Pages serves). Run this before saying a change is done.
- `npm run build:map [-- <key>]` — regenerates a level's `map.json` (all levels without a key); `npm run check:levels` checks levels on their own.
- `npm run rate:levels [-- <key>]` — difficulty rating (`scripts/rate-levels.mjs`): plays each level with simulated players in headless Edge/Chrome (10–15 minutes a level) and writes `src/levels/<key>/difficulty.json`; the rating (1–5, half steps) is mainly how often the careful player completes the map, with fill separating levels that complete equally rarely (`scripts/difficulty.mjs`). Re-rate after changing a level's settings or map, or `CFG` (check-levels warns when a rating is stale). See `docs/difficulty.md`.
- `npm run format` / `npm run format:check` — Prettier. Run `format` after editing.
- `npm run build:single` / `npm run build:single-test` — single-file builds for claude.ai artifacts.

## Deploying

Every push to `main` on GitHub (`ipalvis/merge-it`) auto-deploys to Cloudflare Pages (https://merge-it.pages.dev; add `?map=us` or `?map=eu` to open a given map). The old project at https://merge-everything.pages.dev (the game's former name) is left as is; saved data there (best scores, settings) doesn't carry over to the new address. Do not push to `main` unless asked. For risky changes, use a branch (Cloudflare builds a preview URL per branch).

## How the code is organized

- Shared mutable state lives on `G` in `src/state.js`. Values only one module uses stay private to that module.
- Gameplay tunables live in `CFG` in `src/config.js` (gravity, red line, cooldowns, blends per round, scoring). Prefer adding a CFG value over a magic number.
- The frame loop (`src/game/loop.js`) is `step(now)` (game logic) plus drawing; the difficulty simulator calls `step` on a fake clock with seeded `Math.random`, so game logic should read time only through `performance.now()`/`setTimeout` and randomness through `Math.random`.
- Flow is driven by `G.state`: `title | playing | blending | bankpick | banking | clearing | won | over | tutorial`. Physics only steps in `playing`, `clearing`, `blending`.
- Physics bodies for pieces are Matter compound bodies ("groups") with `g.ids` (a Set of state ids). The waiting piece is `G.current`, a piece object with `.states` (array), `.name`, `.R`, `.c`.
- Merges: `src/physics/world.js` queues neighbor contacts and snaps merged pieces into true map position; `onMerged` in `src/game/game.js` handles scoring, toasts and round completion.
- Tutorial: `src/game/tutorial.js`. While it runs, `G.tut` holds allowed actions and hooks (`dropped`, `merged`, `shaken`, `banked`, `blendStart`, `blendDone`, `tick`). Gameplay code calls `G.tut?.hook?.()` and checks `tutBlocks(action)`. Any new player action should respect `tutBlocks`.
- Rendering is all canvas in `src/render/render.js`; colors come from CSS variables via `theme` (`src/ui/theme.js`), so both light and dark themes work. Use theme colors, not hard-coded hex, in canvas drawing.
- Sounds are synthesized in `src/audio/sound.js` (`Sound.fx.*`); there are no audio files.
- Levels (maps): one folder per level in `src/levels/<key>/` (`level.js` settings and wording, `source.mjs` map recipe, generated `map.json`), found automatically by `src/levels/index.js`. It picks `MAP` from the URL or the last one played and loads only that level's `map.json` (a top-level await, so every module can read `MAP` at import); the map switch in the top bar (buttons, or a dropdown when they don't fit; `fitCanvas` decides) reloads with `?map=` set. Per-level content (colors, clusters, bonus divisions/regions, wording, test ids) lives there, not in shared code. README.md has the steps for adding a level. New levels must follow three design rules that `check-levels` enforces (`GROUP_ABOVE`, `MIN_PIECE_AREA`, `MIN_CONNECTION`; only the U.S. and Europe, which predate them, are exempt): a map of 12 regions or fewer pre-joins nothing; a bigger one pre-joins only pieces under the minimum size; and the map must be completable using only connections at least the minimum width, or bridges across water (`links`). Note that neighbors join wherever they touch (`world.js`), not only along their border; the width rule is about what players see and aim for. In code, a "state" is any map region (a U.S. state or a country); user-facing text uses `MAP.unit`/`MAP.units`. The tutorial is U.S.-only (`MAP.tutorial`). A level can narrow the box (`MAP.boxW`; Europe uses 371), which sets `CFG.boxW`/`VW`; it's drawn at the scale a standard box would get (`VW_STD`), so pieces look the same size. Every map gets fitted labels (`src/map/labels.js`) and the finished-map preview panel toggled by the ? button (`src/game/preview.js`; drawn in `updateHUD`). Keep gameplay and wording the same across maps; per-map differences belong in the map files (song, box width, tutorial, sea crossings).
- Map data (`src/levels/*/map.json`) is generated by `scripts/build-map.mjs` from each level's `source.mjs`; don't hand-edit it. After changing a level, run `npm run check:levels` (also part of `npm run build`), and extend `scripts/check-levels.mjs` when a new kind of level setting could be wrong.

## Conventions

- Matter.js is pinned at 0.19.0 on purpose. Don't upgrade it.
- Keep changes small and in the existing style (short comments explaining why, Prettier formatting).
- Saved data uses `localStorage` keys in `STORAGE_KEYS` (`src/config.js`); always wrap localStorage in try/catch.
- Check layouts at desktop width (bank and reset sit beside the box) and phone width (~390px, bank sits in the header).

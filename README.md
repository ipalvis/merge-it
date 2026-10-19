# Merge It!

Drop the pieces of a map into a box: U.S. states, or the countries of Europe or Latin America. Pieces that border each other on the real map stick together and snap into place. Assemble the whole map (all 48 contiguous states, 37 countries of Europe, or 24 of Latin America) before the pile overflows the red line. The map switch at the top changes maps (it turns into a dropdown when the names don't fit, as on narrow phones), and the ? button shows or hides a small preview of the finished map, with the current piece in gold. The codes on the pieces are sized and placed to fit inside each shape. Each map has a difficulty rating (see [docs/difficulty.md](docs/difficulty.md)).

Built with plain JavaScript, [Matter.js](https://brm.io/matter-js/) for physics, and the Web Audio API for music and sound effects. [Vite](https://vite.dev/) bundles it.

## Quick start

Requires Node.js 22.12 or newer (see `.nvmrc`).

```bash
npm install
npm run dev        # local dev server with hot reload, usually http://localhost:5173
```

Open `http://localhost:5173/?test=1` for **test mode**: only Colorado and Utah are dealt, and connecting them wins the round. Use it to check the win popup and Endless mode quickly. Test mode keeps its own best score.

**The Europe map** (the switch at the top, or `http://localhost:5173/?map=eu`): the EU's members plus the neighbors that fill out the map (Switzerland, Norway, the Western Balkans, Ukraine, Belarus, Moldova and the UK; 37 countries, Malta and Cyprus left out). Borders are the internationally recognised ones (Crimea is part of Ukraine). Two pairs join across the water, drawn as little bridges: Sweden and Denmark (the Øresund Bridge) and the UK and France (the Channel Tunnel); a piece whose partner isn't joined yet shows half a bridge pointing at it. Europe is taller than wide, so its box is narrower (371 instead of 600 logical px, same height) to fit the finished map the way the standard box fits the U.S. It has its own, calmer theme song, no tutorial, and its own best score. Combine with `&test=1` to deal only Spain and Portugal. Without `?map=`, the game opens on the last map played.

**The Latin America map** (`?map=latam`): Mexico, Central America and South America (with Guyana, Suriname and French Guiana to fill out the map), plus Cuba and Hispaniola; 24 countries, the Falklands and the English- and Dutch-speaking Caribbean left out. Small countries ship pre-joined, so no piece is under the minimum size (Paraguay): Central America as one piece, Mexico with Cuba and Hispaniola (joined across the Yucatán Channel by a little bridge), Colombia with Ecuador, Argentina with Uruguay, and the three Guianas. So 11 pieces drop. Its box is 336 wide, fitted to its shape the way Europe's is. Combine with `&test=1` to deal only Paraguay and Bolivia.

## Project structure

```
index.html            page markup (HUD, buttons, dialogs)
src/
  main.js             entry point: loads modules, wires buttons, starts the loop
  styles.css          all styles, light and dark themes, self-hosted font
  config.js           CFG tunables, box size, test mode flag
  state.js            G: shared mutable game state (score, round, deck, pieces, flow state)
  levels/
    index.js          finds every level folder, picks MAP (the URL's ?map=, else the last one played, else the
                      first), and loads only that level's map data
    us/, eu/, latam/  one folder per level:
      level.js        settings and wording: colors, pre-joined clusters, bonus divisions and regions, song, box width
      source.mjs      build recipe for map.json: boundary data, which regions, codes, islands, sea links
      map.json        generated map data (outlines, convex physics pieces, neighbors); don't hand-edit
  map/geometry.js     scales map data, builds STATES, pieces, clusters, colors, stick-to rules
  map/labels.js       fitted codes (sized to fit inside each shape, centred where they fit)
  physics/world.js    Matter.js world, building piece bodies, merge detection and snapping
  game/
    game.js           rounds, scoring, win popup, Endless mode, game over
    loop.js           main loop: fixed-step physics, overflow check, settle backstop
    aim.js            aiming, hold-to-rotate, dropping
    shake.js          Shake the box
    blend.js          Blend It!
    bank.js           Bank a piece
    giveUp.js         two-tap Give up
    tutorial.js       first-run guided tutorial (dim, spotlight, scripted steps)
    preview.js        show or hide the finished-map panel
  input/input.js      pointer and keyboard input
  render/render.js    canvas drawing: box, pieces, danger line, aim preview, rotation ring
  ui/                 canvas sizing, theme, HUD, toasts, confetti, DOM helper
  audio/sound.js      synthesized music sequencer and sound effects, mute
scripts/
  build-map.mjs       offline map-data pipeline: runs each level's source.mjs and writes its map.json
  check-levels.mjs    checks every level's settings against its map (runs as part of npm run build)
  rate-levels.mjs     difficulty rating: measures each level and plays it with simulated players (npm run rate:levels)
  difficulty.mjs      the difficulty scale, shared by the two above
  projections.mjs     map projections for level recipes (Lambert azimuthal equal-area)
docs/
  difficulty.md       what the difficulty ratings mean, how they're measured, and what makes a level harder
```

## Adding a level

1. Make a folder in `src/levels/` named for the level's key (what `?map=` will use), e.g. `src/levels/jp/`.
2. Write `source.mjs`, the recipe for its map data: which TopoJSON file to use, which regions to keep and the code each one shows, plus optionally a projection, island rules and links across water. `scripts/build-map.mjs` lists every option; `us/` and `eu/` are worked examples. Any TopoJSON with a region per shape works; the build script reads it from an npm package (e.g. `world-atlas`, `us-atlas`).
3. Run `npm run build:map -- jp` to write `map.json`.
4. Write `level.js` with its settings and wording: copy `latam/level.js` and change it, including `order` (its place on the map switch).
5. Run `npm run check:levels`. It reports anything that would break play: regions that can never join the rest (add a link in `source.mjs`), regions missing from the color groups, clusters that don't touch, bonus groups or test ids naming regions that aren't on the map, and so on.
   **Minimum piece size:** every piece must be at least as big as Paraguay is in Latin America (as drawn in the box). Smaller ones are too small to aim at reliably. Pre-join a small region with a neighbor in `clusters` until every piece passes; the check names each piece that's too small. The U.S. and Europe predate the rule and are exempt; new levels aren't.
6. Play it with `npm run dev` and `?map=jp` (`&test=1` deals only its test pair). The map switch picks it up on its own.
7. Rate it with `npm run rate:levels -- jp` (10–15 minutes; needs Edge or Chrome installed). It plays the level with simulated players and writes `difficulty.json` with a rating from 1 to 5, mainly from how often a careful player completes the map. [docs/difficulty.md](docs/difficulty.md) explains the scale and what makes a level easier or harder. Rate it again after changing the level; `check:levels` warns when a rating is out of date.

**How state is shared:** anything that more than one module reads and changes lives on the `G` object in `src/state.js` (for example `G.score`, `G.state`, `G.groups`). Values only one module uses stay private to that module. Constants live in `src/config.js`.

**Tuning gameplay:** almost everything is in `CFG` in `src/config.js`: gravity, danger line, cooldowns, Blend It! uses, scoring. Audio levels and tempo are at the top of `src/audio/sound.js`.

## Notes

- **Matter.js is pinned at 0.19.0**, the version the physics was tuned against. 0.20 exists; upgrade deliberately and re-check merges, stacking and Blend It!.
- **Fonts:** Public Sans is bundled from `@fontsource` (Latin subset only), so the game makes no third-party requests.
- **`npm audit`** reports a high-severity issue in `braces`, pulled in through `vite-plugin-singlefile`. It affects build tooling only, never the shipped game. Don't run `npm audit fix --force`; it downgrades the plugin to a broken version.
- **Tutorial:** new players see a title card offering the tutorial. Once they finish or skip it, `merge-it-tutorial-done` is saved and the title card offers Play instead (with Tutorial as the smaller option). To see the first-run card again, delete that key in DevTools > Application > Local Storage.
- **Saved data:** best score and mute setting are stored in `localStorage` under `merge-it-*` keys (see `STORAGE_KEYS` in `src/config.js`). The game was first released as Suika States, then called Merge Everything!; values saved under the old `suika-states-*` and `merge-everything-*` keys are copied over once on load.
- Music is an original composition, synthesized at runtime; there are no audio files.

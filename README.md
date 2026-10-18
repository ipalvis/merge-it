# Merge It!

Drop the pieces of a map into a box: U.S. states or European countries. Pieces that border each other on the real map stick together and snap into place. Assemble the whole map (all 48 contiguous states, or 37 countries of Europe) before the pile overflows the red line. The U.S. | Europe switch at the top changes maps, and the ? button shows or hides a small preview of the finished map, with the current piece in gold. The codes on the pieces are sized and placed to fit inside each shape.

Built with plain JavaScript, [Matter.js](https://brm.io/matter-js/) for physics, and the Web Audio API for music and sound effects. [Vite](https://vite.dev/) bundles it.

## Quick start

Requires Node.js 22.12 or newer (see `.nvmrc`).

```bash
npm install
npm run dev        # local dev server with hot reload, usually http://localhost:5173
```

Open `http://localhost:5173/?test=1` for **test mode**: only Colorado and Utah are dealt, and connecting them wins the round. Use it to check the win popup and Endless mode quickly. Test mode keeps its own best score.

**The Europe map** (the switch at the top, or `http://localhost:5173/?map=eu`): the EU's members plus the neighbors that fill out the map (Switzerland, Norway, the Western Balkans, Ukraine, Belarus, Moldova and the UK; 37 countries, Malta and Cyprus left out). Borders are the internationally recognised ones (Crimea is part of Ukraine). Two pairs join across the water, drawn as little bridges: Sweden and Denmark (the Øresund Bridge) and the UK and France (the Channel Tunnel); a piece whose partner isn't joined yet shows half a bridge pointing at it. Europe is taller than wide, so its box is narrower (371 instead of 600 logical px, same height) to fit the finished map the way the standard box fits the U.S. It has its own, calmer theme song, no tutorial, and its own best score. Combine with `&test=1` to deal only Spain and Portugal. Without `?map=`, the game opens on the last map played.

## Project structure

```
index.html            page markup (HUD, buttons, dialogs)
src/
  main.js             entry point: loads modules, wires buttons, starts the loop
  styles.css          all styles, light and dark themes, self-hosted font
  config.js           CFG tunables, box size, test mode flag
  state.js            G: shared mutable game state (score, round, deck, pieces, flow state)
  data/states.json    generated map data (outlines, convex physics pieces, neighbors)
  data/eu.json        the same for the Europe level
  map/level.js        picks the map: the URL's ?map=, else the last one played, else the U.S.
  map/us.js, eu.js    per-level settings: colors, pre-joined clusters, bonus divisions and regions, wording
  map/geometry.js     scales map data, builds STATES, pieces, clusters, colors, stick-to rules
  map/labels.js       fitted country codes (largest box that fits inside each shape)
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
    preview.js        Europe level: show or hide the finished-map panel
  input/input.js      pointer and keyboard input
  render/render.js    canvas drawing: box, pieces, danger line, aim preview, rotation ring
  ui/                 canvas sizing, theme, HUD, toasts, confetti, DOM helper
  audio/sound.js      synthesized music sequencer and sound effects, mute
scripts/
  build-map.mjs       offline map-data pipeline (us-atlas -> states.json, world-atlas -> eu.json)
```

**How state is shared:** anything that more than one module reads and changes lives on the `G` object in `src/state.js` (for example `G.score`, `G.state`, `G.groups`). Values only one module uses stay private to that module. Constants live in `src/config.js`.

**Tuning gameplay:** almost everything is in `CFG` in `src/config.js`: gravity, danger line, cooldowns, Blend It! uses, scoring. Audio levels and tempo are at the top of `src/audio/sound.js`.

## Notes

- **Matter.js is pinned at 0.19.0**, the version the physics was tuned against. 0.20 exists; upgrade deliberately and re-check merges, stacking and Blend It!.
- **Fonts:** Public Sans is bundled from `@fontsource` (Latin subset only), so the game makes no third-party requests.
- **`npm audit`** reports a high-severity issue in `braces`, pulled in through `vite-plugin-singlefile`. It affects build tooling only, never the shipped game. Don't run `npm audit fix --force`; it downgrades the plugin to a broken version.
- **Tutorial:** new players see a title card offering the tutorial. Once they finish or skip it, `merge-it-tutorial-done` is saved and the title card offers Play instead (with Tutorial as the smaller option). To see the first-run card again, delete that key in DevTools > Application > Local Storage.
- **Saved data:** best score and mute setting are stored in `localStorage` under `merge-it-*` keys (see `STORAGE_KEYS` in `src/config.js`). The game was first released as Suika States, then called Merge Everything!; values saved under the old `suika-states-*` and `merge-everything-*` keys are copied over once on load.
- Music is an original composition, synthesized at runtime; there are no audio files.

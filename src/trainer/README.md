# Trainer source

Editable source for the Pyraminx.net trainer — **the source of truth for the
deployed trainer**. It builds to `js/trainer.js`, which `trainer.html` serves in
production. Edit here, rebuild, commit the regenerated `js/trainer.js`.

## Files
- `l5e-trainer.jsx` — the trainer React component (engine, sheet data, UI). The
  L5E case-class map is authored data, imported from `../../data/classmap.json`
  (esbuild inlines it at bundle time), not an inline literal.
- `index.jsx` — entry point: mounts `<L5ETrainer/>` at `#root`, provides a
  localStorage fallback for `window.storage`.

## Workflow
```
npm install            # once
npm run build:trainer  # -> js/trainer.js
npm run watch:trainer  # rebuild on change
```
Then serve the site (e.g. `python -m http.server 8000`) and open
http://localhost:8000/trainer.html. Signed out, progress is in localStorage; to
test without touching real progress, use a private window or a throwaway Google
account. Commit the regenerated `js/trainer.js` with your source change.

## Integration contract (must stay true for a drop-in build)
- Mounts at `#root` (React 18 `createRoot`).
- Reads/writes its whole state via `window.storage` (async `get`/`set`) under
  the single key `l5e-trainer-v2`.
- Puzzle diagrams render through the shared site renderer
  (`js/render.js` -> `window.OORender`, which needs `js/engine.js` ->
  `window.OOEngine`), so they're identical to the rest of the site. The host
  page must load `js/engine.js` then `js/render.js` before the bundle. The
  trainer's state `{e,c}` + `uTwist` maps onto the engine state as
  `{e, c, u: uTwist}` (engine `G4` === the trainer's twist convention).
- Styling comes from `css/site.css` + `css/trainer.css` (the same files the live
  page loads); the component carries no inline `<style>`. New trainer-only
  classes live in `css/trainer.css`.
- State persistence is provided by the host page via `window.storage`:
  `trainer.html` bridges it to the shared account (`window.OOAccount`) so a
  signed-in user's progress syncs to the cloud (cloud wins on sign-in), falling
  back to localStorage when signed out.

## Status
Cut over: `trainer.html` serves the build of this source (`js/trainer.js`,
loaded with a content-hash `?v=` that `npm run stamp` maintains), preceded by
`js/engine.js` + `js/render.js`. The pre-cutover bundle remains in git history
for rollback. `js/trainer.js` is a generated artifact but is committed (it's what
the static site serves); always rebuild it before committing source changes.

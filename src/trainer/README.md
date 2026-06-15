# Trainer source

Editable source for the Pyraminx.net trainer. The deployed site serves the
bundled file `js/trainer.js`; this source builds to a **staging** artifact
`js/trainer.build.js` so it can be developed and tested without touching the
live trainer.

## Files
- `l5e-trainer.jsx` — the trainer React component (engine, sheet data, UI).
- `index.jsx` — entry point: mounts `<L5ETrainer/>` at `#root`, provides a
  localStorage fallback for `window.storage`.

## Workflow
```
npm install            # once
npm run build:trainer  # -> js/trainer.build.js
npm run watch:trainer  # rebuild on change
```
Then open `trainer-dev.html` (e.g. via `python -m http.server 8000`, then
http://localhost:8000/trainer-dev.html). The dev harness uses an isolated
`dev:`-prefixed storage key, so testing never touches real trainer progress.

## Integration contract (must stay true for a drop-in build)
- Mounts at `#root` (React 18 `createRoot`).
- Reads/writes its whole state via `window.storage` (async `get`/`set`) under
  the single key `l5e-trainer-v2`.
- Self-contained: no dependency on the site's `OOEngine`/`OORender`.

## Status
This source is the **base** the live bundle grew from; the live `js/trainer.js`
is more complete (it added V-First, Pseudo V, Inspection and TL4E-B). Develop
features here toward parity, then cut `trainer.html` over to the new build
(bump its `?v=`). The previous bundle stays in git history for rollback.

`js/trainer.build.js` is generated and git-ignored — rebuild it locally.

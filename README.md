# Pyraminx.net

A static site for no-tips Pyraminx solving and learning. Five pages share one
engine and one set of UI layers; the only build step compiles the algorithm data
and bundles the trainer.

| Page | File | What it is |
| --- | --- | --- |
| Home | `index.html` | landing page |
| OO | `oo.html` + `js/oo.js` | "objectively optimal" census — one best human solution for every position |
| Solver | `solver.html` + `js/solver.js`, `js/solver-core.js` | method solver (L4E / ML4E / L5E / TL4E / pseudo-V) |
| Trainer | `trainer.html` + `js/trainer.js` | V-First trainer (drills, timer, recap), bundled from `src/trainer/` |
| Algorithms | `algs.html` + `js/algs.js` | browse/search every subset & case; admin add/remove with auto-validation |

## Shared layers (`js/`)

- **`engine.js`** (`window.OOEngine`) — the Pyraminx engine: state model, moves,
  alg parsing, symmetry/canonicalization, optimal solving, **and the single
  source of the keying + alg→case helpers** (`stateKey`, `realCanonKey`,
  `caseStateOf`, `algSolvesKey`, `normAlg`, …). Everything else builds on these.
- **`render.js`** (`window.OORender`) — SVG puzzle diagrams (net + 3D).
- **`account.js`** (`window.OOAccount`) — Firebase Auth + per-user cloud data,
  with a localStorage demo fallback when no Firebase is configured.
- **`navbar.js`** (`window.SiteNavbar`) — the shared top navigation.
- **`config.js`** (`window.OO_CONFIG`) — Firebase config + `adminEmails`. The
  `apiKey` is a public client identifier, not a secret; access is enforced by
  Firestore rules. See [SETUP.md](SETUP.md).

## Data flow & source of truth

```
data/pyraminx_algs.json        ← single source of truth (version-controlled)
        │  npm run build:sheet  (tools/compile-sheet.mjs)
        ▼
js/sheet.js  (generated: SHEET.ALG / NAME / CNAME / PRES)
        │  npm run build:trainer  (esbuild bundles sheet.js into the trainer)
        ▼
js/trainer.js (generated)      → trainer & solver read the compiled sheet
```

- **`data/pyraminx_algs.json`** is authored by hand and is the one authority.
- **`js/sheet.js` and `js/trainer.js` are generated — do not hand-edit them.**
- The **Algorithms** page reads `pyraminx_algs.json` directly; the trainer and
  solver read the compiled `js/sheet.js`. Alg display notation is normalized by
  the shared `engine.normAlg` (the same function the compiler uses), so every
  surface shows identical algorithms.

## Build & deploy

```
npm install
npm run build       # build:sheet + bundle trainer + stamp asset hashes + check
npm run check       # verify the compiled sheet against the engine (also: npm test)
npm run check:fresh # assert the committed generated files + HTML stamps are fresh
npm run test:engine # engine unit tests
npm run watch:trainer   # esbuild watch (note: does NOT recompile the sheet)
```

Deploy is just the static files (no server). Cache-busting is automatic: every
local `js/`/`css/`/`img` asset is loaded with a content-hash `?v=` query that
`npm run stamp` (part of `npm run build`) rewrites from the file's bytes — there
is no manual version to bump. The generated `js/sheet.js`/`js/trainer.js` are
committed so the site works without a build on the host, and `npm run check:fresh`
guards against committing a stale build.

### Editing the algorithm sheet

Edit `data/pyraminx_algs.json` directly, **or** use the Algorithms page as an
admin: add/remove algs (each is auto-checked that it actually solves the case),
then **Export JSON** to download the updated file, commit it, and `npm run build`.
Admin edits are a per-browser draft until exported — there is no live shared
store.

## Tooling

- **`tools/compile-sheet.mjs`** — compiles the JSON into `js/sheet.js`. Self-checks
  every emitted alg and refuses to write a sheet that fails; a new unparseable alg
  fails the build. Carries forward a small set of cases the JSON doesn't reproduce
  from a committed baseline, **`data/prior-sheet.json`** (not its own output), so a
  from-scratch rebuild is reproducible from version-controlled inputs.
- **`tools/check-sheet.mjs`** — verifier of the shipped `js/sheet.js`, run via
  `npm run check` (also wired into `npm run build`). It shares the engine's keying
  helpers, so it catches data/structural problems but not engine-level keying bugs.
  The known-broken setup algs it tolerates are an explicit allowlist,
  **`data/broken-algs.json`** (read by the compiler and the checker), not a count.
- **`tools/stamp-assets.mjs`** — rewrites each asset's `?v=` query to an 8-hex
  content hash (`npm run stamp`, part of `npm run build`).
- **`tools/check-fresh.mjs`** — re-runs the pipeline and asserts the committed
  generated files + HTML stamps match a clean build (`npm run check:fresh`).
- **`tools/test-engine.mjs`** — focused engine unit tests (`npm run test:engine`).
  Firestore-rules tests live in `test/` (`npm run test:rules`, opt-in: needs the
  Firebase emulator + dev deps).
- **`build.mjs`** — esbuild config for the React trainer.

### Module strategy (why no `"type": "module"`)

The browser scripts in `js/` are classic scripts that attach to `window`
(`OOEngine`, `OOSheet`, …) and are **also** `require()`-d as CommonJS by the
build tools. The tools themselves are ESM and use the `.mjs` extension. Adding
`"type": "module"` would make Node treat the `js/*.js` files as ESM and break
those `require()` calls, so it is intentionally omitted.

/* Pyraminx.net — sheet compiler.
 *
 * Single source of truth: data/pyraminx_algs.json (the user's authored algorithm
 * list). This regenerates the data block of js/sheet.js (SHEET = {ALG,NAME,CNAME,
 * PRES}) so case names, recognition and algorithms all derive from the JSON.
 *
 * How a case is keyed (same coordinate system as js/engine.js and the trainer):
 *   - parse the alg, apply it forward to solved, take the inverse permutation ->
 *     the exact state the alg solves (the "case state"). Self-validated: applying
 *     the alg to that state must return to solved.
 *   - render key  = stateKey(caseState) + "|" + uTwist   (edges + U-twist)
 *   - canonical   = realCanonKey  (lex-min over 3 frame rotations x 3 AUF)
 *
 * Drilled coverage is gated by SHEET.CNAME (trainer buildPools). To avoid any
 * drilling regression: every canonical key the old sheet had is preserved, and
 * subsets the trainer does not yet drill (TL4E-B/-R, Pseudo-V, L4E Building
 * Blocks, the full 184-case L4E) are compiled into a separate SHEET.DEFERRED
 * namespace that buildPools never reads (wired for drilling in a follow-up).
 *
 * Run: npm run build:sheet   (node tools/compile-sheet.mjs [--check])
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

globalThis.window = {};
require(path.join(ROOT, 'js', 'engine.js'));
const E = globalThis.window.OOEngine;
// Carry-forward baseline. Read from a COMMITTED snapshot (data/prior-sheet.json),
// not the compiler's own output (js/sheet.js), so the build is reproducible from
// version-controlled inputs alone — deleting/regenerating js/sheet.js can no longer
// silently drop the cases/algs that are carried forward but not reproduced by the
// JSON. Re-baseline by overwriting prior-sheet.json with a freshly built sheet.
const OLD = require(path.join(ROOT, 'data', 'prior-sheet.json'));
const J = require(path.join(ROOT, 'data', 'pyraminx_algs.json'));
// Explicit allowlist of known-broken setup algs (parse fine but don't solve their
// render key) carried forward only to avoid empty panels. Named manifest, not a
// count: a NEW broken alg that isn't listed here fails the build. Keys are
// `renderKey :: alg` on the SHIPPED (post-normAlg) notation; see check-sheet.mjs.
const BROKEN = require(path.join(ROOT, 'data', 'broken-algs.json'));
const BROKEN_KEYS = new Set(BROKEN.map(b => b.renderKey + ' :: ' + b.algorithm));

// keying + alg→case helpers are the engine's single source of truth.
const { stateKey, realCanonKey, caseStateOf, algSolvesKey, applyMoveK } = E;

// ---- naming ----
const DEFERRED = new Set(['TL4E-B', 'TL4E-R', 'Pseudo-V', 'L4E Building Blocks', 'L4E']);
function subsetLabel(subsetKey, alg) {
  // ML4E (the right/left open-slot angles) is the same family as L4E viewed from
  // another slot. Label its algs as plain "L4E" so the trainer presents them as
  // L4E cases at the chosen slot; the U-twist in the canonical key still keeps
  // genuinely-distinct cases separate (no force-merge by geometry).
  if (subsetKey === 'ML4E') return 'L4E';
  return subsetKey;
}
function labelOf(subsetKey, caseName, alg) {
  const lbl = subsetLabel(subsetKey, alg);
  return lbl === caseName ? caseName : lbl + ' · ' + caseName;
}
const casePart = (name) => String(name).split(' · ').slice(-1)[0];
// Normalize any legacy "ML4E-R/-L · X" name from the carry-forward baseline to
// the plain "L4E · X" prefix, matching subsetLabel above, so the ML4E label is
// gone everywhere (JSON-primary AND carried-forward names) and same-named cases
// combine in the trainer. Case identity (the U-twist) is untouched.
const normName = (name) => String(name).replace(/^ML4E(?:-[RL])? · /, 'L4E · ');

// ---- pass 1: group every alg by the canonical key it actually solves ----
const byKey = {}; // canon -> { items:[{alg, renderKey, label, deferred}] }
const report = { algs: 0, skipped: [], centerCollisions: 0, mislabels: 0, misfiled: [], renames: [], carried: 0, primaryNew: 0, deferredKeys: 0, keptBroken: 0 };
function collect(subsetKey, caseName, alg) {
  report.algs++;
  const cs = caseStateOf(alg.alg);
  if (!cs) { report.skipped.push(subsetKey + ' / ' + caseName + ': ' + alg.alg); return; }
  const renderKey = stateKey(cs) + '|' + cs.u;
  const canon = realCanonKey(cs, cs.u);
  const label = labelOf(subsetKey, caseName, alg);
  (byKey[canon] = byKey[canon] || { items: [] }).items.push({ alg: alg.alg, renderKey, label, deferred: DEFERRED.has(subsetKey) });
}
for (const [sn, s] of Object.entries(J.subsets)) for (const c of s.cases) for (const a of c.algs) collect(sn, c.name, a);
for (const [sn, s] of Object.entries(J.other_subsets)) for (const c of s.cases) for (const a of c.algs) collect(sn, c.name, a);

// ---- pass 2: resolve names + emit into MAIN and DEFERRED namespaces ----
const MAIN = { ALG: {}, NAME: {}, CNAME: {}, PRES: {} };
const DEF = { ALG: {}, NAME: {}, CNAME: {}, PRES: {} };

function resolveName(canon, items) {
  const votes = {};
  for (const it of items) votes[it.label] = (votes[it.label] || 0) + 1;
  const top = Object.entries(votes).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
  const old = normName(OLD.CNAME[canon]);
  if (OLD.CNAME[canon]) {
    if (votes[old]) return old;                          // old label still supported
    if (casePart(old) === casePart(top)) return old;     // same case, prefix-only change -> keep old
  }
  return top;
}
function emit(target, canon, items, name) {
  for (const it of items) {
    const arr = (target.ALG[it.renderKey] = target.ALG[it.renderKey] || []);
    if (!arr.some(r => r[0] === it.alg)) arr.push([it.alg, name]);
    target.NAME[it.renderKey] = name;
  }
  target.CNAME[canon] = name;
  const pres = (target.PRES[canon] = target.PRES[canon] || []);
  for (const it of items) {
    const [sk, tw] = it.renderKey.split('|');
    if (!pres.some(p => p[0] === sk && p[1] === +tw)) pres.push([sk, +tw, name]);
  }
}
// (a) emit JSON primary algs; route deferred algs to the DEFERRED namespace.
for (const [canon, rec] of Object.entries(byKey)) {
  const primary = rec.items.filter(it => !it.deferred);
  const deferred = rec.items.filter(it => it.deferred);

  if (primary.length) {
    const name = resolveName(canon, primary);
    emit(MAIN, canon, primary, name);
    if (!OLD.CNAME[canon]) report.primaryNew++;
    else if (OLD.CNAME[canon] !== name) report.renames.push(canon + ' :: ' + OLD.CNAME[canon] + ' -> ' + name);
    // A real (non-tautological) check: an alg authored under one case but
    // grouped under a different CASE (not just an ML4E-L/-R prefix flip) is a
    // genuine mis-file — surface it. Advisory only; it does not fail the build.
    for (const it of primary) if (it.label !== name) {
      report.mislabels++;
      if (casePart(it.label) !== casePart(name)) report.misfiled.push(casePart(it.label) + ' → ' + casePart(name) + '   [' + it.alg + ']');
    }
  }
  if (deferred.length) {
    if (rec.items.some(it => !it.deferred) || OLD.CNAME[canon]) report.centerCollisions += deferred.length;
    emit(DEF, canon, deferred, resolveName(canon, deferred));
  }
}

// (b) carry forward EVERY old presentation/alg the JSON primary didn't reproduce,
// so MAIN.ALG superset OLD.ALG -> bar-side/AUF coverage cannot regress. Carried
// algs adopt the canonical's resolved name (JSON renames still apply); canonicals
// with no JSON-primary alg keep their old name.
for (const [canon, pres] of Object.entries(OLD.PRES)) {
  const hadPrimary = MAIN.CNAME[canon] != null;
  if (!hadPrimary) { MAIN.CNAME[canon] = normName(OLD.CNAME[canon]); report.carried++; }
  const name = MAIN.CNAME[canon];
  const presArr = (MAIN.PRES[canon] = MAIN.PRES[canon] || []);
  // valid = old algs that actually solve their presentation (drop OLD's broken,
  // fake-coverage entries). If a canonical has NO primary alg and NO valid old
  // alg, it would be left empty -> keep OLD's entries unfiltered (status quo),
  // so the panel is never emptier than before.
  for (const [sk, tw] of pres) {
    const rk = sk + '|' + tw;
    const valid = (OLD.ALG[rk] || []).filter(([alg]) => algSolvesKey(alg, rk));
    if (!valid.length) continue;
    if (!presArr.some(q => q[0] === sk && q[1] === tw)) presArr.push([sk, tw, name]);
    const arr = (MAIN.ALG[rk] = MAIN.ALG[rk] || []);
    for (const [alg] of valid) if (!arr.some(r => r[0] === alg)) arr.push([alg, name]);
    MAIN.NAME[rk] = name;
  }
}

// (c) final live-view guarantee: the trainer's panel scans a state's 3 AUF. For
// any state OLD showed algs at where NEW (after dropping broken entries) would
// now show nothing, re-carry OLD's algs unfiltered so no panel goes emptier than
// before. In practice this only rescues a few setup-alg presentations the JSON
// has no clean alg for.
const auf3 = (rk) => {
  const [ek, tw] = rk.split('|');
  const st = { e: ek.split(',').flatMap(t => [+t[0], +t[1]]), c: [0, 0, 0] };
  const out = [];
  for (let k = 0; k < 3; k++) { out.push(stateKey(st) + '|' + ((+tw + k) % 3)); applyMoveK(st, 'U', false); }
  return out;
};
for (const rk of Object.keys(OLD.ALG)) {
  if (!(OLD.ALG[rk] || []).length) continue;
  if (auf3(rk).some(k => (MAIN.ALG[k] || []).length)) continue; // NEW already covers this state
  const canon = realCanonKey({ e: rk.split('|')[0].split(',').flatMap(t => [+t[0], +t[1]]), c: [0, 0, 0] }, +rk.split('|')[1]);
  const name = MAIN.CNAME[canon] || normName(OLD.CNAME[canon]);
  if (MAIN.CNAME[canon] == null) MAIN.CNAME[canon] = name;
  const [sk, tw] = rk.split('|');
  (MAIN.PRES[canon] = MAIN.PRES[canon] || []);
  if (!MAIN.PRES[canon].some(p => p[0] === sk && p[1] === +tw)) MAIN.PRES[canon].push([sk, +tw, name]);
  MAIN.ALG[rk] = (OLD.ALG[rk] || []).map(([a]) => [a, name]);
  MAIN.NAME[rk] = name;
  report.keptBroken += MAIN.ALG[rk].length;
}
report.deferredKeys = Object.keys(DEF.CNAME).length;
MAIN.DEFERRED = DEF;

// ---- normalize displayed alg notation (engine.normAlg: expand S/H, R R -> R2)
// so the bundled sheet/trainer show the same clean notation as the algorithms
// page (which applies the same shared function to the JSON). Dedupe per key.
for (const SH of [MAIN, DEF]) {
  for (const rk of Object.keys(SH.ALG)) {
    const seen = new Set(), out = [];
    for (const [alg, name] of SH.ALG[rk]) { const n = E.normAlg(alg); if (!seen.has(n)) { seen.add(n); out.push([n, name]); } }
    SH.ALG[rk] = out;
  }
}

// ---- self-check: every emitted MAIN alg solves its render key (up to rotation),
// except the explicitly-allowlisted broken setup algs in data/broken-algs.json
// (kept to avoid empty panels). A failing alg that ISN'T allowlisted fails the
// build; an allowlisted entry that no longer fails is just a stale-manifest note.
const failingBroken = [];
for (const [rk, algs] of Object.entries(MAIN.ALG))
  for (const [alg] of algs) if (!algSolvesKey(alg, rk)) failingBroken.push(rk + ' :: ' + alg);
const unexpectedBroken = failingBroken.filter(k => !BROKEN_KEYS.has(k));
const staleBroken = [...BROKEN_KEYS].filter(k => !failingBroken.includes(k));
const selfCheckOk = unexpectedBroken.length === 0;
if (!selfCheckOk) {
  console.error('SELF-CHECK FAILED: ' + unexpectedBroken.length + ' MAIN alg(s) do not solve their key and are not in data/broken-algs.json:');
  unexpectedBroken.forEach(k => console.error('   BROKEN ' + k));
  process.exitCode = 1;
}
if (staleBroken.length) {
  console.warn('NOTE: ' + staleBroken.length + ' allowlisted broken alg(s) no longer fail — data/broken-algs.json may be stale:');
  staleBroken.forEach(k => console.warn('   STALE ' + k));
}

// ---- every failure condition, computed BEFORE the write so all of them gate it
// (they are each reported in detail further down). A new unparseable alg or a
// coverage regression must leave the committed sheet untouched, exactly like a
// self-check failure — not fail the build after already overwriting it.
// Add an entry to SKIP_ALLOW only to deliberately tolerate a known-bad alg.
const SKIP_ALLOW = new Set([]);
const unexpectedSkips = report.skipped.filter(s => !SKIP_ALLOW.has(s));
const gaps = Object.keys(OLD.CNAME).filter(k => !MAIN.CNAME[k]);
const okToWrite = selfCheckOk && !unexpectedSkips.length && !gaps.length;

// ---- write js/sheet.js (replace only the SHEET data line) ----
// Never overwrite the live data file on a failed compile — only write a sheet
// that passed every gate above. (--check is a dry run and never writes.)
const SHEET_PATH = path.join(ROOT, 'js', 'sheet.js');
const check = process.argv.includes('--check');
if (!check && okToWrite) {
  const src = fs.readFileSync(SHEET_PATH, 'utf8');
  const lines = src.split(/\r?\n/);
  const idx = lines.findIndex(l => /^\s*const SHEET\s*=\s*\{/.test(l));
  if (idx < 0) throw new Error('could not find SHEET declaration in js/sheet.js');
  // deterministic serialization: sort object keys recursively (arrays untouched)
  // so the output is byte-stable across rebuilds regardless of insertion order.
  const sortedStringify = (obj) => JSON.stringify(obj, (k, v) =>
    (v && typeof v === 'object' && !Array.isArray(v))
      ? Object.fromEntries(Object.keys(v).sort().map(kk => [kk, v[kk]]))
      : v);
  lines[idx] = '  const SHEET = ' + sortedStringify(MAIN) + ';';
  fs.writeFileSync(SHEET_PATH, lines.join('\n'));
} else if (!check && !okToWrite) {
  console.error('NOT writing js/sheet.js — compile failed: '
    + [selfCheckOk ? '' : 'self-check',
       unexpectedSkips.length ? unexpectedSkips.length + ' unparseable alg(s)' : '',
       gaps.length ? gaps.length + ' coverage gap(s)' : ''].filter(Boolean).join(', ') + '.');
}

// ---- report ----
const distinctMain = new Set(Object.values(MAIN.CNAME)).size;
console.log(check ? '== compile (--check, not written) ==' : '== compiled js/sheet.js ==');
console.log('algs read:', report.algs, '| skipped (unparseable):', report.skipped.length);
report.skipped.forEach(s => console.log('   SKIP', s));
// Build hardening: a NEW unparseable alg is silent data loss from the source of
// truth, so any skipped (unparseable) alg fails the build (and gated the write above).
if (unexpectedSkips.length) {
  process.exitCode = 1;
  console.error('*** ' + unexpectedSkips.length + ' UNEXPECTED unparseable alg(s) — failing build (fix the JSON or extend parseAlg):');
  unexpectedSkips.forEach(s => console.error('   SKIP ' + s));
}
console.log('MAIN  keys  ALG:', Object.keys(MAIN.ALG).length, 'NAME:', Object.keys(MAIN.NAME).length,
  'CNAME:', Object.keys(MAIN.CNAME).length, 'PRES:', Object.keys(MAIN.PRES).length, '| distinct names:', distinctMain);
console.log('DEFERRED keys ALG:', Object.keys(DEF.ALG).length, 'CNAME:', Object.keys(DEF.CNAME).length);
console.log('carried forward (old keys w/o JSON primary):', report.carried);
console.log('primary-new cases (added to drilled surface):', report.primaryNew);
console.log('center-twist collisions (deferred algs routed to DEFERRED):', report.centerCollisions);
console.log('within-primary mislabeled algs (filed under the case they solve):', report.mislabels);
console.log('OLD broken algs kept (only where a canonical would otherwise be empty):', report.keptBroken);
// Advisory: algs authored under a different CASE than they actually solve. Not a
// build failure (the alg still ships under the case it geometrically solves), but
// each is a likely authoring typo worth a look — the tautological self-check below
// can't catch these.
if (report.misfiled.length) {
  console.log('\nADVISORY: ' + report.misfiled.length + ' alg(s) authored under a different case than they solve:');
  report.misfiled.forEach(s => console.log('   MISFILED ' + s));
}

// coverage guarantee vs old (gaps computed above, before the write gate)
console.log('\nself-check: every emitted alg solves its render key, except', failingBroken.length, 'allowlisted broken (' + BROKEN_KEYS.size + ' in manifest) ->',
  selfCheckOk ? 'PASS' : 'FAIL');
console.log('COVERAGE: old CNAME keys', Object.keys(OLD.CNAME).length, '| gaps in MAIN:', gaps.length,
  gaps.length ? '  *** REGRESSION ***' : '  (none)');
console.log('intentional renames vs old (' + report.renames.length + '):');
report.renames.forEach(r => console.log('   ', r));
if (gaps.length) { process.exitCode = 1; gaps.slice(0, 20).forEach(k => console.log('   GAP', k, OLD.CNAME[k])); }

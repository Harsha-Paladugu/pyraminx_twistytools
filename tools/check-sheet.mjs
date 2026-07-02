/* Pyraminx.net — sheet verifier (no backup needed).
 *
 * Checks the compiled js/sheet.js against js/engine.js, independent of the
 * compiler, so you can trust the data after any JSON edit + rebuild:
 *   1. every alg in SHEET.ALG actually solves the state at its render key
 *      (up to a whole-puzzle rotation);
 *   2. structural integrity — NAME present for every ALG key, PRES <-> ALG and
 *      CNAME consistent, render keys canonicalize to their CNAME entry;
 *   3. the same for SHEET.DEFERRED.
 *
 * Run: node tools/check-sheet.mjs   (exit 0 = OK, 1 = problems)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = {};
require(path.join(ROOT, 'js', 'engine.js'));
const E = globalThis.window.OOEngine;
const { SHEET } = require(path.join(ROOT, 'js', 'sheet.js'));
// keying + alg→case helpers come from the engine (single source of truth); this
// verifier checks the shipped js/sheet.js data against them.
const { keyToState, realCanonKey, algSolvesKey } = E;
// Explicit allowlist of known-broken setup algs (parse fine but don't solve their
// render key), kept only to avoid empty panels. The shipped MAIN.ALG may contain
// exactly these and no other non-solving algs.
const BROKEN = require(path.join(ROOT, 'data', 'broken-algs.json'));
const BROKEN_KEYS = new Set(BROKEN.map(b => b.renderKey + ' :: ' + b.algorithm));

function check(SH, label) {
  let tot = 0, noname = 0, badcanon = 0; const samples = [], nosolveKeys = [];
  for (const [rk, algs] of Object.entries(SH.ALG)) {
    if (SH.NAME[rk] == null) noname++;
    for (const [alg] of algs) {
      tot++;
      if (!algSolvesKey(alg, rk)) { nosolveKeys.push(rk + ' :: ' + alg); if (samples.length < 8) samples.push(rk + ' :: ' + alg); }
    }
    const st = keyToState(rk), canon = realCanonKey(st, st.u);
    if (!SH.CNAME[canon]) badcanon++;
  }
  // PRES <-> ALG consistency
  let presOrphan = 0;
  for (const [canon, pres] of Object.entries(SH.PRES))
    for (const [sk, tw] of pres) if (!SH.ALG[sk + '|' + tw]) presOrphan++;
  console.log(`[${label}] ALG entries: ${tot} | NOSOLVE: ${nosolveKeys.length} | missing NAME: ${noname} | render key not in CNAME: ${badcanon} | PRES without ALG: ${presOrphan}`);
  samples.forEach(s => console.log('    NOSOLVE ' + s));
  return { nosolve: nosolveKeys.length, nosolveKeys, noname, badcanon, presOrphan };
}

const main = check(SHEET, 'MAIN');
const def = check(SHEET.DEFERRED, 'DEFERRED');
console.log(`\nMAIN: ${Object.keys(SHEET.CNAME).length} cases / ${new Set(Object.values(SHEET.CNAME)).size} names  |  DEFERRED: ${Object.keys(SHEET.DEFERRED.CNAME).length} cases`);

// MAIN may keep the explicitly-allowlisted broken setup-alg presentations
// (data/broken-algs.json) and NOTHING else that fails to solve. A non-solving alg
// not on the allowlist is a real problem; an allowlist entry that no longer ships
// is just a stale-manifest note (harmless — fewer broken algs). DEFERRED allows none.
const unexpectedBroken = main.nosolveKeys.filter(k => !BROKEN_KEYS.has(k));
const staleBroken = [...BROKEN_KEYS].filter(k => !main.nosolveKeys.includes(k));
unexpectedBroken.forEach(k => console.error('    UNEXPECTED BROKEN ' + k));
staleBroken.forEach(k => console.warn('    STALE allowlist entry (no longer present): ' + k));
const problems = unexpectedBroken.length || main.noname || main.badcanon || main.presOrphan
  || def.nosolve || def.noname || def.badcanon || def.presOrphan;
console.log(problems ? '\n*** CHECK FAILED ***' : `\nCHECK OK (MAIN has ${main.nosolve} allowlisted kept-broken setup algs; ${BROKEN_KEYS.size} in manifest)`);
process.exitCode = problems ? 1 : 0;

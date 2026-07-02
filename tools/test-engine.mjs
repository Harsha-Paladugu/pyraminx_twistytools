/* Pyraminx.net — engine unit tests.
 *
 * Focused invariants for js/engine.js (window.OOEngine): alg parsing/notation,
 * mirror + inverse symmetry, canonicalization stability, and the optimal BFS
 * solver. Dependency-light: loads the engine exactly like the other tools do
 * (globalThis.window = {}; require js/engine.js; const E = window.OOEngine).
 *
 * Run: node tools/test-engine.mjs   (exit 0 = OK, 1 = a test failed)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import assert from 'node:assert';
import { buildDist } from './lib/bfs-dist.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = {};
require(path.join(ROOT, 'js', 'engine.js'));
const E = globalThis.window.OOEngine;

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('✓ ' + name); passed++; }
  catch (e) { console.log('✗ ' + name + '\n    ' + (e && e.message)); failed++; }
}

// shared symmetry tables (same as applyParsed callers build)
const syms = E.buildSyms();
const rotBy = E.makeFrames(syms);
const applied = (algStr, state) => E.applyParsed(E.parseAlg(algStr), state || E.solved(), syms, rotBy);

// ---- notation: parseAlg / normAlg ----
test('parseAlg: clean alg parses to one token per move', () => {
  const p = E.parseAlg('R U L');
  assert(Array.isArray(p) && p.length === 3, 'expected 3 tokens');
  assert(p.every(t => t.kind === 'move'), 'all should be moves');
});
test('parseAlg: unparseable token yields null', () => {
  assert.strictEqual(E.parseAlg('R X'), null);
});
test('parseAlg: tip moves are dropped, not rejected', () => {
  const p = E.parseAlg('R u L');           // lowercase u is a tip
  assert.strictEqual(E.countMoves(p), 2, 'tip should be ignored');
});
test('normAlg: collapses adjacent identical turns (R R -> R2)', () => {
  assert.strictEqual(E.normAlg('R R U'), 'R2 U');
});
test("normAlg: collapses adjacent primes (R' R' -> R2')", () => {
  assert.strictEqual(E.normAlg("R' R' U"), "R2' U");
});
test('normAlg: expands the S macro', () => {
  assert.strictEqual(E.normAlg('S U2'), "R' L R L' U2");
});

// ---- mirror (LR) ----
test("mirrorAlg: R -> L', L -> R'", () => {
  assert.strictEqual(E.mirrorAlg('R'), "L'");
  assert.strictEqual(E.mirrorAlg('L'), "R'");
});
test('mirrorAlg: applied twice is the identity (no doubles)', () => {
  const a = "R L U B R' U'";
  assert.strictEqual(E.mirrorAlg(E.mirrorAlg(a)), a);
});
test('mirrorAlg: mirrored solution solves the mirrored state', () => {
  const a = 'R U L B';
  const scr = applied(a);                          // state the alg reaches from solved
  // mirror the WHOLE-PUZZLE LR reflection of both alg and state and check it still solves
  const m = E.buildSyms().mirrors[0];
  const mScr = E.applySym(m, E.applyParsed(E.parseAlg(a), E.solved(), syms, rotBy));
  // a mirrored alg applied to the mirrored solved state reaches the mirrored reached state
  const reached = E.applyParsed(E.parseAlg(E.mirrorAlg(a)), E.applySym(m, E.solved()), syms, rotBy);
  assert(E.eq(reached, mScr), 'mirror(alg) on mirror(start) should equal mirror(end)');
  assert(scr, 'sanity');
});

// ---- invert ----
test("invertAlg: R L U -> U' L' R'", () => {
  assert.strictEqual(E.invertAlg('R L U'), "U' L' R'");
});
test('invertAlg: alg then its inverse returns to solved', () => {
  const a = "R U L B U' R'";
  const scr = applied(a);
  const back = E.applyParsed(E.parseAlg(E.invertAlg(a)), scr, syms, rotBy);
  assert(E.eq(back, E.solved()), 'inverse should undo the alg');
});

// ---- countMoves ----
test('countMoves: ignores rotations, counts moves (incl. doubles)', () => {
  assert.strictEqual(E.countMoves(E.parseAlg("R [u] L U2 [l]")), 3);
});

// ---- state plumbing ----
test('copy/eq: copy is equal but a distinct object/array', () => {
  const a = E.applyMoveIdx(E.solved(), 0);  // U
  const b = E.copy(a);
  assert(E.eq(a, b) && a !== b && a.e !== b.e);
});
test('idx/unidx: round-trip preserves the state', () => {
  const s = E.applyMoveIdx(E.applyMoveIdx(E.solved(), 2), 6); // L then B
  assert(E.eq(s, E.unidx(E.idx(s))));
});

// ---- case helpers ----
test('caseStateOf: a valid alg yields a self-consistent case state', () => {
  const cs = E.caseStateOf('R U L');
  assert(cs !== null, 'caseStateOf should solve cleanly');
  const rk = E.stateKey(cs) + '|' + cs.u;
  assert.strictEqual(E.algSolvesKey('R U L', rk), true, 'alg should solve its own case key');
});
test('algSolvesKey: empty alg solves the solved key; junk does not', () => {
  const solvedKey = E.stateKey(E.solved()) + '|0';
  assert.strictEqual(E.algSolvesKey('', solvedKey), true);
  assert.strictEqual(E.algSolvesKey('R X', solvedKey), false);  // unparseable
});

// ---- prependAUF (shared pre-AUF folding) ----
test('prependAUF: folds into a leading U turn', () => {
  assert.strictEqual(E.prependAUF(1, "U R L'"), "U' R L'");   // U + U = U2 = U'
  assert.strictEqual(E.prependAUF(2, 'U R'), 'R');            // U' + U cancels
});
test('prependAUF: p=0 is a no-op; bare prepend otherwise', () => {
  assert.strictEqual(E.prependAUF(0, "R U R'"), "R U R'");
  assert.strictEqual(E.prependAUF(2, "R U R'"), "U' R U R'");
});

// ---- canonicalization (realCanonKey) ----
function scrambledEdges() {
  // edges-only keying state (the coordinate realCanonKey operates on)
  const s = { e: E.solved().e.slice(), c: [0, 0, 0] };
  E.applyMoveK(s, 'R', false); E.applyMoveK(s, 'U', false);
  E.applyMoveK(s, 'L', true); E.applyMoveK(s, 'B', false);
  return s;
}
test('realCanonKey: deterministic for a fixed state', () => {
  const s = scrambledEdges();
  assert.strictEqual(E.realCanonKey(s, 1), E.realCanonKey(s, 1));
});
test('realCanonKey: invariant under a frame rotation of the edges', () => {
  const s = scrambledEdges();
  const k = E.realCanonKey(s, 0);
  const s2 = { e: s.e.slice() };
  E.rotateFrame(s2, 1);                              // one of the 3 rotations it already folds over
  assert.strictEqual(E.realCanonKey(s2, 0), k);
});
test('realCanonKey: invariant under AUF (U-keying move + twist shift)', () => {
  const s = scrambledEdges();
  const k = E.realCanonKey(s, 0);
  const s3 = { e: s.e.slice(), c: [0, 0, 0] };
  E.applyMoveK(s3, 'U', false);
  assert.strictEqual(E.realCanonKey(s3, 1), k);       // (U·e, t+1) is in the same orbit
});

// ---- the optimal BFS solver ----
const dist = buildDist(E);   // shared tools/lib builder; built once for both tests
test('optimalSolution: solves a scramble in exactly its optimal length', () => {
  const scr = applied("R U L B U' R'");
  const d = dist[E.idx(scr)];
  assert(d > 0, 'scramble should be unsolved');
  const sol = E.optimalSolution(scr, dist, false);
  assert.strictEqual(E.countMoves(E.parseAlg(sol)), d, 'solution length should equal the distance');
  const back = E.applyParsed(E.parseAlg(sol), scr, syms, rotBy);
  assert(E.eq(back, E.solved()), 'applying the solution should solve the scramble');
});
test('optimalScramble: inverse of an optimal solution; re-solves to solved', () => {
  const st = applied('R U L B');
  const scr = E.optimalScramble(st, dist, false);
  const reached = E.applyParsed(E.parseAlg(scr), E.solved(), syms, rotBy);
  assert(E.eq(reached, st), 'scramble should reach the target state');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed > 0 ? 1 : 0;

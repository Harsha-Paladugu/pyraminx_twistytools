/* Pyraminx.net — shared BFS table cache (window.OOTables).
 *
 * The OO census (js/oo.js) and the method solver (js/solver.js) both need the
 * BFS distance table over the full no-tips state space; the census also needs the
 * canonical-class tables (reps + depths). These used to be duplicated in both
 * files AND cached under one IndexedDB key ('oo-tables-v1') with two different
 * value shapes ({dist} vs {dist,reps,depths}). This module is the single owner of
 * that cache, with SEPARATE keys per shape so they can't collide:
 *
 *   oo-dist-v1     -> { dist }                  (built by either page, reused by both)
 *   oo-classes-v1  -> { reps, depths }          (census only)
 *
 * Loaded as a classic browser script before js/oo.js / js/solver.js. The engine
 * (window.OOEngine) is passed in, so this file has no load-order dep on it beyond
 * being called after the engine exists.
 *
 * report(stage, n, total): optional progress callback; stage is 'cache' | 'bfs' |
 *   'classes'. tick: optional async yield (so the boot UI can paint).
 */
(function () {
  const module = { exports: {} };
  const DB_NAME = 'pyraminx-oo', STORE = 't';
  const KEY_DIST = 'oo-dist-v1';        // { dist: ArrayBuffer }
  const KEY_CLASSES = 'oo-classes-v1';  // { reps: ArrayBuffer, depths: ArrayBuffer }
  const GEOM_SCHEMA_VERSION = 'geom-v2';

  function openDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function idbGet(key) {
    if (!('indexedDB' in window)) return null;
    try {
      const db = await openDB();
      const v = await new Promise((res, rej) => {
        const tx = db.transaction(STORE).objectStore(STORE).get(key);
        tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error);
      });
      db.close();
      return v || null;
    } catch (e) { return null; }
  }
  async function idbPut(key, payload) {
    if (!('indexedDB' in window)) return;
    try {
      const db = await openDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(payload, key);
        tx.oncomplete = res; tx.onerror = () => rej(tx.error);
      });
      db.close();
    } catch (e) { /* cache is best-effort */ }
  }

  // Geometry/schema fingerprint for cache reuse. Bump this whenever engine
  // geometry/state indexing/canonicalization changes so stale tables rebuild.
  function geomFp(E) {
    return GEOM_SCHEMA_VERSION;
  }

  // BFS over the full state space -> Int8Array distance table. Cached under KEY_DIST.
  async function loadOrBuildDist(E, report, tick) {
    const fp = geomFp(E);
    const cached = await idbGet(KEY_DIST);
    if (cached && cached.dist && cached.fp === fp) { if (report) report('cache', 1, 1); return new Int8Array(cached.dist); }
    const dist = new Int8Array(E.NSLOTS).fill(-1);
    let frontier = new Uint32Array([E.idx(E.solved())]);
    dist[frontier[0]] = 0;
    let d = 0, seen = 1;
    while (frontier.length) {
      const next = [];
      for (let fi = 0; fi < frontier.length; fi++) {
        const s = E.unidx(frontier[fi]);
        for (let m = 0; m < 8; m++) {
          const t2 = E.copy(s); E.applyMoveIdx(t2, m);
          const ix = E.idx(t2);
          if (dist[ix] === -1) { dist[ix] = d + 1; next.push(ix); }
        }
        if ((fi & 8191) === 8191) { if (report) report('bfs', seen + next.length, 933120); if (tick) await tick(); }
      }
      d++; seen += next.length;
      frontier = Uint32Array.from(next);
      if (report) report('bfs', seen, 933120);
      if (tick) await tick();
    }
    idbPut(KEY_DIST, { dist: dist.buffer, fp });
    return dist;
  }

  // Canonical-class enumeration (requires dist) -> { reps:Uint32Array, depths:Uint8Array }.
  // Cached under KEY_CLASSES.
  async function loadOrBuildClassTables(E, dist, report, tick) {
    const fp = geomFp(E);
    const cached = await idbGet(KEY_CLASSES);
    if (cached && cached.reps && cached.depths && cached.fp === fp) {
      if (report) report('cache', 1, 1);
      return { reps: new Uint32Array(cached.reps), depths: new Uint8Array(cached.depths) };
    }
    const canon = E.makeCanon(E.buildSyms());
    const reps = [], depths = [];
    for (let i = 0; i < E.NSLOTS; i++) {
      if (dist[i] < 0) continue;
      const s = E.unidx(i);
      if (canon(s) === i) { reps.push(i); depths.push(dist[i]); }
      if ((i & 65535) === 65535) { if (report) report('classes', i, E.NSLOTS); if (tick) await tick(); }
    }
    const repsArr = Uint32Array.from(reps), depthsArr = Uint8Array.from(depths);
    if (report) report('classes', E.NSLOTS, E.NSLOTS);
    idbPut(KEY_CLASSES, { reps: repsArr.buffer, depths: depthsArr.buffer, fp });
    return { reps: repsArr, depths: depthsArr };
  }

  module.exports = { idbGet, idbPut, loadOrBuildDist, loadOrBuildClassTables, KEY_DIST, KEY_CLASSES };
  window.OOTables = module.exports;
})();

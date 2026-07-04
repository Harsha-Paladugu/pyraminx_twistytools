/* Pyraminx.net — Method solver core: search, methods, ergonomics scoring. */
(function(){const module={exports:{}};
/* Pyraminx OO — method solver core (no DOM; testable in node).
   Methods = intermediate target sets (ported from the trainer's pool semantics):
   - L4E: V at home pair (DL+DR solved), LRB centers solved, any U twist. Phase-1 cap 7.
   - ML4E (multi-angle): V at the [u]/[u'] pairs (DF+DL or DF+DR). Cap 7.
   - TL4E-B: home V with the B center twisted. Cap 6.
   - L5E: >=1 bottom edge solved + LRB centers, any angle (multi-angle built in). Cap 4.
   - Pseudo V L4E / ML4E: V composed with a client-chosen inverse pre-move (offsets, <=4 moves). Cap 5.
   A solution counts if executed sequence = reduce(P . A) where P reaches an enabled target
   within its cap (counted pre-cancellation), A solves the rest with length <= dist + slack
   ("human-findable" finishes), and <= maxCancel moves vanish at the junction. */
/* ---------- method registry (module-level: no E/dist dependency) ---------- */
// Names are the display labels used by the solver page and the tuning lab;
// METHOD_PRIORITY is the tie-break order when picking a representative
// decomposition (solver.js primaryMethod, solver-lab).
const METHOD_DEFS = {
  l4e:    { name: 'L4E',          cap: 7 },
  ml4e:   { name: 'ML4E',         cap: 7 },
  tl4eb:  { name: 'TL4E-B',       cap: 6 },
  l5e:    { name: 'L5E',          cap: 4 },
  psl4e:  { name: 'Pseudo L4E',   cap: 5 },
  psml4e: { name: 'Pseudo ML4E',  cap: 5 },
};
const METHOD_PRIORITY = ['l4e', 'ml4e', 'tl4eb', 'l5e', 'psl4e', 'psml4e'];

function makeSolverCore(E, dist) {
  const MOVES = E.MOVES; // ['U',"U'",'L',"L'",'R',"R'",'B',"B'"]
  const sigOf = s => (E.idx(s) - (E.idx(s) % 3)) / 3; // no-u signature
  // symmetry tables: built ONCE per core and shared by buildRotations and
  // ergoScore (and exposed on the API so callers don't rebuild their own)
  const syms = E.buildSyms();
  const rotBy = E.makeFrames(syms);

  /* ---------- sequence reduction (cancellation) ---------- */
  // tokens: ints 0..7; same corner merges mod 3 with cascade
  function reduceSeq(seq) {
    const out = [];
    for (const m of seq) {
      if (out.length) {
        const p = out[out.length - 1];
        if ((p >> 1) === (m >> 1)) {
          const q = ((p & 1 ? 2 : 1) + (m & 1 ? 2 : 1)) % 3;
          out.pop();
          if (q) out.push((m & ~1) | (q === 2 ? 1 : 0));
          continue;
        }
      }
      out.push(m);
    }
    // cascade once more in case a merge exposed a new pair
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i + 1 < out.length; i++) {
        if ((out[i] >> 1) === (out[i + 1] >> 1)) {
          const q = ((out[i] & 1 ? 2 : 1) + (out[i + 1] & 1 ? 2 : 1)) % 3;
          const rep = q ? [(out[i] & ~1) | (q === 2 ? 1 : 0)] : [];
          out.splice(i, 2, ...rep);
          changed = true; break;
        }
      }
    }
    return out;
  }

  /* ---------- pools (single source = engine.enumFreeSlots) ---------- */
  // states: listed slots scrambled (even perm, even flips), rest solved, c=[0,0,0], u=0
  const pool = E.enumFreeSlots;
  const HOME_FREE = [0, 1, 2, 3];                       // V at DL+DR
  const ANGLE_FREE = [[0, 1, 2, 4], [0, 1, 2, 5]];      // V at DF+DR / DF+DL
  const L5E_FREE = [[0, 1, 2, 3, 4], [0, 1, 2, 3, 5], [0, 1, 2, 4, 5]];

  /* ---------- composition (port of the trainer's Lh) + inverse premove ---------- */
  function compose(A, B) {
    const o = { e: new Array(12), c: [(A.c[0] + B.c[0]) % 3, (A.c[1] + B.c[1]) % 3, (A.c[2] + B.c[2]) % 3], u: ((A.u || 0) + (B.u || 0)) % 3 };
    for (let i = 0; i < 6; i++) {
      const p = A.e[i * 2];
      o.e[i * 2] = B.e[p * 2];
      o.e[i * 2 + 1] = B.e[p * 2 + 1] ^ A.e[i * 2 + 1];
    }
    return o;
  }
  function invPremoveState(tokens) { // tokens: [{f,q}] — state of the INVERSE alg applied to solved
    const s = E.solved();
    for (let n = tokens.length - 1; n >= 0; n--) {
      const reps = (3 - tokens[n].q) % 3;
      for (let k = 0; k < reps; k++) E.move(s, tokens[n].f, false);
    }
    return s;
  }
  function parseOffset(str) { // "L", "R U", "L2 R'" — plain moves, <=4
    const toks = String(str).trim().split(/\s+/).filter(Boolean);
    if (!toks.length) return null;
    const out = [];
    for (const t of toks) {
      const m = t.match(/^([URLB])(2)?(')?$/);
      if (!m) return null;
      const q = (((m[2] ? 2 : 1) * (m[3] ? -1 : 1)) % 3 + 3) % 3;
      if (q) out.push({ f: m[1], q });
    }
    if (!out.length || out.length > 4) return null;
    return out;
  }

  function buildTargets(cfg) {
    // cfg: { methods:{id:bool}, caps:{id:int}, offsets:[token[]] }
    const sets = {}; // id -> Set of sigs
    const add = (id, states) => { const S = sets[id] || (sets[id] = new Set()); for (const st of states) S.add(sigOf(st)); };
    if (cfg.methods.l4e) add('l4e', pool(HOME_FREE));
    if (cfg.methods.ml4e) for (const f of ANGLE_FREE) add('ml4e', pool(f));
    if (cfg.methods.tl4eb) for (const t of [1, 2]) add('tl4eb', pool(HOME_FREE).map(s => ({ e: s.e, c: [0, 0, t], u: 0 })));
    if (cfg.methods.l5e) for (const f of L5E_FREE) add('l5e', pool(f));
    if ((cfg.methods.psl4e || cfg.methods.psml4e) && cfg.offsets.length) {
      const invs = cfg.offsets.map(invPremoveState);
      if (cfg.methods.psl4e) for (const inv of invs) add('psl4e', pool(HOME_FREE).map(v => compose(v, inv)));
      if (cfg.methods.psml4e) for (const inv of invs) for (const f of ANGLE_FREE) add('psml4e', pool(f).map(v => compose(v, inv)));
    }
    const ids = Object.keys(sets);
    const capMax = Math.max(0, ...ids.map(id => cfg.caps[id]));
    return { sets, ids, capMax };
  }

  /* ---------- rotation prefixes ---------- */
  // For each of the 12 rotations: a token string (<=2 rotation tokens) and the transformed
  // scramble state such that "[tokens] + plain solution of transformed" solves the original.
  function buildRotations() {
    const ID = E.symFromFacePerm(E.FACE_ID, false);
    const frameOf = tokens => { // replicate applyParsed's frame tracking for rotation-only strings
      let frame = ID;
      for (const t of tokens) {
        const phys = frame.corner[t.f];
        for (let k = 0; k < t.amt; k++) frame = E.composeSym(rotBy[phys], frame);
      }
      return frame;
    };
    const singles = [];
    for (const a of ['u', 'l', 'r', 'b']) for (const p of ['', "'"]) singles.push({ str: '[' + a + p + ']', tok: { f: a.toUpperCase(), amt: p ? 2 : 1 } });
    const cands = [{ str: '', toks: [] }];
    for (const s1 of singles) cands.push({ str: s1.str, toks: [s1.tok] });
    for (const s1 of singles) for (const s2 of singles) cands.push({ str: s1.str + ' ' + s2.str, toks: [s1.tok, s2.tok] });
    const byKey = new Map();
    for (const c of cands) {
      const key = JSON.stringify(frameOf(c.toks).fp);
      if (!byKey.has(key)) byKey.set(key, c);
    }
    // associate each PREFIX with the unique state transform that makes
    // "[prefix] + plain solution of transformed" verify on the original state.
    // The probes are FIXED states with trivial rotational stabilizer (asserted:
    // all 12 rotation images distinct), which makes the association provably
    // unique — the old random probes could in principle land on a symmetric
    // state and mis-associate silently.
    const PROBE_MOVES = [[0, 2, 5, 7, 1, 4, 6, 3, 0], [4, 0, 6, 2, 7, 1, 3, 5]];
    const [probe, probe2] = PROBE_MOVES.map(ms => {
      const p = E.solved();
      for (const m of ms) E.applyMoveIdx(p, m);
      if (new Set(syms.rots.map(sy => E.idx(E.applySym(sy, p)))).size !== 12)
        throw new Error('rotation probe is symmetric; choose a different probe scramble');
      return p;
    });
    const out = [];
    for (const [, c] of byKey) {
      let chosen = null;
      for (const sym of syms.rots) {
        const ms = E.optimalSolution(E.applySym(sym, probe), dist, false);
        const full = (c.str ? c.str + ' ' : '') + ms;
        const parsed = E.parseAlg(full);
        if (parsed && E.eq(E.applyParsed(parsed, probe, syms, rotBy), E.solved())) {
          const ms2 = E.optimalSolution(E.applySym(sym, probe2), dist, false);
          if (E.eq(E.applyParsed(E.parseAlg((c.str ? c.str + ' ' : '') + ms2), probe2, syms, rotBy), E.solved())) {
            chosen = { prefix: c.str, sym };
          }
        }
        if (chosen) break;
      }
      if (!chosen) throw new Error('rotation association failed for "' + c.str + '"');
      out.push(chosen);
    }
    if (out.length !== 12) throw new Error('expected 12 rotation prefixes, got ' + out.length);
    // frames were already deduplicated by byKey above; each surviving prefix maps to one rotation frame.
    if (new Set(out.map(c => JSON.stringify(c.sym.fp))).size !== 12)
      throw new Error('rotation association is not a bijection');
    return { rotations: out, syms, rotBy };
  }

  /* ---------- ergonomics: grip-state DP over renderings ---------- */
  const ERGO_DEFAULTS = {
    wrist: 1.0, flickU: 1.0, bBase: 2.0, bColdExtra: 1.5, wide: 3.0,
    silentReset: 1.5, altBonus: 0.3, uBusy: 0.3, rotCost: 0,
    excursion: 0.5, bWindow: 1,
  };
  // physical token list (ints 0..7) -> { score, tokens (display strings; Rw/Lw substituted when cheaper) }
  // detail=true also returns `breakdown`: { start, steps:[{tok,cost,parts:[{label,val}]}], rotation, total }
  // tracing the minimal-cost path so the UI can show how each move contributes to the score.
  function ergoScore(seq, rotTokens, w, detail) {
    w = Object.assign({}, ERGO_DEFAULTS, w || {});
    const ID = E.symFromFacePerm(E.FACE_ID, false);
    const frames = [ID];
    const frameKey = f => JSON.stringify(f.fp);
    const frameIdx = new Map([[frameKey(ID), 0]]);
    const ensureFrame = f => { const k = frameKey(f); if (!frameIdx.has(k)) { frameIdx.set(k, frames.length); frames.push(f); } return frameIdx.get(k); };
    // DP state: (frame, dialL, dialR, sinceL, sinceR, lastHand)
    // dial: thumb position relative to home (-1 bottom, 0 front, +1 top by that hand's CW);
    // since: moves since that hand last placed its thumb (capped; drives the B set-up
    // window and the excursion tax). Start grips are FREE — like rotations, you set them
    // during inspection — and a thumb that starts raised counts as freshly placed, which
    // is what makes an opening B set-up-priced (this replaces the old `grace` rule).
    const CAP = 5;
    const startStates = new Map();
    for (const dl of [-1, 0, 1]) for (const dr of [-1, 0, 1]) {
      const st0 = { cost: 0, toks: [] };
      if (detail) st0.det = { start: { dl, dr, cost: 0 }, steps: [] };
      startStates.set('0|' + dl + '|' + dr + '|' + (dl === 1 ? 0 : CAP) + '|' + (dr === 1 ? 0 : CAP) + '|n', st0);
    }
    let layer = startStates;
    for (let i = 0; i < seq.length; i++) {
      const next = new Map();
      const physTok = seq[i];
      const physLetter = MOVES[physTok][0], prime = MOVES[physTok].length > 1;
      for (const [k, st] of layer) {
        const [fI, dl0, dr0, sl0, sr0, lh0] = k.split('|');
        const frame = frames[+fI];
        const written = Object.keys(frame.corner).find(x => frame.corner[x] === physLetter);
        const renders = [{ kind: 'base', letter: written }];
        if (written === 'L' || written === 'R') renders.push({ kind: 'wide', letter: written === 'L' ? 'R' : 'L' });
        for (const r of renders) {
          const L = r.letter;
          let tok, nf = +fI;
          if (r.kind === 'wide') {
            tok = L + 'w' + (prime ? "'" : '');
            // wide frame change per engine: Xw applies move WIDE[X][0] + rotation about WIDE[X][1]
            const axis = L === 'R' ? 'L' : 'R';
            const physAxis = frame.corner[axis];
            let f2 = frame;
            const steps = prime ? 1 : 2;
            for (let q = 0; q < steps; q++) f2 = E.composeSym(rotBy[physAxis], f2);
            nf = ensureFrame(f2);
          } else tok = L + (prime ? "'" : '');
          // a render can admit several executions (which hand flicks a U, which index
          // pokes a B); the DP branches on ALL of them and keeps the min per state, so
          // the alternation bonus is credited to the genuinely best hand assignment
          const options = [];
          if (L === 'L' || L === 'R') {
            // wrist move; the executing hand is the letter's hand (a wide is the SAME wrist
            // motion as its underlying move done by the other hand's letter -- Rw acts like an L)
            const hand = (r.kind === 'wide') ? (L === 'R' ? 'right' : 'left') : (L === 'L' ? 'left' : 'right');
            options.push({ hand, base: r.kind === 'wide' ? w.wide : w.wrist, label: r.kind === 'wide' ? 'wide' : 'turn', wrist: true });
          } else if (L === 'U') {
            for (const hand of ['left', 'right']) {
              const busy = (hand === 'left' ? +dl0 : +dr0) !== 0 ? w.uBusy : 0;
              options.push({ hand, base: w.flickU, label: 'U flick', extra: busy ? { label: 'busy U', val: busy } : null });
            }
          } else { // B: cheap only with that hand's thumb up top AND recently placed there
            for (const hand of ['left', 'right']) {
              const dial = hand === 'left' ? +dl0 : +dr0, since = hand === 'left' ? +sl0 : +sr0;
              const setup = dial === 1 && since <= w.bWindow;
              options.push({ hand, base: setup ? w.bBase : w.bBase + w.bColdExtra, label: setup ? 'B set-up' : 'B cold' });
            }
          }
          for (const o of options) {
            let cost = o.base, dl = +dl0, dr = +dr0, sl = +sl0, sr = +sr0;
            const parts = detail ? [{ label: o.label, val: o.base }] : null;
            if (o.extra) { cost += o.extra.val; if (parts) parts.push(o.extra); }
            if (o.wrist) {
              const dir = prime ? -1 : 1;
              // dial sense: right hand R = +1; left hand L' = +1 (thumb toward top), mirrored
              const delta = o.hand === 'right' ? dir : -dir;
              const cur = o.hand === 'left' ? dl : dr;
              let nd = cur + delta;
              if (Math.abs(nd) > 1) { cost += w.silentReset; nd = delta; if (parts) parts.push({ label: 'hidden regrip', val: w.silentReset }); }
              if (o.hand === 'left') { dl = nd; sl = 0; sr = Math.min(CAP, sr + 1); }
              else { dr = nd; sr = 0; sl = Math.min(CAP, sl + 1); }
            } else { sl = Math.min(CAP, sl + 1); sr = Math.min(CAP, sr + 1); }
            if (lh0 !== 'n' && lh0 !== o.hand) { cost -= w.altBonus; if (parts) parts.push({ label: 'alternation', val: -w.altBonus }); } // hand alternation flows
            // excursion tax: the move that puts a thumb off home is free; every move it then
            // LINGERS out costs, so quick returns like R U R' stay cheap but parking doesn't
            const linger = (dl !== 0 && sl >= 1 ? 1 : 0) + (dr !== 0 && sr >= 1 ? 1 : 0);
            if (linger) { cost += linger * w.excursion; if (parts) parts.push({ label: 'lingering thumb' + (linger > 1 ? ' ×' + linger : ''), val: linger * w.excursion }); }
            const nk = nf + '|' + dl + '|' + dr + '|' + sl + '|' + sr + '|' + o.hand;
            const tot = st.cost + cost;
            const prev = next.get(nk);
            if (!prev || prev.cost > tot) {
              const ns = { cost: tot, toks: st.toks.concat(tok) };
              if (detail) ns.det = { start: st.det.start, steps: st.det.steps.concat([{ tok, cost: +cost.toFixed(2), parts }]) };
              next.set(nk, ns);
            }
          }
        }
      }
      layer = next;
    }
    let best = null;
    for (const [, st] of layer) if (!best || st.cost < best.cost) best = st;
    const rotN = rotTokens ? rotTokens.split(/\s+/).filter(Boolean).length : 0;
    const score = +(best.cost + rotN * w.rotCost).toFixed(2);
    const out = { score, tokens: best.toks };
    if (detail) out.breakdown = {
      start: best.det.start,
      steps: best.det.steps,
      rotation: { count: rotN, each: w.rotCost, cost: +(rotN * w.rotCost).toFixed(2) },
      total: score,
    };
    return out;
  }

  /* ---------- the search ---------- */
  // search(scrambleState, opts, hooks) -> { byLength: {L: [results...]}, dopt, truncated }
  // opts: { methods, caps, offsets, slack, maxCancel, lengths:[ints], weights, budget }
  function search(scr, opts, hooks) {
    const cfg = {
      methods: opts.methods, caps: Object.assign({}, ...Object.keys(METHOD_DEFS).map(id => ({ [id]: METHOD_DEFS[id].cap })), opts.caps || {}),
      offsets: (opts.offsets || []),
    };
    const targets = buildTargets(cfg);
    const rot = opts.rotations; // from buildRotations()
    const slack = opts.slack ?? 0;
    const maxCancel = opts.maxCancel ?? 2;
    const budget = opts.budget || 60000;
    const dopt = dist[E.idx(scr)];
    const lengths = opts.lengths;
    const Lmax = Math.max(...lengths);
    const found = new Map(); // key rotPrefix+'|'+executed string -> result
    let work = 0, truncated = false;

    for (const r of rot.rotations) {
      const s0 = E.applySym(r.sym, scr);
      // phase 1: DFS enumerating reduced prefixes
      const junctions = new Map(); // tIdx -> { state, paths: [{seq, hits:[{id,len}]}] }
      const dfs1 = (s, seq, lastCorner) => {
        if (++work > budget) { truncated = true; return; }
        const ix = E.idx(s);                 // hot path: rank once per node
        const sg = (ix - ix % 3) / 3;        // == sigOf(s), sans the extra idx calls
        // membership hits at this node
        const hits = [];
        for (const id of targets.ids) if (seq.length <= cfg.caps[id] && targets.sets[id].has(sg)) hits.push(id);
        if (hits.length) {
          let j = junctions.get(ix);
          if (!j) { j = { state: E.copy(s), paths: [] }; junctions.set(ix, j); }
          j.paths.push({ seq: seq.slice(), hits });
        }
        if (seq.length >= targets.capMax) return;
        // prune: executed >= seq.length + dist - cancel, and the finish A may
        // exceed the case optimum by at most `slack` — beyond that nothing fits.
        if (seq.length + dist[ix] > Lmax + maxCancel + slack) return;
        for (let m = 0; m < 8; m++) {
          if ((m >> 1) === lastCorner) continue;
          const t = E.copy(s); E.applyMoveIdx(t, m);
          seq.push(m);
          dfs1(t, seq, m >> 1);
          seq.pop();
          if (truncated) return;
        }
      };
      dfs1(s0, [], -1);
      if (truncated) break;
      // phase 2 per junction
      for (const [ti, j] of junctions) {
        const dT = dist[ti];
        const minP = Math.min(...j.paths.map(p => p.seq.length));
        const maxA = Math.min(dT + slack, Lmax + maxCancel - minP);
        if (maxA < dT) continue;
        const finals = []; // {seq}
        const dfs2 = (s, seq) => {
          if (++work > budget) { truncated = true; return; }
          const d = dist[E.idx(s)];
          if (d === 0 && seq.length >= dT) { finals.push(seq.slice()); }
          if (seq.length >= maxA) return;
          const last = seq.length ? seq[seq.length - 1] >> 1 : -1;
          for (let m = 0; m < 8; m++) {
            if ((m >> 1) === last) continue;
            const t = E.copy(s); E.applyMoveIdx(t, m);
            if (dist[E.idx(t)] > maxA - seq.length - 1) continue;
            seq.push(m);
            dfs2(t, seq);
            seq.pop();
            if (truncated) return;
          }
        };
        dfs2(j.state, []);
        if (truncated) break;
        for (const A of finals) for (const p of j.paths) {
          const exec = reduceSeq(p.seq.concat(A));
          const cancel = p.seq.length + A.length - exec.length;
          if (cancel > maxCancel) continue;
          if (!lengths.includes(exec.length)) continue;
          const kk = r.prefix + '|' + exec.join(',');
          let item = found.get(kk);
          if (!item) {
            item = { prefix: r.prefix, exec, length: exec.length, methods: {} };
            found.set(kk, item);
          }
          for (const id of p.hits) {
            const cur = item.methods[id];
            if (!cur || p.seq.length < cur.v) item.methods[id] = {
              v: p.seq.length, fin: A.length, cancel,
              // representative decomposition for the reconstruction view:
              vmoves: p.seq.map(m => MOVES[m]).join(' '),  // the V / first-step moves
              amoves: A.map(m => MOVES[m]).join(' '),       // the algorithm that finishes
              jstate: E.copy(j.state),                      // the case the algorithm solves (for naming)
            };
          }
        }
      }
      if (truncated) break;
    }
    // suppress L5E badge when a more specific V badge exists
    for (const item of found.values())
      if (item.methods.l5e && (item.methods.l4e || item.methods.ml4e || item.methods.tl4eb)) delete item.methods.l5e;
    // score + bucket
    const byLength = {};
    for (const item of found.values()) {
      const sc = ergoScore(item.exec, item.prefix, opts.weights);
      item.score = sc.score;
      item.display = (item.prefix ? item.prefix + ' ' : '') + sc.tokens.join(' ');
      (byLength[item.length] = byLength[item.length] || []).push(item);
    }
    for (const L of Object.keys(byLength)) byLength[L].sort((a, b) => a.score - b.score || a.display.localeCompare(b.display));
    return { byLength, dopt, truncated, work };
  }

  return { reduceSeq, pool, compose, invPremoveState, parseOffset, buildTargets, buildRotations, ergoScore, search, METHOD_DEFS, ERGO_DEFAULTS, sigOf, syms, rotBy };
}
if (typeof module !== 'undefined') module.exports = { makeSolverCore, METHOD_DEFS, METHOD_PRIORITY };
window.OOSolverCore=module.exports;})();

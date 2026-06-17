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
function makeSolverCore(E, dist) {
  const MOVES = E.MOVES; // ['U',"U'",'L',"L'",'R',"R'",'B',"B'"]
  const sigOf = s => (E.idx(s) - (E.idx(s) % 3)) / 3; // no-u signature
  const NOU = 720 * 64 * 27;

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

  /* ---------- pools (port of the trainer's Sl) ---------- */
  function perms(arr) {
    if (arr.length <= 1) return [arr];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const p of perms(rest)) out.push([arr[i]].concat(p));
    }
    return out;
  }
  function permParity(p) {
    let par = 0; const seen = new Array(p.length).fill(false);
    for (let i = 0; i < p.length; i++) {
      if (seen[i]) continue;
      let j = i, len = 0;
      while (!seen[j]) { seen[j] = true; j = p[j]; len++; }
      par ^= (len - 1) & 1;
    }
    return par;
  }
  function pool(freeSlots) { // states: listed slots scrambled (even perm, even flips), rest solved, c=[0,0,0]
    const out = [];
    for (const asg of perms(freeSlots)) {
      const full = [0, 1, 2, 3, 4, 5];
      freeSlots.forEach((slot, i) => { full[slot] = asg[i]; });
      if (permParity(full) !== 0) continue;
      const n = freeSlots.length;
      for (let bits = 0; bits < (1 << n); bits++) {
        let pc = 0; for (let b = 0; b < n; b++) pc += (bits >> b) & 1;
        if (pc % 2) continue;
        const e = [];
        for (let s = 0; s < 6; s++) {
          const k = freeSlots.indexOf(s);
          e.push(full[s], k >= 0 ? (bits >> k) & 1 : 0);
        }
        out.push({ e, c: [0, 0, 0], u: 0 });
      }
    }
    return out;
  }
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

  /* ---------- method registry ---------- */
  const METHOD_DEFS = {
    l4e:    { name: 'L4E',          cap: 7 },
    ml4e:   { name: 'ML4E',         cap: 7 },
    tl4eb:  { name: 'TL4E-B',       cap: 6 },
    l5e:    { name: 'L5E',          cap: 4 },
    psl4e:  { name: 'Pseudo L4E',   cap: 5 },
    psml4e: { name: 'Pseudo ML4E',  cap: 5 },
  };
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
    const syms = E.buildSyms();
    const rotBy = E.makeFrames(syms);
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
    // empirically associate each PREFIX with the unique state transform that makes
    // "[prefix] + plain solution of transformed" verify on the original state
    const probe = E.solved();
    for (let i = 0; i < 9; i++) E.applyMoveIdx(probe, Math.floor(Math.random() * 8));
    const probe2 = E.solved();
    for (let i = 0; i < 8; i++) E.applyMoveIdx(probe2, Math.floor(Math.random() * 8));
    const out = [];
    for (const [, c] of byKey) {
      let chosen = null;
      for (const sym of syms.rots) {
        for (const tf of [sym]) {
          const ms = E.optimalSolution(E.applySym(tf, probe), dist, false);
          const full = (c.str ? c.str + ' ' : '') + ms;
          const parsed = E.parseAlg(full);
          if (parsed && E.eq(E.applyParsed(parsed, probe, syms, rotBy), E.solved())) {
            const ms2 = E.optimalSolution(E.applySym(tf, probe2), dist, true);
            if (E.eq(E.applyParsed(E.parseAlg((c.str ? c.str + ' ' : '') + ms2), probe2, syms, rotBy), E.solved())) {
              chosen = { prefix: c.str, sym: tf };
            }
          }
          if (chosen) break;
        }
        if (chosen) break;
      }
      if (!chosen) throw new Error('rotation association failed for "' + c.str + '"');
      out.push(chosen);
    }
    if (out.length !== 12) throw new Error('expected 12 rotation prefixes, got ' + out.length);
    // deduplicate frames (each rotation should map to a distinct prefix); prefer fewest tokens
    return { rotations: out, syms, rotBy };
  }

  /* ---------- ergonomics: grip-state DP over renderings ---------- */
  const ERGO_DEFAULTS = {
    wrist: 1.0, flickU: 1.0, bCold: 2.0, bSetup: 1.0, wide: 1.2,
    silentReset: 0.6, altBonus: 0.25, uBusy: 0.3, rotCost: 0.1, grace: 2,
    displacedTax: 0.12, startDelay: 0.2, bWindow: 2,
  };
  // physical token list (ints 0..7) -> { score, tokens (display strings; Rw/Lw substituted when cheaper) }
  function ergoScore(seq, rotTokens, w) {
    w = Object.assign({}, ERGO_DEFAULTS, w || {});
    const { syms, rotBy } = ergoScore._rot || (ergoScore._rot = (() => { const s2 = E.buildSyms(); return { syms: s2, rotBy: E.makeFrames(s2) }; })());
    const ID = E.symFromFacePerm(E.FACE_ID, false);
    const frames = [ID];
    const frameKey = f => JSON.stringify(f.fp);
    const frameIdx = new Map([[frameKey(ID), 0]]);
    const ensureFrame = f => { const k = frameKey(f); if (!frameIdx.has(k)) { frameIdx.set(k, frames.length); frames.push(f); } return frameIdx.get(k); };
    // DP state: (frame, dialL, dialR, sinceL, sinceR, lastHand)
    // dial: thumb position relative to home (-1 bottom, 0 front, +1 top by that hand's CW);
    // since: moves since that hand last turned its wrist (capped, for the B setup window);
    const CAP = 5;
    const startStates = new Map();
    for (const dl of [-1, 0, 1]) for (const dr of [-1, 0, 1]) {
      const c0 = (dl !== 0 ? w.startDelay : 0) + (dr !== 0 ? w.startDelay : 0);
      startStates.set('0|' + dl + '|' + dr + '|' + CAP + '|' + CAP + '|n', { cost: c0, toks: [] });
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
          let cost = 0, dl = +dl0, dr = +dr0, sl = +sl0, sr = +sr0;
          let hand = null, tok, nf = +fI;
          const L = r.letter;
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
          if (L === 'L' || L === 'R') {
            // wrist move; the executing hand is the letter's hand (a wide is the SAME wrist
            // motion as its underlying move done by the other hand's letter -- Rw acts like an L)
            hand = (r.kind === 'wide') ? (L === 'R' ? 'right' : 'left') : (L === 'L' ? 'left' : 'right');
            cost += r.kind === 'wide' ? w.wide : w.wrist;
            const dir = prime ? -1 : 1;
            // dial sense: right hand R = +1; left hand L' = +1 (thumb toward top), mirrored
            const delta = hand === 'right' ? dir : -dir;
            let cur = hand === 'left' ? dl : dr;
            let nd = cur + delta;
            if (Math.abs(nd) > 1) { cost += w.silentReset; nd = delta; }
            if (hand === 'left') { dl = nd; sl = 0; sr = Math.min(CAP, sr + 1); }
            else { dr = nd; sr = 0; sl = Math.min(CAP, sl + 1); }
          } else if (L === 'U') {
            const cl = dl !== 0 ? w.uBusy : 0, cr = dr !== 0 ? w.uBusy : 0;
            hand = cl <= cr ? 'left' : 'right';
            cost += w.flickU + Math.min(cl, cr);
            sl = Math.min(CAP, sl + 1); sr = Math.min(CAP, sr + 1);
          } else { // B: cheap only with a thumb up top AND recently placed there, or out of inspection
            const setup = (dr === 1 && sr <= w.bWindow) || (dl === 1 && sl <= w.bWindow) || i < w.grace;
            cost += setup ? w.bSetup : w.bCold;
            hand = (dr === 1 && sr <= w.bWindow) ? 'right' : (dl === 1 && sl <= w.bWindow) ? 'left' : 'right';
            sl = Math.min(CAP, sl + 1); sr = Math.min(CAP, sr + 1);
          }
          if (lh0 !== 'n' && lh0 !== hand) cost -= w.altBonus;       // hand alternation flows
          cost += (dl !== 0 ? w.displacedTax : 0) + (dr !== 0 ? w.displacedTax : 0); // time away from home grip
          const nk = nf + '|' + dl + '|' + dr + '|' + sl + '|' + sr + '|' + hand;
          const tot = st.cost + cost;
          const prev = next.get(nk);
          if (!prev || prev.cost > tot) next.set(nk, { cost: tot, toks: st.toks.concat(tok) });
        }
      }
      layer = next;
    }
    let best = null;
    for (const [, st] of layer) if (!best || st.cost < best.cost) best = st;
    const rotN = rotTokens ? rotTokens.split(/\s+/).filter(Boolean).length : 0;
    return { score: +(best.cost + rotN * w.rotCost).toFixed(2), tokens: best.toks };
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
        const sg = sigOf(s);
        // membership hits at this node
        const hits = [];
        for (const id of targets.ids) if (seq.length <= cfg.caps[id] && targets.sets[id].has(sg)) hits.push(id);
        if (hits.length) {
          const ti = E.idx(s);
          let j = junctions.get(ti);
          if (!j) { j = { state: E.copy(s), paths: [] }; junctions.set(ti, j); }
          j.paths.push({ seq: seq.slice(), hits });
        }
        if (seq.length >= targets.capMax) return;
        // prune: total budget and target reachability
        const df = dist[E.idx(s)];
        if (seq.length + df > Lmax + maxCancel) {
          // still might reach a target then come back longer? no: executed >= seq.length + dist - cancel
          // continue only if a target could be hit deeper AND total can still work via slack on A? covered: A <= dist(t)+slack
          // allow slack margin:
          if (seq.length + df > Lmax + maxCancel + slack) return;
        }
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

  return { reduceSeq, pool, compose, invPremoveState, parseOffset, buildTargets, buildRotations, ergoScore, search, METHOD_DEFS, ERGO_DEFAULTS, sigOf };
}
if (typeof module !== 'undefined') module.exports = { makeSolverCore };
window.OOSolverCore=module.exports;})();

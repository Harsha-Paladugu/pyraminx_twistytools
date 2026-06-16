import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import __sheet from "../../js/sheet.js";

// ============================================================
// L5E Trainer — The Pyraminx Sheet sets
// L5E: Bad Layers, KL5E, BL5E, Heads/Tails, Yin/Yang, FL5E
// L4E: L4E (LL merged in), ML4E (Right + Left slot)
// ============================================================

const CLASSMAP = {"00,10,20,31,40,51":"bad-layers","00,11,21,31,40,51":"bad-layers","01,10,21,31,40,51":"bad-layers","01,11,20,31,40,51":"bad-layers","00,10,30,50,40,20":"bl5e","00,10,30,51,40,21":"kl5e","00,10,31,50,40,21":"bl5e","00,10,31,51,40,20":"kl5e","00,11,30,50,40,21":"bl5e","00,11,30,51,40,20":"kl5e","00,11,31,50,40,20":"bl5e","00,11,31,51,40,21":"kl5e","01,10,30,50,40,21":"bl5e","01,10,30,51,40,20":"kl5e","01,10,31,50,40,20":"bl5e","01,10,31,51,40,21":"kl5e","01,11,30,50,40,20":"bl5e","01,11,30,51,40,21":"kl5e","01,11,31,50,40,21":"bl5e","01,11,31,51,40,20":"kl5e","00,10,50,20,40,30":"bl5e","00,10,50,21,40,31":"kl5e","00,10,51,20,40,31":"kl5e","00,10,51,21,40,30":"bl5e","00,11,50,20,40,31":"kl5e","00,11,50,21,40,30":"bl5e","00,11,51,20,40,30":"bl5e","00,11,51,21,40,31":"kl5e","01,10,50,20,40,31":"kl5e","01,10,50,21,40,30":"bl5e","01,10,51,20,40,30":"bl5e","01,10,51,21,40,31":"kl5e","01,11,50,20,40,30":"bl5e","01,11,50,21,40,31":"kl5e","01,11,51,20,40,31":"kl5e","01,11,51,21,40,30":"bl5e","00,20,10,50,40,30":"bad-layers","00,20,10,51,40,31":"bad-layers","00,20,11,50,40,31":"bad-layers","00,20,11,51,40,30":"bad-layers","00,21,10,50,40,31":"bad-layers","00,21,10,51,40,30":"bad-layers","00,21,11,50,40,30":"bad-layers","00,21,11,51,40,31":"bad-layers","01,20,10,50,40,31":"bad-layers","01,20,10,51,40,30":"bad-layers","01,20,11,50,40,30":"bad-layers","01,20,11,51,40,31":"bad-layers","01,21,10,50,40,30":"bad-layers","01,21,10,51,40,31":"bad-layers","01,21,11,50,40,31":"bad-layers","01,21,11,51,40,30":"bad-layers","00,20,30,11,40,51":"fl5e","00,20,31,10,40,51":"fl5e","00,21,30,10,40,51":"fl5e","00,21,31,11,40,51":"fl5e","01,20,30,10,40,51":"fl5e","01,20,31,11,40,51":"fl5e","01,21,30,11,40,51":"fl5e","01,21,31,10,40,51":"fl5e","00,20,50,31,40,11":"fl5e","00,20,51,31,40,10":"fl5e","00,21,50,31,40,10":"fl5e","00,21,51,31,40,11":"fl5e","01,20,50,31,40,10":"fl5e","01,20,51,31,40,11":"fl5e","01,21,50,31,40,11":"fl5e","01,21,51,31,40,10":"fl5e","00,30,10,21,40,51":"fl5e","00,30,11,20,40,51":"fl5e","00,31,10,20,40,51":"fl5e","00,31,11,21,40,51":"fl5e","01,30,10,20,40,51":"fl5e","01,30,11,21,40,51":"fl5e","01,31,10,21,40,51":"fl5e","01,31,11,20,40,51":"fl5e","00,30,20,50,40,10":"bl5e","00,30,20,51,40,11":"kl5e","00,30,21,50,40,11":"bl5e","00,30,21,51,40,10":"kl5e","00,31,20,50,40,11":"bl5e","00,31,20,51,40,10":"kl5e","00,31,21,50,40,10":"bl5e","00,31,21,51,40,11":"kl5e","01,30,20,50,40,11":"bl5e","01,30,20,51,40,10":"kl5e","01,30,21,50,40,10":"bl5e","01,30,21,51,40,11":"kl5e","01,31,20,50,40,10":"bl5e","01,31,20,51,40,11":"kl5e","01,31,21,50,40,11":"bl5e","01,31,21,51,40,10":"kl5e","00,30,50,10,40,20":"ht","00,30,50,11,40,21":"ht","00,30,51,10,40,21":"yy","00,30,51,11,40,20":"yy","00,31,50,10,40,21":"yy","00,31,50,11,40,20":"yy","00,31,51,10,40,20":"ht","00,31,51,11,40,21":"ht","01,30,50,10,40,21":"ht","01,30,50,11,40,20":"ht","01,30,51,10,40,20":"yy","01,30,51,11,40,21":"yy","01,31,50,10,40,20":"yy","01,31,50,11,40,21":"yy","01,31,51,10,40,21":"ht","01,31,51,11,40,20":"ht","00,50,10,31,40,21":"fl5e","00,50,11,31,40,20":"fl5e","00,51,10,31,40,20":"fl5e","00,51,11,31,40,21":"fl5e","01,50,10,31,40,20":"fl5e","01,50,11,31,40,21":"fl5e","01,51,10,31,40,21":"fl5e","01,51,11,31,40,20":"fl5e","00,50,20,10,40,30":"bl5e","00,50,20,11,40,31":"kl5e","00,50,21,10,40,31":"kl5e","00,50,21,11,40,30":"bl5e","00,51,20,10,40,31":"kl5e","00,51,20,11,40,30":"bl5e","00,51,21,10,40,30":"bl5e","00,51,21,11,40,31":"kl5e","01,50,20,10,40,31":"kl5e","01,50,20,11,40,30":"bl5e","01,50,21,10,40,30":"bl5e","01,50,21,11,40,31":"kl5e","01,51,20,10,40,30":"bl5e","01,51,20,11,40,31":"kl5e","01,51,21,10,40,31":"kl5e","01,51,21,11,40,30":"bl5e","00,50,30,20,40,10":"ht","00,50,30,21,40,11":"ht","00,50,31,20,40,11":"yy","00,50,31,21,40,10":"yy","00,51,30,20,40,11":"yy","00,51,30,21,40,10":"yy","00,51,31,20,40,10":"ht","00,51,31,21,40,11":"ht","01,50,30,20,40,11":"ht","01,50,30,21,40,10":"ht","01,50,31,20,40,10":"yy","01,50,31,21,40,11":"yy","01,51,30,20,40,10":"yy","01,51,30,21,40,11":"yy","01,51,31,20,40,11":"ht","01,51,31,21,40,10":"ht","10,20,30,50,40,00":"bl5e","10,20,30,51,40,01":"kl5e","10,20,31,50,40,01":"bl5e","10,20,31,51,40,00":"kl5e","10,21,30,50,40,01":"bl5e","10,21,30,51,40,00":"kl5e","10,21,31,50,40,00":"bl5e","10,21,31,51,40,01":"kl5e","11,20,30,50,40,01":"bl5e","11,20,30,51,40,00":"kl5e","11,20,31,50,40,00":"bl5e","11,20,31,51,40,01":"kl5e","11,21,30,50,40,00":"bl5e","11,21,30,51,40,01":"kl5e","11,21,31,50,40,01":"bl5e","11,21,31,51,40,00":"kl5e","10,20,50,00,40,30":"bl5e","10,20,50,01,40,31":"kl5e","10,20,51,00,40,31":"kl5e","10,20,51,01,40,30":"bl5e","10,21,50,00,40,31":"kl5e","10,21,50,01,40,30":"bl5e","10,21,51,00,40,30":"bl5e","10,21,51,01,40,31":"kl5e","11,20,50,00,40,31":"kl5e","11,20,50,01,40,30":"bl5e","11,20,51,00,40,30":"bl5e","11,20,51,01,40,31":"kl5e","11,21,50,00,40,30":"bl5e","11,21,50,01,40,31":"kl5e","11,21,51,00,40,31":"kl5e","11,21,51,01,40,30":"bl5e","10,30,20,01,40,51":"fl5e","10,30,21,00,40,51":"fl5e","10,31,20,00,40,51":"fl5e","10,31,21,01,40,51":"fl5e","11,30,20,00,40,51":"fl5e","11,30,21,01,40,51":"fl5e","11,31,20,01,40,51":"fl5e","11,31,21,00,40,51":"fl5e","10,30,50,20,40,00":"ht","10,30,50,21,40,01":"ht","10,30,51,20,40,01":"yy","10,30,51,21,40,00":"yy","10,31,50,20,40,01":"yy","10,31,51,20,40,00":"ht","10,31,51,21,40,01":"ht","11,30,50,20,40,01":"ht","11,30,50,21,40,00":"ht","11,30,51,20,40,00":"yy","11,30,51,21,40,01":"yy","11,31,50,20,40,00":"yy","11,31,50,21,40,01":"yy","11,31,51,20,40,01":"ht","11,31,51,21,40,00":"ht","10,50,20,31,40,01":"fl5e","10,50,21,31,40,00":"fl5e","10,51,20,31,40,00":"fl5e","10,51,21,31,40,01":"fl5e","11,50,20,31,40,00":"fl5e","11,50,21,31,40,01":"fl5e","11,51,20,31,40,01":"fl5e","11,51,21,31,40,00":"fl5e","10,50,30,00,40,20":"ht","10,50,30,01,40,21":"ht","10,50,31,00,40,21":"yy","10,50,31,01,40,20":"yy","10,51,30,00,40,21":"yy","10,51,30,01,40,20":"yy","10,51,31,00,40,20":"ht","10,51,31,01,40,21":"ht","11,50,30,00,40,21":"ht","11,50,30,01,40,20":"ht","11,50,31,00,40,20":"yy","11,50,31,01,40,21":"yy","11,51,30,00,40,20":"yy","11,51,30,01,40,21":"yy","11,51,31,00,40,21":"ht","11,51,31,01,40,20":"ht","20,30,50,00,40,10":"ht","20,30,50,01,40,11":"ht","20,30,51,00,40,11":"yy","20,30,51,01,40,10":"yy","20,31,50,00,40,11":"yy","20,31,50,01,40,10":"yy","20,31,51,00,40,10":"ht","20,31,51,01,40,11":"ht","21,30,50,00,40,11":"ht","21,30,50,01,40,10":"ht","21,30,51,00,40,10":"yy","21,30,51,01,40,11":"yy","21,31,50,00,40,10":"yy","21,31,50,01,40,11":"yy","21,31,51,00,40,11":"ht","21,31,51,01,40,10":"ht","20,50,30,10,40,00":"ht","20,50,30,11,40,01":"ht","20,50,31,10,40,01":"yy","20,50,31,11,40,00":"yy","20,51,30,10,40,01":"yy","20,51,30,11,40,00":"yy","20,51,31,10,40,00":"ht","20,51,31,11,40,01":"ht","21,50,30,10,40,01":"ht","21,50,30,11,40,00":"ht","21,50,31,10,40,00":"yy","21,50,31,11,40,01":"yy","21,51,30,10,40,00":"yy","21,51,30,11,40,01":"yy","21,51,31,10,40,01":"ht","21,51,31,11,40,00":"ht","10,31,50,21,40,00":"yy"};

// ---------- verified pyraminx engine ----------
// Edge slots: 0 FL, 1 FR, 2 BK, 3 DF, 4 DL, 5 DR
// state.e = [p0,f0,...,p5,f5], state.c = [L,R,B] center twists
const MOVES = {
  U: { cyc: [[0, 2, 0], [2, 1, 1], [1, 0, 1]], center: -1 },
  R: { cyc: [[1, 5, 0], [5, 3, 1], [3, 1, 1]], center: 1 },
  L: { cyc: [[0, 3, 1], [3, 4, 1], [4, 0, 0]], center: 0 },
  B: { cyc: [[2, 4, 1], [4, 5, 1], [5, 2, 0]], center: 2 },
};
const MOVE_NAMES = ["U", "U'", "R", "R'", "L", "L'", "B", "B'"];

const solvedState = () => ({ e: [0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0], c: [0, 0, 0] });
const copyState = (s) => ({ e: s.e.slice(), c: s.c.slice() });

function applyMove(s, face, inv) {
  const times = inv ? 2 : 1;
  const m = MOVES[face];
  for (let t = 0; t < times; t++) {
    const e = s.e.slice();
    for (const [src, dst, d] of m.cyc) {
      s.e[dst * 2] = e[src * 2];
      s.e[dst * 2 + 1] = e[src * 2 + 1] ^ d;
    }
    if (m.center >= 0) s.c[m.center] = (s.c[m.center] + 1) % 3;
  }
}
function stateKey(s) {
  const parts = [];
  for (let i = 0; i < 6; i++) parts.push("" + s.e[i * 2] + s.e[i * 2 + 1]);
  return parts.join(",");
}
function aufCanonKey(s) {
  let best = null;
  const t = copyState(s);
  for (let k = 0; k < 3; k++) {
    if (k > 0) applyMove(t, "U", false);
    const key = stateKey(t);
    if (best === null || key < best) best = key;
  }
  return best;
}
const FACT = [1, 1, 2, 6, 24, 120];
function stateIndex(s) {
  const p = [s.e[0], s.e[2], s.e[4], s.e[6], s.e[8], s.e[10]];
  let idx = 0;
  for (let i = 0; i < 6; i++) {
    let c = 0;
    for (let j = i + 1; j < 6; j++) if (p[j] < p[i]) c++;
    idx += c * FACT[5 - i];
  }
  let flips = 0;
  for (let i = 0; i < 6; i++) flips |= s.e[i * 2 + 1] << i;
  return (idx * 64 + flips) * 27 + (s.c[0] * 9 + s.c[1] * 3 + s.c[2]);
}
const SPACE = 720 * 64 * 27;

function buildDist() {
  const dist = new Int8Array(SPACE).fill(-1);
  let frontier = [solvedState()];
  dist[stateIndex(frontier[0])] = 0;
  let d = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const f of "URLB") {
        for (const inv of [false, true]) {
          const t = copyState(s);
          applyMove(t, f, inv);
          const i = stateIndex(t);
          if (dist[i] === -1) {
            dist[i] = d + 1;
            next.push(t);
          }
        }
      }
    }
    frontier = next;
    d++;
  }
  return dist;
}

// inverse of stateIndex: decode an index back into a state
function unindex(ix) {
  let i = ix;
  const cval = i % 27; i = (i - cval) / 27;
  const flips = i % 64; const pr = (i - flips) / 64;
  const avail = [0, 1, 2, 3, 4, 5], p = [];
  let r = pr;
  for (let k = 0; k < 6; k++) { const f = FACT[5 - k]; const d = Math.floor(r / f); r -= d * f; p.push(avail.splice(d, 1)[0]); }
  const e = new Array(12);
  for (let k = 0; k < 6; k++) { e[k * 2] = p[k]; e[k * 2 + 1] = (flips >> k) & 1; }
  return { e, c: [Math.floor(cval / 9), Math.floor(cval / 3) % 3, cval % 3] };
}
const bottomEdgesPlaced = (s) => [3, 4, 5].reduce((g, dd) => g + (s.e[dd * 2] === dd && s.e[dd * 2 + 1] === 0 ? 1 : 0), 0) >= 2;
// Solution Trainer goal (the "V"): >=2 of the bottom edges (DF/DL/DR) placed and centers solved
const isVState = (s) => !s.c[0] && !s.c[1] && !s.c[2] && bottomEdgesPlaced(s);
// TL4E-B goal: a V with exactly the center OPPOSITE the open bottom slot twisted
// (others solved). B twisted <-> DL+DR solved (DF open); L <-> DF+DL (DR open);
// R <-> DF+DR (DL open). Slots: DF=3, DL=4, DR=5; centers c=[L,R,B].
const edgeSolved = (s, slot) => s.e[slot * 2] === slot && s.e[slot * 2 + 1] === 0;
const isTL4EState = (s) =>
  (s.c[2] && !s.c[0] && !s.c[1] && edgeSolved(s, 4) && edgeSolved(s, 5)) ||
  (s.c[0] && !s.c[1] && !s.c[2] && edgeSolved(s, 3) && edgeSolved(s, 4)) ||
  (s.c[1] && !s.c[0] && !s.c[2] && edgeSolved(s, 3) && edgeSolved(s, 5));
// multi-source BFS: distance from every reachable state to the nearest goal (max ~7)
function buildGoalDist(dist, isGoal) {
  const vdist = new Int8Array(SPACE).fill(-1);
  let frontier = [];
  for (let i = 0; i < SPACE; i++) {
    if (dist[i] < 0) continue;
    const s = unindex(i);
    if (isGoal(s)) { vdist[i] = 0; frontier.push(s); }
  }
  let d = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) for (const f of "URLB") for (const inv of [false, true]) {
      const t = copyState(s); applyMove(t, f, inv);
      const i = stateIndex(t);
      if (vdist[i] === -1) { vdist[i] = d + 1; next.push(t); }
    }
    frontier = next; d++;
  }
  return vdist;
}
// group reachable state indices by their V-distance (1..7), so any target
// length can be sampled directly (random scrambles can't reliably hit len 7)
function buildVBuckets(dist, vdist) {
  const buckets = Array.from({ length: 8 }, () => []);
  for (let i = 0; i < SPACE; i++) { if (dist[i] < 0) continue; buckets[vdist[i]].push(i); }
  return buckets;
}
// ---------- pseudo offsets (shared by Recog + Pseudo V) ----------
// parse "L, R', L R'" into move sequences (each <=4 plain moves); null if invalid/empty
function parsePseudoOffsets(str) {
  const parts = String(str).split(",").map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const toks = p.split(/\s+/).filter(Boolean);
    if (!toks.length || toks.length > 4) return null;
    const moves = [];
    for (const t of toks) {
      const m = t.match(/^([URLB])(['2]?)$/);
      if (!m) return null;
      moves.push({ f: m[1], inv: !!m[2] });
    }
    out.push({ str: p, moves });
  }
  return out.length ? out : null;
}
// apply a plain-move string ("R U' L2") to a state
function applyMoveString(str, s) {
  const t = copyState(s);
  for (const tok of String(str).trim().split(/\s+/).filter(Boolean)) {
    const m = tok.match(/^([URLB])(['2]?)$/);
    if (m) applyMove(t, m[1], !!m[2]);
  }
  return t;
}
// inverse of an offset as a move string (reverse + flip each turn)
function invertOffsetTokens(off) {
  return off.moves.slice().reverse().map((m) => m.f + (m.inv ? "" : "'")).join(" ");
}
// net U-center twist implied by a move string (for rendering)
function uTwistOf(str) {
  let u = 0;
  for (const t of String(str).trim().split(/\s+/).filter(Boolean)) if (t[0] === "U") u = (u + (t.includes("'") ? 2 : 1)) % 3;
  return u;
}
// Pseudo V distance: like buildVDist, but the goal is a pseudo V — a state from
// which [L4E alg] + [offset] solves (the offset is the LAST move, per the
// R U R' L convention). For a real-V state v solved by alg A, the pseudo V is
// invert(A) applied to W = (offset inverse on solved); then multi-source BFS.
function buildPseudoVDist(vSeeds, offs, dist) {
  const pv = new Int8Array(SPACE).fill(-1);
  let frontier = [];
  for (const o of offs) {
    const W = applyMoveString(invertOffsetTokens(o), solvedState());  // O^-1 on solved
    for (const vi of vSeeds) {
      const A = solveMoves(unindex(vi), dist);   // an L4E alg solving this V state
      if (!A) continue;
      const seed = copyState(W);                 // apply invert(A): reversed, each move flipped
      for (let k = A.length - 1; k >= 0; k--) { const mi = A[k] ^ 1; applyMove(seed, MOVE_NAMES[mi][0], MOVE_NAMES[mi].includes("'")); }
      const i = stateIndex(seed);
      if (pv[i] === -1) { pv[i] = 0; frontier.push(seed); }
    }
  }
  let d = 0;
  while (frontier.length) {
    const next = [];
    for (const s of frontier) for (const f of "URLB") for (const inv of [false, true]) {
      const t = copyState(s); applyMove(t, f, inv);
      const i = stateIndex(t);
      if (pv[i] === -1) { pv[i] = d + 1; next.push(t); }
    }
    frontier = next; d++;
  }
  return pv;
}
// distance to the UNION of several goal sets = elementwise min of their tables
function combineDists(tables) {
  const out = new Int8Array(SPACE).fill(-1);
  for (let i = 0; i < SPACE; i++) {
    let m = -1;
    for (const t of tables) { const d = t[i]; if (d >= 0 && (m < 0 || d < m)) m = d; }
    out[i] = m;
  }
  return out;
}

// randomized optimal solution: state -> solved, ties broken at random
function solveMoves(s, dist) {
  const path = [];
  let cur = copyState(s);
  let cd = dist[stateIndex(cur)];
  if (cd < 0) return null;
  while (cd > 0) {
    const opts = [];
    for (let mi = 0; mi < 8; mi++) {
      const t = copyState(cur);
      applyMove(t, MOVE_NAMES[mi][0], MOVE_NAMES[mi].includes("'"));
      if (dist[stateIndex(t)] === cd - 1) opts.push([mi, t]);
    }
    const pick = opts[Math.floor(Math.random() * opts.length)];
    path.push(pick[0]);
    cur = pick[1];
    cd--;
  }
  return path;
}
// merge/cancel adjacent same-face moves (turn counts mod 3)
function pushMove(out, mi) {
  while (out.length && (out[out.length - 1] >> 1) === (mi >> 1)) {
    const a = out.pop();
    const sum = ((a & 1 ? 2 : 1) + (mi & 1 ? 2 : 1)) % 3;
    if (sum === 0) return;
    mi = (mi & ~1) | (sum === 2 ? 1 : 0);
  }
  out.push(mi);
}
// masked scramble: a fresh random sequence every call, length decorrelated
// from case difficulty, so the scramble itself never identifies the case.
// M = A · B with B a random walk and A a randomized-optimal solve to B^-1(target).
function maskedScramble(target, dist) {
  const d0 = dist[stateIndex(target)];
  if (d0 < 0) return null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const k = Math.max(2, 9 - d0) + Math.floor(Math.random() * 2);
    const B = [];
    let lastFace = -1;
    for (let i = 0; i < k; i++) {
      let mi;
      do { mi = Math.floor(Math.random() * 8); } while ((mi >> 1) === lastFace);
      lastFace = mi >> 1;
      B.push(mi);
    }
    const T2 = copyState(target);
    for (let i = B.length - 1; i >= 0; i--) {
      const inv = B[i] ^ 1;
      applyMove(T2, MOVE_NAMES[inv][0], MOVE_NAMES[inv].includes("'"));
    }
    const sol = solveMoves(T2, dist);
    if (!sol) continue;
    const out = [];
    for (let i = sol.length - 1; i >= 0; i--) pushMove(out, sol[i] ^ 1);
    for (const mi of B) pushMove(out, mi);
    if (out.length >= 8 && out.length <= 11) return out.map((mi) => MOVE_NAMES[mi]).join(" ");
  }
  const sol = solveMoves(target, dist);
  if (!sol) return null;
  const out = [];
  for (let i = sol.length - 1; i >= 0; i--) pushMove(out, sol[i] ^ 1);
  return out.map((mi) => MOVE_NAMES[mi]).join(" ");
}

// frame rotation [u]: re-express a DL-frame case with the bar at DR (1x) or DF (2x)
const ROT_TO = [2, 0, 1, 4, 5, 3];
const ROT_D = [0, 1, 1, 0, 0, 0];
function rotateFrame(s, times) {
  for (let t = 0; t < ((times % 3) + 3) % 3; t++) {
    const e = s.e.slice();
    for (let src = 0; src < 6; src++) {
      const p = e[src * 2];
      const dst = ROT_TO[src];
      s.e[dst * 2] = ROT_TO[p];
      s.e[dst * 2 + 1] = e[src * 2 + 1] ^ ROT_D[src] ^ ROT_D[p];
    }
  }
  return s;
}
const BAR_ROT = { DL: 0, DR: 1, DF: 2 };
// L4E angle: the canonical L4E case has the open slot at the front (DF). ML4E-R
// / ML4E-L are the SAME cases viewed from another angle (a frame rotation), so
// presenting at the right/left slot is just a rotation of the front case.
const L4E_ROT = { DF: 0, DL: 1, DR: 2 };

// ---------- state enumeration ----------
function permutationsOf(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = arr.slice(0, i).concat(arr.slice(i + 1));
    for (const p of permutationsOf(rest)) out.push([arr[i]].concat(p));
  }
  return out;
}
function permParity(p) {
  let par = 0;
  const seen = new Array(p.length).fill(false);
  for (let i = 0; i < p.length; i++) {
    if (seen[i]) continue;
    let j = i, len = 0;
    while (!seen[j]) { seen[j] = true; j = p[j]; len++; }
    par ^= (len - 1) & 1;
  }
  return par;
}
// scramble `freeSlots`, keep every other edge solved
function enumerateSpace(freeSlots) {
  const out = [];
  const fixed = [0, 1, 2, 3, 4, 5].filter((s) => !freeSlots.includes(s));
  for (const perm of permutationsOf(freeSlots)) {
    const full = [0, 1, 2, 3, 4, 5];
    freeSlots.forEach((slot, i) => { full[slot] = perm[i]; });
    if (permParity(full) !== 0) continue;
    const n = freeSlots.length;
    for (let bits = 0; bits < 1 << n; bits++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += (bits >> i) & 1;
      if (sum % 2) continue;
      const e = [];
      for (let slot = 0; slot < 6; slot++) {
        const fi = freeSlots.indexOf(slot);
        e.push(full[slot], fi >= 0 ? (bits >> fi) & 1 : 0);
      }
      out.push({ e, c: [0, 0, 0] });
    }
  }
  return out;
}

// ---------- sets ----------
const SETS = [
  { id: "bad-layers", name: "Bad Layers", group: "L5E", color: "#cf4d44" },
  { id: "kl5e", name: "KL5E", group: "L5E", color: "#3577cc" },
  { id: "bl5e", name: "BL5E", group: "L5E", color: "#27975a" },
  { id: "ht", name: "Heads / Tails", group: "L5E", color: "#9355bd" },
  { id: "yy", name: "Yin / Yang", group: "L5E", color: "#cd7c20" },
  { id: "l4e", name: "L4E", group: "L4E", color: "#74882b" },
];
const SET_BY_ID = Object.fromEntries(SETS.map((s) => [s.id, s]));
const L5E_IDS = SETS.filter((s) => s.group === "L5E").map((s) => s.id);
const ALL_IDS = SETS.map((s) => s.id);

const realCanonKey = (st, t) => {
  const base = copyState(st);
  let best = null;
  for (let r = 0; r < 3; r++) {
    const cur = copyState(base);
    for (let a = 0; a < 3; a++) {
      const s = stateKey(cur) + "|" + ((t + a) % 3);
      if (best === null || s < best) best = s;
      applyMove(cur, "U", false);
    }
    rotateFrame(base, 1);
  }
  return best;
};

function buildPools() {
  const pools = {};
  const add = (setId, st, t) => {
    const rc = realCanonKey(st, t);
    if (!SHEET.CNAME[rc]) return; // only cases the sheet defines
    if (!pools[setId]) pools[setId] = { classes: new Map(), states: [] };
    if (!pools[setId].classes.has(rc)) pools[setId].classes.set(rc, []);
    pools[setId].classes.get(rc).push({ st, t });
    pools[setId].states.push({ caseKey: rc, st, t });
  };
  // L5E: DL solved, other five scrambled; sets from the verified classmap
  for (const st of enumerateSpace([0, 1, 2, 3, 5])) {
    const cls = CLASSMAP[aufCanonKey(st)];
    if (!cls || !SET_BY_ID[cls]) continue;
    for (let t = 0; t < 3; t++) add(cls, st, t);
  }
  // L4E family, keyed by which D slot is open (bar selector picks the flavor):
  // l4e-DF = classic L4E (DF + uppers scrambled, LL included)
  // l4e-DR = ML4E right slot (DR + uppers), l4e-DL = ML4E left slot (DL + uppers)
  for (const st of enumerateSpace([0, 1, 2, 3])) {
    for (let t = 0; t < 3; t++) add("l4e-DF", st, t);
  }
  for (const [poolId, slots, dEdge] of [["l4e-DR", [0, 1, 2, 5], 5], ["l4e-DL", [0, 1, 2, 4], 4]]) {
    for (const st of enumerateSpace(slots)) {
      if (st.e[dEdge * 2] === dEdge && st.e[dEdge * 2 + 1] === 0) continue;
      for (let t = 0; t < 3; t++) add(poolId, st, t);
    }
  }
  return pools;
}

// ---------- pyraminx state image ----------
// Render through the shared site renderer (js/render.js -> window.OORender) so
// the trainer's diagrams are IDENTICAL to the rest of pyraminx.net — same
// geometry, colors and the bottom-face inset — instead of duplicating the
// drawing code here. The trainer's state {e,c} plus uTwist maps directly onto
// the engine state (engine G4 === the old FACEMAP, same e/c layout), so we only
// have to pass u: uTwist.
function PyraminxNet({ state, uTwist }) {
  const R = typeof window !== "undefined" ? window.OORender : null;
  const html = R ? R.netSVG({ e: state.e, c: state.c, u: uTwist || 0 }, 240, { cls: "pyrasvg", thumb: true }) : "";
  return <div className="pyranet" dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---------- helpers ----------
const fmt = (ms) => (ms / 1000).toFixed(2);
const shuffled = (a) => {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const STORE_KEY = "l5e-trainer-v2";
// Per-case selection is keyed by case NAME (one entry per named case), since a
// named case spans several canonical states (mirror/rotation/AUF variants).
const CASE_SEP = "";

// Solution Trainer goal types: the user picks any combination and the trainer
// solves to the UNION of the selected goals. Order here is the display order
// and the canonical order for the combined-table cache key.
// Presentation-angle menus (multi-select), replacing the old triangle icon.
// L5E: which bottom bar stays solved. L4E: which slot is the open/working slot.
const L5E_BARS = [
  { id: "DL", label: "Left" },
  { id: "DR", label: "Right" },
  { id: "DF", label: "Front" },
];
const L4E_SLOTS = [
  { id: "DF", label: "Front (L4E)" },
  { id: "DR", label: "Right (ML4E-R)" },
  { id: "DL", label: "Left (ML4E-L)" },
];

const GOAL_TYPES = [
  { id: "v", label: "V" },
  { id: "pv", label: "Pseudo V" },
  { id: "tl4e", label: "TL4E-B" },
];
const goalsKeyOf = (goals) => GOAL_TYPES.filter((g) => goals.has(g.id)).map((g) => g.id).join(",");
const keyToState = (ck) => ({ e: ck.split(",").flatMap((t) => [+t[0], +t[1]]), c: [0, 0, 0] });
const displayState = (caseKey, setId, bar) => {
  // rotate the canonical case into the frame matching the active bar
  let st = keyToState(caseKey.split("|")[0]);
  const fits = (s) => {
    const k = stateKey(s);
    return setId === "l4e" ? openOfEkey(k) === bar : barOfEkey(k) === bar;
  };
  for (let r = 0; r < 3; r++) {
    if (fits(st)) return st;
    st = rotateFrame(st, 1);
  }
  return st;
};

const SHEET = __sheet.SHEET; // single source: js/sheet.js
const BAR_LABEL = { DL: "bar on left", DR: "bar on right", DF: "bar on front" };
const L4E_LABEL = { DF: "L4E", DR: "ML4E-R", DL: "ML4E-L" };
const openOfEkey = (ek) => {
  const p = ek.split(",");
  if (p[3] !== "30") return "DF";
  if (p[5] !== "50") return "DR";
  if (p[4] !== "40") return "DL";
  return "";
};
const barOfEkey = (ek) => {
  const p = ek.split(",");
  if (p[4] === "40") return "DL";
  if (p[5] === "50") return "DR";
  if (p[3] === "30") return "DF";
  return "";
};
const lookupName = (render, uTwist, caseKey) => {
  // exact angle first, then the AUF-rotations of the same real case, then class label
  const t = copyState(render);
  for (let k = 0; k < 3; k++) {
    const nm = SHEET.NAME[stateKey(t) + "|" + ((uTwist + k) % 3)];
    if (nm) return nm;
    applyMove(t, "U", false);
  }
  return SHEET.CNAME[caseKey] || null;
};
function algGroups(render, uTwist) {
  const groups = [];
  const collect = (label, st, tw) => {
    const exact = SHEET.ALG[stateKey(st) + "|" + tw] || [];
    if (exact.length) groups.push({ label, exact });
  };
  collect("This angle", render, uTwist);
  const u = copyState(render); applyMove(u, "U", false);
  collect("Do U first, then", u, (uTwist + 1) % 3);
  const up = copyState(render); applyMove(up, "U", true);
  collect("Do U' first, then", up, (uTwist + 2) % 3);
  return groups;
}

function AlgList({ exact }) {
  return (
    <div className="alglist">
      {exact.map(([a, nm], i) => (
        <div key={"e" + i} className="algrow">
          <span className="mono alg">{a}</span>
          {nm ? <span className="algname">{nm}</span> : null}
        </div>
      ))}
    </div>
  );
}

function AlgPanel({ panel, onClose }) {
  const set = SET_BY_ID[panel.set];
  let title, body;
  if (panel.kind === "live") {
    title = lookupName(panel.render, panel.uTwist, panel.caseKey) || "Unnamed case";
    const groups = algGroups(panel.render, panel.uTwist);
    body = (
      <>
        <div className="panelimg"><PyraminxNet state={panel.render} uTwist={panel.uTwist} /></div>
        {groups.length === 0 ? (
          <div className="empty">No algs in the sheet for this state yet.</div>
        ) : groups.map((g, i) => (
          <div key={i} className="alggroup">
            <div className="grouphead">{g.label}</div>
            <AlgList exact={g.exact} />
          </div>
        ))}
      </>
    );
  } else {
    title = SHEET.CNAME[panel.caseKey] || "Unnamed case";
    const pres = SHEET.PRES[panel.caseKey] || [];
    body = pres.length === 0 ? (
      <div className="empty">No sheet entries for this case yet.</div>
    ) : pres.map(([ek, tw, nm], i) => (
      <div key={i} className="alggroup presrow">
        <div className="panelimg small"><PyraminxNet state={keyToState(ek)} uTwist={tw} /></div>
        <div className="presbody">
          <div className="grouphead">{nm} <span className="bartag">{panel.set === "l4e" ? (L4E_LABEL[openOfEkey(ek)] || "") : (BAR_LABEL[barOfEkey(ek)] || "")}</span></div>
          <AlgList exact={SHEET.ALG[ek + "|" + tw] || []} />
        </div>
      </div>
    ));
  }
  return (
    <div className="overlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modalhead">
          <div>
            <div className="modaltitle">{title}</div>
            <span className="tag" style={{ "--cdot": set.color }}><span className="dot" />{set.name}</span>
          </div>
          <button className="closebtn" onClick={onClose}>{"\u00d7"}</button>
        </div>
        {body}
      </div>
    </div>
  );
}

export default function L5ETrainer() {
  const distRef = useRef(null);
  const vdistRef = useRef(null);
  const vbucketsRef = useRef(null);
  const pseudoVdistRef = useRef(null);
  const pseudoVbucketsRef = useRef(null);
  const pseudoVForRef = useRef(null);   // the offsets string the pseudo-V table was built for
  const tl4eDistRef = useRef(null);
  const tl4eBucketsRef = useRef(null);
  const combinedDistRef = useRef(null);
  const combinedBucketsRef = useRef(null);
  const combinedForRef = useRef(null);   // offsets string the combined table was built for
  const committedPso = useRef("L, R'");  // offsets the current scramble was generated with
  const poolsRef = useRef(null);
  const [ready, setReady] = useState(false);

  const [l5eBars, setL5eBars] = useState(() => new Set(["DL"]));  // L5E bar orientations to drill
  const [l4eSlots, setL4eSlots] = useState(() => new Set(["DF"])); // L4E open-slot angles to drill
  const [selected, setSelected] = useState(() => new Set(L5E_IDS));
  const [mode, setMode] = useState("drill");
  const [vlenSel, setVlenSel] = useState(() => new Set([3, 4, 5, 6])); // target solution lengths (Solution Trainer)
  const [goals, setGoals] = useState(() => new Set(["v", "pv", "tl4e"])); // which goal types the Solution union includes
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [current, setCurrent] = useState(null); // {scramble, set, caseKey, render, uTwist}
  const [phase, setPhase] = useState("ready");
  const [elapsed, setElapsed] = useState(0);
  const [last, setLast] = useState(null);
  const [caseStats, setCaseStats] = useState({});
  const [vfs, setVfs] = useState({});            // Solution Trainer accuracy, keyed by solution length
  const [guessMsg, setGuessMsg] = useState("");  // Solution Trainer: transient "too low" message
  const [pso, setPso] = useState("L, R'");       // pseudo offsets, shared by Recog + Pseudo V
  const [session, setSession] = useState([]);
  const [recap, setRecap] = useState(null);
  const [expandedSet, setExpandedSet] = useState(null);
  const [panel, setPanel] = useState(null);
  const [caseSel, setCaseSel] = useState(() => new Set()); // DISABLED cases "setId|caseKey" (default: all enabled)
  const [caseKnown, setCaseKnown] = useState(() => new Set()); // KNOWN cases (same keying); default: all unknown
  const [scope, setScope] = useState("all");               // practice scope: "all" | "learning" | "known"
  const [caseBrowser, setCaseBrowser] = useState(null);    // which set's case list is open in the picker

  const t0 = useRef(0);
  const raf = useRef(0);
  const stoppedAt = useRef(0);
  const loadedStore = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(STORE_KEY);
        if (res && res.value && !cancelled) {
          const d = JSON.parse(res.value);
          if (d.caseStats) {
            const migrated = {};
            for (const [ck, st] of Object.entries(d.caseStats)) {
              if (!ck.includes("|")) continue; // legacy edges-only stats predate twist-distinct cases
              migrated[ck] = st.set === "ml4e" ? { ...st, set: "l4e" } : st;
            }
            setCaseStats(migrated);
          }
          if (Array.isArray(d.l5eBars)) setL5eBars(new Set(d.l5eBars.filter((x) => x in BAR_ROT))); // may be empty (nothing selected)
          else if (d.bar && d.bar in BAR_ROT) setL5eBars(new Set([d.bar])); // migrate legacy single bar
          if (Array.isArray(d.l4eSlots)) setL4eSlots(new Set(d.l4eSlots.filter((x) => x in L4E_ROT)));
          if (Array.isArray(d.selected)) setSelected(new Set(d.selected.filter((id) => SET_BY_ID[id])));
          if (["drill", "recap", "solution", "recog"].includes(d.mode)) setMode(d.mode);
          if (typeof d.pso === "string") setPso(d.pso);
          if (Array.isArray(d.vlen)) setVlenSel(new Set(d.vlen.filter((n) => n >= 1 && n <= 7)));
          if (Array.isArray(d.goals)) { const g = d.goals.filter((x) => GOAL_TYPES.some((t) => t.id === x)); if (g.length) setGoals(new Set(g)); }
          if (Array.isArray(d.caseSel)) setCaseSel(new Set(d.caseSel.filter((k) => typeof k === "string" && SET_BY_ID[k.split(CASE_SEP)[0]])));
          if (Array.isArray(d.caseKnown)) setCaseKnown(new Set(d.caseKnown.filter((k) => typeof k === "string" && SET_BY_ID[k.split(CASE_SEP)[0]])));
          if (["all", "learning", "known"].includes(d.scope)) setScope(d.scope);
          if (d.vfs && typeof d.vfs === "object") {
            const v = {};
            for (const [k, st] of Object.entries(d.vfs)) if (/^[1-7]$/.test(k)) v[k] = st;
            setVfs(v);
          }
        }
      } catch (e) { /* first run */ }
      loadedStore.current = true;
      setTimeout(() => {
        if (cancelled) return;
        distRef.current = buildDist();
        vdistRef.current = buildGoalDist(distRef.current, isVState);
        vbucketsRef.current = buildVBuckets(distRef.current, vdistRef.current);
        tl4eDistRef.current = buildGoalDist(distRef.current, isTL4EState);
        tl4eBucketsRef.current = buildVBuckets(distRef.current, tl4eDistRef.current);
        poolsRef.current = buildPools();
        setReady(true);
      }, 40);
    })();
    return () => { cancelled = true; };
  }, []);

  const saveTimer = useRef(0);
  useEffect(() => {
    if (!loadedStore.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.storage.set(STORE_KEY, JSON.stringify({ caseStats, l5eBars: [...l5eBars], l4eSlots: [...l4eSlots], selected: [...selected], mode, vlen: [...vlenSel], goals: [...goals], caseSel: [...caseSel], caseKnown: [...caseKnown], scope, vfs, pso })).catch(() => {});
      } catch (e) {}
    }, 400);
  }, [caseStats, l5eBars, l4eSlots, selected, mode, vlenSel, goals, caseSel, caseKnown, scope, vfs, pso]);

  const makeScramble = useCallback((setId, caseKey, presArr) => {
    // present the case at a randomly chosen selected angle (bar for L5E, open
    // slot for L4E); both are frame rotations of the canonical case.
    const angles = setId === "l4e" ? [...l4eSlots] : [...l5eBars];
    const rotMap = setId === "l4e" ? L4E_ROT : BAR_ROT;
    const fallback = setId === "l4e" ? "DF" : "DL";
    let physical = null, scramble = null, uTwist = 0, target = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      const pres = presArr[Math.floor(Math.random() * presArr.length)];
      const angle = angles.length ? angles[Math.floor(Math.random() * angles.length)] : fallback;
      physical = rotateFrame(copyState(pres.st), rotMap[angle] || 0);
      target = pres.t;
      scramble = maskedScramble(physical, distRef.current);
      if (!scramble) continue;
      uTwist = 0;
      for (const t of scramble.split(" ")) {
        if (t[0] === "U") uTwist = (uTwist + (t.includes("'") ? 2 : 1)) % 3;
      }
      if (uTwist === target) break;
    }
    // if the generator could not hit the target twist, report the case actually shown
    const ck = scramble && uTwist === target ? caseKey : realCanonKey(physical, uTwist);
    return { scramble, set: setId, caseKey: ck, render: physical, uTwist };
  }, [l4eSlots, l5eBars]);

  const poolOf = useCallback((id) => {
    const pools = poolsRef.current;
    // L4E always uses the front (DF) case set; ML4E-R/-L are angles, not pools.
    return id === "l4e" ? pools["l4e-DF"] : pools[id];
  }, []);

  // Per-case selection, keyed by case NAME. caseSel holds DISABLED case names,
  // so a case is generated unless it's explicitly turned off (new cases default
  // to on). A single named case spans several canonical states (mirror /
  // rotation / AUF variants); they are toggled together as one case.
  // (Declared before nextDrill/startRecap, which reference casesOf in their deps.)
  const nmId = (setId, name) => setId + CASE_SEP + name;
  const caseEnabled = (setId, name) => !caseSel.has(nmId(setId, name));
  const toggleCase = (setId, name) => {
    setCaseSel((s) => { const n = new Set(s); const k = nmId(setId, name); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };
  // a set's named cases (deduped, sorted by name); each carries its state keys
  const casesOf = useCallback((setId) => {
    const p = poolOf(setId); if (!p) return [];
    const byName = new Map();
    for (const ck of p.classes.keys()) {
      const name = SHEET.CNAME[ck] || ck;
      // L4E: ML4E-named cases are the same L4E cases from another angle — drop
      // them; the slot menu handles presenting the L4E cases from other slots.
      if (setId === "l4e" && /^ML4E/.test(name)) continue;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(ck);
    }
    return [...byName.entries()].map(([name, keys]) => ({ name, keys }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [poolOf]);
  const setAllCases = (setId, enable) => {
    setCaseSel((s) => {
      const n = new Set(s);
      for (const { name } of casesOf(setId)) { const k = nmId(setId, name); if (enable) n.delete(k); else n.add(k); }
      return n;
    });
  };
  const enabledCount = useCallback((setId) => {
    const all = casesOf(setId);
    return all.length - all.filter(({ name }) => caseSel.has(nmId(setId, name))).length;
  }, [casesOf, caseSel]);

  // Per-case "known" status (manual). Mirrors caseSel; caseKnown holds KNOWN
  // names, so a case is unknown unless explicitly marked.
  const caseIsKnown = (setId, name) => caseKnown.has(nmId(setId, name));
  const toggleKnown = (setId, name) => {
    setCaseKnown((s) => { const n = new Set(s); const k = nmId(setId, name); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };
  const setAllKnown = (setId, known) => {
    setCaseKnown((s) => {
      const n = new Set(s);
      for (const { name } of casesOf(setId)) { const k = nmId(setId, name); if (known) n.add(k); else n.delete(k); }
      return n;
    });
  };
  const knownCount = useCallback((setId) =>
    casesOf(setId).filter(({ name }) => caseKnown.has(nmId(setId, name))).length, [casesOf, caseKnown]);
  // identity of the just-solved drill/recap case (last, not current — stopTimer
  // already advanced current). null for recog/solution (no named-case identity).
  const lastKnownId = () => {
    if (!last || last.kind || !last.set) return null;
    const name = SHEET.CNAME[last.caseKey] || last.caseKey;
    return { setId: last.set, name, key: nmId(last.set, name) };
  };

  const nextDrill = useCallback(() => {
    // enabled classes only, weighted by how many physical states each holds
    const entries = [];
    for (const id of selected) {
      const pool = poolOf(id); if (!pool) continue;
      if ((id === "l4e" ? l4eSlots : l5eBars).size === 0) continue; // no presentation angle picked
      for (const [ck, sts] of pool.classes) {
        const name = SHEET.CNAME[ck] || ck;
        if (id === "l4e" && /^ML4E/.test(name)) continue;
        if (caseSel.has(id + CASE_SEP + name)) continue;
        const kn = caseKnown.has(id + CASE_SEP + name);
        if (scope === "learning" && kn) continue;
        if (scope === "known" && !kn) continue;
        entries.push({ id, ck, sts });
      }
    }
    const total = entries.reduce((a, e) => a + e.sts.length, 0);
    if (!total) { setCurrent(null); return; }
    let r = Math.floor(Math.random() * total);
    for (const e of entries) {
      if (r < e.sts.length) { setCurrent(makeScramble(e.id, e.ck, e.sts)); return; }
      r -= e.sts.length;
    }
  }, [selected, caseSel, caseKnown, scope, l4eSlots, l5eBars, makeScramble, poolOf]);

  const startRecap = useCallback(() => {
    // one entry per enabled named case (a representative state), so recap walks
    // each case once rather than every canonical variant
    const q = [];
    for (const id of [...selected]) {
      if (!poolOf(id)) continue;
      if ((id === "l4e" ? l4eSlots : l5eBars).size === 0) continue; // no presentation angle picked
      for (const { name, keys } of casesOf(id)) {
        if (caseSel.has(id + CASE_SEP + name)) continue;
        const kn = caseKnown.has(id + CASE_SEP + name);
        if (scope === "learning" && kn) continue;
        if (scope === "known" && !kn) continue;
        q.push({ set: id, caseKey: keys[0] });
      }
    }
    const queue = shuffled(q);
    setRecap({ queue, idx: 0 });
    if (queue.length) {
      const it = queue[0];
      setCurrent(makeScramble(it.set, it.caseKey, poolOf(it.set).classes.get(it.caseKey)));
    } else setCurrent(null);
  }, [selected, caseSel, caseKnown, scope, l4eSlots, l5eBars, casesOf, makeScramble, poolOf]);

  // Solution Trainer: every optimal solution (all shortest descents of vdist to a V)
  const allOptimalVs = useCallback((s, vdist) => {
    const out = [];
    const CAP = 200;
    const dfs = (cur, cd, path) => {
      if (out.length >= CAP) return;
      if (cd === 0) { out.push(path.map((mi) => MOVE_NAMES[mi]).join(" ")); return; }
      for (let mi = 0; mi < 8; mi++) {
        const t = copyState(cur); applyMove(t, MOVE_NAMES[mi][0], MOVE_NAMES[mi].includes("'"));
        if (vdist[stateIndex(t)] === cd - 1) { path.push(mi); dfs(t, cd - 1, path); path.pop(); }
      }
    };
    dfs(copyState(s), vdist[stateIndex(s)], []);
    return out;
  }, []);

  // Pick a target length, sample a state at that distance directly from the
  // bucket, and dress it with a masked scramble. Shared by the Solution Trainer
  // (V-distance buckets) and Pseudo V (pseudo-V-distance buckets).
  const makeBucketScramble = useCallback((lenSet, buckets, kind) => {
    const dist = distRef.current;
    if (!buckets || !lenSet) return null;
    const lens = [...lenSet].filter((L) => buckets[L] && buckets[L].length);
    if (!lens.length) return null;
    for (let attempt = 0; attempt < 200; attempt++) {
      const vlen = lens[Math.floor(Math.random() * lens.length)];
      const bucket = buckets[vlen];
      const st = unindex(bucket[Math.floor(Math.random() * bucket.length)]);
      const scramble = maskedScramble(st, dist);
      if (!scramble) continue;
      return { kind, scramble, render: st, uTwist: uTwistOf(scramble), vlen };
    }
    return null;
  }, []);

  // Solution Trainer (combined): the goal is the shortest first step of ANY
  // kind — a real V, a pseudo V (for the current offsets), or a TL4E-B. The
  // combined distance is the elementwise min of those three tables; rebuilt
  // when the offsets change (the pseudo-V part depends on them).
  const ensureSolution = useCallback(() => {
    if (!vdistRef.current || !tl4eDistRef.current) return;
    const offs = goals.has("pv") ? parsePseudoOffsets(pso) : null;
    const key = goalsKeyOf(goals) + "|" + (offs ? pso : "");
    if (combinedForRef.current === key && combinedDistRef.current) return;
    const tables = [];
    if (goals.has("v")) tables.push(vdistRef.current);
    if (goals.has("tl4e")) tables.push(tl4eDistRef.current);
    if (offs) {
      if (pseudoVForRef.current !== pso || !pseudoVdistRef.current) {
        pseudoVdistRef.current = buildPseudoVDist(vbucketsRef.current[0], offs, distRef.current);
        pseudoVForRef.current = pso;
      }
      tables.push(pseudoVdistRef.current);
    }
    combinedForRef.current = key;
    if (!tables.length) { combinedDistRef.current = null; combinedBucketsRef.current = null; return; }
    combinedDistRef.current = combineDists(tables);
    combinedBucketsRef.current = buildVBuckets(distRef.current, combinedDistRef.current);
  }, [pso, goals]);

  const nextSolution = useCallback(() => {
    setPhase("ready"); setLast(null); setGuessMsg("");
    committedPso.current = pso;
    ensureSolution();
    setCurrent(combinedBucketsRef.current ? makeBucketScramble(vlenSel, combinedBucketsRef.current, "solution") : null);
  }, [ensureSolution, makeBucketScramble, vlenSel, pso]);

  // Solution Trainer: grade the picked move count.
  //   below optimal -> impossible: show an error, keep the same scramble (no reveal)
  //   == optimal     -> correct
  //   above optimal  -> a valid but non-optimal answer
  // For any answer >= optimal we reveal every optimal solution and advance.
  const submitGuess = useCallback((n) => {
    if (!current || current.kind !== "solution" || phase === "stopped") return;
    if (n < current.vlen) {
      setGuessMsg(`No solution in ${n} ${n === 1 ? "move" : "moves"} — the shortest is longer. Keep looking.`);
      return;
    }
    const correct = n === current.vlen;
    setGuessMsg("");
    setLast({ kind: "solution", guess: n, correct, vlen: current.vlen, render: current.render, uTwist: current.uTwist, sols: allOptimalVs(current.render, combinedDistRef.current), goalsLabel: GOAL_TYPES.filter((g) => goals.has(g.id)).map((g) => g.label).join(" · ") });
    setPhase("stopped");
    setSession((s) => [...s.slice(-49), { kind: "solution", correct, vlen: current.vlen }]);
    setVfs((v) => {
      const key = String(current.vlen);
      const prev = v[key] || { n: 0, correct: 0 };
      return { ...v, [key]: { n: prev.n + 1, correct: prev.correct + (correct ? 1 : 0) } };
    });
  }, [current, phase, allOptimalVs, goals]);

  // Recog (Feature 1): pseudo L4E recognition, setup-move framing. The pseudo
  // state is a home-bar L4E case with the offset applied to it, so undoing one
  // offset move returns to the clean case at the SAME AUF. We then mask the
  // scramble (so it doesn't telegraph the offset) while pinning its net U to
  // the case AUF, so the pseudo and the revealed case line up on screen.
  const makeRecog = useCallback((psoStr) => {
    const offs = parsePseudoOffsets(psoStr);
    const pool = poolsRef.current && poolsRef.current["l4e-DF"];
    if (!offs || !pool || !pool.states.length) return null;
    for (let attempt = 0; attempt < 25; attempt++) {
      const pres = pool.states[Math.floor(Math.random() * pool.states.length)];
      const base = makeScramble("l4e", pres.caseKey, pool.classes.get(pres.caseKey));
      if (!base || !base.scramble) continue;
      const off = offs[Math.floor(Math.random() * offs.length)];
      const render = applyMoveString(off.str, base.render);   // pseudo = case . offset
      let scramble = null;
      for (let k = 0; k < 16; k++) {
        const s = maskedScramble(render, distRef.current);
        if (!s) break;
        if (uTwistOf(s) === base.uTwist) { scramble = s; break; }   // match the case AUF
      }
      if (!scramble) continue;
      return { kind: "recog", scramble, render, uTwist: base.uTwist,
        caseKey: base.caseKey, offsetStr: off.str, caseRender: base.render, caseTwist: base.uTwist };
    }
    return null;
  }, [makeScramble]);

  const nextRecog = useCallback(() => {
    committedPso.current = pso;
    setPhase("ready"); setLast(null);
    setCurrent(makeRecog(pso));
  }, [makeRecog, pso]);

  const revealRecog = useCallback(() => {
    if (!current || current.kind !== "recog") return;
    setLast({ kind: "recog", caseKey: current.caseKey, offsetStr: current.offsetStr,
      caseRender: current.caseRender, caseTwist: current.caseTwist });
    setPhase("stopped");
  }, [current]);

  // regenerate the current scramble when offsets actually change (on blur)
  const commitOffsets = useCallback(() => {
    if (pso === committedPso.current) return;
    if (mode === "solution") nextSolution();
    else if (mode === "recog") nextRecog();
  }, [pso, mode, nextSolution, nextRecog]);

  const advance = useCallback(() => {
    if (mode === "solution") { nextSolution(); return; }
    if (mode === "recog") { nextRecog(); return; }
    if (mode === "drill") { nextDrill(); return; }
    setRecap((r) => {
      if (!r) return r;
      const idx = r.idx + 1;
      if (idx >= r.queue.length) { setCurrent(null); return { ...r, idx }; }
      const it = r.queue[idx];
      setCurrent(makeScramble(it.set, it.caseKey, poolOf(it.set).classes.get(it.caseKey)));
      return { ...r, idx };
    });
  }, [mode, nextDrill, nextSolution, nextRecog, makeScramble, poolOf]);

  useEffect(() => {
    if (!ready) return;
    setPhase("ready");
    setLast(null);
    if (mode === "solution") nextSolution();
    else if (mode === "recog") nextRecog();
    else if (mode === "drill") nextDrill();
    else startRecap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, l5eBars, l4eSlots, selected, mode, vlenSel, goals, caseSel, caseKnown, scope]);

  const tick = useCallback(() => {
    setElapsed(performance.now() - t0.current);
    raf.current = requestAnimationFrame(tick);
  }, []);
  const startTimer = useCallback(() => {
    if (!current || !current.scramble) return;
    t0.current = performance.now();
    setElapsed(0);
    setPhase("running");
    raf.current = requestAnimationFrame(tick);
  }, [current, tick]);
  const stopTimer = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const ms = performance.now() - t0.current;
    stoppedAt.current = performance.now();
    setElapsed(ms);
    setPhase("stopped");
    if (current) {
      const rec = { ms, set: current.set, caseKey: current.caseKey, render: current.render, uTwist: current.uTwist };
      setLast(rec);
      setSession((s) => [...s.slice(-49), rec]);
      setCaseStats((cs) => {
        const prev = cs[current.caseKey] || { n: 0, best: Infinity, sum: 0, set: current.set };
        return { ...cs, [current.caseKey]: { set: current.set, n: prev.n + 1, best: Math.min(prev.best, ms), sum: prev.sum + ms } };
      });
    }
    advance();
  }, [current, advance]);

  const trigger = useCallback(() => {
    if (!ready) return;
    if (phase === "running") { stopTimer(); return; }
    if (performance.now() - stoppedAt.current < 350) return;
    startTimer();
  }, [ready, phase, startTimer, stopTimer]);

  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;  // don't hijack keys while typing offsets
      if (panel) { if (e.code === "Escape") setPanel(null); return; }
      if (mode === "recog") {
        if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") {
          e.preventDefault();
          if (phase === "stopped") nextRecog(); else revealRecog();
        }
        return;
      }
      if (mode === "solution") {
        if (phase === "stopped") {
          if (e.code === "Space" || e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); nextSolution(); }
          return;
        }
        const m = e.code.match(/^(?:Digit|Numpad)([1-7])$/);
        if (m) { e.preventDefault(); submitGuess(+m[1]); }
        return;
      }
      if (phase === "stopped" && e.code === "KeyK") {  // mark the just-solved case known/unknown
        e.preventDefault();
        if (last && !last.kind && last.set) {
          const nm = last.set + CASE_SEP + (SHEET.CNAME[last.caseKey] || last.caseKey);
          setCaseKnown((s) => { const n = new Set(s); if (n.has(nm)) n.delete(nm); else n.add(nm); return n; });
        }
        return;
      }
      if (phase === "running") { e.preventDefault(); stopTimer(); return; }
      if (e.code === "Space") { e.preventDefault(); trigger(); }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [phase, trigger, stopTimer, panel, mode, submitGuess, nextSolution, nextRecog, revealRecog, last]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const setAgg = useMemo(() => {
    const agg = {};
    for (const st of Object.values(caseStats)) {
      const a = agg[st.set] || { n: 0, best: Infinity, sum: 0, cases: 0 };
      a.n += st.n; a.best = Math.min(a.best, st.best); a.sum += st.sum; a.cases += 1;
      agg[st.set] = a;
    }
    return agg;
  }, [caseStats]);

  const toggleSet = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  // presentation-angle menus (may be emptied -> nothing generates, shows a prompt)
  const toggleAngle = (setter) => (id) => setter((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const toggleL5eBar = toggleAngle(setL5eBars);
  const toggleL4eSlot = toggleAngle(setL4eSlots);

  const counts = useMemo(() => {
    if (!ready) return {};
    const c = {};
    for (const s of SETS) {
      if (poolOf(s.id)) c[s.id] = casesOf(s.id).length; // distinct named cases, not raw variants
    }
    return c;
  }, [ready, poolOf, casesOf]);

  const recapDone = mode === "recap" && recap && recap.idx >= recap.queue.length;

  const toggleVlen = (L) => {
    setVlenSel((s) => { const n = new Set(s); if (n.has(L)) n.delete(L); else n.add(L); return n; });
  };
  const toggleGoal = (g) => {
    setGoals((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; });
  };

  const resetStats = () => {
    setCaseStats({});
    setVfs({});
    setSession([]);
    setLast(null);
    try { window.storage.set(STORE_KEY, JSON.stringify({ caseStats: {}, l5eBars: [...l5eBars], l4eSlots: [...l4eSlots], selected: [...selected], mode, vlen: [...vlenSel], goals: [...goals], caseSel: [...caseSel], caseKnown: [...caseKnown], scope, vfs: {}, pso })).catch(() => {}); } catch (e) {}
  };

  return (
    <div className="app">

      <div className="frame">
        <header>
          <div className="brandrow">
            <div className="brand">V-First <span>Trainer</span></div>
          </div>
          <div className="spacer" />
          <button className="gear" onClick={() => setSettingsOpen((o) => !o)}>Settings</button>
        </header>

        {settingsOpen && (
          <div className="settings">
            <span>Stats persist between sessions.</span>
            <button className="danger" onClick={resetStats}>Reset all stats</button>
          </div>
        )}

        {mode !== "solution" && mode !== "recog" && (
          <>
            {["L5E", "L4E"].map((grp) => (
              <details key={grp} className="setgrp" open>
                <summary>
                  <span className="grouplabel" style={{ marginLeft: 0 }}>{grp}</span>
                  <span className="ct">{SETS.filter((s) => s.group === grp && selected.has(s.id)).length} on</span>
                </summary>
                <div className="chips" style={{ marginTop: 8 }}>
                  {SETS.filter((s) => s.group === grp).map((s) => (
                    <button key={s.id} className={"chip" + (selected.has(s.id) ? " on" : "")}
                      style={{ "--cdot": s.color }} onClick={() => toggleSet(s.id)}>
                      <span className="dot" />{s.name}
                      {ready && <span className="ct">{counts[s.id]}</span>}
                    </button>
                  ))}
                </div>
                {/* presentation-angle menu for this group (replaces the old icon) */}
                <div className="chips" style={{ marginTop: 6 }}>
                  <span className="grouplabel" style={{ marginLeft: 0 }}>{grp === "L4E" ? "slot" : "bar"}</span>
                  {(grp === "L4E" ? L4E_SLOTS : L5E_BARS).map((a) => {
                    const sel = grp === "L4E" ? l4eSlots : l5eBars;
                    const toggle = grp === "L4E" ? toggleL4eSlot : toggleL5eBar;
                    return (
                      <button key={a.id} className={"chip" + (sel.has(a.id) ? " on" : "")}
                        style={{ "--cdot": "var(--accent)" }} onClick={() => toggle(a.id)}>
                        <span className="dot" />{a.label}
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
            <div className="presets">
              <button className="preset" onClick={() => setSelected(new Set(L5E_IDS))}>all L5E</button>
              <button className="preset" onClick={() => setSelected(new Set(ALL_IDS))}>everything</button>
              <button className="preset" onClick={() => setSelected(new Set())}>none</button>
            </div>

            {/* per selected set: choose which individual cases are generated */}
            {ready && SETS.filter((s) => selected.has(s.id)).map((s) => {
              const cases = casesOf(s.id);
              const open = caseBrowser === s.id;
              return (
                <div key={s.id} className="casepick">
                  <button className="casetoggle" onClick={() => setCaseBrowser(open ? null : s.id)}>
                    <span className="chev">{open ? "▾" : "▸"}</span>
                    <span className="dot" style={{ background: s.color }} />
                    {s.name} cases
                    <span className="ct">{enabledCount(s.id)}/{cases.length}</span>
                    <span className="ct" style={{ color: "var(--green)" }}>{knownCount(s.id)} known</span>
                  </button>
                  {open && (
                    <div className="caselistwrap">
                      <div className="presets" style={{ margin: "0 2px 8px" }}>
                        <button className="preset" onClick={() => setAllCases(s.id, true)}>all</button>
                        <button className="preset" onClick={() => setAllCases(s.id, false)}>none</button>
                        <button className="preset" onClick={() => setAllKnown(s.id, true)}>mark all known</button>
                        <button className="preset" onClick={() => setAllKnown(s.id, false)}>mark all unknown</button>
                      </div>
                      <div className="chips">
                        {cases.map(({ name }) => {
                          const kn = caseIsKnown(s.id, name);
                          return (
                            <span key={name} className="markwrap">
                              <button className={"chip" + (caseEnabled(s.id, name) ? " on" : "")}
                                style={{ "--cdot": s.color }} onClick={() => toggleCase(s.id, name)}>
                                <span className="dot" />{name}{kn ? " ✓" : ""}
                              </button>
                              <button className={"markbtn ok" + (kn ? " sel" : "")} title="mark known"
                                onClick={() => toggleKnown(s.id, name)}>K</button>
                            </span>
                          );
                        })}
                      </div>
                      <div className="recapbar" style={{ margin: "8px 2px 0" }}>
                        <span className="mono">{knownCount(s.id)}/{cases.length} known</span>
                        <div className="rtrack"><div className="rfill" style={{ width: `${cases.length ? (knownCount(s.id) / cases.length) * 100 : 0}%` }} /></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        <div className="modes">
          <button className={"mode" + (mode === "drill" ? " on" : "")} onClick={() => setMode("drill")}>Drill</button>
          <button className={"mode" + (mode === "recap" ? " on" : "")} onClick={() => setMode("recap")}>Recap</button>
          <button className={"mode" + (mode === "solution" ? " on" : "")} onClick={() => setMode("solution")}>Solution</button>
          <button className={"mode" + (mode === "recog" ? " on" : "")} onClick={() => setMode("recog")}>Recog</button>
        </div>

        {(mode === "drill" || mode === "recap") && (
          <div className="chips" style={{ alignItems: "center" }}>
            <span className="grouplabel" style={{ marginLeft: 0 }}>practice</span>
            <div className="modes" style={{ marginBottom: 0 }}>
              {[["all", "All"], ["learning", "Learning"], ["known", "Known"]].map(([v, l]) => (
                <button key={v} className={"mode" + (scope === v ? " on" : "")} onClick={() => setScope(v)}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {mode === "solution" && (
          <div className="chips">
            <span className="grouplabel" style={{ marginLeft: 0 }}>goals</span>
            {GOAL_TYPES.map((g) => (
              <button key={g.id} className={"chip" + (goals.has(g.id) ? " on" : "")}
                style={{ "--cdot": "var(--accent)" }} onClick={() => toggleGoal(g.id)}>
                <span className="dot" />{g.label}
              </button>
            ))}
          </div>
        )}

        {(mode === "recog" || (mode === "solution" && goals.has("pv"))) && (
          <div className="chips" style={{ alignItems: "center" }}>
            <span className="grouplabel" style={{ marginLeft: 0 }}>offsets</span>
            <input className="offsetin mono" value={pso}
              onChange={(e) => setPso(e.target.value)}
              onBlur={commitOffsets}
              onKeyDown={(e) => { if (e.code === "Enter" || e.code === "NumpadEnter") { e.preventDefault(); e.target.blur(); } }}
              placeholder="e.g. L, R', L R'" aria-label="pseudo offsets" />
            {mode === "solution" ? (!parsePseudoOffsets(pso)
                ? <span className="offsetbad">enter valid offsets (plain moves, ≤4 each)</span>
                : <span className="offsetbad" style={{ color: "var(--faint)" }}>pseudo V offsets</span>)
              : !parsePseudoOffsets(pso) ? <span className="offsetbad">enter valid offsets (plain moves, ≤4 each)</span> : null}
          </div>
        )}

        {mode === "solution" && (
          <>
            <div className="chips">
              <span className="grouplabel" style={{ marginLeft: 0 }}>length</span>
              {[1, 2, 3, 4, 5, 6, 7].map((L) => (
                <button key={L} className={"chip" + (vlenSel.has(L) ? " on" : "")}
                  style={{ "--cdot": "var(--accent)" }} onClick={() => toggleVlen(L)}>
                  <span className="dot" />{L}
                </button>
              ))}
            </div>
            <div className="presets">
              <button className="preset" onClick={() => setVlenSel(new Set([1, 2, 3, 4, 5, 6, 7]))}>all</button>
              <button className="preset" onClick={() => setVlenSel(new Set([3, 4, 5, 6]))}>typical</button>
              <button className="preset" onClick={() => setVlenSel(new Set())}>none</button>
            </div>
          </>
        )}

        {mode === "recap" && recap && recap.queue.length > 0 && (
          <div className="recapbar">
            <span className="mono">{Math.min(recap.idx, recap.queue.length)}/{recap.queue.length}</span>
            <div className="rtrack"><div className="rfill" style={{ width: `${(Math.min(recap.idx, recap.queue.length) / recap.queue.length) * 100}%` }} /></div>
            <button className="preset" onClick={startRecap}>restart</button>
          </div>
        )}

        {!ready ? (
          <div className="stage" style={{ cursor: "default" }}><div className="loading">Building scramble tables…</div></div>
        ) : recapDone ? (
          <div className="stage" style={{ cursor: "default", textAlign: "center" }}>
            <div className="scramble" style={{ textAlign: "center" }}>Recap complete</div>
            <div className="hint" style={{ marginTop: 10 }}>{recap.queue.length} cases covered</div>
            <button className="restart" onClick={startRecap}>Run it again</button>
          </div>
        ) : !current ? (
          <div className="stage" style={{ cursor: "default" }}>
            <div className="empty" style={{ padding: "40px 0", textAlign: "center" }}>
              {mode === "solution" ? (
                  goals.size === 0 ? "Select at least one goal type (V, Pseudo V, TL4E-B) to start."
                  : (goals.size === 1 && goals.has("pv") && !parsePseudoOffsets(pso)) ? "Enter at least one valid offset above to start."
                  : vlenSel.size === 0 ? "Select at least one length to start."
                  : "No solutions at the selected lengths for these goals — pick other lengths.")
                : mode === "recog" ? "Enter at least one valid offset above to start."
                : selected.size === 0 ? "Select at least one set to start."
                : ([...selected].some((id) => SET_BY_ID[id].group === "L5E") && l5eBars.size === 0 && !(selected.has("l4e") && l4eSlots.size > 0)) ? "Select at least one bar to start."
                : (selected.has("l4e") && l4eSlots.size === 0 && !([...selected].some((id) => SET_BY_ID[id].group === "L5E") && l5eBars.size > 0)) ? "Select at least one slot to start."
                : scope === "learning" ? "Nothing left to learn here — every enabled case is marked known. Switch practice to All or Known, or unmark some cases."
                : scope === "known" ? "No cases marked known yet in this selection — mark some known, or switch practice to All."
                : "Enable at least one case to start."}
            </div>
          </div>
        ) : current.kind === "recog" ? (
          <div className="stage" style={{ cursor: "default" }}>
            <div className="stagegrid">
              <div className="scramble">{current.scramble}</div>
              <PyraminxNet state={current.render} uTwist={current.uTwist} />
            </div>
            {phase === "stopped" && last ? (
              <>
                <div className="reveal">
                  <span>pseudo offset</span>
                  <span className="tag" style={{ "--cdot": "var(--accent)" }}><span className="dot" />{last.offsetStr}</span>
                  <span className="casename">{SHEET.CNAME[last.caseKey] || "unnamed case"}</span>
                  <button className="algbtn" onClick={() => setPanel({ kind: "class", caseKey: last.caseKey, set: "l4e" })}>view algs</button>
                  <button className="restart" style={{ marginTop: 0 }} onClick={nextRecog}>Next</button>
                </div>
                <div className="solhead">underlying L4E case — {last.offsetStr} undone (same AUF)</div>
                <div className="panelimg"><PyraminxNet state={last.caseRender} uTwist={last.caseTwist} /></div>
              </>
            ) : (
              <>
                <div className="hint" style={{ marginTop: 14 }}>Which pseudo L4E case is it?</div>
                <button className="restart" style={{ marginTop: 8 }} onClick={revealRecog}>Reveal case</button>
              </>
            )}
          </div>
        ) : current.kind === "solution" ? (
          <div className="stage" style={{ cursor: "default" }}>
            <div className="stagegrid">
              <div className="scramble">{current.scramble}</div>
              <PyraminxNet state={current.render} uTwist={current.uTwist} />
            </div>
            {phase === "stopped" && last ? (
              <>
                <div className={"timer" + (last.correct ? " good" : " bad")}>{last.correct ? "Correct" : "Not optimal"}</div>
                <div className="reveal">
                  {!last.correct ? <span>you picked {last.guess} —</span> : null}
                  <span>optimal is</span>
                  <span className="tag" style={{ "--cdot": "var(--accent)" }}>
                    <span className="dot" />{last.vlen} {last.vlen === 1 ? "move" : "moves"}
                  </span>
                  <button className="restart" style={{ marginTop: 0 }} onClick={nextSolution}>Next</button>
                </div>
                <div className="solhead">{last.sols.length === 1 ? "optimal solution" : `${last.sols.length} optimal solutions`} <span className="bartag">{last.goalsLabel || "V · Pseudo V · TL4E-B"}</span></div>
                <div className="sollist">
                  {last.sols.map((sol, i) => (
                    <span key={i} className="mono solpill">{sol}</span>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="hint" style={{ marginTop: 14 }}>How many moves is the shortest solution?</div>
                <div className="guessrow">
                  {[1, 2, 3, 4, 5, 6, 7].map((N) => (
                    <button key={N} className="guessbtn" onClick={() => submitGuess(N)}>{N}</button>
                  ))}
                </div>
                {guessMsg ? <div className="hint" style={{ color: "#b04a42", marginTop: 8 }}>{guessMsg}</div> : null}
              </>
            )}
          </div>
        ) : (
          <div className="stage" onPointerDown={(e) => { e.preventDefault(); trigger(); }}>
            <div className="stagegrid">
              <div className="scramble">{current.scramble || "—"}</div>
              <PyraminxNet state={current.render} uTwist={current.uTwist} />
            </div>
            <div className={"timer" + (phase === "running" ? " running" : "")}>{fmt(elapsed)}</div>
            {phase === "stopped" && last ? (
              <div className="reveal">
                <span>that was</span>
                <span className="tag" style={{ "--cdot": SET_BY_ID[last.set].color }}>
                  <span className="dot" />{SET_BY_ID[last.set].name}
                </span>
                {lookupName(last.render, last.uTwist, last.caseKey) ? (
                  <span className="casename">{lookupName(last.render, last.uTwist, last.caseKey)}</span>
                ) : null}
                <button className="algbtn" onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setPanel({ kind: "live", ...last }); }}>
                  view algs
                </button>
                {(() => {
                  const k = lastKnownId();
                  if (!k) return null;
                  const isK = caseKnown.has(k.key);
                  return (
                    <button className={"markbtn ok" + (isK ? " sel" : "")} title="mark known (K)"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); toggleKnown(k.setId, k.name); }}>
                      {isK ? "Known ✓" : "Mark known"}
                    </button>
                  );
                })()}
              </div>
            ) : (
              <div className="hint">{phase === "running" ? "tap or any key to stop" : "tap or space to start"}</div>
            )}
          </div>
        )}

        <div className="panelrow">
          <div className="card">
            {mode === "solution" ? (
              <>
                <h3>Solution Trainer — accuracy by length</h3>
                {Object.keys(vfs).length === 0 ? (
                  <div className="empty">No answers yet. Pick the move count and your accuracy lands here, by solution length.</div>
                ) : (
                  <table>
                    <thead><tr><th>Length</th><th>Seen</th><th>Correct</th><th>Accuracy</th></tr></thead>
                    <tbody>
                      {Object.keys(vfs).map(Number).sort((a, b) => a - b).map((L) => {
                        const a = vfs[String(L)];
                        return (
                          <tr key={L}>
                            <td className="name">{L} moves</td>
                            <td className="mono">{a.n}</td>
                            <td className="mono">{a.correct}</td>
                            <td className="mono">{Math.round((a.correct / a.n) * 100)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            ) : mode === "recog" ? (
              <>
                <h3>Recog</h3>
                <div className="empty">Identify the pseudo-offset L4E case, then reveal to check. Set the offsets above.</div>
              </>
            ) : (
              <>
                <h3>Stats by set</h3>
                {Object.keys(setAgg).length === 0 ? (
                  <div className="empty">No solves yet. Times land here, grouped by set.</div>
                ) : (
                  <table>
                    <thead><tr><th>Set</th><th>Solves</th><th>Cases seen</th><th>Known</th><th>Best</th><th>Mean</th></tr></thead>
                    <tbody>
                      {SETS.filter((s) => setAgg[s.id]).map((s) => {
                        const a = setAgg[s.id];
                        return (
                          <tr key={s.id} className="setrow" onClick={() => setExpandedSet(expandedSet === s.id ? null : s.id)}>
                            <td className="name">
                              <span className="dot" style={{ background: s.color }} />{s.name}
                              <span className="chev">{expandedSet === s.id ? "▾" : "▸"}</span>
                            </td>
                            <td className="mono">{a.n}</td>
                            <td className="mono">{a.cases}{counts[s.id] ? ` / ${counts[s.id]}` : ""}</td>
                            <td className="mono">{knownCount(s.id)}{counts[s.id] ? ` / ${counts[s.id]}` : ""}</td>
                            <td className="mono">{fmt(a.best)}</td>
                            <td className="mono">{fmt(a.sum / a.n)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {expandedSet && setAgg[expandedSet] && (
                  <div className="casegrid">
                    {Object.entries(caseStats)
                      .filter(([, st]) => st.set === expandedSet)
                      .sort((a, b) => b[1].sum / b[1].n - a[1].sum / a[1].n)
                      .map(([ck, st]) => (
                        <div key={ck} className="casecard click" onClick={() => setPanel({ kind: "class", caseKey: ck, set: st.set })}>
                          <PyraminxNet state={displayState(ck, st.set, st.set === "l4e" ? ([...l4eSlots][0] || "DF") : ([...l5eBars][0] || "DL"))} uTwist={+ck.split("|")[1]} />
                          <div className="casenums">
                            <span className="mono">{fmt(st.sum / st.n)}</span>
                            <span className="casesub">{SHEET.CNAME[ck] || "unnamed"}</span>
                            <span className="casesub">best {fmt(st.best)} · {st.n}×</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="card">
            <h3>Session</h3>
            {session.length === 0 ? (
              <div className="empty">Recent times show up here.</div>
            ) : (
              <div className="times">
                {session.slice(-24).map((t, i) => (
                  <span key={i} className="timepill"
                    style={{ "--cdot": t.kind ? (t.correct ? "var(--accent)" : "#b04a42") : (t.set ? SET_BY_ID[t.set].color : "var(--accent)") }}>
                    {t.kind ? (t.correct ? "✓" : "✗") : fmt(t.ms)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {panel && <AlgPanel panel={panel} onClose={() => setPanel(null)} />}
      </div>
    </div>
  );
}

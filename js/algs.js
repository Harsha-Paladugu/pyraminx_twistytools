/* Pyraminx.net — algorithm reference + admin editor.
 *
 * Browse every subset and case with its algorithms, search across them, and —
 * when signed in as an admin — add or remove algorithms per case.
 *
 * Single source of truth: data/pyraminx_algs.json (version-controlled). This
 * page reads it directly; the trainer/solver read the compiled js/sheet.js
 * derived from it. There is no live shared store — admin edits are a per-browser
 * DRAFT (localStorage) published with the Export button (download JSON → commit
 * → rebuild). Alg display notation is normalized by the shared engine.normAlg,
 * the same function the compiler uses, so this page and the trainer match.
 *
 * A newly entered alg is auto-checked: it must actually solve the case (any
 * rotation/AUF), and the bar/slot it solves at decides which direction group it
 * is filed under. Algs that don't solve the case are rejected.
 *
 * Caveat — TL4E +/- twist: the twist SIGN is an authored label, not a function
 * of the keyed geometry (the render key ignores center twist, and +/- algs of a
 * TL4E-R case can share the same center-twist state). So auto-routing cannot tell
 * + from -: a wrong-sign alg added to a paired TL4E case passes validation and is
 * filed under the first matching variant (the + one). An admin adding a TL4E alg
 * must make sure it's the correct twist for the variant. (See validate/adminAdder.)
 */
(function () {
  'use strict';

  const A = window.OOAccount;
  const R = window.OORender;
  const E = window.OOEngine;
  const CFG = window.OO_CONFIG || {};
  const adminEmails = (CFG.adminEmails || []).map(e => e.toLowerCase());
  const app = document.getElementById('app');

  // ---------- tiny hyperscript (shared, js/dom.js) ----------
  const { h } = window.OODom;

  // ---------- engine keying / canonicalization (single source: js/engine.js) ----------
  const { stateKey, realCanonKey, caseStateOf, applyMoveK, openOfEkey, barOfEkey, prependAUF } = E;
  // Slot-family subsets group by open slot; L5E groups by bar. The only live
  // slot-family keys are the merged 'L4E' and the TL4E +/- split keys (TL4E-B+,
  // TL4E-R-, …), which the regex catches.
  const isSlotFam = (k) => k === 'L4E' || /^TL4E/.test(k);
  function sideOf(subsetKey, cs) { const ek = stateKey(cs); return isSlotFam(subsetKey) ? openOfEkey(ek) : barOfEkey(ek); }

  // group ordering + labels. Front slot first (people learn the front case first).
  const SIDE_ORDER = ['DF', 'DR', 'DL', ''];
  const barLabel = { DL: 'Bar on left', DR: 'Bar on right', DF: 'Bar on front', '': 'Algorithms' };
  const slotLabel = { DF: 'Front slot (L4E)', DR: 'Right slot (ML4E-R)', DL: 'Left slot (ML4E-L)', '': 'Algorithms' };
  const tl4eSlot = { DF: 'Front', DR: 'Right slot', DL: 'Left slot', '': '' };  // TL4E already has the +/- label
  const sideLabel = (subsetKey, side) =>
    (/^TL4E/.test(subsetKey) ? tl4eSlot : isSlotFam(subsetKey) ? slotLabel : barLabel)[side] || 'Algorithms';

  // ---------- automatic AUF ----------
  // Every alg in a side-group is normalized to solve the EXACT position shown in
  // that group's diagram: post-AUF (trailing U turns) is stripped, then a pre-AUF
  // is prepended so the alg solves the image's starting position. The pre-AUF is
  // an AUF rotation, so it merges with any leading U the alg already has.
  const isU = (t) => /^U(2'|2|')?$/.test(t);
  function stripPostAUF(alg) {
    const toks = String(alg).trim().split(/\s+/).filter(Boolean);
    while (toks.length && isU(toks[toks.length - 1])) toks.pop();
    return toks.join(' ');
  }
  // pre-AUF folding (prepend p U quarter-turns) is the shared engine.prependAUF.
  // U quarter-turns (0/1/2) that rotate `from`'s EDGES onto `to`'s edges, or null
  // if no AUF lines them up. We compare edges only and ignore the U-twist: the
  // ending top-corner orientation is the post-AUF, which is free and not part of
  // the case — so an alg that solves the case's edges counts, whatever AUF it
  // finishes on.
  function aufAmount(from, to) {
    const s = { e: from.e.slice() };   // edges only — stateKey/applyMoveK('U') never touch .c
    const tk = stateKey(to);
    for (let p = 0; p < 3; p++) {
      if (stateKey(s) === tk) return p;
      applyMoveK(s, 'U', false);
    }
    return null;
  }

  // ---------- data model ----------
  let DATA = null;                 // parsed pyraminx_algs.json
  let SUBSETMAP = {};              // subsetKey -> {key, name, cases:[{name, algs}]}
  const overrides = new Map();     // caseId -> {added:[{alg,side}], removed:Set<algStr>}

  // three top-level sections; each reveals its subsets ("groups"). A group is a
  // single subset, a paired R/L (variants shown side by side), or a multi (a few
  // subsets under one heading). Labels here override the verbose JSON names.
  const SECTIONS = [
    { id: 'L4E', label: 'L4E', groups: [
      { key: 'L4E', label: 'L4E', kind: 'single', subs: [['L4E', null]] },
    ] },
    { id: 'TL4E', label: 'TL4E', groups: [
      { key: 'TL4E-B', label: 'TL4E-B', kind: 'paired', subs: [['TL4E-B+', '+ twist'], ['TL4E-B-', '− twist']] },
      { key: 'TL4E-R', label: 'TL4E-R', kind: 'paired', subs: [['TL4E-R+', '+ twist'], ['TL4E-R-', '− twist']] },
    ] },
    { id: 'L5E', label: 'L5E', groups: [
      { key: 'KL5E', label: 'KL5E', kind: 'paired', subs: [['KL5E-R', 'Right'], ['KL5E-L', 'Left']] },
      { key: 'BL5E', label: 'BL5E', kind: 'paired', subs: [['BL5E-R', 'Right'], ['BL5E-L', 'Left']] },
      { key: 'HT', label: 'Heads / Tails', kind: 'paired', subs: [['Heads', 'Heads'], ['Tails', 'Tails']] },
      { key: 'YY', label: 'Yin / Yang', kind: 'paired', subs: [['Yin', 'Yin'], ['Yang', 'Yang']] },
      { key: 'BAD', label: 'Bad Layers', kind: 'multi', subs: [['Nutella', 'Nutella'], ['Peanut', 'Peanut'], ['Left Krish', 'Left Krish'], ['Right Krish', 'Right Krish'], ['2-Flip', '2-Flip']] },
    ] },
  ];
  const sectionById = (id) => SECTIONS.find(s => s.id === id);
  const getCase = (subKey, name) => { const s = SUBSETMAP[subKey]; return s && s.cases.find(c => c.name === name); };
  const caseId = (subsetKey, caseName) => subsetKey + ' ' + caseName;

  // L4E = the named cases as authored, from ML4E (slot angles) + L4E Building
  // Blocks. We deliberately do NOT fold in the numbered "full one-look" L4E set:
  // matching those by geometry attaches algs to cases they weren't authored
  // under (they solve the case but aren't on that case's sheet entry). Pseudo-V
  // and the numbered L4E set are dropped from the merged view.
  const L4E_MERGE = new Set(['ML4E', 'L4E', 'L4E Building Blocks']);
  const DROP_SUB = new Set(['Pseudo-V']);
  const NAMED_SRC = ['ML4E', 'L4E Building Blocks']; // case names + algs come from here
  const isNum = (n) => /^\d+$/.test(String(n));
  const getSub = (key) => DATA.subsets[key] || DATA.other_subsets[key];

  function buildL4ECases() {
    const order = [], byName = new Map(); // name -> Map<algStr,true>
    for (const key of NAMED_SRC) {
      const cont = getSub(key); if (!cont) continue;
      for (const c of cont.cases) {
        if (isNum(c.name)) continue;
        if (!byName.has(c.name)) { byName.set(c.name, new Map()); order.push(c.name); }
        const algs = byName.get(c.name);
        for (const a of c.algs) algs.set(a.alg, true);
      }
    }
    return order.map(name => ({ name, algs: [...byName.get(name).keys()].map(alg => ({ alg })) }));
  }

  const TL4E_SPLIT = new Set(['TL4E-B', 'TL4E-R']); // split into + / - by the alg's twist
  function buildModel() {
    SUBSETMAP = { L4E: { key: 'L4E', name: 'L4E', cases: buildL4ECases() } };
    for (const cont of [DATA.subsets, DATA.other_subsets]) {
      for (const key of Object.keys(cont)) {
        if (L4E_MERGE.has(key) || DROP_SUB.has(key) || TL4E_SPLIT.has(key)) continue;
        SUBSETMAP[key] = { key, name: cont[key].name || key, cases: cont[key].cases.map(c => ({ name: c.name, algs: c.algs.slice() })) };
      }
    }
    // TL4E: one subset per twist sign (+ / -)
    for (const base of TL4E_SPLIT) {
      const cont = getSub(base); if (!cont) continue;
      for (const sign of ['+', '-']) {
        const cases = cont.cases
          .map(c => ({ name: c.name, algs: c.algs.filter(a => a.twist === sign) }))
          .filter(c => c.algs.length);
        SUBSETMAP[base + sign] = { key: base + sign, name: base + ' (' + (sign === '-' ? '−' : '+') + ')', cases };
      }
    }
  }

  // canonical signature of a case (the set of canonical keys its baseline algs
  // solve). Used to validate that a new alg solves the same case.
  const canonCache = new Map();
  function caseCanon(subsetKey, c) {
    const id = caseId(subsetKey, c.name);
    if (canonCache.has(id)) return canonCache.get(id);
    const set = new Set();
    for (const a of c.algs) { const cs = caseStateOf(a.alg); if (cs) set.add(realCanonKey(cs, cs.u)); }
    canonCache.set(id, set);
    return set;
  }

  // one display row from a stored alg: post-AUF stripped, plus the case state of
  // the core. `display`/`solves` are filled in per group (they depend on the
  // group's image position).
  const ordIx = (ord, alg) => { const i = ord.indexOf(alg); return i < 0 ? 1e9 : i; };
  function makeRow(alg, source) {
    const core = stripPostAUF(expandMacros(alg));
    const cs = caseStateOf(core);
    return { alg, source, core, state: cs, display: core, solves: !!cs };
  }

  // merged, display-ready algs for a case: baseline (minus removed) + added,
  // grouped by the bar/slot side they solve at (front first). Each side is one
  // diagram showing a representative "image" position; every alg has its
  // post-AUF stripped and, when it solves that exact image, a pre-AUF prepended
  // so it solves the picture. A named case can hold a few distinct positions at
  // one side (the author's taxonomy lumps related cases); those still list
  // together under the side, shown in their authored form. An alg is only
  // flagged when it doesn't parse to a clean solving state at all, never for a
  // mere AUF/post-AUF difference. Rows follow the admin's saved order.
  function mergedGroups(subsetKey, c) {
    const id = caseId(subsetKey, c.name);
    const ov = overrides.get(id) || { added: [], removed: new Set(), order: [] };
    const rows = [];
    for (const a of c.algs) { if (ov.removed.has(a.alg)) continue; rows.push(makeRow(a.alg, 'base')); }
    for (const a of ov.added) rows.push(makeRow(a.alg, 'add'));

    const groups = new Map();
    for (const r of rows) { const side = r.state ? sideOf(subsetKey, r.state) : ''; if (!groups.has(side)) groups.set(side, []); groups.get(side).push(r); }
    const ord = ov.order || [];
    const out = [];
    for (const [side, grp] of groups) {
      // image = the first authored (insertion-order) alg's position — computed
      // BEFORE the display sort below, so reordering never changes the diagram.
      const anchor = grp.find(r => r.state) || grp[0];
      const image = anchor && anchor.state ? anchor.state : null;
      for (const r of grp) {
        if (image && r.state) { const p = aufAmount(image, r.state); r.display = p != null ? prependAUF(p, r.core) : r.core; }
        else r.display = r.core;
        r.solves = !!r.state; // only a parse/solve failure warns, not an AUF difference
      }
      grp.sort((x, y) => ordIx(ord, x.alg) - ordIx(ord, y.alg));
      out.push({ side, rows: grp, image });
    }
    return out.sort((a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side));
  }

  // validate a candidate alg for a case -> {ok, side} | {ok:false, reason}
  function validate(subsetKey, c, alg) {
    const cs = caseStateOf(alg);
    if (!cs) return { ok: false, reason: 'That isn’t a valid algorithm, or it doesn’t solve to a single state.' };
    const set = caseCanon(subsetKey, c);
    // No reference alg means we can't confirm the new one solves THIS case (it
    // could solve a different position). Refuse rather than accept blindly.
    if (!set.size) return { ok: false, reason: 'There’s no reference algorithm for this case yet, so we can’t check it.' };
    const canon = realCanonKey(cs, cs.u);
    if (!set.has(canon)) return { ok: false, reason: 'Those are valid moves, but they don’t solve this case.' };
    // NOTE: realCanonKey ignores center twist, so for paired TL4E (+/-) this
    // confirms the alg solves the case's EDGES but cannot verify the twist sign —
    // see the file header caveat. The sign comes from which variant the admin adds to.
    return { ok: true, side: sideOf(subsetKey, cs), state: cs };
  }

  // ---------- edit drafts ----------
  // The single source of truth is data/pyraminx_algs.json. Admin edits are kept
  // as a per-browser DRAFT in localStorage and published with the Export button
  // (download JSON → commit → rebuild). There is no shared live store, so the
  // committed JSON is the one authority.
  const LIVE = A && A.mode === 'live';
  const DRAFT_KEY = 'pyraminx-algsheet-draft';
  function isAdmin() {
    if (!A || !A.user) return false;
    if (LIVE) return adminEmails.includes((A.user.email || '').toLowerCase());
    return true; // demo mode (no Firebase): allow local editing
  }
  let draftError = ''; // surfaced by refreshStatus when a draft read/write fails
  const Store = {
    async loadAll() {
      overrides.clear();
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      try {
        const m = JSON.parse(raw) || {};
        for (const k in m) { const v = m[k]; overrides.set(caseId(v.subset, v.case), { subset: v.subset, case: v.case, added: (v.added || []).slice(), removed: new Set(v.removed || []), order: (v.order || []).slice() }); }
      } catch (e) {
        // Don't silently discard the user's draft — set it aside and tell them.
        console.error('algs: unreadable draft, set aside as ' + DRAFT_KEY + '.bad', e);
        try { localStorage.setItem(DRAFT_KEY + '.bad', raw); } catch (_) {}
        draftError = 'We couldn’t read your saved draft, so we set it aside (' + DRAFT_KEY + '.bad) and started from the published algs.';
      }
    },
    async save(subsetKey, caseName) {
      const ov = overrides.get(caseId(subsetKey, caseName)) || { added: [], removed: new Set(), order: [] };
      let m = {};
      try { m = JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}; }
      catch (e) {
        // Mirror loadAll: don't silently overwrite an unreadable draft — set it aside and warn.
        const raw = localStorage.getItem(DRAFT_KEY);
        console.error('algs: unreadable draft on save, set aside as ' + DRAFT_KEY + '.bad', e);
        try { localStorage.setItem(DRAFT_KEY + '.bad', raw); } catch (_) {}
        draftError = 'We couldn’t read your saved draft, so we set it aside (' + DRAFT_KEY + '.bad) and kept your current edits.';
      }
      m[caseId(subsetKey, caseName)] = { subset: subsetKey, case: caseName, added: ov.added, removed: [...ov.removed], order: ov.order || [] };
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(m)); draftError = ''; return true; }
      catch (e) {
        // Don't pretend the edit persisted — make the failure visible.
        console.error('algs: draft save failed', e);
        draftError = 'We couldn’t save your draft (storage may be full or blocked). Your edits only live in this tab and will be lost on reload, so export now to keep them.';
        if (typeof refreshStatus === 'function') refreshStatus();
        return false;
      }
    },
  };
  // ov carries its own {subset,case} so exportJSON can map a merged-view edit back
  // to the authored subset/case it actually belongs to.
  function getOv(subsetKey, caseName) {
    const id = caseId(subsetKey, caseName);
    let ov = overrides.get(id);
    if (!ov) { ov = { subset: subsetKey, case: caseName, added: [], removed: new Set(), order: [] }; overrides.set(id, ov); }
    return ov;
  }

  async function addAlg(subsetKey, c, alg, side) {
    const ov = getOv(subsetKey, c.name);
    // re-adding a removed baseline alg just clears the tombstone
    if (ov.removed.has(alg)) ov.removed.delete(alg);
    else if (!ov.added.some(x => x.alg === alg) && !c.algs.some(x => x.alg === alg)) ov.added.push({ alg, side });
    await Store.save(subsetKey, c.name);
  }
  async function removeAlg(subsetKey, c, row) {
    const ov = getOv(subsetKey, c.name);
    if (row.source === 'add') ov.added = ov.added.filter(x => x.alg !== row.alg);
    else if (!ov.removed.has(row.alg)) ov.removed.add(row.alg);
    if (ov.order) ov.order = ov.order.filter(a => a !== row.alg);
    await Store.save(subsetKey, c.name);
  }

  // the current full display order of a case's alg strings (groups by SIDE_ORDER,
  // within group by the saved order) — used to materialize ov.order on first move.
  function fullOrder(subKey, c) {
    return mergedGroups(subKey, c).flatMap(g => g.rows.map(r => r.alg));
  }
  // move `row` up (dir=-1) or down (dir=+1) within its side group; persisted.
  async function moveAlg(subKey, c, rows, row, dir) {
    const i = rows.findIndex(r => r.alg === row.alg), j = i + dir;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const ov = getOv(subKey, c.name);
    let order = (ov.order && ov.order.length) ? ov.order.slice() : fullOrder(subKey, c);
    let pa = order.indexOf(row.alg), pb = order.indexOf(rows[j].alg);
    if (pa < 0 || pb < 0) { order = fullOrder(subKey, c); pa = order.indexOf(row.alg); pb = order.indexOf(rows[j].alg); }
    if (pa < 0 || pb < 0) return;
    const t = order[pa]; order[pa] = order[pb]; order[pb] = t;
    ov.order = order;
    await Store.save(subKey, c.name);
  }

  // ---------- rendering ----------
  let query = '';
  let section = 'L4E';             // current top-level section: L4E | TL4E | L5E
  const expanded = new Set();      // group keys currently expanded
  let main, sideNav, statusEl;

  const matchCase = (subsetKey, name, c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (name.toLowerCase().includes(q) || subsetKey.toLowerCase().includes(q)) return true;
    // search baseline (minus tombstoned) + admin-added algs, in both raw and the
    // normalized/display notation the page actually shows (so e.g. an expanded
    // S/H macro or a collapsed R2 typed as seen on screen still matches).
    const ov = overrides.get(caseId(subsetKey, name)) || { added: [], removed: new Set() };
    const algs = [
      ...c.algs.filter(a => !ov.removed.has(a.alg)).map(a => a.alg),
      ...ov.added.map(a => a.alg),
    ];
    return algs.some(a => a.toLowerCase().includes(q) || E.normAlg(a).toLowerCase().includes(q));
  };

  function caseDiagram(state, centers) {
    if (!state || !R) return h('div', { class: 'algnet empty' });
    return h('div', { class: 'algnet', html: R.netSVG({ e: state.e, c: centers || [0, 0, 0], u: state.u || 0 }, 160, { cls: 'pyrasvg', thumb: true }) });
  }
  // Centers to draw for a case. L4E/L5E have solved centers (algs may leave a
  // tip-fixable twist behind, which isn't part of the case) → show none. TL4E IS
  // a twisted-center case → show the twist on its axis (B = index 2, R = index 1),
  // zeroing the other axes so only the defining twist shows.
  function diagramCenters(subKey, state) {
    if (!state) return [0, 0, 0];
    if (/^TL4E-B/.test(subKey)) return [0, 0, state.c[2]];
    if (/^TL4E-R/.test(subKey)) return [0, state.c[1], 0];
    return [0, 0, 0];
  }

  // shown form of an alg (expand S/H, tidy doubled moves) — shared with the
  // compiler so the algorithms page and the bundled sheet/trainer match exactly.
  const expandMacros = E.normAlg;

  function algRow(subKey, c, r, rows, rerender) {
    const i = rows.indexOf(r), admin = isAdmin();
    return h('div', { class: 'algrow' + (r.solves ? '' : ' warn') },
      admin ? h('span', { class: 'ord' },
        h('button', { class: 'mv', title: 'Move up', 'aria-label': 'Move alg up', disabled: i <= 0 ? 'disabled' : null, onclick: async (ev) => { ev.target.disabled = true; await moveAlg(subKey, c, rows, r, -1); rerender(); } }, '↑'),
        h('button', { class: 'mv', title: 'Move down', 'aria-label': 'Move alg down', disabled: i >= rows.length - 1 ? 'disabled' : null, onclick: async (ev) => { ev.target.disabled = true; await moveAlg(subKey, c, rows, r, 1); rerender(); } }, '↓')) : null,
      h('span', { class: 'mono alg' }, r.display),
      r.source === 'add' ? h('span', { class: 'addedtag' }, 'added') : null,
      !r.solves ? h('span', { class: 'warntag', role: 'img', 'aria-label': 'Warning: this stored alg does not solve the case from this view.', title: 'This stored alg does not solve the case from this view.' }, '⚠') : null,
      admin ? h('button', { class: 'rm', title: 'Remove', 'aria-label': 'Remove alg', onclick: async (ev) => { ev.target.disabled = true; await removeAlg(subKey, c, r); rerender(); } }, '×') : null);
  }

  // one labelled row: diagram + heading + (multi-column) alg list. Shared by L4E
  // single cases and the variant rows of paired (L5E / TL4E) cases. The diagram
  // shows the group's image position that every alg in the list is aligned to.
  function sideRow(subKey, c, labelText, rows, image, rerender) {
    return h('div', { class: 'sidegrp' },
      caseDiagram(image, diagramCenters(subKey, image)),
      h('div', { class: 'sidebody' },
        h('div', { class: 'sidehd' }, labelText),
        h('div', { class: 'alglist' }, rows.map(r => algRow(subKey, c, r, rows, rerender)))));
  }

  // a single-subset case (L4E, multi blocks): full-width card, one row per side.
  function renderCase(subKey, c) {
    const card = h('div', { class: 'casecard' });
    const rerender = () => { canonCache.delete(caseId(subKey, c.name)); card.replaceWith(renderCase(subKey, c)); };
    card.appendChild(h('div', { class: 'casehd' }, h('span', { class: 'casename' }, c.name)));
    const body = h('div', { class: 'casebody' });
    const groups = mergedGroups(subKey, c);
    if (!groups.length) body.appendChild(h('div', { class: 'noalgs' }, 'No algorithms yet.'));
    for (const g of groups) body.appendChild(sideRow(subKey, c, sideLabel(subKey, g.side), g.rows, g.image, rerender));
    if (isAdmin()) body.appendChild(adminAdder([{ subKey, c }], card, () => rerender()));
    card.appendChild(body);
    return card;
  }

  // a paired case (KL5E/BL5E/Heads-Tails/Yin-Yang, TL4E ±): one full-width card
  // (same look as L4E), with each variant's sides as labelled rows.
  function renderPairedCase(group, name) {
    const variants = group.subs
      .map(([subKey, label]) => ({ subKey, label, c: getCase(subKey, name) }))
      .filter(v => v.c);
    const card = h('div', { class: 'casecard' });
    const rerender = () => { variants.forEach(v => canonCache.delete(caseId(v.subKey, v.c.name))); card.replaceWith(renderPairedCase(group, name)); };
    card.appendChild(h('div', { class: 'casehd' }, h('span', { class: 'casename' }, name)));
    const body = h('div', { class: 'casebody' });
    for (const v of variants) {
      for (const g of mergedGroups(v.subKey, v.c)) {
        const sl = sideLabel(v.subKey, g.side);
        const label = sl === 'Algorithms' ? v.label : v.label + ' · ' + sl;
        body.appendChild(sideRow(v.subKey, v.c, label, g.rows, g.image, rerender));
      }
    }
    if (isAdmin()) body.appendChild(adminAdder(variants.map(v => ({ subKey: v.subKey, c: v.c })), card, rerender));
    card.appendChild(body);
    return card;
  }

  // add-an-alg box. `targets` is one or more {subKey, c}; the entered alg is filed
  // under whichever target it actually solves (auto-routes R/L or +/-).
  function adminAdder(targets, card, rerender) {
    const input = h('input', { class: 'mono addin', type: 'text', placeholder: 'Add an algorithm (we check it for you)', spellcheck: 'false' });
    const fb = h('span', { class: 'addfb' });
    // returns { t, side } on the first target the alg solves, else { reason }
    // carrying validate()'s specific diagnostic (so the UI shows WHY it failed).
    const check = (alg) => {
      let reason = 'That isn’t a valid algorithm, or it doesn’t solve this case.';
      for (const t of targets) { const v = validate(t.subKey, t.c, alg); if (v.ok) return { t, side: v.side }; reason = v.reason; }
      return { reason };
    };
    const submit = async () => {
      const alg = input.value.trim().replace(/\s+/g, ' ');
      if (!alg) return;
      const hit = check(alg);
      if (!hit.t) { fb.className = 'addfb err'; fb.textContent = hit.reason; return; }
      input.value = ''; fb.className = 'addfb'; fb.textContent = '';
      await addAlg(hit.t.subKey, hit.t.c, alg, hit.side);
      rerender();
    };
    input.addEventListener('input', () => {
      const alg = input.value.trim();
      if (!alg) { fb.className = 'addfb'; fb.textContent = ''; return; }
      const hit = check(alg);
      fb.className = 'addfb ' + (hit.t ? 'ok' : 'err');
      fb.textContent = hit.t ? '✓ ' + sideLabel(hit.t.subKey, hit.side).toLowerCase() : hit.reason;
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    return h('div', { class: 'adder' }, input, h('button', { class: 'primary sm', onclick: submit }, 'Add'), fb);
  }

  // names present across a group's subsets, in first-seen order
  function groupNames(group) {
    const seen = new Set(), out = [];
    for (const [subKey] of group.subs) for (const c of (SUBSETMAP[subKey] || { cases: [] }).cases)
      if (!seen.has(c.name)) { seen.add(c.name); out.push(c.name); }
    return out;
  }
  const pairMatches = (group, name) =>
    group.subs.some(([subKey]) => { const c = getCase(subKey, name); return c && matchCase(subKey, name, c); });

  function groupCount(group) {
    if (group.kind === 'single') return (SUBSETMAP[group.subs[0][0]] || { cases: [] }).cases.length;
    return groupNames(group).length;
  }

  function renderGroupBody(group) {
    if (group.kind === 'single') {
      const sub = SUBSETMAP[group.subs[0][0]] || { cases: [] };
      const cases = sub.cases.filter(c => matchCase(group.subs[0][0], c.name, c));
      if (!cases.length) return h('div', { class: 'nomatch' }, 'No matching cases.');
      return h('div', { class: 'casegrid' }, cases.map(c => renderCase(sub.key, c)));
    }
    if (group.kind === 'paired') {
      const names = groupNames(group).filter(n => pairMatches(group, n));
      if (!names.length) return h('div', { class: 'nomatch' }, 'No matching cases.');
      return h('div', { class: 'casegrid' }, names.map(n => renderPairedCase(group, n)));
    }
    // multi: each subset as a labelled block of cases
    const blocks = group.subs.map(([subKey, label]) => {
      const sub = SUBSETMAP[subKey]; if (!sub) return null;
      const cases = sub.cases.filter(c => matchCase(subKey, c.name, c));
      if (!cases.length) return null;
      return h('div', { class: 'multiblock' },
        h('div', { class: 'multihd' }, label),
        h('div', { class: 'casegrid' }, cases.map(c => renderCase(subKey, c))));
    }).filter(Boolean);
    if (!blocks.length) return h('div', { class: 'nomatch' }, 'No matching cases.');
    return h('div', null, blocks);
  }

  const groupMatchCount = (group) => {
    if (group.kind === 'single') return (SUBSETMAP[group.subs[0][0]] || { cases: [] }).cases.filter(c => matchCase(group.subs[0][0], c.name, c)).length;
    if (group.kind === 'paired') return groupNames(group).filter(n => pairMatches(group, n)).length;
    return group.subs.reduce((n, [subKey]) => n + (SUBSETMAP[subKey] || { cases: [] }).cases.filter(c => matchCase(subKey, c.name, c)).length, 0);
  };

  function renderMain() {
    main.innerHTML = '';
    const sec = sectionById(section);
    let shown = 0;
    for (const group of sec.groups) {
      const matches = groupMatchCount(group);
      if (query && !matches) continue;
      shown++;
      const open = expanded.has(group.key) || !!query;
      const box = h('section', { class: 'subset', id: 'grp-' + group.key });
      box.appendChild(h('button', { class: 'subhd' + (open ? ' open' : ''), onclick: () => { if (expanded.has(group.key)) expanded.delete(group.key); else expanded.add(group.key); renderMain(); } },
        h('span', { class: 'subname' }, group.label),
        h('span', { class: 'subcount' }, (query ? matches + ' / ' : '') + groupCount(group) + ' cases'),
        h('span', { class: 'chev' }, open ? '▾' : '▸')));
      if (open) box.appendChild(renderGroupBody(group));
      main.appendChild(box);
    }
    if (!shown) main.appendChild(h('div', { class: 'nomatch big' }, 'No cases match “' + query + '”.'));
  }

  function renderSidebar() {
    sideNav.innerHTML = '';
    const sec = sectionById(section);
    for (const group of sec.groups) {
      sideNav.appendChild(h('a', {
        class: 'navcase', href: '#grp-' + group.key,
        onclick: () => { expanded.add(group.key); setTimeout(renderMain, 0); },
      }, h('span', null, group.label), h('span', { class: 'navct' }, groupCount(group))));
    }
  }

  function switchSection(id) {
    section = id;
    expanded.clear();
    const sec = sectionById(id);
    if (sec.groups.length === 1) expanded.add(sec.groups[0].key); // auto-open a lone group (L4E)
    document.querySelectorAll('.sectab').forEach(t => {
      const on = t.getAttribute('data-sec') === id;
      t.className = 'sectab' + (on ? ' on' : '');
      t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    renderSidebar();
    renderMain();
  }

  // Export the AUTHORED schema (meta + subsets + other_subsets), not the merged
  // view, so the file round-trips: tools/compile-sheet.mjs can consume it, and
  // other_subsets / Pseudo-V / the numbered L4E set / every `twist` field are
  // preserved verbatim. We deep-clone the original data and apply the admin's
  // add/remove deltas in place, mapping each merged-view edit back to the
  // authored subset it actually came from.
  function exportJSON() {
    const out = JSON.parse(JSON.stringify(DATA));
    out.meta = Object.assign({}, DATA.meta, { exported: true, note: 'edited via the Algorithms tab' });
    const findCase = (key, name) => {
      const cont = out.subsets[key] ? out.subsets : (out.other_subsets[key] ? out.other_subsets : null);
      return cont ? (cont[key].cases.find(c => c.name === name) || null) : null;
    };
    // every authored source a merged key drew its algs from (for removals)
    const removeKeys = (mergedKey) => {
      const m = /^(TL4E-[BR])[+-]$/.exec(mergedKey);
      if (m) return [m[1]];
      if (mergedKey === 'L4E') return ['ML4E', 'L4E Building Blocks'];
      return [mergedKey];
    };
    for (const ov of overrides.values()) {
      if (!ov.subset) continue;
      if (ov.removed && ov.removed.size) {
        for (const key of removeKeys(ov.subset)) {
          const c = findCase(key, ov.case);
          if (c) c.algs = c.algs.filter(a => !ov.removed.has(a.alg));
        }
      }
      for (const a of (ov.added || [])) {
        // route an added alg to its authored home, with the fields that source uses
        let key, extra = {}, m;
        if ((m = /^(TL4E-[BR])([+-])$/.exec(ov.subset))) { key = m[1]; extra = { direction: null, twist: m[2] }; }
        else if (ov.subset === 'L4E') {
          if (findCase('L4E Building Blocks', ov.case)) key = 'L4E Building Blocks';
          // direction is authoring metadata only (no build tool reads it). ML4E
          // cases are Right/Left Slot; a DF-side alg landing here (its case has
          // no Building Blocks entry) gets the greppable 'Front Slot' rather
          // than a silently wrong side label.
          else { key = 'ML4E'; extra = { direction: a.side === 'DR' ? 'Right Slot' : a.side === 'DL' ? 'Left Slot' : 'Front Slot' }; }
        } else { key = ov.subset; }
        const c = findCase(key, ov.case);
        if (c && !c.algs.some(x => x.alg === a.alg)) c.algs.push(Object.assign({}, extra, { alg: a.alg }));
      }
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'pyraminx_algs.json' });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ---------- page shell ----------
  function build() {
    new SiteNavbar({ active: 'algs' }).mount(document.body);
    const search = h('input', { class: 'algsearch', type: 'search', placeholder: 'Search cases, subsets, or algorithms…', 'aria-label': 'search' });
    search.addEventListener('input', () => { query = search.value.trim(); renderMain(); });
    statusEl = h('span', { class: 'algstatus' });
    const exportBtn = h('button', { class: 'ghost sm export', onclick: exportJSON }, 'Export JSON');

    const tabs = h('div', { class: 'sectabs' }, SECTIONS.map(s =>
      h('button', { class: 'sectab' + (s.id === section ? ' on' : ''), 'data-sec': s.id, 'aria-pressed': s.id === section ? 'true' : 'false', onclick: () => switchSection(s.id) }, s.label)));
    const toolbar = h('div', { class: 'algtoolbar' }, search, statusEl, exportBtn);
    sideNav = h('nav', { class: 'algside', 'aria-label': 'subsets' });
    main = h('div', { class: 'algmain' });
    app.appendChild(h('div', { class: 'algwrap' },
      h('div', { class: 'alghead' }, h('h1', null, 'Algorithms'),
        h('p', { class: 'sub' }, 'Pick L4E, TL4E or L5E, then a subset. Use search to find a case fast.')),
      tabs, toolbar,
      h('div', { class: 'algcols' }, h('aside', { class: 'algsidewrap' }, sideNav), main)));

    switchSection(section);
    refreshStatus();
    // the single auth-change handler is registered in boot() (after build()).
  }

  function refreshStatus() {
    if (!statusEl) return;
    const admin = isAdmin();
    if (draftError) {            // a save/load failure outranks the normal status line
      statusEl.textContent = draftError;
      statusEl.className = 'algstatus err';
    } else {
      const keys = Object.keys(SUBSETMAP);
      const total = keys.reduce((n, k) => n + SUBSETMAP[k].cases.length, 0);
      statusEl.textContent = keys.length + ' subsets · ' + total + ' cases'
        + (admin ? ' · editing as admin. Changes save to this browser; use Export to publish.' : '');
      statusEl.className = 'algstatus' + (admin ? ' admin' : '');
    }
    const exp = document.querySelector('.export'); if (exp) exp.style.display = admin ? '' : 'none';
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const res = await fetch('data/pyraminx_algs.json');
      DATA = await res.json();
    } catch (e) {
      app.appendChild(h('div', { class: 'algerr' }, 'We couldn’t load the algorithms. Try reloading the page.'));
      return;
    }
    buildModel();
    if (A && A.whenReady) { try { await A.whenReady(); } catch (e) {} }
    await Store.loadAll();
    build();
    // single auth-change handler: re-pull overrides + admin state after auth
    // settles (cloud may differ from anon), then refresh the UI once.
    if (A && A.onChange) A.onChange(async () => { await Store.loadAll(); refreshStatus(); renderMain(); });
  }
  boot();
})();

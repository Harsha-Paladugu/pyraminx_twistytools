/* Pyraminx.net — Method solver app. Expects OOEngine, OORender, OOSolverCore, SiteNavbar. */
/* Pyraminx OO — Solver tab app. Expects OOEngine, OORender, OOSolverCore. */
(function () {
const E = window.OOEngine, R = window.OORender, CORE = window.OOSolverCore;
const $ = (q, el) => (el || document).querySelector(q);
const h = (tag, attrs, ...kids) => {
  const el = document.createElement(tag);
  for (const k in (attrs || {})) {
    if (k === 'class') el.className = attrs[k];
    else if (k === 'html') el.innerHTML = attrs[k];
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, attrs[k]);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false)
    el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
  return el;
};
function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3500);
}
const tick = () => new Promise(r => setTimeout(r, 0));

/* ---- tables (shares the Atlas page's IndexedDB cache) ---- */
let dist = null, C = null, rotations = null, syms = null, rotBy = null;
async function idb(mode, payload) {
  if (!('indexedDB' in window)) return null;
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pyraminx-oo', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('t');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const out = await new Promise((res, rej) => {
      const tx = db.transaction('t', mode === 'get' ? 'readonly' : 'readwrite').objectStore('t');
      const rq = mode === 'get' ? tx.get('oo-tables-v1') : tx.put(payload, 'oo-tables-v1');
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
    db.close();
    return out || null;
  } catch (e) { return null; }
}
async function boot() {
  const label = $('#boot-label'), bar = $('#boot-bar');
  const rep = (t, n, tot) => { label.textContent = t; bar.style.width = Math.round(100 * n / tot) + '%'; };
  const cached = await idb('get');
  if (cached && cached.dist) { dist = new Int8Array(cached.dist); rep('Loading cached tables\u2026', 1, 1); }
  else {
    const d = new Int8Array(E.NSLOTS).fill(-1);
    let frontier = new Uint32Array([E.idx(E.solved())]);
    d[frontier[0]] = 0;
    let dd = 0, seen = 1;
    while (frontier.length) {
      const next = [];
      for (let fi = 0; fi < frontier.length; fi++) {
        const s = E.unidx(frontier[fi]);
        for (let m = 0; m < 8; m++) {
          const t2 = E.copy(s); E.applyMoveIdx(t2, m);
          const ix = E.idx(t2);
          if (d[ix] === -1) { d[ix] = dd + 1; next.push(ix); }
        }
        if ((fi & 8191) === 8191) { rep('Mapping all 933,120 positions\u2026', seen + next.length, 933120); await tick(); }
      }
      dd++; seen += next.length; frontier = Uint32Array.from(next);
      rep('Mapping all 933,120 positions\u2026', seen, 933120); await tick();
    }
    dist = d;
    idb('put', { dist: dist.buffer }); // Atlas page upgrades this with class tables on next visit
  }
  rep('Preparing solver\u2026', 0, 1);
  await tick();
  C = CORE.makeSolverCore(E, dist);
  syms = E.buildSyms(); rotBy = E.makeFrames(syms);
  rotations = C.buildRotations();
  rep('Ready', 1, 1);
  $('#boot-status').classList.add('gone');
  render();
}

/* ---- state ---- */
const UI = {
  scramble: '',
  parsed: null, state: null, dopt: null,
  methods: { l4e: true, ml4e: true, l5e: true, tl4eb: true, psl4e: false, psml4e: false },
  caps: { l4e: 7, ml4e: 7, tl4eb: 6, l5e: 4, psl4e: 5, psml4e: 5 },
  offsetsText: 'L, R',
  slack: 0, maxCancel: 2,
  weights: {},
  lengths: new Set(),       // requested total lengths
  results: {},              // L -> items (raw from core)
  searching: false, truncated: false,
  optionsOpen: false,
};
const METHOD_LABEL = { l4e: 'L4E', ml4e: 'ML4E', l5e: 'L5E', tl4eb: 'TL4E-B', psl4e: 'Pseudo L4E', psml4e: 'Pseudo ML4E' };

function parsedOffsets() {
  if (!UI.methods.psl4e && !UI.methods.psml4e) return [];
  const parts = UI.offsetsText.split(',').map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const o = C.parseOffset(p);
    if (!o) { toast('Couldn\u2019t read offset \u201c' + p + '\u201d \u2014 plain moves, up to 4 per offset (e.g. L or R U).'); return null; }
    out.push(o);
  }
  if (!out.length) { toast('Pseudo methods need at least one offset.'); return null; }
  return out;
}

async function runSearch(newLengths) {
  if (!UI.state) return;
  const offsets = parsedOffsets();
  if (offsets === null) return;
  UI.searching = true; render();
  await tick(); await tick();
  const lengths = [...newLengths].filter(L => L >= UI.dopt && L <= 11);
  const t0 = Date.now();
  try {
    const res = C.search(UI.state, {
      methods: UI.methods, caps: UI.caps, offsets,
      slack: UI.slack, maxCancel: UI.maxCancel,
      lengths, rotations, tv: null,
      budget: Math.max(...lengths) >= 10 ? 2.5e7 : 8e6,
      weights: UI.weights,
    });
    for (const L of lengths) UI.results[L] = res.byLength[L] || [];
    UI.truncated = res.truncated;
    for (const L of lengths) UI.lengths.add(L);
  } catch (err) { toast('Search failed: ' + err.message); }
  UI.searching = false;
  UI.lastMs = Date.now() - t0;
  render();
}
function rescoreAll() { // ergonomics changed: re-rank cached results, no re-search
  for (const L of Object.keys(UI.results)) {
    for (const it of UI.results[L]) {
      const sc = C.ergoScore(it.exec, it.prefix, UI.weights);
      it.score = sc.score;
      it.display = (it.prefix ? it.prefix + ' ' : '') + sc.tokens.join(' ');
    }
    UI.results[L].sort((a, b) => a.score - b.score || a.display.localeCompare(b.display));
  }
  render();
}
function fullResearch() { // structural option changed
  const ls = new Set(UI.lengths);
  UI.results = {}; UI.lengths = new Set();
  if (ls.size) runSearch(ls);
}

function onSolve() {
  const txt = $('#scr-in').value.trim();
  if (!txt) return;
  const parsed = E.parseAlg(txt);
  if (!parsed) { toast('Couldn\u2019t read that scramble \u2014 use standard notation (tip moves are ignored).'); return; }
  const st = E.applyParsed(parsed, E.solved(), syms, rotBy);
  UI.scramble = txt; UI.parsed = parsed; UI.state = st;
  UI.dopt = dist[E.idx(st)];
  UI.results = {}; UI.lengths = new Set(); UI.truncated = false;
  if (UI.dopt === 0) { render(); return; }
  const init = new Set([UI.dopt]);
  if (UI.dopt + 1 <= 11) init.add(UI.dopt + 1);
  runSearch(init);
}

/* ---- views ---- */
function copyBtn(text) {
  return h('button', { class: 'copy', title: 'Copy', onclick: () => {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('Copied'))
      .catch(() => { const ta = h('textarea', null, text); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied'); });
  } }, '\u2398');
}
function slider(label, hint, key, min, max, step) {
  const W = Object.assign({}, C.ERGO_DEFAULTS, UI.weights);
  const val = h('span', { class: 'sliderval' }, String(W[key]));
  return h('div', { class: 'sliderblock' },
    h('label', { class: 'sliderrow' },
      h('span', { class: 'sliderlabel' }, label),
      h('input', { type: 'range', min, max, step, value: W[key], oninput: ev => {
        UI.weights[key] = +ev.target.value; val.textContent = ev.target.value;
        clearTimeout(slider._t); slider._t = setTimeout(rescoreAll, 250);
      } }), val),
    h('div', { class: 'sliderhint' }, hint));
}
function render() {
  const root = $('#app'); root.innerHTML = '';
  root.appendChild(new SiteNavbar({ active: 'solver' }).element());
  const main = h('main', { class: 'page' }); root.appendChild(main);

  main.appendChild(h('section', { class: 'homeintro' },
    h('h1', null, 'Method solver'),
    h('p', { class: 'lede' }, 'Paste a scramble to get human-findable solutions \u2014 V into L4E, ML4E, L5E and more \u2014 ranked by how comfortable they are to turn. Every solution is machine-verified.')));

  /* scramble row */
  main.appendChild(h('div', { class: 'searchrow' },
    h('input', { id: 'scr-in', class: 'searchin mono', value: UI.scramble,
      placeholder: "Scramble \u2014 e.g.  R U' B L' U R' B'  (tips ignored)",
      onkeydown: ev => { if (ev.key === 'Enter') onSolve(); } }),
    h('button', { class: 'primary', onclick: onSolve }, 'Solve')));

  /* method toggles */
  const togRow = h('div', { class: 'methodrow' });
  for (const id of Object.keys(METHOD_LABEL)) {
    togRow.appendChild(h('button', { class: 'methodchip' + (UI.methods[id] ? ' on' : ''), onclick: () => {
      UI.methods[id] = !UI.methods[id];
      fullResearch();
      render();
    } }, METHOD_LABEL[id]));
  }
  main.appendChild(togRow);
  if (UI.methods.psl4e || UI.methods.psml4e) {
    main.appendChild(h('div', { class: 'offsetrow' },
      h('span', { class: 'scrlabel' }, 'pseudo offsets'),
      h('input', { class: 'searchin mono sm', value: UI.offsetsText, 'aria-label': 'pseudo offsets',
        placeholder: 'comma separated, up to 4 moves each \u2014 e.g.  L, R, R U',
        onchange: ev => { UI.offsetsText = ev.target.value; fullResearch(); } })));
  }

  /* options drawer */
  const drawer = h('section', { class: 'card optcard' },
    h('button', { class: 'opthead', onclick: () => { UI.optionsOpen = !UI.optionsOpen; render(); } },
      (UI.optionsOpen ? '\u25be' : '\u25b8') + ' Options \u2014 filters & ergonomics'));
  if (UI.optionsOpen) {
    const W = Object.assign({}, C.ERGO_DEFAULTS, UI.weights);
    const capIn = (id) => h('label', { class: 'capin' }, METHOD_LABEL[id],
      h('input', { type: 'number', min: '0', max: '9', value: UI.caps[id], onchange: ev => { UI.caps[id] = +ev.target.value; fullResearch(); } }));
    drawer.appendChild(h('div', { class: 'optgrid' },
      h('div', { class: 'optcol' },
        h('h4', null, 'First-step length caps (before cancellation)'),
        h('div', { class: 'caprow' }, capIn('l4e'), capIn('ml4e'), capIn('tl4eb'), capIn('l5e'), capIn('psl4e'), capIn('psml4e')),
        h('h4', null, 'Finish & cancellation'),
        h('label', { class: 'sliderrow' }, h('span', { class: 'sliderlabel' }, 'finish slack (moves above the case optimum)'),
          h('select', { onchange: ev => { UI.slack = +ev.target.value; fullResearch(); } },
            h('option', { value: '0', selected: UI.slack === 0 ? '' : null }, 'optimal only'),
            h('option', { value: '1', selected: UI.slack === 1 ? '' : null }, 'optimal +1'))),
        h('label', { class: 'sliderrow' }, h('span', { class: 'sliderlabel' }, 'max canceled moves at the junction'),
          h('input', { type: 'range', min: '0', max: '4', step: '1', value: UI.maxCancel,
            onchange: ev => { UI.maxCancel = +ev.target.value; fullResearch(); } }),
          h('span', { class: 'sliderval' }, String(UI.maxCancel)))),
      h('div', { class: 'optcol' },
        h('h4', null, 'Ergonomics \u2014 re-ranks instantly'),
        h('p', { class: 'opthint' }, 'Each move adds a small cost and the score is the total \u2014 lower means nicer to turn. Raise a slider if a situation bothers you more than the default.'),
        slider('cold B', 'a B with no setup \u2014 nothing has positioned your index for it, like the B in L U \u2026 B', 'bCold', 1, 3, 0.1),
        slider('set-up B', 'a B just after R or L\u2032 raises a thumb (the B in R B R\u2032), or within the first two moves of the solve', 'bSetup', 0.5, 2, 0.05),
        slider('B setup fades after', 'how many moves a raised thumb stays ready for B before it counts as cold again', 'bWindow', 0, 4, 1),
        slider('wide move', 'an Rw or Lw, relative to a normal turn (1.0 = no penalty)', 'wide', 0.5, 3, 0.05),
        slider('hidden regrip', 'repeating a wrist direction, like the second L\u2032 in L\u2032 R L\u2032 \u2014 the hand has to reset before it can turn again', 'silentReset', 0, 1.5, 0.05),
        slider('away-from-home tax', 'a small cost for every move a thumb spends off home grip \u2014 favors quick returns like R U R\u2032 and R\u2032 L R L\u2032', 'displacedTax', 0, 0.4, 0.02),
        slider('hand alternation bonus', 'a discount each time the turning hand switches \u2014 bouncing between R and L flows', 'altBonus', 0, 0.5, 0.05),
        slider('alternate starting grip', 'starting with a thumb on bottom or top instead of home \u2014 unlocks openers like R U R for a small delay', 'startDelay', 0, 1, 0.05),
        slider('U with no free index', 'a U when both hands are busy and neither index is parked at the top', 'uBusy', 0, 1, 0.05),
        slider('starting rotation', 'a [u] or [l\u2032] applied during inspection, before the first move', 'rotCost', 0, 0.5, 0.05),
        h('button', { class: 'ghost sm', onclick: () => { UI.weights = {}; rescoreAll(); } }, 'reset to defaults'))));
  }
  main.appendChild(drawer);

  /* scramble preview + depth chips */
  if (UI.state) {
    main.appendChild(h('section', { class: 'pairrow single' },
      h('div', { class: 'sidepanel' },
        h('div', { class: 'sidehead' },
          h('span', { class: 'sidelabel' }, 'scramble'),
          h('span', { class: 'depthchip' }, UI.dopt === 0 ? 'already solved' : 'optimal: ' + UI.dopt + ' moves'),
          h('a', { class: 'ordinal', href: 'oo.html#/c/' + E.idx(UI.state) }, 'open this position \u2192')),
        h('div', { class: 'netwrap', html: R.netSVG(UI.state, 300) }))));
    if (UI.dopt > 0) {
      const chips = h('div', { class: 'depthchips' });
      for (let L = UI.dopt; L <= 11; L++) {
        const have = UI.lengths.has(L);
        const gated = L > 9 && L > UI.dopt + 1;
        chips.appendChild(h('button', {
          class: 'depthsel' + (have ? ' on' : '') + (gated && !have ? ' gated' : ''),
          onclick: () => { if (!have) runSearch(new Set([L])); },
          title: gated && !have ? 'deep search \u2014 click to run' : null,
        }, h('b', null, String(L)), h('span', null, have ? (UI.results[L] || []).length + ' found' : (gated ? 'search\u2026' : 'search'))));
      }
      main.appendChild(chips);
    }
  }

  if (UI.searching) main.appendChild(h('p', { class: 'empty' }, 'Searching\u2026'));
  if (UI.truncated) main.appendChild(h('p', { class: 'warnline' }, 'This depth hit the search budget, so the list may be incomplete \u2014 tighten the caps or try a shorter length for an exhaustive search.'));

  /* results */
  const lens = [...UI.lengths].sort((a, b) => a - b);
  for (const L of lens) {
    const items = UI.results[L] || [];
    const sec = h('section', { class: 'card solcard' },
      h('h3', null, L + ' moves' + (L === UI.dopt ? ' \u2014 optimal' : L === UI.dopt + 1 ? ' \u2014 optimal +1' : ''),
        h('span', { class: 'counttag' }, items.length + (items.length === 1 ? ' solution' : ' solutions'))));
    if (!items.length) sec.appendChild(h('p', { class: 'empty' }, 'No method-findable solutions at this length.'));
    items.slice(0, UI['showAll' + L] ? items.length : 10).forEach(it => {
      const badges = Object.entries(it.methods).map(([id, m]) =>
        h('span', { class: 'mbadge', title: 'first step ' + m.v + ' \u2192 finish ' + m.fin + (m.cancel ? ', ' + m.cancel + ' canceled' : '') },
          METHOD_LABEL[id] + ' ' + m.v + '+' + m.fin + (m.cancel ? '\u2212' + m.cancel : '')));
      sec.appendChild(h('div', { class: 'solrow solverrow' },
        h('div', { class: 'solcell' }, h('code', { class: 'mono sol' }, it.display), copyBtn(it.display)),
        h('div', { class: 'badgecell' }, badges),
        h('div', { class: 'solmeta scorechip', title: 'ergonomic cost \u2014 lower is nicer' }, String(it.score))));
    });
    if (items.length > 10 && !UI['showAll' + L])
      sec.appendChild(h('button', { class: 'ghost sm', onclick: () => { UI['showAll' + L] = true; render(); } }, 'show all ' + items.length));
    main.appendChild(sec);
  }
  if (UI.state && UI.dopt === 0) main.appendChild(h('p', { class: 'empty' }, 'Nothing to solve \u2014 that scramble leaves the puzzle solved.'));
  if (!UI.state) main.appendChild(h('p', { class: 'empty hintline' }, 'The badge on each solution reads like \u201cL4E 3+6\u22122\u201d: a 3-move V, a 6-move finish, 2 moves canceled at the junction.'));
}
window.OOSolver = { get UI() { return UI; }, runSearch, onSolve, get C() { return C; } };
window.addEventListener('DOMContentLoaded', boot);
})();

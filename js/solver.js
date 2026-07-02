/* Pyraminx.net — Method solver app. Expects OOEngine, OORender, OOSolverCore, SiteNavbar. */
/* Pyraminx OO — Solver tab app. Expects OOEngine, OORender, OOSolverCore. */
(function () {
const E = window.OOEngine, R = window.OORender, CORE = window.OOSolverCore;
const { h, $, toast, tick } = window.OODom;

/* ---- tables (shared dist cache via js/tables.js \u2014 same IndexedDB the OO page uses) ---- */
let dist = null, C = null, rotations = null, syms = null, rotBy = null;
async function boot() {
  if (!window.OOTables) throw new Error('js/tables.js must load before js/solver.js');
  const label = $('#boot-label'), bar = $('#boot-bar'), track = $('#boot-track');
  const rep = (t, n, tot) => { const pct = Math.round(100 * n / tot); label.textContent = t; bar.style.width = pct + '%'; if (track) track.setAttribute('aria-valuenow', pct); };
  // dist is shared with the OO census (KEY_DIST); the census enriches the same
  // IndexedDB with its class tables under a separate key, so neither clobbers the other.
  dist = await window.OOTables.loadOrBuildDist(E,
    (stage, n, tot) => rep(stage === 'cache' ? 'Loading cached tables\u2026' : 'Mapping all 933,120 positions\u2026', n, tot),
    tick);
  rep('Preparing solver\u2026', 0, 1);
  await tick();
  C = CORE.makeSolverCore(E, dist);
  syms = E.buildSyms(); rotBy = E.makeFrames(syms);
  rotations = C.buildRotations();
  rep('Ready', 1, 1);
  const bootEl = $('#boot-status');
  bootEl.classList.add('gone');
  setTimeout(() => bootEl.remove(), 500);
  render();
  // restore saved preferences for a signed-in user, and again on any sign-in
  const A = window.OOAccount;
  if (A) {
    A.whenReady().then(() => { if (A.user) loadPrefs(); });
    A.onChange(() => { if (A.user) loadPrefs(); });
  }
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
// first-step ("V") label for the reconstruction comment, per method
const VLABEL = { l4e: 'V', ml4e: 'ML4E V', tl4eb: 'TL4E-B V', l5e: 'bar', psl4e: 'pseudo V', psml4e: 'pseudo ML4E V' };
const METHOD_PRIORITY = ['l4e', 'ml4e', 'tl4eb', 'l5e', 'psl4e', 'psml4e'];
// pick the decomposition to break down: shortest first step, then method order
function primaryMethod(it) {
  const entries = Object.entries(it.methods);
  entries.sort((a, b) => a[1].v - b[1].v || METHOD_PRIORITY.indexOf(a[0]) - METHOD_PRIORITY.indexOf(b[0]));
  return entries[0];
}
function caseNameOf(m) {
  const S = window.OOSheet;
  if (!S || !m || !m.jstate) return null;
  try { return S.nameForState(m.jstate); } catch (e) { return null; }
}
// build the staged reconstruction (rotation / V / algorithm / final) for a solution
function reconstruction(it) {
  const [pid, pm] = primaryMethod(it);
  const cname = caseNameOf(pm);
  const lines = [];
  if (it.prefix) lines.push({ mv: it.prefix, cmt: '' });
  lines.push({ mv: pm.vmoves || '-', cmt: '// ' + (VLABEL[pid] || METHOD_LABEL[pid]) });
  if (pm.amoves) lines.push({ mv: pm.amoves, cmt: '// algorithm' + (cname ? ' (' + cname + ')' : '') });
  const text = lines.map(l => (l.mv + (l.cmt ? '  ' + l.cmt : '')).trim()).join('\n')
    + '\nfinal solution (including cancels)\n' + it.display;
  return { lines, finalLabel: 'final solution (including cancels)', final: it.display, text };
}

/* ---- per-user preferences (saved to the account when signed in) ---- */
// Only the tuning lives here — scramble, results and requested lengths stay session-local.
const PREF_KEYS = ['methods', 'caps', 'offsetsText', 'slack', 'maxCancel', 'weights'];
function snapshotPrefs() { const o = {}; for (const k of PREF_KEYS) o[k] = UI[k]; return o; }
function applyPrefs(p) {
  if (!p || typeof p !== 'object') return;
  for (const k of PREF_KEYS) if (p[k] !== undefined && p[k] !== null) UI[k] = p[k];
}
let _saveTimer = null;
function persistPrefs() {
  const A = window.OOAccount;
  if (!A || !A.user) return;                 // nothing to save when signed out
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { A.saveUserDoc('solver', snapshotPrefs()).catch(e => console.error('Save prefs failed:', e)); }, 600);
}
async function loadPrefs() {
  const A = window.OOAccount;
  if (!A || !A.user) return;
  const p = await A.loadUserDoc('solver');     // cloud wins: account settings replace local
  if (p) { applyPrefs(p); render(); }
}

function parsedOffsets() {
  if (!UI.methods.psl4e && !UI.methods.psml4e) return [];
  const parts = UI.offsetsText.split(',').map(x => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const o = C.parseOffset(p);
    if (!o) { toast('We couldn\u2019t read the offset \u201c' + p + '\u201d. Use plain moves, up to 4 per offset (e.g. L or R U).'); return null; }
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
      lengths, rotations,
      budget: Math.max(...lengths) >= 10 ? 2.5e7 : 8e6,
      weights: UI.weights,
    });
    for (const L of lengths) UI.results[L] = res.byLength[L] || [];
    UI.truncated = res.truncated;
    for (const L of lengths) UI.lengths.add(L);
  } catch (err) { toast('Something went wrong searching. Please try again.'); }
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
  persistPrefs();
  render();
}
function fullResearch() { // structural option changed
  persistPrefs();
  const ls = new Set(UI.lengths);
  UI.results = {}; UI.lengths = new Set();
  if (ls.size) runSearch(ls);
}

function onSolve() {
  const txt = $('#scr-in').value.trim();
  if (!txt) return;
  const parsed = E.parseAlg(txt);
  if (!parsed) { toast('We couldn\u2019t read that scramble. Use standard notation (tip moves are ignored).'); return; }
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
// per-move score breakdown table (from C.ergoScore(..., true).breakdown)
function scoreBreakdown(bd, prefix) {
  const sgn = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2);
  const line = (idx, tok, parts, sum, cls) => h('div', { class: 'bkline' + (cls ? ' ' + cls : '') },
    h('span', { class: 'bkidx' }, idx),
    h('span', { class: 'bktok mono' }, tok),
    h('span', { class: 'bkparts' }, parts),
    h('span', { class: 'bksum mono' }, sum));
  const rows = [];
  if (bd.start && bd.start.cost > 0) {
    const which = [bd.start.dl !== 0 ? 'left' : null, bd.start.dr !== 0 ? 'right' : null].filter(Boolean).join(' & ');
    rows.push(line('', 'start', 'alternate start grip (' + which + ')', sgn(bd.start.cost)));
  }
  bd.steps.forEach((s, i) => rows.push(line(String(i + 1), s.tok,
    s.parts.map(p => p.label + ' ' + sgn(p.val)).join('   ·   '), sgn(s.cost))));
  if (bd.rotation && bd.rotation.count > 0)
    rows.push(line('', prefix || 'rotation', 'rotation ×' + bd.rotation.count + (bd.rotation.cost ? ' × ' + bd.rotation.each : ' (free)'), sgn(bd.rotation.cost)));
  rows.push(line('', 'total', '', bd.total.toFixed(2), 'bktotal'));
  return h('div', { class: 'scorebreak' }, ...rows);
}
// one solution's reconstruction block + method badges + ergonomic score (+ expandable breakdown)
function solutionRow(it) {
  const badges = Object.entries(it.methods).map(([id, m]) =>
    h('span', { class: 'mbadge', title: 'first step ' + m.v + ' → finish ' + m.fin + (m.cancel ? ', ' + m.cancel + ' canceled' : '') },
      METHOD_LABEL[id] + ' ' + m.v + '+' + m.fin + (m.cancel ? '−' + m.cancel : '')));
  const rec = reconstruction(it);
  const recEls = rec.lines.map(l =>
    h('div', { class: 'recline' }, h('span', { class: 'recmv mono' }, l.mv), l.cmt ? h('span', { class: 'reccmt' }, l.cmt) : null));
  recEls.push(h('div', { class: 'reclabel' }, rec.finalLabel));
  recEls.push(h('div', { class: 'recline final' }, h('code', { class: 'recmv mono sol' }, rec.final)));
  const row = h('div', { class: 'solrow solverrow' },
    h('div', { class: 'reconblock' }, h('div', { class: 'reconlines' }, ...recEls), copyBtn(rec.text)),
    h('div', { class: 'badgecell' }, badges),
    h('button', { class: 'breaktoggle', 'aria-expanded': it._open ? 'true' : 'false',
      title: 'show how the score is calculated',
      onclick: () => { it._open = !it._open; render(); } }, (it._open ? '▾' : '▸') + ' score'),
    h('div', { class: 'solmeta scorechip', title: 'comfort score. lower is nicer to turn' }, String(it.score)));
  if (!it._open) return row;
  let bd = null;
  try { bd = C.ergoScore(it.exec, it.prefix, UI.weights, true).breakdown; } catch (e) { return row; }
  return h('div', { class: 'solentry' }, row, scoreBreakdown(bd, it.prefix));
}
function renderInner() {
  const root = $('#app'); root.innerHTML = '';
  root.appendChild(new SiteNavbar({ active: 'solver' }).element());
  const main = h('main', { class: 'page' }); root.appendChild(main);

  main.appendChild(h('section', { class: 'homeintro' },
    h('h1', null, 'Method solver'),
    h('p', { class: 'lede' }, 'Paste a scramble and get solutions you can actually find at the table: V into L4E, ML4E, L5E and more, ranked by how comfortable they are to turn. Every solution is checked by the computer.')));

  /* scramble row */
  main.appendChild(h('div', { class: 'searchrow' },
    h('input', { id: 'scr-in', class: 'searchin mono', value: UI.scramble,
      placeholder: "Scramble, e.g.  R U' B L' U R' B'  (tips ignored)",
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
        placeholder: 'comma separated, up to 4 moves each, e.g.  L, R, R U',
        onchange: ev => { UI.offsetsText = ev.target.value; fullResearch(); } })));
  }

  /* options drawer */
  const drawer = h('section', { class: 'card optcard' },
    h('button', { class: 'opthead', onclick: () => { UI.optionsOpen = !UI.optionsOpen; render(); } },
      (UI.optionsOpen ? '\u25be' : '\u25b8') + ' Options: filters and comfort'));
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
        h('h4', null, 'Comfort (re-ranks instantly)'),
        h('p', { class: 'opthint' }, 'Each move adds a small cost, and the score is the total, so lower means nicer to turn. Raise a slider if something bugs you more than the default.'),
        slider('cold B', 'a B with no setup, when nothing has put your index in place for it (like the B in L U \u2026 B)', 'bCold', 1, 3, 0.1),
        slider('set-up B', 'a B right after R or L\u2032 raises a thumb (the B in R B R\u2032), or in the first two moves of the solve', 'bSetup', 0.5, 2, 0.05),
        slider('B setup fades after', 'how many moves a raised thumb stays ready for B before it counts as cold again', 'bWindow', 0, 4, 1),
        slider('wide move', 'an Rw or Lw, compared with a normal turn (1.0 means no penalty)', 'wide', 0.5, 3, 0.05),
        slider('hidden regrip', 'repeating a wrist direction, like the second L\u2032 in L\u2032 R L\u2032, where the hand has to reset before it can turn again', 'silentReset', 0, 1.5, 0.05),
        slider('away-from-home tax', 'a small cost for every move a thumb spends off home grip, so quick returns like R U R\u2032 and R\u2032 L R L\u2032 are favored', 'displacedTax', 0, 0.4, 0.02),
        slider('hand alternation bonus', 'a discount each time the turning hand switches, since bouncing between R and L flows', 'altBonus', 0, 0.5, 0.05),
        slider('alternate starting grip', 'starting with a thumb on bottom or top instead of home, which unlocks openers like R U R for a small delay', 'startDelay', 0, 1, 0.05),
        slider('U with no free index', 'a U when both hands are busy and neither index is parked at the top', 'uBusy', 0, 1, 0.05),
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
          title: gated && !have ? 'deep search. click to run' : null,
        }, h('b', null, String(L)), h('span', null, have ? (UI.results[L] || []).length + ' found' : (gated ? 'search\u2026' : 'search'))));
      }
      main.appendChild(chips);
    }
  }

  if (UI.searching) main.appendChild(h('p', { class: 'empty' }, 'Searching\u2026'));
  if (UI.truncated) main.appendChild(h('p', { class: 'warnline' }, 'This depth hit the search limit, so the list may be incomplete. Tighten the caps or try a shorter length to search everything.'));

  /* results */
  const lens = [...UI.lengths].sort((a, b) => a - b);
  // headline: the single most-ergonomic solution across every loaded length
  let best = null, bestL = null;
  for (const L of lens) for (const it of (UI.results[L] || [])) if (!best || it.score < best.score) { best = it; bestL = L; }
  if (best) {
    const note = bestL === UI.dopt ? 'optimal, ' + bestL + ' moves'
      : bestL === UI.dopt + 1 ? 'optimal +1, ' + bestL + ' moves'
      : bestL + ' moves';
    main.appendChild(h('section', { class: 'card solcard bestcard' },
      h('h3', null, 'Best solution', h('span', { class: 'counttag' }, note)),
      solutionRow(best)));
  }
  for (const L of lens) {
    const items = UI.results[L] || [];
    const sec = h('section', { class: 'card solcard' },
      h('h3', null, L + ' moves' + (L === UI.dopt ? ', optimal' : L === UI.dopt + 1 ? ', optimal +1' : ''),
        h('span', { class: 'counttag' }, items.length + (items.length === 1 ? ' solution' : ' solutions'))));
    if (!items.length) sec.appendChild(h('p', { class: 'empty' }, 'No method solutions at this length.'));
    items.slice(0, UI['showAll' + L] ? items.length : 10).forEach(it => sec.appendChild(solutionRow(it)));
    if (items.length > 10 && !UI['showAll' + L])
      sec.appendChild(h('button', { class: 'ghost sm', onclick: () => { UI['showAll' + L] = true; render(); } }, 'show all ' + items.length));
    main.appendChild(sec);
  }
  if (UI.state && UI.dopt === 0) main.appendChild(h('p', { class: 'empty' }, 'Nothing to solve. That scramble leaves the puzzle solved.'));
  if (!UI.state) main.appendChild(h('p', { class: 'empty hintline' }, 'The badge on each solution reads like \u201cL4E 3+6\u22122\u201d: a 3-move V, a 6-move finish, and 2 moves that cancel where they meet.'));
}
function render() {
  try { renderInner(); }
  catch (err) {
    const root = $('#app'); root.innerHTML = '';
    const card = h('div', { class: 'card solcard', style: 'margin:48px auto;max-width:680px;border-color:rgba(232,71,61,.5)' },
      'Something went wrong loading this page. Try reloading.');
    root.appendChild(card);
  }
}
window.addEventListener('error', ev => { try { toast('Something went wrong. Try reloading the page.'); } catch (e) {} });
window.OOSolver = { get UI() { return UI; }, runSearch, onSolve, get C() { return C; } };
window.addEventListener('DOMContentLoaded', boot);
})();

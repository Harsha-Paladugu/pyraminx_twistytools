/* Pyraminx.net — OO census app. Expects OOEngine, OORender, SiteNavbar and the OO_CONFIG inline block. */
/* Pyraminx OO — app layer. Expects window.OOEngine (engine) + window.OORender (net renderer). */
(function () {
const E = window.OOEngine, R = window.OORender;
const CFG = window.OO_CONFIG || {};
const $ = (sel, el) => (el || document).querySelector(sel);
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
const fmt = n => n.toLocaleString('en-US');

/* ---------------- tables: BFS + canonical classes, cached in IndexedDB ---------------- */
const T = { dist: null, reps: null, depths: null, depthIdx: null, syms: null, rotByCorner: null, ready: false };
const TABLE_VERSION = 'oo-tables-v1';

async function idbGet() {
  if (!('indexedDB' in window)) return null;
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pyraminx-oo', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('t');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const v = await new Promise((res, rej) => { const tx = db.transaction('t').objectStore('t').get(TABLE_VERSION);
      tx.onsuccess = () => res(tx.result); tx.onerror = () => rej(tx.error); });
    db.close();
    return v || null;
  } catch (e) { return null; }
}
async function idbPut(payload) {
  if (!('indexedDB' in window)) return;
  try {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pyraminx-oo', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('t');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise((res, rej) => { const tx = db.transaction('t', 'readwrite');
      tx.objectStore('t').put(payload, TABLE_VERSION);
      tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  } catch (e) { /* cache is best-effort */ }
}
const tick = () => new Promise(r => setTimeout(r, 0));

async function buildTables(report) {
  T.syms = E.buildSyms();
  T.rotByCorner = E.makeFrames(T.syms);
  const cached = await idbGet();
  if (cached && cached.dist && cached.reps && cached.depths) {
    T.dist = new Int8Array(cached.dist);
    T.reps = new Uint32Array(cached.reps);
    T.depths = new Uint8Array(cached.depths);
    report('cache', 1, 1);
  } else {
    // BFS over the full 933,120-state space
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
        if ((fi & 8191) === 8191) { report('bfs', seen + next.length, 933120); await tick(); }
      }
      d++; seen += next.length;
      frontier = Uint32Array.from(next);
      report('bfs', seen, 933120); await tick();
    }
    T.dist = dist;
    // canonical class enumeration
    const reps = [], depths = [];
    const canon = E.makeCanon(T.syms);
    for (let i = 0; i < E.NSLOTS; i++) {
      if (dist[i] < 0) continue;
      const s = E.unidx(i);
      if (canon(s) === i) { reps.push(i); depths.push(dist[i]); }
      if ((i & 65535) === 65535) { report('classes', i, E.NSLOTS); await tick(); }
    }
    T.reps = Uint32Array.from(reps);
    T.depths = Uint8Array.from(depths);
    report('classes', E.NSLOTS, E.NSLOTS);
    idbPut({ dist: T.dist.buffer, reps: T.reps.buffer, depths: T.depths.buffer });
  }
  T.depthIdx = Array.from({ length: 12 }, () => []);
  for (let o = 0; o < T.reps.length; o++) T.depthIdx[T.depths[o]].push(o);
  T.ready = true;
}
function ordinalOf(classId) { // binary search in reps
  let lo = 0, hi = T.reps.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1;
    if (T.reps[mid] === classId) return mid;
    if (T.reps[mid] < classId) lo = mid + 1; else hi = mid - 1; }
  return -1;
}
const canonOf = s => E.makeCanon(T.syms)(s);
const mirrorOf = s => E.makeMirrorCanon(T.syms)(s);
function variantsOf(classId) { // unique rotation variants of a class, each with its sym
  const s = E.unidx(classId), seen = new Set(), out = [];
  for (const sym of T.syms.rots) {
    const v = E.applySym(sym, s), ix = E.idx(v);
    if (!seen.has(ix)) { seen.add(ix); out.push({ ix, state: v }); }
  }
  return out;
}

/* ---------------- solution verification ---------------- */
// Returns {ok, side:'a'|'b', moves, error?} — accepts a solution for any rotation
// variant of either side of the pair.
function verifySolution(text, pair) {
  const parsed = E.parseAlg(text);
  if (!parsed) return { ok: false, error: 'Couldn\u2019t read that \u2014 use U L R B (with w, \u2032 or 2) and rotations [u] [l] [r] [b] or y. Tips are ignored.' };
  const moves = E.countMoves(parsed);
  if (moves === 0) return { ok: false, error: 'Add some moves first.' };
  if (moves > 15) return { ok: false, error: 'That\u2019s ' + moves + ' moves \u2014 submissions have to be 15 or fewer.' };
  for (const side of ['a', 'b']) {
    if (!pair[side]) continue;
    for (const v of pair[side].variants) {
      const end = E.applyParsed(parsed, v.state, T.syms, T.rotByCorner);
      if (E.eq(end, E.solved())) return { ok: true, side, moves };
    }
  }
  return { ok: false, moves, error: 'Doesn\u2019t solve this scramble \u2014 checked from every rotation of both mirrors.' };
}
function pairOf(classId) {
  const a = { id: classId, state: E.unidx(classId) };
  const mid = mirrorOf(a.state);
  const pairId = Math.min(classId, mid);
  const lowState = E.unidx(pairId);
  const hiId = Math.max(classId, mid);
  const pair = {
    pairId,
    a: { id: pairId, state: lowState, ord: ordinalOf(pairId), depth: T.dist[pairId],
         scramble: E.optimalScramble(lowState, T.dist, false), variants: variantsOf(pairId) },
    b: null, self: pairId === hiId,
  };
  if (!pair.self) {
    const hiState = E.unidx(hiId);
    pair.b = { id: hiId, state: hiState, ord: ordinalOf(hiId), depth: T.dist[hiId],
               scramble: E.optimalScramble(hiState, T.dist, false), variants: variantsOf(hiId) };
  }
  return pair;
}

/* ---------------- data layer ---------------- */
let DB = null;
let lastSearch = null; // the scramble the visitor just searched, so the position page can show it verbatim

function demoDB() {
  const KEY = 'pyraminx-oo-demo';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { solutions: [], mods: [] }; } catch { return { solutions: [], mods: [] }; } };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  let user = null; const subs = new Set();
  const notify = () => subs.forEach(f => f());
  return {
    mode: 'demo',
    get user() { return user; },
    get isMod() { return !!user; },           // demo: every signed-in user moderates, to try the flow
    get isAdmin() { return !!user; },
    async init() {},
    onChange(f) { subs.add(f); },
    async signIn() { user = { uid: 'demo', name: 'Demo solver', email: 'demo@example.com' }; notify(); },
    async signOut() { user = null; notify(); },
    async stats() {
      const d = load(); const done = new Set();
      for (const s of d.solutions) if (s.status === 'approved') { done.add(s.classId); if (s.partnerId !== s.classId) done.add(s.partnerId); }
      return { done: done.size, total: T.reps.length };
    },
    async doneMap() {
      const d = load(); const bm = new Uint8Array(Math.ceil(T.reps.length / 8));
      for (const s of d.solutions) if (s.status === 'approved')
        for (const cid of [s.classId, s.partnerId]) { const o = ordinalOf(cid); if (o >= 0) bm[o >> 3] |= 1 << (o & 7); }
      return bm;
    },
    async pairSolutions(pairId) {
      const d = load();
      return d.solutions.filter(s => s.pairId === pairId && (s.status === 'approved' || (user && s.uid === user.uid)));
    },
    async submit(doc) {
      const d = load();
      d.solutions.push({ ...doc, id: 'demo-' + Date.now() + '-' + Math.floor(Math.random()*1e6),
        uid: user.uid, status: 'pending', createdAt: Date.now() });
      save(d); notify();
    },
    async pending() { const d = load(); return d.solutions.filter(s => s.status === 'pending'); },
    async review(id, action) {
      const d = load(); const s = d.solutions.find(x => x.id === id);
      if (s) { s.status = action; s.reviewedBy = user && user.email; }
      save(d); notify();
    },
    async mods() { return load().mods; },
    async invite(email) { const d = load(); d.mods.push({ email, addedBy: user.email }); save(d); notify(); },
    async revoke(email) { const d = load(); d.mods = d.mods.filter(m => m.email !== email); save(d); notify(); },
  };
}

function liveDB(cfg) {
  let app, auth, fs, F, A;
  let user = null, isMod = false, isAdmin = false;
  const subs = new Set(); const notify = () => subs.forEach(f => f());
  const adminEmails = (CFG.adminEmails || []).map(e => e.toLowerCase());
  return {
    mode: 'live',
    get user() { return user; }, get isMod() { return isMod; }, get isAdmin() { return isAdmin; },
    onChange(f) { subs.add(f); },
    async init() {
      const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
      const [appM, authM, fsM] = await Promise.all([
        import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
      A = authM; F = fsM;
      app = appM.initializeApp(cfg);
      auth = A.getAuth(app); fs = F.getFirestore(app);
      A.onAuthStateChanged(auth, async u => {
        user = u ? { uid: u.uid, name: u.displayName, email: (u.email || '').toLowerCase() } : null;
        isAdmin = !!user && adminEmails.includes(user.email);
        isMod = isAdmin;
        if (user && !isMod) {
          try { const m = await F.getDoc(F.doc(fs, 'moderators', user.uid)); isMod = m.exists(); } catch {}
          if (!isMod) { // accept an invite if one exists for this email
            try {
              const inv = await F.getDoc(F.doc(fs, 'moderatorInvites', user.email));
              if (inv.exists()) {
                await F.setDoc(F.doc(fs, 'moderators', user.uid), { email: user.email, via: 'invite' });
                isMod = true;
              }
            } catch {}
          }
        }
        notify();
      });
    },
    async signIn() { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
    async signOut() { await A.signOut(auth); },
    async stats() {
      try { const d = await F.getDoc(F.doc(fs, 'meta', 'stats'));
        return d.exists() ? d.data() : { done: 0, total: T.reps.length };
      } catch { return { done: 0, total: T.reps.length }; }
    },
    async doneMap() {
      try {
        const d = await F.getDoc(F.doc(fs, 'meta', 'doneMap'));
        if (!d.exists()) return new Uint8Array(Math.ceil(T.reps.length / 8));
        const b64 = d.data().b64 || '';
        const bin = atob(b64); const bm = new Uint8Array(Math.ceil(T.reps.length / 8));
        for (let i = 0; i < bin.length && i < bm.length; i++) bm[i] = bin.charCodeAt(i);
        return bm;
      } catch { return new Uint8Array(Math.ceil(T.reps.length / 8)); }
    },
    async pairSolutions(pairId) {
      const out = [];
      const q1 = F.query(F.collection(fs, 'solutions'),
        F.where('pairId', '==', pairId), F.where('status', '==', 'approved'));
      (await F.getDocs(q1)).forEach(d => out.push({ id: d.id, ...d.data() }));
      if (user) {
        const q2 = F.query(F.collection(fs, 'solutions'),
          F.where('pairId', '==', pairId), F.where('uid', '==', user.uid), F.where('status', '==', 'pending'));
        (await F.getDocs(q2)).forEach(d => out.push({ id: d.id, ...d.data() }));
      }
      return out;
    },
    async submit(doc) {
      await F.addDoc(F.collection(fs, 'solutions'), {
        ...doc, uid: user.uid, status: 'pending', createdAt: F.serverTimestamp() });
      notify();
    },
    async pending() {
      const q = F.query(F.collection(fs, 'solutions'), F.where('status', '==', 'pending'));
      const out = []; (await F.getDocs(q)).forEach(d => out.push({ id: d.id, ...d.data() }));
      return out;
    },
    async review(id, action) {
      if (action === 'rejected') {
        await F.updateDoc(F.doc(fs, 'solutions', id), { status: 'rejected', reviewedBy: user.email });
        notify(); return;
      }
      // approval: transaction updates the solution, the done bitmap and the counter
      await F.runTransaction(fs, async tx => {
        const solRef = F.doc(fs, 'solutions', id);
        const sol = await tx.get(solRef);
        if (!sol.exists() || sol.data().status !== 'pending') return;
        const data = sol.data();
        const mapRef = F.doc(fs, 'meta', 'doneMap'), statRef = F.doc(fs, 'meta', 'stats');
        const mapDoc = await tx.get(mapRef), statDoc = await tx.get(statRef);
        const bm = new Uint8Array(Math.ceil(T.reps.length / 8));
        if (mapDoc.exists() && mapDoc.data().b64) {
          const bin = atob(mapDoc.data().b64);
          for (let i = 0; i < bin.length && i < bm.length; i++) bm[i] = bin.charCodeAt(i);
        }
        let added = 0;
        for (const cid of [data.classId, data.partnerId]) {
          const o = ordinalOf(cid);
          if (o >= 0 && !(bm[o >> 3] & (1 << (o & 7)))) { bm[o >> 3] |= 1 << (o & 7); added++; }
        }
        let b64 = ''; const CH = 8192;
        for (let i = 0; i < bm.length; i += CH) b64 += String.fromCharCode.apply(null, bm.subarray(i, i + CH));
        b64 = btoa(b64);
        tx.update(solRef, { status: 'approved', reviewedBy: user.email });
        tx.set(mapRef, { b64 });
        const done = (statDoc.exists() ? statDoc.data().done || 0 : 0) + added;
        tx.set(statRef, { done, total: T.reps.length });
      });
      notify();
    },
    async mods() {
      const out = [];
      try { (await F.getDocs(F.collection(fs, 'moderators'))).forEach(d => out.push({ uid: d.id, ...d.data() }));
        (await F.getDocs(F.collection(fs, 'moderatorInvites'))).forEach(d => out.push({ email: d.id, invite: true, ...d.data() })); } catch {}
      return out;
    },
    async invite(email) { await F.setDoc(F.doc(fs, 'moderatorInvites', email.toLowerCase()), { addedBy: user.email }); notify(); },
    async revoke(key) {
      try { await F.deleteDoc(F.doc(fs, 'moderators', key)); } catch {}
      try { await F.deleteDoc(F.doc(fs, 'moderatorInvites', key)); } catch {}
      notify();
    },
  };
}

/* ---------------- router + shell ---------------- */
const app = () => $('#app');
function nav() {
  const route = location.hash || '#/';
  const u = DB.user;
  const sub = [
    { label: 'Census', href: '#/', on: route === '#/' || route.startsWith('#/c/') },
    { label: 'Browse by depth', href: '#/browse', on: route.startsWith('#/browse') },
    DB.isMod ? { label: 'Moderation', href: '#/mod', on: route.startsWith('#/mod') } : null,
    { label: 'How it works', href: '#/about', on: route.startsWith('#/about') },
  ].filter(Boolean);
  const right = h('div', { class: 'authbox' },
      DB.mode === 'demo' ? h('span', { class: 'demobadge', title: 'No Firebase config yet \u2014 data stays in this browser' }, 'demo mode') : null,
      u ? h('span', { class: 'whoami' }, u.name || u.email) : null,
      u ? h('button', { class: 'ghost', onclick: () => DB.signOut() }, 'Sign out')
        : h('button', { class: 'primary', onclick: () => DB.signIn().catch(e => toast(e.message)) }, 'Sign in with Google'));
  return new SiteNavbar({ active: 'oo', sub, right }).element();
}
function toast(msg) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
}
async function renderInner() {
  const route = location.hash || '#/';
  const root = app(); root.innerHTML = '';
  root.appendChild(nav());
  const main = h('main', { class: 'page' }); root.appendChild(main);
  if (!T.ready) { const b = $('#boot-status'); if (b) main.appendChild(b.cloneNode(true)); return; }
  try {
    if (route.startsWith('#/c/')) await pageClass(main, parseInt(route.slice(4), 10));
    else if (route.startsWith('#/browse')) await pageBrowse(main, route);
    else if (route.startsWith('#/mod')) await pageMod(main);
    else if (route.startsWith('#/about')) pageAbout(main);
    else await pageHome(main);
  } catch (err) {
    main.appendChild(h('div', { class: 'card error' }, 'Something went wrong rendering this page: ' + err.message));
  }
}

/* ---------------- home ---------------- */
async function pageHome(main) {
  const stats = await DB.stats();
  const pct = stats.total ? stats.done / stats.total : 0;
  main.appendChild(h('section', { class: 'homeintro' },
    h('h1', null, 'The best human solution to every Pyraminx position.'),
    h('p', { class: 'lede' },
      'Fold every rotation together and the Pyraminx comes down to ' + fmt(T.reps.length) + ' positions \u2014 a position and its mirror count as one solve. ',
      'Paste a scramble to look yours up, or browse by depth and claim one nobody has solved yet.')));
  main.appendChild(h('section', { class: 'progressblock' },
    h('div', { class: 'barwrap', role: 'progressbar', 'aria-valuenow': (pct*100).toFixed(2), 'aria-valuemin': '0', 'aria-valuemax': '100' },
      h('div', { class: 'bar', style: 'width:' + Math.max(pct * 100, pct > 0 ? 0.5 : 0) + '%' })),
    h('p', { class: 'progressline' },
      h('b', null, fmt(stats.done)), ' solved \u00b7 ', h('b', null, fmt(stats.total - stats.done)), ' to go \u00b7 ',
      h('b', { class: 'pct' }, (pct * 100).toFixed(pct > 0 && pct < 0.0001 ? 4 : 2) + '%'), ' complete')));
  const searchBox = h('div', { class: 'searchrow' },
    h('input', { class: 'searchin mono', placeholder: "Paste a scramble \u2014 tips like l r b u are ignored",
      'aria-label': 'scramble search',
      onkeydown: ev => { if (ev.key === 'Enter') doSearch(ev.target); } }),
    h('button', { class: 'primary', onclick: ev => doSearch(ev.target.parentElement.querySelector('input')) }, 'Find this scramble'));
  function doSearch(input) {
    const txt = input.value.trim();
    if (!txt) return;
    const parsed = E.parseAlg(txt);
    if (!parsed) { toast('Couldn\u2019t read that scramble \u2014 use U L R B with \u2032 or 2 (tips are ignored).'); return; }
    const st = E.applyParsed(parsed, E.solved(), T.syms, T.rotByCorner);
    lastSearch = { ix: E.idx(st), text: txt.replace(/\s+/g, ' ') };
    const target = '#/c/' + lastSearch.ix;
    if (location.hash === target) render(); else location.hash = target;
  }
  main.appendChild(searchBox);
  main.appendChild(h('div', { class: 'homelinks' },
    h('a', { class: 'ghost', href: '#/browse' }, 'Browse by depth'),
    h('button', { class: 'ghost', onclick: async () => {
      const bm = await DB.doneMap();
      for (let tries = 0; tries < 4000; tries++) {
        const o = Math.floor(Math.random() * T.reps.length);
        if (!(bm[o >> 3] & (1 << (o & 7)))) { const cid = T.reps[o]; location.hash = '#/c/' + Math.min(cid, mirrorOf(E.unidx(cid))); return; }
      }
      toast('Couldn\u2019t find an unsolved position \u2014 looks like they\u2019re all done.');
    } }, 'Take me to an unsolved position'),
    h('a', { class: 'ghost', href: '#/about' }, 'How it works')));
}

/* ---------------- class / pair page ---------------- */
function copyBtn(text) {
  return h('button', { class: 'copy', title: 'Copy', onclick: ev => {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast('Copied'))
      .catch(() => { const ta = h('textarea', null, text); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Copied'); });
  } }, '\u2398');
}
function sidePanel(side, label, doneSet, exactView) {
  const shownState = exactView && exactView.state ? exactView.state : side.state;
  const isExact = E.idx(shownState) !== side.id;
  const shownScramble = exactView && exactView.scramble
    ? exactView.scramble
    : (isExact ? E.optimalScramble(shownState, T.dist, false) : side.scramble);
  const wrap = h('div', { class: 'sidepanel' },
    h('div', { class: 'sidehead' },
      h('span', { class: 'sidelabel' }, label),
      h('span', { class: 'depthchip d' + side.depth }, side.depth + ' moves deep'),
      doneSet && doneSet.has(side.id) ? h('span', { class: 'donechip' }, '\u2713 solved') : null,
      h('span', { class: 'ordinal' }, '#' + fmt(side.ord + 1))),
    (() => {
      const vs = { mode: '2d', yaw: R.DEFAULT_VIEW.yaw, pitch: R.DEFAULT_VIEW.pitch };
      const netBox = h('div', { class: 'netwrap' });
      const draw = () => {
        netBox.innerHTML = vs.mode === '2d'
          ? R.netSVG(shownState, 330)
          : R.iso3dSVG(shownState, 215, vs.yaw, vs.pitch);
        netBox.classList.toggle('grab', vs.mode === '3d');
      };
      const b2 = h('button', { class: 'viewbtn on', onclick: () => { vs.mode = '2d'; b2.classList.add('on'); b3.classList.remove('on'); hint.textContent = ''; draw(); } }, '2D');
      const b3 = h('button', { class: 'viewbtn', onclick: () => { vs.mode = '3d'; b3.classList.add('on'); b2.classList.remove('on'); hint.textContent = 'drag to rotate \u00b7 double-click to reset'; draw(); } }, '3D');
      const hint = h('span', { class: 'viewhint' });
      let drag = null;
      netBox.addEventListener('pointerdown', ev => { if (vs.mode !== '3d') return; drag = { x: ev.clientX, y: ev.clientY }; netBox.setPointerCapture(ev.pointerId); });
      netBox.addEventListener('pointermove', ev => {
        if (!drag || vs.mode !== '3d') return;
        vs.yaw += (ev.clientX - drag.x) * 0.012;
        vs.pitch = Math.max(-1.25, Math.min(1.25, vs.pitch + (ev.clientY - drag.y) * 0.012));
        drag = { x: ev.clientX, y: ev.clientY }; draw();
      });
      netBox.addEventListener('pointerup', () => { drag = null; });
      netBox.addEventListener('dblclick', () => { if (vs.mode === '3d') { vs.yaw = R.DEFAULT_VIEW.yaw; vs.pitch = R.DEFAULT_VIEW.pitch; draw(); } });
      draw();
      return h('div', null, h('div', { class: 'viewtoggle' }, b2, b3, hint), netBox);
    })(),
    h('div', { class: 'scrline' }, h('span', { class: 'scrlabel' }, 'scramble'), h('code', { class: 'mono scr' }, shownScramble || '(solved)'), shownScramble ? copyBtn(shownScramble) : null));
  // symmetry strip — clicking a view opens it in a popup
  const strip = h('div', { class: 'symstrip' });
  const shownIx = E.idx(shownState);
  side.variants.forEach((v, i) => {
    strip.appendChild(h('button', { class: 'symthumb' + (v.ix === shownIx ? ' on' : ''),
      title: 'rotation ' + (i + 1) + ' of ' + side.variants.length,
      onclick: () => symPopup(v, i, side.variants.length),
      html: R.netSVG(v.state, 104, { cls: 'oonet thumb', thumb: true }) }));
  });
  wrap.append(h('div', { class: 'symhead' }, side.variants.length + (side.variants.length === 1 ? ' unique view' : ' unique views'), h('span', { class: 'hintt' }, ' \u2014 click any view to see it up close')), strip);
  return wrap;
}
function symPopup(v, i, total) {
  const scrLine = h('div', { class: 'scrline' });
  const show = rand => {
    const scr = E.optimalScramble(v.state, T.dist, rand) || '(solved)';
    scrLine.innerHTML = '';
    scrLine.append(h('span', { class: 'scrlabel' }, 'scramble to this view'),
      h('code', { class: 'mono scr' }, scr), copyBtn(scr));
  };
  show(false);
  const esc = ev => { if (ev.key === 'Escape') close(); };
  const ov = h('div', { class: 'modal-ov', onclick: ev => { if (ev.target === ov) close(); } },
    h('div', { class: 'modal-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'rotation view' },
      h('button', { class: 'modal-x', 'aria-label': 'close', onclick: () => close() }, '\u00d7'),
      h('div', { class: 'symhead' }, 'rotation ' + (i + 1) + ' of ' + total),
      h('div', { class: 'netwrap modal-net', html: R.netSVG(v.state, 280) }),
      scrLine,
      h('button', { class: 'ghost sm', onclick: () => show(true) }, 'show me another scramble')));
  function close() { ov.remove(); document.removeEventListener('keydown', esc); }
  document.addEventListener('keydown', esc);
  document.body.appendChild(ov);
}
async function pageClass(main, anyId) {
  if (!(anyId >= 0) || anyId >= E.NSLOTS || T.dist[anyId] < 0) { main.appendChild(h('div', { class: 'card error' }, 'That position doesn\u2019t exist \u2014 check the link and try again.')); return; }
  const exact = E.unidx(anyId);
  const cid = canonOf(exact);
  const pair = pairOf(cid);
  // the URL keeps the exact state that was entered, so the page shows that view — not a rotated stand-in
  const exactSide = (!pair.self && pair.b && cid === pair.b.id) ? 'b' : 'a';
  const entered = (lastSearch && lastSearch.ix === anyId) ? lastSearch.text : null;

  const sols = await DB.pairSolutions(pair.pairId);
  const doneSet = new Set();
  for (const s of sols) if (s.status === 'approved') { doneSet.add(s.classId); doneSet.add(s.partnerId); }

  main.appendChild(h('div', { class: 'crumbs' },
    h('a', { href: '#/browse/' + pair.a.depth }, 'depth ' + pair.a.depth), ' / position #' + fmt(pair.a.ord + 1)));

  const panels = h('section', { class: 'pairrow' + (pair.self ? ' single' : '') },
    sidePanel(pair.a, pair.self ? 'self-mirror position' : 'position', doneSet, exactSide === 'a' ? { state: exact, scramble: entered } : null),
    pair.self ? null : sidePanel(pair.b, 'LR mirror', doneSet, exactSide === 'b' ? { state: exact, scramble: entered } : null));
  main.appendChild(panels);

  /* solutions */
  const solCard = h('section', { class: 'card solcard' }, h('h3', null, 'Solutions'));
  const approved = sols.filter(s => s.status === 'approved');
  const mine = sols.filter(s => s.status === 'pending');
  if (!approved.length) solCard.appendChild(h('p', { class: 'empty' }, 'Nobody has claimed this position yet \u2014 yours could be the first. Submit it below.'));
  for (const s of approved) {
    const mirrored = E.mirrorAlg(s.solution);
    const enteredLeft = s.classId === pair.a.id;
    solCard.appendChild(h('div', { class: 'solrow' },
      h('div', { class: 'solcell' },
        h('span', { class: 'soltag' }, pair.self ? 'solution' : (enteredLeft ? 'position' : 'mirror')),
        h('code', { class: 'mono sol' }, s.solution), copyBtn(s.solution)),
      pair.self ? null : h('div', { class: 'solcell' },
        h('span', { class: 'soltag auto' }, (enteredLeft ? 'mirror' : 'position') + ' \u00b7 auto-mirrored'),
        h('code', { class: 'mono sol' }, mirrored), copyBtn(mirrored)),
      h('div', { class: 'solmeta' }, s.moves + ' moves', s.showName && s.name ? ' \u00b7 by ' + s.name : '')));
  }
  for (const s of mine) solCard.appendChild(h('div', { class: 'solrow pending' },
    h('div', { class: 'solcell' }, h('span', { class: 'soltag' }, 'yours \u00b7 awaiting review'), h('code', { class: 'mono sol' }, s.solution)),
    h('div', { class: 'solmeta' }, s.moves + ' moves')));
  main.appendChild(solCard);

  /* submit */
  const sub = h('section', { class: 'card subcard' }, h('h3', null, 'Submit a solution'));
  if (!DB.user) {
    sub.appendChild(h('p', null, 'You can browse everything without an account \u2014 sign in with Google only when you want to submit.'));
    sub.appendChild(h('button', { class: 'primary', onclick: () => DB.signIn().catch(e => toast(e.message)) }, 'Sign in with Google'));
  } else {
    const ta = h('textarea', { class: 'mono solin', rows: '2',
      placeholder: "e.g.  [r] L U' Rw B2 U L'   \u2014 rotations free \u00b7 wides & doubles 1 move \u00b7 tips ignored \u00b7 max 15" });
    const status = h('div', { class: 'verifyline' }, 'Type a solution \u2014 it\u2019s checked live against every rotation of both mirrors.');
    const nameRow = h('label', { class: 'namerow' },
      h('input', { type: 'checkbox', checked: '' }), ' show my name (', DB.user.name || DB.user.email, ') on this solution');
    const btn = h('button', { class: 'primary', disabled: '' }, 'Submit for review');
    let lastVerify = null;
    const onInput = () => {
      const v = verifySolution(ta.value, pair); lastVerify = v;
      status.className = 'verifyline ' + (v.ok ? 'good' : (ta.value.trim() ? 'bad' : ''));
      status.textContent = v.ok
        ? '\u2713 Solves the ' + (pair.self || v.side === 'a' ? 'position' : 'mirror') + ' in ' + v.moves + ' moves. Ready to submit.'
        : (ta.value.trim() ? v.error : 'Type a solution \u2014 it\u2019s checked live against every rotation of both mirrors.');
      if (v.ok) btn.removeAttribute('disabled'); else btn.setAttribute('disabled', '');
    };
    ta.addEventListener('input', onInput);
    btn.addEventListener('click', async () => {
      const v = lastVerify; if (!v || !v.ok) return;
      const sideObj = v.side === 'b' && pair.b ? pair.b : pair.a;
      const partner = pair.self ? sideObj : (v.side === 'a' ? (pair.b || pair.a) : pair.a);
      btn.setAttribute('disabled', '');
      try {
        await DB.submit({
          pairId: pair.pairId, classId: sideObj.id, partnerId: partner.id,
          scramble: sideObj.scramble, solution: ta.value.trim().replace(/\s+/g, ' '),
          moves: v.moves, name: DB.user.name || DB.user.email, showName: nameRow.querySelector('input').checked,
        });
        toast('Submitted \u2014 a moderator will take a look soon.');
        render();
      } catch (err) { toast('Submit failed: ' + err.message); btn.removeAttribute('disabled'); }
    });
    sub.append(ta, status, nameRow, btn);
  }
  main.appendChild(sub);
}

/* ---------------- browse ---------------- */
async function pageBrowse(main, route) {
  const m = route.match(/^#\/browse\/?(\d+)?(?:\/p(\d+))?/);
  const depth = m && m[1] !== undefined ? +m[1] : 5;
  const page = m && m[2] ? +m[2] : 0;
  const bm = await DB.doneMap();
  const isDone = o => !!(bm[o >> 3] & (1 << (o & 7)));

  const chips = h('div', { class: 'depthchips' });
  for (let d = 0; d <= 11; d++) {
    const list = T.depthIdx[d];
    let done = 0; for (const o of list) if (isDone(o)) done++;
    chips.appendChild(h('a', { href: '#/browse/' + d, class: 'depthsel d' + d + (d === depth ? ' on' : '') },
      h('b', null, String(d)), h('span', null, done + '/' + fmt(list.length))));
  }
  main.appendChild(h('section', { class: 'browsehead' },
    h('h2', null, 'Every position, sorted by depth'),
    h('p', { class: 'lede sm' }, 'Depth is the proven minimum number of moves to solve. Click any position to see its mirror, its rotations, and the solutions on record.'),
    chips));

  const list = T.depthIdx[depth];
  const PER = 48, pages = Math.max(1, Math.ceil(list.length / PER));
  const pg = Math.min(page, pages - 1);
  const grid = h('div', { class: 'classgrid' });
  for (let i = pg * PER; i < Math.min(list.length, (pg + 1) * PER); i++) {
    const o = list[i], cid = T.reps[o];
    const st = E.unidx(cid);
    grid.appendChild(h('a', { href: '#/c/' + Math.min(cid, mirrorOf(st)), class: 'classcell' + (isDone(o) ? ' done' : '') },
      h('div', { html: R.netSVG(st, 124, { cls: 'oonet thumb', thumb: true }) }),
      h('div', { class: 'cellmeta' }, '#' + fmt(o + 1), isDone(o) ? h('span', { class: 'tick' }, ' \u2713') : null)));
  }
  main.appendChild(grid);
  const pager = h('div', { class: 'pager' },
    h('a', { href: '#/browse/' + depth + '/p' + Math.max(0, pg - 1), class: 'ghost' + (pg === 0 ? ' off' : '') }, '\u2190 previous'),
    h('span', { class: 'pginfo' }, 'page ' + fmt(pg + 1) + ' of ' + fmt(pages) + ' \u00b7 ' + fmt(list.length) + ' positions at depth ' + depth),
    h('a', { href: '#/browse/' + depth + '/p' + Math.min(pages - 1, pg + 1), class: 'ghost' + (pg >= pages - 1 ? ' off' : '') }, 'next \u2192'),
    h('button', { class: 'ghost', onclick: () => {
      const un = list.filter(o => !isDone(o));
      if (!un.length) { toast('Every position at this depth is already solved \u2014 try another depth.'); return; }
      const o = un[Math.floor(Math.random() * un.length)];
      const st = E.unidx(T.reps[o]);
      location.hash = '#/c/' + Math.min(T.reps[o], mirrorOf(st));
    } }, 'random unsolved at this depth'));
  main.appendChild(pager);
}

/* ---------------- moderation ---------------- */
async function pageMod(main) {
  if (!DB.isMod) { main.appendChild(h('div', { class: 'card error' }, 'This page is for moderators \u2014 sign in with a moderator account to review submissions.')); return; }
  const items = await DB.pending();
  const head = h('h2', null, 'Review queue \u00b7 ' + items.length + ' pending');
  main.appendChild(head);
  if (!items.length) main.appendChild(h('p', { class: 'empty' }, 'Nothing to review right now \u2014 the queue refreshes when you reopen this tab.'));
  for (const s of items) {
    const pr = pairOf(s.classId);
    const v = verifySolution(s.solution, pr);
    const row = h('section', { class: 'card modrow' },
      h('div', { class: 'modleft', html: R.netSVG(E.unidx(s.classId), 160, { cls: 'oonet thumb', thumb: true }) }),
      h('div', { class: 'modbody' },
        h('div', { class: 'scrline' }, h('span', { class: 'scrlabel' }, 'scramble'), h('code', { class: 'mono scr' }, s.scramble)),
        h('div', { class: 'scrline' }, h('span', { class: 'scrlabel' }, 'solution'), h('code', { class: 'mono sol' }, s.solution)),
        h('div', { class: 'verifyline ' + (v.ok ? 'good' : 'bad') },
          v.ok ? '\u2713 verified \u00b7 ' + s.moves + ' moves \u00b7 by ' + (s.name || 'anonymous') + (s.showName ? '' : ' (name hidden)')
               : '\u2717 fails verification now: ' + v.error)),
      h('div', { class: 'modacts' },
        h('button', { class: 'primary', disabled: v.ok ? null : '', onclick: async ev => {
          ev.target.setAttribute('disabled', '');
          try { await DB.review(s.id, 'approved'); toast('Approved \u2014 position marked solved.'); render(); }
          catch (err) { toast('Approve failed: ' + err.message); ev.target.removeAttribute('disabled'); }
        } }, 'Approve'),
        h('button', { class: 'danger', onclick: async () => { await DB.review(s.id, 'rejected'); toast('Rejected.'); render(); } }, 'Reject'),
        h('a', { class: 'ghost', href: '#/c/' + s.pairId }, 'open position')));
    main.appendChild(row);
  }
  /* moderators */
  const mc = h('section', { class: 'card' }, h('h3', null, 'Moderators'));
  const mods = await DB.mods();
  const tbl = h('div', { class: 'modlist' });
  for (const mEntry of mods) tbl.appendChild(h('div', { class: 'modent' },
    h('span', null, mEntry.email || mEntry.uid, mEntry.invite ? ' \u00b7 invited, not yet signed in' : ''),
    DB.isAdmin ? h('button', { class: 'ghost sm', onclick: async () => { await DB.revoke(mEntry.invite ? mEntry.email : mEntry.uid); render(); } }, 'remove') : null));
  if (!mods.length) tbl.appendChild(h('p', { class: 'empty' }, 'No additional moderators yet.'));
  const inv = h('div', { class: 'inviterow' },
    h('input', { class: 'searchin', placeholder: 'google account email', 'aria-label': 'moderator email' }),
    h('button', { class: 'primary', onclick: async ev => {
      const em = ev.target.parentElement.querySelector('input').value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Enter a valid email.'); return; }
      await DB.invite(em); toast('Invited \u2014 they become a moderator the next time they sign in.'); render();
    } }, 'Add moderator'));
  mc.append(tbl, inv);
  main.appendChild(mc);
}

/* ---------------- about ---------------- */
function pageAbout(main) {
  main.appendChild(h('section', { class: 'card prose' },
    h('h2', null, 'How Pyraminx OO works'),
    h('p', null, 'The Pyraminx (ignoring trivial tips) has exactly 933,120 positions, and every one of them can be solved in 11 moves or fewer \u2014 that is proven by computer. What no computer can decide is which short solution feels best in human hands. This site collects the community\u2019s answer, one position at a time.'),
    h('h3', null, 'Positions, rotations and mirrors'),
    h('p', null, 'Rotating the whole puzzle does not change the solve, so the 933,120 raw states condense into ' + fmt(T.reps.length) + ' positions \u2014 each covering up to 12 rotations, which you can flip through on any position page. Left\u2013right mirror images are different solves with mirrored algorithms, so a position and its mirror are shown side by side: submit either, and the mirrored solution is generated automatically. One approved solution marks both done.'),
    h('h3', null, 'Notation'),
    h('div', { class: 'nottable' },
      nrow('U L R B', 'face moves \u00b7 1 move each', "U' or U2 both mean the inverse turn \u2014 still 1 move"),
      nrow('Uw Lw Rw Bw', 'wide moves \u00b7 1 move each', "convention: Rw = L [l\u2032], Lw = R [r\u2032], Uw = B [b\u2032], Bw = U [u\u2032]"),
      nrow('[u] [l] [r] [b], y', 'rotations \u00b7 0 moves', 'rotate the whole puzzle; y is the same as [u]'),
      nrow('u l r b (lowercase)', 'tips \u00b7 ignored', 'pasted scrambles can include tip moves \u2014 they are stripped')),
    h('h3', null, 'Submitting and review'),
    h('p', null, 'Solutions are at most 15 moves and are verified automatically: they must genuinely solve the scramble, viewed from any rotation, on either mirror. A moderator then reviews each submission before it is published \u2014 verification is checked again at review time. The first approved solution claims the position.'),
    h('h3', null, 'Privacy'),
    h('p', null, 'Anyone can browse without an account. Submitting requires Google sign-in; your name appears on a solution only if you leave \u201cshow my name\u201d checked.')));
  if (DB.user) main.appendChild(h('section', { class: 'card prose' },
    h('h3', null, 'Your account'),
    h('p', null, 'Signed in as ' + (DB.user.email || DB.user.name) + '.'),
    h('div', { class: 'scrline' }, h('span', { class: 'scrlabel' }, 'user id'),
      h('code', { class: 'mono scr' }, DB.user.uid), copyBtn(DB.user.uid)),
    h('p', null, 'The site owner pastes this id into the Firestore security rules to become the admin (see SETUP.md).')));
  function nrow(a, b, c) {
    return h('div', { class: 'nrow' }, h('code', { class: 'mono' }, a), h('b', null, b), h('span', null, c));
  }
}

/* ---------------- boot ---------------- */
async function boot() {
  const bootEl = $('#boot-status');
  const label = $('#boot-label'), barEl = $('#boot-bar');
  const report = (stage, n, total) => {
    const names = { cache: 'Loading cached tables', bfs: 'Mapping all 933,120 positions', classes: 'Condensing symmetries' };
    label.textContent = (names[stage] || stage) + '\u2026';
    barEl.style.width = Math.round(100 * n / total) + '%';
  };
  DB = (CFG.firebase && CFG.firebase.apiKey) ? liveDB(CFG.firebase) : demoDB();
  DB.onChange(() => render());
  const dbInit = DB.init().catch(e => toast('Database connection failed: ' + e.message));
  await buildTables(report);
  await dbInit;
  bootEl.classList.add('gone');
  setTimeout(() => bootEl.remove(), 500); // the overlay physically leaves the DOM
  render();
}
async function render() {
  try { await renderInner(); }
  catch (err) {
    const root = app(); root.innerHTML = '';
    root.appendChild(h('div', { class: 'card error', style: 'margin:48px auto;max-width:680px' },
      'Something went wrong rendering this page: ' + err.message));
  }
}
window.addEventListener('error', ev => { try { toast('Page error: ' + ev.message); } catch (e) {} });
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', boot);
window.OOApp = { verifySolution, pairOf, T, get DB() { return DB; }, ordinalOf };
})();

/* Pyraminx.net — shared account layer (auth + per-user data), site-wide.
 *
 * Exposes window.OOAccount. Auto-initializes on load, so every page that
 * includes this script (after config.js) gets a single shared sign-in session
 * — Firebase Auth already persists per-origin, so signing in on one page signs
 * you in on all of them.
 *
 * This module is deliberately generic: it knows about users, not about the OO
 * census's moderators/solutions. Domain code (oo.js) layers that on top using
 * the firestore handles exposed here.
 *
 *   OOAccount.mode               'live' | 'demo'
 *   OOAccount.ready              true once the first auth state has resolved
 *   OOAccount.user               { uid, name, email } | null
 *   OOAccount.onChange(fn)       called on every auth-state change
 *   OOAccount.signIn()           -> Promise (Google popup in live mode)
 *   OOAccount.signOut()          -> Promise
 *   OOAccount.authBox()          -> a self-updating DOM element for the navbar
 *   OOAccount.loadUserDoc(name)  -> Promise<data|null>   (keyed field on this
 *                                   site's users/{uid}/puzzles/{puzzle} doc)
 *   OOAccount.saveUserDoc(name, data) -> Promise
 *   OOAccount.fb                 { app, auth, fs, A, F } in live mode (for oo.js)
 */
(function () {
  'use strict';

  const CFG = window.OO_CONFIG || {};
  const LIVE = !!(CFG.firebase && CFG.firebase.apiKey);

  const subs = new Set();
  const notify = () => subs.forEach(f => { try { f(); } catch (e) {} });

  const state = { mode: LIVE ? 'live' : 'demo', ready: false, user: null };
  const fb = { app: null, auth: null, fs: null, A: null, F: null };
  // Per-user data lives at users/{uid}/puzzles/{puzzle} in the shared
  // TwistyTools project, so each site keeps its own progress doc under the
  // same account. Nothing here writes the parent users/{uid} doc.
  const userDocRef = () => fb.F.doc(fb.fs, 'users', state.user.uid, 'puzzles', CFG.puzzle);

  /* ---------------- live (Firebase) ---------------- */
  async function initLive() {
    const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const [appM, authM, fsM] = await Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js'),
    ]);
    fb.A = authM; fb.F = fsM;
    fb.app = appM.initializeApp(CFG.firebase);
    fb.auth = fb.A.getAuth(fb.app);
    fb.fs = fb.F.getFirestore(fb.app);
    fb.A.onAuthStateChanged(fb.auth, u => {
      state.user = u ? { uid: u.uid, name: u.displayName, email: (u.email || '').toLowerCase() } : null;
      state.ready = true;
      notify();
    });
  }
  const liveApi = {
    async signIn() { await fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider()); },
    async signOut() { await fb.A.signOut(fb.auth); },
    async loadUserDoc(name) {
      if (!state.user) return null;
      try {
        const snap = await fb.F.getDoc(userDocRef());
        const data = snap.exists() ? snap.data() : null;
        return data && name in data ? data[name] : null;
      } catch (e) { return null; }
    },
    async saveUserDoc(name, data) {
      if (!state.user) throw new Error('not signed in');
      await fb.F.setDoc(
        userDocRef(),
        { [name]: data, updatedAt: fb.F.serverTimestamp() },
        { merge: true });
    },
  };

  /* ---------------- demo (no Firebase config) ---------------- */
  // Persists a fake session + per-user docs in localStorage so the "signed in
  // everywhere" flow can be exercised without a backend.
  const DEMO_USER_KEY = 'pyraminx-account-user';
  const demoDocKey = uid => 'pyraminx-account-demo-' + uid;
  function initDemo() {
    try { state.user = JSON.parse(localStorage.getItem(DEMO_USER_KEY)) || null; } catch (e) { state.user = null; }
    state.ready = true;
    // a storage event fires when another tab signs in/out — keep sessions in sync
    window.addEventListener('storage', ev => {
      if (ev.key !== DEMO_USER_KEY) return;
      try { state.user = JSON.parse(ev.newValue) || null; } catch (e) { state.user = null; }
      notify();
    });
    notify();
  }
  const demoApi = {
    async signIn() {
      state.user = { uid: 'demo', name: 'Demo solver', email: 'demo@example.com' };
      try { localStorage.setItem(DEMO_USER_KEY, JSON.stringify(state.user)); } catch (e) {}
      notify();
    },
    async signOut() {
      state.user = null;
      try { localStorage.removeItem(DEMO_USER_KEY); } catch (e) {}
      notify();
    },
    async loadUserDoc(name) {
      if (!state.user) return null;
      try {
        const all = JSON.parse(localStorage.getItem(demoDocKey(state.user.uid))) || {};
        return name in all ? all[name] : null;
      } catch (e) { return null; }
    },
    async saveUserDoc(name, data) {
      if (!state.user) throw new Error('not signed in');
      let all = {};
      try { all = JSON.parse(localStorage.getItem(demoDocKey(state.user.uid))) || {}; } catch (e) {}
      all[name] = data;
      try { localStorage.setItem(demoDocKey(state.user.uid), JSON.stringify(all)); } catch (e) {}
    },
  };

  const impl = LIVE ? liveApi : demoApi;

  /* ---------------- self-updating navbar control ---------------- */
  function authBox() {
    const box = document.createElement('div');
    box.className = 'authbox';
    const paint = () => {
      box.innerHTML = '';
      if (state.mode === 'demo') {
        const badge = document.createElement('span');
        badge.className = 'demobadge';
        badge.title = 'No Firebase config. Data stays in this browser';
        badge.textContent = 'demo mode';
        box.appendChild(badge);
      }
      if (state.user) {
        const who = document.createElement('span');
        who.className = 'whoami';
        who.textContent = state.user.name || state.user.email;
        const out = document.createElement('button');
        out.className = 'ghost';
        out.textContent = 'Sign out';
        out.addEventListener('click', () => api.signOut().catch(e => console.error(e)));
        box.appendChild(who);
        box.appendChild(out);
      } else {
        const inb = document.createElement('button');
        inb.className = 'primary';
        inb.textContent = 'Sign in with Google';
        inb.addEventListener('click', () => api.signIn().catch(e => console.error('Sign-in failed:', e)));
        box.appendChild(inb);
      }
    };
    paint();
    // Pages that rebuild their navbar (e.g. the solver) create a fresh box each
    // render; an old box, once detached, unsubscribes itself on the next change.
    const onChange = () => {
      if (!box.isConnected) { subs.delete(onChange); return; }
      paint();
    };
    subs.add(onChange);
    return box;
  }

  /* ---------------- public API ---------------- */
  const api = {
    get mode() { return state.mode; },
    get ready() { return state.ready; },
    get user() { return state.user; },
    get fb() { return fb; },
    onChange(fn) { subs.add(fn); },
    authBox,
    signIn() { return impl.signIn(); },
    signOut() { return impl.signOut(); },
    loadUserDoc(name) { return impl.loadUserDoc(name); },
    saveUserDoc(name, data) { return impl.saveUserDoc(name, data); },
    // resolves once the first auth state is known (handles already-ready case)
    whenReady() {
      if (state.ready) return Promise.resolve();
      return new Promise(res => {
        const f = () => { if (state.ready) { subs.delete(f); res(); } };
        subs.add(f);
      });
    },
  };
  window.OOAccount = api;

  // auto-initialize
  if (LIVE) initLive().catch(e => { console.error('Account init failed:', e); state.ready = true; notify(); });
  else initDemo();
})();

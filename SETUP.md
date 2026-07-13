# Setup (Firebase + admin)

The site runs fully static. Firebase is optional and only powers sign-in, cloud
sync of per-user data (trainer progress, solver prefs), and the OO census's
shared solutions/moderation. Without it, everything falls back to localStorage
("demo mode").

## 1. Firebase config

Put your Firebase web config in [`js/config.js`](js/config.js):

```js
window.OO_CONFIG = {
  firebase: { apiKey: "…", authDomain: "…", projectId: "…", appId: "…" },
  adminEmails: ["you@example.com"],   // your Google account email
};
```

The `apiKey` is a public client identifier, not a secret — access is enforced by
the Firestore security rules below. Leave `firebase: null` to run in demo mode.

## 2. Become the admin

Admin is driven by an `admins/{uid}` collection (the rules trust any uid with a
doc there). The OO page shows your account's **user id** when you're signed in;
create a document `admins/{your-uid}` (any contents) in the Firebase console —
console writes bypass the rules, which is how you bootstrap the first admin.
After that, existing admins can grant/revoke others. `adminEmails` in `config.js`
only gates the admin UI client-side; the rules are what actually enforce writes.

## 3. Firestore security rules

The rules are version-controlled in [`firestore.rules`](firestore.rules) (wired up
by [`firebase.json`](firebase.json)) — they are the real authorization boundary
(`adminEmails` in `config.js` only gates the admin UI). Deploy them with:

```
firebase deploy --only firestore:rules
```

You can also paste the file's contents into the Firebase console (Firestore →
Rules) if you'd rather not use the CLI. Admin access comes from the `admins/{uid}`
collection (step 2) — no per-deploy uid edit needed — so deploy only once your
own `admins/{uid}` doc exists, or admin writes lock out until you create it.

## 4. One-time PII scrub of legacy solutions (run once, after deploying)

The privacy hardening (no reviewer email on public docs; no stored name when a
submitter opts out) changed WRITES only. Any solution approved *before* that change
still carries the old data on its world-readable doc. Scrub it once with the
admin-run helper (dry-run by default, `--apply` to write):

```
npm install --no-save firebase-admin@13.0.0
gcloud auth application-default login      # or set GOOGLE_APPLICATION_CREDENTIALS
node tools/scrub-legacy-pii.mjs            # preview
node -e "const major=Number(process.versions.node.split('.')[0]); if (major < 18) { console.error('Unsupported Node.js ' + process.version + '. tools/scrub-legacy-pii.mjs requires Node.js >=18.'); process.exit(1); } console.log('Node.js ' + process.version + ' OK (>=18).');"
node tools/scrub-legacy-pii.mjs --apply    # perform
```

> Note: the algorithm sheet no longer uses Firestore. Editing happens in
> `data/pyraminx_algs.json` (directly or via the Algorithms page's Export), so
> there is no `algsheet` collection or rule — see [README.md](README.md).

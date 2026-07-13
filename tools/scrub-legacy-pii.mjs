/* Pyraminx.net — one-time PII scrub for legacy solution docs (OPT-IN, admin-run).
 *
 * WHY: the privacy fixes changed WRITES only. Docs written before them still hold
 * PII on world-readable (status=='approved') documents:
 *   1. `name` set on solutions the submitter opted OUT of showing (showName==false)
 *      — the old client persisted the name and merely hid it at render time.
 *   2. `reviewedBy` holding the reviewing moderator's EMAIL (now stores the uid).
 * Firestore rules can't project fields away, so these must be scrubbed in the data.
 *
 * WHAT IT DOES (only to docs that need it):
 *   - showName==false && name!=''      -> name = ''
 *   - reviewedBy contains '@' (email)  -> reviewedBy = 'legacy'  (uid is unrecoverable)
 *
 * SAFETY: dry-run by default — prints what it WOULD change and writes nothing.
 * Pass --apply to perform the writes. Runs with the Admin SDK, which bypasses the
 * security rules, so it needs real project credentials.
 *
 * SETUP (not committed as a dependency — install just to run this):
 *   npm i -D firebase-admin
 *   # then either a service-account key:
 *   #   set GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccount.json   (Windows: setx / $env:)
 *   # or application-default creds:
 *   #   gcloud auth application-default login
 *
 * RUN:
 *   node tools/scrub-legacy-pii.mjs                 # dry run (default)
 *   node tools/scrub-legacy-pii.mjs --apply         # perform the writes
 */
import admin from 'firebase-admin';

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = 'pyraminx-oo';

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const isEmail = (v) => typeof v === 'string' && v.includes('@');

const snap = await db.collection('solutions').get();
let scanned = 0, nameHits = 0, reviewerHits = 0, changed = 0;

for (const d of snap.docs) {
  scanned++;
  const s = d.data();
  const patch = {};
  if (s.showName === false && typeof s.name === 'string' && s.name !== '') { patch.name = ''; nameHits++; }
  if (isEmail(s.reviewedBy)) { patch.reviewedBy = 'legacy'; reviewerHits++; }
  if (Object.keys(patch).length) {
    changed++;
    console.log((APPLY ? 'PATCH ' : 'WOULD PATCH ') + d.id + ' ' + JSON.stringify(patch));
    if (APPLY) await d.ref.update(patch);
  }
}

console.log('\nsolutions scanned: ' + scanned);
console.log('  opted-out name leaks: ' + nameHits);
console.log('  reviewer-email leaks: ' + reviewerHits);
console.log('  docs ' + (APPLY ? 'updated: ' : 'that would change: ') + changed);
if (!APPLY && changed) console.log('\nDry run only — re-run with --apply to write these changes.');
process.exit(0);

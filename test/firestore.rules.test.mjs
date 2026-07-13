/* Pyraminx.net — Firestore security-rules tests (OPT-IN, dev-only).
 *
 * Exercises firestore.rules against the Firestore emulator. NOT part of the
 * default `npm test` (CI may not have the emulator). Requires two dev deps and
 * the emulator:
 *
 *   npm i -D @firebase/rules-unit-testing firebase
 *   firebase emulators:exec --only firestore "node test/firestore.rules.test.mjs"
 *
 * It mirrors the real client write paths (js/oo.js) and the tightened rules:
 * a moderator-only, whitelisted 11-field create, and moderator updates restricted
 * to the review fields (status, reviewedBy) while admins may edit more broadly.
 */
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp,
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const testEnv = await initializeTestEnvironment({
  projectId: 'pyraminx-rules-test',
  firestore: { rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8') },
});

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('✓ ' + name); }
  catch (e) { console.log('✗ ' + name + '\n    ' + (e && e.message)); failed++; }
}

const authed = (uid, email = uid + '@example.com') => testEnv.authenticatedContext(uid, { email }).firestore();
// verified-email context: the moderator-invite rules require email_verified == true
const authedV = (uid, email = uid + '@example.com') => testEnv.authenticatedContext(uid, { email, email_verified: true }).firestore();
const anon = () => testEnv.unauthenticatedContext().firestore();

// Seed privileged docs / fixtures bypassing the rules.
async function seed(fn) { await testEnv.withSecurityRulesDisabled(c => fn(c.firestore())); }
const makeAdmin = (uid) => seed(db => setDoc(doc(db, 'admins', uid), {}));
const makeMod = (uid, email) => seed(async (db) => {
  await setDoc(doc(db, 'moderators', uid), { email });
  await setDoc(doc(db, 'moderatorInvites', email), {});
});

// A full, valid create payload — exactly the fields js/oo.js submit() writes.
function validSolution(uid, overrides = {}) {
  return {
    uid, status: 'pending', createdAt: serverTimestamp(),
    pairId: 100, classId: 100, partnerId: 200,
    scramble: "R U' L", solution: 'R L U B L', moves: 5,
    name: 'Tester', showName: true,
    ...overrides,
  };
}

// ---------------- users ----------------
await test('users: anonymous read denied', () =>
  assertFails(getDoc(doc(anon(), 'users', 'someone'))));
await test('users: own doc read/write allowed', async () => {
  const db = authed('u1');
  await assertSucceeds(setDoc(doc(db, 'users', 'u1'), { prefs: 1 }));
  await assertSucceeds(getDoc(doc(db, 'users', 'u1')));
});
await test('users: other user doc denied', () =>
  assertFails(getDoc(doc(authed('u1'), 'users', 'u2'))));

// ---------------- solutions: create (moderators only) ----------------
// 'a' is our moderator author for the create tests; the field-validation cases
// below need it to pass the isMod() gate so they exercise the validation itself.
await makeMod('a', 'a@example.com');
await test('solutions: anonymous create denied', () =>
  assertFails(addDoc(collection(anon(), 'solutions'), validSolution('nobody'))));
await test('solutions: non-moderator create denied', () =>
  assertFails(addDoc(collection(authed('plainuser'), 'solutions'), validSolution('plainuser'))));
await test('solutions: valid moderator create allowed', () =>
  assertSucceeds(addDoc(collection(authed('a'), 'solutions'), validSolution('a'))));
await test('solutions: wrong uid denied', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('attacker'))));
await test('solutions: status != pending denied', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { status: 'approved' }))));
await test('solutions: extra field denied (hasOnly)', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { adminNotes: 'x' }))));
await test('solutions: missing scramble denied', () => {
  const d = validSolution('a'); delete d.scramble;
  return assertFails(addDoc(collection(authed('a'), 'solutions'), d));
});
await test('solutions: empty scramble denied', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { scramble: '' }))));
await test('solutions: oversized solution denied', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { solution: 'R'.repeat(300) }))));
await test('solutions: non-bool showName denied', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { showName: 'yes' }))));
await test('solutions: moves out of range denied', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { moves: 16 }))));
await test('solutions: classId out of range denied', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { classId: 3732480 }))));
await test('solutions: opted-out name must be empty (privacy)', () =>
  assertFails(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { showName: false, name: 'Leaky' }))));
await test('solutions: opted-out with empty name allowed', () =>
  assertSucceeds(addDoc(collection(authed('a'), 'solutions'), validSolution('a', { showName: false, name: '' }))));

// ---------------- solutions: update ----------------
async function seedPending(id) {
  await seed(db => setDoc(doc(db, 'solutions', id), {
    uid: 'author', status: 'pending', pairId: 1, classId: 1, partnerId: 2,
    scramble: 'R', solution: 'R L U', moves: 3, name: 'A', showName: false,
  }));
}
await test('solutions: non-mod update denied', async () => {
  await seedPending('s1');
  await assertFails(updateDoc(doc(authed('rando'), 'solutions', 's1'), { status: 'approved' }));
});
await test('solutions: moderator review-field update allowed', async () => {
  await seedPending('s2'); await makeMod('mod1', 'mod1@example.com');
  await assertSucceeds(updateDoc(doc(authed('mod1', 'mod1@example.com'), 'solutions', 's2'),
    { status: 'approved', reviewedBy: 'mod1' }));
});
await test('solutions: forged reviewedBy denied (must be own uid)', async () => {
  await seedPending('s2b'); await makeMod('mod1b', 'mod1b@example.com');
  await assertFails(updateDoc(doc(authed('mod1b', 'mod1b@example.com'), 'solutions', 's2b'),
    { status: 'approved', reviewedBy: 'someone-else' }));
});
await test('solutions: moderator content edit denied', async () => {
  await seedPending('s3'); await makeMod('mod2', 'mod2@example.com');
  await assertFails(updateDoc(doc(authed('mod2', 'mod2@example.com'), 'solutions', 's3'),
    { solution: 'hacked' }));
});
await test('solutions: admin broad edit allowed', async () => {
  await seedPending('s4'); await makeAdmin('admin1');
  await assertSucceeds(updateDoc(doc(authed('admin1'), 'solutions', 's4'), { solution: 'fixed' }));
});

// ---------------- moderator invite self-accept ----------------
await test('moderators: self-accept with verified email + matching invite allowed', async () => {
  await seed(db => setDoc(doc(db, 'moderatorInvites', 'eve@example.com'), { addedBy: 'admin' }));
  await assertSucceeds(setDoc(doc(authedV('eve', 'eve@example.com'), 'moderators', 'eve'),
    { email: 'eve@example.com', via: 'invite' }));
});
await test('moderators: self-accept without a matching invite denied', () =>
  assertFails(setDoc(doc(authedV('mallory', 'mallory@example.com'), 'moderators', 'mallory'),
    { email: 'mallory@example.com', via: 'invite' })));
await test('moderators: self-accept with UNVERIFIED email denied', async () => {
  await seed(db => setDoc(doc(db, 'moderatorInvites', 'unv@example.com'), {}));
  await assertFails(setDoc(doc(authed('unv', 'unv@example.com'), 'moderators', 'unv'),
    { email: 'unv@example.com', via: 'invite' }));
});
await test('moderators: self-accept with spoofed stored email denied', async () => {
  await seed(db => setDoc(doc(db, 'moderatorInvites', 'real@example.com'), {}));
  await assertFails(setDoc(doc(authedV('real', 'real@example.com'), 'moderators', 'real'),
    { email: 'admin@example.com', via: 'invite' }));
});
await test('moderatorInvites: invited user may consume (delete) their OWN invite', async () => {
  await seed(db => setDoc(doc(db, 'moderatorInvites', 'consume@example.com'), {}));
  await assertSucceeds(deleteDoc(doc(authedV('c1', 'consume@example.com'), 'moderatorInvites', 'consume@example.com')));
});
await test('moderatorInvites: cannot delete someone else\'s invite', async () => {
  await seed(db => setDoc(doc(db, 'moderatorInvites', 'victim@example.com'), {}));
  await assertFails(deleteDoc(doc(authedV('attacker', 'attacker@example.com'), 'moderatorInvites', 'victim@example.com')));
});
await test('moderatorInvites: admin may re-invite an existing email (update)', async () => {
  await makeAdmin('adm2');
  await seed(db => setDoc(doc(db, 'moderatorInvites', 'again@example.com'), { addedBy: 'x' }));
  await assertSucceeds(setDoc(doc(authed('adm2'), 'moderatorInvites', 'again@example.com'), { addedBy: 'adm2' }));
});

// ---------------- admins / meta ----------------
await test('admins: non-admin write denied', () =>
  assertFails(setDoc(doc(authed('u9'), 'admins', 'u9'), {})));
await test('meta: moderator write allowed, plain user denied', async () => {
  await makeMod('mod3', 'mod3@example.com');
  await assertSucceeds(setDoc(doc(authed('mod3', 'mod3@example.com'), 'meta', 'stats'), { done: 1, total: 78012 }));
  await assertFails(setDoc(doc(authed('plain'), 'meta', 'stats'), { done: 1, total: 78012 }));
});
await test('meta: stats with wrong total / extra keys / bad types denied', async () => {
  const db = authed('mod3', 'mod3@example.com');
  await assertFails(setDoc(doc(db, 'meta', 'stats'), { done: 1, total: 2 }));
  await assertFails(setDoc(doc(db, 'meta', 'stats'), { done: 1, total: 78012, extra: 'x' }));
  await assertFails(setDoc(doc(db, 'meta', 'stats'), { done: -1, total: 78012 }));
  await assertFails(setDoc(doc(db, 'meta', 'stats'), { done: 'many', total: 78012 }));
});
await test('meta: doneMap shape enforced (b64 string only, size-capped)', async () => {
  const db = authed('mod3', 'mod3@example.com');
  await assertSucceeds(setDoc(doc(db, 'meta', 'doneMap'), { b64: 'AAAA' }));
  await assertFails(setDoc(doc(db, 'meta', 'doneMap'), { b64: 'A'.repeat(13005) }));
  await assertFails(setDoc(doc(db, 'meta', 'doneMap'), { b64: 'AAAA', junk: 1 }));
  await assertFails(setDoc(doc(db, 'meta', 'doneMap'), { b64: 42 }));
});
await test('meta: arbitrary meta doc write denied even for mods', () =>
  assertFails(setDoc(doc(authed('mod3', 'mod3@example.com'), 'meta', 'other'), { anything: 'goes' })));

await testEnv.cleanup();
console.log('\n' + (failed ? '*** ' + failed + ' rules test(s) failed ***' : 'all rules tests passed'));
process.exitCode = failed > 0 ? 1 : 0;

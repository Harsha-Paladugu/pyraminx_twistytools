/* Pyraminx.net — build-freshness / reproducibility check.
 *
 * The generated outputs (js/sheet.js, js/trainer.js) and the HTML asset stamps are
 * committed, so a stale commit (source edited but not rebuilt, or a hand-edited
 * generated file) silently ships wrong assets. This re-runs the full pipeline
 * (compile sheet -> bundle trainer -> stamp) and asserts the working tree already
 * matched it. Side-effect-free: any file it rebuilds is restored afterward, so a
 * passing check leaves the tree untouched and a failing one names the stale files.
 *
 * Run: node tools/check-fresh.mjs   (npm run check:fresh)  — exit 0 fresh, 1 stale.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Everything a clean build (re)generates: the two compiled artifacts + stamped HTML.
const GENERATED = ['js/sheet.js', 'js/trainer.js',
  ...fs.readdirSync(ROOT).filter(f => f.endsWith('.html'))];

const snapshot = new Map(GENERATED.map(rel => [rel, fs.readFileSync(path.join(ROOT, rel))]));

console.log('Rebuilding (compile-sheet -> bundle trainer -> stamp)…');
try {
  execSync('node tools/compile-sheet.mjs', { cwd: ROOT, stdio: 'inherit' });
  execSync('node build.mjs', { cwd: ROOT, stdio: 'inherit' });
  execSync('node tools/stamp-assets.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('\n*** BUILD FAILED — cannot assess freshness ***');
  for (const [rel, buf] of snapshot) fs.writeFileSync(path.join(ROOT, rel), buf);
  process.exit(1);
}

const stale = [];
for (const [rel, buf] of snapshot) {
  const now = fs.readFileSync(path.join(ROOT, rel));
  if (!now.equals(buf)) stale.push(rel);
  fs.writeFileSync(path.join(ROOT, rel), buf);   // restore — keep the check non-destructive
}

if (stale.length) {
  console.error('\n*** STALE BUILD ARTIFACTS ***');
  stale.forEach(f => console.error('   ' + f + ' differs from a clean rebuild'));
  console.error('\nRun `npm run build` and commit the result.');
  process.exitCode = 1;
} else {
  console.log('\n✓ build is fresh — all generated files + HTML stamps match a clean rebuild.');
  process.exitCode = 0;
}

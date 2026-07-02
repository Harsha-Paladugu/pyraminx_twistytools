/* Pyraminx.net — content-hash asset stamping.
 *
 * Replaces the manual `?v=N` cache-busting on local js/css/img assets in the
 * *.html pages with `?v=<8-hex sha1 of the asset's bytes>`. Content-addressed, so
 * there is no integer to bump by hand and no risk of shipping a stale query: edit
 * an asset, run this (it's part of `npm run build`), and every page that loads it
 * gets the new hash automatically. Idempotent — unchanged assets keep their hash.
 *
 * Only rewrites refs that already carry `?v=` and resolve to a local
 * js/ css/ img/ file. External URLs and CSS-embedded url()s are left alone.
 *
 * Run: node tools/stamp-assets.mjs   (npm run stamp)
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const hashCache = new Map();
function hashOf(assetPath) {
  if (hashCache.has(assetPath)) return hashCache.get(assetPath);
  let h = null;
  try { h = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, assetPath))).digest('hex').slice(0, 8); }
  catch { h = null; }
  hashCache.set(assetPath, h);
  return h;
}

// quoted ref to a local js/css/img asset that carries a ?v= query
const REF = /(['"])((?:js|css|img)\/[^'"?]+)\?v=[^'"]*\1/g;

const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let changedFiles = 0, rewritten = 0, missing = 0;

for (const file of htmlFiles) {
  const full = path.join(ROOT, file);
  const before = fs.readFileSync(full, 'utf8');
  const after = before.replace(REF, (match, q, assetPath) => {
    const h = hashOf(assetPath);
    if (!h) { console.error('  MISSING asset (left unchanged): ' + assetPath + ' in ' + file); missing++; return match; }
    rewritten++;
    return q + assetPath + '?v=' + h + q;
  });
  if (after !== before) { fs.writeFileSync(full, after); changedFiles++; console.log('  stamped ' + file); }
}

console.log('stamp: ' + rewritten + ' ref(s) across ' + htmlFiles.length + ' page(s), ' + changedFiles + ' file(s) changed' + (missing ? ', ' + missing + ' MISSING' : ''));
process.exitCode = missing ? 1 : 0;

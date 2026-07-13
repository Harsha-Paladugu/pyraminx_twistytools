/* Pyraminx.net — content-hash asset stamping.
 *
 * Replaces the manual `?v=N` cache-busting on local js/css/img assets with
 * `?v=<8-hex sha1 of the asset's bytes>`. Content-addressed, so there is no
 * integer to bump by hand and no risk of shipping a stale query: edit an asset,
 * run this (it's part of `npm run build`), and every ref to it gets the new
 * hash automatically. Idempotent — unchanged assets keep their hash.
 *
 * Two passes, in order:
 *   1. css/*.css — url(../img/...?v=...) refs are stamped first, so the css
 *      bytes settle before the pages that load the css are hashed against them.
 *   2. *.html    — quoted js/css/img refs.
 *
 * A local asset ref that LACKS a ?v= query (in either place) fails the run:
 * without the query, the stamper can never version it, and it would silently
 * ship un-cache-busted forever. Add `?v=0` to a new ref and this rewrites it.
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

// quoted ref to a local js/css/img asset that carries a ?v= query (HTML)
const REF = /(['"])((?:js|css|img)\/[^'"?]+)\?v=[^'"]*\1/g;
// same, inside css url() — css files live one level down, hence the ../
const CSS_REF = /url\((['"]?)\.\.\/((?:js|css|img)\/[^'")?]+)\?v=[^'")]*\1\)/g;
// local asset refs that FORGOT the ?v= query (the char classes exclude '?', so
// a properly versioned ref never matches these)
const HTML_BARE = /(?:src|href)=(['"])((?:js|css|img)\/[^'"?#]+)\1/g;
const CSS_BARE = /url\((['"]?)(\.\.\/(?:js|css|img)\/[^'")?#]+)\1\)/g;

let changedFiles = 0, rewritten = 0, missing = 0;
const bare = [];

// pass 1: css url() refs
const cssDir = path.join(ROOT, 'css');
for (const file of fs.readdirSync(cssDir).filter(f => f.endsWith('.css'))) {
  const full = path.join(cssDir, file);
  const before = fs.readFileSync(full, 'utf8');
  const after = before.replace(CSS_REF, (match, q, assetPath) => {
    const h = hashOf(assetPath);
    if (!h) { console.error('  MISSING asset (left unchanged): ' + assetPath + ' in css/' + file); missing++; return match; }
    rewritten++;
    return 'url(' + q + '../' + assetPath + '?v=' + h + q + ')';
  });
  for (const m of before.matchAll(CSS_BARE)) bare.push('css/' + file + ' -> ' + m[2]);
  if (after !== before) { fs.writeFileSync(full, after); changedFiles++; console.log('  stamped css/' + file); }
}
hashCache.clear(); // css bytes may have changed; re-hash anything referenced from HTML

// pass 2: html refs
const htmlFiles = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
for (const file of htmlFiles) {
  const full = path.join(ROOT, file);
  const before = fs.readFileSync(full, 'utf8');
  const after = before.replace(REF, (match, q, assetPath) => {
    const h = hashOf(assetPath);
    if (!h) { console.error('  MISSING asset (left unchanged): ' + assetPath + ' in ' + file); missing++; return match; }
    rewritten++;
    return q + assetPath + '?v=' + h + q;
  });
  for (const m of before.matchAll(HTML_BARE)) bare.push(file + ' -> ' + m[2]);
  if (after !== before) { fs.writeFileSync(full, after); changedFiles++; console.log('  stamped ' + file); }
}

if (bare.length) {
  console.error('*** ' + bare.length + ' local asset ref(s) have no ?v= query and can never be cache-busted — add ?v=0 and re-run:');
  bare.forEach(b => console.error('   BARE ' + b));
}
console.log('stamp: ' + rewritten + ' ref(s) across ' + htmlFiles.length + ' page(s), ' + changedFiles + ' file(s) changed'
  + (missing ? ', ' + missing + ' MISSING' : '') + (bare.length ? ', ' + bare.length + ' BARE' : ''));
process.exitCode = (missing || bare.length) ? 1 : 0;

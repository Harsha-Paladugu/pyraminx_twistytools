/* Build the trainer bundle from src/trainer into a STAGING artifact.
 *
 * Output: js/trainer.build.js  (NOT js/trainer.js — the live trainer is left
 * untouched until an explicit cutover once this build reaches parity).
 *
 *   node build.mjs           one-off build
 *   node build.mjs --watch   rebuild on change
 */
import esbuild from 'esbuild';

const options = {
  entryPoints: ['src/trainer/index.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',                 // matches the original bundle (self-executing, no module system)
  target: 'es2018',
  jsx: 'transform',               // classic runtime: source imports React and uses JSX
  outfile: 'js/trainer.build.js',
  banner: { js: '/* Pyraminx.net — V-First trainer (bundled React app). Styles: css/trainer.css */' },
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/trainer for changes…');
} else {
  await esbuild.build(options);
  console.log('built js/trainer.build.js');
}

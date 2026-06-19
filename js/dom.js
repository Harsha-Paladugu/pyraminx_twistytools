/* Pyraminx.net — shared DOM micro-kit (window.OODom = { h, $, toast, tick }).
   One source for the tiny hyperscript helpers used by oo.js, algs.js, solver.js.
   Plain browser global; no bundler. The `html` attr is a trusted-markup-only
   escape hatch (innerHTML) — never pass user-supplied strings to it. */
(function () {
  'use strict';
  const $ = (q, el) => (el || document).querySelector(q);
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const k in (attrs || {})) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  };
  function toast(msg, duration) {
    if (duration === undefined) duration = 3500;
    const t = h('div', { class: 'toast' }, msg);
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 16);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, duration);
  }
  const tick = () => new Promise(r => setTimeout(r, 0));
  window.OODom = { h, $, toast, tick };
})();

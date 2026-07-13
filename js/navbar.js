/* Pyraminx.net — shared navigation bar.
 *
 * The primary row is the same on every page: wordmark + the site
 * sections. A page can supply sub-options that render in a second row
 * underneath, and an optional element (e.g. an auth box) for the right side.
 *
 * Usage:
 *   const bar = new SiteNavbar({
 *     active: 'oo',                                   // 'home' | 'oo' | 'solver' | 'trainer' | 'algs' | 'about'
 *     sub: [{ label: 'Solutions', href: '#/', on: true }], // optional second row
 *     right: someElement,                             // optional right-side slot
 *   });
 *   bar.mount(document.body);     // prepend to an element, or:
 *   parent.appendChild(bar.element());
 */
(function () {
  'use strict';

  // Clickjacking guard: the static host can't send X-Frame-Options /
  // frame-ancestors headers, so refuse to render inside a foreign frame. (A
  // sandboxed embed without allow-scripts can't run the app at all, so this
  // covers what matters: UI-redress of the sign-in / moderation controls.)
  if (window.top !== window.self) {
    let foreign = true;
    try { foreign = window.top.location.origin !== location.origin; } catch (e) { /* cross-origin access throws */ }
    if (foreign) {
      document.documentElement.style.display = 'none';
      try { window.top.location = location.href; } catch (e) {}
    }
  }

  const SECTIONS = [
    { id: 'home',    label: 'Home',    href: 'index.html' },
    { id: 'oo',      label: 'OO',      href: 'oo.html' },
    { id: 'solver',  label: 'Solver',  href: 'solver.html' },
    { id: 'trainer', label: 'Trainer', href: 'trainer.html' },
    { id: 'algs',    label: 'Algorithms', href: 'algs.html' },
    { id: 'about',   label: 'About',   href: 'about.html' },
  ];

  // Deliberately self-contained mini-hyperscript (subset of js/dom.js `h`): the
  // navbar is loaded on pages that don't ship dom.js, and needs no html/events.
  function el(tag, attrs) {
    const node = document.createElement(tag);
    for (const k in (attrs || {})) {
      if (k === 'class') node.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    }
    for (let i = 2; i < arguments.length; i++) {
      const kid = arguments[i];
      if (kid === null || kid === undefined || kid === false) continue;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return node;
  }

  class SiteNavbar {
    constructor(opts) {
      opts = opts || {};
      this.active = opts.active || null;
      this.sub = opts.sub || [];
      this.right = opts.right || null;
    }

    element() {
      const tabs = SECTIONS.map(s =>
        el('a', { class: 'navlink' + (s.id === this.active ? ' on' : ''), href: s.href,
                  'aria-current': s.id === this.active ? 'page' : null }, s.label));
      // A page may supply its own right-side slot; otherwise fall back to the
      // shared sign-in control so login shows up site-wide.
      const right = this.right
        || (window.OOAccount && window.OOAccount.authBox ? window.OOAccount.authBox() : null);
      const main = el('div', { class: 'topbar-main' },
        el('a', { href: 'index.html', class: 'wordmark' },
          el('span', { class: 'tri', 'aria-hidden': 'true' }), 'PYRAMINX ', el('b', null, '.net')),
        el.apply(null, ['nav', { class: 'navtabs', 'aria-label': 'site' }].concat(tabs)),
        right);
      // Skip link: pages build their main region dynamically (some as <main>,
      // some as .page, algs as .algwrap), so resolve the target at click time
      // instead of by id.
      const skip = el('a', { class: 'skiplink', href: '#' }, 'Skip to content');
      skip.addEventListener('click', ev => {
        ev.preventDefault();
        const m = document.querySelector('main, .page, .algwrap');
        if (m) { m.setAttribute('tabindex', '-1'); m.focus(); m.scrollIntoView(); }
      });
      const header = el('header', { class: 'topbar' }, skip, main);
      if (this.sub.length) {
        const links = this.sub.map(i =>
          el('a', { class: 'sublink' + (i.on ? ' on' : ''), href: i.href,
                    'aria-current': i.on ? 'page' : null }, i.label));
        header.appendChild(el.apply(null, ['nav', { class: 'subnav', 'aria-label': 'section' }].concat(links)));
      }
      return header;
    }

    mount(parent) {
      const e = this.element();
      (parent || document.body).prepend(e);
      return e;
    }
  }

  window.SiteNavbar = SiteNavbar;
})();

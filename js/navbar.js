/* Pyraminx.net — shared navigation bar.
 *
 * The primary row is the same on every page: wordmark + the four site
 * sections. A page can supply sub-options that render in a second row
 * underneath, and an optional element (e.g. an auth box) for the right side.
 *
 * Usage:
 *   const bar = new SiteNavbar({
 *     active: 'oo',                                   // 'home' | 'oo' | 'solver' | 'trainer'
 *     sub: [{ label: 'Census', href: '#/', on: true }], // optional second row
 *     right: someElement,                             // optional right-side slot
 *   });
 *   bar.mount(document.body);     // prepend to an element, or:
 *   parent.appendChild(bar.element());
 */
(function () {
  'use strict';

  const SECTIONS = [
    { id: 'home',    label: 'Home',    href: 'index.html' },
    { id: 'oo',      label: 'OO',      href: 'oo.html' },
    { id: 'solver',  label: 'Solver',  href: 'solver.html' },
    { id: 'trainer', label: 'Trainer', href: 'trainer.html' },
  ];

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
        el('a', { class: 'navlink' + (s.id === this.active ? ' on' : ''), href: s.href }, s.label));
      const main = el('div', { class: 'topbar-main' },
        el('a', { href: 'index.html', class: 'wordmark' },
          el('span', { class: 'tri', 'aria-hidden': 'true' }), 'PYRAMINX ', el('b', null, '.net')),
        el.apply(null, ['nav', { class: 'navtabs', 'aria-label': 'site' }].concat(tabs)),
        this.right);
      const header = el('header', { class: 'topbar' }, main);
      if (this.sub.length) {
        const links = this.sub.map(i =>
          el('a', { class: 'sublink' + (i.on ? ' on' : ''), href: i.href }, i.label));
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

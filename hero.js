/* hero.js – home hero (index.html). Only functional behaviour is left:
   the "Hear before / after" link scrolls smoothly to the before/after player (falls back to upload.html#hear when it is hidden).
   Removed in the anti-slop pass (2026-11-17): the animated wave line (svg.hx-wave, hidden via CSS), the scroll-linked
   headline parallax/tracking/gradient shift, the pointer spotlight and the 3D tilt. No rAF loop, no CSS variables written.
   Never throws into the page. */
(function () {
  'use strict';
  try {
    var doc = document, win = window, hero = doc.getElementById('hero');
    if (!hero) return;
    var reduce = false;
    try { reduce = !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

    var hear = hero.querySelector('.hx-hear');
    if (hear) hear.addEventListener('click', function (e) {
      var tgt = doc.getElementById('hear');
      e.preventDefault();
      /* player not shown on the home page (no data yet): go to the before/after player on the upload page */
      if (!tgt || tgt.hidden || !tgt.offsetHeight) { win.location.href = 'upload.html#hear'; return; }
      var top = tgt.getBoundingClientRect().top + (win.pageYOffset || 0) - 84;
      win.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    });
  } catch (err) { /* the page must never break because of the hero */ }
})();

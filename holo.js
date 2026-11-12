/* holo.js - gentle tilt, depth layers and holographic sheen for shop cards (shop.html only) */
(function () {
  'use strict';
  try {
    var doc = document;
    var SEL = '.product';
    var PAUSE = '.sp-pill,.sp-pad,.cart-add-ic';
    var reduce = false, fine = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    try { fine = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
    var MAX = 4, LERP = 0.12;

    function mark(root) {
      var list = (root || doc).querySelectorAll ? (root || doc).querySelectorAll(SEL + ':not([data-holo])') : [];
      for (var i = 0; i < list.length; i++) {
        list[i].setAttribute('data-holo', '');
        var cv = list[i].querySelector('.cover');
        if (cv && !cv.querySelector('.holo-sh')) {
          var a = doc.createElement('span'), b = doc.createElement('span');
          a.className = 'holo-sh'; b.className = 'holo-sp';
          a.setAttribute('aria-hidden', 'true'); b.setAttribute('aria-hidden', 'true');
          cv.appendChild(a); cv.appendChild(b);
        }
        if (sweepIO) sweepIO.observe(list[i]);
      }
    }

    /* touch / coarse: one soft sweep per card when it scrolls into view */
    var sweepIO = null;
    if (!fine && !reduce && 'IntersectionObserver' in window) {
      sweepIO = new IntersectionObserver(function (ens) {
        ens.forEach(function (en) {
          if (!en.isIntersecting) return;
          var c = en.target;
          sweepIO.unobserve(c);
          c.classList.add('holo-sweep');
          setTimeout(function () { c.classList.remove('holo-sweep'); }, 1000);
        });
      }, { threshold: 0.4 });
    }

    function boot() {
      mark(doc);
      var box = doc.getElementById('products') || doc.body;
      try { new MutationObserver(function () { mark(box); }).observe(box, { childList: true, subtree: true }); } catch (e) {}
      if (!fine || reduce) return; // reduced motion: CSS-only static sheen on hover

      var states = [];            // cards still animating (hovered or easing back)
      var cur = null, raf = 0;

      function st(card) {
        for (var i = 0; i < states.length; i++) if (states[i].card === card) return states[i];
        var s = { card: card, rx: 0, ry: 0, lift: 0, hx: 0, hy: 0, sx: 50, sy: 50,
                  trx: 0, try_: 0, tlift: 0, thx: 0, thy: 0, tsx: 50, tsy: 50 };
        states.push(s);
        return s;
      }
      function finish(s) {
        var c = s.card;
        c.style.transform = '';
        c.style.removeProperty('--hx'); c.style.removeProperty('--hy');
        c.style.removeProperty('--sx'); c.style.removeProperty('--sy'); c.style.removeProperty('--sa');
        c.style.removeProperty('--mx'); c.style.removeProperty('--my');
        c.classList.remove('holo-live');
      }
      function loop() {
        raf = 0;
        for (var i = states.length - 1; i >= 0; i--) {
          var s = states[i];
          s.rx += (s.trx - s.rx) * LERP; s.ry += (s.try_ - s.ry) * LERP;
          s.lift += (s.tlift - s.lift) * LERP;
          s.hx += (s.thx - s.hx) * LERP; s.hy += (s.thy - s.hy) * LERP;
          s.sx += (s.tsx - s.sx) * LERP; s.sy += (s.tsy - s.sy) * LERP;
          var done = s.card !== cur && Math.abs(s.rx) < 0.01 && Math.abs(s.ry) < 0.01 && s.lift < 0.01;
          if (done) { finish(s); states.splice(i, 1); continue; }
          var c = s.card, cs = c.style;
          cs.transform = 'perspective(1000px) rotateX(' + s.rx.toFixed(3) + 'deg) rotateY(' + s.ry.toFixed(3) +
            'deg) translateY(' + (-3 * s.lift).toFixed(2) + 'px)';
          cs.setProperty('--hx', s.hx.toFixed(3)); cs.setProperty('--hy', s.hy.toFixed(3));
          cs.setProperty('--sx', s.sx.toFixed(1) + '%'); cs.setProperty('--sy', s.sy.toFixed(1) + '%');
          cs.setProperty('--sa', (200 + s.hx * 50 + s.hy * 30).toFixed(1) + 'deg');
          cs.setProperty('--mx', ((s.hx + 1) * 50).toFixed(1) + '%'); cs.setProperty('--my', ((s.hy + 1) * 50).toFixed(1) + '%');
        }
        if (states.length) raf = requestAnimationFrame(loop);
      }
      function kick() { if (!raf && states.length) raf = requestAnimationFrame(loop); }

      function leave() {
        if (!cur) return;
        var s = st(cur);
        s.trx = 0; s.try_ = 0; s.tlift = 0; s.thx = 0; s.thy = 0;
        cur.classList.remove('holo-hover', 'holo-pause');
        cur = null;
        kick();
      }
      function enter(card) {
        cur = card;
        card.classList.add('holo-live', 'holo-hover');
        st(card);
      }

      doc.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var t = e.target, card = t && t.closest ? t.closest(SEL + '[data-holo]') : null;
        if (card !== cur) { leave(); if (card) enter(card); }
        if (!card) return;
        var s = st(card);
        var paused = e.buttons !== 0 || !!(t.closest && t.closest(PAUSE));
        card.classList.toggle('holo-pause', paused);
        var r = card.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        var py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        var dx = (px - 0.5) * 2, dy = (py - 0.5) * 2; // -1..1
        if (paused) { s.trx = 0; s.try_ = 0; s.thx = 0; s.thy = 0; s.tlift = 1; }
        else { s.try_ = dx * MAX; s.trx = -dy * MAX; s.thx = dx; s.thy = dy; s.tlift = 1; }
        var cv = card.querySelector('.cover'), cr = cv ? cv.getBoundingClientRect() : r;
        if (cr.width && cr.height) {
          s.tsx = Math.max(0, Math.min(100, (e.clientX - cr.left) / cr.width * 100));
          s.tsy = Math.max(0, Math.min(100, (e.clientY - cr.top) / cr.height * 100));
        }
        kick();
      }, { passive: true });

      doc.documentElement.addEventListener('mouseleave', leave, { passive: true });
      window.addEventListener('blur', leave);
    }

    if (doc.body) boot(); else doc.addEventListener('DOMContentLoaded', boot);
  } catch (err) { /* page must never break because of an effect */ }
})();

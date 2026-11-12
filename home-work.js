/* home-work.js – "Selected work" showcase (index.html only).
   Re-lays out the track cards that home.js renders into #tracks (players and their logic stay in home.js):
   - 3..20 tracks, desktop: scroll-driven 3D helix inside a sticky stage (scrolling rotates the helix, front card in focus)
   - 3..20 tracks, phones (<= 720px) or reduced motion: horizontal swipe carousel with scroll-snap (+ slight 3D tilt of side cards)
   - 1..2 tracks: simple centered layout
   Only transform/opacity/filter are written, and only by this file (cards carry data-hs, so motion.js/reveal.js leave them alone). */
(function () {
  'use strict';
  try {
    var doc = document, win = window;
    var work = doc.getElementById('work'), stack = doc.getElementById('hx-stack'), pin = doc.getElementById('hx-pin'), host = doc.getElementById('tracks');
    if (!work || !stack || !pin || !host) return;

    var reduce = false;
    try { reduce = !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    var mqM = win.matchMedia ? matchMedia('(max-width: 720px)') : { matches: false };
    var STEP = 40, YSTEP = 22, TOP = 78;               // degrees per card, px per card, sticky offset (topbar)
    var mode = 'none', cards = [], n = 0;
    var raf = 0, pVis = 0, pTgt = 0, stackTop = 0, range = 1, vh = win.innerHeight || 800, R = 340, lastKeys = [], lastZ = [];
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

    function getCards() {
      return [].slice.call(host.children).filter(function (el) { return el.classList && el.classList.contains('track') && !el.classList.contains('sk-card'); });
    }
    function wantMode(count) {
      if (!count) return 'none';
      if (count <= 2) return 'simple';
      return (mqM.matches || reduce) ? 'carousel' : 'helix';
    }

    /* ---------- Setup / teardown ---------- */
    function clearStyles() {
      cards.forEach(function (c) { c.style.transform = ''; c.style.opacity = ''; c.style.filter = ''; c.style.zIndex = ''; c.style.visibility = ''; c.classList.remove('hx-off', 'hx-front'); });
      lastKeys = []; lastZ = [];
    }
    function teardown() {
      clearStyles();
      work.classList.remove('hx-simple', 'hx-carousel', 'hx-helix');
      stack.style.height = '';
      host.removeAttribute('aria-label');
      mode = 'none';
    }
    function setup(m) {
      work.classList.add('hx-' + m);
      mode = m;
      if (m !== 'none') host.setAttribute('aria-label', 'Recent mixes');
      if (m === 'helix') stack.style.height = ((n + 1) * 45) + 'vh';
      measure();
      pVis = pTgt = targetP();
      render(true);
    }
    var sig = '';
    function apply() {
      var next = getCards(), m = wantMode(next.length);
      var s = m + '|' + next.map(function (c) { return c.dataset.id || ''; }).join(',') + '|' + next.length;
      var same = next.length === cards.length && next.every(function (c, i) { return c === cards[i]; });
      if (s === sig && same) return;
      if (mode !== 'none') teardown();
      cards = next; n = next.length; sig = s;
      if (m !== 'none') setup(m);
    }

    /* ---------- Geometry ---------- */
    function docTop(el) { return el.getBoundingClientRect().top + (win.pageYOffset || 0); }
    function measure() {
      vh = win.innerHeight || 800;
      if (mode === 'helix') {
        stackTop = docTop(stack);
        range = Math.max(1, stack.offsetHeight - pin.offsetHeight);
        var w = cards[0] ? cards[0].offsetWidth : 300;
        R = Math.round(w * 1.06);
      }
    }
    function targetP() {
      var y = win.pageYOffset || 0;
      return clamp((y - (stackTop - TOP)) / range, 0, 1) * (n - 1);
    }
    function yFor(i) { return Math.round(stackTop - TOP + (i / Math.max(1, n - 1)) * range) + 1; }

    /* ---------- Helix rendering ---------- */
    function renderHelix(force) {
      var d, a, rad, ad, i, x, y, z, op, bl, sc, key, vis, zi;
      for (i = 0; i < n; i++) {
        d = i - pVis; ad = Math.abs(d);
        if (ad > 2.7) { if (lastKeys[i] !== 'h') { lastKeys[i] = 'h'; cards[i].style.visibility = 'hidden'; cards[i].style.opacity = '0'; cards[i].classList.add('hx-off'); } continue; }
        a = d * STEP; rad = a * Math.PI / 180;
        x = R * Math.sin(rad); z = R * Math.cos(rad) - R; y = d * YSTEP;
        op = ad < 0.12 ? 1 : Math.max(0, 1 - ad * 0.44);
        bl = ad < 0.12 ? 0 : Math.min(5, ad * 2.4);
        sc = 1 - Math.min(ad, 3) * 0.015;
        key = x.toFixed(1) + '|' + y.toFixed(1) + '|' + a.toFixed(2) + '|' + op.toFixed(3) + '|' + bl.toFixed(1);
        if (key !== lastKeys[i] || force) {
          lastKeys[i] = key;
          var c = cards[i];
          if (c.style.visibility) c.style.visibility = '';
          c.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px) rotateY(' + a.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
          c.style.opacity = op.toFixed(3);
          c.style.filter = bl > 0.15 ? 'blur(' + bl.toFixed(1) + 'px)' : '';
          zi = 50 + Math.round(Math.cos(rad) * 40);
          if (lastZ[i] !== zi) { lastZ[i] = zi; c.style.zIndex = zi; }
        }
        var front = ad < 0.5;
        if (front !== cards[i].classList.contains('hx-front')) { cards[i].classList.toggle('hx-front', front); }
        if (cards[i].classList.contains('hx-off') === front) cards[i].classList.toggle('hx-off', !front);
      }
    }

    /* ---------- Carousel tilt (scroll-snap itself is CSS) ---------- */
    var tiltRaf = 0;
    function renderTilt() {
      tiltRaf = 0;
      if (mode !== 'carousel' || reduce) return;
      var hr = host.getBoundingClientRect(), mid = hr.left + hr.width / 2, i, c, r, off, key;
      for (i = 0; i < n; i++) {
        c = cards[i]; r = c.getBoundingClientRect();
        if (r.right < hr.left - 40 || r.left > hr.right + 40) continue;
        off = clamp((r.left + r.width / 2 - mid) / Math.max(1, r.width), -1.4, 1.4);
        key = off.toFixed(2);
        if (key === lastKeys[i]) continue;
        lastKeys[i] = key;
        c.style.transform = 'perspective(900px) rotateY(' + (off * 17).toFixed(2) + 'deg) scale(' + (1 - Math.min(1, Math.abs(off)) * 0.07).toFixed(3) + ')';
        c.style.opacity = (1 - Math.min(1, Math.abs(off)) * 0.35).toFixed(2);
      }
    }
    function onHostScroll() { if (mode === 'carousel' && !reduce && !tiltRaf) tiltRaf = requestAnimationFrame(renderTilt); }

    /* ---------- Frame loop ---------- */
    function render(force) {
      raf = 0;
      if (mode === 'helix') {
        var y = win.pageYOffset || 0;
        var near = y > stackTop - vh * 1.5 && y < stackTop + stack.offsetHeight + vh * 0.5;
        pTgt = targetP();
        if (!near && !force) { pVis = pTgt; return; }
        pVis += (pTgt - pVis) * 0.2;
        if (Math.abs(pTgt - pVis) < 0.002) pVis = pTgt;
        renderHelix(force);
        if (pVis !== pTgt) raf = requestAnimationFrame(function () { render(false); });
      } else if (mode === 'carousel') {
        renderTilt();
      }
    }
    function schedule() { if (!raf && mode === 'helix') raf = requestAnimationFrame(function () { render(false); }); }

    /* ---------- Navigation: click / keys / focus ---------- */
    function frontIdx() {
      if (mode === 'helix') return clamp(Math.round(targetP()), 0, n - 1);
      if (mode === 'carousel') {
        var hr = host.getBoundingClientRect(), mid = hr.left + hr.width / 2, best = 0, bd = 1e9;
        cards.forEach(function (c, i) { var r = c.getBoundingClientRect(), dd = Math.abs(r.left + r.width / 2 - mid); if (dd < bd) { bd = dd; best = i; } });
        return best;
      }
      return 0;
    }
    function goTo(i, smooth) {
      i = clamp(i, 0, n - 1);
      if (mode === 'helix') {
        measure();
        win.scrollTo({ top: yFor(i), behavior: smooth && !reduce ? 'smooth' : 'auto' });
      } else if (mode === 'carousel') {
        var c = cards[i], hr = host.getBoundingClientRect(), r = c.getBoundingClientRect();
        host.scrollTo({ left: host.scrollLeft + (r.left + r.width / 2) - (hr.left + hr.width / 2), behavior: smooth && !reduce ? 'smooth' : 'auto' });
      }
    }
    function cardOf(el) { return el && el.closest ? el.closest('.track') : null; }

    // Helix: only the front card is interactive. A click on any other card brings it to the front instead.
    host.addEventListener('click', function (e) {
      if (mode !== 'helix') return;
      var c = cardOf(e.target), i = cards.indexOf(c);
      if (i < 0 || i === frontIdx()) return;
      e.preventDefault(); e.stopPropagation();
      goTo(i, true);
    }, true);
    host.addEventListener('focusin', function (e) {
      if (mode !== 'helix' && mode !== 'carousel') return;
      var i = cards.indexOf(cardOf(e.target));
      if (i >= 0 && i !== frontIdx()) goTo(i, false);
    });
    host.addEventListener('keydown', function (e) {
      if (mode !== 'helix' && mode !== 'carousel') return;
      var k = e.key, dir = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 0;
      if (!dir || e.altKey || e.ctrlKey || e.metaKey) return;
      var cur = cards.indexOf(cardOf(doc.activeElement)); if (cur < 0) cur = frontIdx();
      var nx = cur + dir;
      if (nx < 0 || nx >= n) return;                      // at the ends: let the page scroll normally
      e.preventDefault();
      goTo(nx, false);
      var b = cards[nx].querySelector('.play-btn'); if (b) { try { b.focus({ preventScroll: true }); } catch (er) { b.focus(); } }
    });

    /* ---------- Wiring ---------- */
    host.addEventListener('scroll', onHostScroll, { passive: true });
    win.addEventListener('scroll', schedule, { passive: true });
    var rq = 0;
    function remeasure() { if (rq) return; rq = requestAnimationFrame(function () { rq = 0; measure(); if (mode === 'helix') { render(true); } else if (mode === 'carousel') { lastKeys = []; renderTilt(); } }); }
    win.addEventListener('resize', remeasure, { passive: true });
    win.addEventListener('load', remeasure);
    try { if (win.ResizeObserver) new ResizeObserver(remeasure).observe(doc.querySelector('main') || doc.body); } catch (e) {}
    var onMq = function () { sig = ''; apply(); };
    if (mqM.addEventListener) mqM.addEventListener('change', onMq); else if (mqM.addListener) mqM.addListener(onMq);

    var aq = 0;
    try { new MutationObserver(function () { if (aq) return; aq = requestAnimationFrame(function () { aq = 0; apply(); }); }).observe(host, { childList: true }); } catch (e) {}
    apply();
  } catch (err) { /* the page must never break because of an animation */ }
})();

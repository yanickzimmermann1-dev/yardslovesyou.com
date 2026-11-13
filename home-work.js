/* home-work.js – "Recent mixes" gallery (index.html only).
   Lays out the track cards that home.js renders into #tracks (players and their logic stay in home.js).
   Each card is rotated in 3D and turns flat/sharp as it scrolls to ~60% of the viewport, tied to scroll progress (reversible).
   Only transform/opacity/filter are written (cards carry data-hs, so motion.js/reveal.js leave them alone).
   Reduced motion: no rotation. fx arrival: cards already in the first viewport start in their final state. */
(function () {
  'use strict';
  try {
    var doc = document, win = window, root = doc.documentElement;
    var work = doc.getElementById('work'), host = doc.getElementById('tracks');
    if (!work || !host) return;
    var reduce = false;
    try { reduce = !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    var mqM = win.matchMedia ? matchMedia('(max-width: 720px)') : { matches: false };
    var T0 = win.performance ? performance.now() : 0, arrived = root.classList.contains('fx-arrived');
    var cards = [], st = [], raf = 0, vh = win.innerHeight || 800, sig = '';
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var smooth = function (t) { return t * t * (3 - 2 * t); };
    var docTop = function (el) { var t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; };

    function getCards() {
      return [].slice.call(host.children).filter(function (el) { return el.classList && el.classList.contains('track') && !el.classList.contains('sk-card'); });
    }
    function clear(c) { c.style.transform = ''; c.style.opacity = ''; c.style.filter = ''; c.classList.remove('wg-live'); }

    /* ---------- Geometry (untransformed layout; offsetTop includes the column stagger) ---------- */
    function measure() {
      vh = win.innerHeight || 800;
      var two = !mqM.matches && cards.length > 1;
      cards.forEach(function (c, i) {
        var s = st[i]; if (!s) return;
        s.mid = docTop(c) + c.offsetHeight / 2;
        s.col = two ? i % 2 : 0; s.row = two ? Math.floor(i / 2) : i;
        // direction alternates per column (and per row for the tilt on X) for rhythm
        s.dir = two ? (s.col ? 1 : -1) : (i % 2 ? 1 : -1);
        s.xs = (s.row % 2) ? -1 : 1;
      });
    }
    function setup() {
      var next = getCards();
      sig = next.map(function (c) { return c.dataset.id || ''; }).join(',') + '|' + next.length;
      cards.forEach(clear);
      cards = next;
      st = cards.map(function () { return { p: 0, tgt: 0, locked: false, key: '', mid: 0, col: 0, row: 0, dir: -1, xs: 1, init: false }; });
      work.classList.toggle('wg-one', cards.length === 1);
      measure();
      render(true);
    }

    /* ---------- Rendering ---------- */
    var lastT = 0;
    function render(force) {
      raf = 0;
      var nowT = win.performance ? performance.now() : 0, dt = lastT && nowT - lastT < 120 ? Math.max(0.004, (nowT - lastT) / 1000) : 0.016; lastT = nowT;
      if (!cards.length) return;
      var y = win.pageYOffset || 0, more = false, i, s, c, tv, e, k, dir, small = mqM.matches, key;
      var fresh = arrived && (win.performance ? performance.now() - T0 : 0) < 3000;
      for (i = 0; i < cards.length; i++) {
        s = st[i]; c = cards[i];
        if (reduce) { if (s.key !== 'r') { s.key = 'r'; clear(c); } continue; }
        tv = s.mid - y;                                       // card centre relative to the viewport (untransformed)
        // 0 when the centre is just below the viewport, 1 when it reaches ~60% of the viewport height (from the top)
        s.tgt = clamp((vh * 1.04 - tv) / (vh * 1.04 - vh * 0.6), 0, 1);
        if (!s.init) {
          s.init = true;
          if (fresh && tv - c.offsetHeight / 2 < vh && tv + c.offsetHeight / 2 > 0) { s.locked = true; }   // arrived: first viewport is final
        }
        if (s.locked) { if (tv - c.offsetHeight / 2 > vh) s.locked = false; else s.tgt = 1; }
        if (force || Math.abs(tv) > vh * 2.2) s.p = s.tgt;      // far away or first paint: no easing
        else { s.p += (s.tgt - s.p) * (1 - Math.exp(-dt * 14)); if (Math.abs(s.tgt - s.p) < 0.001) s.p = s.tgt; }
        if (s.p !== s.tgt) more = true;
        e = smooth(s.p); k = 1 - e;
        if (k < 0.003) { if (s.key !== 'f') { s.key = 'f'; clear(c); } continue; }
        dir = s.dir;
        key = k.toFixed(3);
        if (key === s.key && !force) continue;
        s.key = key;
        c.classList.add('wg-live');
        c.style.transform = 'perspective(1200px) translate3d(0,' + (k * 44).toFixed(1) + 'px,' + (-120 * k).toFixed(1) + 'px) rotateY(' + (dir * (small ? 24 : 35) * k).toFixed(2) + 'deg) rotateX(' + (s.xs * 12 * k).toFixed(2) + 'deg)';
        c.style.opacity = (0.2 + 0.8 * e).toFixed(3);
        c.style.filter = k > 0.04 ? 'blur(' + (3 * k).toFixed(2) + 'px)' : '';
      }
      if (more) raf = requestAnimationFrame(function () { render(false); }); else lastT = 0;
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(function () { render(false); }); }

    /* ---------- Wiring ---------- */
    win.addEventListener('scroll', schedule, { passive: true });
    var rq = 0;
    function remeasure() { if (rq) return; rq = requestAnimationFrame(function () { rq = 0; measure(); st.forEach(function (s) { s.key = ''; }); render(true); }); }
    win.addEventListener('resize', remeasure, { passive: true });
    win.addEventListener('load', remeasure);
    try { if (win.ResizeObserver) new ResizeObserver(remeasure).observe(doc.querySelector('main') || doc.body); } catch (e) {}
    var onMq = function () { sig = ''; apply(); };
    if (mqM.addEventListener) mqM.addEventListener('change', onMq); else if (mqM.addListener) mqM.addListener(onMq);

    function apply() {
      var next = getCards(), s = next.map(function (c) { return c.dataset.id || ''; }).join(',') + '|' + next.length;
      var same = next.length === cards.length && next.every(function (c, i) { return c === cards[i]; });
      if (s === sig && same) return;
      setup();
    }
    // synchronous in the observer callback (a microtask before paint): cards never flash flat before their first transform
    try { new MutationObserver(apply).observe(host, { childList: true }); } catch (e) {}
    apply();
  } catch (err) { /* the page must never break because of an animation */ }
})();

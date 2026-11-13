/* thread.js – "the red thread": one thin, glowing, gently vibrating purple line that runs down the left gutter of every page,
   weaves in soft S-curves, draws itself with the scroll (stroke-dashoffset), ends in a glowing tip and makes a node at each section eyebrow.
   Home: starts at the left end of the hero wave line and ends at the footer wordmark. Tinted by body[data-area] via CSS (thread.css).
   One SVG, one path (+ one wider low-opacity duplicate as glow, + one faint ghost route). Reduced motion: fully drawn, static.
   Never throws into the page. */
(function () {
  'use strict';
  try {
    var doc = document, win = window, body = doc.body;
    if (!body || doc.querySelector('.thread')) return;
    var NS = 'http://www.w3.org/2000/svg';
    var reduce = false;
    try { reduce = !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    var mqM = win.matchMedia ? matchMedia('(max-width: 720px)') : { matches: false };

    var host = doc.createElement('div'); host.className = 'thread'; host.setAttribute('aria-hidden', 'true'); host.hidden = true;
    var svg = doc.createElementNS(NS, 'svg');
    function mk(tag, cls, par) { var n = doc.createElementNS(NS, tag); if (cls) n.setAttribute('class', cls); (par || svg).appendChild(n); return n; }
    var ghost = mk('path', 'th-ghost');
    var glow = mk('path', 'th-glow'), line = mk('path', 'th-line');
    glow.setAttribute('pathLength', '1000'); line.setAttribute('pathLength', '1000');
    glow.style.strokeDasharray = line.style.strokeDasharray = '1000 1000';
    var nodesG = mk('g', 'th-nodes');
    var halo = mk('circle', 'th-halo'); halo.setAttribute('r', '7');
    var tip = mk('circle', 'th-tip'); tip.setAttribute('r', '2.6');
    host.appendChild(svg); body.appendChild(host);

    var xs = [], ys = [], cum = [], total = 1, nodes = [], vibOn = !reduce;
    var W = 0, H = 0, gx = 12, amp = 2, startY = 0, endY = 0, ok = false, frac = 0, dirty = true, lastBuild = 0, raf = 0, T = 0;
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var smooth = function (u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    var sy = function () { return win.pageYOffset || 0; };

    function build() {
      var vw = doc.documentElement.clientWidth || win.innerWidth, vh = win.innerHeight;
      var small = mqM.matches;
      W = vw; H = Math.max(body.scrollHeight, doc.documentElement.scrollHeight, body.offsetHeight);
      var main = doc.querySelector('main') || doc.querySelector('.wrap');
      if (!main) { ok = false; return; }
      var scrollY = sy(), mr = main.getBoundingClientRect(), wl = Math.round(mr.left);
      var r = small ? 4.5 : 6.5;
      gx = small ? 12 : Math.max(24 > wl - 12 ? wl * 0.5 : 24, wl - 40);
      if (!small) gx = Math.max(wl - 40, wl * 0.5);
      amp = clamp(Math.min(16, wl - gx - r - 4, gx - r - 3), 2, 16);
      var period = small ? 420 : 560;

      // nodes at eyebrows (and legal h1), only visible ones that sit in the left column
      var els = [].slice.call(doc.querySelectorAll('main .eyebrow, main .legal h1, .next-step .eyebrow')), list = [], i, e, rc, cy, last = -999;
      for (i = 0; i < els.length; i++) {
        e = els[i];
        if (e.closest('[hidden],.hidden,[role=dialog],.modal,.qv,.mc-score,[data-thread=off]')) continue;
        rc = e.getBoundingClientRect();
        if (rc.width < 4 || rc.height < 4 || rc.left > wl + 90) continue;
        cy = rc.top + scrollY + Math.min(rc.height, 24) / 2;
        list.push(cy);
      }
      list.sort(function (a, b) { return a - b; });
      var picked = [];
      for (i = 0; i < list.length; i++) if (list[i] - last > 110) { picked.push(list[i]); last = list[i]; }

      // start / end
      var wave = doc.querySelector('.hx-wave'), startX = null;
      if (wave) {
        var wr = wave.getBoundingClientRect();
        startY = wr.top + scrollY + wr.height / 2; startX = Math.round(wr.left);
      } else startY = Math.max(96, (picked.length ? picked[0] : 140) - 70);
      var fw = doc.querySelector('.fw-wrap') || doc.querySelector('.site-footer'), fr = fw ? fw.getBoundingClientRect() : null;
      endY = fr ? fr.top + scrollY + (fw.classList.contains('fw-wrap') ? Math.max(fr.height, 40) * 0.5 : 36) : H - 60;
      endY = Math.min(endY, H - 8);
      var endX = Math.max(small ? 14 : 10, wl - (small ? 2 : 6));
      ok = endY - startY > 420 && H > vh * 1.3;
      if (!ok) { host.hidden = true; return; }
      host.hidden = false;
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

      // sample the route (monotone in y)
      xs = []; ys = []; cum = [];
      var step = 14, y, u, x, w, sb, eb, c = 0;
      for (y = startY; ; y += step) {
        if (y > endY) y = endY;
        u = (y - startY) / period * Math.PI * 2;
        w = gx + amp * (Math.sin(u) * 0.8 + Math.sin(u * 0.43 + 1.3) * 0.35) / 1.15;
        if (startX !== null) { sb = smooth((y - startY) / 120); w = startX + (w - startX) * sb; }
        eb = smooth((endY - y) / 200); w = endX + (w - endX) * eb;
        if (xs.length) c += Math.hypot(w - xs[xs.length - 1], y - ys[ys.length - 1]);
        xs.push(w); ys.push(y); cum.push(c);
        if (y >= endY) break;
      }
      total = Math.max(1, c);

      // nodes
      while (nodesG.firstChild) nodesG.removeChild(nodesG.firstChild);
      nodes = [];
      for (i = 0; i < picked.length; i++) {
        y = picked[i]; if (y < startY + 20 || y > endY - 20) continue;
        x = xAt(y);
        var g = mk('g', 'th-node', nodesG);
        var tick = mk('line', 'th-tick', g), ring = mk('circle', 'th-ring', g), dot = mk('circle', 'th-dot', g);
        ring.setAttribute('cx', x.toFixed(1)); ring.setAttribute('cy', y.toFixed(1)); ring.setAttribute('r', r);
        dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1)); dot.setAttribute('r', small ? 1.6 : 2.2);
        if (wl - 6 - (x + r) > 8) {
          tick.setAttribute('x1', (x + r + 2).toFixed(1)); tick.setAttribute('x2', (wl - 6).toFixed(1));
          tick.setAttribute('y1', y.toFixed(1)); tick.setAttribute('y2', y.toFixed(1));
        }
        nodes.push({ y: y, g: g, on: false });
      }
      ghost.setAttribute('d', pathD(0));
      dirty = true; lastBuild = 0;
    }

    function xAt(y) {
      var lo = 0, hi = ys.length - 1, m;
      if (y <= ys[0]) return xs[0]; if (y >= ys[hi]) return xs[hi];
      while (hi - lo > 1) { m = (lo + hi) >> 1; if (ys[m] > y) hi = m; else lo = m; }
      var k = (y - ys[lo]) / (ys[hi] - ys[lo] || 1); return xs[lo] + (xs[hi] - xs[lo]) * k;
    }
    function lenAt(y) {
      var lo = 0, hi = ys.length - 1, m;
      if (y <= ys[0]) return 0; if (y >= ys[hi]) return total;
      while (hi - lo > 1) { m = (lo + hi) >> 1; if (ys[m] > y) hi = m; else lo = m; }
      var k = (y - ys[lo]) / (ys[hi] - ys[lo] || 1); return cum[lo] + (cum[hi] - cum[lo]) * k;
    }
    function vib(i, t) {
      var env = Math.sin(Math.PI * (i / (ys.length - 1))) ; // calm at both ends
      return (Math.sin(ys[i] * 0.045 + t * 1.5) * 0.9 + Math.sin(ys[i] * 0.11 - t * 2.3) * 0.4) * (mqM.matches ? 0.5 : 0.9) * env;
    }
    function pathD(t) {
      var d = '', i, n = xs.length, v;
      for (i = 0; i < n; i++) { v = t ? vib(i, t) : 0; d += (i ? 'L' : 'M') + (xs[i] + v).toFixed(1) + ' ' + ys[i].toFixed(1); }
      return d;
    }

    function update(now) {
      if (!ok) return;
      var vh = win.innerHeight, scrollY = sy(), maxS = Math.max(1, H - vh);
      var tipY = scrollY + vh * 0.6 + clamp(scrollY / maxS, 0, 1) * vh * 0.4;
      if (reduce) tipY = 1e9;
      frac = clamp(lenAt(tipY) / total, 0, 1);
      var off = (1000 * (1 - frac)).toFixed(1);
      line.style.strokeDashoffset = off; glow.style.strokeDashoffset = off;
      var show = frac > 0.002 && !(reduce);
      var ty = clamp(tipY, startY, endY);
      if (show && frac < 0.999) {
        var tx = xAt(ty);
        tip.setAttribute('cx', tx.toFixed(1)); tip.setAttribute('cy', ty.toFixed(1));
        halo.setAttribute('cx', tx.toFixed(1)); halo.setAttribute('cy', ty.toFixed(1));
        tip.style.display = halo.style.display = '';
      } else tip.style.display = halo.style.display = 'none';
      line.style.opacity = glow.style.opacity = frac > 0.002 ? '' : '0';
      for (var i = 0; i < nodes.length; i++) {
        var on = tipY >= nodes[i].y;
        if (on !== nodes[i].on) { nodes[i].on = on; nodes[i].g.setAttribute('class', on ? 'th-node on' : 'th-node'); }
      }
      if (vibOn && (!lastBuild || now - lastBuild > 33)) {
        lastBuild = now; var d = pathD(now / 1000); line.setAttribute('d', d); glow.setAttribute('d', d);
      }
    }
    function frame(now) {
      raf = 0;
      if (doc.hidden) return;
      update(now);
      if (vibOn) raf = requestAnimationFrame(frame);
      else dirty = false;
    }
    function kick() { if (!raf && !doc.hidden) raf = requestAnimationFrame(frame); }

    var bq = 0;
    function rebuild() { if (bq) clearTimeout(bq); bq = setTimeout(function () { bq = 0; build(); if (reduce || ok) { var d = pathD(0); line.setAttribute('d', d); glow.setAttribute('d', d); } kick(); if (!vibOn) update(0); }, 120); }

    win.addEventListener('scroll', function () { if (!vibOn) { if (!raf) raf = requestAnimationFrame(frame); } else kick(); }, { passive: true });
    win.addEventListener('resize', rebuild, { passive: true });
    win.addEventListener('load', function () { rebuild(); setTimeout(rebuild, 1200); setTimeout(rebuild, 3500); });
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) kick(); });
    try { if (win.ResizeObserver) new ResizeObserver(rebuild).observe(body); } catch (e) {}
    try {
      var mn = doc.querySelector('main');
      if (mn && win.MutationObserver) new MutationObserver(rebuild).observe(mn, { childList: true, subtree: true });
    } catch (e) {}
    try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(rebuild); } catch (e) {}

    build();
    if (ok) { var d0 = pathD(0); line.setAttribute('d', d0); glow.setAttribute('d', d0); }
    if (reduce) update(0); else kick();
  } catch (err) { /* the page must never break because of an animation */ }
})();

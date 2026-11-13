/* thread.js – "the red thread": one thin, glowing purple line that runs down the left gutter of every page,
   weaves in soft S-curves, draws itself with the scroll (stroke-dashoffset), ends in a glowing tip and makes a node at each section eyebrow.
   Home: starts at the left end of the hero wave line and ends at the footer wordmark. Tinted by body[data-area] via CSS (thread.css).
   Home: the line leaves the hero wave (one big cubic arc, hero.js hands the wave's left end over at x = window.__hxCut) and the segment down to the FIRST node keeps moving like the wave
   (damped to exactly still at node 1, only that segment is rewritten per frame, loop runs only while it is on screen); everything after is static.
   One SVG, two path pairs (A animated, B static) + glow duplicates; NO preview/ghost route (the thread only exists where it has been drawn). Reduced motion: fully drawn, static, connected.
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
    /* two path pairs share ONE group opacity each (no doubled alpha where they meet): A = hero→first node (animated, home only), B = rest (static) */
    var glowG = mk('g', 'th-glows'), lineG = mk('g', 'th-lines');
    var glowA = mk('path', 'th-glow', glowG), glowB = mk('path', 'th-glow', glowG);
    var lineA = mk('path', 'th-line', lineG), lineB = mk('path', 'th-line', lineG);
    glowA.style.strokeLinecap = lineA.style.strokeLinecap = 'butt';   /* A abuts the hero wave exactly at the junction: no overlapping round caps (double alpha) */
    [glowA, glowB, lineA, lineB].forEach(function (p) { p.setAttribute('pathLength', '1000'); p.style.strokeDasharray = '1000 1000'; });
    var nodesG = mk('g', 'th-nodes');
    var halo = mk('circle', 'th-halo'); halo.setAttribute('r', '7');
    var tip = mk('circle', 'th-tip'); tip.setAttribute('r', '2.6');
    host.appendChild(svg); body.appendChild(host);

    var xs = [], ys = [], cum = [], total = 1, nodes = [];
    var W = 0, H = 0, gx = 12, amp = 2, startY = 0, endY = 0, ok = false, frac = 0, raf = 0, wlG = 40;
    /* segment A (generated per frame): static points, arclength, unit normals, current (animated) points */
    var seg = null, LA = 0, arcLen = 0, arcEy = 0, aMax = 8, tA = 0, spA = 0.45, lastFr = 0, velA = 0, lastSY = 0, pOn = false, pAct = 0, mx = -1e4, my = -1e4, lastD = '';
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
      wlG = wl;
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
        startY = wr.top + scrollY + wr.height / 2; startX = wr.left;
      } else startY = Math.max(96, (picked.length ? picked[0] : 140) - 70);
      var fw = doc.querySelector('.fw-wrap') || doc.querySelector('.site-footer'), fr = fw ? fw.getBoundingClientRect() : null;
      endY = fr ? fr.top + scrollY + (fw.classList.contains('fw-wrap') ? Math.max(fr.height, 40) * 0.5 : 36) : H - 60;
      endY = Math.min(endY, H - 8);
      var endX = Math.max(small ? 14 : 10, wl - (small ? 2 : 6));
      ok = endY - startY > 420 && H > vh * 1.3;
      if (!ok) { host.hidden = true; return; }
      host.hidden = false;
      svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

      // sample the route (monotone in y). With the hero wave: a fillet leaves the wave's left end heading left, turns down into the gutter.
      xs = []; ys = []; cum = [];
      var step = 14, y, u, x, w, eb, c = 0, y0 = startY, x0 = startX, arcEy = 0;
      function push(px, py) { if (xs.length) c += Math.hypot(px - xs[xs.length - 1], py - ys[ys.length - 1]); xs.push(px); ys.push(py); cum.push(c); }
      arcLen = 0;
      if (startX !== null) {
        /* ONE cubic Bezier from the wave (heading left, flat) into the gutter (heading down): generous radius, starts early along the wave.
           hero.js draws the wave from x = cut rightwards, so wave and arc share exactly one point + tangent. */
        var vw2 = vw, Rt = small ? clamp(vw2 * 0.17, 56, 90) : clamp(vw2 * 0.15, 120, 190);
        var ex = Math.min(Rt * 1.05, Math.max(30, W * 0.4)), ey = Rt, ax0 = gx + ex, h1 = ex * 0.78, h2, ok2 = false, k, tt, bx, by, mu = doc.querySelector('.hero .muted');
        var limY = mu ? mu.getBoundingClientRect().top + scrollY - 10 : 1e9;
        /* keep the bend clear of the subline: where the gutter is narrow (<= ~1100px) the drop is limited to what fits above it,
           the curve then stays a long, gentle sweep (rx >> ry); with room (wide screens) it is the full round arc */
        for (; ; ey = Math.max(44, ey * 0.88)) {
          for (h2 = ey * 0.55; h2 >= ey * 0.2; h2 -= ey * 0.05) {
            ok2 = true;
            for (k = 1; k <= 28; k++) {
              tt = k / 28; var mt = 1 - tt;
              bx = mt * mt * mt * ax0 + 3 * mt * mt * tt * (ax0 - h1) + 3 * mt * tt * tt * gx + tt * tt * tt * gx;
              by = mt * mt * mt * startY + 3 * mt * mt * tt * startY + 3 * mt * tt * tt * (startY + ey - h2) + tt * tt * tt * (startY + ey);
              if (bx > wl + 3 && by > limY) { ok2 = false; break; }
            }
            if (ok2) break;
          }
          if (ok2 || ey <= 44) break;
        }
        if (!ok2) h2 = ey * 0.2;
        for (k = 0; k <= 28; k++) {
          tt = k / 28; var mt2 = 1 - tt;
          push(mt2 * mt2 * mt2 * ax0 + 3 * mt2 * mt2 * tt * (ax0 - h1) + 3 * mt2 * tt * tt * gx + tt * tt * tt * gx,
               mt2 * mt2 * mt2 * startY + 3 * mt2 * mt2 * tt * startY + 3 * mt2 * tt * tt * (startY + ey - h2) + tt * tt * tt * (startY + ey));
        }
        arcLen = c; y0 = startY + ey; x0 = gx; arcEy = ey;
        var cutNow = ax0 - startX;
        if (Math.abs((win.__hxCut || 0) - cutNow) > 0.4) { win.__hxCut = cutNow; try { win.dispatchEvent(new Event('hx-cut')); } catch (e2) {} }
      }
      for (y = (xs.length ? y0 + step : startY); ; y += step) {
        if (y > endY) y = endY;
        u = (y - startY) / period * Math.PI * 2;
        w = gx + amp * (Math.sin(u) * 0.8 + Math.sin(u * 0.43 + 1.3) * 0.35) / 1.15;
        if (startX !== null) w = x0 + (w - x0) * smooth((y - y0) / 140);
        eb = smooth((endY - y) / 200); w = endX + (w - endX) * eb;
        push(w, y);
        if (y >= endY) break;
      }
      total = Math.max(1, c);

      // nodes
      while (nodesG.firstChild) nodesG.removeChild(nodesG.firstChild);
      nodes = [];
      for (i = 0; i < picked.length; i++) {
        y = picked[i]; if (y < startY + arcEy + 24 || y > endY - 20) continue;
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

      // split: A = start .. first node (animated, damped to rest at the node), B = first node .. end (static)
      seg = null; LA = 0;
      if (startX !== null && nodes.length) {
        var y1 = nodes[0].y, x1 = xAt(y1), n = 0;
        while (n < ys.length && ys[n] < y1 - 0.5) n++;
        var px = xs.slice(0, n), py = ys.slice(0, n); px.push(x1); py.push(y1);
        var m = px.length, ps = [0], nx = [], ny = [], tx, ty, d;
        for (i = 1; i < m; i++) ps.push(ps[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]));
        for (i = 0; i < m; i++) {
          tx = px[Math.min(m - 1, i + 1)] - px[Math.max(0, i - 1)]; ty = py[Math.min(m - 1, i + 1)] - py[Math.max(0, i - 1)];
          d = Math.hypot(tx, ty) || 1; nx.push(ty / d); ny.push(-tx / d);
        }
        if (m >= 3 && ps[m - 1] > 30) {
          LA = ps[m - 1];
          seg = { px: px, py: py, s: ps, nx: nx, ny: ny, cx: px.slice(), cy: py.slice(), n: m };
          aMax = clamp(Math.min(gx - 5, wl - gx - r - 6), 2, small ? 3.5 : 9);
          var dB = 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1);
          for (i = n; i < xs.length; i++) dB += 'L' + xs[i].toFixed(1) + ' ' + ys[i].toFixed(1);
          glowB.setAttribute('d', dB); lineB.setAttribute('d', dB);
          drawA(0, 0);
        }
      }
      if (!seg) {
        var dW = pathD(); glowB.setAttribute('d', dW); lineB.setAttribute('d', dW);
        glowA.setAttribute('d', ''); lineA.setAttribute('d', '');
      }
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
    function pathD() {
      var d = '', i, n = xs.length;
      for (i = 0; i < n; i++) d += (i ? 'L' : 'M') + xs[i].toFixed(1) + ' ' + ys[i].toFixed(1);
      return d;
    }
    /* Segment A: same wave language as the hero wave (sum of three sines, speed follows scroll velocity, pointer swells it),
       displaced along the path normal, amplitude A * (1 - smoothstep(0, L1, s)) -> exactly still at the first node.
       A short ramp-in (first ~50px) keeps it glued to the wave's end (the wave itself has zero amplitude there). */
    function drawA(t, act) {
      if (!seg) return;
      var n = seg.n, i, s, env, k, a, dx, xx, yy, near, d = '';
      var vAmp = clamp(Math.abs(velA) / 28, 0, 1), sc = sy();
      var maxX = wlG - 4;
      for (i = 0; i < n; i++) {
        s = seg.s[i];
        env = (1 - smooth(s / LA)) * smooth((s - arcLen * 0.7) / (arcLen * 0.5 + 60));   /* arc itself stays put, motion fades in below it */
        xx = seg.px[i]; yy = seg.py[i];
        if (env > 0 && act > 0) {
          near = pAct > 0.01 ? pAct * Math.exp(-Math.pow((xx - mx) / 200, 2)) * Math.exp(-Math.pow((yy - (my + sc)) / 200, 2)) : 0;
          k = Math.sin(s * 0.012 + t) * 0.55 + Math.sin(s * 0.028 - t * 1.7) * 0.3 + Math.sin(s * 0.06 + t * 2.6) * 0.15 * (0.4 + 0.6 * Math.abs(Math.sin(s * 0.006 + t * 0.7)));
          a = aMax * (0.7 + 0.3 * clamp(vAmp * 0.6 + near * 0.5, 0, 1)) * env * act;
          dx = a * k;
          xx += seg.nx[i] * dx; yy += seg.ny[i] * dx;
          if (s > arcLen) xx = clamp(xx, 3, maxX);
        }
        seg.cx[i] = xx; seg.cy[i] = yy;
        d += (i ? 'L' : 'M') + xx.toFixed(1) + ' ' + yy.toFixed(1);
      }
      if (d !== lastD) { lastD = d; lineA.setAttribute('d', d); glowA.setAttribute('d', d); }
    }
    function segVisible() {
      if (!seg || reduce) return false;
      var sc = sy(), vh = win.innerHeight;
      return sc + vh > startY - 60 && sc < seg.py[seg.n - 1] + 60;
    }
    function tipAt(ty) {
      if (seg && ty < seg.py[seg.n - 1]) {
        var lo = 0, hi = seg.n - 1, m;
        if (ty <= seg.py[0]) return [seg.cx[0], seg.cy[0]];
        while (hi - lo > 1) { m = (lo + hi) >> 1; if (seg.py[m] > ty) hi = m; else lo = m; }
        var k = (ty - seg.py[lo]) / (seg.py[hi] - seg.py[lo] || 1);
        return [seg.cx[lo] + (seg.cx[hi] - seg.cx[lo]) * k, seg.cy[lo] + (seg.cy[hi] - seg.cy[lo]) * k];
      }
      return [xAt(ty), ty];
    }
    function setDash(p, f) { p.style.strokeDashoffset = (1000 * (1 - clamp(f, 0, 1))).toFixed(1); }

    function update(now) {
      if (!ok) return;
      var vh = win.innerHeight, scrollY = sy(), maxS = Math.max(1, H - vh);
      var tipY = scrollY + vh * 0.6 + clamp(scrollY / maxS, 0, 1) * vh * 0.4;
      if (reduce) tipY = 1e9;
      var len = lenAt(tipY);
      frac = clamp(len / total, 0, 1);
      if (seg) {
        var fA = clamp(len / LA, 0, 1), fB = clamp((len - LA) / Math.max(1, total - LA), 0, 1);
        setDash(lineA, fA); setDash(glowA, fA); setDash(lineB, fB); setDash(glowB, fB);
      } else { setDash(lineB, frac); setDash(glowB, frac); }
      var show = frac > 0.002 && !(reduce);
      var ty = clamp(tipY, startY, endY);
      if (show && frac < 0.999) {
        var tp = tipAt(ty), tx = tp[0], tyy = tp[1];
        tip.setAttribute('cx', tx.toFixed(1)); tip.setAttribute('cy', tyy.toFixed(1));
        halo.setAttribute('cx', tx.toFixed(1)); halo.setAttribute('cy', tyy.toFixed(1));
        tip.style.display = halo.style.display = '';
      } else tip.style.display = halo.style.display = 'none';
      lineG.style.opacity = glowG.style.opacity = frac > 0.002 ? '' : '0';
      for (var i = 0; i < nodes.length; i++) {
        var on = tipY >= nodes[i].y;
        if (on !== nodes[i].on) { nodes[i].on = on; nodes[i].g.setAttribute('class', on ? 'th-node on' : 'th-node'); }
      }
    }
    function frame(now) {
      raf = 0;
      if (doc.hidden) { lastFr = 0; return; }
      var sc = sy(), vis = segVisible();
      var dt = lastFr ? Math.min(0.05, (now - lastFr) / 1000) : 0.016; lastFr = now;
      if (vis) {
        spA += ((0.45 + Math.min(1.2, Math.abs(velA) * 0.03)) - spA) * (1 - Math.exp(-dt * 1.5)); tA += dt * spA;
        velA += ((sc - lastSY) / Math.max(dt, 0.008) / 60 - velA) * 0.06;
        pAct += ((pOn ? 1 : 0) - pAct) * (1 - Math.exp(-dt * 2));
        drawA(tA, 1);
      }
      lastSY = sc;
      update(now);
      if (vis) raf = requestAnimationFrame(frame); else lastFr = 0;
    }
    function kick() { if (!raf && !doc.hidden) { lastSY = sy(); raf = requestAnimationFrame(frame); } }

    var bq = 0;
    function rebuild() { if (bq) clearTimeout(bq); bq = setTimeout(function () { bq = 0; build(); lastD = ''; if (ok) { if (seg) drawA(tA, reduce ? 0 : 1); update(0); kick(); } }, 120); }

    win.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    win.addEventListener('resize', rebuild, { passive: true });
    win.addEventListener('load', function () { rebuild(); setTimeout(rebuild, 1200); setTimeout(rebuild, 3500); });
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) kick(); });
    try { if (win.ResizeObserver) new ResizeObserver(rebuild).observe(body); } catch (e) {}
    try {
      var mn = doc.querySelector('main');
      if (mn && win.MutationObserver) new MutationObserver(rebuild).observe(mn, { childList: true, subtree: true });
    } catch (e) {}
    try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(rebuild); } catch (e) {}
    try {
      if (!reduce && win.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches) {
        doc.addEventListener('pointermove', function (e) { if (e.pointerType && e.pointerType !== 'mouse') return; mx = e.clientX; my = e.clientY; pOn = true; if (seg) kick(); }, { passive: true });
        doc.addEventListener('mouseleave', function () { pOn = false; });
        win.addEventListener('blur', function () { pOn = false; });
      }
    } catch (e) {}

    build();
    if (ok) { lastD = ''; if (seg) drawA(0, 0); update(0); }
    kick();
  } catch (err) { /* the page must never break because of an animation */ }
})();

/* hero.js – interactive hero (index.html). Writes only CSS variables on #hero plus the wave path.
   Scroll-linked headline (parallax per word, tracking, gradient shift), pointer spotlight + slight tilt (desktop),
   one continuous sound-wave line reacting to scroll velocity and pointer proximity, smooth-scroll link.
   The loop runs only while the hero is on screen. Reduced motion: static. Never throws into the page. */
(function () {
  'use strict';
  try {
    var doc = document, win = window, hero = doc.getElementById('hero');
    if (!hero) return;
    var reduce = false, fine = false;
    try { reduce = !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    try { fine = !!(win.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches); } catch (e) {}
    var mqM = win.matchMedia ? matchMedia('(max-width: 720px)') : { matches: false };
    var words = [].slice.call(hero.querySelectorAll('.hw')), svg = hero.querySelector('.hx-wave'), path = svg && svg.querySelector('path');
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var smooth = function (u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
    var visible = true, raf = 0, last = 0, t = 0;
    var y = 0, vel = 0, lastY = win.pageYOffset || 0;
    var px = 0, py = 0, cx = 0, cy = 0, pOn = false, pAct = 0, mx = -1e4, my = -1e4;   // pointer: normalised, smoothed, active level, client px
    var rx = 0, ry = 0, spot = 0, ph = 0, spd = 0.45;   // ph = integrated wave phase (no jumps when the speed changes), spd = smoothed phase speed (calm: ~half of before)
    var W = 1000, H = 200, hh = 600, N = 80, keyV = '', sL = 0, sTopDoc = 0, glow = null;
    if (path) { glow = path.cloneNode(false); glow.setAttribute('class', 'hx-glow'); glow.removeAttribute('d'); path.parentNode.insertBefore(glow, path); }

    function measure() {
      var r = hero.getBoundingClientRect();
      hh = Math.max(300, hero.offsetHeight);
      if (svg) { var sr = svg.getBoundingClientRect(); W = Math.max(200, Math.round(sr.width)); H = Math.max(60, Math.round(sr.height)); N = clamp(Math.round(W / 9), 40, 140); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); sL = sr.left; sTopDoc = sr.top + (win.pageYOffset || 0); }
    }

    /* ---- wave path ---- */
    function drawWave(now, amp) {
      if (!path) return;
      var d = '', i, x, u, env, a, yy, near = 0, k, t = ph, cut = Math.max(0, win.__hxCut || 0), rp;
      /* the wave starts at x = cut (thread.js sets it): left of it the thread's own arc takes over, ONE continuous line.
         Amplitude ramps up from exactly 0 at the cut, so the wave leaves it flat and tangent to the thread's arc. */
      var pxl = mx - sL, pyl = my - (sTopDoc - (win.pageYOffset || 0));   // cached layout (measure()), no per-frame layout read
      var base = H * (mqM.matches ? 0.055 : 0.066), sp = 1;
      for (i = 0; i <= N; i++) {
        u = i / N; x = cut + u * (W - cut);
        rp = cut > 0 ? smooth((x - cut) / 170) : 1;
        u = x / W;
        env = Math.pow(Math.sin(Math.PI * u), 0.6);
        near = pAct > 0.01 ? pAct * Math.exp(-Math.pow((x - pxl) / (W * 0.16), 2)) * Math.exp(-Math.pow((H / 2 - pyl) / (H * 1.6), 2)) : 0;
        a = (base + amp * H * 0.1 + near * H * 0.15) * env * rp;
        k = Math.sin(u * 9 + t * sp) * 0.55 + Math.sin(u * 23 - t * sp * 1.7) * 0.3 + Math.sin(u * 51 + t * sp * 2.6) * 0.15 * (0.4 + 0.6 * Math.abs(Math.sin(u * 5 + t * 0.7)));
        yy = H / 2 + (rp > 0 ? a * k : 0);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1);
      }
      path.setAttribute('d', d); if (glow) glow.setAttribute('d', d);
    }

    /* ---- frame ---- */
    function frame(now) {
      raf = 0;
      if (!visible || doc.hidden) { last = 0; return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
      var sy = win.pageYOffset || 0, dy = sy - lastY; lastY = sy;
      vel += (dy / Math.max(dt, 0.008) / 60 - vel) * 0.06;                  // px per 60fps-frame, smoothed
      var hp = clamp(sy / (hh * 0.95), 0, 1), small = mqM.matches;
      var amp = reduce ? 0 : (small ? 0.4 : 1);
      var vAmp = clamp(Math.abs(vel) / 28, 0, 1);
      spd += ((0.45 + Math.min(1.2, Math.abs(vel) * 0.03)) - spd) * (1 - Math.exp(-dt * 1.5)); ph += dt * spd;

      // pointer smoothing + tilt (desktop, fine pointer only)
      var tgtA = pOn ? 1 : 0; pAct += (tgtA - pAct) * 0.04;
      cx += (px - cx) * 0.09; cy += (py - cy) * 0.09;
      var tilt = fine && !small && !reduce;
      if (tilt) { rx = -cy * 3 * pAct; ry = cx * 3 * pAct; }

      var key = hp.toFixed(3) + '|' + rx.toFixed(2) + '|' + ry.toFixed(2);
      if (key !== keyV) {
        keyV = key;
        var s = hero.style;
        s.setProperty('--hp', hp.toFixed(4));
        s.setProperty('--amp', amp.toFixed(2));
        s.setProperty('--gp', (hp * 140).toFixed(1));
        s.setProperty('--ls', (-0.04 + (small || reduce ? 0 : hp * 0.03)).toFixed(4) + 'em');
        s.setProperty('--sc', (1 + (reduce ? 0 : hp * (small ? 0.025 : 0.06))).toFixed(4));
        if (tilt) { s.setProperty('--rx', rx.toFixed(2) + 'deg'); s.setProperty('--ry', ry.toFixed(2) + 'deg'); }
      }

      // spotlight on the gradient words
      if (tilt && words.length) {
        var on = pAct > 0.02, i, r;
        if (on || spot) {
          for (i = 0; i < words.length; i++) {
            r = words[i].getBoundingClientRect();
            words[i].style.setProperty('--sx', (on ? (mx - r.left).toFixed(0) : -999) + 'px');
            words[i].style.setProperty('--sy', (on ? (my - r.top).toFixed(0) : -999) + 'px');
          }
          spot = on ? 1 : 0;
        }
      }

      drawWave(now, reduce ? 0 : Math.max(vAmp * 0.6, 0.03));
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !doc.hidden) raf = requestAnimationFrame(frame); }

    /* ---- input ---- */
    if (fine && !reduce) {
      doc.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var r = hero.getBoundingClientRect();
        mx = e.clientX; my = e.clientY;
        pOn = e.clientY > r.top - 40 && e.clientY < r.bottom + 40;
        px = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
        py = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
        kick();
      }, { passive: true });
      doc.addEventListener('mouseleave', function () { pOn = false; px = py = 0; kick(); });
      win.addEventListener('blur', function () { pOn = false; px = py = 0; });
    }
    win.addEventListener('scroll', kick, { passive: true });
    var rq = 0;
    function remeasure() { if (rq) return; rq = requestAnimationFrame(function () { rq = 0; measure(); keyV = ''; kick(); if (reduce) { frame(performance.now()); } }); }
    win.addEventListener('resize', remeasure, { passive: true });
    win.addEventListener('load', remeasure);
    try { if (win.ResizeObserver) new ResizeObserver(remeasure).observe(hero); } catch (e) {}
    try { if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(remeasure); } catch (e) {}
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) { last = 0; kick(); } });
    try { new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) { last = 0; kick(); } }, { rootMargin: '80px 0px' }).observe(hero); } catch (e) {}

    /* ---- "Hear the difference" smooth scroll (falls back to Services when the before/after section is not shown) ---- */
    var hear = hero.querySelector('.hx-hear');
    if (hear) hear.addEventListener('click', function (e) {
      var tgt = doc.getElementById('hear');
      if (!tgt || tgt.hidden || !tgt.offsetHeight) tgt = doc.getElementById('services');
      if (!tgt) return;
      e.preventDefault();
      var top = tgt.getBoundingClientRect().top + (win.pageYOffset || 0) - 84;
      win.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
    });

    win.addEventListener('hx-cut', function () { drawWave(0, reduce ? 0 : 0.03); kick(); });
    measure();
    drawWave(0, 0);
    if (reduce) frame(performance.now()); else kick();
  } catch (err) { /* the page must never break because of an animation */ }
})();

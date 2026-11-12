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
    var visible = true, raf = 0, last = 0, t = 0;
    var y = 0, vel = 0, lastY = win.pageYOffset || 0;
    var px = 0, py = 0, cx = 0, cy = 0, pOn = false, pAct = 0, mx = -1e4, my = -1e4;   // pointer: normalised, smoothed, active level, client px
    var rx = 0, ry = 0, spot = 0;
    var W = 1000, H = 200, hh = 600, N = 80, keyV = '';

    function measure() {
      var r = hero.getBoundingClientRect();
      hh = Math.max(300, hero.offsetHeight);
      if (svg) { var sr = svg.getBoundingClientRect(); W = Math.max(200, Math.round(sr.width)); H = Math.max(60, Math.round(sr.height)); N = clamp(Math.round(W / 9), 40, 140); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); }
    }

    /* ---- wave path ---- */
    function drawWave(now, amp) {
      if (!path) return;
      var sr = svg.getBoundingClientRect(), d = '', i, x, u, env, a, yy, near = 0, k;
      var pxl = mx - sr.left, pyl = my - sr.top;
      var base = H * (mqM.matches ? 0.1 : 0.12), sp = 0.9 + Math.min(4, Math.abs(vel) * 0.12);
      for (i = 0; i <= N; i++) {
        u = i / N; x = u * W;
        env = Math.pow(Math.sin(Math.PI * u), 0.6);
        near = pAct > 0.01 ? pAct * Math.exp(-Math.pow((x - pxl) / (W * 0.16), 2)) * Math.exp(-Math.pow((H / 2 - pyl) / (H * 1.6), 2)) : 0;
        a = (base + amp * H * 0.2 + near * H * 0.34) * env;
        k = Math.sin(u * 9 + t * sp) * 0.55 + Math.sin(u * 23 - t * sp * 1.7) * 0.3 + Math.sin(u * 51 + t * sp * 2.6) * 0.15 * (0.4 + 0.6 * Math.abs(Math.sin(u * 5 + t * 0.7)));
        yy = H / 2 + a * k;
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(1);
      }
      path.setAttribute('d', d);
    }

    /* ---- frame ---- */
    function frame(now) {
      raf = 0;
      if (!visible || doc.hidden) { last = 0; return; }
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; t += dt;
      var sy = win.pageYOffset || 0, dy = sy - lastY; lastY = sy;
      vel += (dy / Math.max(dt, 0.008) / 60 - vel) * 0.18;                  // px per 60fps-frame, smoothed
      var hp = clamp(sy / (hh * 0.95), 0, 1), small = mqM.matches;
      var amp = reduce ? 0 : (small ? 0.4 : 1);
      var vAmp = clamp(Math.abs(vel) / 28, 0, 1);

      // pointer smoothing + tilt (desktop, fine pointer only)
      var tgtA = pOn ? 1 : 0; pAct += (tgtA - pAct) * 0.08;
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

      drawWave(now, reduce ? 0 : Math.max(vAmp * 1.3, 0.06));
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

    measure();
    drawWave(0, 0);
    if (reduce) frame(performance.now()); else kick();
  } catch (err) { /* the page must never break because of an animation */ }
})();

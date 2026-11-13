/* home-scroll.js – scrollgesteuerte Animationen der Startseite (nur index.html).
   Ein rAF-gedrosselter Scroll-Handler, IntersectionObserver, nur transform/opacity.
   Bei „Bewegung reduzieren“: keine scrollgesteuerte Bewegung (Diamant hängt ruhig, Rest statisch).
   Blockiert oder kapert das Scrollen nie. */
(function () {
  'use strict';
  try {
    var doc = document, root = doc.documentElement;
    var reduce = false;
    try { reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    var raf = 0, y = 0, lastY = 0, lastT = 0, vel = 0, vh = window.innerHeight || 800, maxScroll = 1;
    var G = {};              // gemessene Dokument-Positionen (ohne Transforms)
    var near = new Map();    // Element -> nah am Viewport
    var io = null, mods = [];
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
    var smooth = function (t) { return t * t * (3 - 2 * t); };
    var $ = function (s, r) { return (r || doc).querySelector(s); };
    var rect0 = function (el) { var t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; };
    function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
    function watch(el) { if (!io || !el) return; near.set(el, false); io.observe(el); }
    var isNear = function (el) { return !!near.get(el); };
    function setLive(el, on) { if (el) el.classList.toggle('hs-live', !!on); }

    /* ================= 1) Hero: Diamant an der Kette =================
       Der Diamant steckte als Bild im Hintergrund (background-1920.jpg). Für die Animation gibt es ihn jetzt als
       ausgeschnittene Sprites (hero-chain.png, hero-gem.png) auf einem Hintergrund ohne Diamant (bg-clean-*.jpg).
       Sprite-Koordinaten = Pixel des 1920x1080-Hintergrunds, verschoben um (1237,0). */
    var hero = $('.hero'), dia = null, pend = null, chainEl = null, gemEl = null, gemBright = null, glowEl = null, spkHost = null;
    var theta = 0, omega = 0, gemVisible = false, lastMoveT = 0, heroKey = '', heroHidden = false;
    var PX = 453, GX = 158, GY = 595, GBOX_Y = 448, GLX = 158, GLY = 147;   // Drehpunkt Kette, Mitte des Diamanten
    var SPK_COLS = ['#c2eee2', '#84cdbd', '#58a797', '#ffffff', '#ffffff', '#e8fbf6'];
    var SPK_PTS = [[158, 107], [113, 112], [208, 112], [153, 152], [123, 142], [193, 147], [168, 192], [98, 127], [150, 130]];

    function buildHero() {
      if (!hero || dia) return;
      dia = doc.createElement('div'); dia.className = 'hs-dia'; dia.setAttribute('aria-hidden', 'true');
      dia.innerHTML = '<div class="hs-pend"><i class="hs-glow"></i><img class="hs-chain" src="hero-chain.png" alt="" width="464" height="500" decoding="async" draggable="false">' +
        '<div class="hs-gem"><img class="hs-gimg" src="hero-gem.png" alt="" width="264" height="232" decoding="async" draggable="false">' +
        '<img class="hs-gimg hs-bright" src="hero-gem.png" alt="" width="264" height="232" decoding="async" draggable="false"><div class="hs-spk-host"></div></div></div>';
      doc.body.appendChild(dia);
      pend = dia.firstChild; chainEl = dia.querySelector('.hs-chain'); gemEl = dia.querySelector('.hs-gem');
      gemBright = dia.querySelector('.hs-bright'); glowEl = dia.querySelector('.hs-glow'); spkHost = dia.querySelector('.hs-spk-host');
    }
    /* Kein Landen mehr: Der Diamant schwingt, solange der Hero im Bild ist. Beim Hinausscrollen sinkt er ein Stück,
       blendet aus (Opacity -> 0), wird leicht unscharf und kleiner und ist komplett unsichtbar, bevor er die
       nächsten Sektion erreicht. Vollständig umkehrbar (alles wird aus dem Scrollstand berechnet). */
    function fadeRange() {
      var yEnd = Math.max(200, G.nextTop - (G.by + 90 * G.s) + 10);
      var span = clamp(yEnd, 200, 520);
      return [yEnd - span, yEnd];
    }
    function heroFrame(dt, dy, force) {
      if (!dia || !G.s) return false;
      var fr = fadeRange(), u = clamp((y - fr[0]) / Math.max(1, fr[1] - fr[0]), 0, 1), us = smooth(u);
      if (u >= 1) { if (!heroHidden) { heroHidden = true; dia.style.visibility = 'hidden'; dia.style.opacity = '0'; setLive(dia, false); } return false; }
      if (heroHidden) { heroHidden = false; dia.style.visibility = ''; heroKey = ''; }
      var k = 1 - 0.6 * us;
      var th0 = reduce ? 0 : 4 * Math.sin(y / 120) * k;
      if (!reduce) {
        omega += (-40 * (theta - th0) - 2.4 * omega) * dt - dy * 1.0 * (0.3 + 0.7 * k);
        theta = clamp(theta + omega * dt, -26, 26);
      }
      var sc = G.s * (1 - 0.18 * us), gx = G.bx, gy = G.by + 60 * us;
      var ry = reduce ? 0 : 24 * Math.sin(y / 230) * k;
      var op = 1 - us, bl = 6 * us;
      var key = gx.toFixed(1) + '|' + gy.toFixed(1) + '|' + sc.toFixed(3) + '|' + (theta * k).toFixed(2) + '|' + ry.toFixed(1) + '|' + op.toFixed(3);
      if (key !== heroKey || force) {
        heroKey = key;
        dia.style.transform = 'translate3d(' + (gx - GX * sc).toFixed(1) + 'px,' + (gy - GY * sc).toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
        dia.style.opacity = op.toFixed(3);
        dia.style.filter = bl > 0.05 ? 'blur(' + bl.toFixed(2) + 'px)' : '';
        pend.style.transform = 'rotate(' + (theta * k).toFixed(2) + 'deg)';
        gemEl.style.transform = 'perspective(520px) rotateY(' + ry.toFixed(1) + 'deg)';
        chainEl.style.opacity = '1';
        gemBright.style.opacity = (0.35 * (0.5 + 0.5 * Math.sin(y / 160))).toFixed(2);
        glowEl.style.opacity = '0.55';
      }
      setLive(dia, !reduce);
      return !reduce && (Math.abs(omega) > 0.08 || Math.abs(theta - th0) > 0.05);
    }
    function spawnSpark() {
      if (!gemEl || !spkHost || spkHost.childNodes.length > 7) return;
      var p = SPK_PTS[Math.floor(Math.random() * SPK_PTS.length)], el = doc.createElement('i');
      el.className = 'hs-spk';
      el.style.left = (p[0] + (Math.random() * 14 - 7)).toFixed(0) + 'px';
      el.style.top = (p[1] + (Math.random() * 14 - 7)).toFixed(0) + 'px';
      el.style.setProperty('--s', (22 + Math.random() * 30).toFixed(0) + 'px');
      el.style.setProperty('--c', SPK_COLS[Math.floor(Math.random() * SPK_COLS.length)]);
      spkHost.appendChild(el);
      el.addEventListener('animationend', function () { if (el.parentNode) el.parentNode.removeChild(el); });
    }
    function sparkLoop() {
      var moving = performance.now() - lastMoveT < 260;
      if (gemVisible && !heroHidden && !doc.hidden) { spawnSpark(); if (moving && Math.random() < 0.5) spawnSpark(); }
      setTimeout(sparkLoop, moving ? 140 + Math.random() * 260 : 800 + Math.random() * 1500);
    }

    /* ================= Messen + Hauptschleife ================= */
    function measure() {
      vh = window.innerHeight || 800;
      var de = doc.documentElement;
      maxScroll = Math.max(1, de.scrollHeight - vh);
      if (hero && dia) {
        var vw = window.innerWidth || 1280, s, X0, Y0;
        G.heroTop = rect0(hero); G.heroH = hero.offsetHeight || 600;
        if (vw / vh >= 1.15) { s = Math.max(vw / 1920, vh / 1080); X0 = (vw - 1920 * s) / 2 + 1237 * s; Y0 = (vh - 1080 * s) / 2; }
        else if (vw <= 720) { s = clamp(vw / 1100, 0.3, 0.34); X0 = vw - 18 - PX * s; Y0 = 10; }   // phones: small diamond above the hero text (hero.css reserves the space)
        else { s = clamp(vw / 820, 0.36, 0.6); X0 = vw - 18 - PX * s; Y0 = 44; }
        G.s = s; G.sl = s * 0.8; G.bx = X0 + GX * s; G.by = Y0 + GY * s;
        var nx = hero.nextElementSibling;
        while (nx && !nx.offsetHeight) nx = nx.nextElementSibling;
        G.nextTop = nx ? rect0(nx) : G.heroTop + G.heroH;
        var wr = $('.wrap'); var wrR = wr ? wr.getBoundingClientRect().right : vw - 20;
        G.tx = Math.min(vw - 14 - 80 * G.sl, wrR - 80 * G.sl - 6); G.ty0 = (vw / vh >= 1.15 ? 10 : -22) + 74 * G.sl;
      }
    }
    var lastFrameT = 0;
    function frame(now) {
      raf = 0;
      y = window.pageYOffset || 0;
      var first = !lastFrameT || now - lastFrameT > 120;
      var dt = first ? 0.016 : Math.min(0.05, (now - lastFrameT) / 1000);
      var dy = first ? 0 : y - lastY;
      vel = first ? 0 : vel * 0.5 + (dy / dt) * 0.5;
      if (Math.abs(vel) > 150) lastMoveT = performance.now();
      var more = false;
      try {
        if (!reduce) {
          if (heroFrame(dt, dy)) more = true;
        }
      } catch (e) {}
      lastY = y; lastFrameT = now;
      if (more) schedule();
    }

    /* ================= Start ================= */
    function init() {
      buildHero();
      if (reduce) {
        if (dia) { measure(); heroFrame(0.016, 0, true); var rr = 0, rf = function () { if (rr) return; rr = requestAnimationFrame(function () { rr = 0; y = window.pageYOffset || 0; measure(); heroFrame(0.016, 0, true); }); }; window.addEventListener('resize', rf, { passive: true }); window.addEventListener('scroll', rf, { passive: true }); window.addEventListener('load', rf); }
        return;
      }
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) {
          es.forEach(function (en) {
            near.set(en.target, en.isIntersecting);
            if (en.target === gemEl) gemVisible = en.isIntersecting;
          });
          schedule();
        }, { rootMargin: '25% 0px 25% 0px', threshold: 0 });
        if (hero) watch(hero);
        if (gemEl) { watch(gemEl); }
      }
      measure();
      var rq = 0, remeasure = function () { if (rq) return; rq = requestAnimationFrame(function () { rq = 0; measure(); schedule(); }); };
      window.addEventListener('resize', remeasure, { passive: true });
      window.addEventListener('load', remeasure);
      try { if (window.ResizeObserver) { var main = $('main') || doc.body; new ResizeObserver(remeasure).observe(main); } } catch (e) {}
      window.addEventListener('scroll', schedule, { passive: true });
      lastMoveT = 0; setTimeout(sparkLoop, 900);
      heroFrame(0.016, 0, true);
      schedule();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  } catch (err) { /* Seite darf nie wegen Animationen kaputtgehen */ }
})();

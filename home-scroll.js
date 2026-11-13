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
    var mqM = window.matchMedia ? matchMedia('(max-width: 720px)') : { matches: false };
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
       „Hear the difference“-Sektion erreicht. Vollständig umkehrbar (alles wird aus dem Scrollstand berechnet). */
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

    /* ================= 2) „Hear the difference“ ================= */
    var hearSec = $('#hear'), card = null, waveEl = null, cvEl = null, waveT0 = 0, waveState = 0, tiltDone = false;
    function bindHear() {
      if (card || !hearSec || hearSec.hidden) return;
      var c = $('.ba-card', hearSec); if (!c) return;
      card = c; card.classList.add('hs-tilt');
      waveEl = $('.ba-wave', card); cvEl = waveEl && $('.ba-canvas', waveEl);
      if (waveEl && cvEl) { waveEl.classList.add('hs-wave'); waveEl.style.setProperty('--hs-r', '-16'); cvEl.style.transform = 'scaleY(.35)'; watch(waveEl); }
      watch(card); measure(); schedule();
    }
    var hp = 0, hTgt = 0, hKey = '', hInit = false, hRel = 0, hLast = 0;
    function hearFrame(now, dt) {
      var more = false;
      if (!card) return false;
      /* Einziger Schreiber der Karte. Ziel aus dem UNtransformierten Dokument-Offset (G.cardTop = offsetTop-Summe),
         der angezeigte Wert folgt dem Ziel zeitbasiert (exponentiell) und rastet bei |delta| < 0.001 ein. */
      hTgt = clamp((vh * 0.95 - (G.cardTop - y)) / (vh * 0.5), 0, 1);
      if (!hInit) { hInit = true; hp = hTgt; }
      var d = hTgt - hp;
      if (Math.abs(d) < 0.001) hp = hTgt; else { hp += d * (1 - Math.exp(-Math.max(dt, 0.001) * 16)); more = true; }
      var e = ease(hp);
      if (e >= 0.999 && hTgt >= 0.995) {                    /* Ruhezustand: Hysterese gegen Flackern an der Schwelle */
        if (!tiltDone) {
          tiltDone = true; hKey = '';
          card.style.transform = ''; card.style.opacity = '';
          clearTimeout(hRel); hRel = setTimeout(function () { if (tiltDone) setLive(card, false); }, 180);
        }
      } else if (e < 0.999) {
        if (tiltDone) { tiltDone = false; clearTimeout(hRel); }
        setLive(card, true);
        var tr = 'perspective(1100px) translate3d(0,' + ((1 - e) * 30).toFixed(2) + 'px,' + (-70 * (1 - e)).toFixed(2) + 'px) rotateX(' + (18 * (1 - e)).toFixed(3) + 'deg) scale(' + (0.92 + 0.08 * e).toFixed(3) + ')';
        if (tr !== hKey) { hKey = tr; card.style.transform = tr; card.style.opacity = (0.15 + 0.85 * e).toFixed(3); }
      }
      if (waveState === 0 && waveEl && isNear(waveEl) && G.waveTop - y < vh * 0.85) { waveState = 1; waveT0 = now; }
      if (waveState === 1) {
        var q = clamp((now - waveT0) / 1300, 0, 1), s = smooth(q);
        waveEl.style.setProperty('--hs-r', (-16 + 116 * s).toFixed(1));
        cvEl.style.transform = 'scaleY(' + (0.35 + 0.65 * ease(q)).toFixed(3) + ')';
        if (q >= 1) { waveState = 2; waveEl.classList.remove('hs-wave'); waveEl.style.removeProperty('--hs-r'); cvEl.style.transform = ''; } else more = true;
      }
      return more;
    }

    /* ================= 3) Services ================= */
    var svc = $('#services'), grid = svc && $('.service-grid', svc), cards = grid ? [].slice.call(grid.querySelectorAll('.service-card')) : [];
    var stackEl = null, pinEl = null, dotsEl = null, dotEls = [], stackOn = false, slots = [], stackDone = false, dotIdx = -1, zs = [];
    function buildStack() {
      if (stackOn || reduce || !svc || cards.length < 2 || mqM.matches) return;
      var head = $('.section-head', svc);
      stackEl = doc.createElement('div'); stackEl.className = 'hs-stack';
      pinEl = doc.createElement('div'); pinEl.className = 'hs-pin';
      svc.insertBefore(stackEl, head || grid); stackEl.appendChild(pinEl);
      if (head) pinEl.appendChild(head);
      pinEl.appendChild(grid);
      dotsEl = doc.createElement('div'); dotsEl.className = 'hs-dots'; dotsEl.setAttribute('aria-hidden', 'true');
      dotEls = cards.map(function () { var d = doc.createElement('i'); dotsEl.appendChild(d); return d; });
      pinEl.appendChild(dotsEl);
      stackEl.style.height = ((cards.length + 1) * 60) + 'vh';
      stackOn = true; stackDone = false; dotIdx = -1;
      watch(stackEl);
    }
    function destroyStack() {
      if (!stackOn) return;
      var head = $('.section-head', pinEl);
      svc.insertBefore(grid, stackEl);
      if (head) svc.insertBefore(head, grid);
      svc.removeChild(stackEl); io && io.unobserve(stackEl); near.delete(stackEl);
      stackEl = pinEl = dotsEl = null; stackOn = false;
      cards.forEach(function (c) { c.style.transform = ''; c.style.zIndex = ''; });
      grid.classList.remove('hs-live');
    }
    function stackFrame() {
      if (!stackOn || !G.range || !(isNear(stackEl) || !stackDone)) return;
      var n = cards.length, P = clamp((y - (G.stackTop - 78)) / G.range, 0, 1);
      if (P >= 1 && stackDone) return;
      var f = [], i, seg = P * (n + 1), sw = 0, ax = 0, ay = 0, fc = 0;
      for (i = 0; i < n; i++) {
        f[i] = smooth(clamp(seg - i, 0, 1)); fc += f[i];
        var w = 1 - f[i]; sw += w; ax += w * slots[i].x; ay += w * slots[i].y;
      }
      if (sw > 0.001) { ax /= sw; ay /= sw; } else { ax = slots[n - 1].x; ay = slots[n - 1].y; }
      if (P >= 1) {
        cards.forEach(function (c) { c.style.transform = ''; c.style.zIndex = ''; });
        grid.classList.remove('hs-live'); stackDone = true; setDots(n - 1); return;
      }
      stackDone = false; grid.classList.add('hs-live');
      for (i = 0; i < n; i++) {
        var rk = Math.max(0, i - fc), e = f[i], m = 1 - e;
        var tx = (ax - slots[i].x + rk * 7) * m, ty = (ay - slots[i].y + rk * 9) * m, tz = -rk * 45 * m;
        var rz = (2 - rk * 2.6) * m, ry = (-7 + rk * 2) * m, sc = 1 - (0.035 * rk + 0.02) * m;
        cards[i].style.transform = 'perspective(1100px) translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,' + tz.toFixed(1) + 'px) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
        var z = e > 0 ? 20 + i : 10 - i;
        if (zs[i] !== z) { zs[i] = z; cards[i].style.zIndex = z; }
      }
      setDots(Math.min(n - 1, Math.floor(P * (n + 1))));
    }
    function setDots(k) {
      if (k === dotIdx) return; dotIdx = k;
      dotEls.forEach(function (d, i) { d.classList.toggle('on', i === k); });
    }
    function mobileFrame() {
      if (stackOn || reduce || !grid || !mqM.matches) return;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i], top = G.cardTops && G.cardTops[i];
        if (top == null) continue;
        var p = y >= maxScroll - 2 ? 1 : clamp((vh * 0.95 - (top - y)) / (vh * 0.32), 0, 1), e = ease(p);
        if (e >= 0.999) { if (c.style.transform || c.style.opacity) { c.style.transform = ''; c.style.opacity = ''; } continue; }
        if (!isNear(c) && p <= 0) { if (!c.style.opacity) { c.style.opacity = '0.15'; } }
        c.classList.add('hs-m');
        c.style.transform = 'perspective(700px) translate3d(0,' + ((1 - e) * 46).toFixed(1) + 'px,' + (-60 * (1 - e)).toFixed(1) + 'px) rotateX(' + (10 * (1 - e)).toFixed(2) + 'deg)';
        c.style.opacity = (0.15 + 0.85 * e).toFixed(3);
      }
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
      if (card) { G.cardTop = rect0(card); if (waveEl) G.waveTop = rect0(waveEl); }
      if (stackOn) {
        G.stackTop = rect0(stackEl); G.range = Math.max(1, stackEl.offsetHeight - pinEl.offsetHeight);
        slots = cards.map(function (c) { return { x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + c.offsetHeight / 2 }; });
      }
      if (!stackOn && grid && !reduce) G.cardTops = cards.map(rect0);
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
          if (hearFrame(now, dt)) more = true;
          stackFrame();
          mobileFrame();
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
        if (grid && !stackOn) cards.forEach(watch);
      }
      buildStack();
      var onMq = function () {
        if (mqM.matches) { destroyStack(); } else { buildStack(); }
        if (io && grid && !stackOn) cards.forEach(function (c) { if (!near.has(c)) watch(c); });
        cards.forEach(function (c) { c.style.transform = ''; c.style.opacity = ''; });
        measure(); schedule();
      };
      if (mqM.addEventListener) mqM.addEventListener('change', onMq); else if (mqM.addListener) mqM.addListener(onMq);
      measure(); bindHear();
      if (hearSec) { try { new MutationObserver(bindHear).observe(hearSec, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }); } catch (e) {} }
      var rq = 0, remeasure = function () { if (rq) return; rq = requestAnimationFrame(function () { rq = 0; measure(); schedule(); }); };
      window.addEventListener('resize', remeasure, { passive: true });
      window.addEventListener('load', remeasure);
      try { if (window.ResizeObserver) { var main = $('main') || doc.body; new ResizeObserver(remeasure).observe(main); } } catch (e) {}
      window.addEventListener('scroll', schedule, { passive: true });
      if (stackEl) stackEl.addEventListener('focusin', function (e) {
        var c = e.target.closest && e.target.closest('.service-card'); if (!c) return;
        var i = cards.indexOf(c), n = cards.length;
        var need = G.stackTop - 78 + ((i + 1) / (n + 1)) * G.range + 2;
        if (y < need - 4 && y < G.stackTop - 78 + G.range) window.scrollTo({ top: need, behavior: 'auto' });
      });
      lastMoveT = 0; setTimeout(sparkLoop, 900);
      heroFrame(0.016, 0, true);
      schedule();
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
  } catch (err) { /* Seite darf nie wegen Animationen kaputtgehen */ }
})();

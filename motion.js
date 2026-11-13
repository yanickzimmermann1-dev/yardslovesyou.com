/* motion.js – weiche Bewegung: Scroll-Blur, Einblenden, Wellen, Karten-Neigung.
   Greift nur auf Optik zu, fasst keine Formulare/Speicher an und überschreibt keine Globals. */
(function () {
  'use strict';
  try {
    var doc = document;
    var root = doc.documentElement;
    var reduce = false;
    try { reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

    // CSS blendet .rv nur aus, wenn diese Klasse existiert
    root.classList.add('js-motion');

    /* ---------- Schallwellen-Leiste oben (ersetzt den Scroll-Balken) ---------- */
    function makeWave(body) {
      var cv, ctx;
      try {
        cv = doc.createElement('canvas');
        cv.className = 'wavebar';
        cv.setAttribute('aria-hidden', 'true');
        ctx = cv.getContext('2d');
        if (!ctx) return null;
        body.appendChild(cv);
      } catch (e) { return null; }
      var W = 0, H = 12, dpr = 1, prog = 0, shown = false, lastY = null, vel = 0, raf = 0, last = 0, phase = 0, T = 0;
      function size() {
        var r = cv.getBoundingClientRect();
        W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
        dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      function yAt(x, t, amp, headX) {
        var env = 0.8 + 0.2 * (Math.sin(x * 0.006 + t * 0.35) * 0.5 + Math.sin(x * 0.0137 - t * 0.23 + 1.3) * 0.3 + Math.sin(x * 0.0031 + t * 0.11 + 2.1) * 0.2) * 1.0;
        env = Math.max(0.6, Math.min(1, env));
        var k = 2 * Math.PI / 17;
        var taper = 1;
        if (headX != null) taper = Math.max(0, Math.min(1, (headX - x) / 30));
        // sanfter Auslauf zu den Rändern (flache Enden)
        var edge = Math.min(1, x / 30, (W - x) / 30);
        return (H / 2) + amp * env * taper * edge * Math.sin(k * x + phase);
      }
      function path(x0, x1, t, amp, headX) {
        ctx.beginPath();
        for (var x = x0; x <= x1; x += 1.5) {
          var y = yAt(x, t, amp, headX);
          if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      function draw() {
        ctx.clearRect(0, 0, W, H);
        var maxA = W < 720 ? 3 : 3.5;
        var amp = maxA * (1 + Math.min(0.25, vel)) * (reduce ? 0.8 : 1 + 0.04 * Math.sin(T * 17));
        amp = Math.min(maxA * 1.25, amp);
        var headX = prog * W;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(182,138,255,.18)'; ctx.lineWidth = 1;
        path(Math.max(0, headX - 1), W, T, amp * 0.35, null);
        if (headX > 1) {
          ctx.strokeStyle = '#b68aff'; ctx.lineWidth = 1.75;
          ctx.shadowColor = '#8f1fe0'; ctx.shadowBlur = 6;
          path(0, headX, T, amp, headX);
          ctx.shadowBlur = 0;
        }
      }
      function frame(now) {
        raf = 0;
        if (!shown || doc.hidden) return;
        var dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now;
        vel *= Math.exp(-dt * 3);
        T += dt; phase += dt * (1.2 + vel * 6);
        draw();
        raf = requestAnimationFrame(frame);
      }
      function kick() { if (!reduce && !raf && shown && !doc.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
      doc.addEventListener('visibilitychange', function () {
        if (doc.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } } else kick();
      });
      window.addEventListener('resize', function () { size(); if (shown) draw(); }, { passive: true });
      size();
      return {
        set: function (p, y) {
          if (p < 0) { shown = false; cv.style.display = 'none'; if (raf) { cancelAnimationFrame(raf); raf = 0; } return; }
          if (!shown) { shown = true; cv.style.display = ''; size(); }
          prog = p;
          if (lastY !== null) vel = Math.min(1, vel + Math.min(1, Math.abs(y - lastY) / 120) * 0.25);
          lastY = y;
          if (reduce) { phase = 0.6; draw(); } else kick();
        }
      };
    }

    function init() {
      var body = doc.body;
      if (!body) return;

      /* ---------- Hintergrund & Fortschritt ---------- */
      var bgBlur = null, bar = null, topbar = null;
      try {
        bgBlur = doc.createElement('div');
        bgBlur.className = 'bg-blur';
        bgBlur.setAttribute('aria-hidden', 'true');
        body.insertBefore(bgBlur, body.firstChild);
      } catch (e) {}
      bar = makeWave(body);

      /* ---------- Handy: Navigation aus der Kopfzeile lösen ----------
         iOS Safari zeigt eine fixierte Leiste innerhalb des (sticky) Headers
         teils nicht an. Darum hängt sie auf Handys direkt am <body>. */
      try {
        var nav = doc.querySelector('.topbar nav[aria-label="Main"]');
        var navHome = nav && nav.parentNode, navNext = nav && nav.nextSibling;
        var mq = window.matchMedia && window.matchMedia('(max-width: 720px)');
        var placeNav = function () {
          if (!nav || !mq) return;
          if (mq.matches) { if (nav.parentNode !== body) body.appendChild(nav); }
          else if (nav.parentNode !== navHome) navHome.insertBefore(nav, navNext);
        };
        placeNav();
        if (mq) { if (mq.addEventListener) mq.addEventListener('change', placeNav); else if (mq.addListener) mq.addListener(placeNav); }
      } catch (e) {}

      var ticking = false;
      function update() {
        ticking = false;
        try {
          var y = window.scrollY || window.pageYOffset || 0;
          var max = Math.max(1, root.scrollHeight - window.innerHeight);
          // Hintergrund wird beim Scrollen unscharf
          if (bgBlur) {
            var p = Math.min(1, y / Math.max(320, Math.min(max, window.innerHeight * 1.6)));
            bgBlur.style.opacity = p.toFixed(3);
          }
          // Fortschrittsbalken oben
          if (bar) bar.set(max < 40 ? -1 : Math.min(1, y / max), y);
          // Kopfzeile wird kompakter
          if (!topbar || !topbar.isConnected) topbar = doc.querySelector('.topbar');
          if (topbar) topbar.classList.toggle('scrolled', y > 12);
        } catch (e) {}
      }
      function onScroll() {
        if (ticking) return;
        ticking = true;
        (window.requestAnimationFrame || function (f) { return setTimeout(f, 16); })(update);
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      window.addEventListener('load', onScroll);
      update();

      /* ---------- Einblenden beim Scrollen ---------- */
      var RV_SEL = '.section-head, .product, .service-card, .track, .cp, .free-nav a, .pd-section, .product-detail, .mc, .drop, .free-kit, .acc-card, .steps li, .upload-card, .bl, .cm, .bl-cta, .about-box, .legal, .pf-head, .fineprint, .home-section > .section-head, .service-grid > *, .mc-tiles > *';
      var arrived = root.classList.contains('fx-arrived');
      var RV_SKIP = '.pd-sticky, .live-pill, dialog, .cm-roll, .bl-grid';

      if (!reduce && 'IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            var el = en.target;
            el.classList.add('in');
            io.unobserve(el);
            // Verzögerung entfernen, damit Hover-Effekte später nicht träge sind
            if (el.style.transitionDelay) {
              setTimeout(function () { el.style.transitionDelay = ''; }, 1200);
            }
          });
        }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });

        var scanQueued = false;
        var scan = function () {
          scanQueued = false;
          try {
            var found = [];
            var list = body.querySelectorAll(RV_SEL);
            for (var i = 0; i < list.length; i++) {
              var el = list[i];
              if (el.dataset.rv === '1') continue;
              if (el.classList.contains('hero')) continue;
              if (el.hasAttribute('data-hs')) continue; // home-scroll.js animiert dieses Element selbst
              if (el.closest(RV_SKIP)) continue;
              // Ankunft per Seitenübergang: Elemente im ersten Viewport starten im Endzustand (kein Einblenden/Verschieben)
              if (arrived && performance.now() < 3000) {
                var br = el.getBoundingClientRect();
                if (br.bottom > 0 && br.top < window.innerHeight) { el.dataset.rv = '1'; continue; }
              }
              found.push(el);
            }
            // Gruppen je Elternelement für die Staffelung
            var parents = [];
            var groups = [];
            found.forEach(function (el) {
              var idx = parents.indexOf(el.parentNode);
              if (idx < 0) { parents.push(el.parentNode); groups.push([el]); }
              else groups[idx].push(el);
            });
            groups.forEach(function (g) {
              g.forEach(function (el, n) {
                el.dataset.rv = '1';
                el.classList.add('rv');
                if (g.length > 1) el.style.transitionDelay = ((n % 6) * 70) + 'ms';
                io.observe(el);
              });
            });
          } catch (e) {}
        };
        var queueScan = function () {
          if (scanQueued) return;
          scanQueued = true;
          requestAnimationFrame(scan);
        };
        scan();
        // Später gerenderte Listen (Shop, Community, Mix Check) einsammeln
        try {
          new MutationObserver(queueScan).observe(body, { childList: true, subtree: true });
        } catch (e) {}

        // Sicherheitsnetz: sichtbare Elemente nie versteckt lassen
        setTimeout(function () {
          try {
            var hidden = doc.querySelectorAll('.rv:not(.in)');
            for (var i = 0; i < hidden.length; i++) {
              if (hidden[i].getBoundingClientRect().top < window.innerHeight) hidden[i].classList.add('in');
            }
          } catch (e) {}
        }, 2500);
      }

      /* ---------- Wellen-Effekt beim Drücken ---------- */
      var RIPPLE_SEL = '.button, .outline, .cm-pill, .cm-tab, .cp-like, .cp-icon, .bl-sound, .mc-toggle button, .play-btn, .bl-play';
      doc.addEventListener('pointerdown', function (e) {
        try {
          return; /* ripple removed: no button motion */
          var t = e.target && e.target.closest ? e.target.closest(RIPPLE_SEL) : null;
          if (!t || t.disabled) return;
          var rect = t.getBoundingClientRect();
          var d = Math.max(rect.width, rect.height) * 2.2;
          if (t.matches('.play-btn, .bl-play') && getComputedStyle(t).position === 'static') {
            t.style.position = 'relative';
            t.style.overflow = 'hidden';
          }
          var r = doc.createElement('span');
          r.className = 'ripple';
          r.style.width = r.style.height = d + 'px';
          r.style.left = (e.clientX - rect.left - d / 2) + 'px';
          r.style.top = (e.clientY - rect.top - d / 2) + 'px';
          t.appendChild(r); // zuletzt einfügen, ohne Text
          setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 650);
          if (e.pointerType === 'touch') {
            try { if (navigator.vibrate) navigator.vibrate(6); } catch (e2) {}
          }
        } catch (err) {}
      }, { passive: true });


      /* ---------- Lila Partikel-Burst für Generate-Buttons (.gen-btn) ---------- */
      var fxLayer = null;
      var P_COLORS = ['#b68aff', '#a374f5', '#c9a4ff', '#e5a5ff', '#d9c2ff'];
      doc.addEventListener('click', function (e) {
        try {
          return; /* particle burst + pop removed */
          var t = e.target && e.target.closest ? e.target.closest('.gen-btn') : null;
          if (!t || t.disabled || !t.animate) return;
          // sanftes "Pop" auf dem Button, ohne Inhalt zu ändern
          t.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)', offset: 0.35 }, { transform: 'scale(1)' }],
            { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          if (reduce) return;
          var rect = t.getBoundingClientRect();
          var cx = (e.clientX || e.clientY) ? e.clientX : rect.left + rect.width / 2;
          var cy = (e.clientX || e.clientY) ? e.clientY : rect.top + rect.height / 2;
          if (!fxLayer || !fxLayer.isConnected) {
            fxLayer = doc.createElement('div');
            fxLayer.className = 'fx-layer';
            fxLayer.setAttribute('aria-hidden', 'true');
            body.appendChild(fxLayer);
          }
          var n = 14 + Math.floor(Math.random() * 7);
          for (var i = 0; i < n; i++) {
            var p = doc.createElement('span');
            var size = 3 + Math.random() * 5;
            var col = P_COLORS[Math.floor(Math.random() * P_COLORS.length)];
            p.className = 'fx-p';
            p.style.width = p.style.height = size.toFixed(1) + 'px';
            p.style.left = (cx - size / 2) + 'px';
            p.style.top = (cy - size / 2) + 'px';
            p.style.background = col;
            if (Math.random() < 0.55) p.style.boxShadow = '0 0 ' + (6 + Math.random() * 8).toFixed(0) + 'px ' + col;
            fxLayer.appendChild(p);
            var ang = Math.random() * Math.PI * 2;
            var dist = 36 + Math.random() * 70;
            var dx = Math.cos(ang) * dist;
            var dy = Math.sin(ang) * dist;
            var dur = 600 + Math.random() * 200;
            var anim = p.animate([
              { transform: 'translate(0,0) scale(1)', opacity: 1 },
              { transform: 'translate(' + (dx * 0.7).toFixed(1) + 'px,' + (dy * 0.7).toFixed(1) + 'px) scale(.9)', opacity: 1, offset: 0.55 },
              { transform: 'translate(' + dx.toFixed(1) + 'px,' + (dy + 38).toFixed(1) + 'px) scale(.2)', opacity: 0 }
            ], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
            (function (el) {
              anim.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el); };
            })(p);
          }
        } catch (err) {}
      }, true);

      /* ---------- Karten-Neigung + Lichtfleck (nur Maus) ---------- */
      var fine = false;
      try { fine = !!matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
      if (fine && !reduce) {
        var CARD_SEL = '.product, .service-card:not([data-hs]), .cp, .free-nav a'; // Home-Services ([data-hs]) reagieren nur auf Scroll
        var active = null, lastEv = null, tiltQueued = false;

        var resetCard = function (c) { if (c) c.style.transform = ''; };

        var tilt = function () {
          tiltQueued = false;
          try {
            var e = lastEv;
            if (!e) return;
            var card = e.target && e.target.closest ? e.target.closest(CARD_SEL) : null;
            if (active && active !== card) resetCard(active);
            active = card;
            if (!card) return;
            if (card.hasAttribute('data-holo')) { return; } // holo.js übernimmt die Neigung dieser Karte
            if (card.querySelector('.p3d')) { resetCard(card); return; } // 3D-Modell dreht selbst: keine doppelte Neigung
            if (e.buttons !== 0) { resetCard(card); return; }
            var r = card.getBoundingClientRect();
            if (!r.width || !r.height) return;
            var px = (e.clientX - r.left) / r.width;
            var py = (e.clientY - r.top) / r.height;
            var dx = Math.max(-0.5, Math.min(0.5, px - 0.5));
            var dy = Math.max(-0.5, Math.min(0.5, py - 0.5));
            card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
            card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
            card.style.transform = 'perspective(900px) rotateX(' + (-dy * 5) + 'deg) rotateY(' + (dx * 5) + 'deg) translateY(-4px)';
          } catch (err) {}
        };

        doc.addEventListener('pointermove', function (e) {
          if (e.pointerType && e.pointerType !== 'mouse') return;
          lastEv = e;
          if (tiltQueued) return;
          tiltQueued = true;
          requestAnimationFrame(tilt);
        }, { passive: true });

        // Maus verlässt das Fenster: Karte zurücksetzen
        doc.addEventListener('pointerleave', function () {
          resetCard(active);
          active = null;
          lastEv = null;
        }, { passive: true });
        doc.documentElement.addEventListener('mouseleave', function () {
          resetCard(active);
          active = null;
          lastEv = null;
        }, { passive: true });
      }
    }

    if (doc.body) init();
    else doc.addEventListener('DOMContentLoaded', init);
  } catch (err) { /* Seite darf nie wegen Animationen kaputtgehen */ }
})();

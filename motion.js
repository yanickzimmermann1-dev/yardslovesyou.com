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
        bar = doc.createElement('div');
        bar.className = 'scroll-progress';
        bar.setAttribute('aria-hidden', 'true');
        body.appendChild(bar);
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
          if (bar) {
            if (max < 40) { bar.style.opacity = '0'; }
            else {
              bar.style.opacity = '';
              bar.style.transform = 'scaleX(' + Math.min(1, y / max) + ')';
            }
          }
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
              if (el.closest(RV_SKIP)) continue;
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
          if (reduce) return;
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

      /* ---------- Karten-Neigung + Lichtfleck (nur Maus) ---------- */
      var fine = false;
      try { fine = !!matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
      if (fine && !reduce) {
        var CARD_SEL = '.product, .service-card, .cp, .free-nav a';
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

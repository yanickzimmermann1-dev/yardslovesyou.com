/* fx.js – YLYFX: Blackout (schwarz + violette Partikel), Seitenübergänge, particlesBurst. */
(function () {
  'use strict';
  var root = document.documentElement;
  /* Particle colours follow the page's area colour (--area-rgb); default purple on home/legal. */
  var COLS = (function () {
    try {
      var b = document.body, a = b && b.getAttribute('data-area');
      if (a && a !== 'mix') {
        var v = getComputedStyle(b).getPropertyValue('--area-rgb').trim().split(',').map(Number);
        if (v.length === 3 && v.every(isFinite)) {
          var d = v.map(function (x) { return Math.round(x * 0.62); }), l = v.map(function (x) { return Math.round(x + (255 - x) * 0.35); });
          return ['rgb(' + d.join(',') + ')', 'rgb(' + v.join(',') + ')', 'rgb(' + l.join(',') + ')'];
        }
      }
    } catch (e) {}
    return ['#8f1fe0', '#b33cff', '#d47bff'];
  })();
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var active = null;

  function removeLayer() {
    if (!active) return;
    var a = active; active = null;
    a.dead = true; a.raf && cancelAnimationFrame(a.raf);
    a.timers.forEach(clearTimeout);
    try { a.el.parentNode && a.el.parentNode.removeChild(a.el); } catch (e) {}
    a.resolve();
  }

  var EASE_IN = 'cubic-bezier(.22,.61,.36,1)', EASE_OUT = 'cubic-bezier(.42,0,.58,1)';

  function blackout(opts) {
    opts = opts || {};
    var inMs = opts.inMs == null ? 260 : opts.inMs, holdMs = opts.holdMs == null ? 120 : opts.holdMs, outMs = opts.outMs == null ? 380 : opts.outMs;
    if (reduce) { inMs = Math.min(inMs, 150); holdMs = Math.min(holdMs, 60); outMs = Math.min(outMs, 150); }
    if (active) { // nur ein Blackout gleichzeitig
      var o = active;
      if (opts.onBlack) {
        if (o.black && !o.fading) { try { opts.onBlack(); } catch (e) {} }
        else if (o.fading) { o.cbs.push(opts.onBlack); o.reraise(inMs); } // Layer blendet gerade aus: weich wieder schwarz (kein Doppel-Flackern)
        else o.cbs.push(opts.onBlack);
      }
      return o.promise;
    }
    var a = { cbs: opts.onBlack ? [opts.onBlack] : [], timers: [], black: false, dead: false, fading: false, raf: 0, boost: 1 };
    a.promise = new Promise(function (res) { a.resolve = res; });
    active = a;
    var el = document.createElement('div'); el.id = 'ylyfx'; el.setAttribute('aria-hidden', 'true'); a.el = el;
    (document.body || root).appendChild(el);
    var cv = null, ctx = null, W = 0, H = 0, dpr = 1, P = [];
    if (!reduce) {
      try {
        cv = document.createElement('canvas'); el.appendChild(cv); ctx = cv.getContext('2d');
        dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        var n = Math.round(40 + Math.min(30, W / 1280 * 30)), i;
        for (i = 0; i < n; i++) P.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2, c: COLS[i % 3], glow: Math.random() < 0.35,
          vx: (Math.random() - 0.5) * 14, vy: -(4 + Math.random() * 16), ph: Math.random() * 6.28, sp: 1.5 + Math.random() * 3 });
      } catch (e) { cv = null; ctx = null; }
    }
    var t0 = performance.now(), last = t0;
    function draw(now) { // läuft ununterbrochen bis der Layer entfernt wird (auch während der Haltezeit)
      if (a.dead) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var k, p, al, tw = (now - t0) / 1000, bs = a.boost;
      for (k = 0; k < P.length; k++) {
        p = P[k]; p.x += p.vx * dt * bs; p.y += p.vy * dt * bs;
        if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; } if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5;
        al = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(tw * p.sp + p.ph));
        ctx.fillStyle = p.c;
        if (p.glow) { ctx.globalAlpha = al * 0.18; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.2832); ctx.fill(); }
        ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
      a.raf = requestAnimationFrame(draw);
    }
    if (ctx) a.raf = requestAnimationFrame(draw);
    function T(fn, ms) { var t = setTimeout(fn, ms); a.timers.push(t); return t; }
    function clearT() { a.timers.forEach(clearTimeout); a.timers = []; }
    function setOp(v, ms, curve) {
      el.style.transition = ms > 0 ? 'opacity ' + ms + 'ms ' + curve : 'none'; el.style.opacity = v;
      if (cv) { cv.style.transition = ms > 0 && v > 0 ? 'opacity ' + ms + 'ms ' + curve : 'none'; cv.style.opacity = v > 0 ? '1' : cv.style.opacity; }
    }
    function fadeOut() {
      if (a.dead) return;
      a.fading = true; a.boost = 2.2; // Partikel treiben beim Ausblenden weiter nach oben
      setOp(0, outMs, EASE_OUT); T(removeLayer, outMs + 60);
    }
    function reveal() {
      if (a.dead || a.revealed) return; a.revealed = true;
      try { performance.mark('fx-reveal'); } catch (e) {}
      try { opts.onReveal && opts.onReveal(); } catch (e) {}
      // einen Frame warten, damit die enthüllte Seite gezeichnet ist, dann ausblenden
      var go = false, f = function () { if (go) return; go = true; fadeOut(); };
      try { requestAnimationFrame(function () { requestAnimationFrame(f); }); } catch (e) {}
      T(f, 80);
    }
    function atBlack() {
      if (a.dead) return; a.black = true; a.fading = false;
      var c = a.cbs; a.cbs = []; c.forEach(function (f) { try { f(); } catch (e) {} });
      var started = performance.now();
      function afterHold() {
        if (a.dead || a.fading) return;
        if (opts.waitFor) {
          var left = Math.max(0, (opts.maxHold || 1200) - (performance.now() - t0)), done = false;
          var fin = function () { if (done) return; done = true; reveal(); };
          try { Promise.resolve(typeof opts.waitFor === 'function' ? opts.waitFor() : opts.waitFor).then(fin, fin); } catch (e) { fin(); }
          T(fin, left);
        } else reveal();
      }
      T(afterHold, holdMs);
    }
    a.atBlack = atBlack;
    a.reraise = function (ms) { // während des Ausblendens wieder einblenden
      if (a.dead) return;
      clearT(); a.fading = false; a.black = false; a.revealed = false; a.boost = 1;
      try { var cur = parseFloat(getComputedStyle(el).opacity); el.style.transition = 'none'; el.style.opacity = isNaN(cur) ? 0 : cur; void el.offsetWidth; } catch (e) {}
      setOp(1, ms, EASE_IN); T(atBlack, ms);
    };
    if (opts.arrive) { el.style.opacity = '1'; if (cv) cv.style.opacity = '1'; T(atBlack, 0); }
    else if (inMs <= 0) { setOp(1, 0); T(atBlack, 0); }
    else { if (cv) { cv.style.opacity = '0'; } void el.offsetWidth; el.style.transition = 'opacity ' + inMs + 'ms ' + EASE_IN; el.style.opacity = 1;
      if (cv) { cv.style.transition = 'opacity ' + Math.round(inMs * 1.4) + 'ms ' + EASE_IN; cv.style.opacity = '1'; } T(atBlack, inMs); }
    return a.promise;
  }

  function particlesBurst(x, y, o) {
    if (reduce) return;
    o = o || {};
    try {
      var count = o.count || 14, spread = o.spread || 80, life = o.life || 700, host = document.createElement('div'), i;
      host.className = 'fx-burst'; host.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      for (i = 0; i < count; i++) {
        var d = document.createElement('i'), s = 2 + Math.random() * 3, ang = Math.random() * 6.2832, dist = spread * (0.4 + Math.random() * 0.6), c = COLS[i % 3];
        d.style.cssText = 'width:' + s + 'px;height:' + s + 'px;margin:' + (-s / 2) + 'px 0 0 ' + (-s / 2) + 'px;background:' + c + ';box-shadow:0 0 ' + (s * 2) + 'px ' + c;
        host.appendChild(d);
        if (d.animate) d.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + (Math.cos(ang) * dist).toFixed(1) + 'px,' + (Math.sin(ang) * dist).toFixed(1) + 'px) scale(.3)', opacity: 0 }],
          { duration: life * (0.7 + Math.random() * 0.5), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
      }
      document.body.appendChild(host);
      setTimeout(function () { try { host.parentNode && host.parentNode.removeChild(host); } catch (e) {} }, life * 1.4 + 50);
    } catch (e) {}
  }

  window.YLYFX = { blackout: blackout, particlesBurst: particlesBurst };

  /* ---- Ankunft nach Seitenübergang: schwarz halten bis die Seite BEREIT ist (Schriften, DOM, Bilder, Netzwerk ruhig), dann ausblenden ---- */
  function clearArrive() { root.classList.remove('fx-arrive'); }
  function pageReady() {
    var net = window.__ylyNet || { pending: 0, last: 0 }, lastMut = performance.now(), mo = null;
    try { mo = new MutationObserver(function () { lastMut = performance.now(); }); mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true }); } catch (e) {}
    var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var dcl = new Promise(function (r) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { r(); }); else r(); });
    var fonts = function () {
      try {
        var f = document.fonts; if (!f) return Promise.resolve();
        var loads = ['400 16px "DM Sans"', '700 16px "DM Sans"', '700 16px "Space Grotesk"', '500 16px "Space Grotesk"'].map(function (x) { return f.load(x).catch(function () {}); });
        return Promise.all(loads).then(function () { return f.ready; });
      } catch (e) { return Promise.resolve(); }
    };
    var images = function () {
      var list = [].slice.call(document.images).filter(function (im) { var r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      return Promise.all(list.map(function (im) { return im.complete ? (im.decode ? im.decode().catch(function () {}) : 0) : new Promise(function (r) { im.addEventListener('load', r); im.addEventListener('error', r); }); }));
    };
    var quiet = function () { // Netzwerk ruhig + DOM seit 140 ms unverändert
      return new Promise(function (res) {
        (function chk() {
          var now = performance.now();
          if (net.pending === 0 && now - Math.max(net.last, lastMut) >= 140) res(); else setTimeout(chk, 40);
        })();
      });
    };
    return dcl.then(function () { return Promise.all([fonts(), images(), wait(60)]); }).then(quiet).then(function () { return fonts(); })
      .then(function () { return new Promise(function (r) { try { requestAnimationFrame(function () { requestAnimationFrame(function () { r(); }); }); } catch (e) { r(); } setTimeout(r, 120); }); })
      .then(function () { try { mo && mo.disconnect(); } catch (e) {} }, function () { try { mo && mo.disconnect(); } catch (e) {} });
  }
  function unhold() { root.classList.remove('fx-hold'); }
  if (root.classList.contains('fx-arrive')) {
    try { blackout({ arrive: true, holdMs: 0, outMs: 380, maxHold: 1200, waitFor: pageReady, onReveal: unhold }); } catch (e) { unhold(); }
    clearArrive();
    setTimeout(unhold, 1250);
  }
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { removeLayer(); navigating = false; clearArrive(); try { sessionStorage.removeItem('yly_nav_fx'); } catch (er) {} }
  });

  /* ---- Seitenübergang beim Klick auf interne Links ---- */
  var navigating = false;
  if (/-admin\b/.test(location.pathname)) return;
  document.addEventListener('click', function (e) {
    try {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || navigating) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.closest('form,[data-nofx]') || a.hasAttribute('download')) return;
      var tg = a.getAttribute('target'); if (tg && tg !== '_self') return;
      if (!/^https?:$/.test(a.protocol) || a.origin !== location.origin) return;
      if (a.pathname === location.pathname && a.search === location.search) return; // gleiche Seite / #Hash
      if (/\.[a-z0-9]{2,5}$/i.test(a.pathname) && !/\.html?$/i.test(a.pathname)) return; // Dateien
      var url = a.href; navigating = true;
      e.preventDefault();
      var go = function () { try { sessionStorage.setItem('yly_nav_fx', '1'); } catch (er) {} location.href = url; };
      var fired = false, once = function () { if (fired) return; fired = true; go(); };
      setTimeout(once, 600); // Notbremse
      try { blackout({ inMs: 260, holdMs: 900, outMs: 300, onBlack: once }); } catch (er) { once(); }
    } catch (er) {}
  });
})();

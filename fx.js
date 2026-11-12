/* fx.js – YLYFX: Blackout (schwarz + violette Partikel), Seitenübergänge, particlesBurst. */
(function () {
  'use strict';
  var root = document.documentElement;
  var COLS = ['#8f1fe0', '#b33cff', '#d47bff'];
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

  function blackout(opts) {
    opts = opts || {};
    if (active) { // nur ein Blackout gleichzeitig
      if (opts.onBlack) { if (active.black) { try { opts.onBlack(); } catch (e) {} } else active.cbs.push(opts.onBlack); }
      return active.promise;
    }
    var inMs = opts.inMs == null ? 180 : opts.inMs, holdMs = opts.holdMs == null ? 220 : opts.holdMs, outMs = opts.outMs == null ? 320 : opts.outMs;
    if (reduce) { inMs = 150; holdMs = 0; outMs = 150; }
    var a = { cbs: opts.onBlack ? [opts.onBlack] : [], timers: [], black: false, dead: false, raf: 0 };
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
    function draw(now) {
      if (a.dead) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      var k, p, al, tw = (now - t0) / 1000;
      for (k = 0; k < P.length; k++) {
        p = P[k]; p.x += p.vx * dt; p.y += p.vy * dt;
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
    function T(fn, ms) { a.timers.push(setTimeout(fn, ms)); }
    function setOp(v, ms) { el.style.transition = ms > 0 ? 'opacity ' + ms + 'ms linear' : 'none'; el.style.opacity = v; }
    function atBlack() {
      if (a.dead) return; a.black = true;
      var c = a.cbs; a.cbs = []; c.forEach(function (f) { try { f(); } catch (e) {} });
      T(function () { setOp(0, outMs); T(removeLayer, outMs + 40); }, holdMs);
    }
    if (inMs <= 0) { setOp(1, 0); T(atBlack, 0); }
    else { void el.offsetWidth; setOp(1, inMs); T(atBlack, inMs); }
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

  /* ---- Ankunft nach Seitenübergang: sofort schwarz, dann ausblenden (max ~400 ms) ---- */
  function clearArrive() { root.classList.remove('fx-arrive'); }
  if (root.classList.contains('fx-arrive')) {
    try { blackout({ inMs: 0, holdMs: 60, outMs: 300 }); } catch (e) {}
    clearArrive();
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
      setTimeout(once, 450); // Notbremse
      try { blackout({ inMs: 150, holdMs: 450, outMs: 200, onBlack: once }); } catch (er) { once(); }
    } catch (er) {}
  });
})();

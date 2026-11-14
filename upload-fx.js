/* upload-fx.js – YLYUploadFX: Overlay mit Partikelstrom -> leuchtende Kugel, gebunden an den Upload-Fortschritt. */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var el, orb, card, nameEl, pctEl, labelEl, fill, cv, ctx, W = 0, H = 0, dpr = 1;
  var shown = 0, target = 0, raf = 0, last = 0, P = [], open = false, fin = false, timers = [];
  var COLS = ['#c45cb9', '#e292da', '#f2c4ee']; /* upload = pink service area */

  function build() {
    if (el) return;
    el = document.createElement('div'); el.id = 'upfx'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Upload progress');
    if (reduce) el.className = 'rm';
    el.innerHTML = '<canvas aria-hidden="true"></canvas><div class="upfx-stage"><div class="upfx-orb" aria-hidden="true"></div>' +
      '<div class="upfx-card"><span class="upfx-ico" aria-hidden="true"></span><span class="upfx-name"></span></div>' +
      '<div class="upfx-pct" aria-hidden="true">0%</div><div class="upfx-label" role="status" aria-live="polite"></div>' +
      '<div class="upfx-bar" aria-hidden="true"><div class="upfx-fill"></div></div></div>';
    document.body.appendChild(el);
    cv = el.querySelector('canvas'); orb = el.querySelector('.upfx-orb'); card = el.querySelector('.upfx-card');
    nameEl = el.querySelector('.upfx-name'); pctEl = el.querySelector('.upfx-pct'); labelEl = el.querySelector('.upfx-label'); fill = el.querySelector('.upfx-fill');
  }
  function size() {
    if (!cv || reduce) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    try { ctx = cv.getContext('2d'); } catch (e) { ctx = null; }
  }
  function orbPos() { var r = orb.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function cardPos() { var r = card.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top, w: r.width }; }
  function spawn(c, o) {
    P.push({ sx: c.x + (Math.random() - 0.5) * c.w * 0.8, sy: c.y + 4, ex: o.x, ey: o.y, t: 0, sp: 0.35 + Math.random() * 0.4,
      amp: (Math.random() - 0.5) * 70, r: 1.6 + Math.random() * 2.2, c: COLS[(Math.random() * 3) | 0] });
  }
  var acc = 0, lastLb = '';
  function frame(now) {
    if (!open) return;
    var dt = Math.min(0.05, (now - last) / 1000), last0 = last; last = now;
    shown += (target - shown) * Math.min(1, Math.min(0.3, (now - last0) / 1000) * 3.2);
    if (target - shown < 0.05) shown = target;
    var p = shown / 100, v = Math.round(shown);
    pctEl.textContent = v + '%';
    var lb = v >= 100 ? 'Opening secure checkout\u2026' : v >= 70 ? 'Saving your request\u2026' : 'Uploading your track\u2026';
    if (lb !== lastLb) { lastLb = lb; labelEl.textContent = lb; }
    if (reduce) fill.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    else {
      orb.style.opacity = (0.3 + 0.7 * p).toFixed(3);
      orb.style.transform = 'scale(' + (0.5 + 0.5 * p + 0.03 * Math.sin(now / 420)).toFixed(3) + ')';
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
        var c = cardPos(), o = orbPos(), rate = 22 + 40 * p; acc += rate * dt;
        while (acc >= 1 && P.length < 160) { acc--; spawn(c, o); } if (acc > 3) acc = 0;
        ctx.globalCompositeOperation = 'lighter';
        for (var i = P.length - 1; i >= 0; i--) {
          var q = P[i]; q.t += dt * q.sp;
          if (q.t >= 1) { P.splice(i, 1); continue; }
          var e = q.t * q.t * (3 - 2 * q.t), x = q.sx + (q.ex - q.sx) * e + Math.sin(q.t * 3.14159) * q.amp, y = q.sy + (q.ey - q.sy) * e;
          var al = Math.sin(q.t * 3.14159); ctx.fillStyle = q.c;
          ctx.globalAlpha = al * 0.3; ctx.beginPath(); ctx.arc(x, y, q.r * 3.5, 0, 6.2832); ctx.fill();
          ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(x, y, q.r, 0, 6.2832); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    }
    raf = requestAnimationFrame(frame);
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  var api = {
    open: function (fileName) {
      try {
        build(); clearTimers(); fin = false; lastLb = ''; shown = target = 0; P = []; acc = 0;
        var nm = String(fileName || 'Your track'); nameEl.textContent = nm; nameEl.title = nm;
        el.querySelector('.upfx-ico').textContent = (nm.split('.').pop() || '').slice(0, 4).toUpperCase();
        labelEl.textContent = 'Uploading your track…'; pctEl.textContent = '0%'; fill.style.transform = 'scaleX(0)';
        orb.style.opacity = '.3'; orb.style.transform = 'scale(.5)';
        open = true; size(); void el.offsetWidth; el.classList.add('on');
        last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
        window.addEventListener('resize', size);
      } catch (e) { open = false; }
    },
    progress: function (p) {
      if (!open) return;
      p = Math.max(0, Math.min(100, +p || 0)); target = Math.max(target, p);
      labelEl.textContent = p >= 100 ? 'Opening secure checkout…' : p >= 70 ? 'Saving your request…' : 'Uploading your track…';
    },
        finish: function (go) {
      var done = false, once = function () { if (done) return; done = true; try { go(); } catch (e) {} };
      if (!open || fin) { once(); return; }
      fin = true; target = 100; labelEl.textContent = 'Opening secure checkout…';
      var fxo = window.YLYFX;
      if (!fxo || !fxo.blackout) { once(); return; }
      timers.push(setTimeout(once, 2500)); // Notbremse
      timers.push(setTimeout(function () {
        try {
          if (!reduce && fxo.particlesBurst) { var o = orbPos(); fxo.particlesBurst(o.x, o.y, { count: 36, spread: 150, life: 800 }); }
          fxo.blackout({ inMs: 350, holdMs: 400, outMs: 250, onBlack: once });
        } catch (e) { once(); }
      }, 450));
    },
    close: function () {
      if (!open) return; open = false; fin = false; clearTimers(); cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      el.classList.remove('on');
      timers.push(setTimeout(function () { P = []; if (ctx) ctx.clearRect(0, 0, W, H); }, 400));
    }
  };
  window.YLYUploadFX = api;
})();

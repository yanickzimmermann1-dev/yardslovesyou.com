(function () {
  'use strict';
  var footer = document.querySelector('footer.site-footer');
  if (!footer) return;
  var reduce = false, fine = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; fine = matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
  var wrap = document.createElement('div'); wrap.className = 'fw-wrap'; wrap.setAttribute('aria-hidden', 'true');
  var word = document.createElement('span'); word.className = 'fw-word';
  var letters = [];
  'YARDSLOVESYOU'.split('').forEach(function (c, i) {
    var s = document.createElement('span'); s.className = 'fw-l ' + (i < 5 ? 'fw-y' : 'fw-p'); s.textContent = c;
    word.appendChild(s); letters.push({ el: s, cx: 0, v: 0, t: 0 });
  });
  wrap.appendChild(word); footer.appendChild(wrap);

  var fs = 100, W = 0;
  /* Never cropped: the wrap is taller than the glyph box. Top room = wave lift (16%) + scale (12%) + margin, bottom room for the baseline. */
  var PAD_T = 0.34, PAD_B = 0.08, PAD_X = 0.018;
  function fit() {
    var w = wrap.clientWidth; if (!w) return;
    var px = Math.round(w * PAD_X), inner = w - 2 * px;
    word.style.fontSize = '100px';
    var nat = word.getBoundingClientRect().width; if (!nat) return;
    fs = 100 * inner / nat; W = w;
    word.style.fontSize = fs.toFixed(2) + 'px';
    word.style.left = px + 'px';
    word.style.top = (fs * PAD_T).toFixed(1) + 'px';
    wrap.style.height = Math.ceil(fs * (1 + PAD_T + PAD_B)) + 'px';
    var wr = wrap.getBoundingClientRect();
    letters.forEach(function (l) { var r = l.el.getBoundingClientRect(); l.cx = r.left - wr.left + r.width / 2; });
  }
  fit();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  addEventListener('resize', fit);
  addEventListener('load', fit);
  try { if (window.ResizeObserver) new ResizeObserver(function () { if (wrap.clientWidth !== W) fit(); }).observe(wrap); } catch (e) {}

  var mx = null, raf = 0, idle = 0, idleStart = 0;
  function frame(t) {
    raf = 0; var active = false;
    var rect = wrap.getBoundingClientRect(), R = Math.max(120, fs * 1.6);
    letters.forEach(function (l, i) {
      var target = 0;
      if (mx !== null) {
        var d = Math.abs(mx - rect.left - l.cx), f = Math.max(0, 1 - d / R); target = f * f * (3 - 2 * f);
      }
      if (idle) {
        var p = (t - idleStart) / 1000 - i * 0.09;
        if (p > 0 && p < 1.2) target = Math.max(target, Math.sin(p / 1.2 * Math.PI));
      }
      l.v += (target - l.v) * 0.14;
      if (Math.abs(l.v - target) > 0.002 || l.v > 0.002) active = true;
      var up = l.v * fs * 0.16, sc = 1 + l.v * 0.12;
      l.el.style.transform = 'translate3d(0,' + (-up).toFixed(2) + 'px,0) scale(' + sc.toFixed(3) + ')';
    });
    if (idle && (t - idleStart) / 1000 > 0.09 * letters.length + 1.3) idle = 0;
    if (active || idle || mx !== null) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  if (reduce) return;
  if (fine) {
    addEventListener('mousemove', function (e) {
      var r = wrap.getBoundingClientRect();
      if (e.clientY > r.top - 120 && e.clientY < r.bottom + 120) { mx = e.clientX; kick(); }
      else if (mx !== null) { mx = null; kick(); }
    }, { passive: true });
    document.addEventListener('mouseleave', function () { mx = null; kick(); });
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { io.disconnect(); idle = 1; idleStart = performance.now(); kick(); }
    }, { threshold: 0.3 });
    io.observe(wrap);
  }
})();

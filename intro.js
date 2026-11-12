/* intro.js – Intro: Wortmarke erscheint, Kamerazoom in das "O", kurzer Blackout (YLYFX) mit Partikeln, dann die Seite. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('intro-on')) return;
  var T_ZOOM = 1.3, D_ZOOM = 0.85, HANDOVER = 0.6;
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var ov, body, finished = false, started = false, skipped = false, handed = false, onSkip = null;

  function done() {
    if (finished) return; finished = true;
    try { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
    try { body.style.cssText = body.getAttribute('data-yi-style') || ''; body.removeAttribute('data-yi-style'); } catch (e) {}
    root.classList.remove('intro-on');
    window.removeEventListener('keydown', skip, true);
    try { document.dispatchEvent(new CustomEvent('yly:intro-done')); } catch (e) {}
  }
  function ease(x) { x = Math.max(0, Math.min(1, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  function skip() { if (skipped) return; skipped = true; if (started && onSkip) onSkip(); }

  // Black + Partikel, dann Seite einblenden (1.04 -> 1)
  function handover() {
    if (handed) return; handed = true;
    var swap = function () {
      try { ov.style.display = 'none'; } catch (e) {}
      done();
      try { body.style.transformOrigin = '50% 0'; body.style.animation = 'yiArrive .5s cubic-bezier(.22,1,.36,1) both'; } catch (e) {}
      setTimeout(function () { try { body.style.animation = ''; } catch (e) {} }, 600);
    };
    if (window.YLYFX && window.YLYFX.blackout) {
      try { window.YLYFX.blackout({ inMs: 180, holdMs: 200, outMs: 320, onBlack: swap }); setTimeout(swap, 900); return; } catch (e) {}
    }
    try { ov.style.transition = 'opacity .3s'; ov.style.opacity = '0'; } catch (e) {}
    setTimeout(swap, 320);
  }

  function build() {
    ov = document.createElement('div');
    ov.className = 'yi'; ov.setAttribute('role', 'presentation'); ov.setAttribute('aria-hidden', 'true');
    var h = '<div class="yi-glow"></div>', i;
    for (i = 0; i < 18; i++) h += '<i class="yi-p" style="left:' + ((i * 53 + 7) % 100) + '%;top:' + ((i * 37 + 20) % 80 + 10) + '%;animation-delay:-' + ((i * 0.37) % 3).toFixed(2) + 's;animation-duration:' + (2.6 + (i % 4) * 0.5) + 's"></i>';
    h += '<div class="yi-scene"><div class="yi-word">';
    var txt = 'YARDSLOVESYOU';
    for (i = 0; i < txt.length; i++) h += '<span class="yi-l' + (i >= 5 ? ' v' : '') + '" style="--i:' + i + '">' + txt[i] + '</span>';
    h += '<div class="yi-sweep"></div></div></div><button type="button" class="yi-skip" aria-label="Skip intro">Skip</button>';
    ov.innerHTML = h;
    root.appendChild(ov);
    ov.addEventListener('click', skip);
    ov.addEventListener('wheel', skip, { passive: true });
    ov.addEventListener('touchmove', skip, { passive: true });
    window.addEventListener('keydown', skip, true);
  }

  // Mittelpunkt des "O" (Glyphenmitte) relativ zur Span-Box
  function centerOf(O) {
    var cs = getComputedStyle(O), fs = parseFloat(cs.fontSize) || 100, cx = O.offsetWidth / 2, cy = O.offsetHeight / 2;
    try {
      var probe = document.createElement('i'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      O.appendChild(probe); var base = probe.offsetTop - O.offsetTop; O.removeChild(probe);
      var c = document.createElement('canvas').getContext('2d'); c.font = cs.fontWeight + ' ' + fs + 'px ' + cs.fontFamily;
      var m = c.measureText('O');
      if (m.actualBoundingBoxAscent != null) cy = base - (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    } catch (e) {}
    return { x: cx, y: cy, fs: fs };
  }

  function run() {
    started = true;
    ov.style.animation = 'none'; root.style.animation = 'none'; // JS läuft: CSS-Sicherheitsnetz abschalten
    if (reduce) {
      onSkip = handover;
      setTimeout(handover, 600);
      setTimeout(done, 3000);
      return;
    }
    var word = ov.querySelector('.yi-word'), letters = ov.querySelectorAll('.yi-l'), O = letters[6];
    var C = centerOf(O), zooming = false, ln = 0, Ox = 0, Oy = 0, Vx = 0, Vy = 0, t0 = 0, raf = 0, sFin = 1;
    function startZoom() {
      zooming = true; t0 = performance.now();
      try { ov.getAnimations({ subtree: true }).forEach(function (a) { a.finish(); }); } catch (e) {}
      var wr = word.getBoundingClientRect(), diag = Math.hypot(innerWidth, innerHeight);
      Ox = wr.left + O.offsetLeft + C.x; Oy = wr.top + O.offsetTop + C.y; Vx = innerWidth / 2; Vy = innerHeight / 2;
      sFin = Math.max(8, diag / (C.fs * 0.36));
      ln = Math.log(sFin);
      word.style.transformOrigin = (O.offsetLeft + C.x) + 'px ' + (O.offsetTop + C.y) + 'px'; word.style.transformStyle = 'flat'; word.style.willChange = 'auto';
      for (var k = 0; k < letters.length; k++) { letters[k].style.animation = 'none'; letters[k].style.opacity = '1'; letters[k].style.filter = 'none'; }
      raf = requestAnimationFrame(frame);
    }
    function frame(now) {
      if (finished || handed) return;
      var z = Math.min(1, (now - t0) / 1000 / D_ZOOM), e = ease(z), s = Math.exp(ln * e);
      word.style.transform = 'translate(' + (e * (Vx - Ox)).toFixed(2) + 'px,' + (e * (Vy - Oy)).toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
      var g = sm((z - 0.55) / 0.45);
      ov.style.filter = g > 0.01 ? 'blur(' + (5 * g).toFixed(2) + 'px)' : '';
      if (z >= HANDOVER) handover();
      if (z < 1) raf = requestAnimationFrame(frame);
    }
    onSkip = function () { if (raf) cancelAnimationFrame(raf); handover(); };
    if (skipped) { handover(); return; }
    setTimeout(function () { if (!skipped && !handed) startZoom(); }, T_ZOOM * 1000);
    setTimeout(handover, (T_ZOOM + D_ZOOM * HANDOVER) * 1000 + 400); // falls rAF stockt (Hintergrund-Tab)
  }

  function start() {
    body = document.body;
    if (!body) return;
    try { body.setAttribute('data-yi-style', body.getAttribute('style') || ''); } catch (e) {}
    try { window.scrollTo(0, 0); } catch (e) {}
    build();
    var go = false, fire = function () { if (go) return; go = true; run(); };
    try { document.fonts.ready.then(fire); } catch (e) {}
    setTimeout(fire, 300);
    setTimeout(done, 7000); // Notbremse
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

/* intro.js – 3D-Intro: Wortmarke erscheint, Kamerafahrt durch das "O" in die Seite. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('intro-on')) return;
  var T_PULL = 1.3, D_PULL = 1.1, TOTAL = T_PULL + D_PULL;
  var scale = 1;
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var ov, pt, sp, body, finished = false, started = false;

  function done() {
    if (finished) return; finished = true;
    try { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
    try { if (pt && pt.parentNode) pt.parentNode.removeChild(pt); if (sp && sp.parentNode) sp.parentNode.removeChild(sp); } catch (e) {}
    try { body.style.cssText = body.getAttribute('data-yi-style') || ''; body.removeAttribute('data-yi-style'); } catch (e) {}
    root.classList.remove('intro-on', 'intro-portal');
    window.removeEventListener('keydown', skip, true);
    try { document.dispatchEvent(new CustomEvent('yly:intro-done')); } catch (e) {}
  }

  function bez(x1, y1, x2, y2) { // cubic-bezier easing
    return function (x) {
      var t = x, i, cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
      for (i = 0; i < 6; i++) { var e = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(e) < 1e-4 || !d) break; t -= e / d; }
      return ((ay * t + by) * t + cy) * t;
    };
  }
  var ease = bez(0.75, 0, 0.2, 1);
  var rate = 1, skipped = false;
  function skip() { if (skipped) return; skipped = true; rate = 2.4; if (!started) return; try { ov.getAnimations({ subtree: true }).forEach(function (a) { a.finish(); }); } catch (e) {} }

  function build() {
    ov = document.createElement('div');
    ov.className = 'yi'; ov.setAttribute('role', 'presentation'); ov.setAttribute('aria-hidden', 'true');
    var h = '<div class="yi-glow"></div>';
    for (var i = 0; i < 18; i++) h += '<i class="yi-p" style="left:' + ((i * 53 + 7) % 100) + '%;top:' + ((i * 37 + 20) % 80 + 10) + '%;animation-delay:-' + ((i * 0.37) % 3).toFixed(2) + 's;animation-duration:' + (2.6 + (i % 4) * 0.5) + 's"></i>';
    h += '<div class="yi-scene"><div class="yi-word">';
    var txt = 'YARDSLOVESYOU';
    for (i = 0; i < txt.length; i++) h += '<span class="yi-l' + (i >= 5 ? ' v' : '') + '" style="--i:' + i + '">' + txt[i] + '</span>';
    h += '<div class="yi-sweep"></div></div></div><button type="button" class="yi-skip" aria-label="Skip intro">Skip</button>';
    ov.innerHTML = h;
    root.appendChild(ov);
    pt = document.createElement('div'); pt.className = 'yi-portal'; pt.setAttribute('aria-hidden', 'true'); pt.style.opacity = '0';
    pt.innerHTML = '<div class="yi-pt-fill"><i class="yi-pt-a"></i><i class="yi-pt-b"></i><i class="yi-pt-c"></i><i class="yi-pt-sh"></i></div><div class="yi-pt-ring"></div>';
    root.appendChild(pt);
    sp = document.createElement('div'); sp.className = 'yi-sparks'; sp.setAttribute('aria-hidden', 'true');
    var sh = ''; for (i = 0; i < 14; i++) sh += '<i></i>';
    sp.innerHTML = sh; root.appendChild(sp);
    ov.addEventListener('click', skip);
    ov.addEventListener('wheel', skip, { passive: true });
    ov.addEventListener('touchmove', skip, { passive: true });
    window.addEventListener('keydown', skip, true);
  }

  function run() {
    started = true;
    ov.style.animation = 'none'; root.style.animation = 'none'; // JS läuft: CSS-Sicherheitsnetz abschalten
    var word = ov.querySelector('.yi-word'), letters = ov.querySelectorAll('.yi-l');
    if (reduce) { setTimeout(function () { ov.style.transition = 'opacity .4s'; ov.style.opacity = '0'; setTimeout(done, 400); }, 600 * scale); return; }
    var O = letters[6]; // O in LOVESYOU
    var cx = 0, cy = 0, r0 = 20, measured = false, sparks = sp.children, fill = pt.firstChild, ring = pt.lastChild;
    function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
    function measure() {
      var wr = word.getBoundingClientRect(), fs = parseFloat(getComputedStyle(word).fontSize) || 100;
      var ox = O.offsetLeft + O.offsetWidth / 2, oy = O.offsetTop + O.offsetHeight / 2;
      cx = wr.left + ox; cy = wr.top + oy; r0 = fs * 0.24;
      word.style.transformOrigin = ox + 'px ' + oy + 'px';
      body.style.transformOrigin = cx + 'px ' + cy + 'px';
      body.style.willChange = 'transform,filter';
      measured = true;
    }
    var diag = Math.hypot(innerWidth, innerHeight);
    var last = performance.now(), t = 0;
    function frame(now) {
      if (finished) return;
      t += Math.min(0.05, (now - last) / 1000) * rate / scale; last = now;
      if (skipped && t < T_PULL) t = T_PULL;
      if (t >= T_PULL) {
        if (!measured) { measure(); root.classList.add('intro-portal'); }
        var p = Math.min(1, (t - T_PULL) / D_PULL), e = ease(p);
        var s = 1 + e * 11;
        var R = r0 * s * 0.9 + Math.pow(e, 3) * diag;
        word.style.transform = 'translateZ(' + (e * 250).toFixed(1) + 'px) scale(' + s.toFixed(3) + ')';
        word.style.opacity = (1 - Math.max(0, (e - 0.8) / 0.2)).toFixed(3);
        var mk = 'radial-gradient(circle at ' + cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px,transparent ' + R.toFixed(1) + 'px,#000 ' + (R + 1.5).toFixed(1) + 'px)';
        ov.style.webkitMaskImage = ov.style.maskImage = mk;
        var k = R / 100, fa = 1 - sm((e - 0.25) / 0.55), ra = 1 - sm((e - 0.75) / 0.25), fi = Math.min(1, p / 0.12);
        pt.style.transform = 'translate3d(' + (cx - 100).toFixed(1) + 'px,' + (cy - 100).toFixed(1) + 'px,0) scale(' + k.toFixed(4) + ')';
        pt.style.opacity = fi.toFixed(3); fill.style.opacity = fa.toFixed(3); ring.style.opacity = ra.toFixed(3);
        for (var j = 0; j < sparks.length; j++) {
          var f = (t * 0.7 + j / sparks.length) % 1, an = j * 2.399 + f * 1.8 + t * 0.5, rd = R * (1 - f * 0.92);
          sparks[j].style.transform = 'translate3d(' + (cx + Math.cos(an) * rd).toFixed(1) + 'px,' + (cy + Math.sin(an) * rd).toFixed(1) + 'px,0)';
          sparks[j].style.opacity = (Math.sin(Math.PI * f) * (0.25 + 0.75 * fa) * ra * fi).toFixed(3);
        }
        var pe = ease(Math.min(1, p * 1.05));
        body.style.transform = 'scale(' + (1.12 - 0.12 * pe).toFixed(4) + ')';
        body.style.filter = 'blur(' + (10 * (1 - pe)).toFixed(2) + 'px) brightness(' + (0.6 + 0.4 * pe).toFixed(3) + ')';
        if (p >= 1) { done(); return; }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(done, 7000); // Notbremse
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
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

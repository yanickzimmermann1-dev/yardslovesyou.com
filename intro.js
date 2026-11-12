/* intro.js – 3D-Intro: Wortmarke erscheint, Kamerafahrt durch das "O" (Portal im Innenraum des O) in die Seite. */
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('intro-on')) return;
  var T_PULL = 1.3, D_PULL = 1.1, TOTAL = T_PULL + D_PULL;
  var scale = 1;
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var ov, pt, fx, body, finished = false, started = false;
  var K = 120, TAU = Math.PI * 2;
  var dprC = Math.min(window.devicePixelRatio || 1, 2);

  function done() {
    if (finished) return; finished = true;
    try { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
    try { if (fx && fx.parentNode) fx.parentNode.removeChild(fx); } catch (e) {}
    try { body.style.cssText = body.getAttribute('data-yi-style') || ''; body.removeAttribute('data-yi-style'); } catch (e) {}
    root.classList.remove('intro-on', 'intro-portal');
    window.removeEventListener('keydown', skip, true);
    window.removeEventListener('resize', onResize);
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
  function sm(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  var rate = 1, skipped = false;
  function skip() { if (skipped) return; skipped = true; rate = 2.4; if (!started) return; try { ov.getAnimations({ subtree: true }).forEach(function (a) { a.finish(); }); } catch (e) {} }
  var onResize = function () {};

  /* ---------- Innenraum (Counter) des O exakt vermessen ---------- */
  // Rendert dasselbe "O" auf ein Offscreen-Canvas, scannt das Alpha vom Zentrum nach aussen (K Richtungen)
  // und liefert die Kontur des Innenraums relativ zur Span-Box des O (CSS px).
  function measureCounter(O) {
    var cs = getComputedStyle(O), fs = parseFloat(cs.fontSize) || 100;
    var S = 4, pad = Math.ceil(fs * 0.3), oh = O.offsetHeight || fs, probe, base;
    probe = document.createElement('i'); probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    O.appendChild(probe); base = probe.offsetTop - O.offsetTop; O.removeChild(probe);
    var cv = document.createElement('canvas'), c = cv.getContext('2d');
    c.font = cs.fontWeight + ' ' + (fs * S) + 'px ' + cs.fontFamily; c.textBaseline = 'alphabetic';
    var adv = c.measureText('O').width / S;
    var cw = Math.ceil((adv + 2 * pad) * S), ch = Math.ceil((oh + 2 * pad) * S);
    cv.width = cw; cv.height = ch;
    c.font = cs.fontWeight + ' ' + (fs * S) + 'px ' + cs.fontFamily; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff';
    c.fillText('O', pad * S, (pad + base) * S);
    var d = c.getImageData(0, 0, cw, ch).data;
    function g(a, b) { return (a < 0 || b < 0 || a >= cw || b >= ch) ? 0 : d[(b * cw + a) * 4 + 3] / 255; }
    function A(x, y) { var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      return (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy; }
    function ray(x, y, dx, dy) { var prev = A(x, y), r = 0.25, v, lim = Math.max(cw, ch);
      for (; r < lim; r += 0.25) { v = A(x + dx * r, y + dy * r); if (v >= 0.5) return r - 0.25 * (v - 0.5) / (v - prev); prev = v; }
      return -1; }
    var minx = cw, maxx = 0, miny = ch, maxy = 0, x, y;
    for (y = 0; y < ch; y++) for (x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 127) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    var gx = (minx + maxx) / 2, gy = (miny + maxy) / 2, ok = maxx > minx && A(gx, gy) < 0.5, i, a, b;
    if (ok) {
      for (i = 0; i < 4; i++) {
        a = ray(gx, gy, -1, 0); b = ray(gx, gy, 1, 0); if (a < 0 || b < 0) { ok = false; break; } gx += (b - a) / 2;
        a = ray(gx, gy, 0, -1); b = ray(gx, gy, 0, 1); if (a < 0 || b < 0) { ok = false; break; } gy += (b - a) / 2;
      }
    }
    var rho = [], k, th;
    if (ok) {
      for (k = 0; k < K; k++) { th = TAU * k / K; a = ray(gx, gy, Math.cos(th), Math.sin(th)); if (a < 0) { ok = false; break; } rho.push(a / S); }
    }
    var G = { adv: adv, oh: oh, rho: rho, ok: ok };
    if (ok) { G.cx = gx / S - pad; G.cy = gy / S - pad; }
    else { G.cx = adv / 2; G.cy = base - fs * 0.36; rho = []; for (k = 0; k < K; k++) { th = TAU * k / K; rho.push(1 / Math.sqrt(Math.pow(Math.cos(th) / (fs * 0.17), 2) + Math.pow(Math.sin(th) / (fs * 0.25), 2))); } G.rho = rho; }
    var mx = 0, my = 0;
    for (k = 0; k < K; k++) { th = TAU * k / K; mx = Math.max(mx, Math.abs(G.rho[k] * Math.cos(th))); my = Math.max(my, Math.abs(G.rho[k] * Math.sin(th))); }
    G.rx = mx; G.ry = my; G.rm = (mx + my) / 2; G.rmax = Math.max.apply(null, G.rho);
    return G;
  }
  // clip-path = exakte Kontur des Innenraums; o = Ueberlappung in CSS px (0.3 px + 0.6 Bildschirm-px, deckt Glyph-Pixel-Snapping ab, damit keine Fuge zwischen Buchstabe und Portal bleibt)
  function clipFor(G, o) {
    var pts = [], k, th, r;
    for (k = 0; k < K; k++) { th = TAU * k / K; r = G.rho[k] + o; pts.push((G.cx + r * Math.cos(th)).toFixed(3) + 'px ' + (G.cy + r * Math.sin(th)).toFixed(3) + 'px'); }
    return 'polygon(' + pts.join(',') + ')';
  }
  function rhoAt(G, th) { var f = ((th / TAU) % 1 + 1) % 1 * K, i = Math.floor(f), w = f - i; return G.rho[i % K] * (1 - w) + G.rho[(i + 1) % K] * w; }

  /* ---------- Portal-Canvas (Wirbel aus violetten Ringen) ---------- */
  var PCOL = ['#d47bff', '#b33cff', '#e04dff', '#8f1fe0'];
  function mixc(r) { // innen #5b1199 -> aussen #d47bff
    var a = [91, 17, 153], b = [212, 123, 255], t = Math.max(0, Math.min(1, r));
    return (a[0] + (b[0] - a[0]) * t | 0) + ',' + (a[1] + (b[1] - a[1]) * t | 0) + ',' + (a[2] + (b[2] - a[2]) * t | 0);
  }
  function contour(c, G, r, tau, amp, ph) {
    var k, th, m, x, y;
    c.beginPath();
    for (k = 0; k < K; k++) {
      th = TAU * k / K; m = r * (1 + amp * r * Math.sin(3 * th + ph + r * 7 + tau * 2.2) + amp * 0.5 * r * Math.sin(5 * th - tau * 1.4));
      x = G.cx + m * G.rho[k] * Math.cos(th); y = G.cy + m * G.rho[k] * Math.sin(th);
      if (k) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.closePath();
  }
  function drawPortal(c, G, tau, particles) {
    var rm = G.rm, R0 = G.rmax * 1.05, i, k, gr;
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, G.adv, G.oh);
    gr = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, R0);
    gr.addColorStop(0, '#2a0845'); gr.addColorStop(0.4, '#3c0c68'); gr.addColorStop(0.8, '#5b1199'); gr.addColorStop(1, '#6d14b8');
    c.fillStyle = gr; c.fillRect(0, 0, G.adv, G.oh);
    c.globalCompositeOperation = 'lighter'; c.lineJoin = 'round'; c.lineCap = 'round';
    var N = 12, ph = (tau * 0.5) % 1;
    for (i = 0; i < N; i++) {
      var r = 1 - (i + ph) / N; if (r < 0.03) continue;
      var al = 0.3 + 0.38 * r * r, col = mixc(r * 0.8 + 0.25);
      contour(c, G, r, tau, 0.06, i);
      c.lineWidth = rm * (0.08 + 0.08 * r); c.strokeStyle = 'rgba(' + col + ',' + (al * 0.35).toFixed(3) + ')'; c.stroke();
      c.lineWidth = rm * (0.025 + 0.03 * r); c.strokeStyle = 'rgba(' + col + ',' + al.toFixed(3) + ')'; c.stroke();
    }
    var arm, u, th, rr, ang;
    for (arm = 0; arm < 3; arm++) {
      for (var pass = 0; pass < 2; pass++) {
        c.beginPath();
        for (u = 0.06; u <= 1.001; u += 1 / 22) {
          ang = arm * TAU / 3 + tau * 1.1 + u * 5.5; rr = u * rhoAt(G, ang);
          var x = G.cx + rr * Math.cos(ang), y = G.cy + rr * Math.sin(ang);
          if (u < 0.07) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.lineWidth = pass ? rm * 0.025 : rm * 0.11;
        c.strokeStyle = pass ? 'rgba(224,77,255,.35)' : 'rgba(143,31,224,.22)'; c.stroke();
      }
    }
    c.globalCompositeOperation = 'source-over';
    gr = c.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, rm * 0.16);
    gr.addColorStop(0, 'rgba(22,3,40,.9)'); gr.addColorStop(0.6, 'rgba(36,6,62,.5)'); gr.addColorStop(1, 'rgba(42,8,69,0)');
    c.fillStyle = gr; c.fillRect(0, 0, G.adv, G.oh);
    c.globalCompositeOperation = 'lighter';
    if (particles) {
      for (i = 0; i < 28; i++) {
        var uu = (((i * 0.6180339) % 1) + tau * (0.12 + (i % 5) * 0.03)) % 1, pr = 1 - uu * 0.93;
        ang = i * 2.399 + tau * (0.8 + (i % 3) * 0.3) + (1 - pr) * 3.2;
        var pxx = G.cx + pr * 0.96 * rhoAt(G, ang) * Math.cos(ang), pyy = G.cy + pr * 0.96 * rhoAt(G, ang) * Math.sin(ang);
        c.fillStyle = 'rgba(' + [ '212,123,255', '179,60,255', '224,77,255', '212,123,255' ][i % 4] + ',' + (Math.sin(Math.PI * uu) * 0.9).toFixed(3) + ')';
        c.beginPath(); c.arc(pxx, pyy, Math.max(0.35, rm * (0.012 + (i % 4) * 0.005) * (0.5 + pr)), 0, TAU); c.fill();
      }
    }
    // Neon-Rand und Glut am Innenrand
    gr = c.createRadialGradient(G.cx, G.cy, R0 * 0.6, G.cx, G.cy, R0);
    gr.addColorStop(0, 'rgba(179,60,255,0)'); gr.addColorStop(1, 'rgba(179,60,255,.22)');
    c.fillStyle = gr; c.fillRect(0, 0, G.adv, G.oh);
    contour(c, G, 0.9, tau, 0, 0); c.lineWidth = rm * 0.14; c.strokeStyle = 'rgba(143,31,224,.3)'; c.stroke();
    contour(c, G, 0.955, tau, 0, 0); c.lineWidth = rm * 0.06; c.strokeStyle = 'rgba(190,80,255,.8)'; c.stroke();
    contour(c, G, 0.915, tau, 0, 0); c.lineWidth = rm * 0.02; c.strokeStyle = 'rgba(224,77,255,.45)'; c.stroke();
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
    fx = document.createElement('canvas'); fx.className = 'yi-fx'; fx.setAttribute('aria-hidden', 'true');
    root.appendChild(fx);
    ov.addEventListener('click', skip);
    ov.addEventListener('wheel', skip, { passive: true });
    ov.addEventListener('touchmove', skip, { passive: true });
    window.addEventListener('keydown', skip, true);
  }

  function run() {
    started = true;
    ov.style.animation = 'none'; root.style.animation = 'none'; // JS läuft: CSS-Sicherheitsnetz abschalten
    var word = ov.querySelector('.yi-word'), letters = ov.querySelectorAll('.yi-l');
    var O = letters[6]; // O in LOVESYOU
    var G = null, cv = null, pc = null, curQ = 0;
    pt = document.createElement('div'); pt.className = 'yi-portal'; pt.style.opacity = '0';
    cv = document.createElement('canvas'); pt.appendChild(cv); O.appendChild(pt);
    pc = cv.getContext('2d');
    var clipS = 0;
    function setClip(sc) { if (clipS && Math.abs(sc / clipS - 1) < 0.02) return; clipS = sc; pt.style.webkitClipPath = pt.style.clipPath = clipFor(G, 0.3 + 0.6 / sc); }
    function geom() {
      try { G = measureCounter(O); } catch (e) { G = null; }
      if (!G) return false;
      pt.style.width = G.adv + 'px'; pt.style.height = G.oh + 'px'; clipS = 0;
      setClip(1); curQ = 0; return true;
    }
    function sizeCanvas(sNow) {
      var q = Math.min(dprC * Math.max(1, sNow), 900 / Math.max(G.adv, G.oh));
      if (curQ && Math.abs(q / curQ - 1) < 0.25) return;
      curQ = q; cv.width = Math.max(2, Math.round(G.adv * q)); cv.height = Math.max(2, Math.round(G.oh * q));
      pc.setTransform(cv.width / G.adv, 0, 0, cv.height / G.oh, 0, 0);
    }
    if (!geom()) { setTimeout(done, 300); return; }
    onResize = function () { if (!reduce && t >= T_PULL) return; if (geom()) { sizeCanvas(1); if (reduce) { drawPortal(pc, G, 1.3, false); } } };
    window.addEventListener('resize', onResize);
    var t = 0;
    if (reduce) {
      sizeCanvas(1); drawPortal(pc, G, 1.3, false); pt.style.opacity = '1';
      setTimeout(function () { ov.style.transition = 'opacity .4s'; ov.style.opacity = '0'; setTimeout(done, 400); }, 600 * scale);
      return;
    }
    var dpr = dprC, fctx = fx.getContext('2d'), fs = parseFloat(getComputedStyle(word).fontSize) || 100;
    function sizeFx() { fx.width = Math.round(innerWidth * dpr); fx.height = Math.round(innerHeight * dpr); }
    sizeFx();
    var prepped = false, C0x = 0, C0y = 0, Vx = 0, Vy = 0, lnSf = 1, diag = Math.hypot(innerWidth, innerHeight);
    function prep() {
      try { ov.getAnimations({ subtree: true }).forEach(function (a) { a.finish(); }); } catch (e) {}
      sizeFx(); diag = Math.hypot(innerWidth, innerHeight);
      var wr = word.getBoundingClientRect(), wcx = O.offsetLeft + G.cx, wcy = O.offsetTop + G.cy;
      C0x = wr.left + wcx; C0y = wr.top + wcy; Vx = innerWidth / 2; Vy = innerHeight / 2;
      var hw = innerWidth / 2, hh = innerHeight / 2, k, th, b, need = 1;
      for (k = 0; k < K; k++) { th = TAU * k / K; b = Math.min(hw / Math.max(1e-6, Math.abs(Math.cos(th))), hh / Math.max(1e-6, Math.abs(Math.sin(th)))); need = Math.max(need, b / G.rho[k]); }
      lnSf = Math.log(need * 1.04);
      word.style.transformOrigin = wcx + 'px ' + wcy + 'px'; word.style.transformStyle = 'flat'; word.style.willChange = 'auto';
      body.style.transformOrigin = Vx + 'px ' + Vy + 'px'; body.style.willChange = 'transform,filter';
      for (k = 0; k < letters.length; k++) { letters[k].style.animation = 'none'; letters[k].style.opacity = '1'; letters[k].style.filter = 'none'; }
      root.classList.add('intro-portal'); prepped = true;
    }
    var drops = [], j;
    for (j = 0; j < 12; j++) drops.push({ a: j * 2.399 + 0.4, life: 0.9 + (j % 4) * 0.15, tb: 0.85 + j * 0.07, sp: fs * (0.9 + (j % 3) * 0.35), r: Math.max(1.5, fs * (0.02 + (j % 3) * 0.008)), col: PCOL[j % 4] });
    function drawFx(Cx, Cy, sNow, hole, q) {
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.clearRect(0, 0, innerWidth, innerHeight);
      fctx.globalCompositeOperation = 'lighter';
      var fade = 1 - sm((t - T_PULL - 0.25) / 0.55), d, f, age, ang, ux, uy, dist, hx, hy, L, col, al;
      if (fade > 0.01) {
        for (j = 0; j < drops.length; j++) {
          d = drops[j]; age = t - d.tb; if (age < 0) continue; age = age % d.life; f = age / d.life;
          ang = d.a + 0.35 * f; ux = Math.cos(ang); uy = Math.sin(ang);
          dist = d.sp * age; hx = Cx + ux * (G.adv * 0.5 * sNow + dist); hy = Cy + uy * (G.oh * 0.36 * sNow + dist);
          al = Math.pow(Math.sin(Math.PI * f), 0.8) * 0.95 * fade; if (al < 0.02) continue;
          L = d.r * 4.2 * (1 - f * 0.5);
          fctx.fillStyle = d.col; fctx.globalAlpha = al * 0.22; fctx.beginPath(); fctx.arc(hx, hy, d.r * 2.6, 0, TAU); fctx.fill();
          fctx.globalAlpha = al; fctx.beginPath(); fctx.arc(hx, hy, d.r, ang - Math.PI / 2, ang + Math.PI / 2, false);
          fctx.lineTo(hx - ux * L, hy - uy * L); fctx.closePath(); fctx.fill();
        }
      }
      fctx.globalAlpha = 1;
      if (q > 0 && q < 1) { // Ringe expandieren ueber die Raender und verblassen
        var front = hole + 6, i, ra = 1 - sm(q * 1.05);
        fctx.lineWidth = 3; fctx.shadowColor = '#b33cff'; fctx.shadowBlur = 16;
        for (i = 0; i < 4; i++) {
          fctx.strokeStyle = i ? 'rgba(179,60,255,' + (0.7 * ra - i * 0.1).toFixed(3) + ')' : 'rgba(212,123,255,' + (0.95 * ra).toFixed(3) + ')';
          fctx.beginPath(); fctx.arc(Vx, Vy, Math.max(0.5, front * (1 - i * 0.12) + i * 0), 0, TAU); fctx.stroke();
        }
        fctx.shadowBlur = 0;
      }
      fctx.globalCompositeOperation = 'source-over';
    }
    var last = performance.now();
    function frame(now) {
      if (finished) return;
      t += Math.min(0.05, (now - last) / 1000) * rate / scale; last = now;
      if (skipped && t < T_PULL) t = T_PULL;
      if (t >= T_PULL && !prepped) prep();
      var s = 1, m = 0, q = 0, hole = 0, p = 0;
      if (t >= T_PULL) {
        p = Math.min(1, (t - T_PULL) / D_PULL);
        var p0 = 0.78, e = ease(Math.min(1, p / p0)); s = Math.exp(lnSf * e); m = e; q = Math.max(0, (p - p0) / (1 - p0));
        word.style.transform = 'translate(' + (m * (Vx - C0x)).toFixed(2) + 'px,' + (m * (Vy - C0y)).toFixed(2) + 'px) scale(' + s.toFixed(4) + ')';
        if (q > 0) {
          hole = Math.pow(sm(q), 1.4) * diag * 0.56;
          ov.style.webkitMaskImage = ov.style.maskImage = 'radial-gradient(circle at ' + Vx.toFixed(1) + 'px ' + Vy.toFixed(1) + 'px,transparent ' + hole.toFixed(1) + 'px,#000 ' + (hole + 2).toFixed(1) + 'px)';
        }
        var pe = sm(q);
        body.style.transform = 'scale(' + (1.12 - 0.12 * pe).toFixed(4) + ')';
        body.style.filter = 'blur(' + (10 * (1 - pe)).toFixed(2) + 'px) brightness(' + (0.6 + 0.4 * pe).toFixed(3) + ')';
      }
      pt.style.opacity = sm((t - 0.8) / 0.3).toFixed(3);
      setClip(s); sizeCanvas(s); drawPortal(pc, G, t, true);
      var Cx = C0x + m * (Vx - C0x), Cy = C0y + m * (Vy - C0y);
      if (!prepped) { var wr = word.getBoundingClientRect(); Cx = wr.left + O.offsetLeft + G.cx; Cy = wr.top + O.offsetTop + G.cy; }
      drawFx(Cx, Cy, s, hole, q);
      if (p >= 1) { done(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(done, 7000 * scale); // Notbremse
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

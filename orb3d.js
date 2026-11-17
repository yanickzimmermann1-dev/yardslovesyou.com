/* orb3d.js - "Orb": schwebende Materie als interaktives 3D-Produktmodell (Canvas 2D, keine Bibliothek).
   Wird von Product3D.mount() aufgerufen, wenn model3d.type === "orb". Gleiche API: {destroy, show, hide, ready}.
   model3d (alle Felder ausser type optional, so laesst sich jedes Produkt anders einfaerben):
     { type:"orb", seed:1, count:1000, puffs:14, palette:["#ffffff","#e8dcff","#b68aff","#8fd8ff"],
       glow:"157,123,255", rings:2, notes:40, ring_color:"#ffffff", spin:1 }
   count 200..2000 Teilchen, puffs 4..30 Wolken, rings 0..4 Ringe aus MIDI-Noten, notes 8..80 pro Ring, spin = Drehtempo (0 = steht). */
(function () {
  "use strict";
  var TAU = Math.PI * 2;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var num = function (v, d, a, b) { v = Number(v); return isFinite(v) ? clamp(v, a, b) : d; };

  function rng(seed) { // mulberry32
    var a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gauss(r) { var u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  function hex(c, d) { return /^#[0-9a-f]{6}$/i.test(String(c)) ? c : d; }
  function rgbOf(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

  function sprite(rgb) { // weicher Punkt, einmal pro Farbe
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    var s = rgb[0] + "," + rgb[1] + "," + rgb[2];
    g.addColorStop(0, "rgba(" + s + ",1)"); g.addColorStop(0.3, "rgba(" + s + ",.78)"); g.addColorStop(0.66, "rgba(" + s + ",.22)"); g.addColorStop(1, "rgba(" + s + ",0)");
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return c;
  }

  function build(model, small) {
    var r = rng(num(model.seed, 1, 0, 99999));
    var pal = (Array.isArray(model.palette) && model.palette.length ? model.palette : ["#ffffff", "#e8dcff", "#b68aff", "#8fd8ff"]).slice(0, 6).map(function (c) { return hex(c, "#ffffff"); });
    var n = Math.round(num(model.count, 1000, 200, 2000) * (small ? 0.55 : 1));
    var puffs = Math.round(num(model.puffs, 14, 4, 30));
    var centers = [];
    for (var i = 0; i < puffs; i++) { // Wolkenkerne gleichmaessig auf einer Kugel (Fibonacci)
      var y = 1 - (i + 0.5) * 2 / puffs, rad = Math.sqrt(1 - y * y), th = i * 2.399963 + r() * 0.4;
      var k = 0.42 + r() * 0.18;
      centers.push([Math.cos(th) * rad * k, y * k, Math.sin(th) * rad * k, 0.12 + r() * 0.09,
        0.05 + r() * 0.08, 0.05 + r() * 0.08, 0.05 + r() * 0.08,            /* Schwebe-Amplitude x,y,z */
        0.00035 + r() * 0.00055, 0.00035 + r() * 0.00055, 0.00035 + r() * 0.00055, /* Frequenzen (rad/ms) */
        r() * TAU, 0.6 + r() * 0.8]);                                       /* Phase, Wirbel-Tempo */
    }
    var P = []; // x,y,z (Einheitskugel), Groesse, Farbindex, Phase, Helligkeit
    for (var j = 0; j < n; j++) {
      var x, yy, z, size, pf = -1, haze = r() < 0.14;
      if (haze) { var d = [gauss(r), gauss(r), gauss(r)], l = Math.hypot(d[0], d[1], d[2]) || 1, rr = 0.55 + r() * 0.35; x = d[0] / l * rr; yy = d[1] / l * rr; z = d[2] / l * rr; size = 0.35 + r() * 0.5; }
      else { pf = Math.floor(r() * puffs); var c = centers[pf]; x = clamp(gauss(r), -1.6, 1.6) * c[3]; yy = clamp(gauss(r), -1.6, 1.6) * c[3]; z = clamp(gauss(r), -1.6, 1.6) * c[3]; size = 0.6 + r() * 1.1; }
      var ci = clamp(Math.floor((((pf >= 0 ? centers[pf][1] + yy : yy) + 1) / 2 + (r() - 0.5) * 0.5) * pal.length), 0, pal.length - 1);
      P.push([x, yy, z, size, ci, r() * TAU, 0.35 + r() * 0.65, pf]);
    }
    var rings = Math.round(num(model.rings, 2, 0, 4)), notes = Math.round(num(model.notes, 40, 8, 80) * (small ? 0.6 : 1)), R = [];
    for (var q = 0; q < rings; q++) {
      var rr2 = 1.05 + q * 0.12, tilt = (q % 2 ? 1 : -1) * (0.35 + q * 0.18), roll = q * 1.1 + r();
      for (var m = 0; m < notes; m++) R.push([m / notes * TAU + r() * 0.05, rr2, tilt, roll, 0.06 + r() * 0.16, 0.5 + r() * 0.5]);
    }
    var ringMax = rings ? 1.05 + (rings - 1) * 0.12 : 0;
    return { ext: Math.max(1.2, ringMax * 1.18) + 0.14, P: P, C: centers, R: R, pal: pal, sprites: pal.map(function (h) { return sprite(rgbOf(h)); }, null), ring: hex(model.ring_color, "#ffffff"), glow: /^\d{1,3},\d{1,3},\d{1,3}$/.test(String(model.glow)) ? String(model.glow) : "157,123,255", spin: num(model.spin, 1, 0, 3) };
  }

  function mount(el, model, opts) {
    opts = opts || {};
    var noop = { destroy: function () {}, show: function () {}, hide: function () {}, ready: Promise.resolve(false) };
    if (typeof model === "string") { try { model = JSON.parse(model); } catch (e) { model = null; } }
    if (!el || !model || model.type !== "orb" || !window.CanvasRenderingContext2D) { if (opts.onfail) try { opts.onfail(); } catch (e) {} return noop; }
    var small = opts.size === "small", still = !!opts.still;
    var reduce = false; try { reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
    if (getComputedStyle(el).position === "static") el.style.position = "relative";

    var stage = document.createElement("div");
    stage.className = "p3d p3d-orb " + (small ? "p3d-small" : "p3d-large");
    if (!small) { stage.tabIndex = 0; stage.setAttribute("role", "img"); stage.setAttribute("aria-label", opts.alt || "3D product model"); } else stage.setAttribute("aria-hidden", "true");
    var cv = document.createElement("canvas"); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    stage.appendChild(cv); el.appendChild(stage);
    var ctx = cv.getContext("2d");
    var S = build(model, small), W = 0, H = 0, dpr = 1;
    var st = { yaw: 0.5, pitch: -0.18, vy: 0, vp: 0, drag: false, lx: 0, ly: 0, last: 0, t0: performance.now(), visible: false, hidden: false, dead: false, idleAt: 0 };
    var raf = 0, io = null, ro = null;

    function size() {
      var w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return false;
      dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); W = w; H = h; return true;
    }
    var order = [], zs = new Float32Array(S.P.length), xs = new Float32Array(S.P.length), ys = new Float32Array(S.P.length);
    for (var oi = 0; oi < S.P.length; oi++) order.push(oi);
    function draw(t) {
      if (!W) return;
      var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.44 / S.ext, f = R * 3.2; /* alles passt mit Rand in die Flaeche, nichts wird abgeschnitten */
      var cyw = Math.cos(st.yaw), syw = Math.sin(st.yaw), cp = Math.cos(st.pitch), sp = Math.sin(st.pitch);
      var breathe = 1 + Math.sin(t / 1900) * 0.03;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over"; /* kein Hintergrund, kein Leuchten: alles ausser den Teilchen bleibt transparent */
      var lim = Math.min(W, H) * 0.485; /* harte Grenze: nichts reicht bis an den Rand */
      var i, p, x, y, z, x1, z1, y2, z2, k, s, a;
      // Wolken: weiche Teilchen, hinten nach vorn (echte Tiefe, keine Ueberbelichtung)
      var C = S.C, pc = [], j, c2, ang2, ca, sa, pulse;
      for (j = 0; j < C.length; j++) { // Wolkenballen schweben, kreisen und atmen (lebendige Materie)
        c2 = C[j];
        var bx = c2[0] + c2[4] * Math.sin(t * c2[7] + c2[10]), by = c2[1] + c2[5] * Math.sin(t * c2[8] + c2[10] * 1.7), bz = c2[2] + c2[6] * Math.sin(t * c2[9] + c2[10] * 2.3);
        ang2 = t * 0.00016 * c2[11] * (S.spin || 1) * (reduce ? 0 : 1); ca = Math.cos(ang2); sa = Math.sin(ang2);
        pc.push([bx * ca + bz * sa, by, -bx * sa + bz * ca, 1 + 0.13 * Math.sin(t / 820 + c2[10]), ca, sa]);
      }
      var hang = t * 0.00011 * (reduce ? 0 : 1), hc = Math.cos(hang), hs = Math.sin(hang);
      for (i = 0; i < S.P.length; i++) {
        p = S.P[i];
        var wob = Math.sin(t / 1100 + p[5]) * 0.024 * (reduce ? 0 : 1);
        if (p[7] >= 0) { var q2 = pc[p[7]]; x = q2[0] + (p[0] * q2[4] + p[2] * q2[5]) * q2[3]; y = q2[1] + p[1] * q2[3]; z = q2[2] + (-p[0] * q2[5] + p[2] * q2[4]) * q2[3]; }
        else { x = p[0] * hc + p[2] * hs; y = p[1]; z = -p[0] * hs + p[2] * hc; }
        var ln = Math.sqrt(x * x + y * y + z * z); if (ln > 1) { var sc = (1 + (ln - 1) * 0.3) / ln; x *= sc; y *= sc; z *= sc; } /* weiche Grenze: bleibt nah am Orb */
        x = (x + wob) * R * breathe; y = (y + wob * 0.6) * R * breathe; z = (z - wob) * R * breathe;
        x1 = x * cyw + z * syw; z1 = -x * syw + z * cyw;
        y2 = y * cp - z1 * sp; z2 = y * sp + z1 * cp;
        xs[i] = x1; ys[i] = y2; zs[i] = z2;
      }
      order.sort(function (m, n) { return zs[n] - zs[m]; });
      for (i = 0; i < order.length; i++) {
        var q = order[i]; p = S.P[q]; z2 = zs[q];
        k = f / (f + z2); s = p[3] * R * 0.1 * k;
        a = clamp((0.42 + 0.5 * p[6]) * (0.45 + 0.55 * (z2 / R + 1) / 2) * (reduce ? 1 : 0.86 + 0.14 * Math.sin(t / 520 + p[5] * 3)), 0.1, 0.95);
        ctx.globalAlpha = a;
        var px = xs[q] * k, py = ys[q] * k, dd = Math.sqrt(px * px + py * py), mx = lim - s, soft = mx * 0.86;
        if (dd > soft) { var d2 = Math.min(soft + (dd - soft) * 0.3, mx); px *= d2 / dd; py *= d2 / dd; }
        ctx.drawImage(S.sprites[p[4]], cx + px - s, cy + py - s, s * 2, s * 2);
      }
      // MIDI-Noten: kurze Striche, die tangential auf Ringen kreisen
      if (S.R.length) {
        ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = S.ring; ctx.lineCap = "round";
        var pos = function (ang, rr, tilt, roll) {
          var rx = Math.cos(ang) * rr * R, rz = Math.sin(ang) * rr * R;
          var ry = rz * Math.sin(tilt); rz = rz * Math.cos(tilt);
          var xr = rx * Math.cos(roll) - ry * Math.sin(roll), yr = rx * Math.sin(roll) + ry * Math.cos(roll);
          var a1 = xr * cyw + rz * syw, b1 = -xr * syw + rz * cyw;
          var a2 = yr * cp - b1 * sp, b2 = yr * sp + b1 * cp, kk = f / (f + b2);
          var sx = a1 * kk, sy = a2 * kk, d3 = Math.sqrt(sx * sx + sy * sy), m3 = lim - 3;
          if (d3 > m3) { sx *= m3 / d3; sy *= m3 / d3; }
          return [cx + sx, cy + sy, b2, kk];
        };
        for (i = 0; i < S.R.length; i++) {
          p = S.R[i];
          var ang = p[0] + t / 9000 * (1 + p[1] * 0.2) * (S.spin || 1), dl = p[4] * 0.5 / p[1] * (reduce ? 1 : 1 + 0.4 * Math.sin(t / 700 + p[0] * 3));
          var A = pos(ang - dl, p[1], p[2], p[3]), B = pos(ang + dl, p[1], p[2], p[3]);
          ctx.globalAlpha = clamp(0.12 + 0.5 * p[5] * (A[2] / R + 1.4) / 2.4, 0.06, 0.75);
          ctx.lineWidth = Math.max(1, R * 0.016 * A[3]);
          ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    function active() { return !still && st.visible && !st.hidden && !st.dead && !document.hidden; }
    function loop(now) {
      raf = 0;
      var dt = Math.min(0.05, Math.max(0, (now - st.last) / 1000)); st.last = now;
      if (!st.drag) {
        var idle = (now - st.idleAt) > 1500;
        var base = (reduce || !S.spin) ? 0 : (small ? 0.16 : 0.3) * S.spin;
        st.yaw += (st.vy + (idle ? base : 0)) * dt; st.pitch = clamp(st.pitch + st.vp * dt, -0.9, 0.9);
        st.vy *= Math.pow(0.04, dt); st.vp *= Math.pow(0.04, dt);
        if (idle) st.pitch += ((-0.18 + (reduce ? 0 : 0.14 * Math.sin(now / 4300))) - st.pitch) * Math.min(1, dt * 1.2);
      }
      draw(now);
      if (active()) raf = requestAnimationFrame(loop);
    }
    function wake() { if (!raf && active()) { st.last = performance.now(); raf = requestAnimationFrame(loop); } }

    function down(e) { st.drag = true; st.lx = e.clientX; st.ly = e.clientY; st.vy = st.vp = 0; stage.classList.add("p3d-drag"); try { stage.setPointerCapture(e.pointerId); } catch (x) {} }
    function move(e) {
      if (!st.drag) return;
      var dx = e.clientX - st.lx, dy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY;
      st.yaw += dx * 0.011; st.vy = dx * 0.011 * 60 * 0.5;
      if (e.pointerType !== "touch") { st.pitch = clamp(st.pitch + dy * 0.008, -0.9, 0.9); st.vp = dy * 0.008 * 60 * 0.4; }
      st.idleAt = performance.now(); if (!raf) draw(performance.now());
    }
    function up() { st.drag = false; stage.classList.remove("p3d-drag"); st.idleAt = performance.now(); wake(); }
    function key(e) {
      var d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0; if (!d) return;
      e.preventDefault(); st.vy += d * 2.2; st.idleAt = performance.now(); wake();
    }
    if (!small && !still) {
      stage.addEventListener("pointerdown", down); stage.addEventListener("pointermove", move);
      stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up); stage.addEventListener("keydown", key);
    }
    var onVis = function () { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else wake(); };
    document.addEventListener("visibilitychange", onVis);
    if ("IntersectionObserver" in window) { io = new IntersectionObserver(function (en) { st.visible = !!en[0].isIntersecting; if (st.visible) { if (!W) size(); wake(); } }, { rootMargin: "80px" }); io.observe(stage); } else st.visible = true;
    if ("ResizeObserver" in window) { ro = new ResizeObserver(function () { if (size()) { draw(performance.now()); wake(); } }); ro.observe(stage); }

    var readyP = new Promise(function (res) {
      requestAnimationFrame(function () {
        if (st.dead) return res(false);
        size(); draw(performance.now());
        stage.classList.add("p3d-ready"); el.classList.add("p3d-on", "has-p3d");
        if (opts.onready) try { opts.onready(); } catch (e) {}
        wake(); res(true);
      });
    });
    return {
      ready: readyP,
      destroy: function () {
        st.dead = true; if (raf) cancelAnimationFrame(raf); raf = 0;
        document.removeEventListener("visibilitychange", onVis);
        if (io) io.disconnect(); if (ro) ro.disconnect();
        el.classList.remove("p3d-on", "has-p3d"); if (stage.parentNode) stage.parentNode.removeChild(stage);
      },
      hide: function () { st.hidden = true; stage.hidden = true; el.classList.remove("p3d-on", "has-p3d"); },
      show: function () { st.hidden = false; stage.hidden = false; el.classList.add("p3d-on", "has-p3d"); requestAnimationFrame(function () { if (size()) draw(performance.now()); wake(); }); }
    };
  }
  window.Orb3D = { mount: mount };
})();

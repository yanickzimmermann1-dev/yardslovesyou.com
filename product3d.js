/* product3d.js – interaktive 360°-Produktmodelle (reines CSS 3D + JS, keine Bibliothek)
   API: Product3D.mount(el, model3d, {size:'large'|'small', alt, onready, onfail}) -> {destroy, show, hide, ready}
   model3d: {type:'book', front, spine?, back_color, thickness} | {type:'card', front}                          */
(function () {
  "use strict";
  var D2R = Math.PI / 180;
  var REST_PITCH = -8, IDLE_V = 360 / 22, RESUME_MS = 1500;
  var LIGHT = [-0.42, -0.5, 0.76], HALF = [-0.225, -0.27, 0.94];
  var NS = { supported: false };

  try {
    NS.supported = !!(window.CSS && CSS.supports && CSS.supports("transform-style", "preserve-3d")) && "IntersectionObserver" in window;
  } catch (e) { NS.supported = false; }

  /* ---------- Texturen (einmal laden, gemeinsam nutzen) ---------- */
  var texCache = {};
  function loadTex(url) {
    if (!url) return Promise.resolve(null);
    if (texCache[url]) return texCache[url];
    texCache[url] = new Promise(function (res, rej) {
      var i = new Image();
      i.decoding = "async";
      i.onload = function () { res(i); };
      i.onerror = function () { delete texCache[url]; rej(new Error("texture")); };
      i.src = url;
    });
    return texCache[url];
  }
  var cssUrl = function (u) { return 'url("' + String(u).replace(/["\\\n\r()]/g, encodeURIComponent) + '")'; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var f2 = function (n) { return (Math.round(n * 100) / 100).toString(); };

  /* Farben vom Rand der Front-Textur (fuer Ruecken/Buchruecken, falls nicht angegeben) */
  function sampleEdges(img) {
    try {
      var c = document.createElement("canvas"); c.width = 40; c.height = 60;
      var x = c.getContext("2d",{willReadFrequently:true}); x.drawImage(img, 0, 0, 40, 60);
      var avg = function (x0, y0, w, h) {
        var d = x.getImageData(x0, y0, w, h).data, r = 0, g = 0, b = 0, n = d.length / 4;
        for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
      };
      return { top: avg(3, 0, 2, 4), mid: avg(3, 28, 2, 4), bot: avg(3, 56, 2, 4), right: avg(36, 28, 3, 4) };
    } catch (e) { return null; }
  }
  var rgb = function (c, k) { k = k || 1; return "rgb(" + Math.round(c[0] * k) + "," + Math.round(c[1] * k) + "," + Math.round(c[2] * k) + ")"; };

  /* ---------- gemeinsame Maus-Position + gemeinsame Render-Schleife ---------- */
  var mouse = { x: 0, y: 0, ok: false };
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") { mouse.ok = false; return; }
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.ok = true;
  }, { passive: true });
  window.addEventListener("pointerdown", function (e) { if (e.pointerType === "touch") mouse.ok = false; }, { passive: true });
  document.documentElement.addEventListener("mouseleave", function () { mouse.ok = false; });

  var insts = [], raf = 0, last = 0;
  function frame(t) {
    raf = 0;
    var dt = Math.min(0.05, Math.max(0, (t - last) / 1000)); last = t;
    var any = false;
    for (var i = 0; i < insts.length; i++) if (insts[i].active()) { insts[i].tick(dt, t); any = true; }
    if (any && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (raf || document.hidden) return;
    for (var i = 0; i < insts.length; i++) if (insts[i].active()) { last = performance.now(); raf = requestAnimationFrame(frame); return; }
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; } else wake(); });

  /* ---------- Modell ---------- */
  function mount(el, model, opts) {
    opts = opts || {};
    var noop = { destroy: function () {}, show: function () {}, hide: function () {}, ready: Promise.resolve(false) };
    var small = opts.size === "small";
    if (typeof model === "string") { try { model = JSON.parse(model); } catch (e) { model = null; } }
    if (!el || !model || !model.front || (model.type !== "book" && model.type !== "card") || !NS.supported) {
      if (opts.onfail) try { opts.onfail(); } catch (e) {}
      return noop;
    }
    var isBook = model.type === "book";
    var reduce = false;
    try { reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}

    var cs = getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";

    var stage = document.createElement("div");
    stage.className = "p3d " + (small ? "p3d-small" : "p3d-large");
    if (!small) {
      stage.tabIndex = 0;
      stage.setAttribute("role", "img");
      stage.setAttribute("aria-label", opts.alt || "3D product model");
    } else {
      stage.setAttribute("aria-hidden", "true");
    }
    stage.innerHTML = '<div class="p3d-glow"></div><div class="p3d-shadow"></div><div class="p3d-scene"><div class="p3d-obj"></div></div>';
    el.appendChild(stage);
    var scene = stage.querySelector(".p3d-scene"), obj = stage.querySelector(".p3d-obj"), shadow = stage.querySelector(".p3d-shadow");

    var S = {
      yaw: isBook ? -28 : -24, pitch: REST_PITCH, v: 0,
      lastInteract: -1e9, following: false, base: 0,
      dragging: false, keyRemain: 0, hover: false,
      ready: false, hidden: false, visible: false, destroyed: false,
      W: 0, H: 0, w: 0, h: 0, d: 0
    };
    var faces = [], edgeLayers = [], tex = null, edges = null, built = false;
    var hoverEl = small ? (el.closest && el.closest(".product")) || el : null;

    var inst = {
      active: function () { return S.ready && S.visible && !S.hidden && !S.destroyed && built && !document.hidden; },
      tick: tick
    };

    /* ----- Aufbau der Flaechen ----- */
    function face(cls, fw, fh, tf, n) {
      var e = document.createElement("div"); e.className = "p3d-f " + cls;
      var s = e.style;
      s.width = f2(fw) + "px"; s.height = f2(fh) + "px";
      s.marginLeft = f2(-fw / 2) + "px"; s.marginTop = f2(-fh / 2) + "px";
      s.transform = tf;
      obj.appendChild(e);
      var f = { el: e, n: n, sh: null, sheen: null, dark: -1, sp: -1, sx: -1 };
      faces.push(f);
      return f;
    }
    function lit(f, sheen) {
      f.sh = document.createElement("i"); f.sh.className = "p3d-sh"; f.el.appendChild(f.sh);
      if (sheen) { f.sheen = document.createElement("i"); f.sheen.className = "p3d-sheen"; f.el.appendChild(f.sheen); }
    }

    function buildBook(w, h, d) {
      var u = w / 100, r = Math.max(2.5, w * 0.022), t = 2, cb = 1.8;
      obj.style.setProperty("--u", f2(u) + "px");
      var back = (model.back_color && /^#[0-9a-f]{3,8}$/i.test(model.back_color)) ? model.back_color : (edges ? rgb(edges.right) : "#a68fe3");
      var spineBg;
      if (tex.spine) spineBg = cssUrl(model.spine) + " center/100% 100% no-repeat";
      else if (edges) spineBg = "linear-gradient(180deg," + rgb(edges.top, 0.95) + "," + rgb(edges.mid, 0.95) + " 50%," + rgb(edges.bot, 0.95) + ")";
      else spineBg = back;

      var fr = face("p3d-front", w, h, "translateZ(" + f2(d / 2) + "px)", [0, 0, 1]);
      fr.el.style.background = cssUrl(model.front) + " center/100% 100% no-repeat, " + back;
      fr.el.style.borderRadius = "0 " + f2(r) + "px " + f2(r) + "px 0";
      lit(fr, true);

      var bk = face("p3d-back", w, h, "rotateY(180deg) translateZ(" + f2(d / 2) + "px)", [0, 0, -1]);
      bk.el.style.setProperty("--bc", back);
      bk.el.style.borderRadius = f2(r) + "px 0 0 " + f2(r) + "px";
      bk.el.innerHTML = '<span class="p3d-bk-mark">yards</span><span class="p3d-bk-rule"></span>' +
        '<span class="p3d-bk-line">A Practical Guide to Mixing &amp; Mastering</span><span class="p3d-bk-code"></span>';
      lit(bk, true);

      var sp = face("p3d-spine", d, h, "rotateY(-90deg) translateZ(" + f2(w / 2) + "px)", [-1, 0, 0]);
      sp.el.style.background = spineBg;
      sp.el.style.borderRadius = f2(r * 0.6) + "px 0 0 " + f2(r * 0.6) + "px";
      if (!tex.spine) sp.el.innerHTML = '<span class="p3d-sp-t"><b>The Last Yards</b></span>';
      lit(sp, false);

      // Buchdeckel-Kanten (Rim) oben/unten/rechts, Mitte transparent -> Seitenblock sichtbar
      var rimBg = function (dir) { return "linear-gradient(" + dir + "," + back + " 0," + back + " " + cb + "px,transparent " + cb + "px,transparent calc(100% - " + cb + "px)," + back + " calc(100% - " + cb + "px)," + back + " 100%)"; };
      var rt = face("p3d-rim", w, d, "rotateX(90deg) translateZ(" + f2(h / 2) + "px)", [0, -1, 0]); rt.el.style.background = rimBg("180deg"); rt.rim = true;
      var rb = face("p3d-rim", w, d, "rotateX(-90deg) translateZ(" + f2(h / 2) + "px)", [0, 1, 0]); rb.el.style.background = rimBg("180deg"); rb.rim = true;
      var rr = face("p3d-rim", d, h, "rotateY(90deg) translateZ(" + f2(w / 2) + "px)", [1, 0, 0]); rr.el.style.background = rimBg("90deg"); rr.rim = true;

      // Seitenblock (leicht eingerueckt, Deckel stehen ~2px ueber)
      var pw = w - t - 1, pd = d - cb * 2, ph = h - t * 2;
      var pt = face("p3d-pg p3d-pg-h", pw, pd, "translateX(" + f2(-(t - 1) / 2) + "px) rotateX(90deg) translateZ(" + f2(h / 2 - t) + "px)", [0, -1, 0]); lit(pt);
      var pb = face("p3d-pg p3d-pg-h", pw, pd, "translateX(" + f2(-(t - 1) / 2) + "px) rotateX(-90deg) translateZ(" + f2(h / 2 - t) + "px)", [0, 1, 0]); lit(pb);
      var pr = face("p3d-pg p3d-pg-v", pd, ph, "rotateY(90deg) translateZ(" + f2(w / 2 - t) + "px)", [1, 0, 0]); lit(pr);
      // Rim-Flaechen bekommen Helligkeit per filter (Mitte ist transparent)
    }

    function buildCard(w, h, d) {
      var u = w / 100, mask = cssUrl(model.front);
      obj.style.setProperty("--u", f2(u) + "px");
      var setMask = function (s) {
        s.webkitMaskImage = mask; s.maskImage = mask;
        s.webkitMaskSize = "100% 100%"; s.maskSize = "100% 100%";
        s.webkitMaskRepeat = "no-repeat"; s.maskRepeat = "no-repeat";
      };
      // Kantenschichten
      var n = 10;
      for (var i = 1; i <= n; i++) {
        var z = -d / 2 + (d * i) / (n + 1);
        var L = face("p3d-edge", w, h, "translateZ(" + f2(z) + "px)", [0, 0, 1]);
        setMask(L.el.style);
        edgeLayers.push(L.el);
        faces.pop(); // nicht per-Face schattieren
      }
      var fr = face("p3d-cf", w, h, "translateZ(" + f2(d / 2) + "px)", [0, 0, 1]);
      fr.el.style.backgroundImage = mask; fr.el.style.backgroundSize = "100% 100%"; fr.el.style.backgroundRepeat = "no-repeat";
      setMask(fr.el.style); lit(fr, true);

      var bk = face("p3d-cb", w, h, "rotateY(180deg) translateZ(" + f2(d / 2) + "px)", [0, 0, -1]);
      // Rueckseite: horizontal gespiegelte Silhouette (abgeschnittene Ecke erscheint von hinten oben links)
      var mirrored = null;
      try {
        var im = tex.front, cw = im.naturalWidth || im.width, ch = im.naturalHeight || im.height;
        var cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
        var cx = cv.getContext("2d"); cx.translate(cw, 0); cx.scale(-1, 1); cx.drawImage(im, 0, 0, cw, ch);
        mirrored = 'url("' + cv.toDataURL("image/png") + '")';
      } catch (e) { mirrored = null; }
      var bs = bk.el.style, hasMirrorChild = false;
      if (mirrored) {
        bs.webkitMaskImage = mirrored; bs.maskImage = mirrored;
        bs.webkitMaskSize = "100% 100%"; bs.maskSize = "100% 100%";
        bs.webkitMaskRepeat = "no-repeat"; bs.maskRepeat = "no-repeat";
      } else {
        // Fallback: Maske + Hintergrund auf gespiegeltem Kind, Inhalt separat ungespiegelt
        hasMirrorChild = true;
        var mc = document.createElement("span");
        mc.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;transform:scaleX(-1);background:" + (getComputedStyle(bk.el).background || "#222");
        setMask(mc.style);
        bk.el.style.background = "none";
        bk.el.appendChild(mc);
      }
      var pads = ""; for (var k = 0; k < 9; k++) pads += "<b></b>";
      var inner = '<span class="p3d-pads">' + pads + '</span><span class="p3d-bk-emb">YARDSLOVESYOU</span>';
      if (hasMirrorChild) bk.el.insertAdjacentHTML("beforeend", inner); else bk.el.innerHTML = inner;
      lit(bk, true);
    }

    function build() {
      var W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H || !tex) return false;
      S.W = W; S.H = H;
      var maxH = small ? 1e5 : (window.innerWidth <= 600 ? 320 : 420);
      var frac = small ? 0.78 : 0.8;
      var iw = tex.front.naturalWidth || 783, ih = tex.front.naturalHeight || 1200;
      var R = ih / iw;
      var h = Math.min(maxH, frac * H), w = h / R;
      if (w > W * 0.62) { w = W * 0.62; h = w * R; }
      var d = isBook ? w * clamp(Number(model.thickness) || 0.11, 0.03, 0.3) : Math.max(2.5, w * 0.035);
      S.w = w; S.h = h; S.d = d;
      obj.textContent = ""; faces = []; edgeLayers = [];
      obj.style.width = f2(w) + "px"; obj.style.height = f2(h) + "px";
      scene.style.perspective = Math.round(h * 3.4) + "px";
      var room = h * 0.09, cy = (H - room) / 2;
      obj.style.left = "50%"; obj.style.top = f2(cy) + "px";
      obj.style.marginLeft = f2(-w / 2) + "px"; obj.style.marginTop = f2(-h / 2) + "px";
      scene.style.perspectiveOrigin = "50% " + f2(cy) + "px";
      shadow.style.width = f2(w * 1.05) + "px"; shadow.style.height = f2(h * 0.07) + "px";
      shadow.style.left = "50%"; shadow.style.top = f2(cy + h / 2 + h * 0.025) + "px";
      if (isBook) buildBook(w, h, d); else buildCard(w, h, d);
      built = true;
      render(true);
      return true;
    }

    /* ----- Licht + Transformation ----- */
    function render(force) {
      if (!built) return;
      var yaw = S.yaw, pitch = S.pitch;
      obj.style.transform = "rotateX(" + f2(pitch) + "deg) rotateY(" + f2(yaw) + "deg)";
      var cy = Math.cos(yaw * D2R), sy = Math.sin(yaw * D2R), cx = Math.cos(pitch * D2R), sx = Math.sin(pitch * D2R);
      for (var i = 0; i < faces.length; i++) {
        var f = faces[i], n = f.n;
        var x1 = n[0] * cy + n[2] * sy, z1 = -n[0] * sy + n[2] * cy;
        var y2 = n[1] * cx - z1 * sx, z2 = n[1] * sx + z1 * cx;
        if (z2 < -0.05 && !force) continue; // abgewandt
        var diff = x1 * LIGHT[0] + y2 * LIGHT[1] + z2 * LIGHT[2];
        var t = diff - 0.68, dark = t < 0 ? Math.min(0.6, -t * 0.8) : 0;
        if (f.sh && (force || Math.abs(dark - f.dark) > 0.004)) { f.dark = dark; f.sh.style.opacity = dark.toFixed(3); }
        else if (f.rim && (force || Math.abs(dark - f.dark) > 0.01)) { f.dark = dark; f.el.style.filter = "brightness(" + (1 - dark * 0.9).toFixed(3) + ")"; }
        if (f.sheen && z2 > 0) {
          var p = 0.5 + (HALF[0] - x1) * 1.7 + (y2 - HALF[1]) * 0.25;
          var op = Math.pow(z2, 2) * 0.9;
          var pos = ((1.5 - p) / 2 * 100);
          if (force || Math.abs(pos - f.sp) > 0.4 || Math.abs(op - f.sx) > 0.01) {
            f.sp = pos; f.sx = op;
            f.sheen.style.backgroundPosition = pos.toFixed(1) + "% 0";
            f.sheen.style.opacity = op.toFixed(3);
          }
        }
      }
      if (!isBook) obj.style.setProperty("--el", (17 + 11 * sy).toFixed(1) + "%");
      var fx = (Math.abs(cy) * S.w + Math.abs(sy) * S.d) / S.w;
      shadow.style.transform = "translate(-50%,-50%) scale(" + fx.toFixed(3) + ",1)";
      shadow.style.opacity = (0.62 - 0.12 * (1 - Math.abs(cy))).toFixed(3);
    }

    /* ----- Animation pro Frame ----- */
    function near() {
      if (small) return S.hover && mouse.ok;
      if (!mouse.ok) return false;
      var r = stage.getBoundingClientRect();
      var cx = r.left + r.width / 2, cyy = r.top + (S.H - S.h * 0.09) / 2;
      var hw = S.w * 1.25 / 2, hh = S.h * 1.25 / 2;
      return Math.abs(mouse.x - cx) <= hw && Math.abs(mouse.y - cyy) <= hh;
    }
    function tick(dt, now) {
      if (S.keyRemain) {
        var st = S.keyRemain * (1 - Math.exp(-dt * 9));
        S.yaw += st; S.keyRemain -= st;
        if (Math.abs(S.keyRemain) < 0.05) { S.yaw += S.keyRemain; S.keyRemain = 0; }
        S.lastInteract = now; S.v = 0;
      }
      if (S.dragging) {
        S.lastInteract = now; S.following = false;
      } else if (!reduce && !S.keyRemain && near()) {
        if (!S.following) { S.following = true; S.base = S.yaw; }
        var r = stage.getBoundingClientRect();
        var cx = r.left + r.width / 2, cyy = r.top + (S.H - S.h * 0.09) / 2;
        var hw = Math.max(40, S.w * 1.25 / 2), hh = Math.max(40, S.h * 1.25 / 2);
        if (small) { hw = Math.max(hw, r.width / 2); hh = Math.max(hh, r.height / 2); }
        var nx = clamp((mouse.x - cx) / hw, -1, 1), ny = clamp((mouse.y - cyy) / hh, -1, 1);
        var k = 1 - Math.exp(-dt * 5);
        S.yaw += (S.base + nx * 35 - S.yaw) * k;
        S.pitch += (REST_PITCH - ny * 20 - S.pitch) * k;
        S.v = 0; S.lastInteract = now;
      } else {
        S.following = false;
        if (!S.keyRemain) {
          if (now - S.lastInteract < RESUME_MS) S.v *= Math.exp(-dt * 2.6);
          else S.v += ((reduce ? 0 : IDLE_V) - S.v) * (1 - Math.exp(-dt * 1.4));
          S.yaw += S.v * dt;
        }
        S.pitch += (REST_PITCH - S.pitch) * (1 - Math.exp(-dt * 3));
      }
      if (S.yaw > 36000 || S.yaw < -36000) S.yaw %= 360;
      render(false);
    }

    /* ----- Eingaben (nur large) ----- */
    var offs = [];
    function on(t, type, fn, o) { t.addEventListener(type, fn, o); offs.push(function () { t.removeEventListener(type, fn, o); }); }

    if (small) {
      on(hoverEl, "pointerenter", function (e) { if (e.pointerType === "mouse") { S.hover = true; wake(); } });
      on(hoverEl, "pointerleave", function () { S.hover = false; });
    } else {
      var lx = 0, ly = 0, lt = 0, vs = 0, lastMove = 0;
      on(stage, "pointerdown", function (e) {
        if (e.button) return;
        S.dragging = true; S.v = 0; S.following = false; S.keyRemain = 0;
        lx = e.clientX; ly = e.clientY; lt = e.timeStamp; vs = 0; lastMove = e.timeStamp;
        stage.classList.add("p3d-drag");
        try { stage.setPointerCapture(e.pointerId); } catch (x) {}
        wake();
      });
      on(stage, "pointermove", function (e) {
        if (!S.dragging) return;
        var dx = e.clientX - lx, dy = e.clientY - ly, dtm = Math.max(1, e.timeStamp - lt) / 1000;
        lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
        S.yaw += dx * 0.55;
        S.pitch = clamp(S.pitch - dy * 0.22, -38, 26);
        var inst_v = dx * 0.55 / dtm;
        vs = vs * 0.6 + inst_v * 0.4;
        lastMove = e.timeStamp;
      });
      var end = function (e) {
        if (!S.dragging) return;
        S.dragging = false; stage.classList.remove("p3d-drag");
        var idle = (e.timeStamp || performance.now()) - lastMove;
        S.v = idle > 90 ? 0 : clamp(vs, -900, 900);
        S.lastInteract = performance.now();
        try { stage.releasePointerCapture(e.pointerId); } catch (x) {}
      };
      on(stage, "pointerup", end);
      on(stage, "pointercancel", end);
      on(stage, "lostpointercapture", function (e) { if (S.dragging) end(e); });
      on(stage, "keydown", function (e) {
        if (e.key === "ArrowLeft") { S.keyRemain -= 15; e.preventDefault(); wake(); }
        else if (e.key === "ArrowRight") { S.keyRemain += 15; e.preventDefault(); wake(); }
      });
    }

    /* ----- Sichtbarkeit / Groesse ----- */
    var io = new IntersectionObserver(function (en) {
      S.visible = en[en.length - 1].isIntersecting;
      if (S.visible) wake();
    }, { threshold: 0.01 });
    io.observe(stage);
    var ro = null, rt = 0;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(function () {
        if (!S.ready || S.destroyed) return;
        var W = stage.clientWidth, H = stage.clientHeight;
        if (W && H && (!built || Math.abs(W - S.W) > 2 || Math.abs(H - S.H) > 2)) {
          cancelAnimationFrame(rt);
          rt = requestAnimationFrame(function () { if (!S.destroyed) { build(); wake(); } });
        }
      });
      ro.observe(stage);
    }
    insts.push(inst);

    /* ----- Laden ----- */
    var readyRes, ready = new Promise(function (r) { readyRes = r; });
    function fail() {
      if (S.destroyed) return;
      destroy();
      if (opts.onfail) try { opts.onfail(); } catch (e) {}
      readyRes(false);
    }
    Promise.all([loadTex(model.front), isBook && model.spine ? loadTex(model.spine).catch(function () { return null; }) : null])
      .then(function (r) {
        if (S.destroyed) return;
        tex = { front: r[0], spine: r[1] };
        if (isBook) edges = sampleEdges(r[0]);
        S.ready = true;
        var tryBuild = function (n) {
          if (S.destroyed) return;
          if (stage.clientWidth && stage.clientHeight) {
            if (!build()) return fail();
            stage.classList.add("p3d-ready");
            if (!S.hidden) el.classList.add("p3d-on", "has-p3d");
            if (opts.onready) try { opts.onready(); } catch (e) {}
            readyRes(true);
            wake();
          } else if (S.hidden || n > 0) {
            // unsichtbar (z.B. anderer Slide): spaeter ueber ResizeObserver bauen
            if (S.hidden) { S.pendingReady = true; } else setTimeout(function () { tryBuild(n - 1); }, 100);
          } else fail();
        };
        tryBuild(20);
      })
      .catch(fail);

    function destroy() {
      if (S.destroyed) return;
      S.destroyed = true;
      offs.forEach(function (f) { f(); });
      try { io.disconnect(); } catch (e) {}
      try { ro && ro.disconnect(); } catch (e) {}
      var i = insts.indexOf(inst); if (i >= 0) insts.splice(i, 1);
      el.classList.remove("p3d-on", "has-p3d");
      if (stage.parentNode) stage.parentNode.removeChild(stage);
    }

    return {
      destroy: destroy,
      ready: ready,
      hide: function () {
        if (S.destroyed) return;
        S.hidden = true; stage.hidden = true; el.classList.remove("p3d-on", "has-p3d");
      },
      show: function () {
        if (S.destroyed) return;
        S.hidden = false; stage.hidden = false;
        if (S.ready && built) el.classList.add("p3d-on", "has-p3d");
        else if (S.ready && S.pendingReady) { S.pendingReady = false; requestAnimationFrame(function () { if (build()) { stage.classList.add("p3d-ready"); el.classList.add("p3d-on", "has-p3d"); if (opts.onready) try { opts.onready(); } catch (e) {} readyRes(true); wake(); } }); }
        requestAnimationFrame(function () { var W = stage.clientWidth, H = stage.clientHeight; if (S.ready && W && H && (Math.abs(W - S.W) > 2 || Math.abs(H - S.H) > 2)) build(); wake(); });
      }
    };
  }

  NS.mount = mount;
  window.Product3D = NS;
})();

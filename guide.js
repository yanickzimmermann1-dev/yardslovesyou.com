/* guide.js – "Look inside" Produktseite für Guides. product.js ruft window.renderGuide(product, ctx) auf,
   wenn product.guide vorhanden ist. Keine Inline-Skripte, kein innerHTML mit ungeprüften Daten (alles per esc()). */
(function () {
  "use strict";
  var ICON = function (d, s) {
    return '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + "</svg>";
  };
  var I = {
    lock: ICON('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    book: ICON('<path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>'),
    check: ICON('<path d="m5 12.5 4.5 4.5L19 7"/>'),
    x: ICON('<path d="M6 6l12 12M18 6 6 18"/>'),
    prev: ICON('<path d="m15 6-6 6 6 6"/>'),
    next: ICON('<path d="m9 6 6 6-6 6"/>'),
    bolt: ICON('<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>'),
    dl: ICON('<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>')
  };

  window.renderGuide = function (p, ctx) {
    var g = p.guide, esc = ctx.esc, root = ctx.root;
    var reduce = false;
    try { reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}
    var chapters = g.chapters.slice().sort(function (a, b) { return (a.n || 0) - (b.n || 0); });
    var firstFree = -1;
    chapters.forEach(function (c, i) { if (c.free && firstFree < 0) firstFree = i; });
    var cover = ctx.images && ctx.images[0];
    var crop = g.cover_crop;
    var coverStyle = "";
    if (cover) {
      coverStyle = "background-image:url(&quot;" + esc(String(cover).replace(/["\\\n\r()]/g, encodeURIComponent)) + "&quot;);";
      coverStyle += crop && crop.size ? "background-size:" + Number(crop.size) + "% auto;background-position:" + Number(crop.x) + "% " + Number(crop.y) + "%;" : "background-size:cover;background-position:center;";
    }
    var paras = function (t) {
      return String(t || "").trim().split(/\n\s*\n/).map(function (x) { return "<p>" + esc(x).replace(/\n/g, "<br>") + "</p>"; }).join("");
    };

    var stats = (g.stats || []).map(function (s) {
      var v = String(s.value == null ? "" : s.value), num = /^\d+$/.test(v);
      return '<li><strong' + (num ? ' data-count="' + v + '"' : "") + ">" + esc(v) + "</strong><span>" + esc(s.label) + "</span></li>";
    }).join("");

    var path = g.path || [];
    var pathHtml = path.length ? '<section class="gd-sec gd-rv gd-path" aria-labelledby="gd-h-path"><p class="eyebrow">The journey</p><h2 id="gd-h-path">From first listen to release day</h2>' +
      '<ol class="gd-track" style="--n:' + path.length + '">' + path.map(function (s, i) {
        return '<li class="gd-stop"><span class="gd-dot" aria-hidden="true">' + (i + 1) + '</span><span class="gd-stop-name">' + esc(s) + "</span></li>";
      }).join("") + "</ol></section>" : "";

    var cards = chapters.map(function (c, i) {
      return '<li><button type="button" class="gd-card' + (c.free ? " is-free" : "") + '" data-ch="' + i + '">' +
        '<span class="gd-card-n">' + String(c.n || i + 1).padStart(2, "0") + "</span>" +
        '<span class="gd-card-body"><strong>' + esc(c.title) + "</strong><span>" + esc(c.teaser) + "</span></span>" +
        '<span class="gd-card-tag">' + (c.free ? "Free preview" : I.lock + '<span class="sr-only">Locked chapter</span>') + "</span></button></li>";
    }).join("");

    var list = function (arr, ok) {
      return (arr || []).map(function (t) { return '<li><span class="gd-ic ' + (ok ? "ok" : "no") + '">' + (ok ? I.check : I.x) + "</span><span>" + esc(t) + "</span></li>"; }).join("");
    };
    var gallery = ctx.images && ctx.images.length > 1 ? '<section class="gd-sec gd-rv"><p class="eyebrow">Gallery</p><h2>A closer look</h2><div class="gd-gallery">' +
      ctx.images.slice(1).map(function (u) { return '<img src="' + esc(u) + '" alt="" loading="lazy">'; }).join("") + "</div></section>" : "";

    var buyBtn = function (label, id) {
      return '<button class="button gd-buy" type="button" data-buy' + (id ? ' id="' + id + '"' : "") + ">" + label + "</button>";
    };

    root.innerHTML = '<div class="gd">' +
      '<section class="gd-hero">' +
        '<div class="gd-hero-copy">' +
          '<p class="eyebrow">Guide · PDF ' + (p.badge ? '<span class="badge badge-inline">' + esc(p.badge) + "</span>" : "") + "</p>" +
          "<h1>" + esc(p.title) + "</h1>" +
          '<p class="gd-tagline">' + esc(g.tagline || p.description || "") + "</p>" +
          (stats ? '<ul class="gd-stats">' + stats + "</ul>" : "") +
          '<div class="gd-buyrow"><span class="price-wrap">' + (ctx.was || "") + '<span class="price">' + ctx.price + "</span></span>" +
          buyBtn("Get the guide", "buy-btn") +
          (firstFree >= 0 ? '<button class="outline gd-free-btn" type="button" id="gd-free-btn">' + I.book + " Read a free chapter</button>" : "") + "</div>" +
          '<p class="gd-note">' + I.dl + " Instant download after payment. " + esc(g.chapters_note || "") + "</p>" +
        "</div>" +
        '<div class="gd-scene" id="gd-scene"><div class="gd-float"><div class="gd-book" id="gd-book">' +
          '<div class="gd-face gd-front" role="img" aria-label="Cover of ' + esc(p.title) + '" style="' + coverStyle + '"></div>' +
          '<div class="gd-face gd-spine" aria-hidden="true"><span>' + esc(p.title) + "</span></div>" +
          '<div class="gd-face gd-edge" aria-hidden="true"></div>' +
          '<div class="gd-face gd-back" aria-hidden="true"></div>' +
        '</div><div class="gd-shadow" aria-hidden="true"></div></div></div>' +
      "</section>" +
      (g.promise ? '<section class="gd-sec gd-rv gd-promise"><p>' + esc(g.promise) + "</p></section>" : "") +
      pathHtml +
      '<section class="gd-sec gd-rv" id="gd-toc" aria-labelledby="gd-h-toc"><p class="eyebrow">Look inside</p><h2 id="gd-h-toc">Inside the guide</h2>' +
        '<p class="muted gd-lead">Open any chapter to read a page.' + (firstFree >= 0 ? " Chapters marked free are yours to read in full." : "") + '</p><ol class="gd-cards">' + cards + "</ol></section>" +
      ((g["for"] || g.not_for) ? '<section class="gd-sec gd-rv" aria-labelledby="gd-h-for"><p class="eyebrow">Fit</p><h2 id="gd-h-for">Is this for you?</h2><div class="gd-fit">' +
        '<div class="gd-fit-col yes"><h3>This is for you if</h3><ul>' + list(g["for"], true) + "</ul></div>" +
        '<div class="gd-fit-col no"><h3>Probably not if</h3><ul>' + list(g.not_for, false) + "</ul></div></div></section>" : "") +
      gallery +
      '<section class="gd-sec gd-rv" aria-labelledby="gd-h-faq"><p class="eyebrow">Questions</p><h2 id="gd-h-faq">FAQ</h2><div class="pd-faq">' +
        ((g.faq || []).map(function (f) { return "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>"; }).join("") +
         (ctx.faq || []).filter(function (f) { return /payment|question/i.test(f[0]); }).map(function (f) { return "<details><summary>" + esc(f[0]) + "</summary><p>" + f[1] + "</p></details>"; }).join("")) +
      "</div>" + (g.guarantee ? '<p class="gd-guarantee">' + I.bolt + "<span>" + esc(g.guarantee) + "</span></p>" : "") + "</section>" +
      '<section class="gd-final gd-rv"><h2>Finish the record.</h2><p>' + esc(p.description || "") + "</p><div>" +
        '<span class="price-wrap">' + (ctx.was || "") + '<span class="price">' + ctx.price + "</span></span>" + buyBtn("Get the guide") + "</div>" +
        '<p class="gd-note">' + I.dl + " Instant download after payment.</p></section>" +
    "</div>" +
    '<div class="gd-panel" id="gd-panel" hidden><div class="gd-backdrop" data-close></div>' +
      '<div class="gd-sheet" role="dialog" aria-modal="true" aria-labelledby="gd-p-title" tabindex="-1">' +
        '<button type="button" class="gd-close" data-close aria-label="Close preview">' + I.x + "</button>" +
        '<div class="gd-page" id="gd-page"><p class="gd-kicker" id="gd-p-kicker"></p><h3 id="gd-p-title"></h3><div class="gd-p-text" id="gd-p-text"></div>' +
          '<aside class="gd-tip" id="gd-p-tip" hidden><strong>Pro tip</strong><p></p></aside></div>' +
        '<div class="gd-lockbar" id="gd-lockbar" hidden><span>' + I.lock + ' This is a preview. The full chapter is in the guide.</span></div>' +
        '<div class="gd-pfoot"><button type="button" class="gd-nav" id="gd-prev" aria-label="Previous chapter">' + I.prev + '</button><span class="gd-count" id="gd-count" aria-live="polite"></span>' +
          '<button class="button gd-buy gd-unlock" type="button" data-buy id="gd-unlock"></button>' +
          '<button type="button" class="gd-nav" id="gd-next" aria-label="Next chapter">' + I.next + "</button></div>" +
      "</div></div>";

    var q = function (s, r) { return (r || root).querySelector(s); };
    var qa = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
    var gd = q(".gd");
    gd.classList.add("gd-js");

    /* ---------- Einblenden (eigener Observer) ---------- */
    var rvs = qa(".gd-rv");
    if ("IntersectionObserver" in window && !reduce) {
      var rio = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("gd-in"); rio.unobserve(e.target); } });
      }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
      rvs.forEach(function (el) { rio.observe(el); });
      setTimeout(function () { rvs.forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("gd-in"); }); }, 2200);
    } else { rvs.forEach(function (el) { el.classList.add("gd-in"); }); }

    /* ---------- Zahlen hochzählen ---------- */
    var counters = qa("[data-count]");
    var countUp = function (el) {
      var to = parseInt(el.getAttribute("data-count"), 10), t0 = null, dur = 1100;
      if (reduce || !to) { el.textContent = to; return; }
      var step = function (t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(to * e);
        if (k < 1) requestAnimationFrame(step); else el.textContent = to;
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    };
    if ("IntersectionObserver" in window) {
      var cio = new IntersectionObserver(function (en) {
        en.forEach(function (e) { if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); } });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { cio.observe(el); });
    }

    /* ---------- Buch: schweben + Neigung per Maus ---------- */
    var scene = q("#gd-scene"), book = q("#gd-book");
    if (!reduce && scene && book && window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches) {
      var raf = 0, tx = 0, ty = 0;
      var apply = function () { raf = 0; book.style.setProperty("--ry", (-22 + tx * 16) + "deg"); book.style.setProperty("--rx", (5 - ty * 12) + "deg"); };
      window.addEventListener("pointermove", function (e) {
        var r = scene.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
        ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });
    }

    /* ---------- Pfad: Fortschrittslinie folgt dem Scrollen ---------- */
    var track = q(".gd-track");
    if (track) {
      var stops = qa(".gd-stop", track), ticking = false;
      var upd = function () {
        ticking = false;
        var r = track.getBoundingClientRect(), vh = window.innerHeight;
        var prog = reduce ? 1 : Math.max(0, Math.min(1, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        track.style.setProperty("--p", prog.toFixed(3));
        stops.forEach(function (s, i) { s.classList.toggle("on", prog >= (stops.length > 1 ? i / (stops.length - 1) : 0) - 0.001 && prog > 0.02); });
      };
      var onS = function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } };
      window.addEventListener("scroll", onS, { passive: true });
      window.addEventListener("resize", onS);
      upd();
    }

    /* ---------- Kapitel-Seite (Dialog) ---------- */
    var panel = q("#gd-panel"), sheet = q(".gd-sheet", panel), cur = -1, lastFocus = null;
    var elK = q("#gd-p-kicker"), elT = q("#gd-p-title"), elX = q("#gd-p-text"), elTip = q("#gd-p-tip"), elLock = q("#gd-lockbar");
    var elCount = q("#gd-count"), btnPrev = q("#gd-prev"), btnNext = q("#gd-next"), unlock = q("#gd-unlock");

    var excerpt = function (text) {
      var flat = String(text || "").replace(/\s+/g, " ").trim();
      var cut = flat.length > 190 ? flat.slice(0, 190) : flat;
      var m = cut.match(/^(.{80,}?[.!?])\s/);
      var shown = m ? m[1] : cut.replace(/\s+\S*$/, "");
      var rest = flat.slice(shown.length).trim().slice(0, 150).replace(/\s+\S*$/, "");
      return { shown: shown, ghost: rest };
    };

    var render = function (i, dir) {
      var c = chapters[i]; cur = i;
      elK.textContent = "Chapter " + (c.n || i + 1) + (c.free ? " · Free preview" : " · Preview");
      elT.textContent = c.title;
      if (c.free) {
        elX.innerHTML = paras(c.snippet);
        elX.classList.remove("is-locked");
      } else {
        var ex = excerpt(c.snippet);
        elX.innerHTML = "<p>" + esc(ex.shown) + "</p>" + (ex.ghost ? '<p class="gd-ghost" aria-hidden="true">' + esc(ex.ghost) + "</p>" : "");
        elX.classList.add("is-locked");
      }
      var showTip = c.free && c.tip;
      elTip.hidden = !showTip;
      if (showTip) q("p", elTip).textContent = c.tip;
      elLock.hidden = !!c.free;
      unlock.dataset.t = "";
      unlock.innerHTML = c.free ? "Get the full guide · " + esc(ctx.price) : I.lock + " Unlock the full chapter · " + esc(ctx.price);
      elCount.textContent = (i + 1) + " / " + chapters.length;
      btnPrev.disabled = i === 0; btnNext.disabled = i === chapters.length - 1;
      var pg = q("#gd-page");
      pg.scrollTop = 0; sheet.scrollTop = 0;
      if (!reduce && dir) { pg.classList.remove("slide-l", "slide-r"); void pg.offsetWidth; pg.classList.add(dir > 0 ? "slide-l" : "slide-r"); }
      ctx.track("guide-preview-open", { chapter: c.n || i + 1 });
      if (c.free) ctx.track("guide-free-chapter", { chapter: c.n || i + 1 });
    };

    var focusables = function () {
      return qa('button:not([disabled]), a[href], summary, [tabindex]:not([tabindex="-1"])', sheet).filter(function (el) { return !el.hidden && el.offsetParent !== null; });
    };
    var open = function (i, trigger) {
      lastFocus = trigger || document.activeElement;
      var wasOpen = !panel.hidden;
      panel.hidden = false;
      render(i, 0);
      if (!wasOpen) {
        document.documentElement.classList.add("gd-lock");
        requestAnimationFrame(function () { panel.classList.add("open"); sheet.focus({ preventScroll: true }); });
      }
    };
    var close = function () {
      if (panel.hidden) return;
      panel.classList.remove("open");
      document.documentElement.classList.remove("gd-lock");
      var done = function () { panel.hidden = true; };
      if (reduce) done(); else setTimeout(done, 220);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    var go = function (d) { var n = cur + d; if (n >= 0 && n < chapters.length) render(n, d); };

    qa(".gd-card").forEach(function (b) { b.addEventListener("click", function () { open(parseInt(b.getAttribute("data-ch"), 10), b); }); });
    qa("[data-close]", panel).forEach(function (b) { b.addEventListener("click", close); });
    btnPrev.addEventListener("click", function () { go(-1); });
    btnNext.addEventListener("click", function () { go(1); });

    document.addEventListener("keydown", function (e) {
      if (panel.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowRight" && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) { go(1); return; }
      if (e.key === "ArrowLeft" && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || "")) { go(-1); return; }
      if (e.key === "Tab") {
        var f = focusables();
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1], a = document.activeElement;
        if (!sheet.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && (a === first || a === sheet)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Wischen links/rechts (Handy)
    var sx = 0, sy = 0, st = 0;
    sheet.addEventListener("touchstart", function (e) { var t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
    sheet.addEventListener("touchend", function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    // "Read a free chapter": zum ersten kostenlosen Kapitel scrollen und öffnen
    var fb = q("#gd-free-btn");
    if (fb) fb.addEventListener("click", function () {
      var card = q('.gd-card[data-ch="' + firstFree + '"]');
      if (!card) return;
      card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      card.classList.add("gd-pulse");
      setTimeout(function () { card.classList.remove("gd-pulse"); open(firstFree, card); }, reduce ? 0 : 550);
    });
  };
})();

/* quickview.js - "Quick view" modal for shop cards. No inline code (CSP). Needs shop cards (.product), optional Product3D/SoundPads/ylyCart/YLYReviews. */
(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || String(cfg.SUPABASE_URL).indexOf("https://") !== 0 || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const track = (n, d) => { try { window.ylyTrack && window.ylyTrack(n, d); } catch (_) {} };
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>';
  const R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

  let db = null;
  const getDb = () => {
    if (db) return db;
    try { if (window.supabase) db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY); } catch (_) {}
    return db;
  };
  const money = (c, cur) => { try { return (Number(c) / 100).toLocaleString("de-CH", { style: "currency", currency: String(cur || cfg.CURRENCY || "CHF").toUpperCase() }); } catch (_) { return String(c / 100); } };
  const img = u => { const r = /^https:\/\//i.test(u) ? u : (getDb() ? getDb().storage.from("coverart-products").getPublicUrl(u).data.publicUrl : ""); return window.YLYMedia ? window.YLYMedia.url(r) : r; };
  const model = p => {
    let m = p && p.model3d;
    if (typeof m === "string") { try { m = JSON.parse(m); } catch (_) { m = null; } }
    return m && typeof m === "object" && m.front && (m.type === "book" || m.type === "card") ? m : null;
  };

  /* ---------- data ---------- */
  const cache = new Map(); let allP = null;
  const loadAll = () => allP || (allP = (async () => {
    const d = getDb(); if (!d) return [];
    try {
      const { data, error } = await d.from("shop_products").select("*").eq("published", true);
      if (error || !Array.isArray(data)) return [];
      data.forEach(p => cache.set(String(p.id), p)); return data;
    } catch (_) { return []; }
  })().then(r => { if (!r.length) allP = null; return r; }));
  const getProduct = async id => { id = String(id); if (cache.has(id)) return cache.get(id); await loadAll(); return cache.get(id) || null; };
  const ratings = new Map();
  const getRating = id => {
    if (ratings.has(id)) return ratings.get(id);
    const pr = (async () => {
      const d = getDb(); if (!d) return null;
      try {
        const { data, error } = await d.from("product_reviews").select("rating").eq("product_id", id).eq("status", "approved");
        if (error || !Array.isArray(data) || !data.length) return null;
        let s = 0; data.forEach(r => { s += Math.max(1, Math.min(5, +r.rating || 0)); });
        return { avg: s / data.length, n: data.length };
      } catch (_) { return null; }
    })();
    ratings.set(id, pr); return pr;
  };
  const stars = (r, size) => {
    if (window.YLYReviews && YLYReviews.stars) return YLYReviews.stars(r, size);
    return '<span aria-label="' + r.toFixed(1) + ' out of 5">' + "★".repeat(Math.round(r)) + "☆".repeat(5 - Math.round(r)) + "</span>";
  };

  /* ---------- eye buttons ---------- */
  const idOf = card => {
    const a = card.querySelector('a.product-link[href*="id="]') || card.querySelector('a[href*="product.html"]');
    if (!a) return null;
    try { return new URL(a.getAttribute("href"), location.href).searchParams.get("id"); } catch (_) { return null; }
  };
  const titleOf = card => { const h = card.querySelector("h3"); return h ? h.textContent.trim() : "product"; };
  function inject(root) {
    (root || document).querySelectorAll("article.product").forEach(card => {
      if (card.querySelector(".qv-eye")) return;
      const id = idOf(card); if (!id) return;
      if (getComputedStyle(card).position === "static") card.style.position = "relative";
      const b = document.createElement("button");
      b.type = "button"; b.className = "qv-eye"; b.dataset.qvId = id;
      b.setAttribute("aria-label", "Quick view " + titleOf(card)); b.setAttribute("title", "Quick view");
      b.innerHTML = EYE;
      card.appendChild(b);
    });
  }
  let t = 0;
  const sched = () => { if (t) return; t = setTimeout(() => { t = 0; inject(); }, 40); };

  /* ---------- modal ---------- */
  let root = null, dlg, back, body, prevB, nextB, xB, opener = null, curId = null, order = [], p3d = null, tok = 0, closing = false, startRect = null, ctl = null;

  function build() {
    if (root) return;
    root = document.createElement("div"); root.className = "qv-root"; root.hidden = true;
    root.innerHTML = '<div class="qv-back"></div><div class="qv-dlg" role="dialog" aria-modal="true" aria-label="Quick view" tabindex="-1"><button type="button" class="qv-x" aria-label="Close quick view">' + X + '</button><button type="button" class="qv-nav qv-prev" aria-label="Previous product">' + L + '</button><button type="button" class="qv-nav qv-next" aria-label="Next product">' + R + '</button><div class="qv-body" style="display:contents"></div><span class="qv-sr" aria-live="polite"></span></div>';
    document.body.appendChild(root);
    back = root.querySelector(".qv-back"); dlg = root.querySelector(".qv-dlg"); body = root.querySelector(".qv-body");
    prevB = root.querySelector(".qv-prev"); nextB = root.querySelector(".qv-next"); xB = root.querySelector(".qv-x");
    back.addEventListener("click", () => close());
    xB.addEventListener("click", () => close());
    prevB.addEventListener("click", () => step(-1));
    nextB.addEventListener("click", () => step(1));
    root.addEventListener("keydown", onKey);
    let sx = 0, sy = 0, st = 0;
    dlg.addEventListener("touchstart", e => { if (e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
    dlg.addEventListener("touchend", e => {
      if (!st || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      const tg = e.target.closest && e.target.closest(".sp-pads,.qv-3d,button,a"); const on3d = e.target.closest && e.target.closest(".qv-3d");
      st = 0;
      if (tg && !on3d && tg.tagName !== "DIV") { /* taps on controls */ }
      if (on3d || (e.target.closest && e.target.closest(".sp-pads"))) return; // 3D model drag / pads keep their own gestures
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  const visibleIds = () => {
    const ids = []; document.querySelectorAll("article.product").forEach(c => { if (c.offsetParent === null && getComputedStyle(c).position !== "fixed") return; const id = idOf(c); if (id && ids.indexOf(id) < 0) ids.push(id); });
    return ids;
  };
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    const tg = e.target; if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || "")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
    else if (e.key === "Tab") {
      const f = [...dlg.querySelectorAll('button:not([hidden]):not([disabled]),a[href],[tabindex="0"]')].filter(x => x.offsetParent !== null || x === document.activeElement);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === dlg)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  }

  function cleanup() {
    if (p3d) { try { p3d.destroy(); } catch (_) {} p3d = null; }
    try { window.SoundPads && SoundPads.stopAll(); } catch (_) {}
    if (ctl) { ctl.abort(); ctl = null; }
    if (body) body.innerHTML = "";
  }

  function step(dir) {
    if (closing || !order.length) return;
    const i = order.indexOf(curId); if (i < 0) return;
    const n = order[(i + dir + order.length) % order.length];
    if (n === curId) return;
    show(n, dir);
  }

  async function show(id, dir) {
    const my = ++tok; curId = String(id);
    cleanup();
    body.innerHTML = '<div class="qv-load">Loading…</div>';
    const p = await getProduct(id);
    if (my !== tok) return;
    if (!p) { body.innerHTML = '<div class="qv-load">This product could not be loaded.</div>'; return; }
    track("quickview-open", { id: String(id) });
    ctl = new AbortController();
    const m = model(p), href = "product.html?id=" + encodeURIComponent(p.id);
    const desc = String(p.description || "Digital download as ZIP file.").replace(/\s+/g, " ").trim();
    const short = desc.length > 220 ? desc.slice(0, 220).replace(/\s+\S*$/, "") + "…" : desc;
    const cur = String(p.currency || cfg.CURRENCY || "chf").toLowerCase();
    const was = Number(p.compare_at_cents) > p.price_cents ? "<s>" + money(p.compare_at_cents, p.currency) + "</s>" : "";
    const hasSp = !!(window.SoundPads && SoundPads.mountProduct && p.sound_preview);
    body.innerHTML =
      '<div class="qv-stage">' + (m ? '<div class="qv-3d"></div>' : p.image_url ? '<img src="' + esc(img(p.image_url)) + '" alt="' + esc(p.title) + '" width="600" height="600">' : '<div class="qv-emoji" aria-hidden="true">' + esc(p.cover_emoji || "") + '</div>') + '</div>' +
      '<div class="qv-info">' +
      (p.category ? '<p class="qv-cat">' + esc(String(p.category).replace(/[-_]/g, " ")) + '</p>' : "") +
      '<h2 class="qv-title">' + esc(p.title) + '</h2>' +
      '<div class="qv-rate" hidden></div>' +
      '<div class="qv-price">' + was + '<span>' + money(p.price_cents, p.currency) + '</span></div>' +
      '<p class="qv-hint">Bundle -15% with another product</p>' +
      '<p class="qv-desc">' + esc(short) + '</p>' +
      (hasSp ? '<div class="qv-sounds"><p class="qv-lbl">Try the sounds</p><div class="qv-sp"></div></div>' : "") +
      '<div class="qv-actions"><button type="button" class="button qv-add" data-qv-add></button><a class="outline qv-details" href="' + esc(href) + '">View details</a></div></div>';
    const sr = dlg.querySelector(".qv-sr"); if (sr) sr.textContent = p.title;
    dlg.setAttribute("aria-label", "Quick view: " + p.title);
    if (m && window.Product3D) { try { p3d = window.Product3D.mount(body.querySelector(".qv-3d"), m, { size: "large", alt: p.title }); } catch (_) { p3d = null; } }
    else if (m) { const s = body.querySelector(".qv-3d"); if (s && p.image_url) s.outerHTML = '<img src="' + esc(img(p.image_url)) + '" alt="' + esc(p.title) + '">'; }
    if (hasSp) { try { SoundPads.mountProduct(body.querySelector(".qv-sp"), p, { db: getDb() });  } catch (_) {} }
    // cart button
    const add = body.querySelector(".qv-add");
    const sync = () => {
      const on = !!(window.ylyCart && ylyCart.has(String(p.id)));
      add.textContent = on ? "In cart – Checkout" : "Add to cart";
      add.classList.toggle("qv-in", on);
    };
    sync();
    add.addEventListener("click", () => {
      if (!window.ylyCart) { location.href = href; return; }
      if (ylyCart.has(String(p.id))) { close(true); ylyCart.open(); return; }
      ylyCart.add({ id: String(p.id), title: p.title, price_cents: p.price_cents, currency: cur, cover: p.image_url ? img(p.image_url) : "" }, add);
      sync();
    });
    window.addEventListener("storage", sync, { signal: ctl.signal });
    const iv = setInterval(sync, 700); ctl.signal.addEventListener("abort", () => clearInterval(iv));
    getRating(String(p.id)).then(r => {
      if (my !== tok || !r) return;
      const el = body.querySelector(".qv-rate"); if (!el) return;
      el.hidden = false; el.innerHTML = stars(r.avg, 16) + '<span>' + r.avg.toFixed(1) + " (" + r.n + (r.n === 1 ? " review" : " reviews") + ")</span>";
    });
    const multi = order.length > 1; prevB.hidden = !multi; nextB.hidden = !multi;
    if (dir && !reduce && dlg.animate) dlg.animate([{ opacity: .4, transform: "translateX(" + (dir * 24) + "px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.22,1,.36,1)" });
    if (!dir) { try { xB.focus({ preventScroll: true }); } catch (_) {} }
  }

  function open(id, fromEl) {
    build();
    if (!root.hidden && !closing) return;
    closing = false;
    opener = fromEl || document.activeElement;
    order = visibleIds(); if (order.indexOf(String(id)) < 0) order.push(String(id));
    let rect = null;
    const card = fromEl && fromEl.closest && fromEl.closest("article.product"); if (card) rect = card.getBoundingClientRect();
    startRect = rect;
    root.hidden = false;
    document.documentElement.classList.add("qv-lock");
    void root.offsetWidth;
    root.classList.add("qv-open");
    if (!reduce && dlg.animate) {
      const r = dlg.getBoundingClientRect(); let from;
      if (window.innerWidth <= 720) from = { transform: "translateY(60%)", opacity: 0 };
      else if (rect) { const dx = rect.left + rect.width / 2 - (r.left + r.width / 2), dy = rect.top + rect.height / 2 - (r.top + r.height / 2); from = { transform: "translate(" + dx + "px," + dy + "px) scale(" + Math.max(.2, Math.min(.6, rect.width / r.width)) + ")", opacity: 0 }; }
      else from = { transform: "scale(.92)", opacity: 0 };
      dlg.animate([from, { transform: "none", opacity: 1 }], { duration: 480, easing: "cubic-bezier(.34,1.3,.64,1)" });
    }
    try { dlg.focus({ preventScroll: true }); } catch (_) {}
    show(id, 0);
  }

  function close(noFocus) {
    if (!root || root.hidden || closing) return;
    closing = true; tok++;
    cleanup();
    root.classList.remove("qv-open");
    const fin = () => { root.hidden = true; closing = false; document.documentElement.classList.remove("qv-lock"); };
    if (!reduce && dlg.animate) {
      const a = dlg.animate([{ transform: "none", opacity: 1 }, { transform: window.innerWidth <= 720 ? "translateY(40%)" : "scale(.94)", opacity: 0 }], { duration: 220, easing: "ease-in", fill: "forwards" });
      let done = false; const f2 = () => { if (done) return; done = true; fin(); try { a.cancel(); } catch (_) {} };
      a.onfinish = f2; setTimeout(f2, 300);
    } else fin();
    if (!noFocus && opener && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (_) {} }
  }

  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest(".qv-eye"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    open(b.dataset.qvId, b);
  }, true);

  function start() {
    inject();
    const box = document.getElementById("products") || document.body;
    if (window.MutationObserver) new MutationObserver(sched).observe(box, { childList: true, subtree: true });
    loadAll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.QuickView = { open: (id) => open(id, null), close };
})();

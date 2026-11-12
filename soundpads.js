/* soundpads.js - tappable one-shot preview pads for sound kits (shop cards + product page).
   Products opt in via shop_products.sound_preview = {bucket, folder, count, files?}.
   Web Audio: one shared AudioContext, decoded buffers, master gain + soft limiter. No inline code (CSP). */
(() => {
  "use strict";
  const AUDIO_RE = /\.(wav|mp3|ogg|m4a|aac|flac|aif|aiff)$/i;
  const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stats = { started: 0, ctxState: () => (ctx ? ctx.state : "none") };

  const PAD_IC = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/></svg>';

  /* ---------- audio engine (shared) ---------- */
  let ctx = null, master = null;
  const voices = new Set(); // {src, g}
  function getCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      const lim = ctx.createDynamicsCompressor(); // soft limiter
      lim.threshold.value = -10; lim.knee.value = 12; lim.ratio.value = 14; lim.attack.value = 0.003; lim.release.value = 0.18;
      master = ctx.createGain(); master.gain.value = 0.85;
      master.connect(lim); lim.connect(ctx.destination);
    } catch (_) { ctx = null; }
    return ctx;
  }
  function stopAll() {
    voices.forEach(v => { try { v.src.stop(); } catch (_) {} });
    voices.clear();
  }
  window.addEventListener("pagehide", stopAll);
  document.addEventListener("visibilitychange", () => { if (document.hidden) stopAll(); });

  /* ---------- sound lists (cached per product) ---------- */
  const listCache = new Map(), rawCache = new Map(), bufCache = new Map();
  const cfgOf = p => {
    let s = p && p.sound_preview;
    if (typeof s === "string") { try { s = JSON.parse(s); } catch (_) { s = null; } }
    return s && typeof s === "object" && (Array.isArray(s.files) ? s.files.length : (s.bucket && s.folder != null)) ? s : null;
  };
  const pick = (names, k) => { // evenly spaced selection from sorted names
    const a = names.slice().sort();
    if (a.length <= k) return a;
    if (k <= 1) return [a[0]];
    const out = [];
    for (let i = 0; i < k; i++) out.push(a[Math.round(i * (a.length - 1) / (k - 1))]);
    return out.filter((n, i) => out.indexOf(n) === i);
  };
  function resolve(db, p, k) {
    const s = cfgOf(p), key = String(p.id) + ":" + k;
    if (listCache.has(key)) return listCache.get(key);
    const bucket = s.bucket || "coverart-products", folder = String(s.folder || "").replace(/^\/+|\/+$/g, "");
    const urlOf = n => db.storage.from(bucket).getPublicUrl((folder ? folder + "/" : "") + n).data.publicUrl;
    const pr = (async () => {
      let names;
      if (Array.isArray(s.files) && s.files.length) names = s.files.filter(n => typeof n === "string" && AUDIO_RE.test(n));
      else {
        const { data, error } = await db.storage.from(bucket).list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
        if (error) throw error;
        names = (data || []).filter(x => x && x.id && x.name && x.name !== ".emptyFolderPlaceholder" && AUDIO_RE.test(x.name)).map(x => x.name);
      }
      return pick(names, k).map(n => ({ name: n, url: urlOf(n) }));
    })();
    listCache.set(key, pr);
    pr.catch(() => listCache.delete(key));
    return pr;
  }
  const raw = url => {
    if (!rawCache.has(url)) {
      const pr = fetch(url).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); });
      rawCache.set(url, pr); pr.catch(() => rawCache.delete(url));
    }
    return rawCache.get(url);
  };
  const decoded = url => { // decode only inside a gesture-created context
    if (!bufCache.has(url)) {
      const pr = raw(url).then(ab => new Promise((ok, no) => {
        const c = getCtx(); if (!c) return no(new Error("no audio"));
        const p = c.decodeAudioData(ab.slice(0), ok, no); if (p && p.catch) p.catch(no);
      })).then(buf => {
        let pk = 0; for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } }
        return { buf, gain: pk > 0.9 ? 0.9 / pk : 1 };
      });
      bufCache.set(url, pr); pr.catch(() => bufCache.delete(url));
    }
    return bufCache.get(url);
  };

  const tracked = new Set();
  const track = p => {
    const id = String(p.id); if (tracked.has(id)) return; tracked.add(id);
    window.ylyTrack && ylyTrack("soundpad-play", { product: id });
  };

  /* ---------- one widget = a set of pads for one product ---------- */
  function wire(root, padsEl, db, p, k) {
    const pads = [...padsEl.querySelectorAll(".sp-pad")];
    const active = {}; // pad index -> voice
    let entries = null, loading = null, prefetched = false;

    const ensure = () => {
      if (!loading) {
        pads.forEach(b => b.classList.add("sp-loading"));
        loading = resolve(db, p, k).then(list => {
          entries = list;
          pads.forEach((b, i) => { if (!list[i]) b.hidden = true; });
          return list;
        }).catch(() => { entries = []; pads.forEach(b => { b.classList.add("sp-err"); b.title = "Sounds not available"; }); return []; })
          .finally(() => pads.forEach(b => b.classList.remove("sp-loading")));
      }
      return loading;
    };
    const prefetch = () => {
      if (prefetched) return; prefetched = true;
      ensure().then(list => list.forEach((e, i) => {
        pads[i] && pads[i].classList.add("sp-loading");
        raw(e.url).catch(() => { pads[i] && pads[i].classList.add("sp-err"); }).finally(() => pads[i] && pads[i].classList.remove("sp-loading"));
      }));
    };
    root.addEventListener("pointerenter", prefetch);
    root.addEventListener("focusin", prefetch);
    root.addEventListener("touchstart", prefetch, { passive: true });

    const flash = b => {
      b.classList.remove("sp-hit"); void b.offsetWidth; b.classList.add("sp-lit");
      if (!reduce) {
        b.classList.add("sp-hit");
        const r = document.createElement("span"); r.className = "sp-ripple"; r.setAttribute("aria-hidden", "true"); b.appendChild(r);
        setTimeout(() => r.remove(), 600);
      }
      clearTimeout(b._spT); b._spT = setTimeout(() => b.classList.remove("sp-lit", "sp-hit"), reduce ? 160 : 420);
    };

    async function play(i) {
      const b = pads[i]; if (!b) return;
      const c = getCtx(); if (!c) return;
      try { if (c.state !== "running") c.resume(); } catch (_) {}
      flash(b);
      track(p);
      try {
        const list = await ensure(); const e = list[i]; if (!e) return;
        b.classList.add("sp-loading");
        let d; try { d = await decoded(e.url); } finally { b.classList.remove("sp-loading"); }
        if (c.state !== "running") { try { await c.resume(); } catch (_) {} }
        const prev = active[i];
        if (prev) { try { prev.g.gain.cancelScheduledValues(c.currentTime); prev.g.gain.setValueAtTime(prev.g.gain.value, c.currentTime); prev.g.gain.linearRampToValueAtTime(0, c.currentTime + 0.03); prev.src.stop(c.currentTime + 0.04); } catch (_) {} }
        const src = c.createBufferSource(), g = c.createGain();
        src.buffer = d.buf; g.gain.value = d.gain;
        src.connect(g); g.connect(master);
        const v = { src, g }; voices.add(v); active[i] = v;
        src.onended = () => { voices.delete(v); if (active[i] === v) delete active[i]; try { g.disconnect(); } catch (_) {} };
        src.start(); stats.started++;
      } catch (_) { b.classList.add("sp-err"); b.title = "Sound not available"; }
    }

    pads.forEach((b, i) => {
      let touched = 0;
      b.addEventListener("pointerdown", e => { if (e.button) return; touched = Date.now(); e.preventDefault(); e.stopPropagation(); play(i); });
      b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); if (Date.now() - touched > 700) play(i); }); // keyboard / assistive click
    });
    root.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey || !/^[1-9]$/.test(e.key)) return;
      const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || "")) return;
      const i = +e.key - 1; if (!pads[i] || pads[i].hidden) return;
      play(i);
    });
  }

  const padHtml = (n, title, cls) => Array.from({ length: n }, (_, i) =>
    `<button type="button" class="sp-pad${cls || ""}" aria-label="Play sound ${i + 1} of ${esc(title)}"><span class="sp-num" aria-hidden="true">${i + 1}</span></button>`).join("");

  /* ---------- shop cards ---------- */
  function attach(box, products, opts) {
    const db = opts && opts.db; if (!db || !box) return;
    box.querySelectorAll("article.product").forEach(card => {
      if (card.querySelector(".sp-layer")) return;
      const cover = card.querySelector(".cover[data-pid],.cover");
      const btn = card.querySelector("[data-buy]");
      const p = btn && products.find(x => String(x.id) === btn.dataset.buy);
      const s = p && cfgOf(p); if (!s) return;
      const k = Math.max(1, Math.min(6, Number(s.count) || 6, Array.isArray(s.files) && s.files.length ? s.files.length : 6));
      const layer = document.createElement("div");
      layer.className = "sp-layer";
      layer.innerHTML = `<button type="button" class="sp-pill" aria-expanded="false" aria-label="Play sounds of ${esc(p.title)}">${PAD_IC}<span>Play sounds</span></button><div class="sp-pads" role="group" aria-label="Sound preview pads">${padHtml(k, p.title)}</div>`;
      card.appendChild(layer);
      const pill = layer.querySelector(".sp-pill");
      pill.addEventListener("click", e => {
        e.preventDefault(); e.stopPropagation();
        const on = layer.classList.toggle("sp-open"); pill.setAttribute("aria-expanded", on ? "true" : "false");
      });
      wire(card, layer.querySelector(".sp-pads"), db, p, k);
    });
  }
  document.addEventListener("pointerdown", e => { // tap outside closes opened pad rows
    document.querySelectorAll(".sp-layer.sp-open").forEach(l => {
      if (!l.contains(e.target)) { l.classList.remove("sp-open"); const b = l.querySelector(".sp-pill"); if (b) b.setAttribute("aria-expanded", "false"); }
    });
  });

  /* ---------- product page ---------- */
  function mountProduct(el, p, opts) {
    const db = opts && opts.db; const s = p && cfgOf(p);
    if (!el || !db || !s) return;
    const base = Math.max(1, Number(s.count) || 6);
    const k = Math.min(8, base + 2, Array.isArray(s.files) && s.files.length ? s.files.length : 8);
    el.className = "sp-row";
    el.innerHTML = `<p class="eyebrow">Try the sounds</p><div class="sp-pads sp-pads-lg" role="group" aria-label="Sound preview pads">${padHtml(k, p.title, " sp-pad-lg")}</div><p class="fineprint sp-hint">Tap a pad to hear a one-shot from this kit.</p>`;
    wire(el, el.querySelector(".sp-pads"), db, p, k);
  }

  window.SoundPads = { attach, mountProduct, stopAll, stats };
})();

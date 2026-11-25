/* gumball.js - UI for the Gumball Lab tool. Talks ONLY to window.GumballEngine (see gumball-engine.js). */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const Engine = window.GumballEngine;
  const yr = $("year"); if (yr) yr.textContent = new Date().getFullYear();

  // ---------------------------------------------------------------- constants
  const MAX_TRACKS = 8, MAX_SECONDS = 180;
  const EXT_RE = /\.(wav|mp3|aiff?|m4a)$/i;
  const UNLOCK_KEY = "yly_gumball_unlocked";
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const TYPES = [
    ["kick", "Kicks", "Kick", "Kick"], ["snare", "Snares", "Snare", "Snare"], ["clap", "Claps", "Clap", "Clap"],
    ["hat", "Hats", "Hat", "Hat"], ["openhat", "Open Hats", "OpenHat", "Open hat"], ["perc", "Percs", "Perc", "Perc"],
    ["808", "808s", "808", "808"], ["vocal", "Vocals", "Vocal", "Vocal"], ["fx", "FX", "FX", "FX"]
  ];
  const T = {}; TYPES.forEach(([id, folder, sing, label], i) => { T[id] = { id, folder, sing, label, order: i }; });
  const RARITY = { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" };
  const ICON = {
    play: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/></svg>',
    dice: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    wave: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h1.5M8 8v8M12 5v14M16 8v8M20 11v2"/></svg>'
  };
  // Umami events via the site helper (nav.js). Only counts and generic labels: never file names or emails.
  const track = (n, d) => { try { if (window.ylyTrack) { if (d) window.ylyTrack(n, d); else window.ylyTrack(n); } } catch (_) {} };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmtDur = s => (s == null ? "–" : Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0"));
  const fmtSize = b => b < 1048576 ? Math.max(1, Math.round(b / 1024)) + " KB" : (b / 1048576).toFixed(1) + " MB";

  // ---------------------------------------------------------------- state
  const S = {
    step: 1, files: [], nextId: 1, scanning: false, session: null, dirty: true,
    picks: [],            // [{key, hitId, variantId|null}] in pick order
    cur: {},              // hitId -> variantId|null currently shown on the card
    variants: {},         // hitId -> {variantId: variant}
    filter: "all",
    unlocked: false, built: null, building: false
  };
  try { S.unlocked = localStorage.getItem(UNLOCK_KEY) === "1"; } catch (_) {}

  // ---------------------------------------------------------------- announcements
  let liveT = 0;
  function say(msg) { const el = $("gb-live"); el.textContent = ""; clearTimeout(liveT); liveT = setTimeout(() => { el.textContent = msg; }, 40); }

  // ---------------------------------------------------------------- pack naming + ZIP (from the working pick.html prototype)
  const WORDS_A = ["Velvet", "Dusty", "Neon", "Sunken", "Hazy", "Mellow", "Rusty", "Cosmic", "Paper", "Midnight", "Honey", "Lazy", "Electric", "Frosted", "Golden", "Hollow", "Wobbly", "Silver", "Cherry", "Dizzy"];
  const WORDS_B = ["Rodeo", "Lantern", "Comet", "Orchard", "Carousel", "Harbor", "Mirage", "Pinball", "Satellite", "Lagoon", "Jukebox", "Meadow", "Arcade", "Monsoon", "Marble", "Caravan", "Voyage", "Cactus", "Gumdrop", "Moonlight"];
  function genName() {
    const cur = $("gb-pname").value.trim();
    for (let i = 0; i < 12; i++) {
      const n = WORDS_A[Math.floor(Math.random() * WORDS_A.length)] + " " + WORDS_B[Math.floor(Math.random() * WORDS_B.length)];
      if (n !== cur) return n;
    }
    return "Velvet Rodeo";
  }
  function sanitizeName(s, fb) {
    s = String(s || "").replace(/[\/\\:*?"<>|\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim();
    if (s.length > 60) s = s.slice(0, 60).trim();
    s = s.replace(/[. ]+$/, "");
    return s || fb;
  }
  const stemOf = name => name.replace(/[^A-Za-z0-9 ]/g, "-").replace(/ /g, "_");
  function packName() { return sanitizeName($("gb-pname").value, S.session ? sanitizeName(S.session.suggestedName, "Gumball Pack") : "Gumball Pack"); }
  const hitById = id => S.session.hits.find(h => h.id === id);

  /* file plan: numbering per type in pick order, note suffix only for tonal hits. */
  function buildPlan() {
    const name = packName(), stem = stemOf(name), counter = {}, entries = [];
    for (const p of S.picks) {
      const h = hitById(p.hitId); if (!h) continue;
      const num = (counter[h.type] = (counter[h.type] || 0) + 1), nn = String(num).padStart(2, "0");
      let fn = stem + "_" + T[h.type].sing + "_" + nn;
      if (h.tonal && h.note) fn += "_" + h.note.replace(/[0-9\-]+$/, "");
      fn += ".wav";
      const v = p.variantId ? (S.variants[p.hitId] || {})[p.variantId] : null;
      entries.push({ key: p.key, hitId: p.hitId, variantId: p.variantId, type: h.type, folder: T[h.type].folder, file: fn, path: T[h.type].folder + "/" + fn, variant: v });
    }
    entries.sort((a, b) => T[a.type].order - T[b.type].order);   // stable: keeps pick order inside a folder
    return { name, zipName: name + ".zip", entries };
  }
  let CRC = null;
  function crc32(u8) {
    if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0;
  }
  /* STORE-only ZIP writer (WAV does not compress well). files: [{name, data:Uint8Array}] */
  function makeZip(files) {
    const enc = new TextEncoder(), d = new Date();
    const dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    let total = 22; files.forEach(f => { total += f.data.length + 2 * enc.encode(f.name).length + 76; });
    if (total >= 0xFFFFFFFF) throw new Error("This pack is larger than 4 GB. Pick fewer sounds.");
    const parts = [], central = []; let off = 0;
    for (const f of files) {
      const nb = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new Uint8Array(30 + nb.length), v = new DataView(lh.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true); v.setUint16(10, tm, true); v.setUint16(12, dt, true);
      v.setUint32(14, crc, true); v.setUint32(18, sz, true); v.setUint32(22, sz, true); v.setUint16(26, nb.length, true); v.setUint16(28, 0, true); lh.set(nb, 30);
      parts.push(lh, f.data);
      const ch = new Uint8Array(46 + nb.length), c = new DataView(ch.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
      c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true); ch.set(nb, 46); central.push(ch);
      off += lh.length + sz;
    }
    let cs = 0; central.forEach(c => { parts.push(c); cs += c.length; });
    const e = new Uint8Array(22), ev = new DataView(e.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cs, true); ev.setUint32(16, off, true);
    parts.push(e);
    return parts;
  }

  // ---------------------------------------------------------------- steps
  const stepEls = { 1: $("gb-s1"), 2: $("gb-s2"), 3: $("gb-s3") };
  function setStep(n, opts) {
    opts = opts || {};
    S.step = n;
    Object.keys(stepEls).forEach(k => stepEls[k].classList.toggle("hidden", +k !== n));
    refreshStepper();
    refreshBar();
    if (n !== 2) stopPlay();
    if (n === 3) renderStep3();
    if (opts.focus !== false) {
      const h = $("gb-h" + n);
      try { h.focus({ preventScroll: true }); } catch (_) {}
      const top = $("gumball").getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? "auto" : "smooth" });
    }
  }
  function refreshStepper() {
    const doneUpTo = S.step - 1 + (S.step === 3 && S.built ? 1 : 0);
    document.querySelectorAll("#gb-stepper li").forEach(li => {
      const n = +li.dataset.step, b = li.querySelector("button");
      const done = n <= doneUpTo, cur = n === S.step;
      li.classList.toggle("done", done && !cur); li.classList.toggle("current", cur);
      li.classList.toggle("busy", cur && (S.scanning || S.building));
      const reachable = (n === 1) || (n === 2 && !!S.session) || (n === 3 && !!S.session && S.picks.length > 0 && !!S.built);
      b.disabled = cur ? false : !(reachable && !S.scanning);
      if (cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      // keep the number visible for the current step even when done (step 3 after success)
      if (done && cur) li.classList.add("done");
    });
  }
  $("gb-stepper").addEventListener("click", e => {
    const li = e.target.closest("li"); if (!li) return;
    const n = +li.dataset.step; if (n === S.step || e.target.closest("button").disabled) return;
    setStep(n);
  });

  // ---------------------------------------------------------------- Step 1: files
  const slotsEl = $("gb-slots"), errEl = $("gb-errors");
  function addError(msg, kind) {
    track("gumball-error", { kind: kind || "file" });
    const li = document.createElement("li"); li.textContent = msg; errEl.appendChild(li);
    while (errEl.children.length > 5) errEl.removeChild(errEl.firstChild);
  }
  function clearErrors() { errEl.textContent = ""; }

  function readDuration(file) {
    return new Promise(res => {
      let done = false, url;
      const fin = v => { if (done) return; done = true; try { URL.revokeObjectURL(url); } catch (_) {} a.removeAttribute("src"); res(v); };
      const a = new Audio(); a.preload = "metadata";
      try { url = URL.createObjectURL(file); } catch (_) { return res(null); }
      a.onloadedmetadata = () => fin(isFinite(a.duration) ? a.duration : null);
      a.onerror = () => fin(null);
      setTimeout(() => fin(null), 3500);
      a.src = url;
    });
  }

  async function addFiles(list) {
    if (S.scanning) return;
    clearErrors();
    const incoming = Array.from(list || []);
    let tooMany = 0; const before = S.files.filter(x => !x.demo).length;
    for (const f of incoming) {
      if (!EXT_RE.test(f.name)) { addError(`"${f.name}" is not a supported format. Use WAV, MP3, AIFF or M4A.`); continue; }
      if (S.files.some(x => x.file && x.file.name === f.name && x.file.size === f.size)) { addError(`"${f.name}" is already in your list.`); continue; }
      if (S.files.length >= MAX_TRACKS) { tooMany++; continue; }
      const dur = await readDuration(f);
      if (dur != null && dur > MAX_SECONDS) { addError(`"${f.name}" is ${fmtDur(dur)} long. Tracks can be up to 3 minutes. Trim it or bounce a shorter section.`); continue; }
      if (S.files.length >= MAX_TRACKS) { tooMany++; continue; }
      if (S.files.some(x => x.demo)) S.files = S.files.filter(x => !x.demo); // dropping your own files replaces the demo set
      S.files.push({ id: S.nextId++, file: f, name: f.name.replace(/\.[^.]+$/, ""), duration: dur, status: "ready", progress: 0 });
      S.dirty = true;
    }
    const added = S.files.filter(x => !x.demo).length - before;
    if (added > 0) track("gumball-add-tracks", { count: added });
    if (tooMany) addError(`Gumball takes up to ${MAX_TRACKS} tracks at a time. ${tooMany} file${tooMany > 1 ? "s were" : " was"} skipped.`);
    renderSlots();
  }

  function renderSlots() {
    const rows = [];
    for (let i = 0; i < MAX_TRACKS; i++) {
      const f = S.files[i];
      if (!f) { rows.push(`<li class="gb-slot is-empty"><span class="gb-slot-n">${i + 1}</span><span class="gb-slot-name">Empty slot</span></li>`); continue; }
      const st = f.status;
      rows.push(`<li class="gb-slot ${st === "analysing" ? "is-busy" : ""} ${st === "done" ? "is-done" : ""}" data-id="${f.id}">
        <span class="gb-slot-n">${i + 1}</span>
        <span class="gb-slot-main"><span class="gb-slot-name" title="${esc(f.name)}">${esc(f.name)}</span>
          <span class="gb-slot-meta">${f.demo ? "Demo stem · " : ""}${fmtDur(f.duration)}${st === "analysing" ? " · analysing" : st === "done" ? " · done" : ""}</span>
          ${st === "analysing" || st === "done" ? `<span class="gb-slot-bar" aria-hidden="true"><i style="width:${Math.round(f.progress * 100)}%"></i></span>` : ""}
        </span>
        <button type="button" class="gb-icon-btn" data-remove="${f.id}" aria-label="Remove ${esc(f.name)}" ${S.scanning ? "disabled" : ""}>${ICON.x}</button>
      </li>`);
    }
    slotsEl.innerHTML = rows.join("");
    $("gb-count").textContent = `${S.files.length} of ${MAX_TRACKS}`;
    const find = $("gb-find");
    if (S.scanning) { find.disabled = true; find.textContent = "Analysing …"; }
    else if (S.session && !S.dirty) { find.disabled = false; find.textContent = "Continue to sounds"; }
    else { find.disabled = S.files.length === 0; find.textContent = "Find sounds"; }
    $("gb-demo").disabled = S.scanning; $("gb-demo-m").disabled = S.scanning;
    $("gb-drop").classList.toggle("is-disabled", S.scanning);
    $("gb-file").disabled = S.scanning;
    refreshStepper();
  }
  slotsEl.addEventListener("click", e => {
    const b = e.target.closest("[data-remove]"); if (!b || S.scanning) return;
    const id = +b.dataset.remove, i = S.files.findIndex(f => f.id === id);
    if (i >= 0) { const name = S.files[i].name; S.files.splice(i, 1); S.dirty = true; renderSlots(); say(`Removed ${name}.`); }
  });

  const drop = $("gb-drop"), fileIn = $("gb-file");
  fileIn.addEventListener("change", () => { addFiles(fileIn.files); fileIn.value = ""; });
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); if (!S.scanning) drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
  // a file dropped next to the zone must not navigate away from the page
  ["dragover", "drop"].forEach(ev => window.addEventListener(ev, e => { if (!drop.contains(e.target)) e.preventDefault(); }));

  $("gb-find").addEventListener("click", () => {
    if (S.session && !S.dirty) { setStep(2); return; }
    runScan();
  });
  $("gb-demo").addEventListener("click", startDemo);
  $("gb-demo-m").addEventListener("click", startDemo);

  async function startDemo() {
    if (S.scanning) return;
    clearErrors(); $("gb-scan-err").classList.add("hidden");
    track("gumball-demo");
    try {
      const tracks = await Engine.demoTracks();
      S.files = tracks.map(t => ({ id: S.nextId++, demo: true, meta: t, name: t.name, duration: t.duration, status: "ready", progress: 0 }));
      S.dirty = true; renderSlots();
      runScan();
    } catch (e) { showScanError(e); }
  }

  function showScanError(e) {
    track("gumball-error", { kind: e && e.code === "engine-unavailable" ? "engine" : "scan" });
    const el = $("gb-scan-err");
    el.textContent = (e && e.message ? e.message : "Something went wrong.") + (e && e.noRetry ? "" : " Please try again.");
    el.classList.remove("hidden");
  }

  async function runScan() {
    if (S.scanning || !S.files.length) return;
    S.scanning = true; $("gb-scan-err").classList.add("hidden");
    S.files.forEach(f => { f.status = "ready"; f.progress = 0; });
    const scanBox = $("gb-scan"); scanBox.classList.remove("hidden");
    const n = S.files.length, t0 = performance.now();
    const upd = () => {
      const sum = S.files.reduce((a, f) => a + f.progress, 0) / n, pct = Math.round(sum * 100);
      const done = S.files.filter(f => f.status === "done").length;
      $("gb-scan-fill").style.width = pct + "%"; $("gb-scan-pct").textContent = pct + "%";
      $("gb-scan-text").textContent = `Analysing track ${Math.min(done + 1, n)} of ${n} …`;
    };
    renderSlots(); upd();
    try {
      const session = await Engine.scan(S.files.map(f => f.file || f.meta), p => {
        const f = S.files[p.index]; if (!f) return;
        f.progress = p.progress; f.status = p.progress >= 1 ? "done" : "analysing";
        upd(); renderSlots();
      });
      S.files.forEach(f => { f.status = "done"; f.progress = 1; });
      Object.keys(bufCache).forEach(k => { delete bufCache[k]; }); Object.keys(peaksCache).forEach(k => { delete peaksCache[k]; }); // hit ids repeat between scans
      S.session = session; S.dirty = false; S.picks = []; S.cur = {}; S.variants = {}; S.built = null; S.filter = "all";
      S.scanning = false;
      scanBox.classList.add("hidden");
      renderSlots(); buildResults();
      say(`Found ${session.hits.length} sounds.`);
      track("gumball-scan-done", { sounds: session.hits.length, tracks: n, seconds: Math.round((performance.now() - t0) / 100) / 10, demo: !!session.demo });
      setStep(2);
    } catch (e) {
      S.scanning = false; scanBox.classList.add("hidden");
      S.files.forEach(f => { f.status = "ready"; f.progress = 0; });
      renderSlots(); showScanError(e);
    }
  }

  // ---------------------------------------------------------------- Step 2: results
  const grid = $("gb-grid"); const cards = {};
  const peaksCache = {};   // "hitId|variantId" -> peaks
  let ACCENT = "#8fa2ff", MUTED = "#c4bccf";
  function readColors() { const cs = getComputedStyle(document.body); ACCENT = cs.getPropertyValue("--accent").trim() || ACCENT; MUTED = cs.getPropertyValue("--muted").trim() || MUTED; }

  function sortedHits() {
    return S.session.hits.slice().sort((a, b) => (T[a.type].order - T[b.type].order) || (b.quality - a.quality) || (b.merged - a.merged));
  }
  function buildResults() {
    readColors();
    const hits = sortedHits();
    $("gb-summary").textContent = `Found ${hits.length} sound${hits.length === 1 ? "" : "s"} in ${S.files.length} track${S.files.length === 1 ? "" : "s"}`;
    const demo = !!S.session.demo;
    $("gb-banner").classList.toggle("hidden", !demo);
    $("gb-banner-extra").innerHTML = `these sounds come from <a href="${esc("clouds-vol-01.html")}">Clouds Vol. 01</a>, our drum kit. Drop your own stems to analyse them for real.`;
    grid.innerHTML = ""; Object.keys(cards).forEach(k => delete cards[k]);
    if (!hits.length) {
      grid.innerHTML = "";
      $("gb-empty").textContent = "Gumball did not find any one-shots in these tracks. Try single-sound stems or recordings."; $("gb-empty").classList.remove("hidden");
    } else $("gb-empty").classList.add("hidden");
    hits.forEach(h => {
      const el = document.createElement("article");
      el.className = "gb-card"; el.tabIndex = 0; el.setAttribute("role", "listitem"); el.dataset.id = h.id;
      el.innerHTML = `
        <div class="gb-card-top"><span class="gb-type">${esc(T[h.type].label)}</span><span class="gb-meta">${h.tonal && h.note ? esc(h.note) + " · " : ""}${h.dur.toFixed(2)} s</span></div>
        <div class="gb-wave">
          <button type="button" class="gb-play" tabindex="-1" aria-label="Play ${esc(T[h.type].label)} from ${esc(h.trackName)}">${ICON.play}</button>
          <div class="gb-canvas"><canvas width="240" height="64" aria-hidden="true"></canvas><i class="gb-playhead" aria-hidden="true"></i></div>
        </div>
        <p class="gb-src" title="${esc(h.trackName)}">${esc(h.trackName)}</p>
        ${h.merged > 1 ? `<p class="gb-merged">merged from ${h.merged}</p>` : ""}
        <div class="gb-flav hidden">
          <div class="gb-flav-row"><span class="gb-fname"></span><span class="gb-rar"></span></div>
          <p class="gb-fdesc"></p>
        </div>
        <p class="gb-also hidden"></p>
        <div class="gb-card-foot">
          <button type="button" class="gb-dice" tabindex="-1" aria-label="Roll a flavour for this ${esc(T[h.type].label)}">${ICON.dice}<span>Roll flavour</span></button>
          <button type="button" class="gb-orig hidden" tabindex="-1">Original</button>
          <button type="button" class="gb-pick" tabindex="-1" aria-pressed="false">${ICON.plus}<span>Add to pack</span></button>
        </div>`;
      grid.appendChild(el); cards[h.id] = el;
      S.cur[h.id] = null;
      drawWave(h.id);
      updateCard(h.id);
    });
    buildChips();
    applyFilter();
    refreshBar();
  }

  function peaksFor(hitId) {
    const vid = S.cur[hitId], key = hitId + "|" + (vid || "");
    if (peaksCache[key]) return peaksCache[key];
    return hitById(hitId).thumb;   // variants show the original shape until their audio has been decoded
  }
  function drawWave(hitId) {
    const card = cards[hitId]; if (!card) return;
    const cv = card.querySelector("canvas"), ctx = cv.getContext("2d"), W = cv.width, H = cv.height, mid = H / 2;
    const p = peaksFor(hitId), bins = Math.floor(p.length / 2), bw = W / bins;
    ctx.clearRect(0, 0, W, H);
    const picked = isPicked(hitId, S.cur[hitId]) || playing.hitId === hitId;
    ctx.fillStyle = picked ? ACCENT : MUTED; ctx.globalAlpha = picked ? 0.95 : 0.7;
    for (let b = 0; b < bins; b++) {
      const mn = p[b * 2], mx = p[b * 2 + 1];
      const top = mid - Math.max(0.04, mx) * (mid - 3), bot = mid - Math.min(-0.04, mn) * (mid - 3);
      ctx.fillRect(b * bw + 1, top, Math.max(1.5, bw - 2), Math.max(2, bot - top));
    }
    ctx.globalAlpha = 1;
  }
  function peaksFromBuffer(buf) {
    const d = buf.getChannelData(0), bins = 48, step = Math.max(1, Math.floor(d.length / bins)), out = [];
    let big = 1e-6;
    for (let b = 0; b < bins; b++) {
      let mn = 0, mx = 0;
      for (let i = b * step, e = Math.min(d.length, i + step); i < e; i++) { if (d[i] < mn) mn = d[i]; if (d[i] > mx) mx = d[i]; }
      out.push(mn, mx); big = Math.max(big, -mn, mx);
    }
    return out.map(v => +(v / big).toFixed(3));
  }

  const keyOf = (hitId, vid) => hitId + ":" + (vid || "o");
  const isPicked = (hitId, vid) => S.picks.some(p => p.key === keyOf(hitId, vid));
  const anyPicked = hitId => S.picks.some(p => p.hitId === hitId);

  function updateCard(hitId) {
    const el = cards[hitId]; if (!el) return;
    const h = hitById(hitId), vid = S.cur[hitId], v = vid ? S.variants[hitId][vid] : null;
    const picked = isPicked(hitId, vid);
    el.classList.toggle("is-picked", picked);
    const pk = el.querySelector(".gb-pick");
    pk.setAttribute("aria-pressed", picked ? "true" : "false");
    pk.innerHTML = (picked ? ICON.check : ICON.plus) + `<span>${picked ? "In pack" : "Add to pack"}</span>`;
    pk.setAttribute("aria-label", (picked ? "Remove from pack: " : "Add to pack: ") + (v ? v.flavour + " " : "Original ") + T[h.type].label);
    const fl = el.querySelector(".gb-flav"); fl.classList.toggle("hidden", !v);
    el.querySelector(".gb-orig").classList.toggle("hidden", !v);
    if (v) {
      el.querySelector(".gb-fname").textContent = v.flavour;
      const r = el.querySelector(".gb-rar"); r.textContent = RARITY[v.rarity] || v.rarity; r.dataset.rarity = v.rarity;
      el.querySelector(".gb-fdesc").textContent = v.desc || "";
    }
    el.dataset.rarity = v ? v.rarity : "";
    const also = el.querySelector(".gb-also");
    const others = S.picks.filter(p => p.hitId === hitId && p.key !== keyOf(hitId, vid));
    if (!picked || others.length) {
      if (others.length) { also.textContent = others.length === 1 ? (others[0].variantId ? "A flavour of this sound is in your pack" : "The original is in your pack") : others.length + " other versions are in your pack"; also.classList.remove("hidden"); }
      else also.classList.add("hidden");
    } else also.classList.add("hidden");
    drawWave(hitId);
  }

  function buildChips() {
    const counts = {}; S.session.hits.forEach(h => { counts[h.type] = (counts[h.type] || 0) + 1; });
    const total = S.session.hits.length;
    const chips = [["all", "All", total]].concat(TYPES.filter(t => counts[t[0]]).map(t => [t[0], t[1], counts[t[0]]]));
    if (S.filter !== "all" && !counts[S.filter]) S.filter = "all";
    $("gb-chips").innerHTML = chips.map(([id, label, n]) => `<button type="button" class="cm-pill gb-chip${S.filter === id ? " active" : ""}" data-f="${id}" aria-pressed="${S.filter === id}">${esc(label)} <span>${n}</span></button>`).join("");
  }
  $("gb-chips").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    S.filter = b.dataset.f; buildChips(); applyFilter();
    say(b.textContent.trim() + " shown.");
  });
  function applyFilter() {
    let visible = 0;
    Object.keys(cards).forEach(id => {
      const h = hitById(id), show = S.filter === "all" || h.type === S.filter;
      cards[id].hidden = !show; if (show) visible++;
    });
    $("gb-empty").classList.toggle("hidden", visible > 0 || !S.session.hits.length);
    if (!visible && S.session.hits.length) $("gb-empty").textContent = "No sounds of this type. Try another filter.";
  }

  // ---- audio playback (one sound at a time)
  let actx = null; const bufCache = {}; let playing = { hitId: null, src: null, token: 0 };
  function ctx() {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error("Your browser cannot play audio here."); actx = new AC(); }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  async function decoded(hitId, vid) {
    const key = hitId + "|" + (vid || "");
    if (!bufCache[key]) {
      bufCache[key] = (async () => {
        const ab = await Engine.getAudio(hitId, vid || null);
        const buf = await new Promise((res, rej) => { const p = ctx().decodeAudioData(ab, res, rej); if (p && p.catch) p.catch(rej); });
        peaksCache[key] = peaksFromBuffer(buf);
        return buf;
      })().catch(e => { delete bufCache[key]; throw e; });
    }
    return bufCache[key];
  }
  function stopPlay() {
    const prev = playing.hitId;
    playing.token++;
    if (playing.src) { try { playing.src.onended = null; playing.src.stop(); } catch (_) {} }
    playing = { hitId: null, src: null, token: playing.token };
    if (prev && cards[prev]) setPlayUI(prev, false);
  }
  function setPlayUI(hitId, on, dur) {
    const el = cards[hitId]; if (!el) return;
    el.classList.toggle("is-playing", on);
    const b = el.querySelector(".gb-play");
    b.innerHTML = on ? ICON.stop : ICON.play;
    const h = hitById(hitId);
    b.setAttribute("aria-label", (on ? "Stop " : "Play ") + T[h.type].label + " from " + h.trackName);
    const ph = el.querySelector(".gb-playhead");
    ph.style.animation = "none"; void ph.offsetWidth;
    if (on && dur) ph.style.animation = `gb-sweep ${dur}s linear forwards`;
    drawWave(hitId);
  }
  async function play(hitId, force) {
    if (!force && playing.hitId === hitId) { stopPlay(); return; }
    stopPlay();
    const token = ++playing.token, vid = S.cur[hitId], el = cards[hitId];
    el.classList.add("is-loading");
    try {
      const buf = await decoded(hitId, vid);
      if (token !== playing.token || S.cur[hitId] !== vid) return;  // user moved on
      const src = ctx().createBufferSource(); src.buffer = buf; src.connect(ctx().destination);
      src.onended = () => { if (playing.src === src) { playing = { hitId: null, src: null, token: playing.token }; setPlayUI(hitId, false); } };
      playing = { hitId, src, token };
      src.start(0);
      setPlayUI(hitId, true, buf.duration);
      drawWave(hitId);
    } catch (e) {
      track("gumball-error", { kind: "play" });
      say("Could not play this sound. " + (e && e.message ? e.message : ""));
      el.classList.add("has-error");
      setTimeout(() => el.classList.remove("has-error"), 2500);
    } finally { el.classList.remove("is-loading"); }
  }

  async function roll(hitId) {
    const el = cards[hitId]; if (!el || el.classList.contains("is-rolling")) return;
    el.classList.add("is-rolling"); el.setAttribute("aria-busy", "true");
    try {
      const [v] = await Promise.all([Engine.roll(hitId, null), wait(reduceMotion() ? 0 : 420)]);
      if (S.cur[hitId] === v.id) { backToOriginal(hitId); say("Back to the original."); return; }   // demo: one flavour per sound, rolling again toggles it
      (S.variants[hitId] = S.variants[hitId] || {})[v.id] = v;
      S.cur[hitId] = v.id;
      track("gumball-roll", { flavour: v.flavour, rarity: v.rarity });
      updateCard(hitId);
      say(`${v.flavour}, ${RARITY[v.rarity] || v.rarity}.`);
      await play(hitId, true);
      drawWave(hitId); // peaks of the variant are known once decoded
    } catch (e) {
      track("gumball-error", { kind: "roll" });
      say("Could not roll a flavour. " + (e && e.message ? e.message : ""));
    } finally { el.classList.remove("is-rolling"); el.removeAttribute("aria-busy"); }
  }
  function backToOriginal(hitId) { S.cur[hitId] = null; updateCard(hitId); play(hitId, true); }

  function togglePick(hitId) {
    const vid = S.cur[hitId], k = keyOf(hitId, vid), i = S.picks.findIndex(p => p.key === k), h = hitById(hitId);
    const label = (vid ? S.variants[hitId][vid].flavour + " " : "") + T[h.type].label;
    if (i >= 0) { S.picks.splice(i, 1); say(`${label} removed. ${S.picks.length} in pack.`); }
    else { S.picks.push({ key: k, hitId, variantId: vid }); say(`${label} added. ${S.picks.length} in pack.`); track("gumball-pick", { type: h.type, flavoured: !!vid }); }
    packChanged(); updateCard(hitId);
  }
  function removePick(key) {
    const i = S.picks.findIndex(p => p.key === key); if (i < 0) return;
    const hitId = S.picks[i].hitId; S.picks.splice(i, 1);
    packChanged(); if (cards[hitId]) updateCard(hitId);
    say(`Removed from pack. ${S.picks.length} in pack.`);
  }
  function packChanged() { S.built = null; refreshBar(); if (S.step === 3) { if (!S.picks.length) setStep(2, { focus: false }); else renderStep3(); } refreshStepper(); }

  $("gb-best").addEventListener("click", () => {
    const best = {};
    sortedHits().forEach(h => { if (!best[h.type]) best[h.type] = h; });
    let added = 0;
    Object.values(best).forEach(h => { if (!isPicked(h.id, null)) { S.picks.push({ key: keyOf(h.id, null), hitId: h.id, variantId: null }); added++; } });
    Object.keys(cards).forEach(updateCard); packChanged();
    say(added ? `Picked the best sound of each type. ${S.picks.length} in pack.` : "The best of each type are already in your pack.");
  });
  $("gb-clear").addEventListener("click", () => {
    if (!S.picks.length) return;
    S.picks = []; Object.keys(cards).forEach(updateCard); packChanged(); say("Pack cleared.");
  });
  $("gb-back1").addEventListener("click", () => setStep(1));
  $("gb-back2").addEventListener("click", () => setStep(2));

  // ---- card interaction
  grid.addEventListener("click", e => {
    const card = e.target.closest(".gb-card"); if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest(".gb-pick")) { togglePick(id); return; }
    if (e.target.closest(".gb-dice")) { roll(id); return; }
    if (e.target.closest(".gb-orig")) { backToOriginal(id); return; }
    card.focus({ preventScroll: true });
    play(id);
  });
  grid.addEventListener("keydown", e => {
    const card = e.target.closest(".gb-card"); if (!card) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const id = card.dataset.id, onBtn = e.target.closest("button");
    const vis = Array.from(grid.querySelectorAll(".gb-card:not([hidden])")), i = vis.indexOf(card);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { const n = vis[i + (e.key === "ArrowRight" ? 1 : -1)]; if (n) n.focus(); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const r = card.getBoundingClientRect(), dir = e.key === "ArrowDown" ? 1 : -1; let best = null, bd = 1e9;
      vis.forEach(c => { const q = c.getBoundingClientRect(); if (dir > 0 ? q.top > r.bottom - 4 : q.bottom < r.top + 4) { const d = Math.abs(q.top - r.top) * 3 + Math.abs(q.left - r.left); if (d < bd) { bd = d; best = c; } } });
      if (best) best.focus(); e.preventDefault();
    }
    else if (e.key === " " && !onBtn) { play(id); e.preventDefault(); }
    else if (e.key === "Enter" && !onBtn) { togglePick(id); e.preventDefault(); }
    else if ((e.key === "d" || e.key === "D") && !e.shiftKey) { roll(id); e.preventDefault(); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && playing.hitId) stopPlay(); });

  // ---------------------------------------------------------------- Pack bar
  const bar = $("gb-bar"), panel = $("gb-panel"), nameIn = $("gb-pname");
  function refreshBar() {
    const show = !!S.session && (S.step === 2 || (S.step === 3 && !S.built));
    bar.classList.toggle("hidden", !show);
    document.body.classList.toggle("gb-has-bar", show);
    const n = S.picks.length;
    $("gb-n").textContent = n === 1 ? "1 sound" : n + " sounds";
    $("gb-dl").disabled = n === 0 || S.building;
    $("gb-toggle").disabled = n === 0;
    if (S.session) nameIn.placeholder = sanitizeName(S.session.suggestedName, "Pack name");
    if (!n) setPanel(false);
    if (!panel.classList.contains("hidden")) renderTree($("gb-panel-list"), true);
    if (S.step === 3) renderTree($("gb-tree"), false);
  }
  // phones: the pack name moves into the sheet so the bar is one row ("N sounds" + Download)
  const mqPhone = window.matchMedia("(max-width:720px)");
  function placeName() {
    const nm = document.querySelector(".gb-name"), row = document.querySelector(".gb-bar-row");
    if (mqPhone.matches) { if (nm.parentNode !== panel) panel.insertBefore(nm, panel.firstChild); }
    else if (nm.parentNode !== row) row.insertBefore(nm, row.firstChild);
  }
  if (mqPhone.addEventListener) mqPhone.addEventListener("change", placeName); else if (mqPhone.addListener) mqPhone.addListener(placeName);
  placeName();
  function setPanel(open) {
    panel.classList.toggle("hidden", !open);
    $("gb-toggle").setAttribute("aria-expanded", open ? "true" : "false");
    if (open) renderTree($("gb-panel-list"), true);
  }
  $("gb-toggle").addEventListener("click", () => setPanel(panel.classList.contains("hidden")));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !panel.classList.contains("hidden")) { setPanel(false); $("gb-toggle").focus(); } });

  function renderTree(el, removable) {
    const plan = buildPlan();
    if (!plan.entries.length) { el.innerHTML = `<p class="gb-tree-empty muted">Nothing picked yet. Add sounds with the Add to pack button.</p>`; return; }
    const by = {}; plan.entries.forEach(en => { (by[en.folder] = by[en.folder] || []).push(en); });
    el.innerHTML = `<p class="gb-tree-root">${esc(plan.name)}/</p>` + TYPES.filter(t => by[t[1]]).map(t => `
      <div class="gb-folder"><p class="gb-folder-name">${esc(t[1])}/ <span>${by[t[1]].length}</span></p>
      <ul>${by[t[1]].map(en => `<li><span class="gb-file"><span class="gb-fn">${esc(en.file)}</span><span class="gb-fv">${en.variant ? esc(en.variant.flavour) : "Original"}</span></span>${removable ? `<button type="button" class="gb-icon-btn" data-rm="${esc(en.key)}" aria-label="Remove ${esc(en.file)} from pack">${ICON.x}</button>` : ""}</li>`).join("")}</ul></div>`).join("");
  }
  $("gb-panel").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) removePick(b.dataset.rm); });

  let nameT = 0;
  nameIn.addEventListener("input", () => { S.built = null; clearTimeout(nameT); nameT = setTimeout(refreshBar, 120); });
  $("gb-gen").addEventListener("click", () => { nameIn.value = genName(); S.built = null; refreshBar(); say("Pack name: " + nameIn.value); nameIn.focus(); });

  $("gb-dl").addEventListener("click", () => {
    if (!S.picks.length) return;
    if (!nameIn.value.trim()) nameIn.value = packName();
    setPanel(false);
    if (S.step !== 3) setStep(3);
    else renderStep3();
  });

  // ---------------------------------------------------------------- Step 3: email + build
  function renderStep3() {
    const n = S.picks.length, name = packName();
    $("gb-s3-intro").textContent = S.built ? "" : `${name}: ${n} sound${n === 1 ? "" : "s"}, ready to build.`;
    ["gb-fail"].forEach(id => $(id).classList.add("hidden"));
    $("gb-done").classList.toggle("hidden", !S.built);
    $("gb-next").classList.toggle("hidden", !S.built);
    $("gb-build").classList.toggle("hidden", !S.building);
    $("gb-mail").classList.add("hidden");
    $("gb-back2").classList.toggle("hidden", !!S.built);
    renderTree($("gb-tree"), false);
    $("gb-share-box").classList.toggle("hidden", !n || !!(S.session && S.session.demo));   // demo sounds are not shared
    if (S.built) { fillDone(); }
    else if (!S.building) {
      if (S.unlocked) buildZip();
      else {
        $("gb-mail").classList.remove("hidden");
        $("gb-s3-intro").textContent = `${name}: ${n} sound${n === 1 ? "" : "s"}. One quick step before the download.`;
      }
    }
    refreshBar(); refreshStepper();
  }

  $("gb-mail").addEventListener("submit", async e => {
    e.preventDefault();
    const st = $("gb-mail-status"), btn = $("gb-send"), email = $("gb-email").value.trim();
    st.classList.remove("danger"); st.textContent = "";
    if (!EMAIL_RE.test(email)) { st.textContent = "Please enter a valid email address."; st.classList.add("danger"); $("gb-email").focus(); return; }
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Unlocking …";
    try {
      const consentTicked = $("gb-consent").checked;
      await registerEmail(email, consentTicked);
      try { localStorage.setItem(UNLOCK_KEY, "1"); } catch (_) {}
      track("gumball-unlock"); track("freekit-signup");
      S.unlocked = true; $("gb-email").value = ""; $("gb-consent").checked = false;
      st.textContent = "Unlocked! Essentials Lite is on its way to your inbox." + (consentTicked ? " Please confirm your subscription in that email." : "") + " Building your pack …";
      btn.textContent = "Unlocked";
      await buildZip();
      return;
    } catch (err) {
      track("gumball-error", { kind: "email" });
      st.textContent = ((err && err.message) || "Something went wrong") .replace(/[.!?\s]*$/, "") + ". Please try again."; st.classList.add("danger");
    } finally { btn.disabled = false; if (btn.textContent !== "Unlocked") btn.textContent = label; else btn.textContent = label; }
  });

  // Same call as the other free tools: the free-kit function also emails the free Essentials Lite kit, so the card copy says so.
  async function registerEmail(email, marketing_consent) {
    const cfg = window.APP_CONFIG || {};
    if (!window.supabase) throw new Error("Service is not available right now.");
    const db = (window.YLY && window.YLY.db) || (gbDb = gbDb || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY));
    const { data, error } = await db.functions.invoke("free-kit", { body: { email, marketing_consent } });
    if (error) { let m = error.message; try { const j = await error.context.json(); if (j?.error) m = j.error; } catch (_) {} throw new Error(m); }
    if (!data?.ok) throw new Error(data?.error || "Something went wrong.");
    return data;
  }
  let gbDb = null;

  async function buildZip() {
    if (S.building) return;
    S.building = true; S.built = null;
    $("gb-fail").classList.add("hidden"); $("gb-done").classList.add("hidden"); $("gb-next").classList.add("hidden");
    $("gb-build").classList.remove("hidden"); refreshBar(); refreshStepper();
    const plan = buildPlan(), total = plan.entries.length;
    const setP = (i, txt) => {
      const pct = Math.round((i / total) * 100);
      $("gb-build-fill").style.width = pct + "%"; $("gb-build-pct").textContent = pct + "%";
      $("gb-build-text").textContent = txt;
    };
    setP(0, `Building your pack … 0 / ${total}`);
    try {
      const files = [], enc = new TextEncoder();
      for (let i = 0; i < total; i++) {
        const en = plan.entries[i];
        const ab = await Engine.getAudio(en.hitId, en.variantId || null);
        files.push({ name: plan.name + "/" + en.path, data: new Uint8Array(ab) });
        setP(i + 1, `Building your pack … ${i + 1} / ${total}`);
        await wait(0);
      }
      const manifest = {
        pack_name: plan.name, preview_demo_sounds: !!(S.session && S.session.demo), key: S.session.key,
        files: plan.entries.map(en => { const o = { file: en.path, hit: en.hitId, type: en.type, variant: en.variantId ? en.variant.flavour : "Original" }; if (en.variant) { o.rarity = en.variant.rarity; o.seed = en.variant.seed; } return o; })
      };
      files.push({ name: plan.name + "/pack_manifest.json", data: enc.encode(JSON.stringify(manifest, null, 2)) });
      const parts = makeZip(files);
      const blob = new Blob(parts, { type: "application/zip" });
      S.built = { blob, zipName: plan.zipName, name: plan.name, count: total, size: blob.size };
      S.building = false;
      $("gb-build").classList.add("hidden");
      saveBuilt();
      track("gumball-download", { sounds: total, size_kb: Math.round(blob.size / 1024) });
      renderStep3();
      say(`Your pack is ready. ${total} files, ${fmtSize(blob.size)}.`);
      try { $("gb-done-name").focus({ preventScroll: true }); } catch (_) {}
    } catch (e) {
      S.building = false; $("gb-build").classList.add("hidden");
      track("gumball-error", { kind: "build" });
      $("gb-mail").classList.add("hidden");
      $("gb-fail-text").textContent = ((e && e.message) || "The pack could not be built").replace(/[.!?\s]*$/, "") + ".";
      $("gb-fail").classList.remove("hidden"); refreshBar(); refreshStepper();
    }
  }
  $("gb-retry").addEventListener("click", () => buildZip());

  function saveBuilt() {
    if (!S.built) return;
    const url = URL.createObjectURL(S.built.blob), a = document.createElement("a");
    a.href = url; a.download = S.built.zipName; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function fillDone() {
    const b = S.built;
    $("gb-done-name").textContent = b.name;
    $("gb-done-name").tabIndex = -1;
    $("gb-done-meta").textContent = `${b.count} file${b.count === 1 ? "" : "s"} · ${fmtSize(b.size)} · ${b.zipName}`;
    $("gb-s3-intro").textContent = "";
  }
  $("gb-next").addEventListener("click", e => { if (e.target.closest('a[href="upload.html"]')) track("gumball-cta-mixing"); });
  $("gb-again").addEventListener("click", saveBuilt);
  $("gb-new").addEventListener("click", () => {
    stopPlay();
    S.files = []; S.session = null; S.dirty = true; S.picks = []; S.cur = {}; S.variants = {}; S.built = null; S.building = false; S.filter = "all";
    Object.keys(cards).forEach(k => delete cards[k]); grid.innerHTML = "";
    nameIn.value = ""; clearErrors(); setPanel(false);
    renderSlots(); setStep(1);
    say("Started a new pack.");
  });

  // ---------------------------------------------------------------- Share to Lab
  // Short preview (max 30 s): the picked sounds one after another with small gaps, rendered offline.
  const SHARE_RATE = 44100, SHARE_MAX = 30, SHARE_GAP = 0.22, SHARE_SOUND_MAX = 2.5;
  async function renderPreview() {
    const plan = buildPlan(), items = [];
    let t = 0;
    for (const en of plan.entries) {
      const buf = await decoded(en.hitId, en.variantId || null);
      const len = Math.min(buf.duration, SHARE_SOUND_MAX);
      if (t + len > SHARE_MAX) break;
      items.push({ buf, at: t, len, en });
      t += len + SHARE_GAP;
    }
    if (!items.length) throw new Error("Nothing to preview.");
    const total = Math.min(SHARE_MAX, Math.max(0.5, t - SHARE_GAP));
    const oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, Math.ceil(total * SHARE_RATE), SHARE_RATE);
    for (const it of items) {
      const src = oc.createBufferSource(), g = oc.createGain();
      src.buffer = it.buf; src.connect(g); g.connect(oc.destination);
      const end = it.at + it.len;
      g.gain.setValueAtTime(1, it.at); g.gain.setValueAtTime(1, Math.max(it.at, end - 0.03)); g.gain.linearRampToValueAtTime(0, end);   // short fade, no click
      src.start(it.at); src.stop(end);
    }
    const out = await oc.startRendering();
    let peak = 0;
    for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; } }
    if (peak > 0) { const k = 0.9 / peak; for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } }
    return { buffer: out, sounds: items.map(it => T[it.en.type].label + (it.en.variant ? " (" + it.en.variant.flavour + ")" : "")) };
  }
  $("gb-share").addEventListener("click", async () => {
    const btn = $("gb-share"), st = $("gb-share-status");
    st.classList.remove("danger"); st.textContent = "";
    if (!window.LabUpload) { st.textContent = "Sharing is not available right now."; st.classList.add("danger"); return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = "Rendering \u2026";
    try {
      const r = await renderPreview();
      track("gumball-share");
      await window.LabUpload.open({ buffer: r.buffer, type: "gumball", title: packName(), sounds: r.sounds, sourceLabel: "Preview of your pack" });
    } catch (e) { st.textContent = (e && e.message) || "The preview could not be made."; st.classList.add("danger"); }
    finally { btn.disabled = false; btn.textContent = label; }
  });

  // ---------------------------------------------------------------- init
  renderSlots(); refreshStepper();
  window.addEventListener("pageshow", readColors);
})();

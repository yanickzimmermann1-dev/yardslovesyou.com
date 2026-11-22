/* =====================================================================
   lab-upload.js - "Drop a loop": Audio waehlen, ggf. auf 30 s kuerzen, im Browser nach .m4a wandeln,
   zu Cloudflare R2 hochladen (ueber die Edge Function lab-upload) und als Beitrag speichern.
   LabUpload.open({ file?, buffer?, type: "audio"|"gumball", title?, sounds?, onDone? })
   Braucht: community-core.js (YLY), m4a-encode.js (M4A), vendor/mp4-muxer.min.js, lab-tags.js
   ===================================================================== */
window.LabUpload = (() => {
  const MAX_SEC = 30, MAX_SRC_BYTES = 80 * 1024 * 1024;
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const ACCEPT = ".mp3,.wav,.m4a,.aac,.flac,.ogg,audio/*";
  const Y = () => window.YLY, M = () => window.M4A;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  const $ = id => document.getElementById(id);

  let dlg, tags, S, actx, src;   // S: aktueller Zustand
  const reset = () => { S = { buffer: null, start: 0, type: "audio", sounds: null, busy: false, opts: {} }; };
  reset();

  function build() {
    if (dlg) return;
    dlg = document.createElement("dialog");
    dlg.className = "pub-dialog lu-dialog"; dlg.setAttribute("aria-labelledby", "lu-h");
    dlg.innerHTML = `
      <div class="lu-head"><h3 id="lu-h">Drop a loop</h3><button type="button" class="lu-x" id="lu-x" aria-label="Close">&times;</button></div>
      <div id="lu-stage-pick">
        <label class="lu-drop" id="lu-drop" for="lu-file">
          <input id="lu-file" type="file" accept="${ACCEPT}">
          <strong>Drop an audio file here</strong>
          <span>or tap to choose one. MP3, WAV, M4A, FLAC or OGG. Max ${MAX_SEC} seconds are shared.</span>
        </label>
        <p class="lu-note">Only upload sounds you made yourself or have the rights to share. Others can play and download them.</p>
      </div>
      <form id="lu-form" class="hidden" novalidate>
        <p class="lu-file" id="lu-fileinfo"></p>
        <div class="lu-trim hidden" id="lu-trim">
          <p class="lu-trim-t"><strong>Pick your ${MAX_SEC} seconds.</strong> <span id="lu-range"></span></p>
          <div class="lu-wavewrap" id="lu-wavewrap"><canvas id="lu-canvas" height="84"></canvas><div class="lu-win" id="lu-win" aria-hidden="true"></div></div>
          <div class="lu-trim-row">
            <button type="button" class="outline" id="lu-prev">Preview</button>
            <input type="range" id="lu-start" min="0" max="0" step="0.1" value="0" aria-label="Start of the ${MAX_SEC} second window">
          </div>
        </div>
        <div class="lu-preview hidden" id="lu-preview-row"><button type="button" class="outline" id="lu-prev2">Preview</button></div>
        <label class="field"><span>Title</span><input id="lu-title" type="text" maxlength="60" placeholder="e.g. Dusty guitar loop" required></label>
        <div class="lu-two">
          <label class="field"><span>BPM <em>(optional)</em></span><input id="lu-bpm" type="number" min="40" max="300" inputmode="numeric" placeholder="140"></label>
          <label class="field"><span>Key <em>(optional)</em></span><select id="lu-key"><option value="">-</option>${NOTES.map(n => `<option>${n} minor</option><option>${n} major</option>`).join("")}</select></label>
        </div>
        <div class="field"><span>Tags</span><div id="lu-tags"></div></div>
        <div class="lu-prog hidden" id="lu-prog" aria-live="polite"><div class="progress-head"><span id="lu-prog-t">Converting &hellip;</span></div><div class="progress-track"><div class="progress-fill" id="lu-prog-f"></div></div></div>
        <p class="status" id="lu-status" role="alert"></p>
        <div class="hero-actions">
          <button type="submit" class="button" id="lu-go">Publish</button>
          <button type="button" class="outline" id="lu-cancel">Cancel</button>
        </div>
      </form>
      <div class="hidden" id="lu-done">
        <h3>It's in the Lab.</h3>
        <p class="muted">Your patch is live. Share the link with your friends.</p>
        <div class="hero-actions"><a class="button" id="lu-link" href="community.html">View patch</a><button type="button" class="outline" id="lu-close2">Close</button></div>
      </div>`;
    document.body.appendChild(dlg);
    tags = window.LabTags.mount($("lu-tags"), { max: 5 });

    $("lu-x").onclick = $("lu-cancel").onclick = $("lu-close2").onclick = close;
    dlg.addEventListener("close", () => { stopPreview(); });
    dlg.addEventListener("cancel", e => { if (S.busy) e.preventDefault(); });
    $("lu-file").onchange = e => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ""; };
    const drop = $("lu-drop");
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f); });
    $("lu-start").oninput = e => setStart(+e.target.value);
    $("lu-prev").onclick = $("lu-prev2").onclick = togglePreview;
    $("lu-form").addEventListener("submit", e => { e.preventDefault(); publish(); });
    bindDrag();
  }

  function close() { if (S.busy) return; stopPreview(); dlg.close ? dlg.close() : dlg.removeAttribute("open"); }
  const status = (msg, bad = true) => { const el = $("lu-status"); el.textContent = msg || ""; el.classList.toggle("danger", !!msg && bad); };

  // ---------- Datei laden ----------
  async function loadFile(file) {
    status("");
    if (file.size > MAX_SRC_BYTES) { status("That file is too big (max 80 MB)."); return; }
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name)) { status("Please choose an audio file (MP3, WAV, M4A, FLAC or OGG)."); return; }
    $("lu-drop").classList.add("busy"); $("lu-drop").querySelector("strong").textContent = "Reading your file …";
    try {
      const buf = await M().decode(await file.arrayBuffer());
      setBuffer(buf, file.name);
      if (!$("lu-title").value) $("lu-title").value = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 60);
    } catch (e) {
      status(e.message || "That file could not be read.");
      $("lu-drop").querySelector("strong").textContent = "Drop an audio file here";
    } finally { $("lu-drop").classList.remove("busy"); }
  }

  function setBuffer(buf, name) {
    S.buffer = buf; S.start = 0;
    $("lu-stage-pick").classList.add("hidden"); $("lu-form").classList.remove("hidden");
    const long = buf.duration > MAX_SEC + 0.05;
    $("lu-fileinfo").textContent = (name ? name + " · " : "") + fmt(buf.duration) + (long ? " · longer than " + MAX_SEC + " s, so pick a part" : "");
    $("lu-trim").classList.toggle("hidden", !long);
    $("lu-preview-row").classList.toggle("hidden", long);
    if (long) {
      const r = $("lu-start"); r.max = String(Math.max(0, buf.duration - MAX_SEC).toFixed(1)); r.value = "0";
      requestAnimationFrame(() => { drawWave(); setStart(0); });
    }
  }

  // ---------- Kuerzen: Wellenform + 30-s-Fenster ----------
  function drawWave() {
    const cv = $("lu-canvas"), w = cv.clientWidth || 300, h = 84, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext("2d"); g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    const n = Math.max(40, Math.floor(w / 3)), pk = M().peaks(S.buffer, 0, S.buffer.duration, n);
    g.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted").trim() || "#aaa0b7";
    pk.forEach((v, i) => { const bh = Math.max(2, v / 255 * (h - 8)); g.fillRect(i * (w / n), (h - bh) / 2, Math.max(1, w / n - 1), bh); });
  }
  function setStart(s) {
    const total = S.buffer.duration, max = Math.max(0, total - MAX_SEC);
    S.start = Math.max(0, Math.min(max, s));
    $("lu-start").value = S.start.toFixed(1);
    const win = $("lu-win");
    win.style.left = (S.start / total * 100) + "%"; win.style.width = (Math.min(MAX_SEC, total) / total * 100) + "%";
    $("lu-range").textContent = fmt(S.start) + " – " + fmt(S.start + Math.min(MAX_SEC, total));
    if (src) startPreview();   // Vorschau folgt dem Fenster
  }
  function bindDrag() {
    const wrap = $("lu-wavewrap"); let drag = null;
    wrap.addEventListener("pointerdown", e => {
      if (!S.buffer) return;
      const r = wrap.getBoundingClientRect(), total = S.buffer.duration, x = (e.clientX - r.left) / r.width * total;
      const inWin = x >= S.start && x <= S.start + MAX_SEC;
      drag = { off: inWin ? x - S.start : MAX_SEC / 2 };
      if (!inWin) setStart(x - drag.off);
      wrap.setPointerCapture(e.pointerId); e.preventDefault();
    });
    wrap.addEventListener("pointermove", e => {
      if (!drag) return;
      const r = wrap.getBoundingClientRect(); setStart((e.clientX - r.left) / r.width * S.buffer.duration - drag.off);
    });
    ["pointerup", "pointercancel"].forEach(ev => wrap.addEventListener(ev, () => { drag = null; }));
  }

  // ---------- Vorschau ----------
  function stopPreview() { if (src) { try { src.onended = null; src.stop(); } catch (_) {} src = null; } [$("lu-prev"), $("lu-prev2")].forEach(b => b && (b.textContent = "Preview")); }
  function startPreview() {
    if (!S.buffer) return;
    stopPreview();
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    actx = actx || new AC(); if (actx.state === "suspended") actx.resume();
    src = actx.createBufferSource(); src.buffer = S.buffer; src.connect(actx.destination);
    src.start(0, S.start, Math.min(MAX_SEC, S.buffer.duration - S.start));
    src.onended = () => { src = null; [$("lu-prev"), $("lu-prev2")].forEach(b => b && (b.textContent = "Preview")); };
    [$("lu-prev"), $("lu-prev2")].forEach(b => b && (b.textContent = "Stop"));
  }
  function togglePreview() { if (src) stopPreview(); else startPreview(); }

  // ---------- Veroeffentlichen ----------
  function progress(text, ratio) {
    $("lu-prog").classList.remove("hidden"); $("lu-prog-t").textContent = text;
    $("lu-prog-f").style.width = Math.round((ratio || 0) * 100) + "%";
  }
  async function publish() {
    if (S.busy) return;
    const title = $("lu-title").value.trim();
    if (!S.buffer) { status("Choose an audio file first."); return; }
    if (!title) { status("Please give it a title."); $("lu-title").focus(); return; }
    const bpmRaw = $("lu-bpm").value.trim(), bpm = bpmRaw ? Math.round(+bpmRaw) : null;
    if (bpmRaw && !(bpm >= 40 && bpm <= 300)) { status("BPM should be between 40 and 300."); return; }
    const y = Y(), m = await y.me();
    if (!m || !m.profile) { status("Please sign in first."); return; }
    status("");
    S.busy = true; $("lu-go").disabled = true; $("lu-x").disabled = true; $("lu-cancel").disabled = true;
    let publicUrl = "";
    try {
      if (!(await M().supported())) throw new Error(M().NO_SUPPORT);
      const dur = Math.min(MAX_SEC, S.buffer.duration - S.start);
      progress("Converting …", 0);
      const blob = await M().encode(S.buffer, S.start, dur, r => progress("Converting …", r * 0.6));
      await M().verify(blob);                                    // spielt das Ergebnis wirklich ab?
      const peaks = M().peaks(S.buffer, S.start, dur, 120);
      if (blob.size > 1.5 * 1024 * 1024) throw new Error("The converted file is too large (max 1.5 MB).");

      progress("Uploading …", 0.65);
      const j = await y.labFn({ action: "upload", contentType: "audio/mp4", size: blob.size });
      let put;
      try { put = await fetch(j.uploadUrl, { method: "PUT", headers: { "Content-Type": "audio/mp4" }, body: blob }); }
      catch (_) { throw new Error("The upload was blocked. Please try again in a moment."); }
      if (!put.ok) throw new Error("The upload failed (" + put.status + "). Please try again.");
      publicUrl = j.publicUrl;

      progress("Publishing …", 0.9);
      const data = { url: publicUrl, duration: Math.round(dur * 10) / 10, peaks };
      if (bpm) data.bpm = bpm;
      if ($("lu-key").value) data.key = $("lu-key").value;
      if (S.sounds) data.sounds = S.sounds;
      const t = tags.get();
      const row = { user_id: m.user.id, type: S.type, title: title.slice(0, 60), data: JSON.stringify(data) };
      if (t.length) row.tags = t;
      const { data: ins, error } = await y.db.from("posts").insert(row).select("id").single();
      if (error) throw new Error(/limit/i.test(error.message) ? "You've reached today's post limit. Please try again tomorrow." : (error.message || "The post could not be saved."));

      progress("Done", 1);
      $("lu-form").classList.add("hidden"); $("lu-done").classList.remove("hidden");
      $("lu-link").href = "community.html?post=" + ins.id;
      window.ylyTrack && ylyTrack("lab-upload", { type: S.type });
      window.dispatchEvent(new CustomEvent("lab:posted", { detail: { id: ins.id } }));
      if (S.opts.onDone) S.opts.onDone(ins.id);
    } catch (e) {
      status(e.message || "Something went wrong.");
      $("lu-prog").classList.add("hidden");
      if (publicUrl) { try { await y.labFn({ action: "delete", url: publicUrl }); } catch (_) {} }   // verwaiste Datei aufraeumen
    } finally {
      S.busy = false; $("lu-go").disabled = false; $("lu-x").disabled = false; $("lu-cancel").disabled = false;
    }
  }

  // ---------- Einstieg ----------
  async function open(opts = {}) {
    const y = Y(); if (!y) return;
    const m = await y.me();
    if (!m) { location.href = y.loginUrl(location.origin + "/community.html#drop"); return; }
    if (!m.profile) { location.href = "account.html?next=" + encodeURIComponent(location.href); return; }
    build(); reset(); S.opts = opts; S.type = opts.type || "audio"; S.sounds = opts.sounds || null;
    $("lu-h").textContent = S.type === "gumball" ? "Share to the Lab" : "Drop a loop";
    $("lu-stage-pick").classList.remove("hidden"); $("lu-form").classList.add("hidden"); $("lu-done").classList.add("hidden");
    $("lu-prog").classList.add("hidden"); $("lu-drop").querySelector("strong").textContent = "Drop an audio file here";
    $("lu-title").value = opts.title || ""; $("lu-bpm").value = ""; $("lu-key").value = ""; tags.clear(); status("");
    $("lu-go").disabled = false;
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    M().supported().then(ok => { if (!ok) { status(M().NO_SUPPORT); } });
    if (opts.buffer) setBuffer(opts.buffer, opts.sourceLabel || "");
    else if (opts.file) loadFile(opts.file);
  }

  return { open };
})();

/* =====================================================================
   drop-upload.js - "Your drop": 1 Track pro Account (max. 4:00), eigenes Design, Beschreibung.
   Track im Browser nach .m4a wandeln, zu R2 hochladen (Edge Function lab-upload, kind "drop")
   und per RPC set_drop speichern (ersetzt einen alten Drop, Wechsel max. alle 7 Tage).
   DropUpload.open({ onDone? })
   Braucht: community-core.js (YLY), m4a-encode.js (M4A), vendor/mp4-muxer.min.js, lab-tags.js
   ===================================================================== */
window.DropUpload = (() => {
  const MAX_SEC = 240, MAX_SRC_BYTES = 120 * 1024 * 1024, MAX_OUT = 5 * 1024 * 1024;
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const ACCEPT = ".mp3,.wav,.m4a,.aac,.flac,.ogg,audio/*";
  const COLOR_NAMES = { violet: "Violet", ice: "Ice", mint: "Mint", gold: "Gold", rose: "Rose", mono: "Mono" };
  const STYLE_NAMES = { solid: "Solid", outline: "Outline", tape: "Tape" };
  // Farben wie in drop.css: [Farbe, Schrift auf Farbe]
  const HEX = { violet: ["#b68aff", "#180e23"], ice: ["#8fd3ff", "#06202e"], mint: ["#5fe0b0", "#062a1e"], gold: ["#d4b46e", "#1c1608"], rose: ["#ff8fb1", "#2e0a16"], mono: ["#e9e4ef", "#141118"] };
  const Y = () => window.YLY, M = () => window.M4A;
  const $ = id => document.getElementById(id);
  const fmt = s => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");

  let dlg, tags, S, actx, src;
  const reset = () => { S = { buffer: null, name: "", busy: false, opts: {}, handle: "" }; };
  reset();

  function build() {
    if (dlg) return;
    const y = Y();
    dlg = document.createElement("dialog");
    dlg.className = "pub-dialog lu-dialog dr-dialog"; dlg.setAttribute("aria-labelledby", "dr-h");
    dlg.innerHTML = `
      <div class="lu-head"><h3 id="dr-h">Your drop</h3><button type="button" class="lu-x" id="dr-x" aria-label="Close">&times;</button></div>
      <p class="dr-rule" id="dr-rule">One track per account. You can swap it once every 7 days.</p>
      <div id="dr-wait" class="hidden"><p class="dr-wait" id="dr-wait-t"></p><div class="hero-actions"><button type="button" class="outline" id="dr-wait-x">Close</button></div></div>
      <div id="dr-stage-pick">
        <label class="lu-drop" id="dr-drop" for="dr-file">
          <input id="dr-file" type="file" accept="${ACCEPT}">
          <strong>Drop your track here</strong>
          <span>or tap to choose it. MP3, WAV, M4A, FLAC or OGG. Max ${fmt(MAX_SEC)} minutes.</span>
        </label>
        <p class="lu-note">Only upload music you made yourself or have the rights to share.</p>
      </div>
      <form id="dr-form" class="hidden" novalidate>
        <p class="lu-file" id="dr-fileinfo"></p>
        <div class="lu-preview"><button type="button" class="outline" id="dr-prev">Preview</button> <button type="button" class="cp-link dr-swap" id="dr-swap">Choose another file</button></div>

        <div class="dr-design">
          <div class="dr-live" id="dr-live"></div>
          <div class="dr-opts">
            <fieldset class="dr-set"><legend>Colour</legend><div class="dr-swatches" id="dr-colors">
              ${y.DROP_COLORS.map((c, i) => `<label class="dr-sw dr-c-${c}"><input type="radio" name="dr-c" value="${c}"${i ? "" : " checked"}><span>${COLOR_NAMES[c]}</span></label>`).join("")}
            </div></fieldset>
            <fieldset class="dr-set"><legend>Style</legend><div class="dr-styles">
              ${y.DROP_STYLES.map((s, i) => `<label class="dr-st"><input type="radio" name="dr-s" value="${s}"${i ? "" : " checked"}><span>${STYLE_NAMES[s]}</span></label>`).join("")}
            </div></fieldset>
          </div>
        </div>

        <label class="field"><span>Title</span><input id="dr-title" type="text" maxlength="60" placeholder="e.g. Late night in Zurich" required></label>
        <label class="field"><span>Description <em id="dr-count">0 / 280</em></span><textarea id="dr-desc" maxlength="280" rows="3" placeholder="What's the story behind this track?"></textarea></label>
        <div class="lu-two">
          <label class="field"><span>BPM <em>(optional)</em></span><input id="dr-bpm" type="number" min="40" max="300" inputmode="numeric" placeholder="140"></label>
          <label class="field"><span>Key <em>(optional)</em></span><select id="dr-key"><option value="">-</option>${NOTES.map(n => `<option>${n} minor</option><option>${n} major</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>Credits <em>(optional)</em></span><input id="dr-credits" type="text" maxlength="120" placeholder="prod. you, vocals @someone, mix by yards"></label>
        <label class="field"><span>Link <em>(optional, Spotify, YouTube, BeatStars …)</em></span><input id="dr-link" type="url" maxlength="300" placeholder="https://"></label>
        <div class="field"><span>Tags</span><div id="dr-tags"></div></div>

        <div class="lu-prog hidden" id="dr-prog" aria-live="polite"><div class="progress-head"><span id="dr-prog-t">Converting &hellip;</span></div><div class="progress-track"><div class="progress-fill" id="dr-prog-f"></div></div></div>
        <p class="status" id="dr-status" role="alert"></p>
        <div class="hero-actions">
          <button type="submit" class="button" id="dr-go">Publish drop</button>
          <button type="button" class="outline" id="dr-cancel">Cancel</button>
        </div>
      </form>
      <div class="hidden" id="dr-done">
        <h3>Your drop is live.</h3>
        <p class="muted">It's on your profile and in the Lab. Share the link, it shows your cover on Instagram and WhatsApp.</p>
        <div class="dr-share hidden" id="dr-share"><input id="dr-share-url" type="text" readonly aria-label="Share link"><button type="button" class="outline" id="dr-share-copy">Copy</button></div>
        <div class="hero-actions"><a class="button" id="dr-link-out" href="/lab">View drop</a><button type="button" class="outline" id="dr-close2">Close</button></div>
      </div>`;
    document.body.appendChild(dlg);
    tags = window.LabTags ? window.LabTags.mount($("dr-tags"), { max: 5 }) : null;
    if (!tags) $("dr-tags").closest(".field").classList.add("hidden");

    $("dr-x").onclick = $("dr-cancel").onclick = $("dr-close2").onclick = $("dr-wait-x").onclick = close;
    dlg.addEventListener("close", stopPreview);
    dlg.addEventListener("cancel", e => { if (S.busy) e.preventDefault(); });
    $("dr-file").onchange = e => { const f = e.target.files[0]; if (f) loadFile(f); e.target.value = ""; };
    const drop = $("dr-drop");
    ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadFile(f); });
    $("dr-prev").onclick = togglePreview;
    $("dr-swap").onclick = () => { stopPreview(); S.buffer = null; $("dr-form").classList.add("hidden"); $("dr-stage-pick").classList.remove("hidden"); };
    $("dr-desc").addEventListener("input", () => { $("dr-count").textContent = $("dr-desc").value.length + " / 280"; });
    $("dr-title").addEventListener("input", renderLive);
    dlg.querySelectorAll('input[name="dr-c"],input[name="dr-s"]').forEach(r => r.addEventListener("change", renderLive));
    $("dr-form").addEventListener("submit", e => { e.preventDefault(); publish(); });
    $("dr-share-copy").onclick = async () => {
      const v = $("dr-share-url").value;
      try { await navigator.clipboard.writeText(v); Y().toast("Link copied!"); } catch (_) { $("dr-share-url").select(); }
    };
  }

  // ---------- Vorschaubild 1200x630 (Open Graph), gleicher Look wie das Cover ----------
  function wrap(g, text, maxW) {
    const words = String(text).split(/\s+/).filter(Boolean), lines = [];
    let cur = "";
    words.forEach(w => { const t = cur ? cur + " " + w : w; if (g.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines;
  }
  async function ogImage(title, handle, th) {
    try { await Promise.all([document.fonts.load('600 100px "Space Grotesk"'), document.fonts.load('700 24px "DM Sans"'), document.fonts.load('500 30px "DM Sans"')]); } catch (_) {}
    const W = 1200, H = 630, P = 72, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), [c, ink] = HEX[th.c] || HEX.violet, dark = "#0f0c15", light = "#f5f0fb";
    let bg = c, fg = ink, tfg = ink;
    if (th.s === "outline") { bg = dark; fg = c; tfg = c; }
    if (th.s === "tape") { bg = dark; fg = light; tfg = ink; }
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    if (th.s === "outline") { g.strokeStyle = c; g.lineWidth = 12; g.strokeRect(6, 6, W - 12, H - 12); }
    if (th.s === "tape") { g.fillStyle = c; g.fillRect(0, H * 0.28, W, H * 0.44); }

    g.textBaseline = "alphabetic"; g.fillStyle = fg;
    if ("letterSpacing" in g) g.letterSpacing = "6px";
    g.font = '700 24px "DM Sans", sans-serif'; g.fillText("DROP", P, P + 18);
    if ("letterSpacing" in g) g.letterSpacing = "0px";

    // Titel: groesste Schrift, die in max. 3 Zeilen passt
    let size = 120, lines = [];
    for (; size >= 56; size -= 6) {
      g.font = `600 ${size}px "Space Grotesk", sans-serif`;
      lines = wrap(g, title, W - P * 2);
      if (lines.length <= 3 && lines.every(l => g.measureText(l).width <= W - P * 2)) break;
    }
    lines = lines.slice(0, 3);
    const lh = size * 1.02, top = H / 2 - (lines.length * lh) / 2 + size * 0.78;
    g.fillStyle = tfg;
    lines.forEach((l, i) => g.fillText(l, P, top + i * lh, W - P * 2));

    g.fillStyle = fg; g.font = '500 30px "DM Sans", sans-serif'; g.fillText("@" + handle, P, H - P + 8);
    g.textAlign = "right"; g.font = '700 22px "DM Sans", sans-serif'; g.fillText("YARDSLOVESYOU", W - P, H - P + 6);
    return cv.toDataURL("image/png");
  }

  // Share-Seite fuer den aktuellen Drop erzeugen/aktualisieren -> Link
  async function share() {
    const y = Y(), m = await y.me();
    if (!m || !m.profile) throw new Error("Please sign in first.");
    const { data: cur } = await y.db.from("posts").select("title,data").eq("user_id", m.user.id).eq("type", "drop").maybeSingle();
    if (!cur) throw new Error("You don't have a drop yet.");
    const image = await ogImage(cur.title || "Drop", m.profile.handle, y.dropTheme(y.pdata(cur) || {}));
    const j = await y.labFn({ action: "share", image });
    return j.url;
  }

  const theme = () => ({
    c: (dlg.querySelector('input[name="dr-c"]:checked') || {}).value || "violet",
    s: (dlg.querySelector('input[name="dr-s"]:checked') || {}).value || "solid",
  });
  function renderLive() { $("dr-live").innerHTML = Y().dropCover($("dr-title").value.trim() || "Your title", S.handle, theme()); }
  function setTheme(t) {
    const c = dlg.querySelector(`input[name="dr-c"][value="${t && t.c}"]`), s = dlg.querySelector(`input[name="dr-s"][value="${t && t.s}"]`);
    if (c) c.checked = true; if (s) s.checked = true;
  }

  function close() { if (S.busy) return; stopPreview(); dlg.close ? dlg.close() : dlg.removeAttribute("open"); }
  const status = (msg, bad = true) => { const el = $("dr-status"); el.textContent = msg || ""; el.classList.toggle("danger", !!msg && bad); };

  // ---------- Datei laden ----------
  async function loadFile(file) {
    status("");
    const strong = $("dr-drop").querySelector("strong");
    if (file.size > MAX_SRC_BYTES) { strong.textContent = "That file is too big (max 120 MB)."; return; }
    if (!/^audio\//.test(file.type) && !/\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(file.name)) { strong.textContent = "Please choose an audio file."; return; }
    $("dr-drop").classList.add("busy"); strong.textContent = "Reading your track …";
    try {
      const buf = await M().decode(await file.arrayBuffer());
      if (buf.duration > MAX_SEC + 0.5) { strong.textContent = `Your track is ${fmt(buf.duration)}. Drops can be max ${fmt(MAX_SEC)}.`; return; }
      S.buffer = buf; S.name = file.name;
      $("dr-stage-pick").classList.add("hidden"); $("dr-form").classList.remove("hidden");
      $("dr-fileinfo").textContent = file.name + " · " + fmt(buf.duration);
      if (!$("dr-title").value) $("dr-title").value = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 60);
      renderLive();
      strong.textContent = "Drop your track here";
    } catch (e) {
      strong.textContent = e.message || "That file could not be read.";
    } finally { $("dr-drop").classList.remove("busy"); }
  }

  // ---------- Vorschau ----------
  function stopPreview() { if (src) { try { src.onended = null; src.stop(); } catch (_) {} src = null; } const b = $("dr-prev"); if (b) b.textContent = "Preview"; }
  function togglePreview() {
    if (src) { stopPreview(); return; }
    if (!S.buffer) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    actx = actx || new AC(); if (actx.state === "suspended") actx.resume();
    src = actx.createBufferSource(); src.buffer = S.buffer; src.connect(actx.destination); src.start(0);
    src.onended = () => { src = null; $("dr-prev").textContent = "Preview"; };
    $("dr-prev").textContent = "Stop";
  }

  // ---------- Veroeffentlichen ----------
  function progress(text, ratio) {
    $("dr-prog").classList.remove("hidden"); $("dr-prog-t").textContent = text;
    $("dr-prog-f").style.width = Math.round((ratio || 0) * 100) + "%";
  }
  const nice = msg => /cooldown/i.test(msg) ? msg.replace(/^.*?Drop cooldown:\s*/i, "").replace(/^you/, "You") + "." : msg;

  async function publish() {
    if (S.busy) return;
    const y = Y(), title = $("dr-title").value.trim(), desc = $("dr-desc").value.trim(), credits = $("dr-credits").value.trim(), link = $("dr-link").value.trim();
    if (!S.buffer) { status("Choose your track first."); return; }
    if (!title) { status("Please give your drop a title."); $("dr-title").focus(); return; }
    const bpmRaw = $("dr-bpm").value.trim(), bpm = bpmRaw ? Math.round(+bpmRaw) : null;
    if (bpmRaw && !(bpm >= 40 && bpm <= 300)) { status("BPM should be between 40 and 300."); return; }
    if (link && !y.LINK_RE.test(link)) { status("The link has to start with https://"); $("dr-link").focus(); return; }
    const m = await y.me();
    if (!m || !m.profile) { status("Please sign in first."); return; }
    status("");
    S.busy = true; ["dr-go", "dr-x", "dr-cancel"].forEach(id => { $(id).disabled = true; });
    let publicUrl = "";
    try {
      if (!(await M().supported())) throw new Error(M().NO_SUPPORT);
      stopPreview();
      const dur = Math.min(MAX_SEC, S.buffer.duration);
      progress("Converting …", 0);
      const blob = await M().encode(S.buffer, 0, dur, r => progress("Converting …", r * 0.6), MAX_SEC);
      await M().verify(blob);
      if (blob.size > MAX_OUT) throw new Error("The converted file is too large (max 5 MB).");
      const peaks = M().peaks(S.buffer, 0, dur, 200);

      progress("Uploading …", 0.65);
      const j = await y.labFn({ action: "upload", kind: "drop", contentType: "audio/mp4", size: blob.size });
      let put;
      try { put = await fetch(j.uploadUrl, { method: "PUT", headers: { "Content-Type": "audio/mp4" }, body: blob }); }
      catch (_) { throw new Error("The upload was blocked. Please try again in a moment."); }
      if (!put.ok) throw new Error("The upload failed (" + put.status + "). Please try again.");
      publicUrl = j.publicUrl;

      progress("Publishing …", 0.9);
      const data = { url: publicUrl, duration: Math.round(dur * 10) / 10, peaks, theme: theme() };
      if (bpm) data.bpm = bpm;
      if ($("dr-key").value) data.key = $("dr-key").value;
      if (desc) data.desc = desc.slice(0, 280);
      if (credits) data.credits = credits.slice(0, 120);
      if (link) data.link = link;
      const { data: res, error } = await y.db.rpc("set_drop", { p_title: title.slice(0, 60), p_data: JSON.stringify(data), p_tags: tags ? tags.get() : [] });
      if (error) throw new Error(nice(error.message || "Your drop could not be saved."));
      const row = Array.isArray(res) ? res[0] : res;
      if (row && row.old_url && row.old_url !== publicUrl) { try { await y.labFn({ action: "delete", url: row.old_url }); } catch (_) { /* alte Datei bleibt liegen, harmlos */ } }

      // Share-Seite mit Vorschaubild (Fehler hier stoppen den Drop nicht)
      let shareUrl = "";
      try { progress("Creating share link …", 0.95); shareUrl = await share(); } catch (_) {}
      $("dr-share").classList.toggle("hidden", !shareUrl);
      $("dr-share-url").value = shareUrl;

      progress("Done", 1);
      $("dr-form").classList.add("hidden"); $("dr-rule").classList.add("hidden"); $("dr-done").classList.remove("hidden");
      if (row && row.id) $("dr-link-out").href = "/lab?post=" + row.id;
      window.ylyTrack && ylyTrack("drop-upload", {});
      window.dispatchEvent(new CustomEvent("drop:posted", { detail: { id: row && row.id } }));
      if (S.opts.onDone) S.opts.onDone(row && row.id);
    } catch (e) {
      status(e.message || "Something went wrong.");
      $("dr-prog").classList.add("hidden");
      if (publicUrl) { try { await y.labFn({ action: "delete", url: publicUrl }); } catch (_) {} }
    } finally {
      S.busy = false; ["dr-go", "dr-x", "dr-cancel"].forEach(id => { $(id).disabled = false; });
    }
  }

  // ---------- Einstieg ----------
  async function open(opts = {}) {
    const y = Y(); if (!y) return;
    const m = await y.me();
    if (!m) { location.href = y.loginUrl(location.href.split("#")[0] + "#drop"); return; }
    if (!m.profile) { location.href = "account.html?next=" + encodeURIComponent(location.href); return; }
    build(); reset(); S.opts = opts; S.handle = m.profile.handle;
    ["dr-stage-pick", "dr-form", "dr-done", "dr-wait", "dr-prog"].forEach(id => $(id).classList.add("hidden"));
    $("dr-rule").classList.remove("hidden");
    ["dr-title", "dr-desc", "dr-bpm", "dr-key", "dr-credits", "dr-link"].forEach(id => { $(id).value = ""; });
    $("dr-count").textContent = "0 / 280"; if (tags) tags.clear(); status(""); $("dr-go").disabled = false;
    $("dr-drop").querySelector("strong").textContent = "Drop your track here";
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");

    // Cooldown pruefen, bevor jemand 4 Minuten Audio auswaehlt
    let next = null;
    try { const r = await y.db.rpc("drop_status"); next = r.data || null; } catch (_) {}
    if (next) {
      const d = new Date(next);
      $("dr-wait-t").textContent = "You changed your drop recently. You can swap it again on " + d.toLocaleDateString(undefined, { day: "numeric", month: "long" }) + ".";
      $("dr-rule").classList.add("hidden"); $("dr-wait").classList.remove("hidden");
      return;
    }
    // Bestehenden Drop als Vorlage laden (Design, Texte)
    try {
      const { data: cur } = await y.db.from("posts").select("title,data,tags").eq("user_id", m.user.id).eq("type", "drop").maybeSingle();
      const d = cur ? y.pdata(cur) : null;
      if (cur) {
        $("dr-h").textContent = "Change your drop";
        $("dr-title").value = cur.title || ""; setTheme(d && d.theme);
        if (d) { $("dr-desc").value = d.desc || ""; $("dr-credits").value = d.credits || ""; $("dr-link").value = d.link || ""; $("dr-bpm").value = d.bpm || ""; $("dr-key").value = d.key || ""; }
        $("dr-count").textContent = $("dr-desc").value.length + " / 280";
        if (tags && Array.isArray(cur.tags)) tags.set(cur.tags);
      } else $("dr-h").textContent = "Your drop";
    } catch (_) {}
    $("dr-stage-pick").classList.remove("hidden");
    M().supported().then(ok => { if (!ok) { $("dr-drop").querySelector("strong").textContent = M().NO_SUPPORT; } });
  }

  return { open, share, ogImage };
})();

(() => {
  const cfg = window.APP_CONFIG || {}, $ = id => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const db = window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const media = u => /^https?:\/\//.test(u) ? u : db.storage.from("coverart-products").getPublicUrl(u).data.publicUrl;

  // Edge Function aufrufen und die Fehlermeldung der Function anzeigen
  async function callFn(name, body) {
    if (!db) throw new Error("Service is not available right now.");
    const { data, error } = await db.functions.invoke(name, { body });
    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (_) {}
      throw new Error(msg);
    }
    if (!data?.ok) throw new Error(data?.error || "Something went wrong.");
    return data;
  }

  // Gemeinsames Verhalten für alle E-Mail-Formulare
  function mailForm({ form, email, button, status, consent, requireConsent, busy, fn, extra, done }) {
    form.addEventListener("submit", async e => {
      e.preventDefault();
      status.classList.remove("danger"); status.textContent = "";
      const addr = email.value.trim();
      if (!EMAIL_RE.test(addr)) { status.textContent = "Please enter a valid email address."; status.classList.add("danger"); return; }
      if (requireConsent && !consent.checked) { status.textContent = "Please tick the box to receive the Sound Drop."; status.classList.add("danger"); return; }
      const label = button.textContent;
      button.disabled = true; button.textContent = busy;
      try {
        const data = await callFn(fn, { email: addr, marketing_consent: consent.checked, ...(extra ? extra() : {}) });
        if (fn === "free-kit") window.ylyTrack && ylyTrack("freekit-signup");
        status.textContent = done(data);
        email.value = ""; consent.checked = false;
      } catch (err) {
        status.textContent = err.message || "Something went wrong. Please try again."; status.classList.add("danger");
      } finally {
        button.disabled = false; button.textContent = label;
      }
    });
  }

  // =====================================================================
  // MIX CHECK
  // =====================================================================
  const STATUS = { good: "good", ok: "ok", warn: "warn" };
  // Status + kurzer Satz pro Prüf-Code (ausführliche Tipps kommen per E-Mail)
  const SHORT = {
    loud_too_hot: ["warn", "Very loud – likely over-limited."],
    loud_hot: ["ok", "Loud, typical for trap & hip-hop."],
    loud_good: ["good", "Healthy, competitive loudness."],
    loud_moderate: ["ok", "A bit quiet for the genre."],
    loud_quiet: ["warn", "Quiet compared with other releases."],
    clipping: ["warn", "Clipping detected."],
    tp_over: ["warn", "Peaks go above 0 dB."],
    tp_tight: ["ok", "Peaks very close to 0 dB."],
    tp_good: ["good", "Peaks are safe for streaming."],
    dyn_squashed: ["warn", "Very compressed, drums may lose punch."],
    dyn_dense: ["ok", "Dense, but still okay."],
    dyn_good: ["good", "Good balance of punch and loudness."],
    dyn_open: ["ok", "Very dynamic, could be louder."],
    mixloud_hot: ["warn", "Very loud for a mix – limiter on the bus?"],
    mixloud_good: ["good", "Good level for mastering."],
    mixloud_quiet: ["ok", "Quite quiet mix."],
    mixpeak_clip: ["warn", "Your mix is clipping."],
    mixpeak_hot: ["ok", "Little headroom for mastering."],
    mixpeak_good: ["good", "Good headroom for mastering."],
    mixpeak_low: ["ok", "Lots of headroom, could be a bit hotter."],
    mixdyn_squashed: ["warn", "Mix is already heavily compressed."],
    mixdyn_good: ["good", "Healthy dynamics for mastering."],
    low_thin: ["warn", "Low end feels thin."],
    low_boomy: ["warn", "Low end is very heavy."],
    low_good: ["good", "Balanced low end."],
    high_dull: ["warn", "Highs are dull."],
    high_harsh: ["warn", "Highs are very bright."],
    high_good: ["good", "Balanced highs."],
    st_monofile: ["ok", "Mono file."],
    st_phase: ["warn", "Phase problems – parts may vanish in mono."],
    st_wide: ["ok", "Very wide – check it in mono."],
    st_narrow: ["ok", "Almost mono, could be wider."],
    st_good: ["good", "Healthy stereo image."],
    lowmono_bad: ["warn", "Low end is not mono."],
    lowmono_good: ["good", "Mono-safe low end."],
  };
  const GROUPS = [
    ["loudness", "Loudness"], ["peaks", "Peaks"], ["dynamics", "Dynamics"], ["tone", "Tonal balance"], ["stereo", "Stereo image"],
  ];
  const POINTS = { good: 100, ok: 70, warn: 35 };
  const RANK = { good: 0, ok: 1, warn: 2 };
  const ICON = { good: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>', ok: "!", warn: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' };

  let mode = "master", metrics = null, checks = [], fileName = "";

  const modeBtns = [...document.querySelectorAll(".mc-toggle button")];
  modeBtns.forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    modeBtns.forEach(x => { x.classList.toggle("active", x === b); x.setAttribute("aria-checked", x === b ? "true" : "false"); });
    if (metrics) render();                       // Ergebnis sofort für den anderen Modus neu bewerten
  }));

  const drop = $("mc-drop"), fileInput = $("mc-file");
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => { const f = e.dataTransfer.files[0]; if (f) run(f); });
  fileInput.addEventListener("change", () => { const f = fileInput.files[0]; if (f) run(f); fileInput.value = ""; });
  $("mc-again").addEventListener("click", () => {
    metrics = null;
    $("mc-result").classList.add("hidden");
    drop.classList.remove("hidden");
    drop.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  function setProgress(pct, text) {
    $("mc-progress-fill").style.width = pct + "%";
    $("mc-progress-pct").textContent = Math.round(pct) + "%";
    $("mc-progress-text").textContent = text;
  }

  async function run(file) {
    $("mc-error").classList.add("hidden");
    $("mc-result").classList.add("hidden");
    drop.classList.add("hidden");
    $("mc-progress").classList.remove("hidden");
    setProgress(0, "Reading your file …");
    try {
      metrics = await window.MixCheck.analyze(file, setProgress);
      fileName = file.name.replace(/\.[^.]+$/, "");
      render();
      $("mc-result").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      metrics = null;
      $("mc-error").textContent = err.message || "This file could not be analysed.";
      $("mc-error").classList.remove("hidden");
      drop.classList.remove("hidden");
    } finally {
      $("mc-progress").classList.add("hidden");
    }
  }

  function render() {
    checks = window.MixCheck.evaluate(metrics, mode);
    const score = Math.round(checks.reduce((s, c) => s + POINTS[SHORT[c.code][0]], 0) / checks.length);
    $("mc-score-num").textContent = score;
    $("mc-ring").style.setProperty("--p", score);
    $("mc-ring").dataset.level = score >= 85 ? "good" : score >= 65 ? "ok" : "warn";
    $("mc-file-name").textContent = fileName || "Your track";
    const warns = checks.filter(c => SHORT[c.code][0] === "warn").length;
    $("mc-verdict").textContent = score >= 85 ? "Great shape" : score >= 65 ? "Good, with a few things to check" : "Some things need fixing";
    $("mc-verdict-text").textContent = warns
      ? `${warns} ${warns === 1 ? "point needs" : "points need"} attention. Get the full report below to see exactly what to fix.`
      : "Nothing critical found. The full report shows every value in detail.";

    $("mc-tiles").innerHTML = GROUPS.map(([g, label]) => {
      const items = checks.filter(c => c.group === g);
      if (!items.length) return "";
      const worst = items.reduce((a, c) => RANK[SHORT[c.code][0]] > RANK[SHORT[a.code][0]] ? c : a, items[0]);
      const st = STATUS[SHORT[worst.code][0]];
      return `
        <div class="mc-tile" data-status="${st}">
          <div class="mc-tile-head"><span class="mc-dot" aria-hidden="true">${ICON[st]}</span><strong>${esc(label)}</strong></div>
          <p class="mc-tile-value">${items.map(c => esc(c.value)).join("<br>")}</p>
          <p class="mc-tile-text">${esc(SHORT[worst.code][1])}</p>
        </div>`;
    }).join("");

    drop.classList.add("hidden");
    $("mc-result").classList.remove("hidden");
  }

  mailForm({
    form: $("mc-mail"), email: $("mc-email"), button: $("mc-send"), status: $("mc-status"), consent: $("mc-consent"),
    busy: "Sending …", fn: "mix-check-report",
    extra: () => ({ mode, file_name: fileName, checks: checks.map(c => ({ code: c.code, group: c.group, value: c.value })) }),
    done: () => "Done! Your report is on its way – check your inbox (and spam folder).",
  });

  // =====================================================================
  // SOUND DROP
  // =====================================================================
  const nextDrop = () => {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const days = Math.ceil((next - now) / 86400000);
    return days <= 1 ? "Next drop: tomorrow" : `Next drop in ${days} days`;
  };
  $("drop-next").textContent = nextDrop();

  async function loadDrop() {
    if (!db) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await db.from("sound_drops").select("title,description,preview_path,release_date")
      .eq("published", true).lte("release_date", today).order("release_date", { ascending: false }).limit(1).maybeSingle();
    if (!data) {
      $("drop-title").textContent = "First drop coming soon.";
      $("drop-desc").textContent = "Sign up now and get the first royalty-free Sound Drop from YARDSLOVESYOU the day it lands.";
      $("drop-btn").textContent = "Sign me up";
      return;
    }
    $("drop-title").textContent = data.title;
    if (data.description) $("drop-desc").textContent = data.description;
    if (data.preview_path) setupPreview(media(data.preview_path));
  }

  function setupPreview(src) {
    const PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    const PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    $("drop-bars").innerHTML = Array.from({ length: 48 }, () => '<span class="wave-bar"></span>').join("");
    $("drop-preview").classList.remove("hidden");
    const audio = new Audio(src); audio.preload = "none";
    const btn = $("drop-play"), wave = $("drop-wave"), bars = [...wave.querySelectorAll(".wave-bar")];
    btn.innerHTML = PLAY;
    btn.onclick = () => audio.paused ? audio.play().catch(() => {}) : audio.pause();
    audio.onplay = () => { btn.innerHTML = PAUSE; };
    audio.onpause = audio.onended = () => { btn.innerHTML = PLAY; };
    audio.ontimeupdate = () => {
      const n = Math.round((audio.duration ? audio.currentTime / audio.duration : 0) * bars.length);
      bars.forEach((b, i) => b.classList.toggle("active", i < n));
    };
    wave.onclick = e => {
      if (!audio.duration) return;
      const r = wave.getBoundingClientRect();
      audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
    };
  }

  mailForm({
    form: $("drop-form"), email: $("drop-email"), button: $("drop-btn"), status: $("drop-status"), consent: $("drop-consent"),
    requireConsent: true, busy: "Sending …",
    fn: "sound-drop", extra: () => ({ action: "subscribe" }),
    done: d => d.no_drop ? "You're in! You'll get the first drop as soon as it lands."
      : d.already_sent ? "We just sent it to you – please check your inbox (and spam folder)."
      : "You're in! This month's drop is on its way – check your inbox (and spam folder).",
  });
  loadDrop();

  // =====================================================================
  // FREE KIT (gleiche Function wie im Shop)
  // =====================================================================
  mailForm({
    form: $("free-kit-form"), email: $("free-kit-email"), button: $("free-kit-btn"), status: $("free-kit-status"), consent: $("free-kit-consent"),
    busy: "Sending …", fn: "free-kit",
    done: d => d.already_sent ? "We just sent it to you – please check your inbox (and spam folder)."
      : "Done! Check your inbox for the download link (and your spam folder, just in case).",
  });
})();

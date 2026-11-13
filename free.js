(() => {
  const cfg = window.APP_CONFIG || {}, $ = id => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const db = window.supabase ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY) : null;
  const hint=(m,t)=>{ m=String(m||"Something went wrong."); return /try again|try another/i.test(m)?m:m.replace(/[.!?\s]*$/,"")+". "+(t||"Please try again."); };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const media = u => { const r = /^https?:\/\//.test(u) ? u : db.storage.from("coverart-products").getPublicUrl(u).data.publicUrl; return window.YLYMedia ? window.YLYMedia.url(r) : r; };

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
        status.textContent = hint(err.message); status.classList.add("danger");
      } finally {
        button.disabled = false; button.textContent = label;
      }
    });
  }

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

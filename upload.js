/* ---------- Pricing: one place for prices, formula and approximate FX hints ---------- */
(function () {
  // Approximate FX hints only (you always pay in CHF). 1 CHF is roughly:
  var RATES = { USD: 1.12, EUR: 1.05 };
  var EP_MIN_SONGS = 4, EP_DISCOUNT = 0.10, RUSH_RATE = 0.30, MAX_SONGS = 20;
  // Same formula as the Edge Function create-submission-checkout (which recomputes it server-side).
  function calc(price, songs, rush) {
    var base = price * songs;
    var discount = songs >= EP_MIN_SONGS ? Math.round(base * EP_DISCOUNT) : 0;
    var discounted = base - discount;
    var total = rush ? Math.round(discounted * (1 + RUSH_RATE)) : discounted;
    return { base: base, discount: discount, rush: total - discounted, total: total };
  }
  function approx(chf) {
    return "≈ USD " + Math.round(chf * RATES.USD) + " / EUR " + Math.round(chf * RATES.EUR);
  }
  window.YLYPricing = { calc: calc, approx: approx, RATES: RATES, EP_MIN_SONGS: EP_MIN_SONGS, MAX_SONGS: MAX_SONGS };
})();

document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const P = window.YLYPricing;

  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (!window.supabase) {
    console.error("Supabase SDK is not loaded!");
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const fileLabel = $("file-label");
  const fileInput = $("submission-file");
  const fileHint = $("file-hint");
  const songsInput = $("song-count");
  const rushInput = $("rush-48h");
  const summaryEl = $("price-summary");
  const inquiryForm = $("inquiry-form");
  const serviceRadios = [...document.querySelectorAll('input[name="service"]')];
  const selectedService = () => serviceRadios.find(r => r.checked) || serviceRadios[0];
  const REVISIONS = { "mastering": 1, "stem-mastering": 1, "mixing": 3, "mix-master": 3 };
  // Mix Feedback: schon 48 h, deshalb kein Rush; wird bei Mixing / Mix + Master innerhalb 30 Tagen angerechnet (serverseitig)
  const NO_RUSH = { "mix-feedback": true };
  const CREDITABLE = { "mixing": true, "mix-master": true };

  const getSongs = () => {
    const n = Number(songsInput ? songsInput.value : 1);
    return Number.isInteger(n) && n >= 1 && n <= P.MAX_SONGS ? n : null;
  };
  // WAV is only allowed for Mastering with exactly one song; everything else needs a ZIP.
  const wavAllowed = () => selectedService().dataset.kind === "wavzip" && getSongs() === 1;
  const text = (tag, cls, t) => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = t; return n; };
  const chf = n => "CHF " + n;

  // Approximate USD/EUR hint next to every price in the picker
  document.querySelectorAll("[data-approx]").forEach(el => { el.textContent = P.approx(Number(el.dataset.approx)); });

  function renderSummary() {
    if (!summaryEl) return;
    summaryEl.textContent = "";
    const r = selectedService();
    const songs = getSongs();
    if (songs === null) { summaryEl.appendChild(text("p", "up-approx", "Enter a number of songs between 1 and " + P.MAX_SONGS + ".")); return; }
    const rush = !!(rushInput && rushInput.checked);
    const c = P.calc(Number(r.dataset.price), songs, rush);
    const row = (cls, a, b) => { const d = text("div", "up-row" + (cls ? " " + cls : ""), ""); d.appendChild(text("span", "", a)); d.appendChild(text("span", "", b)); summaryEl.appendChild(d); };
    row("", r.dataset.name + (songs > 1 ? " × " + songs + " songs" : ""), chf(c.base));
    if (c.discount) row("disc", "EP discount (−10%)", "−" + chf(c.discount));
    if (rush) row("", "Rush 48h (+30%)", "+" + chf(c.rush));
    const t = text("div", "up-total", ""); t.appendChild(text("span", "", "Total")); t.appendChild(text("span", "", chf(c.total)));
    summaryEl.appendChild(t);
    summaryEl.appendChild(text("p", "up-approx", P.approx(c.total) + " (approximate, you pay in CHF)"));
    if (CREDITABLE[r.value]) summaryEl.appendChild(text("p", "up-approx", "Had a Mix Feedback in the last 30 days? CHF 29 is deducted at checkout (same email)."));
  }

  // Label, erlaubter Dateityp und Hinweis passend zu Service, Songs und Rush
  function applyService(resetFile) {
    const r = selectedService();
    const trust = $("trust-text");
    const rev = REVISIONS[r.value];
    if (trust && rev) trust.textContent = rev + " revision" + (rev === 1 ? "" : "s") + " included · Track your order online · Secure checkout (TWINT, PayPal, card)";
    if (trust && r.value === "mix-feedback") trust.textContent = "Feedback within 48 hours · Track your order online · Secure checkout (TWINT, PayPal, card)";
    if (rushInput) {
      const off = !!NO_RUSH[r.value];
      if (off) rushInput.checked = false;
      rushInput.disabled = off;
      const box = rushInput.closest(".up-check");
      if (box) { box.classList.toggle("is-off", off); box.title = off ? "Mix Feedback is already delivered within 48 hours." : ""; }
    }
    if (!fileInput || !fileLabel) return;
    const songs = getSongs();
    const wav = wavAllowed();
    const total = songs === null ? null : P.calc(Number(r.dataset.price), songs, !!(rushInput && rushInput.checked)).total;
    const what = songs && songs > 1 ? r.dataset.name + " × " + songs + " songs" : r.dataset.name;
    fileLabel.textContent = (wav ? "WAV file or ZIP archive" : "ZIP archive (.zip only)") + " – " + what + (total === null ? "" : " (" + chf(total) + ")");
    fileInput.accept = wav ? ".wav,audio/wav,.zip,application/zip,application/x-zip-compressed" : ".zip,application/zip,application/x-zip-compressed";
    if (fileHint) {
      fileHint.textContent = songs && songs > 1
        ? "Put all " + songs + " songs (or their stems) into one ZIP file."
        : (r.dataset.hint || "Put all stems into one ZIP file.");
    }
    // A WAV that is no longer allowed (other service or more songs) is dropped
    const f = fileInput.files && fileInput.files[0];
    if (resetFile || (f && !wav && !f.name.toLowerCase().endsWith(".zip"))) fileInput.value = "";
  }

  function refresh(resetFile) { applyService(resetFile); renderSummary(); }

  // Service aus dem Link vorauswählen, z. B. /mixing?service=mixing
  const preset = new URLSearchParams(location.search).get("service");
  const presetRadio = serviceRadios.find(r => r.value === preset);
  if (presetRadio) presetRadio.checked = true;

  serviceRadios.forEach(r => r.addEventListener("change", () => refresh(true)));
  if (songsInput) songsInput.addEventListener("input", () => refresh(false));
  if (rushInput) rushInput.addEventListener("change", () => refresh(false));
  refresh(false);

  // ---------- Capacity ("Booked out"): service_slots_left() -> null = no limit, otherwise free slots this month ----------
  const CAP_KEY = "yly_slots_v1", CAP_TTL = 5 * 60 * 1000;
  const CAP_DEFAULT_MSG = "I'm fully booked for this month. New slots open on the 1st. You can still send a custom beat inquiry or message me.";
  async function loadSlots() {
    try { const o = JSON.parse(sessionStorage.getItem(CAP_KEY)); if (o && Date.now() - o.t < CAP_TTL && (o.v === null || Number.isInteger(o.v))) return o.v; } catch (e) {}
    const { data, error } = await db.rpc("service_slots_left");
    if (error) throw error;
    const v = typeof data === "number" && Number.isFinite(data) ? Math.max(0, Math.floor(data)) : null;
    try { sessionStorage.setItem(CAP_KEY, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
    return v;
  }
  async function loadCapMessage() {
    try {
      const { data } = await db.from("site_settings").select("value").eq("key", "service_capacity").maybeSingle();
      const m = data && data.value && typeof data.value.message === "string" ? data.value.message.trim() : "";
      return m.slice(0, 300);
    } catch (e) { return ""; }
  }
  let booked = false;
  function applyBooked(msg) {
    booked = true;
    const panel = $("up-booked"), m = $("up-booked-msg");
    if (m) m.textContent = msg || CAP_DEFAULT_MSG;
    if (panel) panel.hidden = false;
    const f = $("upload-form");
    if (f) {
      f.classList.add("is-booked");
      f.setAttribute("aria-disabled", "true");
      f.querySelectorAll("input, textarea, select, button").forEach(el => { el.disabled = true; });
    }
    const slots = $("up-slots"); if (slots) slots.hidden = true;
  }
  (async function initCapacity() {
    try {
      const left = await loadSlots();
      if (left === null || left === undefined) return;
      if (left <= 0) { applyBooked(await loadCapMessage()); return; }
      if (left <= 3) {
        const el = $("up-slots");
        if (el) { el.textContent = "Only " + left + " slot" + (left === 1 ? "" : "s") + " left this month"; el.hidden = false; }
      }
    } catch (e) { /* nothing shown on errors */ }
  })();

  // ---------- Waitlist (only visible when booked out) ----------
  const wlForm = $("up-waitlist");
  if (wlForm) {
    wlForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailEl = $("wl-email"), consentEl = $("wl-consent"), btn = $("wl-btn"), st = $("wl-status");
      const say = (m, bad) => { if (st) { st.textContent = m; st.classList.toggle("is-error", !!bad); } };
      const email = emailEl ? emailEl.value.trim() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) { say("Please enter a valid email address.", true); if (emailEl) emailEl.focus(); return; }
      if (!consentEl || !consentEl.checked) { say("Please tick the box so I know you want one email.", true); return; }
      if (btn) btn.disabled = true;
      say("");
      try {
        const { error } = await db.from("service_waitlist").insert({ email: email });
        if (error && error.code !== "23505") throw error;
        window.ylyTrack && ylyTrack("waitlist-join", {});
        wlForm.reset();
        say("You're on the list. I'll email you when slots open.");
      } catch (err) {
        console.error("Waitlist failed:", err);
        say("That didn't work. Please try again, or email hello@yardslovesyou.com.", true);
        if (btn) btn.disabled = false;
      }
    });
  }

  // ---------- Resume checkout from reminder email (?resume=<id>&t=<token>) ----------
  (async function resumeCheckout() {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let rid = null, tok = null;
    try {
      const q = new URLSearchParams(window.location.search);
      rid = q.get("resume"); tok = q.get("t");
      if (rid !== null || tok !== null) {
        q.delete("resume"); q.delete("t");
        const qs = q.toString();
        history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
      }
    } catch (e) { return; }
    if (!rid || !tok) return;
    const el = $("up-resume");
    if (!el) return;
    el.hidden = false;
    el.classList.remove("is-error");
    const fail = m => { el.classList.add("is-error"); el.textContent = m; };
    if (!UUID.test(rid) || !UUID.test(tok)) { fail("This link has expired or the order is already paid. Upload again or email hello@yardslovesyou.com."); return; }
    el.textContent = "Finishing your order\u2026";
    window.ylyTrack && ylyTrack("resume-checkout", {});
    try {
      const { data, error } = await db.functions.invoke("create-submission-checkout", { body: { request_id: rid, resume_token: tok } });
      let msg = data && data.error;
      if (!msg && error) { try { msg = (await error.context.json()).error; } catch (_) {} }
      if (!data || !data.url || !/^https:\/\//i.test(String(data.url))) {
        if (msg && /fully booked/i.test(msg)) { fail(msg); return; }
        throw new Error(msg || "no url");
      }
      window.location.href = data.url;
    } catch (err) {
      console.error("Resume failed:", err);
      fail("This link has expired or the order is already paid. Upload again or email hello@yardslovesyou.com.");
    }
  })();

  // ---------- Custom beat inquiry (no payment, no upload) ----------
  if (inquiryForm) {
    inquiryForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const statusEl = $("inq-status"), btn = $("inq-btn");
      const v = id => ($(id) ? $(id).value.trim() : "");
      const body = {
        service_type: "custom-beat", name: v("inq-name"), email: v("inq-email"), description: v("inq-desc"),
        links: v("inq-links"), budget: v("inq-budget"), deadline: v("inq-deadline"), website: v("inq-website")
      };
      const fail = m => { if (statusEl) statusEl.textContent = m; };
      if (!body.name || body.name.length > 100) return fail("Please enter your name (max. 100 characters).");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email) || body.email.length > 254) return fail("Please enter a valid email address.");
      if (body.description.length < 10) return fail("Please describe the vibe you are looking for (at least 10 characters).");
      if (body.description.length > 3000 || body.links.length > 1000 || body.budget.length > 60 || body.deadline.length > 100) return fail("One of your entries is too long.");
      if (btn) { btn.disabled = true; btn.textContent = "Sending..."; }
      if (statusEl) statusEl.textContent = "";
      try {
        const { data, error } = await db.functions.invoke("service-inquiry", { body });
        let msg = data && data.error;
        if (!msg && error) { try { msg = (await error.context.json()).error; } catch (_) { msg = error.message; } }
        if (msg || error) throw new Error(msg || "Your inquiry could not be sent.");
        window.ylyTrack && ylyTrack("custom-beat-inquiry", {});
        inquiryForm.reset();
        if (btn) btn.textContent = "Inquiry sent";
        if (statusEl) statusEl.textContent = "Thanks! Your inquiry is in. I'll get back to you by email with a quote.";
      } catch (err) {
        console.error("Inquiry failed:", err);
        fail("Your inquiry couldn't be sent. Please try again \u2014 or email me if it keeps happening.");
        if (btn) { btn.disabled = false; btn.textContent = "Send inquiry"; }
      }
    });
  }

  // Payment confirmation and status update happen on success.html + stripe-webhook

  const uploadForm = $("upload-form");
  if (uploadForm) {
    uploadForm.onsubmit = async (e) => {
      e.preventDefault();
      if (booked) return;

      const btn = $("submit-btn");
      const statusEl = $("upload-status");
      const progressContainer = $("progress-container");
      const progressBarFill = $("progress-bar-fill");
      const progressPercent = $("progress-percent");

      const nameInput = $("artist-name");
      const emailInput = $("artist-email");
      const wishesInput = $("track-wishes");

      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim() : "";
      const serviceType = selectedService() ? selectedService().value : "mixing";
      const wishes = wishesInput ? wishesInput.value.trim() : "";
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;
      const songs = getSongs();
      const rush = !!(rushInput && rushInput.checked);

      const clearErr = el => {
        if (!el) return;
        el.removeAttribute("aria-invalid");
        const n = document.getElementById(el.id + "-error");
        if (n) n.textContent = "";
      };
      const invalid = (el, msg) => {
        if (!el) { if (statusEl) statusEl.textContent = msg; return; }
        let n = document.getElementById(el.id + "-error");
        if (!n) {
          n = document.createElement("p");
          n.id = el.id + "-error"; n.className = "field-error"; n.setAttribute("role", "alert");
          el.insertAdjacentElement("afterend", n);
          const clear = () => clearErr(el);
          el.addEventListener("input", clear); el.addEventListener("change", clear);
        }
        n.textContent = msg;
        el.setAttribute("aria-invalid", "true");
        el.setAttribute("aria-describedby", n.id);
        el.focus();
      };
      [fileInput, songsInput, nameInput, emailInput, wishesInput].forEach(clearErr);
      if (statusEl) { statusEl.textContent = ""; statusEl.setAttribute("role", "alert"); statusEl.setAttribute("aria-live", "polite"); }

      if (!file) { invalid(fileInput, "Please select a file to upload."); return; }
      if (songs === null) { invalid(songsInput, "Please enter a number of songs between 1 and " + P.MAX_SONGS + "."); return; }
      if (!name || name.length > 100) { invalid(nameInput, "Please enter your name (max. 100 characters)."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) { invalid(emailInput, "Please enter a valid email address."); return; }
      if (wishes.length > 2000) { invalid(wishesInput, "Your notes are too long (max. 2000 characters)."); return; }

      if (file.size > 52428800) { invalid(fileInput, "Your file is larger than 50 MB. Please compress it into a ZIP or send a download link via email."); return; }

      // Format validation
      const lower = file.name.toLowerCase();
      if (wavAllowed() ? !(lower.endsWith(".wav") || lower.endsWith(".zip")) : !lower.endsWith(".zip")) {
        invalid(fileInput, wavAllowed() ? "Please select a WAV file or a ZIP archive." : (songs > 1 ? "For several songs, please put all songs into one ZIP archive." : "Please select a valid ZIP archive."));
        return;
      }

      const setProgress = p => {
        if (progressBarFill) progressBarFill.style.width = p + "%";
        if (progressPercent) progressPercent.textContent = p + "%";
        if (window.YLYUploadFX) window.YLYUploadFX.progress(p);
      };

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Uploading file...";
      }
      if (progressContainer) progressContainer.classList.remove("hidden");
      if (statusEl) statusEl.textContent = "Upload started...";
      if (window.YLYUploadFX) window.YLYUploadFX.open(file.name);

      try {
        setProgress(10);

        // 1. Upload starten: Server prueft Eingaben + Limits, legt die Anfrage an und gibt eine signierte Upload-URL zurueck
        const { data: startData, error: startError } = await db.functions.invoke("submission-start", {
          body: {
            service_type: serviceType,
            name: name,
            email: email,
            wishes: wishes,
            songs: songs,
            rush: rush,
            file_name: file.name,
            file_size: file.size
          }
        });
        let startMsg = startData && startData.error;
        if (!startMsg && startError) { try { startMsg = (await startError.context.json()).error; } catch (_) {} }
        if (startError || !startData || !startData.request_id || !startData.path || !startData.token) {
          // 429 (Limit) und Validierungsfehler des Servers dem Nutzer zeigen
          if (startMsg && /too many uploads/i.test(startMsg)) {
            if (window.YLYUploadFX) window.YLYUploadFX.close();
            if (statusEl) statusEl.textContent = startMsg;
            if (btn) { btn.disabled = false; btn.textContent = "Proceed to checkout"; }
            if (progressContainer) progressContainer.classList.add("hidden");
            return;
          }
          throw new Error(startMsg || (startError && startError.message) || "Upload could not be started.");
        }
        const requestId = startData.request_id;

        setProgress(30);

        // 2. Datei direkt in den Bucket (signierte URL)
        const { error: storageError } = await db.storage
          .from("client-submissions")
          .uploadToSignedUrl(startData.path, startData.token, file);

        if (storageError) {
          throw new Error("Storage upload error: " + storageError.message);
        }

        setProgress(70);

        setProgress(100);

        if (statusEl) statusEl.textContent = "Redirecting to Stripe Checkout...";
        window.ylyTrack && ylyTrack("upload-checkout-click", { service: serviceType, songs: songs, rush: rush });

        // 3. Checkout-Link holen (Server prueft, dass die Datei wirklich im Bucket liegt)
        const { data: checkoutData, error: checkoutError } = await db.functions.invoke("create-submission-checkout", {
          body: {
            service_type: serviceType,
            request_id: requestId,
            email: email
          }
        });

        if (checkoutError || !checkoutData?.url) {
          throw new Error(checkoutData?.error || checkoutError?.message || "Checkout link could not be generated.");
        }

        // Redirect to Stripe
        if (!/^https:\/\//i.test(String(checkoutData.url))) throw new Error("Invalid checkout link.");
        const checkoutUrl = checkoutData.url;
        const goCheckout = () => { window.location.href = checkoutUrl; };
        if (window.YLYUploadFX) window.YLYUploadFX.finish(goCheckout); else goCheckout();

      } catch (err) {
        console.error("Upload process aborted:", err);
        if (window.YLYUploadFX) window.YLYUploadFX.close();
        if (statusEl) statusEl.textContent = "Checkout couldn't start. Please try again \u2014 or email me if it keeps happening.";
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Proceed to checkout";
        }
        if (progressContainer) progressContainer.classList.add("hidden");
      }
    };
  }
});

/* ---------- Progress stepper (display only, no upload logic) ---------- */
(function () {
  function init() {
    var nav = document.getElementById("up-stepper");
    var form = document.getElementById("upload-form");
    if (!nav || !form) return;
    var lis = [].slice.call(nav.querySelectorAll("li"));
    var file = document.getElementById("submission-file");
    var nameEl = document.getElementById("artist-name");
    var mailEl = document.getElementById("artist-email");
    var btn = document.getElementById("submit-btn");
    var targets = [
      form.querySelector("fieldset.field"),
      file && file.closest(".field"),
      nameEl && nameEl.closest(".field"),
      btn
    ];
    var labels = ["Service", "Files", "Details", "Pay"];
    var busy = false;

    function setTop() {
      var h = document.querySelector(".topbar");
      if (h) nav.style.top = h.offsetHeight + "px";
    }

    function render() {
      var hasFile = !!(file && file.files && file.files.length);
      var okDetails = !!(nameEl && nameEl.value.trim() && mailEl && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailEl.value.trim()));
      var cur = 2;
      if (hasFile) cur = 3;
      if (hasFile && okDetails) cur = 4;
      if (busy) cur = 4;
      lis.forEach(function (li, i) {
        var n = i + 1, b = li.querySelector("button");
        var done = n < cur;
        li.classList.toggle("done", done);
        li.classList.toggle("current", n === cur);
        li.classList.toggle("busy", busy && n === cur);
        b.disabled = !done;
        b.setAttribute("aria-label", "Step " + n + ": " + labels[i] + (done ? " (completed)" : n === cur ? " (current)" : ""));
        if (n === cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      });
    }

    lis.forEach(function (li, i) {
      li.querySelector("button").addEventListener("click", function () {
        var t = targets[i];
        if (!t) return;
        var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
        var y = t.getBoundingClientRect().top + window.pageYOffset - nav.offsetHeight - (parseInt(nav.style.top, 10) || 0) - 12;
        window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
        var f = t.querySelector && t.querySelector("input,textarea");
        if (f && f.type !== "radio") { try { f.focus({ preventScroll: true }); } catch (e) {} }
      });
    });

    form.addEventListener("input", render);
    form.addEventListener("change", render);
    if (btn) new MutationObserver(function () { busy = btn.disabled; render(); }).observe(btn, { attributes: true, attributeFilter: ["disabled"] });
    window.addEventListener("resize", setTop);
    setTop();
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();

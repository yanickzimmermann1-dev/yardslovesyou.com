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
  }

  // Label, erlaubter Dateityp und Hinweis passend zu Service, Songs und Rush
  function applyService(resetFile) {
    const r = selectedService();
    const trust = $("trust-text");
    const rev = REVISIONS[r.value];
    if (trust && rev) trust.textContent = rev + " revision" + (rev === 1 ? "" : "s") + " included · Track your order online · Secure checkout (TWINT, PayPal, card)";
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

  // Service aus dem Link vorauswählen, z. B. upload.html?service=mixing
  const preset = new URLSearchParams(location.search).get("service");
  const presetRadio = serviceRadios.find(r => r.value === preset);
  if (presetRadio) presetRadio.checked = true;

  serviceRadios.forEach(r => r.addEventListener("change", () => refresh(true)));
  if (songsInput) songsInput.addEventListener("input", () => refresh(false));
  if (rushInput) rushInput.addEventListener("change", () => refresh(false));
  refresh(false);

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
        fail("Error: " + err.message);
        if (btn) { btn.disabled = false; btn.textContent = "Send inquiry"; }
      }
    });
  }

  // Payment confirmation and status update happen on success.html + stripe-webhook

  const uploadForm = $("upload-form");
  if (uploadForm) {
    uploadForm.onsubmit = async (e) => {
      e.preventDefault();

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

      if (!file) {
        alert("Please select a file to upload.");
        return;
      }
      if (songs === null) { alert("Please enter a number of songs between 1 and " + P.MAX_SONGS + "."); return; }
      if (!name || name.length > 100) { alert("Please enter your name (max. 100 characters)."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) { alert("Please enter a valid email address."); return; }
      if (wishes.length > 2000) { alert("Your notes are too long (max. 2000 characters)."); return; }

      // Format validation
      const lower = file.name.toLowerCase();
      if (wavAllowed() ? !(lower.endsWith(".wav") || lower.endsWith(".zip")) : !lower.endsWith(".zip")) {
        alert(wavAllowed() ? "Please select a WAV file or a ZIP archive." : (songs > 1 ? "For several songs, please put all songs into one ZIP archive." : "Please select a valid ZIP archive."));
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
        const requestId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

        // Folder structure: email address as folder name
        const cleanEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${cleanEmail}/${Date.now()}_${cleanFileName}`;

        setProgress(30);

        // 1. Storage upload
        const { error: storageError } = await db.storage
          .from("client-submissions")
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) {
          throw new Error("Storage upload error: " + storageError.message);
        }

        setProgress(70);

        // 2. Create database entry
        const { error: dbError } = await db
          .from("client_requests")
          .insert([
            {
              id: requestId,
              artist_name: name,
              email: email,
              service_type: serviceType,
              wishes: wishes,
              songs: songs,
              rush: rush,
              file_path: filePath,
              status: "pending"
            }
          ]);

        if (dbError) {
          throw new Error("Database error: " + dbError.message);
        }

        setProgress(100);

        if (statusEl) statusEl.textContent = "Redirecting to Stripe Checkout...";
        window.ylyTrack && ylyTrack("upload-checkout-click", { service: serviceType, songs: songs, rush: rush });

        // 3. Call edge function
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
        if (statusEl) statusEl.textContent = "Error: " + err.message;
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

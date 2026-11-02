document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);

  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (!window.supabase) {
    console.error("Supabase SDK ist nicht geladen!");
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const serviceSelect = $("service-type");
  const fileLabel = $("file-label");
  const fileInput = $("submission-file");

  // Dynamische Dateityp-Anpassung
  if (serviceSelect && fileInput && fileLabel) {
    serviceSelect.onchange = () => {
      const val = serviceSelect.value;
      if (val === "vocal-hook") {
        fileLabel.textContent = "WAV File (.wav only) – Vocal-Hook (500 CHF)";
        fileInput.accept = ".wav,audio/wav";
      } else if (val === "mixing") {
        fileLabel.textContent = "ZIP Archive (.zip only) – Mixing (300 CHF)";
        fileInput.accept = ".zip,application/zip,application/x-zip-compressed";
      } else {
        fileLabel.textContent = "ZIP Archive (.zip only) – Stem-Mastering (200 CHF)";
        fileInput.accept = ".zip,application/zip,application/x-zip-compressed";
      }
    };
  }

  // Erfolgs-Check nach Stripe Redirect
  const params = new URLSearchParams(location.search);
  if (params.get("success") === "1" && params.get("session_id")) {
    const uploadForm = $("upload-form");
    if (uploadForm) uploadForm.style.display = "none";
    const banner = $("success-banner");
    if (banner) banner.classList.remove("hidden");

    const sessionId = params.get("session_id");
    db.from("client_requests")
      .update({ status: "complete" })
      .eq("stripe_session_id", sessionId)
      .then(({ error }) => {
        if (error) console.error("Fehler beim Aktualisieren des Status:", error);
      });
  }

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
      const serviceType = serviceSelect ? serviceSelect.value : "mixing";
      const wishes = wishesInput ? wishesInput.value.trim() : "";
      const file = fileInput && fileInput.files ? fileInput.files[0] : null;

      if (!file) {
        alert("Bitte wähle eine Datei zum Hochladen aus.");
        return;
      }

      // Format-Prüfung
      if (serviceType === "vocal-hook" && !file.name.toLowerCase().endsWith(".wav")) {
        alert("Bitte wähle eine gültige WAV-Datei aus.");
        return;
      }
      if ((serviceType === "mixing" || serviceType === "stem-mastering") && !file.name.toLowerCase().endsWith(".zip")) {
        alert("Bitte wähle ein gültiges ZIP-Archiv aus.");
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Datei wird hochgeladen...";
      }
      if (progressContainer) progressContainer.classList.remove("hidden");
      if (statusEl) statusEl.textContent = "Upload gestartet...";

      try {
        const requestId = crypto.randomUUID();
        
        // Ordnerstruktur: E-Mail-Adresse als Ordnername
        const cleanEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${cleanEmail}/${Date.now()}_${cleanFileName}`;

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "30%";
          progressPercent.textContent = "30%";
        }

        // 1. Storage Upload
        const { error: storageError } = await db.storage
          .from("client-submissions")
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) {
          throw new Error("Storage Upload Fehler: " + storageError.message);
        }

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "70%";
          progressPercent.textContent = "70%";
        }

        // 2. Datenbank-Eintrag anlegen
        const { error: dbError } = await db
          .from("client_requests")
          .insert([
            {
              id: requestId,
              artist_name: name,
              email: email,
              service_type: serviceType,
              wishes: wishes,
              file_path: filePath,
              status: "pending"
            }
          ]);

        if (dbError) {
          throw new Error("Datenbank Fehler: " + dbError.message);
        }

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "100%";
          progressPercent.textContent = "100%";
        }

        if (statusEl) statusEl.textContent = "Weiterleitung zu Stripe Checkout...";

        // 3. Edge Function aufrufen
        const { data: checkoutData, error: checkoutError } = await db.functions.invoke("create-submission-checkout", {
          body: { 
            service_type: serviceType, 
            request_id: requestId, 
            email: email 
          }
        });

        if (checkoutError || !checkoutData?.url) {
          throw new Error(checkoutError?.message || "Checkout-Link konnte nicht generiert werden.");
        }

        // Weiterleitung zu Stripe
        window.location.href = checkoutData.url;

      } catch (err) {
        console.error("Upload-Prozess abgebrochen:", err);
        if (statusEl) statusEl.textContent = "Fehler: " + err.message;
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Zum Checkout";
        }
        if (progressContainer) progressContainer.classList.add("hidden");
      }
    };
  }
});

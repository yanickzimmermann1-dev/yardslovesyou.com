(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);

  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  if (!window.supabase) {
    console.error("Supabase SDK is not loaded!");
    return;
  }

  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const serviceSelect = $("service-type");
  const fileLabel = $("file-label");
  const fileInput = $("submission-file");

  // Dynamische Anpassung je nach gewähltem Service (Preise & Dateiformate)
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

  // Nach erfolgreichem Checkout zurückkehren & Status in DB auf 'complete' setzen
  const params = new URLSearchParams(location.search);
  if (params.get("success") === "1" && params.get("session_id")) {
    const formEl = $("upload-form");
    if (formEl) formEl.style.display = "none";
    const banner = $("success-banner");
    if (banner) banner.classList.remove("hidden");

    // Status in Supabase auf 'complete' aktualisieren basierend auf der sessionId
    (async () => {
      const sessionId = params.get("session_id");
      try {
        await db.from("client_requests")
          .update({ status: "complete" })
          .eq("stripe_session_id", sessionId);
      } catch (err) {
        console.error("Fehler beim Aktualisieren des Status:", err);
      }
    })();
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

      const name = $("artist-name").value.trim();
      const email = $("artist-email").value.trim();
      const serviceType = serviceSelect.value;
      const wishes = $("track-wishes").value.trim();
      const file = fileInput.files[0];

      if (!file) {
        alert("Bitte wähle eine Datei aus.");
        return;
      }

      // Validierung
      if (serviceType === "vocal-hook" && !file.name.toLowerCase().endsWith(".wav")) {
        alert("Bitte wähle eine gültige .wav Datei für den Vocal-Hook.");
        return;
      }
      if ((serviceType === "mixing" || serviceType === "stem-mastering") && !file.name.toLowerCase().endsWith(".zip")) {
        alert("Bitte wähle ein gültiges .zip Archiv aus.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Wird hochgeladen...";
      if (progressContainer) progressContainer.classList.remove("hidden");

      try {
        const requestId = crypto.randomUUID();
        const cleanEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${cleanEmail}/${Date.now()}_${cleanFileName}`;

        // Simulierter oder echter Upload-Fortschritt via XMLHttpRequest / Supabase
        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "40%";
          progressPercent.textContent = "40%";
        }

        // 1. Datei in den Storage-Ordner (benannt nach E-Mail) hochladen
        const { error: storageError } = await db.storage
          .from("client-submissions")
          .upload(filePath, file);

        if (storageError) throw storageError;

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "80%";
          progressPercent.textContent = "80%";
        }

        // 2. Datenbankeintrag anlegen mit Status "pending"
        const serviceLabels = {
          "mixing": "Mixing (300 CHF)",
          "stem-mastering": "Stem-Mastering (200 CHF)",
          "vocal-hook": "Vocal-Hook (500 CHF)"
        };

        const formattedWishes = `[Service: ${serviceLabels[serviceType]}]\n${wishes}`;

        const { error: dbError } = await db
          .from("client_requests")
          .insert([
            {
              id: requestId,
              artist_name: name,
              email: email,
              service_type: serviceType,
              wishes: formattedWishes,
              file_path: filePath,
              status: "pending"
            }
          ]);

        if (dbError) throw new Error("Datenbankfehler: " + dbError.message);

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "100%";
          progressPercent.textContent = "100%";
        }

        if (statusEl) statusEl.textContent = "Weiterleitung zum sicheren Checkout...";

        // 3. Supabase Edge Function für Stripe Checkout aufrufen
        const { data: checkoutData, error: checkoutError } = await db.functions.invoke("create-checkout", {
          body: { 
            service_type: serviceType, 
            request_id: requestId, 
            email: email 
          }
        });

        if (checkoutError || !checkoutData?.url) {
          throw new Error(checkoutError?.message || "Konnte keine Checkout-Session erstellen.");
        }

        // Stripe Session ID in DB zwischenspeichern für spätere Zuordnung (optional aber empfohlen)
        // (Wird im Normalfall auch über Webhooks oder nach dem Redirect gelöst)

        // 4. Zu Stripe weiterleiten
        location.href = checkoutData.url;

      } catch (err) {
        console.error(err);
        if (statusEl) statusEl.textContent = "Fehler: " + (err.message || "Upload fehlgeschlagen.");
        btn.disabled = false;
        btn.textContent = "Zum Checkout";
        if (progressContainer) progressContainer.classList.add("hidden");
      }
    };
  }

  // Admin Toggle Logik
  const adminToggle = $("admin-toggle");
  if (adminToggle) {
    adminToggle.onclick = (e) => {
      e.preventDefault();
      const panel = $("admin-panel");
      if (panel) panel.classList.toggle("hidden");
    };
  }
});

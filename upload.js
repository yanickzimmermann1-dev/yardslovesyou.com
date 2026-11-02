(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);

  const yearEl = $("year");
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  // Supabase Client initialisieren
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const serviceSelect = $("service-type");
  const fileInput = $("submission-file");
  const fileLabel = $("file-label");

  // Dynamische Anpassung des Datei-Inputs je nach gewähltem Service
  if (serviceSelect && fileInput && fileLabel) {
    serviceSelect.onchange = () => {
      if (serviceSelect.value === "stem-mastering") {
        fileLabel.textContent = "ZIP Archive (.zip only, containing stems)";
        fileInput.accept = ".zip,application/zip,application/x-zip-compressed";
      } else {
        fileLabel.textContent = "WAV File (.wav only)";
        fileInput.accept = ".wav,audio/wav";
      }
    };
  }

  const uploadForm = $("upload-form");
  if (uploadForm) {
    uploadForm.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("submit-btn");
      const status = $("upload-status");

      const name = $("artist-name").value.trim();
      const email = $("artist-email").value.trim();
      const serviceType = serviceSelect ? serviceSelect.value : "mastering";
      const wishesInput = $("track-wishes").value.trim();
      const file = fileInput.files[0];

      if (!file) {
        alert("Please select a file to upload.");
        return;
      }

      // Dateityp-Validierung im Frontend
      if (serviceType === "stem-mastering" && !file.name.toLowerCase().endsWith(".zip")) {
        alert("Please select a valid ZIP file for Stem Mastering.");
        return;
      }
      if (serviceType === "mastering" && !file.name.toLowerCase().endsWith(".wav")) {
        alert("Please select a valid WAV file for Mastering.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Preparing Checkout...";
      if(status) status.textContent = "Uploading your file and redirecting to secure checkout...";

      try {
        // 1. E-Mail-Adresse für den Ordnernamen bereinigen
        const cleanEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");

        // 2. Eindeutigen Dateinamen generieren
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const fileName = `${Date.now()}_${cleanFileName}`;
        
        // 3. Pfad aufbauen
        const filePath = `${cleanEmail}/${fileName}`;

        // 4. Datei in den Supabase Storage hochladen
        const { error: storageError } = await db.storage
          .from("client-submissions")
          .upload(filePath, file);

        if (storageError) throw storageError;

        // 5. Projektdetails & Service-Typ formatieren
        const formattedWishes = `[Service: ${serviceType === 'stem-mastering' ? 'Stem Mastering (ZIP - 300 CHF)' : 'Mastering (WAV - 150 CHF)'}]\n${wishesInput}`;

        // 6. Request in der Datenbank speichern (ohne .select().single(), um RLS-SELECT-Fehler zu umgehen)
        const { data: insertData, error: dbError } = await db
          .from("client_requests")
          .insert([
            {
              artist_name: name,
              email: email,
              wishes: formattedWishes,
              file_path: filePath,
              status: "pending_payment"
            }
          ])
          .select("id")
          .single();

        // Falls Supabase hier wegen RLS meckert, fangen wir es ab oder nutzen die ID
        let requestId = insertData ? insertData.id : null;

        if (dbError) {
          console.warn("DB Insert Warning (ignoring if row was created):", dbError.message);
        }

        // 7. Supabase Edge Function aufrufen, um den Stripe Checkout zu starten
        const { data: checkoutData, error: checkoutError } = await db.functions.invoke("create-checkout", {
          body: { 
            service_type: serviceType, 
            request_id: requestId,
            email: email 
          }
        });

        if (checkoutError || !checkoutData?.url) {
          throw new Error(checkoutError?.message || "Could not create checkout session.");
        }

        // 8. Zu Stripe weiterleiten
        location.href = checkoutData.url;

      } catch (err) {
        console.error(err);
        if(status) status.textContent = "Error: " + (err.message || "Upload failed.");
        btn.disabled = false;
        btn.textContent = "Upload & Send";
      }
    };
  }

  // Nach erfolgreichem Checkout zurück zur Seite (Erfolgsmeldung anzeigen)
  const params = new URLSearchParams(location.search);
  if (params.get("success") === "1" && uploadForm) {
    uploadForm.style.display = "none";
    const status = $("upload-status");
    if (status) {
      status.textContent = "Payment successful! We have received your files and will get to work soon. Thank you!";
    }
  }

  // Admin Toggle Logik für das Panel am Seitenende
  const adminToggle = $("admin-toggle");
  if (adminToggle) {
    adminToggle.onclick = () => {
      const panel = $("admin-panel");
      if (panel) panel.classList.toggle("hidden");
    };
  }
})();

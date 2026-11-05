document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);

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
  const serviceRadios = [...document.querySelectorAll('input[name="service"]')];
  const selectedService = () => serviceRadios.find(r => r.checked) || serviceRadios[0];

  // Services that require a single WAV file (all others require a ZIP archive)
  const wavServices = serviceRadios.filter(r => r.dataset.kind === "wav").map(r => r.value);

  // Label, erlaubter Dateityp und Hinweis passend zum gewählten Service
  function applyService(resetFile) {
    const r = selectedService();
    if (!r || !fileInput || !fileLabel) return;
    const isWav = r.dataset.kind === "wav";
    fileLabel.textContent = isWav
      ? `WAV File (.wav only) – ${r.dataset.name} (CHF ${r.dataset.price})`
      : `ZIP Archive (.zip only) – ${r.dataset.name} (CHF ${r.dataset.price})`;
    fileInput.accept = isWav ? ".wav,audio/wav" : ".zip,application/zip,application/x-zip-compressed";
    if (fileHint) fileHint.textContent = isWav ? "Upload one WAV file (no MP3)." : "Put all stems into one ZIP file.";
    // Reset previously selected file when switching between WAV and ZIP services
    if (resetFile) fileInput.value = "";
  }

  // Service aus dem Link vorauswählen, z. B. upload.html?service=mixing
  const preset = new URLSearchParams(location.search).get("service");
  const presetRadio = serviceRadios.find(r => r.value === preset);
  if (presetRadio) presetRadio.checked = true;

  serviceRadios.forEach(r => r.addEventListener("change", () => applyService(true)));
  applyService(false);

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

      if (!file) {
        alert("Please select a file to upload.");
        return;
      }

      // Format validation
      if (wavServices.includes(serviceType) && !file.name.toLowerCase().endsWith(".wav")) {
        alert("Please select a valid WAV file.");
        return;
      }
      if (!wavServices.includes(serviceType) && !file.name.toLowerCase().endsWith(".zip")) {
        alert("Please select a valid ZIP archive.");
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = "Uploading file...";
      }
      if (progressContainer) progressContainer.classList.remove("hidden");
      if (statusEl) statusEl.textContent = "Upload started...";

      try {
        const requestId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        
        // Folder structure: email address as folder name
        const cleanEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `${cleanEmail}/${Date.now()}_${cleanFileName}`;

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "30%";
          progressPercent.textContent = "30%";
        }

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

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "70%";
          progressPercent.textContent = "70%";
        }

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
              file_path: filePath,
              status: "pending"
            }
          ]);

        if (dbError) {
          throw new Error("Database error: " + dbError.message);
        }

        if (progressBarFill && progressPercent) {
          progressBarFill.style.width = "100%";
          progressPercent.textContent = "100%";
        }

        if (statusEl) statusEl.textContent = "Redirecting to Stripe Checkout...";

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
        window.location.href = checkoutData.url;

      } catch (err) {
        console.error("Upload process aborted:", err);
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

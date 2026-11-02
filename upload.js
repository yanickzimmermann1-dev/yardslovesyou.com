(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);

  // Supabase Client initialisieren
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  $("upload-form").onsubmit = async (e) => {
    e.preventDefault();
    const btn = $("submit-btn");
    const status = $("upload-status");

    const name = $("artist-name").value.trim();
    const email = $("artist-email").value.trim();
    const wishes = $("track-wishes").value.trim();
    const fileInput = $("audio-file").files[0];

    if (!fileInput) {
      alert("Please select a WAV file.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Uploading...";
    status.textContent = "Uploading your audio file, please wait...";

    try {
      // 1. E-Mail-Adresse für den Ordnernamen bereinigen (Sicherer Ordnername)
      const cleanEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");

      // 2. Eindeutigen Dateinamen generieren
      const fileName = `${Date.now()}_${fileInput.name}`;
      
      // 3. Pfad aufbauen: e-mail_ordner/dateiname.wav
      const filePath = `${cleanEmail}/${fileName}`;

      // 4. Datei in den Supabase Storage in den E-Mail-Ordner hochladen
      const { error: storageError } = await db.storage
        .from("client-submissions")
        .upload(filePath, fileInput);

      if (storageError) throw storageError;

      // 5. Kontaktdaten & Projektdetails in der Datenbank speichern
      const { error: dbError } = await db
        .from("client_requests")
        .insert([
          {
            artist_name: name,
            email: email,
            wishes: wishes,
            file_path: filePath,
            status: "pending"
          }
        ]);

      if (dbError) throw dbError;

      // Erfolg melden
      status.textContent = "Upload successful! We have received your track and will get back to you soon.";
      $("upload-form").reset();
    } catch (err) {
      console.error(err);
      status.textContent = "Error: " + (err.message || "Upload failed.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Upload & Send";
    }
  };
})();

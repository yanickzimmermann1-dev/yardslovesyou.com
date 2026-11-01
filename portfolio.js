(() => {
  const cfg = window.APP_CONFIG || {};
  const ready = cfg.SUPABASE_URL.startsWith("https://") && !cfg.SUPABASE_URL.includes("DEINE_") && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("DEIN_");
  const $ = id => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  $("admin-toggle").onclick = () => $("admin-panel").classList.toggle("hidden");
  if (!ready) { $("tracks").innerHTML = '<div class="empty">Bitte zuerst deine Supabase-Zugangsdaten in <code>config.js</code> eintragen und das SQL aus <code>supabase/setup.sql</code> ausführen.</div>'; return; }
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  let user = null;
  const status = msg => $("status").textContent = msg;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  
  async function loadTracks() {
    const {data,error} = await db.from("audio_tracks").select("*").order("created_at",{ascending:false});
    if (error) { $("tracks").innerHTML = '<div class="empty">Tracks konnten nicht geladen werden. Prüfe die Supabase-Einrichtung.</div>'; return; }
    
    $("tracks").innerHTML = data.length ? data.map(t => {
      const imageUrl = t.image_path ? db.storage.from("coverart-portolio").getPublicUrl(t.image_path).data.publicUrl : null;

      return `
      <article class="track">
        <div class="track-top">
          <div class="cover">
            ${imageUrl ? `<img src="${esc(imageUrl)}" alt="Cover" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : "♫"}
          </div>
          <div>
            <h3>${esc(t.title)}</h3>
            ${t.description ? `<p>${esc(t.description)}</p>` : ""}
          </div>
        </div>
        <audio controls preload="none" src="${esc(db.storage.from("audio-files").getPublicUrl(t.storage_path).data.publicUrl)}"></audio>
        ${user ? `<button class="delete-track" data-delete="${esc(t.id)}">Track löschen</button>` : ""}
      </article>
    `;
    }).join("") : '<div class="empty">Noch keine Tracks. Melde dich als Admin an, um deine erste Audiodatei hochzuladen.</div>';
    
    document.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => deleteTrack(b.dataset.delete));

    // NEU: Dafür sorgen, dass immer nur ein Player gleichzeitig spielt
    document.querySelectorAll("audio").forEach(audio => {
      audio.onplay = () => {
        document.querySelectorAll("audio").forEach(other => {
          if (other !== audio) {
            other.pause();
          }
        });
      };
    });
  }

  async function refreshUser() {
    const {data} = await db.auth.getSession(); user = data.session?.user || null;
    $("login-form").classList.toggle("hidden", !!user); $("admin-tools").classList.toggle("hidden", !user);
    if(user) { const {data:admin} = await db.from("audio_admins").select("user_id").eq("user_id",user.id).maybeSingle(); if(!admin){await db.auth.signOut();user=null;$("login-form").classList.remove("hidden");$("admin-tools").classList.add("hidden");status("Dieses Konto ist nicht als Admin freigeschaltet.");} }
    await loadTracks();
  }

  $("login-form").onsubmit = async e => { e.preventDefault(); const {error} = await db.auth.signInWithPassword({email:$("email").value,password:$("password").value}); if(error){status(error.message);return;} status("Angemeldet."); await refreshUser(); };
  $("logout").onclick = async () => { await db.auth.signOut(); status("Abgemeldet."); await refreshUser(); };

  async function upload(files) {
    if(!user) return status("Bitte zuerst anmelden.");
    for(const file of files) {
      const isAudio = file.type.startsWith("audio/");
      const isImage = file.type.startsWith("image/");

      if(!isAudio && !isImage) { 
        status(`${file.name}: Weder Audio- noch Bilddatei.`); 
        continue; 
      }

      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      status(`Lade ${file.name} hoch …`);
      
      if(isAudio) {
        const {error:upErr} = await db.storage.from("audio-files").upload(path, file, {contentType:file.type, upsert:false});
        if(upErr) { status(upErr.message); continue; }

        const {error:dbErr} = await db.from("audio_tracks").insert({
          title: file.name.replace(/\.[^.]+$/, ""),
          description: "",
          storage_path: path
        });
        if(dbErr) { await db.storage.from("audio-files").remove([path]); status(dbErr.message); continue; }
        status(`${file.name} hochgeladen.`);
      } else if(isImage) {
        const {error:upErr} = await db.storage.from("coverart-portolio").upload(path, file, {contentType:file.type, upsert:false});
        if(upErr) { status(upErr.message); continue; }

        const {data: latestTrack} = await db.from("audio_tracks").select("id").order("created_at", {ascending: false}).limit(1).single();
        if(latestTrack) {
          const {error:dbErr} = await db.from("audio_tracks").update({ image_path: path }).eq("id", latestTrack.id);
          if(dbErr) { await db.storage.from("coverart-portolio").remove([path]); status(dbErr.message); continue; }
          status(`Cover-Bild für den neuesten Track aktualisiert.`);
        } else {
          await db.storage.from("coverart-portolio").remove([path]);
          status(`Bild hochgeladen, aber es existiert noch kein Track dafür.`);
        }
      }
    }
    await loadTracks();
  }

  async function deleteTrack(id) {
    if(!confirm("Diesen Track wirklich löschen?")) return;
    const {data:track} = await db.from("audio_tracks").select("*").eq("id",id).single();
    if(!track) return status("Track nicht gefunden.");
    
    const {error:removeAudioErr} = await db.storage.from("audio-files").remove([track.storage_path]);
    if(removeAudioErr) return status(removeAudioErr.message);

    if(track.image_path) {
      const {error:removeImgErr} = await db.storage.from("coverart-portolio").remove([track.image_path]);
      if(removeImgErr) return status(removeImgErr.message);
    }
    
    const {error} = await db.from("audio_tracks").delete().eq("id",id);
    status(error ? error.message : "Track gelöscht."); await loadTracks();
  }

  const dz=$("dropzone");
  dz.addEventListener("dragover",e=>{e.preventDefault();dz.style.borderColor="#e5a5ff";});
  dz.addEventListener("dragleave",()=>dz.style.borderColor="");
  dz.addEventListener("drop",e=>{e.preventDefault();dz.style.borderColor="";upload([...e.dataTransfer.files]);});
  $("audio-files").onchange=e=>upload([...e.target.files]);
  refreshUser();
})();

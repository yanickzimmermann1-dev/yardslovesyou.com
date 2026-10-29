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
    $("tracks").innerHTML = data.length ? data.map(t => `<article class="track"><div class="track-top"><div class="cover">♫</div><div><h3>${esc(t.title)}</h3><p>${esc(t.description || "Music portfolio")}</p></div></div><audio controls preload="none" src="${esc(db.storage.from("audio-files").getPublicUrl(t.storage_path).data.publicUrl)}"></audio>${user ? `<button class="delete-track" data-delete="${esc(t.id)}">Track löschen</button>` : ""}</article>`).join("") : '<div class="empty">Noch keine Tracks. Melde dich als Admin an, um deine erste Audiodatei hochzuladen.</div>';
    document.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => deleteTrack(b.dataset.delete));
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
      if(!file.type.startsWith("audio/")) { status(`${file.name}: keine Audiodatei.`); continue; }
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      status(`Lade ${file.name} hoch …`);
      const {error:upErr} = await db.storage.from("audio-files").upload(path,file,{contentType:file.type,upsert:false});
      if(upErr){status(upErr.message);continue;}
      const {error:dbErr} = await db.from("audio_tracks").insert({title:file.name.replace(/\.[^.]+$/,""),description:"",storage_path:path});
      if(dbErr){await db.storage.from("audio-files").remove([path]);status(dbErr.message);continue;}
      status(`${file.name} hochgeladen.`);
    }
    await loadTracks();
  }
  async function deleteTrack(id) {
    if(!confirm("Diesen Track wirklich löschen?")) return;
    const {data:track} = await db.from("audio_tracks").select("*").eq("id",id).single();
    if(!track) return status("Track nicht gefunden.");
    const {error:removeErr} = await db.storage.from("audio-files").remove([track.storage_path]);
    if(removeErr) return status(removeErr.message);
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
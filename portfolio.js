(() => {
  const cfg = window.APP_CONFIG || {};
  const ready = cfg.SUPABASE_URL.startsWith("https://") && !cfg.SUPABASE_URL.includes("DEINE_") && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("DEIN_");
  const $ = id => document.getElementById(id);
  
  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  
  const adminToggle = $("admin-toggle");
  if (adminToggle) adminToggle.onclick = () => $("admin-panel").classList.toggle("hidden");

  if (!ready) { 
    const tracksEl = $("tracks");
    if (tracksEl) tracksEl.innerHTML = '<div class="empty">Bitte zuerst deine Supabase-Zugangsdaten in <code>config.js</code> eintragen und das SQL aus <code>supabase/setup.sql</code> ausführen.</div>'; 
    return; 
  }
  
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  let user = null;
  const status = msg => { const el = $("status"); if(el) el.textContent = msg; };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  
  async function loadTracks() {
    const tracksContainer = $("tracks");
    if (!tracksContainer) return;

    const {data,error} = await db.from("audio_tracks").select("*").order("created_at",{ascending:false});
    if (error) { tracksContainer.innerHTML = '<div class="empty">Tracks konnten nicht geladen werden. Prüfe die Supabase-Einrichtung.</div>'; return; }
    
    tracksContainer.innerHTML = data.length ? data.map(t => {
      const imageUrl = t.image_path ? db.storage.from("coverart-portolio").getPublicUrl(t.image_path).data.publicUrl : null;
      const audioUrl = db.storage.from("audio-files").getPublicUrl(t.storage_path).data.publicUrl;

      return `
      <article class="track" data-id="${t.id}">
        <div class="track-top">
          <div class="cover">
            ${imageUrl ? `<img src="${esc(imageUrl)}" alt="Cover" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : "♫"}
          </div>
          <div>
            <h3>${esc(t.title)}</h3>
            ${t.description ? `<p>${esc(t.description)}</p>` : ""}
          </div>
        </div>

        <div class="custom-player">
          <audio preload="none" src="${esc(audioUrl)}"></audio>
          <button class="play-btn" aria-label="Play/Pause">
            <svg class="play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="5,3 19,12 5,21"></polygon></svg>
            <svg class="pause-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          
          <div class="waveform-container" title="Fortschritt">
            <div class="waveform-bars">
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="progress-bar"></div>
          </div>
        </div>

        ${user ? `<button class="delete-track" data-delete="${esc(t.id)}" style="margin-top:10px; background:rgba(255,0,0,0.2); border:none; color:#ff8b8b; padding:6px 12px; border-radius:4px; cursor:pointer;">Track löschen</button>` : ""}
      </article>
    `;
    }).join("") : '<div class="empty">Noch keine Tracks. Melde dich unten rechts als Admin an, um deine erste Audiodatei hochzuladen.</div>';
    
    document.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => deleteTrack(b.dataset.delete));

    document.querySelectorAll(".track").forEach(article => {
      const audio = article.querySelector("audio");
      const playBtn = article.querySelector(".play-btn");
      const playIcon = article.querySelector(".play-icon");
      const pauseIcon = article.querySelector(".pause-icon");
      const progressBar = article.querySelector(".progress-bar");
      const waveformContainer = article.querySelector(".waveform-container");

      if (!audio || !playBtn) return;

      function setButtonState(isPlaying) {
        if (isPlaying) {
          playIcon.style.display = "none";
          pauseIcon.style.display = "block";
        } else {
          playIcon.style.display = "block";
          pauseIcon.style.display = "none";
        }
      }

      playBtn.onclick = () => {
        document.querySelectorAll("audio").forEach(other => {
          if (other !== audio) {
            other.pause();
            const parentArticle = other.closest(".track");
            if(parentArticle) {
              const pIcon = parentArticle.querySelector(".play-icon");
              const psIcon = parentArticle.querySelector(".pause-icon");
              if (pIcon) pIcon.style.display = "block";
              if (psIcon) psIcon.style.display = "none";
            }
          }
        });

        if (audio.paused) {
          audio.play();
          setButtonState(true);
        } else {
          audio.pause();
          setButtonState(false);
        }
      };

      audio.ontimeupdate = () => {
        if (audio.duration && progressBar) {
          const percent = (audio.currentTime / audio.duration) * 100;
          progressBar.style.width = percent + "%";
        }
      };

      audio.onended = () => {
        setButtonState(false);
        if (progressBar) progressBar.style.width = "0%";
      };

      if (waveformContainer) {
        waveformContainer.onclick = (e) => {
          const rect = waveformContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const width = rect.width;
          if (audio.duration) {
            audio.currentTime = (clickX / width) * audio.duration;
          }
        };
      }
    });
  }

  async function refreshUser() {
    const {data} = await db.auth.getSession(); user = data.session?.user || null;
    const loginForm = $("login-form");
    const adminTools = $("admin-tools");
    if(loginForm) loginForm.classList.toggle("hidden", !!user); 
    if(adminTools) adminTools.classList.toggle("hidden", !user);
    
    if(user) { 
      const {data:admin} = await db.from("audio_admins").select("user_id").eq("user_id",user.id).maybeSingle(); 
      if(!admin){
        await db.auth.signOut();
        user=null;
        if(loginForm) loginForm.classList.remove("hidden");
        if(adminTools) adminTools.classList.add("hidden");
        status("Dieses Konto ist nicht als Admin freigeschaltet.");
      } 
    }
    await loadTracks();
  }

  const loginFormEl = $("login-form");
  if(loginFormEl) {
    loginFormEl.onsubmit = async e => { 
      e.preventDefault(); 
      const {error} = await db.auth.signInWithPassword({email:$("email").value,password:$("password").value}); 
      if(error){status(error.message);return;} 
      status("Angemeldet."); 
      await refreshUser(); 
    };
  }

  const logoutBtn = $("logout");
  if(logoutBtn) {
    logoutBtn.onclick = async () => { await db.auth.signOut(); status("Abgemeldet."); await refreshUser(); };
  }

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

  const dz = $("dropzone");
  if(dz) {
    dz.addEventListener("dragover",e=>{e.preventDefault();dz.style.borderColor="#e5a5ff";});
    dz.addEventListener("dragleave",()=>dz.style.borderColor="");
    dz.addEventListener("drop",e=>{e.preventDefault();dz.style.borderColor="";upload([...e.dataTransfer.files]);});
  }
  
  const audioFilesInput = $("audio-files");
  if(audioFilesInput) {
    audioFilesInput.onchange = e => upload([...e.target.files]);
  }

  refreshUser();
})();

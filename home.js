(() => {
  const cfg = window.APP_CONFIG || {};
  const ready = cfg.SUPABASE_URL?.startsWith("https://") && !cfg.SUPABASE_URL.includes("DEINE_") && cfg.SUPABASE_PUBLISHABLE_KEY && !cfg.SUPABASE_PUBLISHABLE_KEY.includes("DEIN_");
  const $ = id => document.getElementById(id);
  
  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  
  const adminToggle = $("admin-toggle");
  if (adminToggle) adminToggle.onclick = () => $("admin-panel").classList.toggle("hidden");

  if (!ready) { 
    const tracksEl = $("tracks");
    const w0 = $("work"); if (w0) { w0.hidden = true; w0.style.display = "none"; }
    return; 
  }
  
  const db = (window.YLY && window.YLY.db) || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);   // one shared client (community-core.js) avoids a second GoTrue instance
  let user = null;
  const status = msg => { const el = $("status"); if(el) el.textContent = msg; };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  
  async function loadTracks() {
    const tracksContainer = $("tracks");
    if (!tracksContainer) return;

    if (!tracksContainer.querySelector(".track")) tracksContainer.innerHTML = '<article class="track sk-card sk-track" aria-hidden="true"><div class="sk-row"><div class="sk sk-cover"></div><div class="sk-col"><div class="sk sk-title"></div><div class="sk sk-line"></div></div></div><div class="sk sk-player"></div></article>'.repeat(3);
    const {data,error} = await db.from("audio_tracks").select("*").order("created_at",{ascending:false});
    const workSec = $("work");
    if (error) {
      if (workSec) { workSec.hidden = false; workSec.style.display = ""; }
      if (window.YLYState) window.YLYState.render(tracksContainer, { icon: "wave", error: true, title: "Tracks could not be loaded", text: "Something went wrong or your connection dropped. Please try again.", actions: [{ label: "Retry", onClick: () => loadTracks() }] });
      else tracksContainer.textContent = "Tracks could not be loaded. Please try again.";
      return;
    }
    // no tracks: hide the whole section (no empty box)
    if (workSec) { const none = !data || !data.length; workSec.hidden = none; workSec.style.display = none ? "none" : ""; }
    if (!data || !data.length) { tracksContainer.innerHTML = ""; return; }
    
    tracksContainer.innerHTML = data.length ? data.map(t => {
      const imageUrl0 = t.image_path ? db.storage.from("coverart-portolio").getPublicUrl(t.image_path).data.publicUrl : null;
      const ylyM = u => (window.YLYMedia && u ? window.YLYMedia.url(u) : u);
      const imageUrl = ylyM(imageUrl0);
      const audioUrl = ylyM(db.storage.from("audio-files").getPublicUrl(t.storage_path).data.publicUrl);
      const barsHtml = Array.from({length: 30}, () => '<span class="wave-bar"></span>').join('');

      return `
      <article class="track" data-hs data-id="${esc(t.id)}">
        <div class="track-top">
          <div class="cover">
            ${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(t.title)} cover" width="400" height="400" class="bu" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : ""}
          </div>
          <div>
            <h3>${esc(t.title)}</h3>
            ${t.description ? `<p>${esc(t.description)}</p>` : ""}
          </div>
        </div>

        <div class="custom-player">
          <audio preload="none" src="${esc(audioUrl)}"></audio>
          <button class="play-btn" type="button" aria-label="Play ${esc(t.title)}">
            <svg class="play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><polygon points="5,3 19,12 5,21"></polygon></svg>
            <svg class="pause-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="display:none;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
          </button>
          
          <div class="waveform-container" title="Seek">
            <div class="waveform-bars">
              ${barsHtml}
            </div>
          </div>
        </div>

        ${user ? `<button class="delete-track" data-delete="${esc(t.id)}">Delete track</button>` : ""}
      </article>
    `;
    }).join("") : '<div class="empty">No tracks yet.</div>';
    
    document.querySelectorAll("[data-delete]").forEach(b => b.onclick = () => deleteTrack(b.dataset.delete));

    document.querySelectorAll(".track").forEach(article => {
      const audio = article.querySelector("audio");
      const playBtn = article.querySelector(".play-btn");
      const playIcon = article.querySelector(".play-icon");
      const pauseIcon = article.querySelector(".pause-icon");
      const waveformContainer = article.querySelector(".waveform-container");
      const bars = article.querySelectorAll(".wave-bar");

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
        if (audio.duration && bars.length) {
          const progress = audio.currentTime / audio.duration;
          const activeIndex = Math.floor(progress * bars.length);
          bars.forEach((bar, idx) => {
            if (idx <= activeIndex) bar.classList.add("active");
            else bar.classList.remove("active");
          });
        }
      };

      audio.onended = () => {
        setButtonState(false);
        bars.forEach(bar => bar.classList.remove("active"));
      };

      if (waveformContainer) {
        waveformContainer.onclick = (e) => {
          const rect = waveformContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (audio.duration) audio.currentTime = (clickX / rect.width) * audio.duration;
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
        // Eingeloggte Community-Mitglieder NICHT abmelden – sie sind nur keine Admins
        user=null;
        if(loginForm) loginForm.classList.remove("hidden");
        if(adminTools) adminTools.classList.add("hidden");
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
      status("Signed in."); 
      await refreshUser(); 
    };
  }

  const logoutBtn = $("logout");
  if(logoutBtn) {
    logoutBtn.onclick = async () => { await db.auth.signOut(); status("Signed out."); await refreshUser(); };
  }

  async function upload(files) {
    if(!user) return status("Please sign in first.");
    for(const file of files) {
      const isAudio = file.type.startsWith("audio/");
      const isImage = file.type.startsWith("image/");
      if(!isAudio && !isImage) continue;

      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      if(isAudio) {
        const {error:upErr} = await db.storage.from("audio-files").upload(path, file);
        if(upErr) { status(upErr.message); continue; }
        await db.from("audio_tracks").insert({ title: file.name.replace(/\.[^.]+$/, ""), storage_path: path });
      } else if(isImage) {
        const {error:upErr} = await db.storage.from("coverart-portolio").upload(path, file);
        if(upErr) { status(upErr.message); continue; }
        const {data: latestTrack} = await db.from("audio_tracks").select("id").order("created_at", {ascending: false}).limit(1).single();
        if(latestTrack) await db.from("audio_tracks").update({ image_path: path }).eq("id", latestTrack.id);
      }
    }
    await loadTracks();
  }

  const dz = $("dropzone");
  if(dz) {
    dz.addEventListener("dragover",e=>{e.preventDefault();});
    dz.addEventListener("drop",e=>{e.preventDefault();upload([...e.dataTransfer.files]);});
  }
  const audioFilesInput = $("audio-files");
  if(audioFilesInput) audioFilesInput.onchange = e => upload([...e.target.files]);

  refreshUser();
})();

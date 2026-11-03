(() => {
  const cfg=window.APP_CONFIG||{}, $=id=>document.getElementById(id);
  $("year").textContent=new Date().getFullYear();
  const root=$("product-root");
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fail=msg=>{root.innerHTML=`<a class="back-link" href="shop.html#downloads">← Back to shop</a><div class="empty" style="margin-top:24px">${esc(msg)}</div>`;};

  if(!window.supabase) return fail("Supabase SDK is not loaded.");
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);

  // Dateiname im Bucket "coverart-products" -> öffentliche URL (volle URLs bleiben unverändert)
  const media=u=>/^https?:\/\//.test(u)?u:db.storage.from("coverart-products").getPublicUrl(u).data.publicUrl;
  const money=(cents,cur)=>(cents/100).toLocaleString("de-CH",{style:"currency",currency:String(cur||cfg.CURRENCY||"CHF").toUpperCase()});
  const paragraphs=t=>String(t||"").trim().split(/\n\s*\n/).map(p=>`<p>${esc(p).replace(/\n/g,"<br>")}</p>`).join("");

  // YouTube / Vimeo / MP4 -> eingebettetes Video
  const embed=u=>{
    let m;
    if((m=String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)))
      return `<iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    if((m=String(u).match(/vimeo\.com\/(?:video\/)?(\d+)/)))
      return `<iframe src="https://player.vimeo.com/video/${m[1]}" title="Video" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    if(/\.(mp4|webm|mov)(\?|$)/i.test(u))
      return `<video src="${esc(media(u))}" controls playsinline preload="metadata"></video>`;
    return "";
  };

  const id=new URLSearchParams(location.search).get("id");
  if(!id) return fail("Product not found.");

  async function load(){
    const {data:p,error}=await db.from("shop_products")
      .select("id,title,description,price_cents,currency,cover_emoji,image_url,long_description,features,gallery,video_urls,preview_audio")
      .eq("id",id).eq("published",true).maybeSingle();
    if(error) return fail("Product could not be loaded.");
    if(!p) return fail("Product not found.");

    document.title=`${p.title} · YARDSLOVESYOU`;
    const images=[p.image_url,...(p.gallery||[])].filter(Boolean).map(media);
    const features=(p.features||[]).filter(Boolean);
    const videos=(p.video_urls||[]).map(embed).filter(Boolean);
    const bars=Array.from({length:64},()=>'<span class="wave-bar"></span>').join("");

    root.innerHTML=`
      <a class="back-link" href="shop.html#downloads">← Back to shop</a>

      <section class="product-detail">
        <div class="pd-media">
          <div class="pd-main">${images.length?`<img id="pd-main-img" src="${esc(images[0])}" alt="${esc(p.title)}">`:esc(p.cover_emoji||"")}</div>
          ${images.length>1?`<div class="pd-thumbs">${images.map((u,i)=>`<button type="button" class="${i?"":"active"}" data-img="${esc(u)}" aria-label="Image ${i+1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join("")}</div>`:""}
        </div>

        <div class="pd-info">
          <p class="eyebrow">Digital product</p>
          <h1>${esc(p.title)}</h1>
          <p class="muted">${esc(p.description||"Digital download as ZIP file.")}</p>
          <div class="pd-buy">
            <span class="price">${money(p.price_cents,p.currency)}</span>
            <button class="button" id="buy-btn" type="button">Buy</button>
          </div>
          <p class="fineprint">Instant ZIP download after payment.</p>
          ${p.preview_audio?`
          <div class="pd-preview">
            <p class="eyebrow">Preview</p>
            <div class="custom-player">
              <button class="play-btn" id="pd-play" type="button" aria-label="Play preview"></button>
              <div class="waveform-container" id="pd-wave"><div class="waveform-bars">${bars}</div></div>
            </div>
          </div>`:""}
        </div>
      </section>

      ${p.long_description?`<section class="pd-section"><h2>About</h2><div class="pd-text">${paragraphs(p.long_description)}</div></section>`:""}
      ${features.length?`<section class="pd-section"><h2>What's included</h2><ul class="pd-features">${features.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></section>`:""}
      ${videos.length?`<section class="pd-section"><h2>Showcase</h2><div class="pd-videos">${videos.map(v=>`<div class="pd-video">${v}</div>`).join("")}</div></section>`:""}`;

    // Galerie: Klick auf Vorschaubild wechselt das Hauptbild
    root.querySelectorAll("[data-img]").forEach(b=>b.onclick=()=>{
      $("pd-main-img").src=b.dataset.img;
      root.querySelectorAll("[data-img]").forEach(x=>x.classList.toggle("active",x===b));
    });

    $("buy-btn").onclick=buy;
    if(p.preview_audio) setupPlayer(media(p.preview_audio));
  }

  function setupPlayer(src){
    const audio=new Audio(src); audio.preload="metadata";
    const btn=$("pd-play"), wave=$("pd-wave"), bars=[...wave.querySelectorAll(".wave-bar")];
    const PLAY='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const PAUSE='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    btn.innerHTML=PLAY;
    btn.onclick=()=>audio.paused?audio.play():audio.pause();
    audio.onplay=()=>{btn.innerHTML=PAUSE;};
    audio.onpause=audio.onended=()=>{btn.innerHTML=PLAY;};
    audio.ontimeupdate=()=>{
      const n=Math.round((audio.duration?audio.currentTime/audio.duration:0)*bars.length);
      bars.forEach((b,i)=>b.classList.toggle("active",i<n));
    };
    wave.onclick=e=>{
      if(!audio.duration) return;
      const r=wave.getBoundingClientRect();
      audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration;
    };
  }

  async function buy(){
    const b=$("buy-btn"); b.disabled=true; b.textContent="Redirecting …";
    try{
      const {data,error}=await db.functions.invoke("create-checkout",{body:{product_id:id}});
      if(error) throw error;
      if(!data?.url) throw new Error(data?.error||"Checkout link missing.");
      location.href=data.url;
    }catch(e){alert("Checkout failed: "+(e.message||e));b.disabled=false;b.textContent="Buy";}
  }

  load();
})();

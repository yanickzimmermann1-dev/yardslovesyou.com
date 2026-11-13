(() => {
  const cfg=window.APP_CONFIG||{}, $=id=>document.getElementById(id);
  $("year").textContent=new Date().getFullYear();
const TRUST_SVG='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z"/><path d="m9 12 2.2 2.2L15 10.4"/></svg>';
(function(){if(!document.querySelector('link[href^="trust.css"]')){var l=document.createElement('link');l.rel='stylesheet';l.href='trust.css?v=20261113q';document.head.appendChild(l);}})();
function trustLine(p,compact){const t=['Instant download',p&&p.royalty_free?'Royalty-free for your music':'','Secure checkout'].filter(Boolean).join(' · ');return `<p class="trust left${compact?' compact':''}">${TRUST_SVG}<span>${t}</span></p>`;}
  const root=$("product-root");
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fail=msg=>{root.innerHTML=`<a class="back-link" href="shop.html#downloads"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="m15 6-6 6 6 6"/></svg> Back to shop</a><div class="empty" style="margin-top:24px">${esc(msg)}</div>`;};

  if(!window.supabase) return fail("Supabase SDK is not loaded.");
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);

  // Dateiname im Bucket "coverart-products" -> öffentliche URL (volle URLs bleiben unverändert)
  const media=u=>{ const r=/^https:\/\//i.test(u)?u:db.storage.from("coverart-products").getPublicUrl(u).data.publicUrl; return window.YLYMedia?YLYMedia.url(r):r; };
  const money=(cents,cur)=>(cents/100).toLocaleString("de-CH",{style:"currency",currency:String(cur||cfg.CURRENCY||"CHF").toUpperCase()});
  const paragraphs=t=>String(t||"").trim().split(/\n\s*\n/).map(p=>`<p>${esc(p).replace(/\n/g,"<br>")}</p>`).join("");

  const PLAY='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const PAUSE='<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

  // Externe Videos (YouTube/Vimeo) werden erst nach Klick geladen (Datenschutz: vorher keine Verbindung zum Anbieter)
  const ph=(src,name,allow)=>`<button type="button" class="pd-video-ph" data-embed="${esc(src)}" data-allow="${esc(allow)}">Play video<small>Loads from ${name}. By playing it you connect to ${name}.</small></button>`;
  // YouTube / Vimeo / MP4 -> Video
  const embed=u=>{
    let m;
    if((m=String(u).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)))
      return ph("https://www.youtube-nocookie.com/embed/"+m[1]+"?autoplay=1","YouTube","accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen");
    if((m=String(u).match(/vimeo\.com\/(?:video\/)?(\d+)/)))
      return ph("https://player.vimeo.com/video/"+m[1]+"?autoplay=1","Vimeo","autoplay; fullscreen; picture-in-picture");
    if(/\.(mp4|webm|mov)(\?|$)/i.test(u))
      return `<video src="${esc(media(u))}" controls playsinline preload="metadata"></video>`;
    return "";
  };

  // Hörproben: preview_tracks (Liste) oder – falls leer – die einzelne preview_audio
  const getTracks=p=>{
    let list=p.preview_tracks;
    if(typeof list==="string"){ try{ list=JSON.parse(list); }catch(_){ list=null; } }
    list=Array.isArray(list)?list.map((t,i)=>typeof t==="string"?{title:`Preview ${i+1}`,file:t}:t).filter(t=>t&&t.file):[];
    if(!list.length&&p.preview_audio) list=[{title:"Preview",file:p.preview_audio}];
    return list;
  };

  // Warenkorb: Daten-Attribute fuer cart.js (Klick, Status-Sync und Fly-Animation laufen dort)
  const CART_IC='<svg class="ic-add" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.3l2.1 11h10.4l2.1-8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/><path d="M12.5 8.5v4M10.5 10.5h4"/></svg><svg class="ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
  const cartAttrs=(p,images)=>`data-cart-add="${esc(p.id)}" data-cart-title="${esc(p.title)}" data-cart-price="${esc(p.price_cents)}" data-cart-currency="${esc(String(p.currency||cfg.CURRENCY||"chf").toLowerCase())}" data-cart-cover="${esc(images[0]||"")}"`;
  const cartBtn=(cls,idAttr,p,images,extra)=>`<button class="${cls}" ${idAttr?`id="${idAttr}" `:""}type="button" ${cartAttrs(p,images)}${extra||""}>${CART_IC}<span class="cart-lbl">Add to cart</span></button>`;

  // Info-Zeile: "120 sounds · 24-bit WAV · 350 MB" -> einzelne Chips
  const specChips=s=>String(s||"").split(/[·|•]/).map(x=>x.trim()).filter(Boolean);

  const faqFor=p=>{
    const items=[];
    items.push(["How do I get my download?",
      "Right after payment you are taken to your download page. You also receive an email with your download link, so you can download it again later."]);
    if(p.royalty_free){
      items.push(["Can I use the sounds in my released music?",
        `Yes. All sounds are 100% royalty-free: use them in your songs, beats you sell or lease, releases, videos and placements. No credit and no further payments needed. You just may not resell or share the sounds on their own. <a href="license.html">Read the full license</a>.`]);
      items.push(["Which DAWs are supported?",
        "All of them. The sounds are standard audio files that work in FL Studio, Ableton Live, Logic Pro, Pro Tools, Cubase, Studio One, GarageBand and every other DAW."]);
    }else{
      items.push(["How may I use this product?",
        `This product is licensed for your personal use. <a href="license.html">Read the full license</a>.`]);
    }
    items.push(["Which payment methods can I use?",
      "Credit and debit cards, TWINT, PayPal, and Apple Pay or Google Pay where available. Payments are processed securely by Stripe."]);
    items.push(["I have a question that isn't answered here.",
      `Just write to <a href="mailto:yardsyurr@gmail.com">yardsyurr@gmail.com</a> – I'm happy to help.`]);
    return items;
  };

  const id=new URLSearchParams(location.search).get("id")||document.body.dataset.productId;
  if(!id) return fail("Product not found.");

  // 3D-Modell (Spalte model3d, jsonb): nur gültig mit Typ + Front-Textur
  const parseModel=m=>{
    if(typeof m==="string"){ try{ m=JSON.parse(m); }catch(_){ m=null; } }
    return m&&typeof m==="object"&&m.front&&(m.type==="book"||m.type==="card")?m:null;
  };
  const CUBE='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></svg>';

  if(!root.querySelector("[data-static]")) root.innerHTML='<section class="product-detail sk-pd" aria-hidden="true"><div class="pd-media"><div class="pd-main sk"></div></div><div class="pd-info"><div class="sk sk-line w40"></div><div class="sk sk-h1"></div><div class="sk sk-line"></div><div class="sk sk-line w80"></div><div class="sk sk-line w60"></div><div class="sk sk-btn" style="margin-top:18px"></div></div></section>';
  async function load(){
    // select("*"): neue Spalten (badge, specs, preview_tracks …) werden automatisch mitgeladen
    const {data:p,error}=await db.from("shop_products").select("*").eq("id",id).eq("published",true).maybeSingle();
    if(error) return fail("Product could not be loaded.");
    if(!p) return fail("Product not found.");

    p.model3d=parseModel(p.model3d);
    document.title=`${p.title} · YARDSLOVESYOU`;
    const images=[p.image_url,...(p.gallery||[])].filter(Boolean).map(media);
    setSeo(p,images);
    window.ylyTrack&&ylyTrack("product-view",{id:p.id});
    // Guides: Spalte "guide" (jsonb) -> eigene Seite ohne Video (guide.js)
    let guide=p.guide;
    if(typeof guide==="string"){ try{ guide=JSON.parse(guide); }catch(_){ guide=null; } }
    if(document.readyState==="loading") await new Promise(r=>document.addEventListener("DOMContentLoaded",r));
    if(guide&&Array.isArray(guide.chapters)&&guide.chapters.length&&typeof window.renderGuide==="function"){
      p.guide=guide;
      return showGuide(p,images);
    }
    const features=(p.features||[]).filter(Boolean);
    const videos=(p.video_urls||[]).map(embed).filter(Boolean);
    const tracks=getTracks(p);
    const chips=specChips(p.specs);
    const price=money(p.price_cents,p.currency);
    const was=Number(p.compare_at_cents)>p.price_cents?`<s class="was-price">${money(p.compare_at_cents,p.currency)}</s>`:"";
    const bars=n=>Array.from({length:n},()=>'<span class="wave-bar"></span>').join("");

    // Kategorie für die Brotkrumen (optional; fehlt die Tabelle, nur "Shop / Produkt")
    let cat=null;
    if(p.category){
      try{
        const {data:c,error:ce}=await db.from("shop_categories").select("slug,name").eq("slug",p.category).maybeSingle();
        if(!ce&&c) cat=c;
      }catch(_){}
    }
    const SEP='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
    const crumbs=`<nav class="crumbs" aria-label="Breadcrumb"><a href="shop.html">Shop</a>${cat?`${SEP}<a href="shop.html?cat=${encodeURIComponent(cat.slug)}">${esc(cat.name)}</a>`:""}${SEP}<span aria-current="page">${esc(p.title)}</span></nav>`;

    root.innerHTML=`
      ${crumbs}
      <a class="back-link" href="shop.html#downloads"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="m15 6-6 6 6 6"/></svg> Back to shop</a>

      <section class="product-detail">
        <div class="pd-media">
          <div class="pd-main${p.model3d?" pd-3d":""}" id="pd-main">${images.length?`<img id="pd-main-img" class="bu" src="${esc(images[0])}" alt="${esc(p.title)}" width="800" height="800" fetchpriority="high" decoding="async">`:esc(p.cover_emoji||"")}</div>
          ${images.length>1||p.model3d?`<div class="pd-thumbs">${p.model3d?`<button type="button" class="pd-thumb-3d" id="pd-thumb-3d" hidden aria-label="3D view" title="3D view">${CUBE}</button>`:""}${images.length>1?images.map((u,i)=>`<button type="button" class="${i||p.model3d?"":"active"}" data-img="${esc(u)}" aria-label="Image ${i+1}"><img class="bu" src="${esc(u)}" alt="" width="80" height="80" loading="lazy" decoding="async"></button>`).join(""):""}</div>`:""}
          ${p.sound_preview?`<div id="pd-sounds"></div>`:""}
        </div>

        <div class="pd-info">
          <p class="eyebrow">Digital product ${p.badge?`<span class="badge badge-inline">${esc(p.badge)}</span>`:""}</p>
          <h1>${esc(p.title)}</h1>
          <p class="muted">${esc(p.description||"Digital download as ZIP file.")}</p>
          ${chips.length?`<ul class="pd-specs">${chips.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>`:""}
          <div class="pd-buy">
            <span class="price-wrap">${was}<span class="price">${price}</span></span>
            ${cartBtn("button","add-cart-btn",p,images)}
            <button class="outline" id="buy-btn" type="button">Buy now</button>
          </div>
          <p class="fineprint">Instant ZIP download after payment.</p>
          ${trustLine(p)}
          ${p.royalty_free?`<p class="license-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="m5 12.5 4.5 4.5L19 7"/></svg> 100% royalty-free – use in your beats, releases &amp; placements. <a href="license.html">License</a></p>`:""}

          ${tracks.length?`
          <div class="pd-preview">
            <p class="eyebrow">${tracks.length>1?"Previews":"Preview"}</p>
            <ul class="pd-tracks">
              ${tracks.map((t,i)=>`
              <li class="pd-track" data-track="${i}">
                <button class="play-btn" type="button" aria-label="Play ${esc(t.title)}">${PLAY}</button>
                <div class="pd-track-body">
                  ${tracks.length>1||t.title!=="Preview"?`<span class="pd-track-title">${esc(t.title)}</span>`:""}
                  <div class="waveform-container"><div class="waveform-bars">${bars(tracks.length>1?40:64)}</div></div>
                </div>
              </li>`).join("")}
            </ul>
          </div>`:""}
        </div>
      </section>

      ${p.long_description?`<section class="pd-section"><h2>About</h2><div class="pd-text">${paragraphs(p.long_description)}</div></section>`:""}
      ${features.length?`<section class="pd-section"><h2>What's included</h2><ul class="pd-features">${features.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></section>`:""}
      ${videos.length?`<section class="pd-section"><h2>Showcase</h2><div class="pd-videos">${videos.map(v=>`<div class="pd-video">${v}</div>`).join("")}</div></section>`:""}

      <section class="pd-section">
        <h2>FAQ</h2>
        <div class="pd-faq">
          ${faqFor(p).map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}
        </div>
      </section>

      <div class="pd-sticky" id="pd-sticky" aria-hidden="true">
        <div class="pd-sticky-inner">
          <div class="pd-sticky-info">
            <strong>${esc(p.title)}</strong>
            <span class="price-wrap">${was}<span class="price">${price}</span></span>
            ${trustLine(p,true)}
          </div>
          <div class="cart-actions">${cartBtn("outline","sticky-cart-btn",p,images,' tabindex="-1"')}<button class="button" id="sticky-buy-btn" type="button" tabindex="-1">Buy now</button></div>
        </div>
      </div>`;

    // Galerie: Klick auf Vorschaubild wechselt das Hauptbild
    // 3D-Modell: erster "Slide"; bis die Texturen geladen sind (oder falls sie fehlen) bleibt das normale Bild
    let m3d=null;
    const t3d=$("pd-thumb-3d");
    const thumbs=[...root.querySelectorAll("[data-img]")];
    const mark=on=>{ if(t3d) t3d.classList.toggle("active",on); thumbs.forEach(x=>x.classList.remove("active")); };
    if(p.model3d&&window.Product3D&&$("pd-main")){
      m3d=window.Product3D.mount($("pd-main"),p.model3d,{size:"large",alt:`${p.title} – 3D model, drag to rotate`,
        onready:()=>{ if(t3d){ t3d.hidden=false; if(!thumbs.some(x=>x.classList.contains("active"))) t3d.classList.add("active"); } },
        onfail:()=>{ m3d=null; if(t3d) t3d.hidden=true; const first=thumbs[0]; if(first) first.classList.add("active"); }});
      if(t3d) t3d.onclick=()=>{ if(!m3d) return; m3d.show(); mark(true); };
    }
    if(p.sound_preview&&window.SoundPads&&$("pd-sounds")) SoundPads.mountProduct($("pd-sounds"),p,{db});
    thumbs.forEach(b=>b.onclick=()=>{
      $("pd-main-img").src=b.dataset.img;
      if(m3d) m3d.hide();
      if(t3d) t3d.classList.remove("active");
      thumbs.forEach(x=>x.classList.toggle("active",x===b));
    });

    root.querySelectorAll(".pd-video-ph").forEach(b=>b.onclick=()=>{
      const src=b.dataset.embed||"";
      if(!/^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/.test(src)) return;
      const f=document.createElement("iframe");
      f.src=src; f.title="Video"; f.allow=b.dataset.allow||""; f.allowFullscreen=true; f.referrerPolicy="strict-origin-when-cross-origin";
      b.replaceWith(f);
    });
    $("buy-btn").onclick=buy;
    $("sticky-buy-btn").onclick=buy;
    setupSticky(); promoNote();
    if(tracks.length) setupPlayers(tracks);
    loadReviews(p);
  }

  async function showGuide(p,images){
    const price=money(p.price_cents,p.currency);
    const was=Number(p.compare_at_cents)>p.price_cents?`<s class="was-price">${money(p.compare_at_cents,p.currency)}</s>`:"";
    let cat=null;
    if(p.category){
      try{ const {data:c,error:ce}=await db.from("shop_categories").select("slug,name").eq("slug",p.category).maybeSingle(); if(!ce&&c) cat=c; }catch(_){}
    }
    const SEP='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
    root.innerHTML=`
      <nav class="crumbs" aria-label="Breadcrumb"><a href="shop.html">Shop</a>${cat?`${SEP}<a href="shop.html?cat=${encodeURIComponent(cat.slug)}">${esc(cat.name)}</a>`:""}${SEP}<span aria-current="page">${esc(p.title)}</span></nav>
      <a class="back-link" href="shop.html#downloads"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="m15 6-6 6 6 6"/></svg> Back to shop</a>
      <div id="guide-root"></div>
      <div class="pd-sticky" id="pd-sticky" aria-hidden="true">
        <div class="pd-sticky-inner">
          <div class="pd-sticky-info"><strong>${esc(p.title)}</strong><span class="price-wrap">${was}<span class="price">${price}</span></span></div>
          <div class="cart-actions">${cartBtn("outline","sticky-cart-btn",p,images,' tabindex="-1"')}<button class="button" id="sticky-buy-btn" data-buy type="button" tabindex="-1">Buy now</button></div>
        </div>
      </div>`;
    window.renderGuide(p,{root:$("guide-root"),images,price,was,esc,media,paragraphs,faq:faqFor(p),buy,cartAttrs:cartAttrs(p,images),track:(n,d)=>{ window.ylyTrack&&ylyTrack(n,d); }});
    root.querySelectorAll("[data-buy]").forEach(b=>b.addEventListener("click",buy));
    setupSticky(); promoNote();
    loadReviews(p);
  }

  // Bewertungen (reviews.js): Zusammenfassung + Sektion nur, wenn freigegebene Bewertungen existieren
  function loadReviews(p){
    if(window.YLYReviews) window.YLYReviews.mountProduct({db,productId:p.id,root,esc}).catch(()=>{});
  }

  // Fixierte Kaufleiste: erscheint, sobald der Haupt-Kaufbutton aus dem Bild gescrollt ist,
  // und verschwindet wieder, sobald der Footer sichtbar ist (verdeckt so keine Links)
  function setupSticky(){
    const bar=$("pd-sticky"), main=$("buy-btn"), footer=document.querySelector("footer");
    if(!bar||!main||!("IntersectionObserver" in window)) return;
    let pastBuy=false, footerVisible=false;
    const update=()=>{
      const show=pastBuy&&!footerVisible;
      bar.classList.toggle("visible",show);
      bar.setAttribute("aria-hidden",show?"false":"true");
      $("sticky-buy-btn").tabIndex=show?0:-1;
      const sc=$("sticky-cart-btn"); if(sc) sc.tabIndex=show?0:-1;
    };
    new IntersectionObserver(([e])=>{ pastBuy=!e.isIntersecting&&e.boundingClientRect.top<0; update(); }).observe(main);
    if(footer) new IntersectionObserver(([e])=>{ footerVisible=e.isIntersecting; update(); }).observe(footer);
  }

  // Ein Audio-Element für alle Hörproben: es spielt immer nur eine gleichzeitig
  function setupPlayers(tracks){
    const audio=new Audio(); audio.preload="none";
    const rows=[...root.querySelectorAll(".pd-track")];
    let current=-1;

    const reset=i=>{
      const r=rows[i]; if(!r) return;
      r.querySelector(".play-btn").innerHTML=PLAY;
      r.classList.remove("playing");
      r.querySelectorAll(".wave-bar").forEach(b=>b.classList.remove("active"));
    };

    rows.forEach((row,i)=>{
      const btn=row.querySelector(".play-btn"), wave=row.querySelector(".waveform-container");
      btn.onclick=()=>{
        if(current===i){ audio.paused?audio.play():audio.pause(); return; }
        reset(current); current=i;
        audio.src=media(tracks[i].file);
        audio.play().catch(()=>{});
      };
      wave.onclick=e=>{
        if(current!==i){ btn.onclick(); return; }
        if(!audio.duration) return;
        const r=wave.getBoundingClientRect();
        audio.currentTime=((e.clientX-r.left)/r.width)*audio.duration;
      };
    });

    audio.onplay=()=>{ const r=rows[current]; if(r){ r.querySelector(".play-btn").innerHTML=PAUSE; r.classList.add("playing"); } };
    audio.onpause=()=>{ const r=rows[current]; if(r) r.querySelector(".play-btn").innerHTML=PLAY; };
    audio.onended=()=>reset(current);
    audio.onerror=()=>{ const r=rows[current]; if(r){ reset(current); r.querySelector(".play-btn").setAttribute("title","Preview not available"); } };
    audio.ontimeupdate=()=>{
      const r=rows[current]; if(!r) return;
      const bars=[...r.querySelectorAll(".wave-bar")];
      const n=Math.round((audio.duration?audio.currentTime/audio.duration:0)*bars.length);
      bars.forEach((b,k)=>b.classList.toggle("active",k<n));
    };
  }

  // SEO: Beschreibung, Canonical, Teilen-Vorschau und Produktdaten für Google
  function setSeo(p,images){
    images=images.map(u=>{ try{ return new URL(u,location.href).href; }catch(_){ return u; } }); // gespiegelte media/-Pfade -> absolut
    const slug=window.YLYProducts&&YLYProducts.slugs[p.id];
    const url=slug?`https://yardslovesyou.com/${slug}.html`:`https://yardslovesyou.com/product.html?id=${encodeURIComponent(p.id)}`;
    let desc=String(p.description||"Digital download as ZIP file.").replace(/\s+/g," ").trim();
    if(desc.length>155){desc=desc.slice(0,155);const sp=desc.lastIndexOf(" ");if(sp>100)desc=desc.slice(0,sp);desc=desc.replace(/[\s,.;:\-]+$/,"")+"…";}
    const meta=(attr,key,val)=>{
      let el=document.head.querySelector(`meta[${attr}="${key}"]`);
      if(!el){el=document.createElement("meta");el.setAttribute(attr,key);document.head.appendChild(el);}
      el.setAttribute("content",val);
    };
    meta("name","description",desc);
    meta("property","og:title",`${p.title} · YARDSLOVESYOU`);
    meta("property","og:description",desc);
    meta("property","og:url",url);
    meta("property","og:image",images[0]||"https://yardslovesyou.com/og-image.jpg");
    meta("name","twitter:card","summary_large_image");
    meta("name","twitter:title",`${p.title} · YARDSLOVESYOU`);
    meta("name","twitter:description",desc);
    meta("name","twitter:image",images[0]||"https://yardslovesyou.com/og-image.jpg");

    let canon=document.head.querySelector('link[rel="canonical"]');
    if(!canon){canon=document.createElement("link");canon.rel="canonical";document.head.appendChild(canon);}
    canon.href=url;

    let ld=document.getElementById("ld-product");
    if(!ld){ld=document.createElement("script");ld.id="ld-product";ld.type="application/ld+json";}
    ld.textContent=JSON.stringify({
      "@context":"https://schema.org",
      "@type":"Product",
      "name":p.title,
      "description":desc,
      "image":images,
      "sku":p.id,
      "url":url,
      "brand":{"@type":"Brand","name":"YARDSLOVESYOU"},
      "offers":{
        "@type":"Offer",
        "url":url,
        "price":(p.price_cents/100).toFixed(2),
        "priceCurrency":String(p.currency||cfg.CURRENCY||"CHF").toUpperCase(),
        "availability":"https://schema.org/InStock"
      }
    });
    document.head.appendChild(ld);
  }

  // Rabattcode (sessionStorage, von cart.js gesetzt); echte Pruefung passiert in create-checkout
  const promoCode=()=>{try{const c=String(sessionStorage.getItem("yly_promo")||"").trim().toUpperCase();return /^[A-Z0-9][A-Z0-9-]{2,31}$/.test(c)?c:"";}catch(_){return "";}};
  const promoBody=()=>{const b={product_id:id},c=promoCode();if(c)b.promo=c;return b;};
  function promoNote(){
    const old=document.getElementById("promo-note"); if(old) old.remove();
    const c=promoCode(), buyRow=root.querySelector(".pd-buy")||root.querySelector(".gd-buyrow");
    if(!c||!buyRow) return;
    let fromUrl=false; try{fromUrl=sessionStorage.getItem("yly_promo_src")==="url";}catch(_){}
    const n=document.createElement("p"); n.id="promo-note"; n.className="promo-note"; n.setAttribute("role","status");
    const strong=document.createElement("strong"); strong.textContent=c;
    n.append("Your code ",strong,fromUrl&&id==="11f558ea-9332-4bf3-ad2f-d8327c489445"?": 15% off at checkout":" will be applied at checkout");
    buyRow.insertAdjacentElement("afterend",n);
  }
  window.addEventListener("yly-promo",()=>{if(root.querySelector(".pd-buy, .gd-buyrow")) promoNote();});

  async function buy(){
    const btns=[...new Set([$("buy-btn"),$("sticky-buy-btn"),...root.querySelectorAll("[data-buy]")])].filter(Boolean);
    btns.forEach(b=>{b.dataset.t=b.dataset.t||b.textContent;b.disabled=true;b.textContent="Redirecting …";});
    window.ylyTrack&&ylyTrack("checkout-click",{id});
    try{
      const {data,error}=await db.functions.invoke("create-checkout",{body:promoBody()});
      if(error){ let m=error.message; try{ const j=await error.context.json(); if(j&&j.error) m=j.error; }catch(_){} throw new Error(m); }
      if(!data?.url) throw new Error(data?.error||"Checkout link missing.");
      if(!/^https:\/\//i.test(String(data.url))) throw new Error("Invalid checkout link.");
      location.href=data.url;
    }catch(e){alert("Checkout failed: "+(e.message||e));btns.forEach(b=>{b.disabled=false;b.textContent=b.dataset.t||"Buy now";});}
  }

  load();
})();

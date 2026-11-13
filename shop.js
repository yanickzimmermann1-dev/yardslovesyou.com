(() => {
  const cfg=window.APP_CONFIG||{}, $=id=>document.getElementById(id);
  $("year").textContent=new Date().getFullYear();
  const hint=(m,t)=>{ m=String(m||"Something went wrong."); return /try again|try another/i.test(m)?m:m.replace(/[.!?\s]*$/,"")+". "+(t||"Please try again."); };
  const S=(el,o)=>{ if(window.YLYState) window.YLYState.render(el,o); else if(el) el.textContent=(o.title||"")+" "+(o.text||""); };
  const ready=cfg.SUPABASE_URL?.startsWith("https://")&&!cfg.SUPABASE_URL.includes("DEINE_")&&cfg.SUPABASE_PUBLISHABLE_KEY&&!cfg.SUPABASE_PUBLISHABLE_KEY.includes("DEIN_");
  if(!ready){S($("products"),{icon:"box",title:"The shop is unavailable",text:"We could not reach the shop right now. Please try again in a moment.",error:true,actions:[{label:"Back to home",href:"index.html"}]});return;}
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const img=u=>{ const r=/^https:\/\//i.test(u)?u:db.storage.from("coverart-products").getPublicUrl(u).data.publicUrl; return window.YLYMedia?YLYMedia.url(r):r; };
  const link=id=>window.YLYProducts?YLYProducts.url(id):`product.html?id=${encodeURIComponent(id)}`;
  const money=(cents,cur)=>(cents/100).toLocaleString("de-CH",{style:"currency",currency:String(cur||cfg.CURRENCY||"CHF").toUpperCase()});

  // Preis, optional mit durchgestrichenem Originalpreis (nur wenn höher als der aktuelle Preis)
  const priceHtml=p=>{
    const was=Number(p.compare_at_cents)>p.price_cents?`<s class="was-price">${money(p.compare_at_cents,p.currency)}</s>`:"";
    return `<span class="price-wrap">${was}<span class="price">${money(p.price_cents,p.currency)}</span></span>`;
  };

  const reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CART_IC='<svg class="ic-add" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.3l2.1 11h10.4l2.1-8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/><path d="M12.5 8.5v4M10.5 10.5h4"/></svg><svg class="ic-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
  const CHEV='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
  const skCard='<article class="product sk-card" aria-hidden="true"><div class="sk sk-cover"></div><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-line w60"></div><div class="sk sk-price"></div></article>';
  $("products").innerHTML=skCard.repeat(2); $("products").setAttribute("aria-busy","true");
  let products=[], cats=[], sel=null; // cats: nur Kategorien mit Produkten

  // 3D-Modell (Spalte model3d, jsonb) – ohne Spalte/Wert bleibt alles wie bisher
  const model=p=>{
    let m=p&&p.model3d;
    if(typeof m==="string"){ try{ m=JSON.parse(m); }catch(_){ m=null; } }
    return m&&typeof m==="object"&&m.front&&(m.type==="book"||m.type==="card")?m:null;
  };
  let handles=[];
  const mount3d=box=>{
    handles.forEach(h=>{ try{h.destroy();}catch(_){} }); handles=[];
    if(!window.Product3D) return;
    box.querySelectorAll(".cover[data-p3d]").forEach(c=>{
      const p=products.find(x=>String(x.id)===c.dataset.p3d), m=model(p);
      if(m) handles.push(window.Product3D.mount(c,m,{size:"small",alt:p.title}));
    });
  };

  const card=p=>`
      <article class="product" data-pid="${esc(p.id)}">
        <a class="product-link cover-link" href="${link(p.id)}" aria-label="${esc(p.title)}">
          <div class="cover"${model(p)?` data-p3d="${esc(p.id)}"`:""}>
            ${p.image_url?`<img src="${esc(img(p.image_url))}" alt="${esc(p.title)}" width="600" height="600" class="bu" loading="lazy" decoding="async">`:esc(p.cover_emoji||"")}
          </div>
        </a>
        <div class="p-under">${p.badge?`<span class="badge">${esc(p.badge)}</span>`:""}</div>
        <a class="product-link" href="${link(p.id)}">
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description||"Digital download as ZIP file.")}</p>
          ${p.royalty_free?`<p class="tag-line"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="m5 12.5 4.5 4.5L19 7"/></svg> Royalty-free</p>`:""}
        </a>
        <div class="price-row">
          ${priceHtml(p)}
          <div class="row-actions">
            <button class="cart-add-ic" type="button" data-cart-add="${esc(p.id)}" data-cart-icon data-cart-title="${esc(p.title)}" data-cart-price="${esc(p.price_cents)}" data-cart-currency="${esc(String(p.currency||cfg.CURRENCY||"chf").toLowerCase())}" data-cart-cover="${p.image_url?esc(img(p.image_url)):""}" aria-label="Add ${esc(p.title)} to cart" title="Add to cart">${CART_IC}</button>
            <a class="outline" href="${link(p.id)}">Details</a>
            <button class="button" data-buy="${esc(p.id)}">Buy</button>
          </div>
        </div>
      </article>`;

  const catUrl=slug=>slug?`shop.html?cat=${encodeURIComponent(slug)}`:"shop.html";

  function renderBar(){
    const bar=$("cat-bar");
    if(!bar) return;
    if(cats.length<2){bar.hidden=true;bar.innerHTML="";return;}
    const chip=(slug,label,n)=>`<a class="cat-chip${(sel||"")===(slug||"")?" active":""}" href="${catUrl(slug)}" data-cat="${esc(slug||"")}"${(sel||"")===(slug||"")?' aria-current="true"':""}>${esc(label)}<span class="cat-n">${n}</span></a>`;
    bar.hidden=false;
    bar.innerHTML=`<div class="cat-scroll" role="group" aria-label="Filter by category">${chip("","All",products.length)}${cats.map(c=>chip(c.slug,c.name,c.n)).join("")}</div>`;
    const on=bar.querySelector(".active"); // aktiven Chip bei schmalem Screen sichtbar halten
    if(on&&on.scrollIntoView) { const sc=bar.firstElementChild; sc.scrollLeft=Math.max(0,on.offsetLeft-16); }
  }

  function renderGrid(animate){
    const box=$("products"); box.removeAttribute("aria-busy");
    if(!products.length){handles.forEach(h=>{ try{h.destroy();}catch(_){} }); handles=[];box.className="product-grid";$("shop-count").textContent="";S(box,{icon:"box",title:"No products yet",text:"New packs are on the way. Check back soon, or reload to see if something just landed.",actions:[{label:"Retry",onClick:()=>load()},{label:"Back to home",href:"index.html"}]});return;}
    const grouped=cats.length>=2&&!sel;
    let list=products;
    if(cats.length>=2&&sel) list=products.filter(p=>p.category===sel);
    $("shop-count").textContent=`${list.length} ${list.length===1?"product":"products"}`;
    if(!list.length){handles.forEach(h=>{ try{h.destroy();}catch(_){} }); handles=[];box.className="product-grid";S(box,{icon:"box",title:"Nothing in this category yet",text:"This category has no products at the moment. Try another one or browse everything.",actions:[{label:"Browse all",onClick:()=>select(null,true)},{label:"Try another category",onClick:()=>{const c=cats.find(x=>x.slug!==sel);select(c?c.slug:null,true);}}]});return;}
    if(grouped){
      const groups=cats.map(c=>({name:c.name,tagline:c.tagline,items:products.filter(p=>p.category===c.slug)}));
      const rest=products.filter(p=>!cats.some(c=>c.slug===p.category));
      if(rest.length) groups.push({name:"More",tagline:"",items:rest});
      box.className="cat-groups";
      box.innerHTML=groups.filter(g=>g.items.length).map(g=>`
        <section class="cat-section">
          <div class="cat-head"><h3>${esc(g.name)}</h3>${g.tagline?`<p class="muted">${esc(g.tagline)}</p>`:""}</div>
          <div class="product-grid">${g.items.map(card).join("")}</div>
        </section>`).join("");
    }else{
      box.className="product-grid";
      box.innerHTML=list.map(card).join("");
    }
    box.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>buy(b.dataset.buy));
    mount3d(box);
    if(window.SoundPads) SoundPads.attach(box,products,{db});
    if(animate&&!reduce&&box.animate){
      box.animate([{opacity:0,transform:"scale(.985) translateY(6px)"},{opacity:1,transform:"none"}],{duration:380,easing:"cubic-bezier(.34,1.2,.64,1)"});
      box.querySelectorAll(".rv").forEach(el=>el.classList.add("in"));
    }
  }

  function select(slug,push){
    sel=cats.some(c=>c.slug===slug)?slug:null;
    if(push){
      try{history.replaceState(null,"",sel?`?cat=${encodeURIComponent(sel)}`:location.pathname);}catch(_){}
    }
    renderBar(); renderGrid(push);
  }

  async function loadCategories(){
    // Tabelle/Spalte existiert evtl. noch nicht: dann still bei der flachen Liste bleiben
    try{
      const {data,error}=await db.from("shop_categories").select("slug,name,tagline,sort").order("sort",{ascending:true});
      if(error||!Array.isArray(data)) return [];
      return data.map(c=>({...c,n:products.filter(p=>p.category===c.slug).length})).filter(c=>c.n>0);
    }catch(_){return [];}
  }

  let barBound=false;
  async function load() {
    $("products").setAttribute("aria-busy","true"); $("products").className="product-grid"; $("products").innerHTML=skCard.repeat(2);
    // select("*"): neue Spalten (badge, compare_at_cents, category …) werden automatisch mitgeladen
    const {data,error}=await db.from("shop_products").select("*").eq("published",true).order("created_at",{ascending:false});
    if(error){$("products").removeAttribute("aria-busy");$("products").className="product-grid";S($("products"),{icon:"alert",title:"Products could not be loaded",text:"Something went wrong on our side or your connection dropped. Please try again.",error:true,actions:[{label:"Retry",onClick:()=>load()},{label:"Back to home",href:"index.html"}]});return;}
    products=data;
    if(document.readyState==="loading") await new Promise(r=>document.addEventListener("DOMContentLoaded",r)); // defer-Skripte (product3d.js) sind danach bereit
    cats=products.length?await loadCategories():[];
    const bar=$("cat-bar");
    if(bar&&!barBound){ barBound=true; bar.addEventListener("click",e=>{
      const a=e.target.closest&&e.target.closest("[data-cat]");
      if(!a||e.metaKey||e.ctrlKey||e.shiftKey||e.button) return;
      e.preventDefault(); select(a.dataset.cat||null,true);
    });}
    select(new URLSearchParams(location.search).get("cat"),false);
  }

  async function buy(productId) {
    const b=document.querySelector(`[data-buy="${CSS.escape(productId)}"]`); if(b){b.disabled=true;b.textContent="Redirecting …";}
    window.ylyTrack&&ylyTrack("checkout-click",{id:productId});
    try{
      const {data,error}=await db.functions.invoke("create-checkout",{body:{product_id:productId}});
      if(error){ let m=error.message; try{ const j=await error.context.json(); if(j&&j.error) m=j.error; }catch(_){} throw new Error(m); }
      if(!data?.url) throw new Error(data?.error||"Checkout link missing.");
      if(!/^https:\/\//i.test(String(data.url))) throw new Error("Invalid checkout link.");
      location.href=data.url;
    }catch(e){alert("Checkout failed: "+(e.message||e));if(b){b.disabled=false;b.textContent="Buy";}}
  }

  // Free Kit gegen E-Mail
  const kitForm=$("free-kit-form");
  if(kitForm){
    kitForm.onsubmit=async e=>{
      e.preventDefault();
      const email=$("free-kit-email").value.trim();
      const btn=$("free-kit-btn"), status=$("free-kit-status");
      status.classList.remove("danger");
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){
        status.textContent="Please enter a valid email address."; status.classList.add("danger"); return;
      }
      btn.disabled=true; btn.textContent="Sending …"; status.textContent="";
      try{
        const {data,error}=await db.functions.invoke("free-kit",{body:{email,marketing_consent:$("free-kit-consent").checked}});
        if(error){
          let msg=error.message;
          try{ const j=await error.context.json(); if(j?.error) msg=j.error; }catch(_){}
          throw new Error(msg);
        }
        if(!data?.ok) throw new Error(data?.error||"Something went wrong.");
        status.textContent=data.already_sent
          ? "We just sent it to you – please check your inbox (and spam folder)."
          : "Done! Check your inbox for the download link (and your spam folder, just in case).";
        kitForm.reset();
      }catch(err){
        status.textContent=hint(err.message); status.classList.add("danger");
      }finally{
        btn.disabled=false; btn.textContent="Send me the kit";
      }
    };
  }

  // Ältere Kauf-Links (shop.html?success=1&session_id=...) funktionieren weiterhin
  const params=new URLSearchParams(location.search);
  if(params.get("success")==="1"&&params.get("session_id")){
    $("download-result").classList.remove("hidden");
    $("download-result").innerHTML="<h2>Verifying payment...</h2><p class='muted'>If your payment was successful, you can now request your download.</p><button class='button' id='get-download'>Download ZIP</button><p id='download-status' class='status'></p>";
    $("get-download").onclick=async()=>{
      $("download-status").textContent="Verifying payment...";
      const {data,error}=await db.functions.invoke("download-zip",{body:{session_id:params.get("session_id")}});
      if(error||!data?.url){$("download-status").textContent="Download not available: "+(error?.message||data?.error||"Payment could not be confirmed.");return;}
      const a=document.createElement("a");a.href=/^https:\/\//i.test(String(data.url))?data.url:"#";a.textContent="Start download";a.className="download-link";a.rel="noopener noreferrer";a.target="_blank";$("download-status").replaceWith(a);
    };
  }
  load();
})();

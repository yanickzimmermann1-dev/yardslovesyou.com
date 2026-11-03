(() => {
  const cfg=window.APP_CONFIG||{}, $=id=>document.getElementById(id);
  $("year").textContent=new Date().getFullYear();
  const ready=cfg.SUPABASE_URL?.startsWith("https://")&&!cfg.SUPABASE_URL.includes("DEINE_")&&cfg.SUPABASE_PUBLISHABLE_KEY&&!cfg.SUPABASE_PUBLISHABLE_KEY.includes("DEIN_");
  if(!ready){$("products").innerHTML='<div class="empty">Trage zuerst deine Supabase-Zugangsdaten in <code>config.js</code> ein und richte die Datenbank gemäss README ein.</div>';return;}
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function load() {
    const {data,error}=await db.from("shop_products").select("id,title,description,price_cents,currency,cover_emoji,image_url").eq("published",true).order("created_at",{ascending:false});
    if(error){$("products").innerHTML='<div class="empty">Produkte konnten nicht geladen werden. Bitte SQL und Supabase prüfen.</div>';return;}
    $("shop-count").textContent=`${data.length} Produkte`;
    $("products").innerHTML=data.length?data.map(p=>`<article class="product"><div class="cover">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy">`:esc(p.cover_emoji||"")}</div><h3>${esc(p.title)}</h3><p>${esc(p.description||"Digitaler Download als ZIP-Datei.")}</p><div class="price-row"><span class="price">${(p.price_cents/100).toLocaleString("de-CH",{style:"currency",currency:p.currency||cfg.CURRENCY||"CHF"})}</span><button class="button" data-buy="${esc(p.id)}">Buy</button></div></article>`).join(""):'<div class="empty">Noch keine Produkte veröffentlicht. Lege Produkte in Supabase unter shop_products an.</div>';
    document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>buy(b.dataset.buy));
  }
  async function buy(productId) {
    const b=document.querySelector(`[data-buy="${CSS.escape(productId)}"]`); if(b){b.disabled=true;b.textContent="Weiterleitung …";}
    try{
      const {data,error}=await db.functions.invoke("create-checkout",{body:{product_id:productId}});
      if(error) throw error;
      if(!data?.url) throw new Error(data?.error||"Checkout-Link fehlt.");
      location.href=data.url;
    }catch(e){alert("Checkout ist noch nicht eingerichtet: "+(e.message||e));if(b){b.disabled=false;b.textContent="Buy";}}
  }
  const params=new URLSearchParams(location.search);
  if(params.get("success")==="1"&&params.get("session_id")){
    $("download-result").classList.remove("hidden");
    $("download-result").innerHTML="<h2>Verifying payment...</h2><p class='muted'>If your payment was successful, you can now request your download.</p><button class='button' id='get-download'>Download ZIP</button><p id='download-status' class='status'></p>";
    $("get-download").onclick=async()=>{
      $("download-status").textContent="Verifying payment...";
      const {data,error}=await db.functions.invoke("download-zip",{body:{session_id:params.get("session_id")}});
      if(error||!data?.url){$("download-status").textContent="Download nicht freigegeben: "+(error?.message||data?.error||"Zahlung konnte nicht bestätigt werden.");return;}
      const a=document.createElement("a");a.href=data.url;a.textContent="Start download";a.className="download-link";a.rel="noopener";a.target="_blank";$("download-status").replaceWith(a);
    };
  }
  load();
})();

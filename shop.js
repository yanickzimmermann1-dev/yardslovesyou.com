(() => {
  const cfg=window.APP_CONFIG||{}, $=id=>document.getElementById(id);
  $("year").textContent=new Date().getFullYear();
  const ready=cfg.SUPABASE_URL?.startsWith("https://")&&!cfg.SUPABASE_URL.includes("DEINE_")&&cfg.SUPABASE_PUBLISHABLE_KEY&&!cfg.SUPABASE_PUBLISHABLE_KEY.includes("DEIN_");
  if(!ready){$("products").innerHTML='<div class="empty">The shop is not available right now.</div>';return;}
  const db=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const img=u=>/^https?:\/\//.test(u)?u:db.storage.from("coverart-products").getPublicUrl(u).data.publicUrl;
  const link=id=>`product.html?id=${encodeURIComponent(id)}`;
  async function load() {
    const {data,error}=await db.from("shop_products").select("id,title,description,price_cents,currency,cover_emoji,image_url").eq("published",true).order("created_at",{ascending:false});
    if(error){$("products").innerHTML='<div class="empty">Products could not be loaded. Please try again later.</div>';return;}
    $("shop-count").textContent=`${data.length} ${data.length===1?"product":"products"}`;
    $("products").innerHTML=data.length?data.map(p=>`<article class="product"><a class="product-link" href="${link(p.id)}"><div class="cover">${p.image_url?`<img src="${esc(img(p.image_url))}" alt="${esc(p.title)}" loading="lazy">`:esc(p.cover_emoji||"")}</div><h3>${esc(p.title)}</h3><p>${esc(p.description||"Digital download as ZIP file.")}</p></a><div class="price-row"><span class="price">${(p.price_cents/100).toLocaleString("de-CH",{style:"currency",currency:p.currency||cfg.CURRENCY||"CHF"})}</span><div class="row-actions"><a class="outline" href="${link(p.id)}">Details</a><button class="button" data-buy="${esc(p.id)}">Buy</button></div></div></article>`).join(""):'<div class="empty">No products yet. Check back soon.</div>';
    document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=()=>buy(b.dataset.buy));
  }
  async function buy(productId) {
    const b=document.querySelector(`[data-buy="${CSS.escape(productId)}"]`); if(b){b.disabled=true;b.textContent="Redirecting …";}
    try{
      const {data,error}=await db.functions.invoke("create-checkout",{body:{product_id:productId}});
      if(error) throw error;
      if(!data?.url) throw new Error(data?.error||"Checkout link missing.");
      location.href=data.url;
    }catch(e){alert("Checkout failed: "+(e.message||e));if(b){b.disabled=false;b.textContent="Buy";}}
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
      const a=document.createElement("a");a.href=data.url;a.textContent="Start download";a.className="download-link";a.rel="noopener";a.target="_blank";$("download-status").replaceWith(a);
    };
  }
  load();
})();

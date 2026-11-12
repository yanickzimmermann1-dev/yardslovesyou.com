(() => {
  const PID = "11f558ea-9332-4bf3-ad2f-d8327c489445";
  const cfg = window.APP_CONFIG || {};
  const card = document.getElementById("pl-upsell");
  if (!card || !window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) return;
  const track = (n, d) => { try { window.ylyTrack && window.ylyTrack(n, d); } catch (_) {} };
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DISMISS = "yly_perclab_upsell_dismiss", SHOWN = "yly_perclab_upsell_shown", WEEK = 7 * 864e5;
  let p = null, nudge = null, gens = 0, viewed = false, handle = null;
  const link = `product.html?id=${encodeURIComponent(PID)}`;
  const inCart = () => { try { return !!(window.ylyCart && window.ylyCart.has(PID)); } catch (_) { return false; } };
  const money = (c, cur) => (c / 100).toLocaleString("de-CH", { style: "currency", currency: String(cur || cfg.CURRENCY || "CHF").toUpperCase() });
  const model = () => {
    let m = p && p.model3d;
    if (typeof m === "string") { try { m = JSON.parse(m); } catch (_) { m = null; } }
    return m && typeof m === "object" && m.front && (m.type === "book" || m.type === "card") ? m : null;
  };
  const dismissed = () => { try { const t = +localStorage.getItem(DISMISS); return t && Date.now() - t < WEEK; } catch (_) { return false; } };
  const shownThisSession = () => { try { return sessionStorage.getItem(SHOWN) === "1"; } catch (_) { return false; } };

  function addToCart(from) {
    if (!window.ylyCart || !p) { location.href = link; return; }
    if (inCart()) { window.ylyCart.open(); return; }
    const img = p.image_url ? (/^https:\/\//i.test(p.image_url) ? p.image_url : window.__plDb.storage.from("coverart-products").getPublicUrl(p.image_url).data.publicUrl) : "";
    if (window.ylyCart.add({ id: PID, title: p.title, price_cents: p.price_cents, currency: String(p.currency || cfg.CURRENCY || "chf").toLowerCase(), cover: img }, from)) track("perclab-upsell-add");
    sync();
  }
  function btns(small) {
    return inCart()
      ? `<button type="button" class="button" data-up="open">In your cart – Checkout</button>`
      : `<button type="button" class="button" data-up="add">Add to cart</button>${small ? "" : `<a class="outline" href="${link}">View kit</a>`}`;
  }
  function renderCard() {
    card.innerHTML = `<div class="pl-up-cover" id="pl-up-cover">${p.image_url ? `<img src="${esc(coverUrl())}" alt="${esc(p.title)}" loading="lazy">` : esc(p.cover_emoji || "")}</div>
      <div class="pl-up-body"><h3>${esc(p.title)}</h3><p>Like these sounds? Get 96 hand-crafted percussion one-shots in Essentials.</p>
      <div class="pl-up-row"><span class="pl-up-price">${money(p.price_cents, p.currency)}</span>${btns(false)}</div></div>`;
    const m = model();
    if (m && window.Product3D) { try { if (handle) handle.destroy(); handle = window.Product3D.mount(document.getElementById("pl-up-cover"), m, { size: "small", alt: p.title }); } catch (_) {} }
  }
  function coverUrl() { return /^https:\/\//i.test(p.image_url) ? p.image_url : window.__plDb.storage.from("coverart-products").getPublicUrl(p.image_url).data.publicUrl; }
  function sync() {
    if (!p) return;
    const row = card.querySelector(".pl-up-row");
    if (row) row.innerHTML = `<span class="pl-up-price">${money(p.price_cents, p.currency)}</span>${btns(false)}`;
    if (nudge && !nudge.classList.contains("hidden")) { const r = nudge.querySelector(".pl-up-row"); if (r) r.innerHTML = btns(true) + `<button type="button" class="outline" data-up="dismiss">Not now</button>`; }
  }
  function showNudge() {
    if (!p || nudge || dismissed() || shownThisSession() || inCart()) return;
    try { sessionStorage.setItem(SHOWN, "1"); } catch (_) {}
    nudge = document.createElement("div");
    nudge.className = "pl-nudge"; nudge.setAttribute("role", "status");
    nudge.innerHTML = `<p>Your loop sounds great. Want the full kit?</p><div class="pl-up-row"></div>`;
    document.body.appendChild(nudge);
    sync();
    requestAnimationFrame(() => requestAnimationFrame(() => nudge && nudge.classList.add("on")));
    track("perclab-upsell-view", { where: "toast" });
  }
  function closeNudge(persist) {
    if (persist) { try { localStorage.setItem(DISMISS, String(Date.now())); } catch (_) {} }
    if (!nudge) return;
    const n = nudge; n.classList.remove("on"); setTimeout(() => n.remove(), 400);
  }
  function later() { setTimeout(showNudge, 1500); }

  document.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-up]"); if (!b) return;
    const a = b.dataset.up;
    if (a === "add") { addToCart(b); if (nudge && nudge.contains(b)) closeNudge(true); }
    else if (a === "open") { window.ylyCart ? window.ylyCart.open() : (location.href = link); }
    else if (a === "dismiss") closeNudge(true);
  });
  document.addEventListener("perclab:generate", () => { if (++gens === 3) later(); });
  document.addEventListener("perclab:export", later);
  window.addEventListener("storage", sync);
  document.addEventListener("click", () => setTimeout(sync, 0), true);

  const db = window.__plDb = (window.YLY && window.YLY.db) || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  db.from("shop_products").select("*").eq("id", PID).eq("published", true).maybeSingle().then(({ data }) => {
    if (!data) return;
    p = data; renderCard(); card.classList.remove("hidden");
    if (!viewed && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { viewed = true; track("perclab-upsell-view", { where: "card" }); io.disconnect(); } });
      io.observe(card);
    }
  }).catch(() => {});
})();

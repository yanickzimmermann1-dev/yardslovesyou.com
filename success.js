document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);

  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const box = $("confirm");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const fail = msg => {
    box.innerHTML = `
      <p class="eyebrow">SOMETHING WENT WRONG</p>
      <h1>Order not <span>found</span></h1>
      <p class="muted">${esc(msg)}<br>If you were charged, please contact us – we'll sort it out.</p>
      <a class="button" href="index.html">Back to home</a>`;
  };

  if (!window.supabase) return fail("Supabase SDK is not loaded.");
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const sessionId = new URLSearchParams(location.search).get("session_id");
  if (!sessionId) return fail("No order reference found.");

  (async () => {
    const { data, error } = await db.functions.invoke("order-details", { body: { session_id: sessionId } });
    if (error || data?.error) return fail(data?.error || error?.message || "Payment could not be confirmed.");

    const price = (data.amount / 100).toLocaleString("de-CH", {
      style: "currency",
      currency: (data.currency || "chf").toUpperCase()
    });

    // ---------- Shop: digitales Produkt mit Download ----------
    if (data.kind === "shop") {
      // Bezahlte Shop-Bestellung: Warenkorb leeren
      try { if (window.ylyCart) window.ylyCart.clear(); else localStorage.removeItem("yly_cart"); } catch (_) {}
      try { sessionStorage.removeItem("yly_promo"); sessionStorage.removeItem("yly_promo_src"); } catch (_) {}
      const items = Array.isArray(data.items) ? data.items : [];
      const multi = items.length > 1;
      const dlIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/></svg>';
      box.innerHTML = `
        <p class="eyebrow">ORDER CONFIRMED</p>
        <h1>Thank <span>you!</span></h1>
        <p class="muted">
          ${multi
            ? `You purchased <strong style="color:var(--text)">${items.length} products</strong> for`
            : `You purchased <strong style="color:var(--text)">${esc(data.product)}</strong> for`}
          <strong style="color:var(--text)">${price}</strong>.<br>
          ${multi ? "Your downloads are ready." : "Your download is ready."}
        </p>
        ${multi ? `
        <ul class="dl-list" style="list-style:none;margin:0 0 18px;padding:0;display:grid;gap:10px;max-width:560px">
          ${items.map(it => `
          <li style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;border:1px solid var(--line);border-radius:16px;background:var(--panel)">
            <strong style="min-width:0;overflow-wrap:anywhere">${esc(it.title)}</strong>
            <button class="button dl-item" type="button" data-pid="${esc(it.product_id)}">${dlIcon} Download</button>
          </li>`).join("")}
        </ul>` : `<button class="button" id="get-download" type="button">Download ZIP</button>`}
        <p id="download-status" class="status" role="status"></p>
        <p class="muted">A confirmation with your download link has been sent to <strong style="color:var(--text)">${esc(data.email)}</strong>.<br>
        You can come back to this page any time to download your files again.</p>
        <a class="outline" href="shop.html">Back to shop</a>`;

      const download = async (btn, productId) => {
        const status = $("download-status");
        btn.disabled = true;
        status.textContent = "Preparing download...";
        const body = productId ? { session_id: sessionId, product_id: productId } : { session_id: sessionId };
        const r = await db.functions.invoke("download-zip", { body });
        btn.disabled = false;
        if (r.error || !r.data?.url) {
          status.textContent = "Download not available: " + (r.data?.error || r.error?.message || "Please try again.");
          return;
        }
        if (!/^https:\/\//i.test(String(r.data.url))) { status.textContent = "Download not available."; return; }
        status.textContent = "Your download is starting…";
        location.href = r.data.url;
      };
      if (multi) box.querySelectorAll(".dl-item").forEach(b => { b.onclick = () => download(b, b.dataset.pid); });
      else $("get-download").onclick = () => download($("get-download"), null);
      return;
    }

    // ---------- Dienstleistung (Upload) ----------
    // Status-Link holen (nur fuer bezahlte Service-Bestellungen; bei Fehler einfach ohne Karte)
    let statusUrl = "";
    try {
      const t = await db.functions.invoke("order-status", { body: { session_id: sessionId } });
      if (t.data?.token) statusUrl = `${location.origin}/status.html?t=${encodeURIComponent(t.data.token)}`;
    } catch (_) {}
    box.innerHTML = `
      <p class="eyebrow">ORDER CONFIRMED</p>
      <h1>Thank <span>you!</span></h1>
      <p class="muted">
        You booked <strong style="color:var(--text)">${esc(data.product)}</strong> for
        <strong style="color:var(--text)">${price}</strong>.<br>
        Your files were submitted successfully.
      </p>
      <p class="muted">Thank you very much – we're looking forward to working with you!</p>
      <p class="muted">A confirmation has been sent to <strong style="color:var(--text)">${esc(data.email)}</strong>.</p>
      ${statusUrl ? `
      <div class="tr-card">
        <h2>Track your order</h2>
        <p class="muted" style="margin:0">Follow the progress of your order any time and get your files here. Save this link; we'll also email you at each step.</p>
        <div class="tr-link">
          <input id="tr-url" type="text" readonly value="${esc(statusUrl)}" aria-label="Order status link">
          <button class="outline" id="tr-copy" type="button">Copy</button>
        </div>
        <div class="st-actions"><a class="button" href="${esc(statusUrl)}">Open order status</a></div>
      </div>` : ""}
      <a class="outline" href="index.html">Back to home</a>`;
    if (statusUrl) {
      $("tr-copy").onclick = async () => {
        const b = $("tr-copy");
        try { await navigator.clipboard.writeText(statusUrl); } catch (_) { $("tr-url").select(); document.execCommand("copy"); }
        b.textContent = "Copied"; setTimeout(() => { b.textContent = "Copy"; }, 2000);
      };
    }
  })();
});

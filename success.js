document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);

  const yearEl = $("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const box = $("confirm");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const MAIL = "mailto:hello@yardslovesyou.com?subject=" + encodeURIComponent("Question about my order");
  const fail = msg => {
    msg = msg ? String(msg).replace(/[.!?\s]*$/, ".") : "";
    const pending = /pending|not (yet )?(paid|complete)|unpaid|processing/i.test(String(msg || ""));
    const o = pending
      ? { icon: "clock", title: "Payment still pending", text: (msg ? msg + " " : "") + "Payments can take a moment to confirm. Check your email for the confirmation, or check again in a minute.", actions: [{ label: "Check again", onClick: () => location.reload() }, { label: "Contact us", href: MAIL }] }
      : { icon: "mail", error: true, title: "We couldn't find this order", text: (msg ? msg + " " : "") + "Check your email: your confirmation has the link to your order. If you were charged, contact us and we'll sort it out.", actions: [{ label: "Contact us", href: MAIL }, { label: "Back to shop", href: "shop.html" }] };
    if (window.YLYState) window.YLYState.render(box, o);
    else box.innerHTML = `<h1>${esc(o.title)}</h1><p class="muted">${esc(o.text)}</p><a class="button" href="shop.html">Back to shop</a> <a class="outline" href="${MAIL}">Contact us</a>`;
  };

  if (!window.supabase) return fail("Supabase SDK is not loaded.");
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const sessionId = new URLSearchParams(location.search).get("session_id");
  if (!sessionId) return fail("No order reference found.");

  (async () => {
    const { data, error } = await db.functions.invoke("order-details", { body: { session_id: sessionId } }).catch(e => ({ data: null, error: e }));
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
      // Upgrade-Angebot aufs Bundle (kommt nur von der Function, wenn die Bestellung berechtigt ist)
      const up = data.upgrade && data.upgrade.bundle_id ? data.upgrade : null;
      const money = c => (c / 100).toLocaleString("de-CH", { style: "currency", currency: String(up?.currency || data.currency || "chf").toUpperCase() });
      const upgradeHtml = up ? `
        <div class="tr-card" id="upgrade-card">
          <h2>Get all 6 guides</h2>
          <p class="muted" style="margin:0">You own ${esc(up.owned)} of the 6 short guides. Get the other ${esc(up.rest)} in ${esc(up.title)} for ${esc(money(up.pay_cents))}. Your ${esc(money(up.credit_cents))} is already counted.</p>
          <div class="st-actions"><button class="button" id="upgrade-btn" type="button">Upgrade for ${esc(money(up.pay_cents))}</button></div>
          <p id="upgrade-status" class="status" role="status"></p>
        </div>` : "";
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
          <li style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;padding:12px 16px;border:1px solid var(--line);border-radius:16px;background:var(--panel)">
            <strong style="min-width:0;overflow-wrap:anywhere">${esc(it.title)}</strong>
            <button class="button dl-item" type="button" data-pid="${esc(it.product_id)}">${dlIcon} Download</button>
            <div class="rv-slot" data-pid="${esc(it.product_id)}" data-title="${esc(it.title)}"></div>
          </li>`).join("")}
        </ul>` : `<button class="button" id="get-download" type="button">Download ZIP</button>
        ${items[0] ? `<div class="rv-slot" data-pid="${esc(items[0].product_id)}" data-title="${esc(items[0].title || data.product)}"></div>` : ""}`}
        <p id="download-status" class="status" role="status"></p>
        <p class="muted">A confirmation with your download link has been sent to <strong style="color:var(--text)">${esc(data.email)}</strong>.<br>
        You can come back to this page any time to download your files again.</p>
        ${upgradeHtml}
        <a class="outline" href="shop.html">Back to shop</a>`;

      if (up) {
        const ub = $("upgrade-btn"), us = $("upgrade-status");
        ub.onclick = async () => {
          ub.disabled = true;
          us.textContent = "Opening checkout…";
          const r = await db.functions.invoke("create-checkout", { body: { items: [up.bundle_id], upgrade_from: sessionId } }).catch(e => ({ data: null, error: e }));
          if (r.error || !r.data?.url || !/^https:\/\//i.test(String(r.data.url))) {
            ub.disabled = false;
            us.textContent = "The upgrade is not available right now. Please try again.";
            return;
          }
          location.href = r.data.url;
        };
      }

      const download = async (btn, productId) => {
        const status = $("download-status");
        btn.disabled = true;
        status.textContent = "Preparing download...";
        const body = productId ? { session_id: sessionId, product_id: productId } : { session_id: sessionId };
        const r = await db.functions.invoke("download-zip", { body });
        btn.disabled = false;
        if (r.error || !r.data?.url) {
          status.textContent = "Download not available: " + (r.data?.error || r.error?.message || "Please try again.") + " You can press Download to retry, or check your email for the link.";
          return;
        }
        if (!/^https:\/\//i.test(String(r.data.url))) { status.textContent = "Download not available."; return; }
        status.textContent = "Your download is starting…";
        location.href = r.data.url;
      };
      if (multi) box.querySelectorAll(".dl-item").forEach(b => { b.onclick = () => download(b, b.dataset.pid); });
      else $("get-download").onclick = () => download($("get-download"), null);

      // Bewertungs-Widgets (ausgeblendet fuer bereits bewertete Produkte)
      const slots = [...box.querySelectorAll(".rv-slot")];
      if (slots.length && window.YLYReviews) {
        let reviewed = [];
        try {
          const c = await db.functions.invoke("submit-review", { body: { session_id: sessionId, check: true } });
          if (Array.isArray(c.data?.reviewed)) reviewed = c.data.reviewed;
        } catch (_) {}
        slots.forEach(s => {
          if (reviewed.includes(s.dataset.pid)) { s.remove(); return; }
          window.YLYReviews.widget(s, { db, sessionId, productId: s.dataset.pid, title: s.dataset.title });
        });
        // Link aus der Review-Mail (#review): zum ersten Bewertungs-Widget scrollen
        if (location.hash === "#review") {
          const first = box.querySelector(".rv-slot");
          if (first) setTimeout(() => { try { first.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (_) { first.scrollIntoView(); } }, 150);
        }
      }
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

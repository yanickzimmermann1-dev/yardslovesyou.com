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
      box.innerHTML = `
        <p class="eyebrow">ORDER CONFIRMED</p>
        <h1>Thank <span>you!</span></h1>
        <p class="muted">
          You purchased <strong style="color:var(--text)">${esc(data.product)}</strong> for
          <strong style="color:var(--text)">${price}</strong>.<br>
          Your download is ready.
        </p>
        <button class="button" id="get-download" type="button">Download ZIP</button>
        <p id="download-status" class="status"></p>
        <p class="muted">A confirmation with your download link has been sent to <strong style="color:var(--text)">${esc(data.email)}</strong>.<br>
        You can come back to this page any time to download your files again.</p>
        <a class="outline" href="shop.html">Back to shop</a>`;

      $("get-download").onclick = async () => {
        const btn = $("get-download"), status = $("download-status");
        btn.disabled = true;
        status.textContent = "Preparing download...";
        const r = await db.functions.invoke("download-zip", { body: { session_id: sessionId } });
        btn.disabled = false;
        if (r.error || !r.data?.url) {
          status.textContent = "Download not available: " + (r.data?.error || r.error?.message || "Please try again.");
          return;
        }
        status.textContent = "Your download is starting…";
        if (!/^https:\/\//i.test(String(r.data.url))) { status.textContent = "Download not available."; return; }
        location.href = r.data.url;
      };
      return;
    }

    // ---------- Dienstleistung (Upload) ----------
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
      <a class="button" href="index.html">Back to home</a>`;
  })();
});

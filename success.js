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
      <a class="button" href="upload.html">Back to upload</a>`;
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

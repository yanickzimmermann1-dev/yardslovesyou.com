document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.APP_CONFIG || {};
  const $ = id => document.getElementById(id);
  const root = $("st-root");
  const yearEl = $("year"); if (yearEl) yearEl.textContent = new Date().getFullYear();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ICON = {
    check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5.5 5h13L21 13v6H3v-6z"/></svg>',
    wave: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2"/></svg>',
    box: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/></svg>',
    star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    loop: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
    dl: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>',
  };
  const fmt = iso => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";

  const MAIL = "mailto:yardsyurr@gmail.com?subject=" + encodeURIComponent("Question about my order");
  const errorView = (title, text, retry) => {
    const actions = retry ? [{ label: "Retry", onClick: () => { root.textContent = "Loading …"; load(); } }, { label: "Contact us", href: MAIL }] : [{ label: "Contact us", href: MAIL }, { label: "Back to home", href: "index.html" }];
    if (window.YLYState) window.YLYState.render(root, { icon: retry ? "alert" : "link", error: !!retry, title, text, actions });
    else root.innerHTML = `<div class="st-card st-err"><h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><a class="button" href="index.html">Back to home</a></div>`;
  };

  const token = (new URLSearchParams(location.search).get("t") || new URLSearchParams(location.search).get("token") || "").trim();
  if (!token) return errorView("Open the link from your confirmation email", "This page needs the personal order link from your confirmation email or the page you saw after paying. Can't find it? Contact us and we'll resend it.");
  if (!UUID.test(token)) return errorView("Open the link from your confirmation email", "This link looks incomplete. Please open the full link from your email (copy it completely if it wrapped onto two lines), or contact us.");
  if (!window.supabase) return errorView("Something went wrong", "The page could not start. Please reload, or contact us if it keeps happening.", true);
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  const call = async body => {
    const { data, error } = await db.functions.invoke("order-status", { body: { token, ...body } }).catch(e => ({ data: null, error: e }));
    let msg = data?.error;
    if (!msg && error) {
      try { msg = (await error.context.json()).error; } catch (_) { msg = error.message; }
    }
    return { data: msg ? null : data, error: msg || null, notFound: error?.context?.status === 404 };
  };

  const STEPS = [["received", "Received", "inbox"], ["in_progress", "In progress", "wave"], ["delivered", "Delivered", "box"], ["completed", "Completed", "star"]];
  let last = null, justReviewed = false, scrolledToReview = false;
  const STAR = '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7 6.1 20.8l1.2-6.5L2.5 9.7l6.6-.9z"/></svg>';

  // "Rate your experience"-Karte (nur bei delivered/completed); Radios 5..1 + row-reverse, damit "~" die Sterne links vom Treffer faerbt
  function reviewCard(o) {
    if (o.progress !== "delivered" && o.progress !== "completed") return "";
    if (o.has_review || justReviewed) {
      return `<section class="st-card st-rate" id="review" tabindex="-1"><h3>${justReviewed ? "Thank you for your review!" : "Thanks for your review"}</h3><p class="muted" style="margin:0">${justReviewed ? "It will appear on the site once it has been checked." : "We really appreciate it."}</p></section>`;
    }
    const stars = [5, 4, 3, 2, 1].map(n => `<input type="radio" name="st-rate" id="st-rate-${n}" value="${n}" required><label for="st-rate-${n}" title="${n} star${n === 1 ? "" : "s"}"><span class="sr-only">${n} star${n === 1 ? "" : "s"}</span>${STAR}</label>`).join("");
    return `
      <section class="st-card st-rate" id="review" tabindex="-1">
        <h3>Rate your experience</h3>
        <p class="muted" style="margin:0">How did it go? Your feedback helps other artists.</p>
        <form class="st-form" id="st-rv-form">
          <fieldset class="st-stars"><legend class="sr-only">Rating</legend>${stars}</fieldset>
          <textarea id="st-rv-text" rows="4" maxlength="600" placeholder="Optional: tell us a bit about the result (max. 600 characters)"></textarea>
          <label class="st-lab" for="st-rv-name">Display name</label>
          <input id="st-rv-name" type="text" maxlength="40" required autocomplete="off" value="${esc((o.artist_name || "").slice(0, 40))}">
          <p class="st-consent">Your review may be shown on yardslovesyou.com (name + rating + text).</p>
          <div class="st-actions" style="margin:0"><button class="button" type="submit" id="st-rv-btn">Send review</button></div>
          <p class="st-msg" id="st-rv-msg" role="status"></p>
        </form>
      </section>`;
  }

  function render(o) {
    last = o;
    const inRev = o.progress === "revision";
    // Revision zaehlt als "In progress" mit Schleife
    const idx = inRev ? 1 : STEPS.findIndex(s => s[0] === o.progress);
    const left = Math.max(0, o.max_revisions - o.revisions_used);
    const ts = [o.paid_at || o.created_at, null, null, null];
    if (idx >= 1) ts[1] = o.progress === "in_progress" || inRev ? o.updated_at : null;
    if (idx >= 2 && o.progress === "delivered") ts[2] = o.updated_at;
    if (o.progress === "completed") ts[3] = o.updated_at;
    const steps = STEPS.map(([k, label, ic], i) => {
      const cls = o.progress === "completed" || i < idx ? "done" : i === idx ? (inRev ? "now rev" : "now") : "";
      const dot = cls.startsWith("done") ? ICON.check : ICON[inRev && i === 1 ? "loop" : ic];
      return `<li class="${cls}"><div class="dot">${dot}</div><div class="lbl">${label}${ts[i] ? `<span class="ts">${esc(fmt(ts[i]))}</span>` : ""}</div></li>`;
    }).join("");

    const delivered = o.progress === "delivered";
    root.innerHTML = `
      <section class="st-card">
        <h2>${esc(o.service)}</h2>
        <p class="st-meta"><span>${o.artist_name ? "For " + esc(o.artist_name) : ""}</span><span>Ordered ${esc(fmt(o.created_at))}</span><span class="st-badge ${o.progress === "completed" ? "done" : ""}">${esc(({ received: "Received", in_progress: "In progress", revision: "Revision in progress", delivered: "Delivered", completed: "Completed" })[o.progress] || o.progress)}</span></p>
        <ol class="tk" aria-label="Order progress">${steps}</ol>
        ${inRev ? `<div class="st-loop">${ICON.loop}<span>Your revision request is being worked on. You'll get an email when the new version is ready.</span></div>` : ""}
        ${o.admin_note ? `<div class="st-note"><small>Note from YARDSLOVESYOU</small>${esc(o.admin_note)}</div>` : ""}
        ${o.download_url ? `<div class="st-actions"><a class="button" id="st-dl" href="${esc(o.download_url)}" rel="noopener">${ICON.dl}<span>Download your files</span></a></div>` : ""}
      </section>
      ${delivered ? `
      <section class="st-card">
        <h3>Happy with the result?</h3>
        <div class="st-actions"><button class="button" id="st-approve" type="button">${ICON.check}<span>Approve – I'm happy</span></button></div>
        ${left > 0 ? `
        <h3 style="margin-top:22px">Request a revision</h3>
        <p class="muted" style="margin:0">${left} of ${o.max_revisions} revision${left === 1 ? "" : "s"} left. Describe what you'd like changed.</p>
        <form class="st-form" id="st-rev-form">
          <textarea id="st-rev" rows="4" maxlength="1000" required placeholder="e.g. Vocals a bit louder, less bass in the intro"></textarea>
          <div class="st-actions" style="margin:0"><button class="outline" type="submit" id="st-rev-btn">Send revision request</button></div>
        </form>` : `<p class="muted">All included revisions have been used. Reply to your order email if you need anything else.</p>`}
        <p class="st-msg" id="st-msg" role="status"></p>
      </section>` : ""}
      ${reviewCard(o)}
      <p class="st-hint">${ICON.info}<span>Bookmark this page: it's your personal order link. This page refreshes automatically, and we'll also email you at every step.</span></p>`;

    const msg = (t, bad) => { const m = $("st-msg"); if (m) { m.textContent = t; m.classList.toggle("danger", !!bad); } };
    const ap = $("st-approve");
    if (ap) ap.onclick = async () => {
      ap.disabled = true; msg("Saving …");
      const r = await call({ approve: true });
      if (r.error) { ap.disabled = false; return msg(r.error, true); }
      load();
    };
    const rf = $("st-rv-form");
    if (rf) rf.onsubmit = async e => {
      e.preventDefault();
      const rm = (t, bad) => { const m = $("st-rv-msg"); if (m) { m.textContent = t; m.classList.toggle("danger", !!bad); } };
      const pick = rf.querySelector('input[name="st-rate"]:checked');
      const name = $("st-rv-name").value.trim();
      if (!pick) return rm("Please choose a star rating.", true);
      if (!name) return rm("Please enter a display name.", true);
      $("st-rv-btn").disabled = true; rm("Sending …");
      const r = await call({ review: { rating: +pick.value, body: $("st-rv-text").value.trim(), name: name.slice(0, 40) } });
      if (r.error) {
        if (/already reviewed/i.test(r.error)) { last.has_review = true; return render(last); }
        $("st-rv-btn").disabled = false; return rm(r.error, true);
      }
      justReviewed = true; render(last);
    };
    if (!scrolledToReview && location.hash === "#review") {
      const card = $("review");
      if (card) { scrolledToReview = true; card.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
    const f = $("st-rev-form");
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const text = $("st-rev").value.trim();
      if (!text) return msg("Please describe what you'd like changed.", true);
      $("st-rev-btn").disabled = true; msg("Sending …");
      const r = await call({ revision: text });
      if (r.error) { $("st-rev-btn").disabled = false; return msg(r.error, true); }
      load();
    };
  }

  async function load(silent) {
    const r = await call({});
    if (r.error || !r.data) {
      if (silent && last) return;
      return errorView(r.notFound ? "Order not found" : "Couldn't load your order", r.notFound ? "We couldn't find an order for this link. Open the link from your confirmation email, or contact us." : "Please try again in a moment.", !r.notFound);
    }
    render(r.data);
  }

  load();
  setInterval(() => {
    if (document.hidden) return;
    const rvPick = document.querySelector('input[name="st-rate"]:checked');
    const typing = ($("st-rev") && $("st-rev").value.trim()) || ($("st-rv-text") && $("st-rv-text").value.trim()) || rvPick;
    if (!typing) load(true);
  }, 60000);
});

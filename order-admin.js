(async () => {
  const { db, $, esc, me, loginUrl } = window.YLY;
  const m = await me();
  if (!m) { location.href = loginUrl(); return; }
  if (!m.admin) { $("oa-guard").textContent = "No access. This page is for admins only."; return; }
  $("oa-guard").classList.add("hidden"); $("oa-body").classList.remove("hidden");

  const LABEL = { received: "Received", in_progress: "In progress", revision: "Revision", delivered: "Delivered", completed: "Completed" };
  const S = (el, o) => { if (window.YLYState) window.YLYState.render(el, Object.assign({ compact: true }, o)); else el.textContent = (o.title || "") + " " + (o.text || ""); };
  let orders = [], filter = "open";
  const status = (t, bad) => { const el = $("oa-status"); el.textContent = t; el.classList.toggle("danger", !!bad); };
  const fmt = iso => iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

  async function call(body) {
    const { data, error } = await db.functions.invoke("order-admin", { body });
    let msg = data?.error;
    if (!msg && error) { try { msg = (await error.context.json()).error; } catch (_) { msg = error.message; } }
    if (msg) throw new Error(msg);
    return data;
  }

  const visible = () => orders.filter(o =>
    filter === "all" ? true
    : filter === "open" ? ["received", "in_progress", "revision"].includes(o.progress)
    : o.progress === filter);

  function render() {
    const list = visible();
    $("oa-list").innerHTML = list.length ? list.map(o => `
      <article class="oa-card" data-id="${esc(o.id)}">
        <div class="oa-head"><strong>${esc(o.artist_name || "Unknown")} · ${esc(o.service)}</strong>
          ${o.rush ? `<span class="st-badge">RUSH 48h</span>` : ""}<span class="st-badge ${o.progress === "completed" ? "done" : ""}">${esc(LABEL[o.progress] || o.progress)}</span></div>
        <p class="oa-sub">${esc(o.email)}<br>Ordered ${esc(fmt(o.created_at))} · ${o.status === "complete" ? "Paid " + esc(fmt(o.paid_at)) : "Payment: " + esc(o.status || "unknown")} · Revisions ${+o.revisions_used || 0}/${+o.max_revisions || 2}</p>
        <p class="oa-sub"><strong>${+o.songs || 1} song${(+o.songs || 1) === 1 ? "" : "s"}</strong>${o.rush ? ` · <strong class="danger">RUSH 48h</strong>${o.paid_at ? " (due 48h after " + esc(fmt(o.paid_at)) + ")" : ""}` : ""}</p>
        ${o.revision_note && o.progress === "revision" ? `<div class="oa-rev"><strong>Revision request:</strong>\n${esc(o.revision_note)}</div>` : ""}
        <div class="oa-row">
          <select class="oa-prog" aria-label="Progress">${Object.entries(LABEL).map(([k, v]) => `<option value="${k}"${k === o.progress ? " selected" : ""}>${v}</option>`).join("")}</select>
          <textarea class="oa-note" rows="2" maxlength="1000" placeholder="Note for the customer (shown on the status page and emailed)">${esc(o.admin_note || "")}</textarea>
        </div>
        <div class="oa-acts">
          <button type="button" class="button" data-a="save">Save and email customer</button>
          <button type="button" class="outline" data-a="upload">Upload delivery</button>
          <input type="file" class="oa-file" aria-label="Delivery file">
          ${o.file_url ? `<a class="outline" href="${esc(o.file_url)}" rel="noopener">Download customer file</a>` : ""}
          <button type="button" class="outline" data-a="copy" data-link="${esc(o.status_link)}">Copy status link</button>
        </div>
        <p class="status oa-msg" role="status"></p>
      </article>`).join("") : "";
    if (!list.length) S($("oa-list"), { icon: "box", title: "No orders in this view", text: "Nothing matches this filter right now.", actions: filter === "all" ? [{ label: "Reload", onClick: () => load() }] : [{ label: "Show all orders", onClick: () => { const b = document.querySelector('#oa-filters [data-f="all"]'); if (b) b.click(); } }, { label: "Reload", onClick: () => load() }] });
  }

  async function load() {
    status("Loading …");
    try { orders = (await call({ action: "list" })).orders || []; status(""); render(); }
    catch (e) { status(e.message, true); S($("oa-list"), { icon: "alert", error: true, title: "Orders could not be loaded", text: e.message || "Please try again.", actions: [{ label: "Retry", onClick: () => load() }] }); }
  }

  $("oa-filters").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll("#oa-filters button").forEach(x => x.classList.toggle("active", x === b));
    render();
  });
  $("oa-reload").addEventListener("click", load);

  $("oa-list").addEventListener("click", async e => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const card = b.closest(".oa-card"), id = card.dataset.id, msg = card.querySelector(".oa-msg");
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle("danger", !!bad); };
    if (b.dataset.a === "copy") {
      try { await navigator.clipboard.writeText(b.dataset.link); say("Link copied."); } catch (_) { say(b.dataset.link); }
    } else if (b.dataset.a === "save") {
      b.disabled = true; say("Saving …");
      try {
        const r = await call({ action: "update", id, progress: card.querySelector(".oa-prog").value, admin_note: card.querySelector(".oa-note").value });
        say(r.mailed ? "Saved. Customer notified by email." : "Saved. Email could not be sent.", !r.mailed);
        const o = orders.find(x => x.id === id);
        if (o) { o.progress = card.querySelector(".oa-prog").value; o.admin_note = card.querySelector(".oa-note").value; }
      } catch (err) { say(err.message, true); }
      b.disabled = false;
    } else if (b.dataset.a === "upload") {
      card.querySelector(".oa-file").click();
    }
  });

  $("oa-list").addEventListener("change", async e => {
    const inp = e.target.closest(".oa-file"); if (!inp || !inp.files[0]) return;
    const card = inp.closest(".oa-card"), id = card.dataset.id, msg = card.querySelector(".oa-msg"), file = inp.files[0];
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle("danger", !!bad); };
    if (!confirm(`Upload "${file.name}" and mark this order as delivered? The customer will be emailed.`)) { inp.value = ""; return; }
    say("Preparing upload …");
    try {
      const up = await call({ action: "upload-url", id, filename: file.name });
      say("Uploading " + file.name + " …");
      const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", file);   // wie supabase-js uploadToSignedUrl
      const res = await fetch(up.signed_url, { method: "PUT", headers: { "x-upsert": "false" }, body: fd });
      if (!res.ok) throw new Error("Upload failed (" + res.status + ").");
      const r = await call({ action: "deliver", id, path: up.path });
      say(r.mailed ? "Delivered. Customer notified by email." : "Delivered. Email could not be sent.", !r.mailed);
      const o = orders.find(x => x.id === id); if (o) o.progress = "delivered";
    } catch (err) { say(err.message, true); }
    inp.value = "";
  });

    // ---------- Reviews ----------
  let reviews = [], rvFilter = "pending", rvLoaded = false;
  let svReviews = [], svFilter = "pending";
  const rvStatus = (t, bad) => { const el = $("rv-status"); el.textContent = t; el.classList.toggle("danger", !!bad); };
  const RV_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
  const RV_CLASS = { pending: "", approved: "done", rejected: "bad" };

  function rvCount() {
    const np = reviews.filter(r => r.status === "pending").length, ns = svReviews.filter(r => r.status === "pending").length, el = $("rv-pending");
    el.textContent = np + ns; el.hidden = !(np + ns);
    const a = $("rk-product-n"), b = $("rk-service-n");
    a.textContent = np; a.hidden = !np; b.textContent = ns; b.hidden = !ns;
  }
  function renderReviews() {
    const list = reviews.filter(r => r.status === rvFilter);
    $("rv-list").innerHTML = list.length ? list.map(r => `
      <article class="oa-card" data-id="${esc(r.id)}">
        <div class="oa-head"><span>${window.YLYReviews.stars(r.rating, 18)}</span>
          <span class="st-badge ${RV_CLASS[r.status] || ""}">${esc(RV_LABEL[r.status] || r.status)}</span></div>
        <p class="oa-sub">${esc(r.product_title)}<br>${esc(r.display_name)} · ${esc(fmt(r.created_at))}</p>
        ${r.title || r.body ? `<div class="rv-adm-body">${r.title ? `<strong>${esc(r.title)}</strong>` : ""}${esc(r.body || "")}</div>` : '<p class="oa-sub">No text, rating only.</p>'}
        <div class="oa-acts">
          <button type="button" class="button" data-r="approved"${r.status === "approved" ? " disabled" : ""}>Approve</button>
          <button type="button" class="outline" data-r="rejected"${r.status === "rejected" ? " disabled" : ""}>Reject</button>
        </div>
        <p class="status oa-msg" role="status"></p>
      </article>`).join("") : "";
    if (!list.length) S($("rv-list"), { icon: "star", title: "No " + RV_LABEL[rvFilter].toLowerCase() + " reviews", text: "Nothing to show in this view right now.", actions: [{ label: "Reload", onClick: () => loadReviews() }] });
  }
  async function loadReviews() {
    rvStatus("Loading …");
    try { reviews = (await call({ action: "reviews-list" })).reviews || []; rvLoaded = true; rvStatus(""); rvCount(); renderReviews(); }
    catch (e) { rvStatus(e.message, true); S($("rv-list"), { icon: "alert", error: true, title: "Reviews could not be loaded", text: e.message || "Please try again.", actions: [{ label: "Retry", onClick: () => loadReviews() }] }); }
  }

  // ---------- Service reviews (service_reviews) ----------
  const svStatus = (t, bad) => { const el = $("sv-status"); el.textContent = t; el.classList.toggle("danger", !!bad); };
  function renderServiceReviews() {
    const list = svReviews.filter(r => r.status === svFilter);
    $("sv-list").innerHTML = list.length ? list.map(r => `
      <article class="oa-card" data-id="${esc(r.id)}">
        <div class="oa-head"><span>${window.YLYReviews.stars(r.rating, 18)}</span>
          <span class="st-badge ${RV_CLASS[r.status] || ""}">${esc(RV_LABEL[r.status] || r.status)}</span></div>
        <p class="oa-sub">${esc(r.service || "Service")}<br>${esc(r.display_name)} · ${esc(fmt(r.created_at))}</p>
        ${r.body ? `<div class="rv-adm-body">${esc(r.body)}</div>` : '<p class="oa-sub">No text, rating only.</p>'}
        <div class="oa-acts">
          <button type="button" class="button" data-s="approved"${r.status === "approved" ? " disabled" : ""}>Approve</button>
          <button type="button" class="outline" data-s="rejected"${r.status === "rejected" ? " disabled" : ""}>Reject</button>
        </div>
        <p class="status oa-msg" role="status"></p>
      </article>`).join("") : "";
    if (!list.length) S($("sv-list"), { icon: "star", title: "No " + RV_LABEL[svFilter].toLowerCase() + " service reviews", text: "Nothing to show in this view right now.", actions: [{ label: "Reload", onClick: () => loadServiceReviews() }] });
  }
  async function loadServiceReviews() {
    svStatus("Loading …");
    try { svReviews = (await call({ action: "service-reviews-list" })).reviews || []; svStatus(""); rvCount(); renderServiceReviews(); }
    catch (e) { svStatus(e.message, true); S($("sv-list"), { icon: "alert", error: true, title: "Service reviews could not be loaded", text: e.message || "Please try again.", actions: [{ label: "Retry", onClick: () => loadServiceReviews() }] }); }
  }
  $("rk-toggle").addEventListener("click", e => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    const sv = b.dataset.k === "service";
    $("rv-product").classList.toggle("hidden", sv); $("rv-service").classList.toggle("hidden", !sv);
    document.querySelectorAll("#rk-toggle button").forEach(x => x.classList.toggle("active", x === b));
  });
  $("sv-filters").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    svFilter = b.dataset.f;
    document.querySelectorAll("#sv-filters button").forEach(x => x.classList.toggle("active", x === b));
    renderServiceReviews();
  });
  $("sv-reload").addEventListener("click", loadServiceReviews);
  $("sv-list").addEventListener("click", async e => {
    const b = e.target.closest("[data-s]"); if (!b) return;
    const card = b.closest(".oa-card"), id = Number(card.dataset.id), msg = card.querySelector(".oa-msg");
    b.disabled = true; msg.textContent = "Saving …"; msg.classList.remove("danger");
    try {
      await call({ action: "service-review-set", id, status: b.dataset.s });
      const r = svReviews.find(x => x.id === id); if (r) r.status = b.dataset.s;
      rvCount(); renderServiceReviews();
    } catch (err) { msg.textContent = err.message; msg.classList.add("danger"); b.disabled = false; }
  });

  // ---------- Custom Beat Inquiries ----------
  let inquiries = [], iqFilter = "all", iqLoaded = false;
  const iqStatus = (t, bad) => { const el = $("iq-status"); el.textContent = t; el.classList.toggle("danger", !!bad); };
  const IQ_LABEL = { new: "New", contacted: "Contacted", quoted: "Quoted", won: "Won", lost: "Lost", archived: "Archived" };
  const IQ_CLASS = { new: "", contacted: "", quoted: "", won: "done", lost: "bad", archived: "" };
  const IQ_OPEN = ["new", "contacted", "quoted"];
  const iqVisible = () => inquiries.filter(q => iqFilter === "all" ? true : iqFilter === "open" ? IQ_OPEN.includes(q.status) : q.status === iqFilter);
  const iqLinks = txt => String(txt || "").split(/[\s,]+/).filter(Boolean).map(t =>
    /^https?:\/\/[^\s<>"']+$/i.test(t) ? `<a href="${esc(t)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>` : esc(t)).join("<br>");

  function iqCount() {
    const n = inquiries.filter(q => q.status === "new").length, el = $("iq-new");
    el.textContent = n; el.hidden = !n;
  }
  function renderInquiries() {
    const list = iqVisible();
    $("iq-list").innerHTML = list.length ? list.map(q => `
      <article class="oa-card" data-id="${esc(q.id)}">
        <div class="oa-head"><strong>${esc(q.name || "Unknown")}</strong>
          <span class="st-badge ${IQ_CLASS[q.status] || ""}">${esc(IQ_LABEL[q.status] || q.status)}</span></div>
        <p class="oa-sub"><a href="mailto:${esc(q.email)}?subject=${encodeURIComponent("Your custom beat – YARDSLOVESYOU")}">${esc(q.email)}</a><br>Received ${esc(fmt(q.created_at))} · Budget: ${esc(q.budget || "-")} · Deadline: ${esc(q.deadline || "-")}</p>
        <div class="rv-adm-body">${esc(q.description || "")}</div>
        ${q.reference_links ? `<p class="oa-sub"><strong>References:</strong><br>${iqLinks(q.reference_links)}</p>` : ""}
        <div class="oa-row">
          <select class="oa-prog" aria-label="Status">${Object.entries(IQ_LABEL).map(([k, v]) => `<option value="${k}"${k === q.status ? " selected" : ""}>${v}</option>`).join("")}</select>
          <textarea class="oa-note" rows="2" maxlength="1000" placeholder="Internal note (not sent to the customer)">${esc(q.admin_note || "")}</textarea>
        </div>
        <div class="oa-acts"><button type="button" class="button" data-i="save">Save</button></div>
        <p class="status oa-msg" role="status"></p>
      </article>`).join("") : "";
    if (!list.length) S($("iq-list"), { icon: "box", title: "No inquiries in this view", text: "Nothing matches this filter right now.", actions: [{ label: "Reload", onClick: () => loadInquiries() }] });
  }
  async function loadInquiries() {
    iqStatus("Loading …");
    try { inquiries = (await call({ action: "inquiries-list" })).inquiries || []; iqLoaded = true; iqStatus(""); iqCount(); renderInquiries(); }
    catch (e) { iqStatus(e.message, true); S($("iq-list"), { icon: "alert", error: true, title: "Inquiries could not be loaded", text: e.message || "Please try again.", actions: [{ label: "Retry", onClick: () => loadInquiries() }] }); }
  }
  $("iq-filters").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    iqFilter = b.dataset.f;
    document.querySelectorAll("#iq-filters button").forEach(x => x.classList.toggle("active", x === b));
    renderInquiries();
  });
  $("iq-reload").addEventListener("click", loadInquiries);
  $("iq-list").addEventListener("click", async e => {
    const b = e.target.closest("[data-i]"); if (!b) return;
    const card = b.closest(".oa-card"), id = card.dataset.id, msg = card.querySelector(".oa-msg");
    b.disabled = true; msg.textContent = "Saving …"; msg.classList.remove("danger");
    try {
      const r = await call({ action: "inquiry-set", id, status: card.querySelector(".oa-prog").value, admin_note: card.querySelector(".oa-note").value });
      const i = inquiries.findIndex(x => x.id === id); if (i > -1 && r.inquiry) inquiries[i] = r.inquiry;
      iqCount(); renderInquiries();
      const c2 = $("iq-list").querySelector(`.oa-card[data-id="${CSS.escape(id)}"] .oa-msg`); if (c2) c2.textContent = "Saved.";
    } catch (err) { msg.textContent = err.message; msg.classList.add("danger"); b.disabled = false; }
  });
  // ---------- Stats ----------
  let sxLoaded = false, sxBusy = false;
  const sxStatus = (t, bad) => { const el = $("sx-status"); el.textContent = t; el.classList.toggle("danger", !!bad); };
  const chf = n => n == null ? "n/a" : "CHF " + String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u2019");
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mlabel = ym => MON[(+String(ym).slice(5, 7) || 1) - 1] || ym;
  const kpi = (label, val, sub) => `<div class="sx-kpi"><small>${esc(label)}</small><strong>${esc(val)}</strong>${sub ? `<span>${esc(sub)}</span>` : ""}</div>`;
  const rows = pairs => `<ul class="sx-list">${pairs.map(p => `<li><span>${esc(p[0])}</span><strong>${esc(p[1])}</strong></li>`).join("")}</ul>`;
  const num = v => v == null ? "n/a" : String(v);

  function renderStats(d) {
    const t = d.totals || {}, tm = t.this_month || {}, months = d.months || [];
    const stripe = d.source === "stripe";
    $("sx-note").textContent = stripe ? "Revenue from Stripe (paid checkouts, last 12 months)." : "Revenue calculated from the price formula (shop revenue unavailable).";
    const peak = Math.max(1, ...months.map(m => (m.service_revenue || 0) + (m.shop_revenue || 0)));
    const chart = months.map(m => {
      const sv = m.service_revenue || 0, sh = m.shop_revenue || 0, tot = sv + sh, h = Math.round(tot / peak * 100);
      const title = `${m.ym}: ${chf(tot)} (services ${chf(sv)}${m.shop_revenue == null ? "" : ", shop " + chf(sh)}) - ${m.service_orders} service / ${m.shop_orders} shop orders`;
      return `<div class="sx-col" title="${esc(title)}" role="img" aria-label="${esc(title)}"><div class="sx-bar" style="height:${h}%">${sh ? `<i class="sh" style="flex:${sh}"></i>` : ""}${sv ? `<i class="sv" style="flex:${sv}"></i>` : ""}</div></div>`;
    }).join("");
    const svcRows = (d.by_service || []).map(b => `<tr><td>${esc(b.service)}</td><td>${+b.orders || 0}</td><td>${+b.songs || 0}</td><td>${+b.rush_count || 0}</td><td>${esc(chf(b.revenue))}</td></tr>`).join("");
    const iq = d.inquiries, rv = d.reviews, stars = a => a == null ? "-" : a.toFixed(1) + " / 5";
    $("sx-body").innerHTML = `
      <div class="sx-kpis">
        ${kpi("Revenue this month", chf(tm.revenue), stripe ? "Services " + chf(tm.service_revenue) + " / Shop " + chf(tm.shop_revenue) : "Services only")}
        ${kpi("Orders this month", num(tm.orders), (tm.service_orders || 0) + " service" + (stripe ? " / " + (tm.shop_orders || 0) + " shop" : ""))}
        ${kpi("Open orders", num(d.open_orders), (d.awaiting_payment || 0) + " awaiting payment (30 days)")}
        ${kpi("Avg order value", chf(d.avg_order_value), "Service orders")}
        ${kpi("Rush share", (+d.rush_share || 0) + " %", (d.ep_orders || 0) + " EP orders (4+ songs)")}
        ${kpi("Subscribers", d.subscribers ? num(d.subscribers.total_consented) : "n/a", "With marketing consent")}
      </div>
      <div class="sx-card"><h2>Revenue per month</h2>
        <div class="sx-chart">${chart}</div>
        <div class="sx-months">${months.map(m => `<span>${esc(mlabel(m.ym))}</span>`).join("")}</div>
        <div class="sx-legend"><span><b style="background:var(--purple)"></b>Services</span><span><b style="background:var(--pink)"></b>Shop</span><span>Last 30 days: ${esc(chf((t.last_30_days || {}).revenue))}</span><span>${stripe ? "Last 12 months" : "All time"}: ${esc(chf((t.all_time || {}).revenue))}</span></div>
      </div>
      <div class="sx-card"><h2>By service${stripe ? " (last 12 months)" : ""}</h2>
        ${svcRows ? `<div class="sx-wrap"><table class="sx-tbl"><thead><tr><th>Service</th><th>Orders</th><th>Songs</th><th>Rush</th><th>Revenue</th></tr></thead><tbody>${svcRows}</tbody></table></div>` : '<p class="sx-note">No paid orders yet.</p>'}
      </div>
      <div class="sx-boxes">
        <div class="sx-card"><h2>Custom beat inquiries</h2>${iq ? rows([["New", iq.new], ["Open", iq.open], ["Won", iq.won], ["Lost", iq.lost]]) : '<p class="sx-note">Not available.</p>'}</div>
        <div class="sx-card"><h2>Reviews</h2>${rv ? rows([["Service rating", stars(rv.service_avg) + (rv.service_count != null ? " (" + rv.service_count + ")" : "")], ["Product rating", stars(rv.product_avg) + (rv.product_count != null ? " (" + rv.product_count + ")" : "")], ["Pending", rv.pending]]) : '<p class="sx-note">Not available.</p>'}</div>
      </div>`;
  }
  window.YLYStatsRender = renderStats;
  async function loadStats() {
    if (sxBusy) return; sxBusy = true;
    sxStatus("Loading ...");
    try { renderStats(await call({ action: "stats" })); sxLoaded = true; sxStatus(""); }
    catch (e) { sxStatus(e.message, true); S($("sx-body"), { icon: "alert", error: true, title: "Statistics could not be loaded", text: e.message || "Please try again.", actions: [{ label: "Retry", onClick: () => loadStats() }] }); }
    sxBusy = false;
  }
  $("sx-reload").addEventListener("click", loadStats);

  function tab(name) {
    const rv = name === "reviews", iq = name === "inquiries", sx = name === "stats";
    $("oa-orders").classList.toggle("hidden", rv || iq || sx);
    $("oa-stats").classList.toggle("hidden", !sx);
    $("oa-reviews").classList.toggle("hidden", !rv);
    $("oa-inquiries").classList.toggle("hidden", !iq);
    document.querySelectorAll("#oa-tabs button").forEach(b => {
      const on = b.dataset.tab === name; b.classList.toggle("active", on); b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (rv && !rvLoaded) { loadReviews(); loadServiceReviews(); }
    if (iq && !iqLoaded) loadInquiries();
    if (sx && !sxLoaded) loadStats();
  }
  $("oa-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab(b.dataset.tab);
    try { history.replaceState(null, "", b.dataset.tab === "reviews" ? "#reviews" : b.dataset.tab === "inquiries" ? "#inquiries" : b.dataset.tab === "stats" ? "#stats" : location.pathname + location.search); } catch (_) {}
  });
  $("rv-filters").addEventListener("click", e => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    rvFilter = b.dataset.f;
    document.querySelectorAll("#rv-filters button").forEach(x => x.classList.toggle("active", x === b));
    renderReviews();
  });
  $("rv-reload").addEventListener("click", loadReviews);
  $("rv-list").addEventListener("click", async e => {
    const b = e.target.closest("[data-r]"); if (!b) return;
    const card = b.closest(".oa-card"), id = Number(card.dataset.id), msg = card.querySelector(".oa-msg");
    b.disabled = true; msg.textContent = "Saving …"; msg.classList.remove("danger");
    try {
      await call({ action: "review-set", id, status: b.dataset.r });
      const r = reviews.find(x => x.id === id); if (r) r.status = b.dataset.r;
      rvCount(); renderReviews();
    } catch (err) { msg.textContent = err.message; msg.classList.add("danger"); b.disabled = false; }
  });
  window.addEventListener("hashchange", () => { if (location.hash === "#reviews") tab("reviews"); else if (location.hash === "#inquiries") tab("inquiries"); else if (location.hash === "#stats") tab("stats"); });
  if (location.hash === "#reviews") tab("reviews"); else { loadReviews(); loadServiceReviews(); if (location.hash === "#inquiries") tab("inquiries"); else if (location.hash === "#stats") tab("stats"); }

  load();
})();

(async () => {
  const { db, $, esc, me, loginUrl } = window.YLY;
  const m = await me();
  if (!m) { location.href = loginUrl(); return; }
  if (!m.admin) { $("oa-guard").textContent = "No access. This page is for admins only."; return; }
  $("oa-guard").classList.add("hidden"); $("oa-body").classList.remove("hidden");

  const LABEL = { received: "Received", in_progress: "In progress", revision: "Revision", delivered: "Delivered", completed: "Completed" };
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
          <span class="st-badge ${o.progress === "completed" ? "done" : ""}">${esc(LABEL[o.progress] || o.progress)}</span></div>
        <p class="oa-sub">${esc(o.email)}<br>Ordered ${esc(fmt(o.created_at))} · ${o.status === "complete" ? "Paid " + esc(fmt(o.paid_at)) : "Payment: " + esc(o.status || "unknown")} · Revisions ${+o.revisions_used || 0}/2</p>
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
      </article>`).join("") : '<div class="empty">No orders in this view.</div>';
  }

  async function load() {
    status("Loading …");
    try { orders = (await call({ action: "list" })).orders || []; status(""); render(); }
    catch (e) { status(e.message, true); }
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

  load();
})();

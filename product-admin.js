/* product-admin.js - Produkt-Editor fuer Admins (vanilla JS, CSP-konform).
   Liest/schreibt shop_products direkt mit der Session des Admins. Schutz liegt in der Datenbank (RLS mit is_admin(),
   siehe 21-product-admin.sql); die Admin-Pruefung hier im Browser ist nur Komfort.
   Die Formularfelder entstehen aus den echten Spalten der Zeile (Typ des Werts), so passt der Editor zu jedem Schema. */
(async () => {
  const { db, $, esc, me, loginUrl } = window.YLY;
  const m = await me();
  if (!m) { location.href = loginUrl(); return; }
  if (!m.admin) { $("oa-guard").textContent = "No access. This page is for admins only."; return; }
  $("oa-guard").classList.add("hidden"); $("pa-body").classList.remove("hidden");

  const READONLY = ["id", "created_at", "updated_at"];
  const MAIN = ["title", "price_cents", "currency", "published", "badge", "description", "long_description", "image_url"];
  const LONG = ["description", "long_description"];
  const LINES = ["gallery", "features"];
  let rows = [], cur = null, orig = null, dirty = false;

  const status = (t, bad) => { const el = $("pa-status"); el.textContent = t || ""; el.classList.toggle("danger", !!bad); };
  const money = (c, cur2) => { try { return (c / 100).toLocaleString("de-CH", { style: "currency", currency: String(cur2 || "chf").toUpperCase() }); } catch (_) { return (c / 100).toFixed(2); } };
  const label = k => k === "price_cents" ? "Price" : k.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
  const kindOf = (k, v) => {
    if (READONLY.includes(k)) return "ro";
    if (k === "price_cents") return "price";
    if (typeof v === "boolean") return "bool";
    if (LINES.includes(k) && (v == null || (Array.isArray(v) && v.every(x => typeof x === "string")))) return "lines";
    if (Array.isArray(v) && v.length && v.every(x => typeof x === "string")) return "lines";
    if (v !== null && typeof v === "object") return "json";
    if (typeof v === "number") return "number";
    if (LONG.includes(k) || (typeof v === "string" && (v.length > 120 || v.includes("\n")))) return "area";
    return "text";
  };
  const asInput = (kind, v) => {
    if (kind === "price") return v == null ? "" : (Number(v) / 100).toFixed(2);
    if (kind === "lines") return Array.isArray(v) ? v.join("\n") : "";
    if (kind === "json") return v == null ? "" : JSON.stringify(v, null, 2);
    return v == null ? "" : String(v);
  };

  async function load(keepId) {
    status("Loading …");
    const { data, error } = await db.from("shop_products").select("*").order("created_at", { ascending: false });
    if (error) { status("Could not load products: " + error.message, true); return; }
    rows = data || [];
    status(rows.length + " product" + (rows.length === 1 ? "" : "s"));
    renderList();
    const keep = keepId && rows.find(r => String(r.id) === String(keepId));
    if (keep) openEdit(keep, true); else if (!cur) $("pa-edit").innerHTML = '<p class="muted">Choose a product to edit.</p>';
  }

  function renderList() {
    $("pa-list").innerHTML = rows.map(r => `
      <li class="pa-row${cur && String(cur.id) === String(r.id) ? " active" : ""}">
        <button type="button" class="pa-pick" data-id="${esc(r.id)}">
          <strong>${esc(r.title || "(untitled)")}</strong>
          <span>${esc(money(r.price_cents, r.currency))}</span>
        </button>
        <span class="pa-badge ${r.published ? "on" : "off"}">${r.published ? "Live" : "Hidden"}</span>
        <button type="button" class="outline pa-tog" data-id="${esc(r.id)}">${r.published ? "Hide" : "Publish"}</button>
      </li>`).join("") || '<li class="muted">No products yet.</li>';
  }

  function field(k, v) {
    const kind = kindOf(k, v), id = "pf-" + k, val = asInput(kind, v), lab = kind === "price" ? "Price (" + String(cur.currency || "chf").toUpperCase() + ")" : label(k);
    let ctl;
    if (kind === "ro") ctl = `<input id="${id}" type="text" value="${esc(val)}" readonly>`;
    else if (kind === "bool") ctl = `<input id="${id}" type="checkbox" ${v ? "checked" : ""}>`;
    else if (kind === "price") ctl = `<input id="${id}" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(val)}">`;
    else if (kind === "number") ctl = `<input id="${id}" type="number" step="any" value="${esc(val)}">`;
    else if (kind === "lines") ctl = `<textarea id="${id}" rows="4" placeholder="One entry per line">${esc(val)}</textarea>`;
    else if (kind === "json") ctl = `<textarea id="${id}" rows="8" class="pa-json" spellcheck="false">${esc(val)}</textarea>`;
    else if (kind === "area") ctl = `<textarea id="${id}" rows="${k === "long_description" ? 10 : 4}">${esc(val)}</textarea>`;
    else ctl = `<input id="${id}" type="text" value="${esc(val)}">`;
    return `<div class="pa-f${kind === "bool" ? " pa-bool" : ""}" data-k="${esc(k)}" data-kind="${kind}"><label for="${id}">${esc(lab)}</label>${ctl}</div>`;
  }

  function openEdit(row, silent) {
    if (!silent && dirty && !confirm("You have unsaved changes. Discard them?")) return;
    cur = row; orig = JSON.parse(JSON.stringify(row)); dirty = false;
    const keys = Object.keys(row);
    const main = MAIN.filter(k => keys.includes(k));
    const rest = keys.filter(k => !MAIN.includes(k) && !READONLY.includes(k));
    const ro = READONLY.filter(k => keys.includes(k));
    const url = window.YLYProducts ? window.YLYProducts.url(row.id) : "product.html?id=" + encodeURIComponent(row.id);
    $("pa-edit").innerHTML = `
      <h2>${esc(row.title || "(untitled)")}</h2>
      <p class="pa-links"><a href="${esc(url)}" target="_blank" rel="noopener">View page</a></p>
      <form id="pa-form" novalidate>
        ${main.map(k => field(k, row[k])).join("")}
        ${rest.length ? `<details class="pa-adv"><summary>More fields (${rest.length})</summary>${rest.map(k => field(k, row[k])).join("")}</details>` : ""}
        ${ro.length ? `<details class="pa-adv"><summary>Read only</summary>${ro.map(k => field(k, row[k])).join("")}</details>` : ""}
        <div class="pa-actions">
          <button type="submit" class="button" id="pa-save">Save changes</button>
          <button type="button" class="outline" id="pa-dup">Duplicate as draft</button>
        </div>
        <p class="status" id="pa-msg" role="status"></p>
        <p class="muted pa-hint">Changes are live on the product page right away. For titles, prices and descriptions in search results and previews, run <code>python3 tools/gen-product-pages.py</code> afterwards and push.</p>
      </form>`;
    renderList();
  }

  // Formularwerte -> JSON-Werte; liefert nur geaenderte Felder
  function collect() {
    const out = {}, errs = [];
    document.querySelectorAll("#pa-form .pa-f").forEach(w => {
      const k = w.dataset.k, kind = w.dataset.kind;
      if (kind === "ro") return;
      const el = w.querySelector("input,textarea"), o = orig[k];
      let v;
      if (kind === "bool") v = el.checked;
      else if (kind === "price") {
        if (el.value.trim() === "") { errs.push("Price is required."); return; }
        const n = Number(String(el.value).replace(",", "."));
        if (!isFinite(n) || n < 0) { errs.push("Price must be 0 or more."); return; }
        v = Math.round(n * 100);
      } else if (kind === "number") v = el.value.trim() === "" ? null : Number(el.value);
      else if (kind === "lines") { const a = el.value.split("\n").map(x => x.trim()).filter(Boolean); v = a.length || Array.isArray(o) ? a : null; }
      else if (kind === "json") {
        if (el.value.trim() === "") v = null;
        else { try { v = JSON.parse(el.value); } catch (_) { errs.push(label(k) + " is not valid JSON."); return; } }
      } else { v = el.value; if (v === "" && (o == null)) v = null; }
      if (k === "title" && !String(v || "").trim()) { errs.push("Title is required."); return; }
      if (JSON.stringify(v) !== JSON.stringify(o ?? null) && !(v === null && o == null)) out[k] = v;
    });
    return { out, errs };
  }

  async function save(e) {
    e.preventDefault();
    const msg = $("pa-msg"), { out, errs } = collect();
    msg.classList.remove("danger");
    if (errs.length) { msg.classList.add("danger"); msg.textContent = errs[0]; return; }
    if (!Object.keys(out).length) { msg.textContent = "Nothing changed."; return; }
    const btn = $("pa-save"); btn.disabled = true; msg.textContent = "Saving …";
    const { data, error } = await db.from("shop_products").update(out).eq("id", cur.id).select("*");
    btn.disabled = false;
    if (error) { msg.classList.add("danger"); msg.textContent = "Save failed: " + error.message; return; }
    if (!data || !data.length) { msg.classList.add("danger"); msg.textContent = "Not saved: no permission. Run 21-product-admin.sql in Supabase first."; return; }
    const i = rows.findIndex(r => String(r.id) === String(cur.id));
    if (i > -1) rows[i] = data[0];
    cur = data[0]; dirty = false;
    openEdit(data[0], true);
    $("pa-msg").textContent = "Saved: " + Object.keys(out).map(label).join(", ") + ".";
  }

  async function duplicate() {
    const msg = $("pa-msg");
    if (dirty && !confirm("Unsaved changes are not copied. Continue?")) return;
    const copy = JSON.parse(JSON.stringify(cur));
    READONLY.forEach(k => delete copy[k]);
    copy.title = String(copy.title || "Product") + " (copy)";
    if ("published" in copy) copy.published = false;
    msg.classList.remove("danger"); msg.textContent = "Creating copy …";
    const { data, error } = await db.from("shop_products").insert(copy).select("*");
    if (error || !data || !data.length) { msg.classList.add("danger"); msg.textContent = "Could not create copy: " + (error ? error.message : "no permission. Run 21-product-admin.sql in Supabase first."); return; }
    rows.unshift(data[0]); dirty = false;
    openEdit(data[0], true);
    $("pa-msg").textContent = "Copy created as hidden draft.";
  }

  async function toggle(id) {
    const r = rows.find(x => String(x.id) === String(id)); if (!r) return;
    const next = !r.published;
    if (next && !confirm("Publish \"" + (r.title || "product") + "\" now? It becomes visible in the shop.")) return;
    const { data, error } = await db.from("shop_products").update({ published: next }).eq("id", r.id).select("*");
    if (error) { status("Failed: " + error.message, true); return; }
    if (!data || !data.length) { status("Not saved: no permission. Run 21-product-admin.sql in Supabase first.", true); return; }
    const i = rows.findIndex(x => String(x.id) === String(id)); rows[i] = data[0];
    if (cur && String(cur.id) === String(id)) openEdit(data[0], true); else renderList();
    status((next ? "Published: " : "Hidden: ") + (data[0].title || ""));
  }

  document.addEventListener("click", e => {
    const t = e.target;
    const pick = t.closest && t.closest(".pa-pick");
    if (pick) { const r = rows.find(x => String(x.id) === pick.dataset.id); if (r) openEdit(r); return; }
    const tg = t.closest && t.closest(".pa-tog");
    if (tg) { toggle(tg.dataset.id); return; }
    if (t.id === "pa-dup") { duplicate(); return; }
  });
  document.addEventListener("submit", e => { if (e.target.id === "pa-form") save(e); });
  document.addEventListener("input", e => { if (e.target.closest && e.target.closest("#pa-form")) dirty = true; });
  $("pa-reload").onclick = () => { if (dirty && !confirm("Discard unsaved changes?")) return; dirty = false; load(cur && cur.id); };
  window.addEventListener("beforeunload", e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  load();
})();

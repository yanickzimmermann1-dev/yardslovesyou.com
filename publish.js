/* =====================================================================
   "Publish to Community" im Beat Lab und im Chord & Melody Starter
   Liest das aktuelle Muster aus der Adresse (#b=… bzw. #c=…) und speichert
   es als Beitrag. Gespeichert wird nur das Muster, keine Audiodatei.
   ===================================================================== */
(() => {
  const { db, $, esc, me, loginUrl, toast } = window.YLY;
  const btn = $("pub-btn"), dlg = $("pub-dialog");
  if (!btn || !dlg) return;
  const remixOf = new URLSearchParams(location.search).get("remix");
  const current = () => {
    const h = location.hash;
    if (h.startsWith("#b=")) return { type: "beat", data: h.slice(3) };
    if (h.startsWith("#c=")) return { type: "chords", data: h.slice(3) };
    return null;
  };

  btn.addEventListener("click", async () => {
    const m = await me();
    if (!m) { location.href = loginUrl(); return; }
    if (!m.profile) { location.href = "account.html?next=" + encodeURIComponent(location.href); return; }
    if (!current()) { toast("Make something first, then publish it.", true); return; }
    $("pub-handle").textContent = "@" + m.profile.handle;
    $("pub-remix").classList.toggle("hidden", !remixOf);
    $("pub-status").textContent = ""; $("pub-done").classList.add("hidden"); $("pub-form").classList.remove("hidden");
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    $("pub-title").focus();
  });
  $("pub-cancel").addEventListener("click", () => dlg.close ? dlg.close() : dlg.removeAttribute("open"));
  $("pub-close").addEventListener("click", () => dlg.close ? dlg.close() : dlg.removeAttribute("open"));

  $("pub-form").addEventListener("submit", async e => {
    e.preventDefault();
    const m = await me(), c = current(), title = $("pub-title").value.trim(), st = $("pub-status"), go = $("pub-go");
    st.classList.remove("danger"); st.textContent = "";
    if (!title) { st.textContent = "Please give it a title."; st.classList.add("danger"); return; }
    if (!c) { st.textContent = "Nothing to publish yet."; st.classList.add("danger"); return; }
    go.disabled = true; go.textContent = "Publishing …";
    try {
      const row = { user_id: m.user.id, type: c.type, title: title.slice(0, 60), data: c.data };
      if (remixOf && /^[0-9a-f-]{36}$/i.test(remixOf)) row.remix_of = remixOf;
      const { data, error } = await db.from("posts").insert(row).select("id").single();
      if (error) throw new Error(/limit/i.test(error.message) ? "You've reached today's post limit. Please try again tomorrow." : error.message);
      $("pub-form").classList.add("hidden");
      $("pub-done").classList.remove("hidden");
      $("pub-link").href = `community.html?post=${data.id}`;
    } catch (err) {
      st.textContent = err.message || "Something went wrong."; st.classList.add("danger");
    } finally { go.disabled = false; go.textContent = "Publish"; }
  });
})();

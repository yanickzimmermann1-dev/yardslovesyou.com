(() => {
  const $ = id => document.getElementById(id), cfg = window.APP_CONFIG || {};
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let recipients = 0;

  const msg = (t, bad) => { $("msg").textContent = t; $("msg").classList.toggle("danger", !!bad); };
  async function call(body) {
    const { data, error } = await db.functions.invoke("sound-drop", { body: { ...body, admin_key: $("key").value.trim() } });
    if (error) {
      let m = error.message;
      try { const j = await error.context.json(); if (j?.error) m = j.error; } catch (_) {}
      throw new Error(m);
    }
    if (!data?.ok) throw new Error(data?.error || "Fehler");
    return data;
  }

  $("load").onclick = async () => {
    msg("Lade …");
    try {
      const d = await call({ action: "status" });
      recipients = d.recipients;
      $("info").innerHTML = d.drop
        ? `<p><strong>Aktueller Drop:</strong> ${esc(d.drop.title)}</p>
           <p><strong>Veröffentlicht ab:</strong> ${esc(d.drop.release_date)}</p>
           <p><strong>Datei:</strong> ${esc(d.drop.file_path)}</p>
           <p><strong>Bereits verschickt:</strong> ${d.drop.sent_at ? esc(String(d.drop.sent_at).slice(0, 16).replace("T", " ")) + ` (an ${d.drop.sent_count ?? "?"})` : "nein"}</p>
           <p><strong>Empfänger mit Einwilligung:</strong> ${recipients}</p>`
        : `<p>Kein veröffentlichter Drop gefunden. Lege zuerst in Supabase einen Eintrag in <strong>sound_drops</strong> an (published = true, release_date <= heute).</p>
           <p><strong>Empfänger mit Einwilligung:</strong> ${recipients}</p>`;
      $("send-all").textContent = `An alle senden (${recipients})`;
      $("panel").classList.remove("hidden");
      msg("");
    } catch (e) { msg(e.message, true); }
  };

  $("send-test").onclick = async () => {
    msg("Sende Test …");
    try { await call({ action: "send", test_email: $("test").value.trim() }); msg("Test verschickt. Prüf dein Postfach."); }
    catch (e) { msg(e.message, true); }
  };

  $("send-all").onclick = async () => {
    if (!confirm(`Den aktuellen Drop jetzt an ${recipients} Abonnenten senden?`)) return;
    $("send-all").disabled = true; msg("Sende … bitte Seite nicht schliessen.");
    try {
      const d = await call({ action: "send", force: $("force").checked });
      msg(`Fertig: ${d.sent} verschickt${d.failed ? `, ${d.failed} fehlgeschlagen (siehe Supabase-Logs)` : ""}.`, !!d.failed);
      $("load").onclick();
    } catch (e) { msg(e.message, true); }
    finally { $("send-all").disabled = false; }
  };
})();

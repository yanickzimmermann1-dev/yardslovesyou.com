/* =====================================================================
   LIVE-ANZEIGE: Wie viele Producer sind gerade auf Percussion Loop Lab,
   Chord Starter, Community oder Profilen? (Supabase Realtime Presence)
   - Mehrere Tabs derselben Person zählen nur einmal
   - Unter MIN_SHOW Personen wird nichts angezeigt
   - Es werden keine persönlichen Daten übertragen, nur eine zufällige ID
   ===================================================================== */
(() => {
  const MIN_SHOW = 2;
  const cfg = window.APP_CONFIG || {};
  if (!window.supabase || !cfg.SUPABASE_URL) return;
  const db = (window.YLY && window.YLY.db) || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

  // Zufällige, anonyme ID pro Browser (gleich in allen Tabs)
  let id = "";
  try { id = localStorage.getItem("yly_pid") || ""; } catch (_) {}
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) ;
    try { localStorage.setItem("yly_pid", id); } catch (_) {}
  }

  // Anzeige oben rechts im Inhalt
  const main = document.querySelector("main");
  if (!main) return;
  const pill = document.createElement("div");
  pill.className = "live-pill";
  pill.setAttribute("aria-live", "polite");
  pill.innerHTML = '<span class="live-dot" aria-hidden="true"></span><strong>LIVE</strong><span class="live-sep">/</span><span class="live-num">0</span><span class="live-label">producers</span>';
  main.prepend(pill);

  let shown = 0;
  function render(n) {
    pill.classList.toggle("visible", n >= MIN_SHOW);
    if (n === shown) return;
    shown = n;
    pill.querySelector(".live-num").textContent = n;
    pill.querySelector(".live-label").textContent = n === 1 ? "producer" : "producers";
    pill.title = `${n} producers are on the Percussion Loop Lab, Chord Starter or Community right now`;
  }

  const channel = db.channel("producers-online", { config: { presence: { key: id } } });
  channel
    .on("presence", { event: "sync" }, () => render(Object.keys(channel.presenceState()).length))
    .subscribe(async status => {
      if (status === "SUBSCRIBED") {
        try { await channel.track({ page: location.pathname.replace(/^\//, "") || "index.html" }); } catch (_) {}
      }
    });

  // Tab geschlossen -> sofort abmelden
  window.addEventListener("pagehide", () => { try { channel.untrack(); db.removeChannel(channel); } catch (_) {} });
})();

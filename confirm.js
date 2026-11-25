(() => {
  const $ = id => document.getElementById(id), cfg = window.APP_CONFIG || {};
  $("year").textContent = new Date().getFullYear();
  const token = new URLSearchParams(location.search).get("t");
  const btn = $("confirm-btn"), status = $("confirm-status");
  const help = 'Please sign up again, or write to <a href="mailto:hello@yardslovesyou.com" style="color:var(--purple)">hello@yardslovesyou.com</a>.';
  const fail = msg => {
    status.classList.add("danger");
    status.textContent = msg ? msg + " " : "That did not work. ";
    status.insertAdjacentHTML("beforeend", help);
  };
  if (!token) {
    btn.disabled = true;
    fail("This link is incomplete. Please use the confirmation link from your email.");
    return;
  }
  // Bestaetigt wird erst per Klick (nicht beim Laden), damit Mail-Scanner den Link nicht ausloesen
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "One moment …"; status.classList.remove("danger"); status.textContent = "";
    try {
      const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await db.functions.invoke("sound-drop", { body: { action: "confirm", token } });
      let msg = data && data.error;
      if (!msg && error) { try { msg = (await error.context.json()).error; } catch (_) {} }
      if (msg || error || !data?.ok) throw new Error(msg || "");
      window.ylyTrack && ylyTrack("newsletter-confirm", {});
      document.querySelector("#confirm h1").innerHTML = "You're <span>subscribed.</span>";
      document.querySelector("#confirm .muted").textContent = "Thanks for confirming. New sounds and drops will land in your inbox.";
      document.querySelector("#confirm .hero-actions").innerHTML = '<a class="button" href="shop.html#free">Go to Free sounds</a>';
    } catch (e) {
      btn.disabled = false; btn.textContent = "Yes, subscribe me";
      fail(e && e.message ? e.message : "");
    }
  };
})();

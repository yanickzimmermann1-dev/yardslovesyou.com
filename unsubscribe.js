(() => {
  const $ = id => document.getElementById(id), cfg = window.APP_CONFIG || {};
  $("year").textContent = new Date().getFullYear();
  const token = new URLSearchParams(location.search).get("t");
  const btn = $("unsub-btn"), status = $("unsub-status");
  if (!token) {
    btn.disabled = true;
    status.classList.add("danger");
    status.innerHTML = 'This link is incomplete. Please use the unsubscribe link from one of our emails, or write to <a href="mailto:yardsyurr@gmail.com" style="color:var(--purple)">yardsyurr@gmail.com</a>.';
    return;
  }
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "One moment …"; status.classList.remove("danger"); status.textContent = "";
    try {
      const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await db.functions.invoke("sound-drop", { body: { action: "unsubscribe", token } });
      if (error || !data?.ok) throw new Error(data?.error || "Something went wrong.");
      document.querySelector("#unsub h1").innerHTML = "You're <span>unsubscribed.</span>";
      document.querySelector("#unsub .muted").textContent = "You won't receive any more Sound Drops or news. Changed your mind? You can sign up again any time on the Free sounds page.";
      document.querySelector("#unsub .hero-actions").innerHTML = '<a class="outline" href="free.html">Go to Free sounds</a>';
    } catch (e) {
      btn.disabled = false; btn.textContent = "Yes, unsubscribe me";
      status.classList.add("danger");
      status.innerHTML = 'That did not work. Please try again, or write to <a href="mailto:yardsyurr@gmail.com" style="color:var(--purple)">yardsyurr@gmail.com</a>.';
    }
  };
})();

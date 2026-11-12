(() => {
  const { db, $, esc, me, resetMe, toast, timeAgo, LINKS } = window.YLY;
  const params = new URLSearchParams(location.search);
  // Nur Weiterleitungen auf die eigene Website erlauben
  const nextRaw = params.get("next") || "";
  const next = (() => {
    if (!nextRaw) return "";                                   // kein Ziel angegeben -> auf der Konto-Seite bleiben
    try {
      const u = new URL(nextRaw, location.origin);
      if (u.origin !== location.origin || u.pathname.endsWith("/account.html")) return "";
      return u.href;
    } catch (_) { return ""; }
  })();
  const show = id => ["acc-login", "acc-create", "acc-edit"].forEach(x => $(x).classList.toggle("hidden", x !== id));
  const status = (id, msg, bad) => { const el = $(id); el.textContent = msg; el.classList.toggle("danger", !!bad); };

  // ---------- Login per Magic Link ----------
  $("acc-login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("acc-email").value.trim(), btn = $("acc-login-btn");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return status("acc-login-status", "Please enter a valid email address.", true);
    if (!$("acc-terms").checked) return status("acc-login-status", "Please confirm the box above.", true);
    btn.disabled = true; btn.textContent = "Sending …"; status("acc-login-status", "");
    const redirect = `${location.origin}/account.html${next ? "?next=" + encodeURIComponent(next) : ""}`;
    const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect, shouldCreateUser: true } });
    btn.disabled = false; btn.textContent = "Send me a login link";
    if (error) return status("acc-login-status", /rate/i.test(error.message) ? "Too many attempts. Please wait a minute and try again." : error.message, true);
    $("acc-login-form").classList.add("hidden");
    $("acc-sent").classList.remove("hidden");
    $("acc-sent-email").textContent = email;
  });

  // ---------- Profil anlegen ----------
  $("acc-handle").addEventListener("input", e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20); });
  $("acc-create-form").addEventListener("submit", async e => {
    e.preventDefault();
    const m = await me(), handle = $("acc-handle").value.trim(), name = $("acc-name").value.trim().slice(0, 40);
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return status("acc-create-status", "Your handle needs 3–20 characters: a–z, 0–9 and _.", true);
    const btn = $("acc-create-btn"); btn.disabled = true;
    const { error } = await db.from("profiles").insert({ id: m.user.id, handle, display_name: name || null });
    btn.disabled = false;
    if (error) {
      const msg = /duplicate|unique/i.test(error.message) ? "This handle is already taken." : /check/i.test(error.message) ? "This handle is not allowed. Please choose another one." : error.message;
      return status("acc-create-status", msg, true);
    }
    resetMe();
    if (next) { location.href = next; return; }
    render();
  });

  // ---------- Profil bearbeiten ----------
  $("acc-links").innerHTML = LINKS.map(([k, label]) => `
    <label class="field"><span>${label}</span><input type="url" id="acc-link-${k}" placeholder="https://…" maxlength="200"></label>`).join("");
  $("acc-bio").addEventListener("input", () => { $("acc-bio-count").textContent = `${$("acc-bio").value.length}/160`; });

  $("acc-edit-form").addEventListener("submit", async e => {
    e.preventDefault();
    const m = await me(), links = {};
    for (const [k, label, re] of LINKS) {
      const v = $("acc-link-" + k).value.trim();
      if (!v) continue;
      if (!re.test(v)) return status("acc-edit-status", `Please enter a full ${label} link (starting with https://).`, true);
      links[k] = v;
    }
    const btn = $("acc-save"); btn.disabled = true;
    const { error } = await db.from("profiles").update({
      display_name: $("acc-dname").value.trim().slice(0, 40) || null,
      bio: $("acc-bio").value.trim().slice(0, 160) || null,
      links,
    }).eq("id", m.user.id);
    btn.disabled = false;
    if (error) return status("acc-edit-status", error.message, true);
    resetMe(); status("acc-edit-status", "Saved!");
  });

  // ---------- Eigene Beiträge ----------
  async function myPosts(uid) {
    const { data } = await db.from("posts").select("id,type,title,created_at,like_count,hidden").eq("user_id", uid).order("created_at", { ascending: false }).limit(100);
    $("acc-posts").innerHTML = (data || []).length ? data.map(p => `
      <li>
        <span class="cp-type ${esc(p.type)}">${p.type === "beat" ? "Beat" : "Chords"}</span>
        <a href="community.html?post=${encodeURIComponent(p.id)}">${esc(p.title)}</a>
        <span class="muted">${timeAgo(p.created_at)} · ${+p.like_count || 0} likes${p.hidden ? " · hidden by moderation" : ""}</span>
        <button type="button" class="cp-icon danger" data-del="${esc(p.id)}">Delete</button>
      </li>`).join("") : '<li class="muted">No posts yet. Make something in the <a class="cp-link" href="beatlab.html">Perc Lab</a> or the <a class="cp-link" href="chords.html">Chord Starter</a> and hit Publish.</li>';
  }
  $("acc-posts").addEventListener("click", async e => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    if (!confirm("Delete this post? This can't be undone.")) return;
    const { error } = await db.from("posts").delete().eq("id", b.dataset.del);
    if (error) toast(error.message, true); else b.closest("li").remove();
  });

  // ---------- Abmelden & Konto löschen ----------
  $("acc-logout").addEventListener("click", async () => { await db.auth.signOut(); resetMe(); location.href = "community.html"; });
  $("acc-delete").addEventListener("click", async () => {
    const t = prompt('This permanently deletes your profile, all your posts, likes and follows.\nType DELETE to confirm.');
    if (t !== "DELETE") return;
    const { data, error } = await db.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
    if (error || !data?.ok) { toast((data && data.error) || "Your account could not be deleted. Please contact us.", true); return; }
    await db.auth.signOut(); resetMe();
    alert("Your account has been deleted.");
    location.href = "community.html";
  });

  // ---------- Anzeige je nach Status ----------
  async function render() {
    resetMe();
    const m = await me();
    if (!m) { show("acc-login"); return; }
    $("acc-signed-as").textContent = m.user.email;
    if (!m.profile) { show("acc-create"); return; }
    if (next && params.get("stay") !== "1") { location.href = next; return; }
    show("acc-edit");
    const p = m.profile;
    $("acc-title-handle").textContent = "@" + p.handle;
    $("acc-view").href = `profile.html?u=${encodeURIComponent(p.handle)}`;
    $("acc-dname").value = p.display_name || "";
    $("acc-bio").value = p.bio || ""; $("acc-bio-count").textContent = `${(p.bio || "").length}/160`;
    for (const [k] of LINKS) $("acc-link-" + k).value = (p.links && p.links[k]) || "";
    $("acc-admin").classList.toggle("hidden", !m.admin);
    $("acc-orders").classList.toggle("hidden", !m.admin);
    myPosts(m.user.id);
  }

  // Nach dem Klick auf den Login-Link setzt Supabase die Sitzung selbst
  db.auth.onAuthStateChange(ev => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") render(); });
  render();
})();

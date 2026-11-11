(async () => {
  const { db, $, esc, me, loginUrl, postCard, bindActions, toast, timeAgo, POST_SELECT } = window.YLY;
  const m = await me();
  if (!m) { location.href = loginUrl(); return; }
  if (!m.admin) { $("adm-guard").textContent = "Kein Zugriff. Diese Seite ist nur für Admins."; return; }
  $("adm-guard").classList.add("hidden"); $("adm-body").classList.remove("hidden");

  async function loadReports() {
    const { data, error } = await db.from("reports")
      .select("id,reason,created_at,post_id,profile_id,post:posts(id,title,hidden,type,author:profiles!posts_user_id_fkey(handle)),profile:profiles(id,handle,hidden)")
      .eq("resolved", false).order("created_at", { ascending: false }).limit(100);
    if (error) { $("adm-reports").innerHTML = `<li class="danger">${esc(error.message)}</li>`; return; }
    $("adm-count").textContent = `(${data.length})`;
    $("adm-reports").innerHTML = data.length ? data.map(r => {
      const target = r.post ? `Beitrag <a href="community.html?post=${encodeURIComponent(r.post.id)}" target="_blank" rel="noopener noreferrer">${esc(r.post.title)}</a> von @${esc(r.post.author?.handle || "?")}${r.post.hidden ? " (ausgeblendet)" : ""}`
        : r.profile ? `Profil <a href="profile.html?u=${encodeURIComponent(r.profile.handle)}" target="_blank" rel="noopener noreferrer">@${esc(r.profile.handle)}</a>${r.profile.hidden ? " (ausgeblendet)" : ""}`
        : "Bereits gelöscht";
      return `<li>
        <div><strong>${target}</strong><br><span class="muted">„${esc(r.reason || "kein Grund angegeben")}“ · ${timeAgo(r.created_at)}</span></div>
        <div class="adm-actions">
          ${r.post ? `<button class="cp-icon danger" data-hidepost="${esc(r.post.id)}" data-on="${!!r.post.hidden}">${r.post.hidden ? "Einblenden" : "Beitrag ausblenden"}</button>` : ""}
          ${r.profile ? `<button class="cp-icon danger" data-hideprof="${esc(r.profile.id)}" data-on="${!!r.profile.hidden}">${r.profile.hidden ? "Einblenden" : "Profil ausblenden"}</button>` : ""}
          <button class="cp-icon" data-resolve="${esc(r.id)}">Erledigt</button>
        </div>
      </li>`;
    }).join("") : '<li class="muted">Keine offenen Meldungen</li>';
  }
  async function loadPosts() {
    const { data } = await db.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(40);
    $("adm-posts").innerHTML = (data || []).map(p => postCard(p, { me: m, liked: new Set() })).join("") || '<div class="empty">Noch keine Beiträge.</div>';
  }
  const reload = () => { loadReports(); loadPosts(); };

  $("adm-reports").addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    let res;
    if (b.dataset.hidepost) res = await db.from("posts").update({ hidden: b.dataset.on !== "true" }).eq("id", b.dataset.hidepost);
    else if (b.dataset.hideprof) res = await db.from("profiles").update({ hidden: b.dataset.on !== "true" }).eq("id", b.dataset.hideprof);
    else if (b.dataset.resolve) res = await db.from("reports").update({ resolved: true }).eq("id", b.dataset.resolve);
    if (res?.error) toast(res.error.message, true); else reload();
  });
  bindActions($("adm-posts"), reload, toast);
  reload();
})();

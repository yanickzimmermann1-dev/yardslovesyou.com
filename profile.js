(() => {
  const { db, $, esc, me, loginUrl, renderAuthChip, postCard, likedSet, bindActions, toast, POST_SELECT, LINKS } = window.YLY;
  const handle = (new URLSearchParams(location.search).get("u") || "").toLowerCase();
  const box = $("pf-box"), list = $("pf-posts");
  let profile = null;

  async function load() {
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) { box.innerHTML = '<div class="empty">Profile not found.</div>'; return; }
    const { data: p } = await db.from("profiles").select("id,handle,display_name,bio,links,hidden,created_at").eq("handle", handle).maybeSingle();
    if (!p) { box.innerHTML = '<div class="empty">Profile not found.</div>'; list.innerHTML = ""; return; }
    profile = p;
    document.title = `${p.display_name || "@" + p.handle} (@${p.handle}) · YARDSLOVESYOU Community`;

    const [followers, following, posts, m] = await Promise.all([
      db.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", p.id),
      db.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", p.id),
      db.from("posts").select(POST_SELECT).eq("user_id", p.id).order("created_at", { ascending: false }).limit(60),
      me(),
    ]);
    const mine = m && m.user.id === p.id;
    let iFollow = false;
    if (m && !mine) {
      const { data } = await db.from("follows").select("followee_id").eq("follower_id", m.user.id).eq("followee_id", p.id).maybeSingle();
      iFollow = !!data;
    }
    const links = LINKS.map(([k, label, re]) => {
      const url = p.links && typeof p.links[k] === "string" ? p.links[k] : "";
      return re.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener nofollow ugc">${label}</a>` : "";
    }).filter(Boolean).join("");

    box.innerHTML = `
      <div class="pf-head">
        <div class="pf-avatar" aria-hidden="true">${esc((p.display_name || p.handle).slice(0, 1).toUpperCase())}</div>
        <div class="pf-main">
          <h1>${esc(p.display_name || p.handle)}</h1>
          <p class="pf-handle">@${esc(p.handle)}${p.hidden ? ' · <span class="cp-hidden-tag">Hidden</span>' : ""}</p>
          ${p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : ""}
          ${links ? `<div class="pf-links">${links}</div>` : ""}
          <p class="pf-stats"><strong id="pf-followers">${followers.count ?? 0}</strong> followers · <strong>${following.count ?? 0}</strong> following · <strong>${(posts.data || []).length}</strong> posts</p>
        </div>
        <div class="pf-actions">
          ${mine ? `<a class="outline" href="account.html">Edit profile</a>`
                 : `<button type="button" class="${iFollow ? "outline" : "button"}" id="pf-follow" data-on="${iFollow}">${iFollow ? "Following" : "Follow"}</button>
                    <button type="button" class="cp-icon" id="pf-report">Report</button>`}
          ${m?.admin && !mine ? `<button type="button" class="cp-icon danger" id="pf-hide" data-on="${p.hidden}">${p.hidden ? "Unhide profile" : "Hide profile"}</button>` : ""}
        </div>
      </div>`;

    const liked = await likedSet((posts.data || []).map(x => x.id));
    list.innerHTML = (posts.data || []).length
      ? posts.data.map(x => postCard(x, { me: m, liked })).join("")
      : `<div class="empty">${mine ? "You haven't published anything yet. Make a beat or chords and hit Publish!" : "No posts yet."}</div>`;

    $("pf-follow")?.addEventListener("click", follow);
    $("pf-report")?.addEventListener("click", report);
    $("pf-hide")?.addEventListener("click", hide);
  }

  async function follow(e) {
    const m = await me();
    if (!m) { location.href = loginUrl(); return; }
    if (!m.profile) { location.href = "account.html"; return; }
    const b = e.currentTarget, on = b.dataset.on === "true";
    b.disabled = true;
    const { error } = on
      ? await db.from("follows").delete().eq("follower_id", m.user.id).eq("followee_id", profile.id)
      : await db.from("follows").insert({ follower_id: m.user.id, followee_id: profile.id });
    b.disabled = false;
    if (error) { toast(error.message, true); return; }
    b.dataset.on = String(!on); b.textContent = on ? "Follow" : "Following";
    b.className = on ? "button" : "outline";
    const c = $("pf-followers"); c.textContent = Math.max(0, +c.textContent + (on ? -1 : 1));
  }
  async function report() {
    const m = await me();
    if (!m) { location.href = loginUrl(); return; }
    const reason = prompt("Why are you reporting this profile?");
    if (reason === null) return;
    const { error } = await db.from("reports").insert({ profile_id: profile.id, reason: reason.slice(0, 300) });
    toast(error ? error.message : "Thanks – we'll take a look.", !!error);
  }
  async function hide(e) {
    const on = e.currentTarget.dataset.on === "true";
    const { error } = await db.from("profiles").update({ hidden: !on }).eq("id", profile.id);
    if (error) toast(error.message, true); else load();
  }

  bindActions(list, load, toast);
  renderAuthChip($("cm-auth"));
  load();
})();

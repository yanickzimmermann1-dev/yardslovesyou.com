(() => {
  const { db, $, me, renderAuthChip, postCard, likedSet, bindActions, toast, POST_SELECT } = window.YLY;
  const PAGE = 20;
  let tab = "new", filter = "all", page = 0, done = false, loading = false;
  const feed = $("cm-feed");

  // Einzelner geteilter Beitrag (community.html?post=…)
  const sharedId = new URLSearchParams(location.search).get("post");

  async function query(from) {
    let q = db.from("posts").select(POST_SELECT);
    if (filter !== "all") q = q.eq("type", filter);
    if (tab === "trending") {
      q = q.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
           .order("like_count", { ascending: false }).order("created_at", { ascending: false });
    } else if (tab === "following") {
      const m = await me();
      if (!m || !m.profile) return { needLogin: true };
      const { data: f } = await db.from("follows").select("followee_id").eq("follower_id", m.user.id).limit(500);
      const ids = (f || []).map(r => r.followee_id);
      if (!ids.length) return { empty: "You don't follow anyone yet. Open a profile and hit Follow." };
      q = q.in("user_id", ids).order("created_at", { ascending: false });
    } else {
      q = q.order("featured", { ascending: false }).order("created_at", { ascending: false });
    }
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    return { data };
  }

  let seq = 0;
  async function load(reset) {
    if (loading && !reset) return;
    const my = ++seq; loading = true;
    if (reset) { page = 0; done = false; feed.innerHTML = '<div class="empty">Loading …</div>'; }
    try {
      const res = await query(page * PAGE);
      if (my !== seq) return; // a newer tab/filter request took over
      if (reset) feed.innerHTML = "";
      if (res.needLogin) { feed.innerHTML = `<div class="empty">Sign in to see posts from people you follow. <a class="cp-link" href="${window.YLY.loginUrl()}">Sign in</a></div>`; done = true; }
      else if (res.empty) { feed.innerHTML = `<div class="empty">${res.empty}</div>`; done = true; }
      else {
        const posts = res.data.filter(p => p.id !== sharedId);
        const m = await me(), liked = await likedSet(posts.map(p => p.id));
        if (my !== seq) return;
        if (reset && !posts.length) feed.innerHTML = '<div class="empty">Nothing here yet. Be the first – make a beat or chords and hit Publish!</div>';
        feed.insertAdjacentHTML("beforeend", posts.map(p => postCard(p, { me: m, liked })).join(""));
        done = res.data.length < PAGE; page++;
      }
    } catch (err) {
      if (my !== seq) return;
      feed.innerHTML = '<div class="empty">The feed could not be loaded. Please try again later.</div>';
    } finally {
      if (my === seq) { loading = false; $("cm-more").classList.toggle("hidden", done); }
    }
  }

  async function loadShared() {
    if (!sharedId || !/^[0-9a-f-]{36}$/i.test(sharedId)) return;
    const { data } = await db.from("posts").select(POST_SELECT).eq("id", sharedId).maybeSingle();
    if (!data) { $("cm-shared").innerHTML = '<div class="empty">This post is no longer available.</div>'; $("cm-shared-wrap").classList.remove("hidden"); return; }
    const m = await me(), liked = await likedSet([data.id]);
    $("cm-shared").innerHTML = postCard(data, { me: m, liked });
    $("cm-shared-wrap").classList.remove("hidden");
    document.title = `${data.title} by @${data.author?.handle || ""} · YARDSLOVESYOU Community`;
  }

  // Tabs & Filter
  $("cm-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(x => { x.classList.toggle("active", x === b); x.setAttribute("aria-selected", x === b); });
    load(true);
  });
  $("cm-filter").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]"); if (!b) return;
    filter = b.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(x => x.classList.toggle("active", x === b));
    load(true);
  });
  $("cm-more").addEventListener("click", () => load(false));

  const reload = () => { loadShared(); load(true); };
  bindActions(feed, reload, toast);
  bindActions($("cm-shared"), reload, toast);

  renderAuthChip($("cm-auth"));
  loadShared();
  load(true);
})();

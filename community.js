(() => {
  const { db, $, me, renderAuthChip, postCard, likedSet, bindActions, toast, POST_SELECT } = window.YLY;
  const PAGE = 20;
  let tab = "new", filter = "all", page = 0, done = false, loading = false;
  const feed = $("cm-feed");
  const S = (el, o) => { if (window.YLYState) window.YLYState.render(el, o); else if (el) el.textContent = (o.title || "") + " " + (o.text || ""); };
  const goTab = t => { const b = document.querySelector('[data-tab="' + t + '"]'); if (b) b.click(); };
  const goFilter = f => { const b = document.querySelector('[data-filter="' + f + '"]'); if (b) b.click(); };

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
      if (!ids.length) return { following: true };
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
    if (reset) { page = 0; done = false; feed.innerHTML = '<article class="cp sk-card sk-cp" aria-hidden="true"><div class="sk sk-line w40"></div><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-line w80"></div></article>'.repeat(3); }
    try {
      const res = await query(page * PAGE);
      if (my !== seq) return; // a newer tab/filter request took over
      if (reset) feed.innerHTML = "";
      if (res.needLogin) { S(feed, { icon: "lock", title: "Sign in to see your feed", text: "Posts from people you follow show up here once you are signed in.", actions: [{ label: "Sign in", href: window.YLY.loginUrl() }, { label: "Explore all posts", onClick: () => goTab("new") }] }); done = true; }
      else if (res.following) { S(feed, { icon: "users", title: "You don't follow anyone yet", text: "Open a profile and hit Follow, and their new posts will land here.", actions: [{ label: "Explore the community", onClick: () => goTab("new") }, { label: "Make a loop", href: "beatlab.html" }] }); done = true; }
      else {
        const posts = res.data.filter(p => p.id !== sharedId);
        const m = await me(), liked = await likedSet(posts.map(p => p.id));
        if (my !== seq) return;
        if (reset && !posts.length) {
          if (filter !== "all") S(feed, { icon: "wave", title: filter === "beat" ? "No beats here yet" : "No chord ideas here yet", text: "Nothing matches this filter yet. Be the first to publish one.", actions: [filter === "beat" ? { label: "Make a loop in the Perc Lab", href: "beatlab.html" } : { label: "Write chords", href: "chords.html" }, { label: "Show all posts", onClick: () => goFilter("all") }] });
          else S(feed, { icon: "wave", title: "Nothing here yet", text: "Be the first: make a beat or chords, then hit Publish to share it with the community.", actions: [{ label: "Make a loop in the Perc Lab", href: "beatlab.html" }, { label: "Write chords", href: "chords.html" }] });
        }
        feed.insertAdjacentHTML("beforeend", posts.map(p => postCard(p, { me: m, liked })).join(""));
        done = res.data.length < PAGE; page++;
      }
    } catch (err) {
      if (my !== seq) return;
      if (reset) S(feed, { icon: "alert", error: true, title: "The feed could not be loaded", text: "Something went wrong or your connection dropped. Please try again.", actions: [{ label: "Retry", onClick: () => load(true) }] });
      else toast("Could not load more posts. Please try again.", true);
    } finally {
      if (my === seq) { loading = false; $("cm-more").classList.toggle("hidden", done); }
    }
  }

  async function loadShared() {
    if (!sharedId || !/^[0-9a-f-]{36}$/i.test(sharedId)) return;
    const { data } = await db.from("posts").select(POST_SELECT).eq("id", sharedId).maybeSingle();
    if (!data) { S($("cm-shared"), { icon: "box", title: "This post is no longer available", text: "It may have been deleted or hidden. The latest posts are just below.", actions: [{ label: "Back to the feed", href: "community.html" }] }); $("cm-shared-wrap").classList.remove("hidden"); return; }
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

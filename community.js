(() => {
  const Y = window.YLY;
  const { db, $, me, renderAuthChip, postCard, likedSet, bindActions, toast } = Y;
  const PAGE = 20;
  let tab = "new", filter = "all", text = "", tag = "", page = 0, done = false, loading = false, noTags = false;
  const feed = $("cm-feed"), qIn = $("cm-q");
  const S = (el, o) => { if (window.YLYState) window.YLYState.render(el, o); else if (el) el.textContent = (o.title || "") + " " + (o.text || ""); };
  const goTab = t => { const b = document.querySelector('[data-tab="' + t + '"]'); if (b) b.click(); };
  const select = () => noTags ? Y.POST_SELECT.replace(",tags", "") : Y.POST_SELECT;
  const cleanTag = s => (window.LabTags ? window.LabTags.clean(s) : String(s || "").toLowerCase().replace(/[^a-z0-9 -]/g, "").trim());
  const cleanText = s => String(s || "").replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);

  // Einzelner geteilter Beitrag (/lab?post=...)
  const sharedId = new URLSearchParams(location.search).get("post");

  // ---------- Suche & Filter im Zustand + URL (?q= / ?tag= / ?type=) ----------
  function readParams() {
    const u = new URLSearchParams(location.search);
    const t = cleanTag(u.get("tag") || ""), q = cleanText(u.get("q") || ""), ty = u.get("type");
    if (t) { qIn.value = "#" + t; } else if (q) { qIn.value = q; }
    if (["drop", "audio", "chords", "gumball"].includes(ty)) { filter = ty; syncPills(); }
    parseInput();
  }
  function parseInput() {
    const v = qIn.value.trim();
    if (v.startsWith("#")) { tag = cleanTag(v); text = ""; } else { tag = ""; text = cleanText(v); }
  }
  function syncPills() {
    document.querySelectorAll("[data-filter]").forEach(x => { const on = x.dataset.filter === filter; x.classList.toggle("active", on); x.setAttribute("aria-pressed", on); });
  }
  function writeUrl() {
    const u = new URLSearchParams(location.search);
    ["q", "tag", "type"].forEach(k => u.delete(k));
    if (tag) u.set("tag", tag); else if (text) u.set("q", text);
    if (filter !== "all") u.set("type", filter);
    const qs = u.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  function renderActive() {
    const el = $("cm-active"), on = !!(tag || text);
    el.classList.toggle("hidden", !on);
    el.innerHTML = on ? `Showing patches for <strong>${tag ? "#" + Y.esc(tag) : "“" + Y.esc(text) + "”"}</strong> <button type="button" class="cp-link" id="cm-clear-q">Clear</button>` : "";
  }

  async function query(from) {
    let q = db.from("posts").select(select());
    if (filter === "audio") q = q.in("type", ["audio", "beat"]);      // older Perc Lab beats are loops too
    else if (filter !== "all") q = q.eq("type", filter);
    if (!noTags) {
      if (tag) q = q.contains("tags", [tag]);
      else if (text) {
        const t = cleanTag(text), tq = t && /^[a-z0-9 -]+$/.test(t) ? `,tags.cs.{${/ /.test(t) ? '"' + t + '"' : t}}` : "";
        q = q.or(`title.ilike.*${text}*${tq}`);
      }
    } else if (text) q = q.ilike("title", `%${text}%`);
    if (tab === "top") {
      q = q.order("like_count", { ascending: false }).order("created_at", { ascending: false });
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

  // Leerer Rack-Slot: ganz leer = "be the first", sonst "no match"
  function emptySlot(filtered) {
    return `<div class="pt-empty" role="status">
      <span class="pt-slot" aria-hidden="true"><i class="screw"></i><i class="screw"></i><i class="screw"></i><i class="screw"></i></span>
      <h3>${filtered ? "No patches match – try another tag" : "No patches yet – be the first"}</h3>
      <p>${filtered ? "Nothing fits this search or filter yet." : "Drop a loop, share some chords or send a Gumball pack to the Lab."}</p>
      <div class="hero-actions">${filtered ? '<button type="button" class="button" id="pt-reset">Show all patches</button>' : '<button type="button" class="button" id="pt-first">Drop a loop</button><a class="outline" href="chords.html">Write chords</a>'}</div>
    </div>`;
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
      if (res.needLogin) { S(feed, { icon: "lock", title: "Sign in to see your feed", text: "Patches from people you follow show up here once you are signed in.", actions: [{ label: "Sign in", href: Y.loginUrl() }, { label: "Explore all patches", onClick: () => goTab("new") }] }); done = true; }
      else if (res.following) { S(feed, { icon: "users", title: "You don't follow anyone yet", text: "Open a profile and hit Follow, and their new patches will land here.", actions: [{ label: "Explore the Lab", onClick: () => goTab("new") }] }); done = true; }
      else {
        const posts = res.data.filter(p => p.id !== sharedId);
        const m = await me(), liked = await likedSet(posts.map(p => p.id));
        if (my !== seq) return;
        if (reset && !posts.length) { feed.innerHTML = emptySlot(!!(tag || text || filter !== "all")); feed.classList.add("is-empty"); }
        else feed.classList.remove("is-empty");
        feed.insertAdjacentHTML("beforeend", posts.map(p => postCard(p, { me: m, liked })).join(""));
        done = res.data.length < PAGE; page++;
      }
    } catch (err) {
      if (my !== seq) return;
      if (!noTags && /tags/i.test(err.message || "")) { noTags = true; loading = false; return load(reset); }   // tags column not migrated yet
      if (reset) S(feed, { icon: "alert", error: true, title: "The feed could not be loaded", text: "Something went wrong or your connection dropped. Please try again.", actions: [{ label: "Retry", onClick: () => load(true) }] });
      else toast("Could not load more patches. Please try again.", true);
    } finally {
      if (my === seq) { loading = false; $("cm-more").classList.toggle("hidden", done); }
    }
  }

  async function loadShared() {
    if (!sharedId || !/^[0-9a-f-]{36}$/i.test(sharedId)) return;
    const { data } = await db.from("posts").select(select()).eq("id", sharedId).maybeSingle();
    if (!data) { S($("cm-shared"), { icon: "box", title: "This patch is no longer available", text: "It may have been deleted or hidden. The latest patches are just below.", actions: [{ label: "Back to the feed", href: "/lab" }] }); $("cm-shared-wrap").classList.remove("hidden"); return; }
    const m = await me(), liked = await likedSet([data.id]);
    $("cm-shared").innerHTML = postCard(data, { me: m, liked });
    $("cm-shared-wrap").classList.remove("hidden");
    document.title = `${data.title} by @${data.author?.handle || ""} · YARDSLOVESYOU Lab`;
  }

  function refresh() { parseInput(); writeUrl(); renderActive(); load(true); }
  function setQuery(v) { qIn.value = v; refresh(); document.getElementById("patches").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
  Y.onTag = t => setQuery("#" + t);

  // Sortierung, Filter, Suche (300 ms Verzoegerung)
  $("cm-tabs").addEventListener("click", e => {
    const b = e.target.closest("[data-tab]"); if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach(x => { x.classList.toggle("active", x === b); x.setAttribute("aria-selected", x === b); });
    load(true);
  });
  $("cm-filter").addEventListener("click", e => {
    const b = e.target.closest("[data-filter]"); if (!b) return;
    filter = b.dataset.filter; syncPills(); writeUrl(); load(true);
  });
  let qT = 0;
  qIn.addEventListener("input", () => { clearTimeout(qT); qT = setTimeout(refresh, 300); });
  $("cm-search").addEventListener("submit", e => { e.preventDefault(); clearTimeout(qT); refresh(); });
  $("cm-more").addEventListener("click", () => load(false));
  document.addEventListener("click", e => {
    if (e.target.closest("#cm-clear-q, #pt-reset")) { qIn.value = ""; filter = "all"; syncPills(); refresh(); }
    else if (e.target.closest("#pt-first")) openUpload();
  });

  // ---------- Loop hochladen ----------
  const openUpload = file => { if (window.LabUpload) window.LabUpload.open(file ? { file } : {}); else toast("Uploads are not available right now.", true); };
  $("cm-drop").addEventListener("click", () => openUpload());
  $("cm-drop-hero").addEventListener("click", () => openUpload());
  const dz = $("drop");
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("over"); }));
  dz.addEventListener("drop", e => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) openUpload(f); });
  window.addEventListener("lab:posted", () => { tab = "new"; goTab("new"); });

  const reload = () => { loadShared(); load(true); };
  bindActions(feed, reload, toast);
  bindActions($("cm-shared"), reload, toast);

  renderAuthChip($("cm-auth"));
  readParams(); renderActive();
  loadShared();
  load(true);
  if (location.hash === "#drop") me().then(m => { if (m && m.profile) openUpload(); });
})();

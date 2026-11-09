/* =====================================================================
   COMMUNITY – gemeinsame Funktionen (Login, Profile, Beitragskarten)
   Wird von community.html, profile.html, account.html, community-admin.html
   sowie vom "Publish"-Button im Beat Lab und Chord & Melody Starter genutzt.
   ===================================================================== */
window.YLY = (() => {
  const cfg = window.APP_CONFIG || {};
  const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MOODS = { dark: "Dark", sad: "Sad", emotional: "Emotional", dreamy: "Dreamy", hype: "Hype" };
  const GENRES = { trap: "Trap", drill: "Drill", rnb: "R&B", lofi: "Lo-fi", afro: "Afro" };
  const LINKS = [
    ["instagram", "Instagram", /^https:\/\/(www\.)?instagram\.com\//i],
    ["youtube", "YouTube", /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i],
    ["soundcloud", "SoundCloud", /^https:\/\/(www\.|m\.)?soundcloud\.com\//i],
    ["spotify", "Spotify", /^https:\/\/open\.spotify\.com\//i],
    ["beatstars", "BeatStars", /^https:\/\/(www\.)?beatstars\.com\//i],
  ];
  const POST_SELECT = "id,type,title,data,remix_of,like_count,featured,hidden,created_at,user_id," +
    "author:profiles!posts_user_id_fkey(handle,display_name)," +
    "parent:remix_of(id,title,author:profiles!posts_user_id_fkey(handle))";

  // ---------- Sitzung & eigenes Profil ----------
  let meCache;
  async function me() {
    if (meCache !== undefined) return meCache;
    const { data } = await db.auth.getSession();
    const user = data.session?.user || null;
    if (!user) return (meCache = null);
    const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
    let admin = false;
    try { const r = await db.rpc("is_admin"); admin = r.data === true; } catch (_) {}
    return (meCache = { user, profile, admin });
  }
  const resetMe = () => { meCache = undefined; };
  const loginUrl = (next = location.href) => `account.html?next=${encodeURIComponent(next)}`;

  // Kleiner Login-Hinweis oben auf Community-Seiten
  async function renderAuthChip(el) {
    if (!el) return;
    const m = await me();
    el.innerHTML = !m ? `<a class="outline" href="${loginUrl()}">Sign in</a>`
      : !m.profile ? `<a class="outline" href="account.html">Finish your profile</a>`
      : `<a class="outline" href="profile.html?u=${encodeURIComponent(m.profile.handle)}">@${esc(m.profile.handle)}</a> <a class="cp-link" href="account.html">Account</a>`;
  }

  // ---------- Hilfen ----------
  function timeAgo(iso) {
    const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
    const u = [[31536000, "y"], [2592000, "mo"], [604800, "w"], [86400, "d"], [3600, "h"], [60, "min"]];
    for (const [sec, l] of u) if (s >= sec) return Math.floor(s / sec) + l + " ago";
    return "just now";
  }
  const toolUrl = p => p.type === "beat" ? `beatlab.html#b=${p.data}` : `chords.html#c=${p.data}`;
  const remixUrl = p => p.type === "beat" ? `beatlab.html?remix=${p.id}#b=${p.data}` : `chords.html?remix=${p.id}#c=${p.data}`;
  const postLink = id => `${location.origin}/community.html?post=${id}`;

  // Vorschau eines Beats (Raster) bzw. einer Akkord-Idee (Eckdaten)
  // Namen für das neue Percussion-Format (Reihenfolge wie in beatlab.js!)
  const PL_GENRES = ["Trap", "Drill", "Afrobeats", "Amapiano", "Reggaeton", "Dancehall", "Baile Funk", "Jersey Club", "Boom Bap", "Lo-fi", "House", "Latin / Clave", "R&B"];
  const PL_MOODS = ["Dark", "Bouncy", "Chill", "Energetic", "Hypnotic", "Tribal"];
  // 32 Schritte (0/1/2) aus base36-Zahl zur Basis 3
  const plUnpack = s => { let n = parseInt(s, 36) || 0; const o = Array(32); for (let i = 31; i >= 0; i--) { o[i] = n % 3; n = Math.floor(n / 3); } return o; };
  function preview(p) {
    if (p.type === "beat" && String(p.data).startsWith("p1.")) {
      try {
        const q = p.data.split("."), n = Math.min(10, Math.max(1, parseInt(q[9], 10) || 10)), rows = q[13] || "";
        let cells = "";
        for (let r = 0; r < n; r++) cells += plUnpack(rows.slice(r * 10, r * 10 + 10)).map(v => `<i class="${v ? (v > 1 ? "on b" : "on") : ""}"></i>`).join("");
        return `<div class="cp-grid" style="grid-template-columns:repeat(32,1fr);gap:1px" aria-hidden="true">${cells}</div><p class="cp-meta">${+q[1]} BPM · ${PL_GENRES[+q[3]] || ""} · ${PL_MOODS[+q[4]] || ""}</p>`;
      } catch (_) { return ""; }
    }
    if (p.type === "beat") {
      try {
        const parts = p.data.split("-"), bpm = +parts[1], key = +parts[3];
        const rows = (parts[7] || "").split(".").slice(0, 7);
        const cells = rows.map((r, ri) => r.padEnd(16, "0").slice(0, 16).split("").map(v =>
          `<i class="${v !== "0" ? (ri === 6 ? "on b" : "on") : ""}"></i>`).join("")).join("");
        return `<div class="cp-grid" aria-hidden="true">${cells}</div><p class="cp-meta">${bpm} BPM · 808 in ${NOTES[key] || "C"}</p>`;
      } catch (_) { return ""; }
    }
    try {
      const o = JSON.parse(decodeURIComponent(escape(atob(p.data.replace(/-/g, "+").replace(/_/g, "/")))));
      return `<p class="cp-meta cp-meta-big">${NOTES[o.k] || ""} · ${MOODS[o.m] || ""} · ${GENRES[o.g] || ""} · ${+o.b} BPM</p>`;
    } catch (_) { return ""; }
  }

  // ---------- Beitragskarte ----------
  function postCard(p, ctx = {}) {
    const mine = ctx.me && ctx.me.user.id === p.user_id;
    const liked = ctx.liked && ctx.liked.has(p.id);
    const by = p.author ? `<a href="profile.html?u=${encodeURIComponent(p.author.handle)}">@${esc(p.author.handle)}</a>` : "unknown";
    const parent = p.parent ? ` · remix of <a href="community.html?post=${p.parent.id}">${esc(p.parent.title)}</a>${p.parent.author ? ` by @${esc(p.parent.author.handle)}` : ""}` : "";
    return `
      <article class="cp ${p.hidden ? "is-hidden" : ""}" data-id="${p.id}">
        <div class="cp-head">
          <span class="cp-type ${p.type}">${p.type === "beat" ? "Beat" : "Chords"}</span>
          ${p.featured ? `<span class="cp-feat">Featured</span>` : ""}
          ${p.hidden ? `<span class="cp-hidden-tag">Hidden</span>` : ""}
          <span class="cp-time">${timeAgo(p.created_at)}</span>
        </div>
        <h3><a href="community.html?post=${p.id}">${esc(p.title)}</a></h3>
        <p class="cp-by">by ${by}${parent}</p>
        ${preview(p)}
        <div class="cp-actions">
          <a class="button cp-btn" href="${toolUrl(p)}">Play</a>
          <a class="outline cp-btn" href="${remixUrl(p)}">Remix</a>
          <button type="button" class="cp-like ${liked ? "liked" : ""}" data-like="${p.id}" aria-pressed="${!!liked}" aria-label="Like"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-2px;margin-right:5px"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.8 6.6 4.8c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.6 0 5.7 3.7 4.2 7C19.5 16.4 12 21 12 21z"/></svg><span>${p.like_count}</span></button>
          <button type="button" class="cp-icon" data-share="${p.id}" title="Copy link">Share</button>
          ${mine ? `<button type="button" class="cp-icon danger" data-delete="${p.id}">Delete</button>`
                 : `<button type="button" class="cp-icon" data-report="${p.id}">Report</button>`}
          ${ctx.me?.admin ? `<button type="button" class="cp-icon" data-feature="${p.id}" data-on="${p.featured}">${p.featured ? "Unfeature" : "Feature"}</button>
            <button type="button" class="cp-icon danger" data-hide="${p.id}" data-on="${p.hidden}">${p.hidden ? "Unhide" : "Hide"}</button>` : ""}
        </div>
      </article>`;
  }

  // Welche der angezeigten Beiträge habe ich geliked?
  async function likedSet(ids) {
    const m = await me();
    if (!m || !ids.length) return new Set();
    const { data } = await db.from("likes").select("post_id").eq("user_id", m.user.id).in("post_id", ids);
    return new Set((data || []).map(r => r.post_id));
  }

  // Klicks auf den Karten (Like, Teilen, Melden, Löschen, Admin)
  function bindActions(container, onChange, toast) {
    container.addEventListener("click", async e => {
      const b = e.target.closest("button[data-like],button[data-share],button[data-report],button[data-delete],button[data-feature],button[data-hide]");
      if (!b) return;
      const m = await me();
      try {
        if (b.dataset.share) {
          const url = postLink(b.dataset.share);
          try { await navigator.clipboard.writeText(url); toast("Link copied!"); } catch (_) { prompt("Copy this link:", url); }
          return;
        }
        if (!m || !m.profile) { location.href = m ? "account.html" : loginUrl(); return; }
        if (b.dataset.like) {
          const id = b.dataset.like, on = b.classList.contains("liked"), n = b.querySelector("span");
          b.disabled = true;
          const { error } = on
            ? await db.from("likes").delete().eq("user_id", m.user.id).eq("post_id", id)
            : await db.from("likes").insert({ user_id: m.user.id, post_id: id });
          b.disabled = false;
          if (error) throw error;
          b.classList.toggle("liked", !on); b.setAttribute("aria-pressed", !on);
          n.textContent = Math.max(0, +n.textContent + (on ? -1 : 1));
        } else if (b.dataset.report) {
          const reason = prompt("Why are you reporting this post? (e.g. spam, offensive title)");
          if (reason === null) return;
          const { error } = await db.from("reports").insert({ post_id: b.dataset.report, reason: reason.slice(0, 300) });
          if (error) throw error;
          toast("Thanks – we'll take a look.");
        } else if (b.dataset.delete) {
          if (!confirm("Delete this post? This can't be undone.")) return;
          const { error } = await db.from("posts").delete().eq("id", b.dataset.delete);
          if (error) throw error;
          b.closest(".cp")?.remove(); toast("Post deleted.");
        } else if (b.dataset.feature) {
          const { error } = await db.from("posts").update({ featured: b.dataset.on !== "true" }).eq("id", b.dataset.feature);
          if (error) throw error;
          onChange && onChange();
        } else if (b.dataset.hide) {
          const { error } = await db.from("posts").update({ hidden: b.dataset.on !== "true" }).eq("id", b.dataset.hide);
          if (error) throw error;
          onChange && onChange();
        }
      } catch (err) {
        toast(err.message || "Something went wrong.", true);
      }
    });
  }

  // Kurze Meldung unten am Bildschirm
  function toast(msg, bad) {
    let t = $("yly-toast");
    if (!t) { t = document.createElement("div"); t.id = "yly-toast"; t.className = "yly-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200);
  }

  const yearEl = $("year"); if (yearEl) yearEl.textContent = new Date().getFullYear();

  return { db, $, esc, me, resetMe, loginUrl, renderAuthChip, timeAgo, postCard, likedSet, bindActions, toast, POST_SELECT, LINKS, toolUrl, remixUrl };
})();

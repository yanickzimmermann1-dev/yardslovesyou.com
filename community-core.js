/* =====================================================================
   COMMUNITY – gemeinsame Funktionen (Login, Profile, Beitragskarten)
   Wird von /lab, profile.html, account.html, community-admin.html
   sowie vom Upload im Lab, Gumball und dem "Publish"-Button im Chord Starter genutzt.
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
  const POST_SELECT = "id,type,title,data,tags,remix_of,like_count,featured,hidden,created_at,user_id," +
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
  const toolUrl = p => `chords.html#c=${p.data}`;
  const remixUrl = p => `chords.html?remix=${p.id}#c=${p.data}`;
  const postLink = id => `${location.origin}/lab?post=${id}`;

  // Vorschau eines Beats (Raster) bzw. einer Akkord-Idee (Eckdaten)
  // Namen für das neue Percussion-Format (Reihenfolge wie in beatlab.js!)
  const PL_GENRES = ["Trap", "Drill", "Afrobeats", "Amapiano", "Reggaeton", "Dancehall", "Baile Funk", "Jersey Club", "Boom Bap", "Lo-fi", "House", "Latin / Clave", "R&B"];
  const PL_MOODS = ["Dark", "Bouncy", "Chill", "Energetic", "Hypnotic", "Tribal"];
  // 32 Schritte (0/1/2) aus base36-Zahl zur Basis 3
  const plUnpack = s => { let n = parseInt(s, 36) || 0; const o = Array(32); for (let i = 31; i >= 0; i--) { o[i] = n % 3; n = Math.floor(n / 3); } return o; };
  const PL2_GENRES = ["Trap", "Drill", "Afrobeats", "Amapiano", "Reggaeton", "Dancehall", "Boom Bap", "Lo-fi", "House", "Latin / Clave", "R&B"];   // p2 (order as in beatlab.js)
  function preview(p) {
    if (p.type === "beat" && String(p.data).startsWith("p2.")) {                 // Perc Lab v2: kick, clap + 3 percussion rows
      try {
        const q = p.data.split("."), rows = q[14] || "";
        let cells = "";
        for (let r = 0; r < 5; r++) cells += plUnpack(rows.slice(r * 10, r * 10 + 10)).map(v => `<i class="${v ? (r < 2 ? "on b" : "on") : ""}"></i>`).join("");
        return `<div class="cp-grid" style="grid-template-columns:repeat(32,1fr);gap:1px" aria-hidden="true">${cells}</div><p class="cp-meta">${+q[1]} BPM · ${PL2_GENRES[+q[3]] || ""} · ${PL_MOODS[+q[4]] || ""}</p>`;
      } catch (_) { return ""; }
    }
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

  // ---------- Audio-Beitraege (Loops / Gumball) ----------
  const TYPE_LABEL = { audio: "Loop", chords: "Chords", gumball: "Gumball", beat: "Beat", drop: "Drop" };
  const AUDIO_RE = /^https:\/\/audio\.yardslovesyou\.com\/(lab|drop)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.m4a$/i;
  // Drop-Design: nur diese Presets (gleiche Liste wie in tools/32-drops.sql)
  const DROP_COLORS = ["violet", "ice", "mint", "gold", "rose", "mono"], DROP_STYLES = ["solid", "outline", "tape"];
  const LINK_RE = /^https:\/\/[^\s<>"]{4,300}$/;
  const linkHost = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return ""; } };
  const TAG_RE = /^[a-z0-9][a-z0-9 -]{0,18}[a-z0-9]$/;
  // data kann Text oder jsonb sein: immer als Objekt lesen (oder null)
  const pdata = p => {
    let d = p.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (_) { return null; } }
    return d && typeof d === "object" ? d : null;
  };
  const fmtDur = s => { s = Math.round(+s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const PLAY_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
  const PAUSE_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>';
  let waveN = 0;
  function waveSvg(peaks) {
    const pk = (Array.isArray(peaks) ? peaks : []).slice(0, 200).map(v => Math.max(0, Math.min(255, +v || 0)));
    if (!pk.length) return "";
    const d = pk.map((v, i) => { const h = Math.max(1.5, v / 255 * 14); return `M${i + .5} ${(16 - h).toFixed(1)}V${(16 + h).toFixed(1)}`; }).join("");
    const id = "wc" + (++waveN);
    return `<svg class="lp-wave" viewBox="0 0 ${pk.length} 32" preserveAspectRatio="none" width="100%" height="48" aria-hidden="true" style="color:var(--accent,#a4b0ea);display:block"><defs><clipPath id="${id}"><rect class="lp-clip" x="0" y="0" width="0" height="32"/></clipPath></defs><path d="${d}" stroke="currentColor" stroke-opacity=".3" stroke-width=".7" fill="none"/><path d="${d}" stroke="currentColor" stroke-width=".7" fill="none" clip-path="url(#${id})"/></svg>`;
  }
  const tagsOf = p => (Array.isArray(p.tags) ? p.tags : []).filter(t => typeof t === "string" && TAG_RE.test(t)).slice(0, 5);
  const tagsHtml = p => { const t = tagsOf(p); return t.length ? `<p class="lp-tags">${t.map(x => `<a class="lp-tag" href="/lab?tag=${encodeURIComponent(x)}" data-tag="${esc(x)}">#${esc(x)}</a>`).join("")}</p>` : ""; };
  function audioBlock(p) {
    const d = pdata(p);
    if (!d || !AUDIO_RE.test(String(d.url || ""))) return `<p class="cp-meta">This sound is no longer available.</p>`;
    const meta = [d.duration ? fmtDur(d.duration) : "", d.bpm ? +d.bpm + " BPM" : "", d.key ? esc(d.key) : ""].filter(Boolean).join(" \u00b7 ");
    const sounds = p.type === "gumball" && Array.isArray(d.sounds) && d.sounds.length
      ? `<p class="cp-meta">${d.sounds.slice(0, 12).map(x => esc(String(x).slice(0, 24))).join(" \u00b7 ")}</p>` : "";
    return `<div class="lp-deck">
        <button type="button" class="lp-play" data-play="${esc(d.url)}" aria-label="Play ${esc(p.title)}">${PLAY_SVG}</button>
        <div class="lp-wavebox" data-seek>${waveSvg(d.peaks)}</div>
        ${meta ? `<span class="lp-dur">${meta}</span>` : ""}
      </div>${sounds}`;
  }

  // Ein gemeinsamer Player: es spielt immer nur ein Beitrag
  const player = { a: null, btn: null };
  const setPlayState = (btn, on) => { if (btn) { btn.innerHTML = on ? PAUSE_SVG : PLAY_SVG; btn.classList.toggle("is-on", on); btn.closest(".cp")?.classList.toggle("is-playing", on); } };
  function setClip(btn, ratio) {
    const r = btn && btn.closest(".cp")?.querySelector(".lp-clip"); if (!r) return;
    const w = r.ownerSVGElement.viewBox.baseVal.width; r.setAttribute("width", String(Math.max(0, Math.min(1, ratio)) * w));
  }
  function stopPlayer() { if (player.a) player.a.pause(); setPlayState(player.btn, false); setClip(player.btn, 0); player.btn = null; }
  function togglePlay(btn, seekTo) {
    if (!player.a) {
      const a = player.a = new Audio(); a.preload = "none";
      a.addEventListener("timeupdate", () => { if (a.duration) setClip(player.btn, a.currentTime / a.duration); });
      a.addEventListener("ended", stopPlayer);
      a.addEventListener("error", () => { stopPlayer(); toast("This sound could not be played.", true); });
    }
    const a = player.a;
    if (player.btn === btn) {
      if (seekTo != null && a.duration) { a.currentTime = seekTo * a.duration; if (a.paused) { a.play(); setPlayState(btn, true); } return; }
      if (!a.paused) { a.pause(); setPlayState(btn, false); return; }
      a.play().catch(() => {}); setPlayState(btn, true); return;
    }
    stopPlayer(); player.btn = btn; a.src = btn.dataset.play; setPlayState(btn, true);
    if (seekTo != null) a.addEventListener("loadedmetadata", () => { a.currentTime = seekTo * a.duration; }, { once: true });
    a.play().catch(() => { stopPlayer(); toast("This sound could not be played.", true); });
  }

  // Aufruf der Edge Function lab-upload (Upload-URL holen, Datei loeschen)
  async function labFn(body) {
    const { data } = await db.auth.getSession();
    const tok = data.session?.access_token;
    if (!tok) throw new Error("Please sign in first.");
    let res;
    try {
      res = await fetch(cfg.SUPABASE_URL + "/functions/v1/lab-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + tok, apikey: cfg.SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(body)
      });
    } catch (_) { throw new Error("The upload service is not reachable. Please try again."); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "The upload service answered with an error (" + res.status + ").");
    return j;
  }

  // ---------- Beitragskarte (Patch) ----------
  function postCard(p, ctx = {}) {
    const mine = ctx.me && ctx.me.user.id === p.user_id;
    const liked = ctx.liked && ctx.liked.has(p.id);
    const by = p.author ? `<a href="profile.html?u=${encodeURIComponent(p.author.handle)}">@${esc(p.author.handle)}</a>` : "unknown";
    const parent = p.parent ? ` \u00b7 remix of <a href="/lab?post=${encodeURIComponent(p.parent.id)}">${esc(p.parent.title)}</a>${p.parent.author ? ` by @${esc(p.parent.author.handle)}` : ""}` : "";
    const isAudio = p.type === "audio" || p.type === "gumball" || p.type === "drop";
    const ad = isAudio ? pdata(p) : null;
    const body = isAudio ? audioBlock(p) : preview(p);
    const open = p.type === "chords"
      ? `<a class="button cp-btn" href="${esc(toolUrl(p))}">Open</a><a class="outline cp-btn" href="${esc(remixUrl(p))}">Remix</a>` : "";
    if (p.type === "drop") return dropCard(p, ctx, { by, body, ad, liked, mine });
    return `
      <article class="cp lp lp-${esc(p.type)} ${p.hidden ? "is-hidden" : ""}" data-id="${esc(p.id)}" data-type="${esc(p.type)}"${ad && AUDIO_RE.test(String(ad.url || "")) ? ` data-audio="${esc(ad.url)}"` : ""}>
        <div class="cp-head">
          <span class="cp-type ${esc(p.type)}">${TYPE_LABEL[p.type] || esc(p.type)}</span>
          ${p.featured ? `<span class="cp-feat">Featured</span>` : ""}
          ${p.hidden ? `<span class="cp-hidden-tag">Hidden</span>` : ""}
          <span class="cp-time">${timeAgo(p.created_at)}</span>
        </div>
        <h3><a href="/lab?post=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>
        <p class="cp-by">by ${by}${parent}</p>
        ${body}
        ${tagsHtml(p)}
        <div class="cp-actions">
          ${open}
          <button type="button" class="cp-like ${liked ? "liked" : ""}" data-like="${esc(p.id)}" aria-pressed="${!!liked}" aria-label="Like"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-2px;margin-right:5px"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.8 6.6 4.8c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.6 0 5.7 3.7 4.2 7C19.5 16.4 12 21 12 21z"/></svg><span>${+p.like_count || 0}</span></button>
          <button type="button" class="cp-icon" data-share="${esc(p.id)}" title="Copy link">Share</button>
          ${mine ? `<button type="button" class="cp-icon danger" data-delete="${esc(p.id)}">Delete</button>`
                 : `<button type="button" class="cp-icon" data-report="${esc(p.id)}">Report</button>`}
          ${ctx.me?.admin ? `<button type="button" class="cp-icon" data-feature="${esc(p.id)}" data-on="${!!p.featured}">${p.featured ? "Unfeature" : "Feature"}</button>
            <button type="button" class="cp-icon danger" data-hide="${esc(p.id)}" data-on="${!!p.hidden}">${p.hidden ? "Unhide" : "Hide"}</button>` : ""}
        </div>
      </article>`;
  }

  // ---------- Drop-Karte (1 Track pro Account, eigenes Design) ----------
  const SHARE_BASE = "https://audio.yardslovesyou.com/d/";
  const dropShareUrl = handle => /^[a-z0-9_]{3,20}$/i.test(String(handle || "")) ? SHARE_BASE + String(handle).toLowerCase() : "";
  const actionsHtml = (p, ctx, liked, mine, shareUrl) => `
        <div class="cp-actions">
          <button type="button" class="cp-like ${liked ? "liked" : ""}" data-like="${esc(p.id)}" aria-pressed="${!!liked}" aria-label="Like"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="vertical-align:-2px;margin-right:5px"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.8 6.6 4.8c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.6 0 5.7 3.7 4.2 7C19.5 16.4 12 21 12 21z"/></svg><span>${+p.like_count || 0}</span></button>
          <button type="button" class="cp-icon" data-share="${esc(p.id)}"${shareUrl ? ` data-share-url="${esc(shareUrl)}"` : ""}${mine ? " data-mine" : ""} title="Copy link">Share</button>
          ${mine ? `<button type="button" class="cp-icon" data-drop-edit>Change drop</button><button type="button" class="cp-icon danger" data-delete="${esc(p.id)}">Delete</button>`
                 : `<button type="button" class="cp-icon" data-report="${esc(p.id)}">Report</button>`}
          ${ctx.me?.admin ? `<button type="button" class="cp-icon" data-feature="${esc(p.id)}" data-on="${!!p.featured}">${p.featured ? "Unfeature" : "Feature"}</button>
            <button type="button" class="cp-icon danger" data-hide="${esc(p.id)}" data-on="${!!p.hidden}">${p.hidden ? "Unhide" : "Hide"}</button>` : ""}
        </div>`;
  const dropTheme = d => {
    const t = (d && d.theme) || {};
    return { c: DROP_COLORS.includes(t.c) ? t.c : "violet", s: DROP_STYLES.includes(t.s) ? t.s : "solid" };
  };
  // Generiertes Cover: nur Typo + Farbe, kein Bild
  const dropCover = (title, handle, th) => `
        <div class="dr-cover dr-c-${th.c} dr-s-${th.s}" aria-hidden="true">
          <span class="dr-cover-k">DROP</span>
          <span class="dr-cover-t">${esc(title)}</span>
          <span class="dr-cover-h">${handle ? "@" + esc(handle) : ""}</span>
        </div>`;
  function dropCard(p, ctx, o) {
    const d = o.ad || {}, th = dropTheme(d);
    const desc = typeof d.desc === "string" ? d.desc.slice(0, 280) : "";
    const credits = typeof d.credits === "string" ? d.credits.slice(0, 120) : "";
    const link = typeof d.link === "string" && LINK_RE.test(d.link) ? d.link : "";
    const big = ctx.big ? " dr-big" : "";
    return `
      <article class="cp lp lp-drop dr dr-c-${th.c} dr-s-${th.s}${big} ${p.hidden ? "is-hidden" : ""}" data-id="${esc(p.id)}" data-type="drop"${AUDIO_RE.test(String(d.url || "")) ? ` data-audio="${esc(d.url)}"` : ""}>
        ${dropCover(p.title, p.author && p.author.handle, th)}
        <div class="dr-body">
          <div class="cp-head">
            <span class="cp-type t-drop">Drop</span>
            ${p.featured ? `<span class="cp-feat">Featured</span>` : ""}
            ${p.hidden ? `<span class="cp-hidden-tag">Hidden</span>` : ""}
            <span class="cp-time">${timeAgo(p.created_at)}</span>
          </div>
          <h3><a href="/lab?post=${encodeURIComponent(p.id)}">${esc(p.title)}</a></h3>
          <p class="cp-by">by ${o.by}</p>
          ${o.body}
          ${desc ? `<p class="dr-desc">${esc(desc)}</p>` : ""}
          ${credits ? `<p class="dr-credits"><span>Credits</span> ${esc(credits)}</p>` : ""}
          ${link ? `<p class="dr-link"><a href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow ugc">Listen on ${esc(linkHost(link))} &nearr;</a></p>` : ""}
          ${tagsHtml(p)}
          ${actionsHtml(p, ctx, o.liked, o.mine, dropShareUrl(p.author && p.author.handle))}
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
      const tg = e.target.closest("a[data-tag]");
      if (tg && YLY_API.onTag) { e.preventDefault(); YLY_API.onTag(tg.dataset.tag); return; }
      const pb = e.target.closest("button[data-play]");
      if (pb) { togglePlay(pb); return; }
      const wv = e.target.closest("[data-seek]");
      if (wv) {
        const btn = wv.closest(".cp")?.querySelector("button[data-play]");
        if (btn) { const r = wv.getBoundingClientRect(); togglePlay(btn, Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }
        return;
      }
      if (e.target.closest("button[data-drop-edit]")) { if (window.DropUpload) window.DropUpload.open(); else me().then(m => { location.href = m && m.profile ? "profile.html?u=" + encodeURIComponent(m.profile.handle) + "#drop" : loginUrl(); }); return; }
      const b = e.target.closest("button[data-like],button[data-share],button[data-report],button[data-delete],button[data-feature],button[data-hide]");
      if (!b) return;
      const m = await me();
      try {
        if (b.dataset.share) {
          let url = b.dataset.shareUrl || postLink(b.dataset.share);
          // Eigener Drop: Share-Seite (Vorschaubild) vorher aktualisieren
          if (b.dataset.shareUrl && b.hasAttribute("data-mine") && window.DropUpload) {
            b.disabled = true;
            try { url = await window.DropUpload.share(); } catch (_) { url = postLink(b.dataset.share); } finally { b.disabled = false; }
          }
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
          const card = b.closest(".cp"), file = card?.dataset.audio;
          const { error } = await db.from("posts").delete().eq("id", b.dataset.delete);
          if (error) throw error;
          if (file) { try { await labFn({ action: "delete", url: file }); } catch (_) { /* post is gone; a leftover file is harmless */ } }
          if (player.btn && card && card.contains(player.btn)) stopPlayer();
          card?.remove(); toast("Post deleted.");
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

  const YLY_API = { db, $, esc, me, resetMe, loginUrl, renderAuthChip, timeAgo, postCard, likedSet, bindActions, toast, POST_SELECT, LINKS, toolUrl, remixUrl, labFn, pdata, fmtDur, tagsOf, TAG_RE, AUDIO_RE, onTag: null, stopPlayer, dropShareUrl, dropCover, dropTheme, DROP_COLORS, DROP_STYLES, LINK_RE };
  return YLY_API;
})();

/* freepacks.js - YARDSLOVESSOUNDS auf free.html:
   Hub (kein ?ep): Episoden-Karten aus der Tabelle free_packs (Abschnitt bleibt verborgen, solange keine Zeilen da sind).
   Fokus (?ep=<slug> | latest): nur Formular fuer ein Gratis-Pack, Mail ueber die Function free-kit.
   Karte "Where should I record next?" (#suggest) in Hub UND Fokus: Ortsvorschlag ueber die Function suggest-place.
   Faellt bei jedem Fehler still zurueck (Hub ohne Serie bzw. eingebauter Essentials-Lite-Standard). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var cfg = window.APP_CONFIG || {};
  var KEY = "yly_fp_v1", TTL = 10 * 60 * 1000;
  var DEFAULT_SLUG = "essentials-lite";
  var DEFAULT_HEADLINE = "Get the raw sounds behind this beat";
  var DEFAULT_SUB = "Every episode of YARDSLOVESSOUNDS starts with one place, five sounds and 20 minutes of recording. Get the raw samples from this episode for free and build your own beat from them.";
  var DEFAULT_KIT = {
    slug: DEFAULT_SLUG, kind: "kit", episode_no: null, title: "Essentials Lite", place: "", headline: "Essentials Lite",
    description: "20 hand-crafted percussion one-shots, straight from Essentials. 100% royalty-free. Enter your email and the download link lands in your inbox.",
    items: ["20 hand-crafted percussion one-shots", "Royalty-free, also for released music"],
    youtube_id: null, thumb_url: null, coming_soon: false
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var $ = function (id) { return doc.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var mark = '<span class="fp-mark">YARDS<span>LOVESSOUNDS</span></span>';
  var YT_RE = /^[A-Za-z0-9_-]{6,20}$/;
  var okUrl = function (u) { return typeof u === "string" && /^https:\/\//i.test(u) ? u : ""; };
  var thumbOf = function (r) { return r.youtube_id && YT_RE.test(r.youtube_id) ? "https://i.ytimg.com/vi/" + r.youtube_id + "/hqdefault.jpg" : okUrl(r.thumb_url); };
  var track = function (n, d) { try { window.ylyTrack && window.ylyTrack(n, d); } catch (e) {} };

  var ep = null;
  try { ep = new URLSearchParams(location.search).get("ep"); } catch (e) {}
  ep = ep == null ? null : String(ep).trim().toLowerCase();

  var baseTitle = doc.title;
  var metaDesc = doc.querySelector('meta[name="description"]');
  var baseDesc = metaDesc ? metaDesc.getAttribute("content") : "";

  // ---- Daten (REST, 10 Min. Cache; Fehler => leere Liste) ----
  function readCache() {
    try { var o = JSON.parse(sessionStorage.getItem(KEY)); if (o && Date.now() - o.t < TTL && Array.isArray(o.d)) return o.d; } catch (e) {}
    return null;
  }
  function writeCache(d) { try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
  function loadRows() {
    var c = readCache();
    if (c) return Promise.resolve(c);
    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || String(cfg.SUPABASE_URL).indexOf("https://") !== 0) return Promise.resolve([]);
    var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
    if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split(".").length === 3) h.Authorization = "Bearer " + cfg.SUPABASE_PUBLISHABLE_KEY;
    var q = "free_packs?select=slug,kind,episode_no,title,place,headline,description,items,youtube_id,thumb_url,coming_soon,sort&published=eq.true&order=episode_no.desc.nullslast,sort.asc";
    return fetch(cfg.SUPABASE_URL + "/rest/v1/" + q, { headers: h })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { d = Array.isArray(d) ? d : []; writeCache(d); return d; })
      .catch(function () { return []; });
  }
  var episodesOf = function (rows) { return rows.filter(function (r) { return r && r.kind === "episode" && r.slug; }); };

  // ---- Ortsvorschlag ("Where should I record next?") ----
  function suggestHtml() {
    return '<div class="fp-sug-text"><p class="eyebrow"><span class="area-ico" aria-hidden="true"></span>SUGGEST A PLACE</p>' +
      '<h2 id="ps-title">Where should I record next?</h2>' +
      '<p class="muted">Know a place that sounds great? A parking garage, a workshop, a train station? Tell me and it might be the next episode.</p></div>' +
      '<form class="fp-sug-form" id="ps-form" novalidate>' +
      '<label class="fp-lbl" for="ps-place">Place</label>' +
      '<input id="ps-place" type="text" maxlength="120" placeholder="e.g. a parking garage" autocomplete="off" required>' +
      '<label class="fp-lbl" for="ps-note">Note <span class="fp-opt">(optional)</span></label>' +
      '<textarea id="ps-note" rows="2" maxlength="500" placeholder="Why does it sound good?"></textarea>' +
      '<label class="fp-lbl" for="ps-name">Name <span class="fp-opt">(optional)</span></label>' +
      '<input id="ps-name" type="text" maxlength="40" placeholder="Your name" autocomplete="given-name">' +
      '<div class="fp-hp" aria-hidden="true"><label for="ps-website">Website</label><input id="ps-website" type="text" tabindex="-1" autocomplete="off"></div>' +
      '<button id="ps-btn" class="button" type="submit">Suggest a place</button>' +
      '<p id="ps-status" class="status" role="status"></p></form>';
  }
  function wireSuggest(sec) {
    var form = sec.querySelector("#ps-form"); if (!form) return;
    var place = sec.querySelector("#ps-place"), note = sec.querySelector("#ps-note"), nameEl = sec.querySelector("#ps-name"),
      hp = sec.querySelector("#ps-website"), btn = sec.querySelector("#ps-btn"), status = sec.querySelector("#ps-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.classList.remove("danger"); status.textContent = "";
      var p = place.value.trim();
      if (!p) { status.textContent = "Please tell me the place."; status.classList.add("danger"); place.focus(); return; }
      if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) { status.textContent = "Service is not available right now. Please try again."; status.classList.add("danger"); return; }
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending …";
      var h = { "Content-Type": "application/json", apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
      if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split(".").length === 3) h.Authorization = "Bearer " + cfg.SUPABASE_PUBLISHABLE_KEY;
      fetch(cfg.SUPABASE_URL + "/functions/v1/suggest-place", { method: "POST", headers: h,
        body: JSON.stringify({ place: p, note: note.value.trim(), name: nameEl.value.trim(), website: hp.value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || "Something went wrong.");
          track("place-suggest", {});
          form.innerHTML = '<div class="fp-done" role="status"><strong>Thanks! Maybe your place is next.</strong></div>';
        })
        .catch(function (err) {
          var m = String(err && err.message || "Something went wrong.");
          status.textContent = /try again|later/i.test(m) ? m : m.replace(/[.!?\s]*$/, "") + ". Please try again.";
          status.classList.add("danger");
          btn.disabled = false; btn.textContent = label;
        });
    });
  }
  function mountSuggest(sec) {
    if (!sec) return;
    sec.innerHTML = suggestHtml();
    sec.classList.remove("hidden");
    wireSuggest(sec);
  }
  var hubSuggest = $("suggest");

  // ---- Hub ----
  function renderHub(rows) {
    var eps = episodesOf(rows), sec = $("series");
    if (!sec || !eps.length) return;
    var grid = $("series-grid");
    grid.innerHTML = eps.map(function (r) {
      var img = thumbOf(r);
      var title = (r.episode_no ? "#" + r.episode_no + " " : "") + (r.title || "Episode");
      var thumb = img
        ? '<img src="' + esc(img) + '" alt="" loading="lazy" width="480" height="270">'
        : '<span class="fp-ph">' + esc(r.place || r.title || "") + "</span>";
      var action = r.coming_soon
        ? '<button class="button" type="button" disabled>Coming soon</button>'
        : '<a class="button" href="free.html?ep=' + encodeURIComponent(r.slug) + '">Get the sounds</a>';
      return '<article class="fp-card"><div class="fp-thumb">' + thumb + '</div><div class="fp-body">' +
        "<h3>" + esc(title) + "</h3>" +
        (r.place ? '<p class="muted fp-place">' + esc(r.place) + "</p>" : "") + action + "</div></article>";
    }).join("");
    sec.classList.remove("hidden");
  }

  // ---- Fokus ----
  function setMeta(title, desc) {
    doc.title = title;
    if (metaDesc && desc) metaDesc.setAttribute("content", desc);
  }
  function backHub() {   // unbekannter Slug => normale Hub-Seite
    root.classList.remove("fp-focus");
    var f = $("fp-focus"); if (f) f.classList.add("hidden");
    doc.title = baseTitle; if (metaDesc) metaDesc.setAttribute("content", baseDesc);
    mountSuggest(hubSuggest);
    loadRows().then(renderHub);
  }
  function renderFocus(p) {
    var f = $("fp-focus"); if (!f) return;
    var isEp = p.kind === "episode";
    var epLine = isEp ? "#" + (p.episode_no || "") + (p.place ? " · " + p.place : "") : "";
    var yt = p.youtube_id && YT_RE.test(p.youtube_id) ? p.youtube_id : "";
    var img = thumbOf(p);
    var items = (p.items || []).filter(Boolean);
    var head = isEp ? (p.headline || DEFAULT_HEADLINE) : (p.headline || p.title || "Essentials Lite");
    var sub = p.description || (isEp ? DEFAULT_SUB : "");
    var media = "";
    if (yt) {
      media = '<a class="fp-yt" href="https://www.youtube.com/watch?v=' + encodeURIComponent(yt) + '" target="_blank" rel="noopener noreferrer" aria-label="Watch the episode on YouTube (opens in a new tab)">' +
        '<img src="' + esc(img) + '" alt="" width="480" height="360"><span class="fp-play" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span></a>';
    } else if (img) {
      media = '<div class="fp-yt"><img src="' + esc(img) + '" alt="" width="480" height="270"></div>';
    }
    var left = '<span class="fp-mark fp-mark-line">YARDS<span>LOVESSOUNDS</span></span>' +
      (epLine ? '<p class="fp-ep-line">' + esc(epLine) + "</p>" : "") +
      "<h1>" + esc(head) + "</h1>" +
      (sub ? '<p class="muted">' + esc(sub) + "</p>" : "") + media +
      (items.length ? '<div class="fp-inside"><h2>What’s inside</h2><ul>' + items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul></div>" : "");
    var right;
    if (p.coming_soon) {
      right = '<div class="fp-card-form fp-soon-box"><strong>Episode ' + esc(p.episode_no || "") + " drops soon</strong>" +
        '<p class="muted" style="margin:0">The sounds from this episode aren’t ready yet. In the meantime, grab a free percussion kit.</p>' +
        '<a class="button" href="free.html?ep=' + DEFAULT_SLUG + '">Get Essentials Lite</a></div>';
    } else {
      right = '<div class="fp-card-form" id="fp-card"><form id="fp-form" novalidate>' +
        '<label class="fp-lbl" for="fp-email">Your email</label>' +
        '<input id="fp-email" type="email" placeholder="your@email.com" autocomplete="email" required>' +
        '<label class="consent"><input id="fp-consent" type="checkbox"><span>Yes, send me new releases and deals by email. I can unsubscribe at any time.</span></label>' +
        '<button id="fp-btn" class="button" type="submit">Send me the sounds</button>' +
        '<p class="fp-note" id="fp-note">You’ll get the pack by email.</p>' +
        '<p class="fp-lic">Royalty-free, also for released music.</p>' +
        '<p class="hint">We use your email to send you the download. See our <a href="privacy.html">privacy policy</a>.</p>' +
        '<p id="fp-status" class="status" role="status"></p></form></div>';
    }
    f.innerHTML = '<div class="fp-grid2"><div>' + left + "</div><div>" + right + '</div></div><a class="fp-more" href="free.html">More free sounds</a>';
    f.classList.remove("hidden");
    if (hubSuggest && hubSuggest.parentNode) hubSuggest.parentNode.removeChild(hubSuggest);   // Fokus-Seite hat eine eigene Karte (keine doppelte id)
    var sg = doc.createElement("section");
    sg.className = "fp-suggest fp-suggest-focus"; sg.id = "suggest"; sg.setAttribute("aria-labelledby", "ps-title");
    f.appendChild(sg); mountSuggest(sg);
    if (location.hash === "#suggest") { try { sg.scrollIntoView(); } catch (e) {} }
    var label = isEp ? (p.title || "Episode") + " - free sounds" : (p.title || "Free kit");
    setMeta(label + " · YARDSLOVESSOUNDS", isEp
      ? "Get the raw sounds from " + (p.title || "this episode") + " for free. One place, five sounds, 20 minutes. Royalty-free, also for released music."
      : "Get " + (p.title || "the free kit") + " for free. Royalty-free, also for released music.");
    if (!p.coming_soon) wireForm(p);
    track("pack-view", { pack: p.slug });
  }
  function wireForm(p) {
    var form = $("fp-form"), email = $("fp-email"), consent = $("fp-consent"), btn = $("fp-btn"), status = $("fp-status"), note = $("fp-note");
    if (!form) return;
    consent.addEventListener("change", function () {
      note.textContent = consent.checked ? "You’ll get the pack by email, plus a few short emails from me about the series." : "You’ll get the pack by email.";
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.classList.remove("danger"); status.textContent = "";
      var addr = email.value.trim();
      if (!EMAIL_RE.test(addr)) { status.textContent = "Please enter a valid email address."; status.classList.add("danger"); email.focus(); return; }
      if (!cfg.SUPABASE_URL) { status.textContent = "Service is not available right now. Please try again."; status.classList.add("danger"); return; }
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending …";
      var h = { "Content-Type": "application/json", apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
      if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split(".").length === 3) h.Authorization = "Bearer " + cfg.SUPABASE_PUBLISHABLE_KEY;
      fetch(cfg.SUPABASE_URL + "/functions/v1/free-kit", { method: "POST", headers: h, body: JSON.stringify({ email: addr, marketing_consent: consent.checked, pack: p.slug }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || "Something went wrong.");
          track(p.kind === "episode" ? "pack-signup" : "freekit-signup", { pack: p.slug });
          var card = $("fp-card");
          card.innerHTML = '<div class="fp-done" role="status"><strong>' + (res.j.already_sent ? "Already on its way" : "Check your inbox") + "</strong>" +
            '<p class="muted" style="margin:0">' + (res.j.already_sent ? "We just sent it to you. Please check your inbox (and your spam folder)." : "The sounds are on their way. Check your inbox (and your spam folder, just in case).") + "</p></div>";
        })
        .catch(function (err) {
          var m = String(err && err.message || "Something went wrong.");
          status.textContent = /try again|try another/i.test(m) ? m : m.replace(/[.!?\s]*$/, "") + ". Please try again.";
          status.classList.add("danger");
          btn.disabled = false; btn.textContent = label;
        });
    });
  }

  function start() {
    if (ep === null || ep === "") { root.classList.remove("fp-focus"); mountSuggest(hubSuggest); loadRows().then(renderHub); return; }
    loadRows().then(function (rows) {
      var pick = null;
      if (ep === "latest") {
        pick = episodesOf(rows).filter(function (r) { return !r.coming_soon; })[0] || null;
        if (!pick) pick = rows.filter(function (r) { return r.slug === DEFAULT_SLUG; })[0] || DEFAULT_KIT;
      } else {
        pick = rows.filter(function (r) { return r.slug === ep; })[0] || (ep === DEFAULT_SLUG ? DEFAULT_KIT : null);
      }
      if (!pick) return backHub();
      renderFocus(pick);
    });
  }
  start();
})();

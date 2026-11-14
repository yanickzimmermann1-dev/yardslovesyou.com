/* service-reviews.js – "What artists say": freigegebene Service-Bewertungen auf upload.html.
   EIN REST-GET (Tabelle service_reviews, nur status=approved per RLS, neueste 6, Gesamtzahl aus Content-Range),
   10 Minuten in sessionStorage gecacht. Bei 0 Bewertungen oder Fehler bleibt der Bereich versteckt. Kein Inline-Code (strikte CSP). */
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var sec = document.getElementById("artists-say");
  if (!sec || !cfg.SUPABASE_URL || String(cfg.SUPABASE_URL).indexOf("https://") !== 0 || !window.fetch) return;

  var KEY = "yly_sr_v1", TTL = 10 * 60 * 1000, LIMIT = 6;
  var LABEL = { "mastering": "Mastering", "mix-master": "Mix + Master", "stem-mastering": "Stem Mastering", "mixing": "Mixing", "vocal-hook": "Vocal Hook", "vocal-mix": "Vocal Mix" };
  var STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7 6.1 20.8l1.2-6.5L2.5 9.7l6.6-.9z"/></svg>';

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function five(size) { var s = STAR.replace(/\{s\}/g, size), o = ""; for (var i = 0; i < 5; i++) o += s; return o; }
  function stars(rating, size) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    return '<span class="sr-stars" role="img" aria-label="' + r.toFixed(1).replace(/\.0$/, "") + ' out of 5 stars">' +
      '<span class="sr-stars-bg" aria-hidden="true">' + five(size) + "</span>" +
      '<span class="sr-stars-fg" aria-hidden="true" style="width:' + (r / 5 * 100).toFixed(1) + '%">' + five(size) + "</span></span>";
  }
  function month(iso) { try { return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); } catch (_) { return ""; } }

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (c && Array.isArray(c.rows) && Date.now() - c.t < TTL) return c;
    } catch (_) {}
    return null;
  }
  function writeCache(rows, total) { try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), rows: rows, total: total })); } catch (_) {} }

  function fetchRows() {
    var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY, Prefer: "count=exact" };
    if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split(".").length === 3) h.Authorization = "Bearer " + cfg.SUPABASE_PUBLISHABLE_KEY;
    var url = cfg.SUPABASE_URL + "/rest/v1/service_reviews?status=eq.approved&select=id,service_type,rating,body,display_name,created_at&order=created_at.desc&limit=" + LIMIT;
    return fetch(url, { headers: h }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      var m = /\/(\d+)$/.exec(r.headers.get("Content-Range") || "");
      return r.json().then(function (d) { return { rows: Array.isArray(d) ? d : [], total: m ? +m[1] : null }; });
    });
  }

  function render(rows, total) {
    rows = rows.filter(function (x) { return x && x.rating >= 1 && x.rating <= 5; });
    if (!rows.length) { sec.hidden = true; return; }
    var n = total && total >= rows.length ? total : rows.length;
    var avg = rows.reduce(function (a, x) { return a + Number(x.rating); }, 0) / rows.length;
    var cards = rows.map(function (x) {
      return '<li class="sr-card">' + stars(x.rating, 16) +
        (x.body ? "<p>" + esc(x.body) + "</p>" : "") +
        '<div class="sr-meta"><strong>' + esc(x.display_name) + "</strong><span>" + esc(LABEL[x.service_type] || "Service") + (month(x.created_at) ? " · " + esc(month(x.created_at)) : "") + "</span></div></li>";
    }).join("");
    sec.innerHTML = '<h2 id="sr-h">What artists say</h2>' +
      '<div class="sr-sum">' + stars(avg, 22) + '<span class="sr-avg"><b>' + avg.toFixed(1) + '</b> / 5</span><span class="sr-n">' + n + " verified review" + (n === 1 ? "" : "s") + (n > rows.length ? " · average of the latest " + rows.length : "") + "</span></div>" +
      '<ul class="sr-list">' + cards + "</ul>";
    sec.setAttribute("aria-labelledby", "sr-h");
    sec.hidden = false;
  }

  var c = readCache();
  if (c) { render(c.rows, c.total); return; }
  fetchRows().then(function (d) { writeCache(d.rows, d.total); render(d.rows, d.total); }).catch(function () { sec.hidden = true; });
})();

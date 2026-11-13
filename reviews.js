/* reviews.js – Produkt-Bewertungen: Sterne, Liste auf der Produktseite, Bewertungs-Widget auf der Erfolgsseite.
   Exponiert window.YLYReviews = { stars, mountProduct, widget }. Kein Inline-Code (strikte CSP). */
(function () {
  var COLS = "id,product_id,rating,title,body,display_name,created_at";
  var STAR = '<svg viewBox="0 0 24 24" width="{s}" height="{s}" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7 6.1 20.8l1.2-6.5L2.5 9.7l6.6-.9z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';

  function escFn(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function five(size) { var s = STAR.replace(/\{s\}/g, size), o = ""; for (var i = 0; i < 5; i++) o += s; return o; }

  // 0..5 (auch Dezimal) -> Sterne-Markup
  function stars(rating, size) {
    size = size || 16;
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    return '<span class="rv-stars" role="img" aria-label="' + r.toFixed(1).replace(/\.0$/, "") + ' out of 5 stars">' +
      '<span class="rv-stars-bg" aria-hidden="true">' + five(size) + "</span>" +
      '<span class="rv-stars-fg" aria-hidden="true" style="width:' + (r / 5 * 100).toFixed(1) + '%">' + five(size) + "</span></span>";
  }

  var fmtDate = function (iso) {
    try { return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch (_) { return ""; }
  };
  var track = function (n, d) { try { if (window.ylyTrack) window.ylyTrack(n, d); } catch (_) {} };

  // Fehlertext aus functions.invoke (auch bei Status != 2xx)
  async function fnError(r) {
    var msg = r && r.data && r.data.error;
    if (!msg && r && r.error) {
      try { msg = (await r.error.context.json()).error; } catch (_) { msg = r.error.message; }
    }
    return msg || "";
  }

  // ---------- Produktseite ----------
  async function mountProduct(o) {
    var db = o.db, root = o.root, esc = o.esc || escFn;
    var res, ph = document.createElement("section");
    ph.className = "pd-section rv-section sk-rv"; ph.setAttribute("aria-hidden", "true");
    ph.innerHTML = '<div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-line w80"></div>';
    var f0 = root.querySelector(".pd-faq"), f0s = f0 && f0.closest("section"), s0 = root.querySelector("#pd-sticky");
    if (f0s && f0s.parentNode) f0s.parentNode.insertBefore(ph, f0s);
    else if (s0 && s0.parentNode) s0.parentNode.insertBefore(ph, s0);
    else root.appendChild(ph);
    var rm = function () { if (ph.parentNode) ph.parentNode.removeChild(ph); };
    try {
      res = await db.from("product_reviews").select(COLS).eq("product_id", o.productId).eq("status", "approved")
        .order("created_at", { ascending: false }).limit(500);
    } catch (_) { rm(); return; }
    rm();
    if (res && !res.error && res.data && !res.data.length) {
      // No reviews yet: calm empty state (reviews are only possible after a purchase, so no action buttons)
      var es = document.createElement("section");
      es.className = "pd-section rv-section"; es.id = "reviews"; es.setAttribute("aria-labelledby", "rv-h");
      es.innerHTML = '<h2 id="rv-h">Reviews</h2><div class="rv-empty-state"></div>';
      var holder = es.querySelector(".rv-empty-state");
      if (window.YLYState) window.YLYState.render(holder, { icon: "star", compact: true, title: "No reviews yet", text: "Be the first to review. Reviews can be written after purchase, from your order confirmation page." });
      else holder.textContent = "No reviews yet. Be the first to review after purchase.";
      var ef = root.querySelector(".pd-faq"), efs = ef && ef.closest("section"), est = root.querySelector("#pd-sticky");
      if (efs && efs.parentNode) efs.parentNode.insertBefore(es, efs);
      else if (est && est.parentNode) est.parentNode.insertBefore(es, est);
      else root.appendChild(es);
      return;
    }
    if (!res || res.error || !res.data || !res.data.length) return;
    var list = res.data, n = list.length;
    var sum = 0, dist = [0, 0, 0, 0, 0, 0];
    list.forEach(function (r) { var k = Math.max(1, Math.min(5, +r.rating || 0)); sum += k; dist[k]++; });
    var avg = sum / n, avgTxt = avg.toFixed(1), cnt = n + (n === 1 ? " review" : " reviews");

    // Zusammenfassung unter Titel/Preis
    var buyRow = root.querySelector(".pd-buy") || root.querySelector(".gd-buyrow");
    if (buyRow && !root.querySelector(".rv-sum")) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "rv-sum";
      b.innerHTML = stars(avg, 16) + "<span><b>" + avgTxt + "</b> · " + cnt + "</span>";
      b.addEventListener("click", function () {
        var s = document.getElementById("reviews");
        if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      buyRow.insertAdjacentElement("afterend", b);
    }

    // Sektion (vor der FAQ, sonst vor der Kaufleiste bzw. am Ende)
    var sec = document.createElement("section");
    sec.className = "pd-section rv-section"; sec.id = "reviews"; sec.setAttribute("aria-labelledby", "rv-h");
    var PAGE = 5, shown = 0;
    var item = function (r) {
      return '<li class="rv-item"><div class="rv-item-head">' + stars(r.rating, 15) +
        '<span class="rv-verified">' + CHECK + " Verified buyer</span></div>" +
        (r.title ? "<h3>" + esc(r.title) + "</h3>" : "") +
        (r.body ? "<p>" + esc(r.body).replace(/\n/g, "<br>") + "</p>" : "") +
        '<div class="rv-item-meta"><strong>' + esc(r.display_name) + "</strong><span>" + esc(fmtDate(r.created_at)) + "</span></div></li>";
    };
    var bars = "";
    for (var k = 5; k >= 1; k--) {
      bars += '<li><span>' + k + '</span><span class="rv-bar" aria-hidden="true"><i style="width:' + (dist[k] / n * 100).toFixed(1) + '%"></i></span><em>' + dist[k] + "</em></li>";
    }
    sec.innerHTML = '<h2 id="rv-h">Reviews</h2>' +
      '<div class="rv-top"><div class="rv-avg"><span class="rv-avg-num">' + avgTxt + '</span><span class="rv-avg-meta">' + stars(avg, 18) + "<span>" + cnt + "</span></span></div>" +
      '<ul class="rv-dist" aria-label="Rating distribution">' + bars + "</ul></div>" +
      '<ul class="rv-list"></ul>' +
      (n > PAGE ? '<button type="button" class="outline rv-more">Show more</button>' : "");
    var ul = sec.querySelector(".rv-list"), more = sec.querySelector(".rv-more");
    var showMore = function () {
      var next = list.slice(shown, shown + PAGE);
      ul.insertAdjacentHTML("beforeend", next.map(item).join(""));
      shown += next.length;
      if (more && shown >= n) more.remove();
    };
    showMore();
    if (more) more.addEventListener("click", showMore);

    var faq = root.querySelector(".pd-faq"), faqSec = faq && faq.closest("section");
    var sticky = root.querySelector("#pd-sticky");
    if (faqSec && faqSec.parentNode) faqSec.parentNode.insertBefore(sec, faqSec);
    else if (sticky && sticky.parentNode) sticky.parentNode.insertBefore(sec, sticky);
    else root.appendChild(sec);

    // JSON-LD erweitern
    try {
      var ld = document.getElementById("ld-product");
      if (ld) {
        var j = JSON.parse(ld.textContent);
        j.aggregateRating = { "@type": "AggregateRating", ratingValue: avgTxt, reviewCount: n, bestRating: "5", worstRating: "1" };
        j.review = list.slice(0, 5).map(function (r) {
          var o2 = {
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: String(r.rating), bestRating: "5", worstRating: "1" },
            author: { "@type": "Person", name: r.display_name },
            datePublished: String(r.created_at || "").slice(0, 10)
          };
          if (r.title) o2.name = r.title;
          if (r.body) o2.reviewBody = r.body;
          return o2;
        });
        ld.textContent = JSON.stringify(j);
      }
    } catch (_) {}
  }

  // ---------- Bewertungs-Widget (Erfolgsseite) ----------
  // o: { db, sessionId, productId, title }
  function widget(el, o) {
    var esc = escFn, value = 0;
    el.className = (el.className ? el.className + " " : "") + "rv-w";
    var btns = "";
    for (var i = 1; i <= 5; i++) {
      btns += '<button type="button" role="radio" aria-checked="false" aria-label="' + i + (i === 1 ? " star" : " stars") + '" data-v="' + i + '" tabindex="' + (i === 1 ? 0 : -1) + '">' +
        STAR.replace(/\{s\}/g, 34) + "</button>";
    }
    el.innerHTML = '<p class="rv-w-h">Rate <strong>' + esc(o.title) + '</strong></p>' +
      '<div class="rv-pick" role="radiogroup" aria-label="Your rating for ' + esc(o.title) + '">' + btns + "</div>" +
      '<form class="rv-form" hidden novalidate>' +
      '<input type="text" name="title" maxlength="80" placeholder="Title (optional)" aria-label="Review title (optional)" autocomplete="off">' +
      '<textarea name="body" rows="3" maxlength="800" placeholder="Your review (optional)" aria-label="Your review (optional)"></textarea>' +
      '<input type="text" name="name" maxlength="40" placeholder="Your name" aria-label="Your name" autocomplete="off" required>' +
      '<div><button type="submit" class="button">Submit review</button></div></form>' +
      '<p class="status rv-msg" role="status"></p>';

    var pick = el.querySelector(".rv-pick"), form = el.querySelector(".rv-form"), msg = el.querySelector(".rv-msg");
    var bs = [].slice.call(pick.querySelectorAll("button"));
    var paint = function (n) { bs.forEach(function (b, i) { b.classList.toggle("on", i < n); }); };
    var set = function (n, focus) {
      value = n;
      bs.forEach(function (b, i) { b.setAttribute("aria-checked", i + 1 === n ? "true" : "false"); b.tabIndex = (i + 1 === n || (!n && i === 0)) ? 0 : -1; });
      paint(n);
      form.hidden = false;
      if (focus) bs[n - 1].focus();
    };
    bs.forEach(function (b) {
      b.addEventListener("mouseenter", function () { paint(+b.dataset.v); });
      b.addEventListener("click", function () { set(+b.dataset.v); });
      b.addEventListener("keydown", function (e) {
        var cur = value || +b.dataset.v, nx = 0;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") nx = Math.min(5, cur + 1);
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") nx = Math.max(1, cur - 1);
        else if (e.key === "Home") nx = 1;
        else if (e.key === "End") nx = 5;
        if (nx) { e.preventDefault(); set(nx, true); }
      });
      b.addEventListener("focus", function () { paint(+b.dataset.v); });
      b.addEventListener("blur", function () { paint(value); });
    });
    pick.addEventListener("mouseleave", function () { paint(value); });

    var say = function (t, bad) { msg.textContent = t; msg.classList.toggle("danger", !!bad); };
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      if (!value) { say("Please choose a star rating.", true); return; }
      if (!name) { say("Please enter your name.", true); form.elements.name.focus(); return; }
      var sb = form.querySelector('button[type="submit"]');
      sb.disabled = true; say("Sending …");
      try {
        var r = await o.db.functions.invoke("submit-review", { body: {
          session_id: o.sessionId, product_id: o.productId, rating: value,
          title: form.elements.title.value.trim(), body: form.elements.body.value.trim(), name: name
        } });
        var err = await fnError(r);
        if (err) throw new Error(err);
        track("review-submit", { product: o.productId });
        el.innerHTML = '<p class="rv-thanks" role="status">Thanks! Your review will appear after a quick check.</p>';
      } catch (ex) { say(ex.message || "Could not send your review.", true); sb.disabled = false; }
    });
  }

  window.YLYReviews = { stars: stars, mountProduct: mountProduct, widget: widget, fnError: fnError };
})();

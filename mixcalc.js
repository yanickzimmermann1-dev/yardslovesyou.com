/* "Find your service" wizard. Prices/names are read from the existing form radios
   (data-price / data-name); the server recomputes the price anyway. */
(function () {
  "use strict";
  var root = document.getElementById("mixcalc");
  if (!root) return;

  var NS = "http://www.w3.org/2000/svg";
  var reduce = false;
  try { reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) {}

  function icon(paths, size) {
    var s = size || 24;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + paths + "</svg>";
  }
  var ICON = {
    mix: icon('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="18" r="2" fill="currentColor"/>'),
    beat: icon('<path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4"/>'),
    mic: icon('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>'),
    polish: icon('<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z"/><path d="m18.5 15 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z"/>'),
    loud: icon('<path d="M4 10v4h3l5 4V6L7 10H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
    sit: icon('<path d="M3 15c3 0 3-6 6-6s3 6 6 6 3-6 6-6"/><path d="M3 20h18"/>'),
    hook: icon('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
    check: icon('<path d="m5 12.5 4.5 4.5L19 7.5"/>', 18),
    arrow: icon('<path d="M5 12h14M13 6l6 6-6 6"/>', 20)
  };

  // Copy is taken from index.html service cards and the upload form hints.
  var SERVICES = {
    "mastering": {
      desc: "Your finished mix, mastered for release: loud, balanced and ready for every streaming platform.",
      inc: ["Streaming-ready master as WAV + MP3", "1 revision included", "Delivered in 3 business days"]
    },
    "stem-mastering": {
      desc: "Send up to 8 stems and get a release-ready master with the punch and loudness your track deserves.",
      inc: ["Up to 8 stems in one ZIP file", "1 revision, WAV + MP3", "Delivered in 5 business days"]
    },
    "mixing": {
      desc: "Balance, depth and clarity: up to 30 stems mixed into a cohesive, professional sounding track.",
      inc: ["Up to 30 stems in one ZIP file", "3 revisions included", "Delivered in 7 business days"]
    },
    "mix-master": {
      desc: "Mixing and mastering in one package: from stems to a finished, release-ready track.",
      inc: ["Mixing of up to 30 stems plus mastering", "3 revisions, save CHF 20 vs. booking both", "Delivered in 7 business days"]
    },
    "custom-beat": {
      desc: "A beat produced from scratch for you. Send an inquiry with your vibe and references and get a quote by email.",
      inc: ["Made for you, from scratch", "Simple inquiry form, no payment up front", "Quote by email, from CHF 300"]
    }
  };

  // step1 answer -> step2 answer -> [recommended, alternative]
  var MAP = {
    stems: { loud: ["mix-master", "mixing"], vocals: ["mixing", "mix-master"], custom: ["custom-beat", "mixing"] },
    beat:  { loud: ["stem-mastering", "mixing"], vocals: ["mixing", "mix-master"], custom: ["custom-beat", "mixing"] },
    vox:   { loud: ["mix-master", "mixing"], vocals: ["mixing", "mix-master"], custom: ["custom-beat", "mixing"] },
    master:{ loud: ["mastering", "stem-mastering"], vocals: ["mastering", "mixing"], custom: ["custom-beat", "mastering"] }
  };
  var Q1 = [
    { id: "stems", ico: "mix", t: "Beat and vocals as stems", d: "Everything is recorded and ready, but not mixed yet." },
    { id: "beat", ico: "beat", t: "Only a beat or instrumental", d: "Instrumental stems, no vocals yet." },
    { id: "vox", ico: "mic", t: "Vocals on a 2-track beat", d: "A bought or leased beat plus my own vocal stems." },
    { id: "master", ico: "polish", t: "A mix that needs the final polish", d: "The mix is done, it needs the last step." }
  ];
  var Q2 = [
    { id: "loud", ico: "loud", t: "Radio-ready loudness", d: "Punch, level and a finished sound." },
    { id: "vocals", ico: "sit", t: "Vocals that sit right", d: "Clear, balanced and in the pocket." },
    { id: "custom", ico: "hook", t: "A beat made for me", d: "Produced from scratch, just for my project." }
  ];

  var radios = [].slice.call(document.querySelectorAll('input[name="service"]'));
  function radioFor(s) { for (var i = 0; i < radios.length; i++) if (radios[i].value === s) return radios[i]; return null; }
  function meta(s) {
    if (s === "custom-beat") return { name: "Custom Beat", price: 300, from: true };
    var r = radioFor(s);
    return r ? { name: r.dataset.name, price: parseInt(r.dataset.price, 10), from: r.dataset.kind === "inquiry" } : null;
  }
  // "CHF 60 / song" (custom beat: "from CHF 300"), same prices as the form radios
  function priceText(m, n) { var v = n == null ? m.price : n; return m.from ? "from CHF " + v : "CHF " + v + " / song"; }
  function track(name, svc) { try { window.ylyTrack && window.ylyTrack(name, { service: svc }); } catch (e) {} }

  var state = { step: 1, a1: null, a2: null, svc: null, alt: null };
  var formCard = document.querySelector(".upload-card");
  var countTimer = 0, finalTimer = 0;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function text(tag, cls, t) { var n = el(tag, cls); n.textContent = t; return n; }

  function setHash(svc) {
    try {
      var url = location.pathname + location.search + (svc ? "#svc=" + svc : "");
      history.replaceState(null, "", url);
    } catch (e) {}
  }
  function hashSvc() {
    var m = /(?:^|[#&])svc=([a-z-]+)/.exec(location.hash);
    return m && SERVICES[m[1]] && meta(m[1]) ? m[1] : null;
  }

  function dots(n) {
    var d = el("div", "mc-dots");
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", "Step " + n + " of 3");
    for (var i = 1; i <= 3; i++) d.appendChild(el("span", "mc-dot" + (i < n ? " is-done" : i === n ? " is-now" : "")));
    return d;
  }

  function scrollToForm() {
    if (state.svc === "custom-beat") formCard = document.getElementById("custom-beat") || formCard;
    else formCard = document.querySelector(".upload-card");
    if (!formCard) return;
    formCard.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    formCard.classList.remove("mc-flash");
    void formCard.offsetWidth;
    formCard.classList.add("mc-flash");
    setTimeout(function () { formCard.classList.remove("mc-flash"); }, 1900);
  }

  function preselect(svc) {
    if (svc === "custom-beat") return;
    var r = radioFor(svc);
    if (!r) return;
    r.checked = true;
    r.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function render(focus) {
    cancelAnimationFrame(countTimer); clearTimeout(finalTimer);
    root.textContent = "";
    var card = el("div", "mc-card");
    var top = el("div", "mc-top");
    top.appendChild(dots(state.step));
    var skip = text("button", "mc-skip", "I know what I need");
    skip.type = "button";
    skip.addEventListener("click", scrollToForm);
    top.appendChild(skip);
    card.appendChild(top);

    var stage = el("div", "mc-stage");
    var heading;
    if (state.step < 3) {
      var isOne = state.step === 1;
      card.appendChild(text("p", "mc-eyebrow", "Find your service"));
      heading = text("h2", "mc-q", isOne ? "What do you have?" : "What matters most?");
      heading.id = "mc-q";
      heading.tabIndex = -1;
      card.appendChild(heading);
      var list = isOne ? Q1 : Q2;
      var grid = el("div", "mc-opts" + (isOne ? "" : " is-3"));
      grid.setAttribute("role", "group");
      grid.setAttribute("aria-labelledby", "mc-q");
      list.forEach(function (o, i) {
        var b = el("button", "mc-opt");
        b.type = "button";
        b.style.setProperty("--i", i);
        b.appendChild(el("span", "mc-ico", ICON[o.ico]));
        var t = el("span", "mc-t");
        t.appendChild(text("strong", "", o.t));
        t.appendChild(text("span", "mc-d", o.d));
        b.appendChild(t);
        b.addEventListener("click", function () {
          b.classList.add("is-picked");
          setTimeout(function () { pick(o.id); }, reduce ? 0 : 220);
        });
        grid.appendChild(b);
      });
      stage.appendChild(grid);
      if (!isOne) {
        var back = text("button", "mc-link mc-back", "Back");
        back.type = "button";
        back.style.marginTop = "12px";
        back.addEventListener("click", function () { state.step = 1; render(true); });
        stage.appendChild(back);
      }
    } else {
      var m = meta(state.svc), info = SERVICES[state.svc];
      card.appendChild(text("p", "mc-eyebrow", "Your match"));
      heading = text("h2", "mc-q", "Here is what fits your track");
      heading.tabIndex = -1;
      card.appendChild(heading);
      var res = el("div", "mc-result");
      var rec = el("div", "mc-rec");
      rec.appendChild(text("span", "mc-badge", "Recommended"));
      rec.appendChild(text("h3", "mc-name", m.name));
      var price = text("p", "mc-price", priceText(m, reduce ? m.price : 0));
      price.setAttribute("aria-label", priceText(m));
      rec.appendChild(price);
      if (window.YLYPricing) { var ap = text("p", "mc-desc", window.YLYPricing.approx(m.price) + " (approx.)"); ap.style.margin = "-4px 0 8px"; ap.style.fontSize = "12px"; rec.appendChild(ap); }
      rec.appendChild(text("p", "mc-desc", info.desc));
      var ul = el("ul", "mc-inc");
      info.inc.forEach(function (s) {
        var li = el("li", "", ICON.check);
        li.appendChild(text("span", "", s));
        ul.appendChild(li);
      });
      rec.appendChild(ul);
      res.appendChild(rec);

      var go = el("button", "mc-go");
      go.type = "button";
      go.appendChild(text("span", "", "Continue with " + m.name));
      go.insertAdjacentHTML("beforeend", ICON.arrow);
      go.addEventListener("click", function () {
        track("mixcalc-continue", state.svc);
        preselect(state.svc);
        scrollToForm();
      });
      res.appendChild(go);

      var foot = el("div", "mc-foot");
      if (state.alt && meta(state.alt)) {
        var am = meta(state.alt);
        var alt = el("button", "mc-alt");
        alt.type = "button";
        alt.appendChild(text("span", "", "Or look at " + am.name));
        alt.appendChild(text("small", "", priceText(am)));
        alt.addEventListener("click", function () {
          var s = state.svc; state.svc = state.alt; state.alt = s;
          setHash(state.svc);
          track("mixcalc-result", state.svc);
          render(true);
        });
        foot.appendChild(alt);
      }
      var again = text("button", "mc-link", "Start over");
      again.type = "button";
      again.addEventListener("click", function () {
        state = { step: 1, a1: null, a2: null, svc: null, alt: null };
        setHash(null);
        render(true);
      });
      foot.appendChild(again);
      res.appendChild(foot);
      stage.appendChild(res);

      if (!reduce) {
        var t0 = performance.now(), dur = 700;
        (function tick(now) {
          var p = Math.min(1, ((now || performance.now()) - t0) / dur);
          var e = 1 - Math.pow(1 - p, 3);
          price.textContent = priceText(m, Math.round(m.price * e));
          if (p < 1) countTimer = requestAnimationFrame(tick);
        })(t0);
        finalTimer = setTimeout(function () { price.textContent = priceText(m); }, dur + 150);
      }
    }
    card.appendChild(stage);
    root.appendChild(card);
    if (focus && heading) { try { heading.focus({ preventScroll: true }); } catch (e) {} }
  }

  function pick(id) {
    if (state.step === 1) {
      state.a1 = id;
      state.step = 2;
      render(true);
    } else {
      state.a2 = id;
      var pair = MAP[state.a1][id];
      state.svc = pair[0];
      state.alt = pair[1];
      state.step = 3;
      setHash(state.svc);
      track("mixcalc-result", state.svc);
      render(true);
    }
  }

  function init() {
    var s = hashSvc();
    if (s) {
      state.svc = s; state.step = 3; state.alt = null;
      preselect(s);
    }
    render(false);
    root.hidden = false;
  }

  window.addEventListener("hashchange", function () {
    var s = hashSvc();
    if (s && s !== state.svc) { state = { step: 3, a1: null, a2: null, svc: s, alt: null }; preselect(s); render(false); }
  });

  if (document.readyState === "complete") init();
  else document.addEventListener("DOMContentLoaded", init);
})();

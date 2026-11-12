/* Custom cursor + magnetic buttons. Desktop fine pointer only, no reduced motion. */
(function () {
  "use strict";
  var mq = window.matchMedia;
  if (!mq || !mq("(hover:hover) and (pointer:fine)").matches || mq("(prefers-reduced-motion:reduce)").matches) return;

  /* Configurable maps (first match wins) */
  var HIDE = "input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]),textarea,select,[contenteditable='true'],[contenteditable='']";
  var LABELS = [
    [".p3d", "Drag"],
    [".play-btn,[data-player],.bl-play,.ba-play,.ba-i-play,.sp-pad,.pl-play,#drop-play", "Play"],
    [".product", "View"]
  ];
  var LINKS = "a[href],button,[role=button],label[for],summary,.cm-pill,.cm-tab,.outline,.button";
  var MAGNET = ".button,[data-buy],.cart-checkout,.gen-btn";
  var MAG_RANGE = 60, MAG_BTN = 6, MAG_LBL = 3;

  var root = document.documentElement;
  var dot = document.createElement("div"), ring = document.createElement("div"), inner = document.createElement("div"), lbl = document.createElement("span");
  dot.className = "yc-dot"; ring.className = "yc-ring"; inner.className = "yc-ring-in";
  inner.appendChild(lbl); ring.appendChild(inner);
  dot.setAttribute("aria-hidden", "true"); ring.setAttribute("aria-hidden", "true");
  (document.body || root).appendChild(dot); (document.body || root).appendChild(ring);

  var tx = -100, ty = -100, rx = -100, ry = -100, running = false, shown = false, lastLabel = "";

  function loop() {
    rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;
    ring.style.transform = "translate3d(" + rx.toFixed(1) + "px," + ry.toFixed(1) + "px,0)";
    if (Math.abs(tx - rx) < 0.1 && Math.abs(ty - ry) < 0.1) { running = false; return; }
    requestAnimationFrame(loop);
  }
  function kick() { if (!running && !document.hidden) { running = true; requestAnimationFrame(loop); } }

  function state(t) {
    var hide = false, link = false, label = "";
    if (t && t.closest) {
      if (t.closest(HIDE)) hide = true;
      else {
        for (var i = 0; i < LABELS.length; i++) if (t.closest(LABELS[i][0])) { label = LABELS[i][1]; break; }
        if (!label && t.closest(LINKS)) link = true;
      }
    }
    root.classList.toggle("yc-hide", hide);
    root.classList.toggle("yc-link", link);
    root.classList.toggle("yc-label", !!label);
    if (label !== lastLabel) { lastLabel = label; if (label) lbl.textContent = label; }
  }

  document.addEventListener("pointermove", function (e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY;
    dot.style.transform = "translate3d(" + tx + "px," + ty + "px,0)";
    if (!shown) { shown = true; rx = tx; ry = ty; root.classList.add("yc-on"); }
    state(e.target);
    magnet(e);
    kick();
  }, { passive: true });
  document.addEventListener("pointerdown", function () { root.classList.add("yc-down"); }, true);
  document.addEventListener("pointerup", function () { root.classList.remove("yc-down"); }, true);
  document.addEventListener("pointerleave", off); document.documentElement.addEventListener("mouseleave", off);
  window.addEventListener("blur", off);
  function off() { shown = false; root.classList.remove("yc-on", "yc-down"); resetMag(); }
  document.addEventListener("visibilitychange", function () { if (document.hidden) running = false; });

  /* ---------- Magnetic buttons ---------- */
  var cur = null;
  function labelOf(b) { var c = b.firstElementChild; return c && c.nodeType === 1 && !c.classList.contains("ripple") ? c : null; }
  function reset(b) {
    b.style.translate = ""; var l = labelOf(b); if (l) l.style.translate = "";
    b.style.removeProperty("transition-property");
  }
  function resetMag() { if (cur) { reset(cur); cur = null; } }
  function magnet(e) {
    var p = e.clientX, q = e.clientY, best = null, bd = 1e9;
    var c = e.target && e.target.closest ? e.target.closest(MAGNET) : null;
    var list = c ? [c] : Array.prototype.slice.call(document.querySelectorAll(MAGNET));
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.disabled || b.closest(".p3d,[data-nomagnet]")) continue;
      var r = b.getBoundingClientRect();
      if (!r.width) continue;
      var dx = Math.max(r.left - p, 0, p - r.right), dy = Math.max(r.top - q, 0, q - r.bottom), d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = b; }
    }
    if (cur && cur !== best) { reset(cur); cur = null; }
    if (!best || bd > MAG_RANGE) { if (cur) { reset(cur); cur = null; } return; }
    cur = best;
    var rr = best.getBoundingClientRect();
    var nx = Math.max(-1, Math.min(1, (p - (rr.left + rr.width / 2)) / (rr.width / 2 + MAG_RANGE)));
    var ny = Math.max(-1, Math.min(1, (q - (rr.top + rr.height / 2)) / (rr.height / 2 + MAG_RANGE)));
    best.style.translate = (nx * MAG_BTN).toFixed(1) + "px " + (ny * MAG_BTN).toFixed(1) + "px";
    var l = labelOf(best); if (l) l.style.translate = (nx * MAG_LBL).toFixed(1) + "px " + (ny * MAG_LBL).toFixed(1) + "px";
  }
})();

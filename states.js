/* states.js – tiny shared helper: window.YLYState.render(el,{icon,title,text,actions,error,compact})
   actions: [{label, href?, onClick?, primary?}]  (no inline handlers: strict CSP) */
(function () {
  var P = 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';
  var IC = {
    box: '<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
    wave: '<path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 11v2"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.8c1.8.7 3 2.4 3 5.2"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" ' + P + ' aria-hidden="true">' + (IC[name] || IC.box) + "</svg>";
  }
  function render(el, o) {
    if (!el) return null;
    o = o || {};
    el.textContent = "";
    var box = document.createElement("div");
    box.className = "yly-state" + (o.error ? " is-error" : "") + (o.compact ? " is-compact" : "");
    box.setAttribute("role", o.error ? "alert" : "status");
    var ic = document.createElement("div");
    ic.className = "yly-state-ic"; ic.innerHTML = svg(o.icon || (o.error ? "alert" : "box"));
    box.appendChild(ic);
    if (o.title) { var h = document.createElement("h3"); h.textContent = o.title; box.appendChild(h); }
    if (o.text) { var p = document.createElement("p"); p.textContent = o.text; box.appendChild(p); }
    var acts = o.actions || [];
    if (acts.length) {
      var row = document.createElement("div"); row.className = "yly-state-acts";
      acts.slice(0, 2).forEach(function (a, i) {
        var primary = a.primary != null ? a.primary : i === 0;
        var n = document.createElement(a.href ? "a" : "button");
        n.className = primary ? "button" : "outline";
        n.textContent = a.label;
        if (a.href) n.href = a.href;
        else { n.type = "button"; if (a.onClick) n.addEventListener("click", a.onClick); }
        row.appendChild(n);
      });
      box.appendChild(row);
    }
    el.appendChild(box);
    return box;
  }
  window.YLYState = { render: render, icon: svg };
})();

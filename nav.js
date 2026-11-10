/* nav.js – Shop-Dropdown im Desktop-Menue (nur wenn >=2 Kategorien Produkte haben).
   Macht bei jedem Fehler nichts; Handy (<=720px) bleibt unberuehrt (CSS blendet es aus). */
(function () {
  'use strict';
  try {
    var cfg = window.APP_CONFIG;
    if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || String(cfg.SUPABASE_URL).indexOf('https://') !== 0) return;
    var KEY = 'yly_nav_cats_v1', TTL = 10 * 60 * 1000;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function cached() {
      try { var o = JSON.parse(sessionStorage.getItem(KEY)); if (o && Date.now() - o.t < TTL && o.d && Array.isArray(o.d.list)) return o.d; } catch (e) {}
      return null;
    }
    function store(d) { try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
    function get(path) {
      var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
      if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
      return fetch(cfg.SUPABASE_URL + '/rest/v1/' + path, { headers: h }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    }
    function fetchCats() {
      return Promise.all([
        get('shop_categories?select=slug,name,tagline,sort&order=sort.asc'),
        get('shop_products?select=category&published=eq.true')
      ]).then(function (res) {
        var n = {};
        res[1].forEach(function (p) { if (p.category) n[p.category] = (n[p.category] || 0) + 1; });
        var list = res[0].filter(function (c) { return n[c.slug]; }).map(function (c) { return { slug: c.slug, name: c.name, tagline: c.tagline || '', n: n[c.slug] }; });
        var total = res[1].length;
        return { list: list, total: total };
      });
    }

    function build(data) {
      var nav = document.querySelector('.topbar nav[aria-label="Main"]');
      if (!nav || nav.querySelector('.nav-dd')) return;
      var shop = nav.querySelector('a[href="shop.html"]');
      if (!shop || !data || !data.list || data.list.length < 2) return;
      var wrap = document.createElement('span');
      wrap.className = 'nav-dd';
      shop.parentNode.insertBefore(wrap, shop);
      wrap.appendChild(shop);
      var id = 'nav-dd-panel';
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'nav-dd-toggle';
      btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', id); btn.setAttribute('aria-label', 'Shop categories');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
      var panel = document.createElement('div');
      panel.className = 'nav-dd-panel'; panel.id = id;
      var items = '<a href="shop.html"><span><strong>All products</strong></span><em>' + data.total + '</em></a>';
      data.list.forEach(function (c) {
        items += '<a href="shop.html?cat=' + encodeURIComponent(c.slug) + '"><span><strong>' + esc(c.name) + '</strong>' + (c.tagline ? '<small>' + esc(c.tagline) + '</small>' : '') + '</span><em>' + c.n + '</em></a>';
      });
      panel.innerHTML = items;
      wrap.appendChild(btn); wrap.appendChild(panel);

      var mq = window.matchMedia ? matchMedia('(min-width: 721px)') : null, timer = null;
      function isOpen() { return wrap.classList.contains('open'); }
      function open() { clearTimeout(timer); if (mq && !mq.matches) return; wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      function close(refocus) { byHover = false; clearTimeout(timer); wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus(); }
      var byHover = false;
      wrap.addEventListener('mouseenter', function () { if (!isOpen()) { byHover = true; open(); } });
      wrap.addEventListener('mouseleave', function () { timer = setTimeout(function () { close(); }, 160); });
      btn.addEventListener('click', function () { if (byHover) { byHover = false; return; } isOpen() ? close() : open(); });
      btn.addEventListener('focus', function () { try { if (btn.matches(':focus-visible')) open(); } catch (e) {} });
      wrap.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(true); }
        else if (e.key === 'ArrowDown' && e.target === btn) { e.preventDefault(); open(); var a = panel.querySelector('a'); if (a) a.focus(); }
        else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && panel.contains(e.target)) {
          e.preventDefault();
          var l = Array.prototype.slice.call(panel.querySelectorAll('a')), i = l.indexOf(e.target);
          l[(i + (e.key === 'ArrowDown' ? 1 : l.length - 1)) % l.length].focus();
        }
      });
      wrap.addEventListener('focusout', function (e) { if (!wrap.contains(e.relatedTarget)) close(); });
      document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
      if (mq) { var f = function () { if (!mq.matches) close(); }; if (mq.addEventListener) mq.addEventListener('change', f); else if (mq.addListener) mq.addListener(f); }
    }

    // fertige Daten laden; bei Fehlern (z.B. Tabelle fehlt noch) still bleiben
    function start() {
      var d = cached();
      if (d && d.list) return build(d);
      fetchCats().then(function (x) { store(x); build(x); }).catch(function () {});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  } catch (e) {}
})();

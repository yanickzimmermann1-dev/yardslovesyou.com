/* nav.js – Shop-Dropdown im Desktop-Menue (nur wenn >=2 Kategorien Produkte haben).
   Macht bei jedem Fehler nichts; Handy (<=720px) bleibt unberuehrt (CSS blendet es aus). */
(function () {
  'use strict';
  // iPhone: Web-Audio (Player, Perc Lab, Ear Trainer) auch bei Lautlos-Schalter hörbar machen
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  // Alter Deep-Link: Mix Check ist von free.html nach mixcheck.html umgezogen
  try { if (/free\.html$/.test(location.pathname) && /^#(mixcheck|mix-check)$/i.test(location.hash)) { location.replace('mixcheck.html'); return; } } catch (e) {}
  // Jahreszahl im Footer (frueher Inline-Script, wegen CSP hier)
  try { var yEl = document.getElementById('year'); if (yEl) yEl.textContent = new Date().getFullYear(); } catch (e) {}
  // Event-Helfer fuer die Statistik (macht nichts, wenn Umami nicht geladen ist; wirft nie)
  window.ylyTrack = function (name, data) {
    try { if (window.umami && typeof window.umami.track === 'function') { if (data) window.umami.track(name, data); else window.umami.track(name); } } catch (e) {}
  };
  // Umami Cloud (cookiefrei, EU): nur laden, wenn eine Website-ID in config.js steht
  try {
    var uid = window.APP_CONFIG && window.APP_CONFIG.UMAMI_WEBSITE_ID;
    if (typeof uid === 'string' && uid.trim() && !document.querySelector('script[data-website-id]')) {
      var us = document.createElement('script');
      us.defer = true; us.src = 'https://cloud.umami.is/script.js';
      us.setAttribute('data-website-id', uid.trim()); us.setAttribute('data-do-not-track', 'true');
      document.head.appendChild(us);
    }
  } catch (e) {}
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
      var items = '<a href="shop.html"><span><strong>All products</strong></span><em>' + (+data.total || 0) + '</em></a>';
      data.list.forEach(function (c) {
        items += '<a href="shop.html?cat=' + encodeURIComponent(c.slug) + '"><span><strong>' + esc(c.name) + '</strong>' + (c.tagline ? '<small>' + esc(c.tagline) + '</small>' : '') + '</span><em>' + (+c.n || 0) + '</em></a>';
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

/* Konto-Link in der Kopfzeile (.acct-link[data-acct], steht als normales "Sign in" im HTML, funktioniert ohne JS).
   - ausgeloggt: "Sign in" -> account.html?next=<diese Seite>
   - eingeloggt: "@handle" -> profile.html?u=handle (ohne Profil: "Account" -> account.html)
   Erkennung: zuerst sofort ueber die Supabase-Sitzung im localStorage (+ zwischengespeicherter Handle),
   danach verbindlich ueber window.YLY.me(), wo community-core.js geladen ist. Fehler bleiben still. */
(function () {
  'use strict';
  try {
    var a = document.querySelector('.topbar [data-acct]');
    if (!a) return;
    var base = (a.getAttribute('href') || 'account.html').split('?')[0];
    var dir = base.replace(/account\.html$/, '');
    var label = a.querySelector('.acct-t');
    var HKEY = 'yly_acct_handle_v1';
    var onAcct = /\/account\.html$/.test(location.pathname);
    function show(state, handle) {
      var text, href, title;
      if (state === 'in' && handle) { text = '@' + handle; href = dir + 'profile.html?u=' + encodeURIComponent(handle); title = 'Your profile'; }
      else if (state === 'in') { text = 'Account'; href = base; title = 'Your account'; }
      else { text = 'Sign in'; href = onAcct ? base : base + '?next=' + encodeURIComponent(location.href); title = 'Sign in or create an account'; }
      if (label) label.textContent = text;
      a.setAttribute('href', href);
      a.setAttribute('title', title);
      a.classList.toggle('is-in', state === 'in');
      if (onAcct || (state === 'in' && /\/profile\.html$/.test(location.pathname) && handle && location.search.indexOf('u=' + encodeURIComponent(handle)) !== -1)) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    function store(h) { try { if (h) localStorage.setItem(HKEY, h); else localStorage.removeItem(HKEY); } catch (e) {} }
    // 1) schnelle Vermutung aus dem localStorage (Supabase-Standard-Schluessel sb-<projekt>-auth-token)
    var guess = false, cachedHandle = null;
    try {
      // Rechtsseiten laden config.js nicht: dann den Schluessel im localStorage suchen
      var url = window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL, k = '';
      if (url) k = 'sb-' + new URL(url).hostname.split('.')[0] + '-auth-token';
      else for (var i = 0; i < localStorage.length; i++) { var n = localStorage.key(i); if (/^sb-[a-z0-9]+-auth-token$/.test(n)) { k = n; break; } }
      var raw = k && localStorage.getItem(k);
      var sess = raw ? JSON.parse(raw) : null;
      guess = !!(sess && (sess.user || sess.access_token || (sess.currentSession && sess.currentSession.user)));
      cachedHandle = localStorage.getItem(HKEY);
    } catch (e) {}
    if (!guess) store(null);
    show(guess ? 'in' : 'out', guess ? cachedHandle : null);
    // 2) verbindlich ueber community-core.js (nur wo geladen)
    function confirm() {
      var Y = window.YLY;
      if (!Y || typeof Y.me !== 'function') return;
      Y.me().then(function (m) {
        if (!m) { store(null); show('out'); return; }
        var h = m.profile && m.profile.handle;
        store(h || null); show('in', h || null);
      }).catch(function () {});
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', confirm); else confirm();
  } catch (e) {}
})();

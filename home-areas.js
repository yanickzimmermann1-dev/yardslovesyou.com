/* home-areas.js - live bits of the home page (index.html only), all through the shared Supabase client from community-core.js:
   1) Shop card: two small floating 3D products (shop_products, published; static cover as fallback)
   2) Lab card counter + "New in the Lab": ONE posts query (latest 3 + exact total count in the same response).
   Everything fails quietly: no data -> the block hides, the page never breaks. No inline code (strict CSP). */
(function () {
  'use strict';
  /* whole card clickable (inner links/buttons keep working; keyboard uses the inner primary button) */
  [].forEach.call(document.querySelectorAll('.ar-card[data-href]'), function (card) {
    card.addEventListener('click', function (e) {
      if (e.defaultPrevented || (window.getSelection && String(window.getSelection()).length)) return;
      if (e.target.closest && e.target.closest('a,button,input,select,textarea,label,summary,[role=button]')) return;
      var h = card.getAttribute('data-href'); if (h) window.location.href = h;
    });
  });
  var Y = window.YLY, cfg = window.APP_CONFIG || {};

  /* ---------- Mixing card: star rating line (ONE REST request, 10 min sessionStorage cache; hidden on 0 reviews / error) ---------- */
  (function () {
    var price = document.querySelector('.ar-mix .ar-price');
    if (!price || !cfg.SUPABASE_URL || String(cfg.SUPABASE_URL).indexOf('https://') !== 0 || !window.fetch) return;
    var KEY = 'yly_svc_rating_v1', TTL = 10 * 60 * 1000;
    var STAR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.7 6.1 20.8l1.2-6.5L2.5 9.7l6.6-.9z"/></svg>';
    var five = function () { var o = ''; for (var i = 0; i < 5; i++) o += STAR; return o; };
    function render(avg, n) {
      if (!(n > 0) || !(avg >= 1 && avg <= 5) || document.querySelector('.ar-rate')) return;
      var a = document.createElement('a');
      a.className = 'ar-rate';
      a.href = 'upload.html#artists-say';
      a.setAttribute('aria-label', 'Rated ' + avg.toFixed(1) + ' out of 5 by ' + n + ' artist' + (n === 1 ? '' : 's'));
      a.innerHTML = '<span class="ar-stars" aria-hidden="true"><span class="ar-stars-bg">' + five() + '</span><span class="ar-stars-fg" style="width:' + (Math.round(avg * 2) / 2 / 5 * 100) + '%">' + five() + '</span></span>' +
        '<b>' + avg.toFixed(1) + '</b><span class="ar-rate-n">from ' + n + ' artist' + (n === 1 ? '' : 's') + '</span>';
      price.insertAdjacentElement('afterend', a);
    }
    try {
      var c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.t < TTL) { render(Number(c.avg), Number(c.n)); return; }
    } catch (e) {}
    var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
    if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
    fetch(cfg.SUPABASE_URL + '/rest/v1/service_reviews?select=rating&status=eq.approved&limit=1000', { headers: h })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        var v = (Array.isArray(d) ? d : []).map(function (x) { return Number(x && x.rating); }).filter(function (x) { return x >= 1 && x <= 5; });
        var n = v.length, avg = n ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / n * 10) / 10 : 0;
        try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), avg: avg, n: n })); } catch (e) {}
        render(avg, n);
      }).catch(function () {});
  })();
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var prods = $('ar-prods'), count = $('lab-count'), nl = $('newlab'), grid = $('nl-grid');
  var done = function () { if (prods) prods.removeAttribute('aria-busy'); };
  if (!Y || !Y.db || !cfg.SUPABASE_URL) { if (prods) prods.hidden = true; return; }
  var db = Y.db;

  /* ---------- Shop: two 3D products ---------- */
  function model(p) {
    var m = p && p.model3d;
    if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } }
    return m && typeof m === 'object' && m.front && (m.type === 'book' || m.type === 'card') ? m : null;
  }
  function imgUrl(u) {
    var r = /^https:\/\//i.test(u) ? u : db.storage.from('coverart-products').getPublicUrl(u).data.publicUrl;
    return window.YLYMedia ? window.YLYMedia.url(r) : r;
  }
  function money(c, cur) {
    try { return (c / 100).toLocaleString('de-CH', { style: 'currency', currency: String(cur || cfg.CURRENCY || 'CHF').toUpperCase() }); }
    catch (e) { return 'CHF ' + (c / 100).toFixed(2); }
  }
  function loadShop() {
    if (!prods) return Promise.resolve();
    return db.from('shop_products').select('id,title,price_cents,currency,image_url,model3d').eq('published', true).order('created_at', { ascending: false }).limit(12)
      .then(function (r) {
        var list = (r.data || []);
        if (r.error || !list.length) { prods.hidden = true; return; }
        list = list.filter(function (p) { return model(p); }).concat(list.filter(function (p) { return !model(p); })).slice(0, 2);
        var link = function (id) { return window.YLYProducts ? window.YLYProducts.url(id) : 'product.html?id=' + encodeURIComponent(id); };
        prods.innerHTML = list.map(function (p) {
          return '<a class="ar-p" href="' + esc(link(p.id)) + '" aria-label="' + esc(p.title) + ', ' + esc(money(p.price_cents, p.currency)) + '">' +
            '<span class="ar-cover" data-p3d="' + esc(p.id) + '">' + (p.image_url ? '<img src="' + esc(imgUrl(p.image_url)) + '" alt="" width="300" height="300" loading="lazy" decoding="async">' : '') + '</span>' +
            '<span class="ar-p-t">' + esc(p.title) + '</span><span class="ar-p-price">' + esc(money(p.price_cents, p.currency)) + '</span></a>';
        }).join('');
        done();
        var mount = function () {
          if (!window.Product3D) return;
          [].forEach.call(prods.querySelectorAll('.ar-cover[data-p3d]'), function (c) {
            var p = list.filter(function (x) { return String(x.id) === c.dataset.p3d; })[0], m = model(p);
            if (m) { try { window.Product3D.mount(c, m, { size: 'small', alt: p.title }); } catch (e) {} }
          });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
      }).catch(function () { prods.hidden = true; });
  }

  /* ---------- Lab: counter + latest 3 posts (one request) ---------- */
  function loadLab() {
    if (!count && !grid) return Promise.resolve();
    return db.from('posts').select(Y.POST_SELECT, { count: 'exact' }).eq('hidden', false).order('created_at', { ascending: false }).limit(3)
      .then(function (r) {
        if (r.error) throw r.error;
        if (count && typeof r.count === 'number' && r.count > 0) {
          count.querySelector('strong').textContent = r.count.toLocaleString('en-US');
          count.hidden = false;
        }
        var posts = (r.data || []).filter(function (p) { return !p.hidden; });
        if (!grid || !nl || !posts.length) return;
        grid.innerHTML = posts.map(function (p) { return Y.postCard(p, {}); }).join('');
        nl.hidden = false;
      }).catch(function () { /* section stays hidden */ });
  }

  loadShop(); loadLab();
})();

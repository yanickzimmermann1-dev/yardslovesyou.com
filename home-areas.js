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
            if (m) { try { window.Product3D.mount(c, m, { size: 'small', still: true, alt: p.title }); } catch (e) {} }
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

/* crosssell.js - Cross-Sell auf Produktseiten (vanilla JS, CSP-konform).
   Guide-Seiten: "Complete the set" (Bundle + uebrige Guides). Andere Produkte: "You might also like".
   Haengt eine Sektion NACH <main id="product-root"> ein, damit product.js sie nicht ueberschreibt.
   Add-Buttons nutzen die Delegation aus cart.js (data-cart-add). */
(function () {
  'use strict';
  var BUNDLE = 'c2acae2f-390c-4af5-b7b9-1023c8e994fa';
  var GUIDES = ['0dfc444f-fd2e-4d1f-9196-0d438769641f', '36f3f7cd-3167-496a-a3b4-f4c036b58e0e', '5c25a310-80f3-4685-8103-7f7f146cf347', '697e8ff1-4278-46e7-bfad-63390932b7e7', '80dbc815-6313-41bf-8185-aeb150508d6c', 'e79a3d0a-8a26-4876-80cb-9718c85e0c50'];
  var cfg = window.APP_CONFIG || {};
  var root = document.getElementById('product-root');
  if (!root || !window.fetch || !cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || String(cfg.SUPABASE_URL).indexOf('https://') !== 0) return;

  (function () { if (!document.querySelector('link[href^="crosssell.css"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'crosssell.css?v=20261117a'; document.head.appendChild(l); } })();

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(cents, cur) {
    try { return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: String(cur || 'chf').toUpperCase() }); }
    catch (e) { return (cents / 100).toFixed(2) + ' ' + String(cur || '').toUpperCase(); }
  }
  function cover(u) {
    if (!u) return '';
    var r = /^https:\/\//i.test(u) ? u : String(cfg.SUPABASE_URL).replace(/\/$/, '') + '/storage/v1/object/public/coverart-products/' + String(u).split('/').map(encodeURIComponent).join('/');
    return window.YLYMedia ? window.YLYMedia.url(r) : r;
  }
  function pageUrl(id) { return window.YLYProducts ? window.YLYProducts.url(id) : 'product.html?id=' + encodeURIComponent(id); }
  function currentId() {
    var q = new URLSearchParams(location.search).get('id');
    if (q) return q;
    var slug = location.pathname.replace(/^.*\//, '').replace(/\.html$/, '');
    var map = (window.YLYProducts && window.YLYProducts.slugs) || {};
    for (var k in map) { if (map[k] === slug) return k; }
    return '';
  }
  function headers() {
    var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
    if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
    return h;
  }

  function card(p) {
    var img = cover(p.image_url);
    return '<article class="xs-card">' +
      '<a class="xs-img" href="' + esc(pageUrl(p.id)) + '" tabindex="-1" aria-hidden="true">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async" width="240" height="240">' : '') + '</a>' +
      '<div class="xs-body"><a class="xs-title" href="' + esc(pageUrl(p.id)) + '">' + esc(p.title) + '</a>' +
      '<span class="xs-price">' + esc(money(p.price_cents, p.currency)) + '</span>' +
      '<button type="button" class="outline" data-cart-add="' + esc(p.id) + '" data-cart-title="' + esc(p.title) + '" data-cart-price="' + esc(p.price_cents) + '" data-cart-currency="' + esc(p.currency) + '" data-cart-cover="' + esc(img) + '"><span class="cart-lbl">Add to cart</span></button></div>' +
      '</article>';
  }

  function render(list, id) {
    var cur = list.filter(function (p) { return p.id === id; })[0];
    if (!cur) return;
    var bundle = list.filter(function (p) { return p.id === BUNDLE; })[0];
    var isGuide = GUIDES.indexOf(id) > -1;
    var title, intro = '', cards = [], callout = '';

    if (isGuide) {
      title = 'Complete the set';
      var others = list.filter(function (p) { return GUIDES.indexOf(p.id) > -1 && p.id !== id; });
      cards = others;
      if (bundle) {
        var sum = list.filter(function (p) { return GUIDES.indexOf(p.id) > -1; }).reduce(function (a, p) { return a + p.price_cents; }, 0);
        var save = sum - bundle.price_cents;
        intro = save > 0 ? 'All ' + GUIDES.length + ' short guides in one download. Save ' + money(save, bundle.currency) + ' compared to buying them one by one.' : 'All ' + GUIDES.length + ' short guides in one download.';
        callout = '<div class="xs-bundle"><div><strong>' + esc(bundle.title) + '</strong><span>' + esc(money(bundle.price_cents, bundle.currency)) + '</span></div>' +
          '<div class="xs-actions"><a class="outline" href="' + esc(pageUrl(bundle.id)) + '">View bundle</a>' +
          '<button type="button" class="button" data-cart-add="' + esc(bundle.id) + '" data-cart-title="' + esc(bundle.title) + '" data-cart-price="' + esc(bundle.price_cents) + '" data-cart-currency="' + esc(bundle.currency) + '" data-cart-cover="' + esc(cover(bundle.image_url)) + '"><span class="cart-lbl">Add to cart</span></button></div></div>';
      }
    } else {
      title = 'You might also like';
      var rest = list.filter(function (p) { return p.id !== id && GUIDES.indexOf(p.id) === -1 && p.id !== BUNDLE; });
      if (bundle && id !== BUNDLE) rest.unshift(bundle);
      cards = rest.slice(0, 3);
    }
    if (!cards.length && !callout) return;

    var sec = document.getElementById('cross-sell');
    if (!sec) { sec = document.createElement('section'); sec.id = 'cross-sell'; sec.className = 'wrap xs'; sec.setAttribute('aria-labelledby', 'xs-h'); root.parentNode.insertBefore(sec, root.nextSibling); }
    sec.innerHTML = '<h2 id="xs-h">' + esc(title) + '</h2>' + (intro ? '<p class="muted xs-intro">' + esc(intro) + '</p>' : '') + callout +
      (cards.length ? '<div class="xs-grid">' + cards.map(card).join('') + '</div>' : '');
    try { if (window.ylyTrack) window.ylyTrack('crosssell-view', { id: id }); } catch (e) {}
  }

  function start() {
    var id = currentId();
    if (!id) return;
    fetch(cfg.SUPABASE_URL + '/rest/v1/shop_products?select=id,title,price_cents,currency,image_url&published=eq.true&order=created_at.desc', { headers: headers() })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        var list = (Array.isArray(rows) ? rows : []).map(function (p) {
          return { id: String(p.id), title: p.title, price_cents: Number(p.price_cents), currency: String(p.currency || 'chf').toLowerCase(), image_url: p.image_url };
        });
        render(list, id);
      }).catch(function () {});
  }
  // products-map.js / media.js laden defer vor diesem Skript; erst nach dem Parsen starten
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

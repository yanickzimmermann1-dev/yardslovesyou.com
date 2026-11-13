/* cart.js – Warenkorb mit Bundle-Rabatt (vanilla JS, keine Inline-Skripte/Handler, CSP-konform).
   State: localStorage "yly_cart" = [{id,title,price_cents,currency,cover}], Sync ueber Tabs per storage-Event.
   API: window.ylyCart = { add(item, fromEl), remove(id), has(id), items(), count(), clear(), open(), close() }
   Buttons: <button data-cart-add="ID" data-cart-title data-cart-price data-cart-currency data-cart-cover> (Delegation + Status-Sync). */
var TRUST_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z"/><path d="m9 12 2.2 2.2L15 10.4"/></svg>';
(function(){if(!document.querySelector('link[href^="trust.css"]')){var l=document.createElement('link');l.rel='stylesheet';l.href='trust.css?v=20261113q';document.head.appendChild(l);}})();
(function () {
  'use strict';
  var KEY = 'yly_cart', PKEY = 'yly_promo', PSRC = 'yly_promo_src', BUNDLE = 15, MAX = 10;
  var ESSENTIALS = '11f558ea-9332-4bf3-ad2f-d8327c489445', URL_PERCENT = 15;
  var PROMO_ERR = 'This code is invalid or expired.';
  var cfg = window.APP_CONFIG || {};
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var phoneMq = window.matchMedia ? matchMedia('(max-width: 720px)') : null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(cents, cur) {
    try { return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: String(cur || cfg.CURRENCY || 'CHF').toUpperCase() }); }
    catch (e) { return (cents / 100).toFixed(2) + ' ' + String(cur || '').toUpperCase(); }
  }
  function track(n, d) { try { if (window.ylyTrack) window.ylyTrack(n, d); } catch (e) {} }

  var I = {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2.3l2.1 11h10.4l2.1-8H6.2"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l.8 12.5h9.4L17.5 7"/><path d="M10 11v5M14 11v5"/></svg>',
    disc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7"/></svg>'
  };
  window.ylyCartIcons = I;

  /* ---------- State ---------- */
  var items = [];
  function clean(list) {
    var out = [], seen = {};
    (Array.isArray(list) ? list : []).forEach(function (x) {
      if (!x || x.id == null || seen[String(x.id)]) return;
      var price = Math.round(Number(x.price_cents));
      if (!isFinite(price) || price < 0) return;
      seen[String(x.id)] = 1;
      out.push({ id: String(x.id), title: String(x.title || 'Product').slice(0, 200), price_cents: price, currency: String(x.currency || cfg.CURRENCY || 'chf').toLowerCase(), cover: typeof x.cover === 'string' ? x.cover : '' });
    });
    return out.slice(0, MAX);
  }
  function load() {
    try { items = clean(JSON.parse(localStorage.getItem(KEY))); } catch (e) { items = []; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} }
  function has(id) { id = String(id); return items.some(function (i) { return i.id === id; }); }
  function count() { return items.length; }
  function calc() {
    var sub = 0, tot = 0, bundle = items.length >= 2;
    var rows = items.map(function (i) {
      var unit = bundle ? Math.round(i.price_cents * (100 - BUNDLE) / 100) : i.price_cents;
      sub += i.price_cents; tot += unit;
      return { item: i, unit: unit };
    });
    return { rows: rows, sub: sub, total: tot, saved: sub - tot, bundle: bundle, cur: items[0] ? items[0].currency : String(cfg.CURRENCY || 'chf').toLowerCase() };
  }

  /* ---------- Rabattcode (nur clientseitig gemerkt, Pruefung passiert in create-checkout) ---------- */
  function normCode(v) { return String(v == null ? '' : v).trim().toUpperCase(); }
  function validCode(c) { return /^[A-Z0-9][A-Z0-9-]{2,31}$/.test(c); }
  function getPromo() { try { var c = normCode(sessionStorage.getItem(PKEY)); return validCode(c) ? c : ''; } catch (e) { return ''; } }
  function promoFromUrl() { try { return sessionStorage.getItem(PSRC) === 'url'; } catch (e) { return false; } }
  function setPromo(c, src) {
    c = normCode(c);
    try {
      if (c && validCode(c)) { sessionStorage.setItem(PKEY, c); sessionStorage.setItem(PSRC, src || 'manual'); }
      else { sessionStorage.removeItem(PKEY); sessionStorage.removeItem(PSRC); }
    } catch (e) {}
    promoErr = '';
    if (built) { renderPromo(); render(); }
    try { window.dispatchEvent(new CustomEvent('yly-promo')); } catch (e) {}
  }
  var promoErr = '', promoOpen = false, promoSig = null, urlPromoNew = '';
  // ?promo=CODE in der URL: sofort merken (vor DOMContentLoaded), Hinweis kommt in start()
  (function () {
    try {
      var q = new URLSearchParams(location.search), c = normCode(q.get('promo'));
      if (c && validCode(c)) {
        sessionStorage.setItem(PKEY, c); sessionStorage.setItem(PSRC, 'url'); urlPromoNew = c;
        q.delete('promo');
        var qs = q.toString();
        try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) {}
      }
    } catch (e) {}
  })();

  /* ---------- Elemente ---------- */
  var btn, badge, root, drawer, listEl, emptyEl, upsellEl, footEl, promoEl, titleSmall, toastEl, toastTimer, lastFocus = null, built = false, busy = false;
  var products = null, productsP = null, reconciled = false, closeTimer = null;

  function mountBtn() {
    if (!btn) return;
    var top = document.querySelector('.topbar');
    var phone = phoneMq && phoneMq.matches;
    if (top && !phone) { if (btn.parentNode !== top) top.appendChild(btn); btn.classList.remove('cart-float'); }
    else { if (btn.parentNode !== document.body) document.body.appendChild(btn); btn.classList.add('cart-float'); }
  }
  function buildBtn() {
    btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'cart-btn'; btn.setAttribute('aria-haspopup', 'dialog');
    btn.innerHTML = I.cart + '<span class="cart-badge" aria-hidden="true">0</span>';
    badge = btn.querySelector('.cart-badge');
    btn.addEventListener('click', function () { open(); });
    mountBtn();
    if (phoneMq) { if (phoneMq.addEventListener) phoneMq.addEventListener('change', mountBtn); else if (phoneMq.addListener) phoneMq.addListener(mountBtn); }
  }

  function build() {
    if (built) return; built = true;
    root = document.createElement('div');
    root.className = 'cart-root'; root.hidden = true;
    root.innerHTML =
      '<div class="cart-overlay" data-cart-close></div>' +
      '<aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" tabindex="-1">' +
        '<div class="cart-head"><h2 id="cart-title">Your cart<small></small></h2><button type="button" class="cart-x" data-cart-close aria-label="Close cart">' + I.x + '</button></div>' +
        '<div class="cart-body"><ul class="cart-list"></ul><div class="cart-empty" hidden>' + I.cart + '<p>Your cart is empty.<br>Add a product and it will show up here.</p><a class="outline" href="shop.html">Browse the shop</a></div><section class="cart-upsell" hidden></section></div>' +
        '<div class="cart-promo" hidden></div>' +
        '<div class="cart-foot" hidden></div>' +
      '</aside>';
    document.body.appendChild(root);
    drawer = root.querySelector('.cart-drawer');
    listEl = root.querySelector('.cart-list');
    emptyEl = root.querySelector('.cart-empty');
    upsellEl = root.querySelector('.cart-upsell');
    footEl = root.querySelector('.cart-foot');
    promoEl = root.querySelector('.cart-promo');
    titleSmall = root.querySelector('.cart-head small');

    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest && t.closest('[data-cart-close]')) { close(); return; }
      var rm = t.closest && t.closest('[data-cart-rm]');
      if (rm) { remove(rm.getAttribute('data-cart-rm')); return; }
      var up = t.closest && t.closest('[data-cart-up]');
      if (up && products) {
        var p = products.filter(function (x) { return x.id === up.getAttribute('data-cart-up'); })[0];
        if (p) { add(p, up); if (!drawer.contains(document.activeElement)) drawer.focus({ preventScroll: true }); }
        return;
      }
      if (t.closest && t.closest('[data-promo-toggle]')) { promoOpen = !promoOpen; renderPromo(); if (promoOpen) { var pi = promoEl.querySelector('input'); if (pi) pi.focus(); } return; }
      if (t.closest && t.closest('[data-promo-apply]')) { applyPromoInput(); return; }
      if (t.closest && t.closest('[data-promo-rm]')) { setPromo(''); promoOpen = false; renderPromo(); return; }
      if (t.closest && t.closest('.cart-checkout')) { checkout(); return; }
      var a = t.closest && t.closest('a[href]');
      if (a) close(true);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.hasAttribute && e.target.hasAttribute('data-promo-input')) { e.preventDefault(); applyPromoInput(); return; }
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(drawer.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
      if (!f.length) { e.preventDefault(); drawer.focus(); return; }
      var first = f[0], last = f[f.length - 1], cur = document.activeElement;
      if (e.shiftKey && (cur === first || cur === drawer)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
      else if (!drawer.contains(cur)) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---------- Rendering ---------- */
  function thumb(i) {
    return '<span class="cart-thumb">' + (i.cover ? '<img src="' + esc(i.cover) + '" alt="" width="64" height="64" loading="lazy" decoding="async">' : I.cart) + '</span>';
  }
  function render() {
    var n = items.length;
    if (btn) {
      btn.classList.toggle('has-items', n > 0);
      btn.classList.toggle('is-empty', n === 0);
      btn.setAttribute('aria-label', n ? 'Open cart, ' + n + (n === 1 ? ' item' : ' items') : 'Open cart, empty');
      badge.textContent = String(n);
    }
    syncButtons();
    if (!built) return;
    var c = calc();
    titleSmall.textContent = n ? n + (n === 1 ? ' item' : ' items') : '';
    listEl.innerHTML = c.rows.map(function (r) {
      var i = r.item;
      var price = c.bundle ? '<s>' + money(i.price_cents, i.currency) + '</s><span class="off">' + money(r.unit, i.currency) + '</span>' : '<span>' + money(i.price_cents, i.currency) + '</span>';
      return '<li class="cart-item">' + thumb(i) +
        '<div class="cart-info"><a href="product.html?id=' + encodeURIComponent(i.id) + '">' + esc(i.title) + '</a><div class="cart-price">' + price + '</div></div>' +
        '<button type="button" class="cart-rm" data-cart-rm="' + esc(i.id) + '" aria-label="Remove ' + esc(i.title) + ' from cart">' + I.trash + '</button></li>';
    }).join('');
    renderPromo();
    emptyEl.hidden = n > 0;
    listEl.hidden = n === 0;
    footEl.hidden = n === 0;
    if (n) {
      footEl.innerHTML =
        '<div class="cart-sum"><span>Subtotal</span><span>' + money(c.sub, c.cur) + '</span></div>' +
        (c.bundle ? '<div class="cart-sum disc"><span>Bundle -' + BUNDLE + '%</span><span>-' + money(c.saved, c.cur) + '</span></div>' : '') +
        '<div class="cart-sum total"><span>Total</span><span>' + money(c.total, c.cur) + '</span></div>' +
        '<p class="trust compact">' + TRUST_ICON + '<span>Secure checkout · TWINT, PayPal, card · Instant download</span></p>' +
        '<button type="button" class="button cart-checkout">' + (busy ? 'Redirecting …' : 'Checkout') + '</button>' +
        '<button type="button" class="outline cart-continue" data-cart-close>Continue shopping</button>' +
        (getPromo() ? '<p class="cart-note">Your code is checked and applied at checkout.</p>' : '');
      var cb = footEl.querySelector('.cart-checkout'); if (busy) cb.disabled = true;
    } else { footEl.innerHTML = ''; }
    renderUpsell();
  }

  function applyPromoInput() {
    var inp = promoEl && promoEl.querySelector('input'); if (!inp) return;
    var c = normCode(inp.value);
    if (!validCode(c)) { promoErr = 'Please enter a valid code.'; promoSig = null; renderPromo(); var i2 = promoEl.querySelector('input'); if (i2) { i2.value = inp.value; i2.focus(); } return; }
    promoOpen = false;
    setPromo(c, 'manual');
    track('promo-apply', {});
  }
  function renderPromo() {
    if (!built) return;
    var code = getPromo(), n = items.length;
    var sig = [n > 0, code, promoOpen, promoErr].join('|');
    if (sig === promoSig) return;
    promoSig = sig;
    promoEl.hidden = n === 0;
    if (!n) { promoEl.innerHTML = ''; return; }
    var html = '';
    if (code) {
      var est = promoFromUrl() && has(ESSENTIALS) ? '<span class="cart-promo-est">-' + URL_PERCENT + '% on Essentials</span>' : '';
      html = '<div class="cart-chip"><span class="cart-chip-code">' + esc(code) + '</span><span class="cart-chip-txt">Code applied at checkout</span>' +
        '<button type="button" class="cart-chip-x" data-promo-rm aria-label="Remove code ' + esc(code) + '">' + I.x + '</button></div>' + est;
    } else {
      html = '<button type="button" class="cart-promo-toggle" data-promo-toggle aria-expanded="' + (promoOpen ? 'true' : 'false') + '">Have a code?</button>';
      if (promoOpen) html += '<div class="cart-promo-form"><input type="text" data-promo-input maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Enter code" aria-label="Discount code"><button type="button" class="outline" data-promo-apply>Apply</button></div>';
    }
    if (promoErr) html += '<p class="cart-promo-err" role="alert">' + esc(promoErr) + '</p>';
    promoEl.innerHTML = html;
  }

  function renderUpsell() {
    if (!built) return;
    if (items.length !== 1) { upsellEl.hidden = true; upsellEl.innerHTML = ''; return; }
    if (!products) { upsellEl.hidden = true; return; }
    var cur = items[0].currency;
    var more = products.filter(function (p) { return !has(p.id) && p.currency === cur; }).slice(0, 3);
    if (!more.length) { upsellEl.hidden = true; upsellEl.innerHTML = ''; return; }
    upsellEl.hidden = false;
    upsellEl.innerHTML = '<h3>Add one more product and save ' + BUNDLE + '%</h3><p>Any two products together get ' + BUNDLE + '% off each.</p>' +
      more.map(function (p) {
        return '<div class="cart-mini">' + thumb(p) + '<div><strong>' + esc(p.title) + '</strong><span class="p">' + money(p.price_cents, p.currency) + '</span></div>' +
          '<button type="button" class="outline" data-cart-up="' + esc(p.id) + '" aria-label="Add ' + esc(p.title) + ' to cart">Add</button></div>';
      }).join('');
  }

  /* ---------- Produkte (Upsell + Abgleich) ---------- */
  function coverUrl(u) {
    if (!u) return '';
    var r = /^https:\/\//i.test(u) ? u : String(cfg.SUPABASE_URL || '').replace(/\/$/, '') + '/storage/v1/object/public/coverart-products/' + String(u).split('/').map(encodeURIComponent).join('/');
    return window.YLYMedia ? window.YLYMedia.url(r) : r;
  }
  function headers() {
    var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
    if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
    return h;
  }
  function apiOk() { return cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY && String(cfg.SUPABASE_URL).indexOf('https://') === 0; }
  function loadProducts() {
    if (productsP) return productsP;
    if (!apiOk() || !window.fetch) return (productsP = Promise.resolve(null));
    productsP = fetch(cfg.SUPABASE_URL + '/rest/v1/shop_products?select=id,title,price_cents,currency,image_url&published=eq.true&order=created_at.desc', { headers: headers() })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (list) {
        products = (Array.isArray(list) ? list : []).map(function (p) {
          return { id: String(p.id), title: p.title, price_cents: p.price_cents, currency: String(p.currency || 'chf').toLowerCase(), cover: coverUrl(p.image_url) };
        });
        return products;
      }).catch(function () { products = null; productsP = null; return null; });
    return productsP;
  }
  // Preise/Titel aktualisieren, nicht mehr verfuegbare Produkte entfernen (nur nach erfolgreichem Laden)
  function reconcile() {
    if (reconciled || !items.length) return;
    loadProducts().then(function (list) {
      if (!list) return;
      reconciled = true;
      var before = items.length, changed = false;
      var map = {}; list.forEach(function (p) { map[p.id] = p; });
      items = items.filter(function (i) { return !!map[i.id]; }).map(function (i) {
        var p = map[i.id];
        if (p.price_cents !== i.price_cents || p.title !== i.title || p.currency !== i.currency || (p.cover && p.cover !== i.cover)) changed = true;
        return { id: i.id, title: p.title, price_cents: p.price_cents, currency: p.currency, cover: p.cover || i.cover };
      });
      if (items.length !== before) { changed = true; toast('Some products are no longer available and were removed.', true); }
      if (changed) save();
      render();
    });
  }

  /* ---------- Aktionen ---------- */
  function add(item, from) {
    if (!item || item.id == null) return false;
    var id = String(item.id);
    if (has(id)) { open(); return false; }
    var c = clean([item])[0];
    if (!c) return false;
    if (items.length >= MAX) { toast('Your cart is full (max. ' + MAX + ' products).', true); return false; }
    if (items.length && items[0].currency !== c.currency) { toast('Products with different currencies cannot be bought together.', true); return false; }
    items.push(c); save(); render();
    track('cart-add', { id: id });
    bump(); fly(from, c);
    toast('Added to cart');
    return true;
  }
  function remove(id) {
    id = String(id);
    var n = items.length;
    items = items.filter(function (i) { return i.id !== id; });
    if (items.length === n) return;
    save(); render();
    track('cart-remove', { id: id });
    if (built && root && !root.hidden) { var f = drawer.querySelector('.cart-rm, .cart-x'); if (f && !drawer.contains(document.activeElement)) f.focus(); }
  }
  function clear() { items = []; save(); render(); }

  function bump() {
    if (reduce || !btn) return;
    [badge, btn].forEach(function (el, k) {
      var cls = k ? 'pulse' : 'bump';
      el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    });
    setTimeout(function () { badge.classList.remove('bump'); btn.classList.remove('pulse'); }, 600);
  }

  function visibleRect(el) {
    if (!el || !el.getBoundingClientRect) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null;
    return r;
  }
  function fly(from, item) {
    if (reduce || !btn || !document.body.animate) return;
    var card = from && from.closest ? from.closest('.product') : null;
    var src = visibleRect(card && card.querySelector('.cover'));
    if (!src && from && !(from.closest && (from.closest('.pd-sticky') || from.closest('.cart-root')))) src = visibleRect(document.getElementById('pd-main')) || visibleRect(document.querySelector('.gd-scene'));
    if (!src) src = visibleRect(from);
    var dst = visibleRect(btn);
    if (!src || !dst) return;
    var s = 64, el = document.createElement('div');
    el.className = 'cart-fly';
    if (item.cover) el.style.backgroundImage = 'url("' + String(item.cover).replace(/["\\\n\r]/g, '') + '")';
    document.body.appendChild(el);
    var sx = src.left + src.width / 2 - s / 2, sy = src.top + src.height / 2 - s / 2;
    var dx = dst.left + dst.width / 2 - s / 2, dy = dst.top + dst.height / 2 - s / 2;
    var mx = (sx + dx) / 2, my = Math.min(sy, dy) - 60;
    var anim = el.animate([
      { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1.15)', opacity: 1 },
      { transform: 'translate(' + mx + 'px,' + my + 'px) scale(.7)', opacity: 1, offset: .5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.2)', opacity: .25 }
    ], { duration: 650, easing: 'cubic-bezier(.45,.05,.55,.95)' });
    var done = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    anim.onfinish = done; anim.oncancel = done;
    setTimeout(done, 1200);
  }

  function toast(msg, bad) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'cart-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.toggle('bad', !!bad);
    void toastEl.offsetWidth;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, bad ? 4200 : 2200);
  }

  /* ---------- Drawer auf/zu ---------- */
  function open() {
    build();
    if (!root.hidden && root.classList.contains('open')) return;
    clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    render();
    root.hidden = false;
    document.documentElement.classList.add('cart-lock');
    void root.offsetWidth;
    root.classList.add('open');
    var f = drawer.querySelector('.cart-x');
    setTimeout(function () { try { (reduce ? f : f).focus({ preventScroll: true }); } catch (e) {} }, 60);
    loadProducts().then(function () { render(); });
    reconcile();
  }
  function close(skipFocus) {
    if (!built || root.hidden) return;
    root.classList.remove('open');
    document.documentElement.classList.remove('cart-lock');
    var fin = function () { root.hidden = true; };
    clearTimeout(closeTimer);
    closeTimer = setTimeout(fin, reduce ? 0 : 380);
    if (!skipFocus && lastFocus && lastFocus.focus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    else if (!skipFocus && btn && btn.offsetParent !== null) btn.focus({ preventScroll: true });
  }

  /* ---------- Checkout ---------- */
  var sbClient = null;
  function client() {
    if (sbClient) return sbClient;
    if (window.supabase && apiOk()) { try { sbClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY); } catch (e) {} }
    return sbClient;
  }
  function invokeCheckout(ids) {
    var c = client(), payload = { items: ids }, pc = getPromo();
    if (pc) payload.promo = pc;
    if (c) {
      return c.functions.invoke('create-checkout', { body: payload }).then(function (r) {
        if (!r.error) return r.data;
        var ctx = r.error.context;
        if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (j) { throw new Error((j && j.error) || r.error.message); }, function () { throw new Error(r.error.message); });
        throw r.error;
      });
    }
    var h = headers(); h['Content-Type'] = 'application/json';
    return fetch(cfg.SUPABASE_URL + '/functions/v1/create-checkout', { method: 'POST', headers: h, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Checkout failed.'); return j; }); });
  }
  function checkout() {
    if (busy || !items.length) return;
    if (!apiOk()) { location.href = 'shop.html?cart=open'; return; } // Seiten ohne config.js: im Shop abschliessen
    busy = true; render();
    var ids = items.map(function (i) { return i.id; });
    track('cart-checkout', { count: ids.length });
    invokeCheckout(ids).then(function (data) {
      if (!data || !data.url) throw new Error((data && data.error) || 'Checkout link missing.');
      if (!/^https:\/\//i.test(String(data.url))) throw new Error('Invalid checkout link.');
      location.href = data.url;
    }).catch(function (e) {
      busy = false;
      if (e && e.message === PROMO_ERR) { promoErr = PROMO_ERR; promoSig = null; render(); try { promoEl.scrollIntoView({ block: 'nearest' }); } catch (x) {} return; }
      render();
      toast('Checkout failed: ' + ((e && e.message) || e), true);
    });
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && busy) { busy = false; render(); } });

  /* ---------- Add-Buttons (Delegation + Status) ---------- */
  function itemFrom(b) {
    return { id: b.getAttribute('data-cart-add'), title: b.getAttribute('data-cart-title'), price_cents: b.getAttribute('data-cart-price'), currency: b.getAttribute('data-cart-currency'), cover: b.getAttribute('data-cart-cover') || '' };
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-cart-add]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var it = itemFrom(b);
    if (has(it.id)) open(); else add(it, b);
  }, true);

  function syncButtons() {
    var list = document.querySelectorAll('[data-cart-add]');
    for (var k = 0; k < list.length; k++) {
      var b = list[k], id = b.getAttribute('data-cart-add'), on = has(id);
      if (b.classList.contains('in-cart') !== on) b.classList.toggle('in-cart', on);
      var lbl = b.querySelector('.cart-lbl');
      if (lbl) {
        if (!b.hasAttribute('data-cart-label')) b.setAttribute('data-cart-label', on ? 'Add to cart' : lbl.textContent);
        var want = on ? 'In cart – view' : b.getAttribute('data-cart-label');
        if (lbl.textContent !== want) lbl.textContent = want;
      }
      if (b.hasAttribute('data-cart-icon')) {
        var al = on ? 'In cart, view cart' : 'Add ' + (b.getAttribute('data-cart-title') || 'product') + ' to cart';
        if (b.getAttribute('aria-label') !== al) { b.setAttribute('aria-label', al); b.setAttribute('title', on ? 'In cart – view' : 'Add to cart'); }
      }
    }
  }
  var rafSync = 0;
  function scheduleSync() { if (rafSync) return; rafSync = setTimeout(function () { rafSync = 0; syncButtons(); }, 30); }

  /* ---------- Start ---------- */
  function start() {
    load(); buildBtn(); render();
    if (window.MutationObserver) new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', function (e) {
      if (e.key !== KEY && e.key !== null) return;
      load(); render();
    });
    if (urlPromoNew) toast('Code ' + urlPromoNew + ' will be applied at checkout');
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('cart') === 'open') {
        q.delete('cart');
        var qs = q.toString();
        try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) {}
        open();
      }
    } catch (e) {}
  }

  window.ylyCart = {
    add: add, remove: remove, has: has, clear: clear, open: open, close: close,
    items: function () { return items.slice(); }, count: count,
    promo: getPromo, setPromo: setPromo
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* home-ab.js - mini Before/After player in the Mixing card on the home page (index.html only).
   One REST query (first published before_after row). Two <audio> elements play the SAME ~12 s excerpt in sync (loop);
   the Before/After toggle only mutes one of them, so switching is instant. Pauses on tab hide, scroll-away and when another
   player starts. The full player lives on upload.html#hear (beforeafter.js). No inline code (strict CSP). */
(function () {
  'use strict';
  var box = document.getElementById('ab-mini');
  if (!box) return;
  var cfg = window.APP_CONFIG || {};
  var off = function () { box.hidden = true; };
  if (!cfg.SUPABASE_URL || String(cfg.SUPABASE_URL).indexOf('https://') !== 0 || !window.fetch) { off(); return; }

  var BUCKET = 'coverart-products', START = 45, LEN = 12;
  var playBtn = box.querySelector('.ab-play'), seg = box.querySelector('.ab-seg'), bar = box.querySelector('.ab-bar i'), cap = box.querySelector('.ab-cap');
  var els = { before: null, after: null }, side = 'before', playing = false, ready = false, loading = false, pending = false;
  var t0 = START, t1 = START + LEN, timer = 0, rows = null;

  function pubUrl(p) {
    var u = String(p).indexOf(cfg.SUPABASE_URL + '/') === 0 ? p
      : cfg.SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + String(p).split('/').map(encodeURIComponent).join('/');
    return window.YLYMedia ? window.YLYMedia.url(u) : u;
  }
  function track(n) { try { window.ylyTrack && window.ylyTrack(n); } catch (e) {} }

  function hdr() {
    var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
    if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
    return h;
  }
  function setUi() {
    playBtn.classList.toggle('playing', playing);
    playBtn.setAttribute('aria-label', playing ? 'Pause sample' : 'Play before and after sample');
    box.classList.toggle('is-playing', playing);
    box.classList.toggle('is-loading', loading);
  }
  function setSide(s) {
    side = s;
    seg.classList.toggle('is-before', s === 'before'); seg.classList.toggle('is-after', s === 'after');
    [].forEach.call(seg.querySelectorAll('button'), function (b) { b.setAttribute('aria-checked', String(b.dataset.side === s)); });
    if (els.before) { els.before.muted = s !== 'before'; els.after.muted = s !== 'after'; }
    box.classList.toggle('side-after', s === 'after');
  }
  function bar01() {
    var a = els[side]; if (!a) return;
    var f = Math.max(0, Math.min(1, (a.currentTime - t0) / Math.max(0.1, t1 - t0)));
    bar.style.transform = 'scaleX(' + f.toFixed(3) + ')';
  }
  function tick() {
    var a = els[side], h = els[side === 'before' ? 'after' : 'before'];
    if (!a || !playing) return;
    if (a.currentTime >= t1 - 0.05 || a.currentTime < t0 - 0.5) { a.currentTime = t0; h.currentTime = t0; }
    else if (Math.abs(h.currentTime - a.currentTime) > 0.08) { try { h.currentTime = a.currentTime; } catch (e) {} }
    bar01();
  }
  function pause() {
    pending = false;
    if (timer) { clearInterval(timer); timer = 0; }
    if (els.before) { els.before.pause(); els.after.pause(); }
    playing = false; setUi();
  }
  function begin() {
    // the excerpt: 45 s in (a strong part of the song), clamped for short files
    var d = Math.min(els.before.duration || 0, els.after.duration || 0);
    if (isFinite(d) && d > 0) { t0 = d > START + LEN + 1 ? START : Math.max(0, d - LEN - 1); t1 = Math.min(d, t0 + LEN); }
    [].forEach.call(document.querySelectorAll('audio'), function (o) { if (o !== els.before && o !== els.after) o.pause(); });
    els.before.currentTime = t0; els.after.currentTime = t0;
    els.before.muted = side !== 'before'; els.after.muted = side !== 'after';
    var ps = [els.before.play(), els.after.play()];
    playing = true; setUi();
    ps.forEach(function (p) { if (p && p.catch) p.catch(function () { pause(); }); });
    if (!timer) timer = setInterval(tick, 120);
    track('home-ab-play');
  }
  function load() {
    if (loading || ready || !rows) return;
    loading = true; setUi();
    var ok = { before: false, after: false };
    ['before', 'after'].forEach(function (k) {
      var el = new Audio();
      el.preload = 'auto'; el.loop = false;
      el.addEventListener('canplay', function () {
        ok[k] = true;
        if (ok.before && ok.after && !ready) { ready = true; loading = false; setUi(); if (pending) { pending = false; begin(); } }
      });
      el.addEventListener('error', function () { loading = false; pending = false; cap.textContent = 'Sample could not be loaded'; setUi(); });
      el.src = pubUrl(k === 'before' ? rows.before_path : rows.after_path);
      els[k] = el;
    });
  }
  function toggle() {
    if (playing) { pause(); return; }
    if (ready) { begin(); return; }
    pending = true; load(); setUi();
  }

  playBtn.addEventListener('click', toggle);
  seg.addEventListener('click', function (e) { var b = e.target.closest('button[data-side]'); if (b && b.dataset.side !== side) { setSide(b.dataset.side); track('home-ab-toggle'); } });
  seg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setSide('before'); seg.querySelector('[data-side=before]').focus(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setSide('after'); seg.querySelector('[data-side=after]').focus(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && playing) pause(); });
  window.addEventListener('pagehide', function () { if (playing) pause(); });
  // another audio element starts (gallery players): stop the sample
  document.addEventListener('play', function (e) { if (playing && e.target !== els.before && e.target !== els.after) pause(); }, true);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { if (playing && !es[0].isIntersecting) pause(); }, { threshold: 0 }).observe(box);
  }

  fetch(cfg.SUPABASE_URL + '/rest/v1/before_after?select=title,artist,before_path,after_path&published=eq.true&order=sort.asc,id.asc&limit=1', { headers: hdr() })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      var r = Array.isArray(d) && d[0];
      if (!r || !r.before_path || !r.after_path) { off(); return; }
      rows = r; playBtn.disabled = false;
      cap.textContent = (r.title ? r.title + (r.artist ? ' · ' + r.artist : '') : 'Sample') + ' · 12 s excerpt';
      setSide('before'); setUi();
    })
    .catch(off);
})();

/* portfolio.js - shared portfolio data + players (index.html, work.html).
   window.YLYPortfolio = { tracks, renderGrid(el, {limit}), renderFeatured(el) }
   Static data (newest first), no Supabase query. Audio comes from the public "audio-files" bucket (YLYMedia maps it to a local
   copy when one exists). preload="none" everywhere, only one track plays at a time. Needs portfolio.css. No inline code (CSP). */
(function () {
  'use strict';
  var cfg = window.APP_CONFIG || {};
  var COVER = 'media/coverart-portolio/';
  var R2 = 'https://audio.yardslovesyou.com/'; // Cloudflare R2 (Bucket yards-media): neue Tracks + Cover hier hochladen
  var tracks = [
    { title: 'Pretty.mp<3', bpm: 125, role: 'Prod. by yards', cover: R2 + 'pretty.jpg?v=2', audio: R2 + 'pretty125bpm.m4a', released: '2026-11-18' },
    { title: 'Crack.mp<3', bpm: 180, role: 'Prod. by yards', cover: R2 + 'crack.jpg', audio: R2 + 'crack180bpm.m4a', released: '2026-11-18' },
    { title: 'Flowing.mp<3', bpm: 158, role: 'Prod. by yards', cover: R2 + 'Flowing.jpg', audio: R2 + 'flowing158bpm.m4a', released: '2026-11-18' },
    { title: 'TwoDays.mp<3', bpm: 132, role: 'Prod. by yards', cover: R2 + 'TwoDays.jpg', audio: R2 + 'twodays132bpm.m4a', released: '2026-11-16' },
    { title: 'MyFace.mp<3', bpm: 130, role: 'Prod. by yards', cover: R2 + 'MyFace.jpg', audio: R2 + 'myface130bpm.m4a?v=2' },
    { title: 'AngelsHell.mp<3', bpm: 148, role: 'Prod. by yards', cover: R2 + 'AngelsHell.jpg', audio: R2 + 'angelshell148bpm.m4a' }
  ];

  var BARS = 30;
  var PLAY = '<svg class="play-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><polygon points="5,3 19,12 5,21"></polygon></svg>';
  var PAUSE = '<svg class="pause-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" style="display:none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function audioUrl(path) {
    if (/^https:\/\//.test(path)) return path; // volle Adresse (R2) unveraendert
    var u = String(cfg.SUPABASE_URL || '').replace(/\/$/, '') + '/storage/v1/object/public/audio-files/' + encodeURIComponent(path);
    return window.YLYMedia ? window.YLYMedia.url(u) : u;
  }
  function coverUrl(p) { if (/^https:\/\//.test(p)) return p; return window.YLYMedia ? window.YLYMedia.url(p) : p; }

  function playerHtml(t) {
    var bars = '';
    for (var i = 0; i < BARS; i++) bars += '<span class="wave-bar"></span>';
    return '<div class="custom-player pf-player">' +
      '<audio preload="none" src="' + esc(audioUrl(t.audio)) + '"></audio>' +
      '<button class="play-btn" type="button" aria-label="Play ' + esc(t.title) + '">' + PLAY + PAUSE + '</button>' +
      '<div class="waveform-container" title="Seek"><div class="waveform-bars">' + bars + '</div></div>' +
      '</div>';
  }

  function metaLine(t) { return esc(t.role) + ' · ' + esc(t.bpm) + ' BPM'; }

  function coverHtml(t, eager) {
    return '<div class="pf-cover"><img src="' + esc(coverUrl(t.cover)) + '" alt="' + esc(t.title) + ' cover art" width="400" height="400" ' +
      (eager ? '' : 'loading="lazy" ') + 'decoding="async"></div>';
  }

  function cardHtml(t) {
    return '<article class="pf-card" data-pf>' + coverHtml(t) +
      '<div class="pf-body"><h3 class="pf-title">' + esc(t.title) + '</h3><p class="pf-meta">' + metaLine(t) + '</p>' + playerHtml(t) + '</div></article>';
  }

  // ---------- player behaviour (one track at a time) ----------
  var current = null; // { audio, reset }

  function wire(root) {
    [].forEach.call(root.querySelectorAll('.pf-player'), function (pl) {
      if (pl.getAttribute('data-wired')) return;
      pl.setAttribute('data-wired', '1');
      var audio = pl.querySelector('audio'), btn = pl.querySelector('.play-btn');
      var playI = pl.querySelector('.play-icon'), pauseI = pl.querySelector('.pause-icon');
      var wave = pl.querySelector('.waveform-container');
      var bars = pl.querySelectorAll('.wave-bar');
      if (!audio || !btn) return;
      function icons(on) { playI.style.display = on ? 'none' : 'block'; pauseI.style.display = on ? 'block' : 'none'; }
      function clear() { [].forEach.call(bars, function (b) { b.classList.remove('active'); }); }
      var me = { audio: audio, reset: function () { icons(false); } };
      btn.addEventListener('click', function () {
        if (current && current.audio !== audio) { current.audio.pause(); current.reset(); }
        if (audio.paused) {
          current = me; icons(true);
          var p = audio.play();
          if (p && p.catch) p.catch(function () { icons(false); });
        } else { audio.pause(); icons(false); }
      });
      audio.addEventListener('timeupdate', function () {
        if (!audio.duration || !bars.length) return;
        var n = Math.floor((audio.currentTime / audio.duration) * bars.length);
        [].forEach.call(bars, function (b, i) { b.classList.toggle('active', i <= n); });
      });
      audio.addEventListener('ended', function () { icons(false); clear(); });
      audio.addEventListener('error', function () { icons(false); });
      if (wave) wave.addEventListener('click', function (e) {
        var r = wave.getBoundingClientRect();
        if (audio.duration && r.width) audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
      });
    });
  }

  function renderGrid(el, opts) {
    if (!el) return;
    var limit = opts && opts.limit > 0 ? opts.limit : tracks.length;
    el.classList.add('pf-grid');
    el.innerHTML = tracks.slice(0, limit).map(cardHtml).join('');
    wire(el);
  }

  function renderFeatured(el) {
    if (!el) return;
    var t = tracks[0];
    el.classList.add('pf-featured');
    el.innerHTML = '<article class="pf-card pf-card-lg" data-pf>' + coverHtml(t) +
      '<div class="pf-body"><p class="eyebrow"><span class="area-ico" aria-hidden="true"></span>Latest release</p>' +
      '<h3 class="pf-title">' + esc(t.title) + '</h3><p class="pf-meta">' + metaLine(t) + '</p>' + playerHtml(t) + '</div></article>';
    wire(el);
  }

  window.YLYPortfolio = { tracks: tracks, renderGrid: renderGrid, renderFeatured: renderFeatured };
})();

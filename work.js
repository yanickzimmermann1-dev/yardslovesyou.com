/* work.js - Work page: browsable dump of everything (work-items.js). Filters in the URL hash, shuffle, inline audio, lightbox. */
(function () {
  'use strict';
  var data = window.YLYWork || { items: [], r2: '' };
  var grid = document.getElementById('wk-grid');
  if (!grid) return;
  var typeBar = document.getElementById('wk-types'), tagBar = document.getElementById('wk-tags');
  var shuffleBtn = document.getElementById('wk-shuffle'), countEl = document.getElementById('wk-count'), emptyEl = document.getElementById('wk-empty');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function url(f) { f = String(f || ''); return (/^https?:\/\//.test(f) || f.indexOf('/') > -1) ? f : data.r2 + f; }
  function ytId(f) { var m = String(f).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(f) ? f : ''); }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // newest first, undated last (stable)
  var items = data.items.map(function (it, i) { it._i = i; return it; }).sort(function (a, b) {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : a._i - b._i;
    if (a.date) return -1; if (b.date) return 1; return a._i - b._i;
  });

  var TYPES = [['all', 'All'], ['audio', 'Audio'], ['video', 'Video'], ['image', 'Images'], ['note', 'Notes']];
  function kind(it) { return it.type === 'youtube' ? 'video' : it.type; }
  var state = { type: 'all', tag: '', shuffled: false, order: items.slice() };

  // ---------- hash ----------
  function readHash() {
    var p = {}; location.hash.replace(/^#/, '').split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) p[a[0]] = decodeURIComponent(a[1] || ''); });
    state.type = p.type || 'all'; state.tag = p.tag || '';
  }
  function writeHash() {
    var parts = [];
    if (state.type !== 'all') parts.push('type=' + encodeURIComponent(state.type));
    if (state.tag) parts.push('tag=' + encodeURIComponent(state.tag));
    var h = parts.join('&');
    try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (e) { location.hash = h; }
  }

  // ---------- chips ----------
  function chip(label, on, attrs) { return '<button type="button" class="wk-chip" aria-pressed="' + (on ? 'true' : 'false') + '" ' + attrs + '>' + esc(label) + '</button>'; }
  function buildChips() {
    var counts = {}; items.forEach(function (it) { counts[kind(it)] = (counts[kind(it)] || 0) + 1; });
    typeBar.innerHTML = TYPES.filter(function (t) { return t[0] === 'all' || counts[t[0]]; })
      .map(function (t) { return chip(t[1], state.type === t[0], 'data-type="' + t[0] + '"'); }).join('');
    var tags = {}; items.forEach(function (it) { (it.tags || []).forEach(function (t) { tags[t] = (tags[t] || 0) + 1; }); });
    var names = Object.keys(tags).sort(function (a, b) { return tags[b] - tags[a] || (a < b ? -1 : 1); });
    tagBar.innerHTML = names.map(function (t) { return chip('#' + t, state.tag === t, 'data-tag="' + esc(t) + '"'); }).join('');
    tagBar.hidden = !names.length;
  }

  // ---------- cards ----------
  var PLAY = '<svg class="wk-i-play" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><polygon points="6,3.5 20,12 6,20.5"/></svg><svg class="wk-i-pause" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  var BIG = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><polygon points="7,4 20,12 7,20"/></svg>';
  function meta(it) {
    var m = [];
    if (it.bpm) m.push(it.bpm + ' BPM'); if (it.key) m.push(it.key);
    if (it.date) m.push(it.date.slice(0, 7));
    return m.join(' · ');
  }
  function tagsHtml(it) { return (it.tags || []).length ? '<p class="wk-tags">' + it.tags.map(function (t) { return '#' + esc(t); }).join(' ') + '</p>' : ''; }
  function wave(it) {
    var h = hash(it.title || it.file), s = '';
    for (var i = 0; i < 28; i++) { h = (h * 1103515245 + 12345) & 0x7fffffff; s += '<span style="height:' + (22 + (h % 70)) + '%"></span>'; }
    return s;
  }
  function card(it, idx) {
    var k = kind(it), cls = 'wk-item wk-' + k + ' wk-v' + (hash(it.title || it.file || String(idx)) % 3), body = '';
    var m = meta(it);
    var t = esc(it.title || '');
    if (it.type === 'audio') {
      body = (it.cover ? '<div class="wk-cover"><img src="' + esc(url(it.cover)) + '" alt="" loading="lazy" decoding="async" width="400" height="400"></div>' : '') +
        '<div class="wk-body"><h3 class="wk-title">' + t + '</h3>' + (m ? '<p class="wk-meta">' + esc(m) + '</p>' : '') +
        '<div class="wk-player"><audio preload="none" src="' + esc(url(it.file)) + '"></audio>' +
        '<button type="button" class="wk-play" aria-label="Play ' + t + '">' + PLAY + '</button>' +
        '<div class="wk-wave" aria-hidden="true">' + wave(it) + '</div></div>' +
        (it.note ? '<p class="wk-note">' + esc(it.note) + '</p>' : '') + tagsHtml(it) + '</div>';
    } else if (it.type === 'image') {
      body = '<button type="button" class="wk-open" data-open="' + idx + '" aria-label="Open ' + esc(it.title || it.alt || 'image') + '">' +
        '<img src="' + esc(url(it.file)) + '" alt="' + esc(it.alt || it.title || '') + '" loading="lazy" decoding="async"></button>' +
        '<div class="wk-body">' + (it.title ? '<h3 class="wk-title">' + t + '</h3>' : '') + (m ? '<p class="wk-meta">' + esc(m) + '</p>' : '') + tagsHtml(it) + '</div>';
    } else if (it.type === 'video' || it.type === 'youtube') {
      var poster = it.cover ? url(it.cover) : (it.type === 'youtube' && ytId(it.file) ? 'https://i.ytimg.com/vi/' + ytId(it.file) + '/hqdefault.jpg' : '');
      body = '<button type="button" class="wk-open wk-vid" data-open="' + idx + '" aria-label="Play video ' + t + '">' +
        (poster ? '<img src="' + esc(poster) + '" alt="" loading="lazy" decoding="async">' : '<span class="wk-noposter"></span>') +
        '<span class="wk-bigplay">' + BIG + '</span></button>' +
        '<div class="wk-body"><h3 class="wk-title">' + t + '</h3>' + (m ? '<p class="wk-meta">' + esc(m) + '</p>' : '') + tagsHtml(it) + '</div>';
    } else {
      cls += ' wk-taped';
      body = '<div class="wk-body">' + (it.title ? '<h3 class="wk-title">' + t + '</h3>' : '') + '<p class="wk-note">' + esc(it.note || '') + '</p>' +
        (m ? '<p class="wk-meta">' + esc(m) + '</p>' : '') + tagsHtml(it) + '</div>';
    }
    return '<article class="' + cls + '">' + body + '</article>';
  }

  // ---------- render ----------
  var visible = [];
  function render() {
    stopAudio();
    visible = state.order.filter(function (it) {
      return (state.type === 'all' || kind(it) === state.type) && (!state.tag || (it.tags || []).indexOf(state.tag) > -1);
    });
    grid.innerHTML = visible.map(card).join('');
    emptyEl.hidden = visible.length > 0;
    countEl.textContent = visible.length + (visible.length === 1 ? ' item' : ' items');
    [].forEach.call(typeBar.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-type') === state.type ? 'true' : 'false'); });
    [].forEach.call(tagBar.children, function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-tag') === state.tag ? 'true' : 'false'); });
  }

  typeBar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-type]'); if (!b) return;
    state.type = b.getAttribute('data-type'); writeHash(); render();
  });
  tagBar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tag]'); if (!b) return;
    var t = b.getAttribute('data-tag'); state.tag = state.tag === t ? '' : t; writeHash(); render();
  });
  shuffleBtn.addEventListener('click', function () {
    var a = items.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; }
    state.order = a; render();
  });
  window.addEventListener('hashchange', function () { readHash(); render(); });

  // ---------- audio: one at a time ----------
  var cur = null;
  function stopAudio() { if (cur) { cur.a.pause(); cur.box.classList.remove('is-on'); cur = null; } }
  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('.wk-play');
    if (btn) {
      var box = btn.closest('.wk-player'), a = box.querySelector('audio');
      if (cur && cur.a !== a) stopAudio();
      if (a.paused) {
        cur = { a: a, box: box }; box.classList.add('is-on'); wire(a, box, btn);
        var p = a.play(); if (p && p.catch) p.catch(function () { box.classList.remove('is-on'); });
      } else { a.pause(); box.classList.remove('is-on'); }
      return;
    }
    var w = e.target.closest('.wk-wave');
    if (w) {
      var a2 = w.parentNode.querySelector('audio'), r = w.getBoundingClientRect();
      if (a2.duration && r.width) a2.currentTime = ((e.clientX - r.left) / r.width) * a2.duration;
      return;
    }
    var o = e.target.closest('[data-open]');
    if (o) openBox(visible[+o.getAttribute('data-open')], o);
  });
  function wire(a, box, btn) {
    if (a._w) return; a._w = 1;
    var bars = box.querySelectorAll('.wk-wave span');
    a.addEventListener('timeupdate', function () {
      if (!a.duration) return;
      var n = Math.floor(a.currentTime / a.duration * bars.length);
      for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i <= n);
    });
    a.addEventListener('ended', function () { box.classList.remove('is-on'); [].forEach.call(bars, function (b) { b.classList.remove('on'); }); if (cur && cur.a === a) cur = null; });
    a.addEventListener('error', function () { box.classList.remove('is-on'); });
  }

  // ---------- lightbox (images + videos of current view) ----------
  var lb = null, lbList = [], lbPos = 0, lbFrom = null;
  function media(it) { return it.type === 'image' || it.type === 'video' || it.type === 'youtube'; }
  function openBox(it, from) {
    if (!it) return;
    stopAudio();
    lbList = visible.filter(media); lbPos = lbList.indexOf(it); lbFrom = from;
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'wk-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Media viewer');
      lb.innerHTML = '<button type="button" class="wk-lb-x" aria-label="Close">&times;</button>' +
        '<button type="button" class="wk-lb-n wk-lb-prev" aria-label="Previous">&#8249;</button>' +
        '<button type="button" class="wk-lb-n wk-lb-next" aria-label="Next">&#8250;</button>' +
        '<figure class="wk-lb-fig"><div class="wk-lb-stage"></div><figcaption></figcaption></figure>';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) {
        if (e.target.closest('.wk-lb-x') || e.target === lb || e.target.classList.contains('wk-lb-fig')) closeBox();
        else if (e.target.closest('.wk-lb-prev')) step(-1);
        else if (e.target.closest('.wk-lb-next')) step(1);
      });
    }
    lb.hidden = false; document.documentElement.classList.add('wk-lb-open');
    showLb(); lb.querySelector('.wk-lb-x').focus();
  }
  function showLb() {
    var it = lbList[lbPos], st = lb.querySelector('.wk-lb-stage'), h = '';
    if (it.type === 'image') h = '<img src="' + esc(url(it.file)) + '" alt="' + esc(it.alt || it.title || '') + '">';
    else if (it.type === 'video') h = '<video src="' + esc(url(it.file)) + '" controls autoplay playsinline' + (it.cover ? ' poster="' + esc(url(it.cover)) + '"' : '') + '></video>';
    else h = '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(ytId(it.file)) + '?rel=0&autoplay=1" title="' + esc(it.title || 'Video') + '" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    st.innerHTML = h;
    lb.querySelector('figcaption').textContent = [it.title, meta(it)].filter(Boolean).join('  ·  ');
    lb.classList.toggle('single', lbList.length < 2);
  }
  function step(d) { if (lbList.length < 2) return; lbPos = (lbPos + d + lbList.length) % lbList.length; showLb(); }
  function closeBox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true; lb.querySelector('.wk-lb-stage').innerHTML = ''; document.documentElement.classList.remove('wk-lb-open');
    if (lbFrom && document.body.contains(lbFrom)) lbFrom.focus();
  }
  document.addEventListener('keydown', function (e) {
    if (!lb || lb.hidden) return;
    if (e.key === 'Escape') closeBox();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') { // simple focus trap
      var f = lb.querySelectorAll('button:not([hidden])'); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  readHash(); buildChips(); render();
})();

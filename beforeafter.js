/* =====================================================================
   BEFORE / AFTER PLAYER ("Hear the difference")
   - Liest die Tabelle before_after (nur veroeffentlichte Zeilen) per REST
   - Beide Dateien werden gestreamt (zwei <audio>-Elemente -> MediaElementSource -> Gain pro Seite);
     Wiedergabe startet, sobald beide spielbereit sind. Umschalten ueberblendet zwei GainNodes in ~20 ms
     (nahtlos, auch waehrend der Wiedergabe); alle 250 ms wird die versteckte Seite nachgefuehrt.
   - Wellenform + Lautheit kommen vorberechnet aus der Spalte before_after.peaks (ohne Dekodieren);
     fehlt sie, werden die Dateien im Hintergrund dekodiert (Fallback)
   -    - Schlaegt die Abfrage fehl oder gibt es keine Zeilen, bleibt der Bereich versteckt
   ===================================================================== */
(function () {
  'use strict';
  var cfg = window.APP_CONFIG || {};
  var sections = Array.prototype.slice.call(document.querySelectorAll('[data-beforeafter]'));
  if (!sections.length || !cfg.SUPABASE_URL || String(cfg.SUPABASE_URL).indexOf('https://') !== 0) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC || !window.fetch) return;

  var BUCKET = 'coverart-products';
  var reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var RING = 226.2; // Umfang des Lade-Rings (r = 36)

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function track(name) { try { window.ylyTrack && window.ylyTrack(name); } catch (e) {} }
  function pubUrl(p) {
    if (String(p).indexOf(cfg.SUPABASE_URL + '/') === 0) return p;   // volle URL nur von der eigenen Supabase-Instanz
    return cfg.SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + String(p).split('/').map(encodeURIComponent).join('/');
  }
  function fmt(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }

  // ---------- Zeilen laden (einmal pro Seite) ----------
  function fetchRows() {
    var h = { apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
    if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
    return fetch(cfg.SUPABASE_URL + '/rest/v1/before_after?select=*&published=eq.true&order=sort.asc,id.asc', { headers: h })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { return Array.isArray(d) ? d.filter(function (x) { return x && x.before_path && x.after_path; }) : []; });
  }

  // ---------- Fallback: Dateien im Hintergrund dekodieren (nur wenn keine vorberechneten Peaks da sind) ----------
  function fetchBuf(url) {
    return fetch(url).then(function (res) { if (!res.ok) throw new Error(res.status); return res.arrayBuffer(); });
  }
  var decodeCtx = null;
  function decode(ab) {
    if (!decodeCtx) {
      try { decodeCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 1, 44100); }
      catch (e) { decodeCtx = null; }
    }
    var c = decodeCtx;
    return new Promise(function (resolve, reject) {
      if (!c) { reject(new Error('decode')); return; }
      var p = c.decodeAudioData(ab, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }
  function rmsOf(buf) {
    var sum = 0, n = 0;
    for (var ch = 0; ch < buf.numberOfChannels; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < d.length; i++) { sum += d[i] * d[i]; }
      n += d.length;
    }
    return Math.sqrt(sum / Math.max(1, n));
  }
  function peaksOf(buf, cols) {
    var out = new Float32Array(cols), len = buf.length, per = len / cols;
    for (var ch = 0; ch < buf.numberOfChannels; ch++) {
      var d = buf.getChannelData(ch);
      for (var c = 0; c < cols; c++) {
        var a = Math.floor(c * per), b = Math.min(len, Math.floor((c + 1) * per)), m = out[c], step = Math.max(1, Math.floor((b - a) / 200));
        for (var i = a; i < b; i += step) { var v = d[i] < 0 ? -d[i] : d[i]; if (v > m) m = v; }
        out[c] = m;
      }
    }
    return out;
  }

  var ICON_PLAY = '<svg class="ba-i-play" viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
  var ICON_PAUSE = '<svg class="ba-i-pause" viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';
  var ICON_ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  // ---------- ein Player pro Bereich ----------
  function mount(root, rows, uid) {
    var compact = root.hasAttribute('data-compact');
    var cta = root.getAttribute('data-cta');
    var tid = 'ba-title-' + uid;

    root.innerHTML =
      '<div class="section-head"><div>' +
      '<p class="eyebrow">BEFORE / AFTER</p>' +
      '<h2 id="' + tid + '">Hear the difference</h2>' +
      '<p class="ba-sub">Flip between the rough mix and the final version. Same song, same moment.</p>' +
      '</div></div>' +
      '<div class="ba-card" tabindex="0" role="group" aria-label="Before and after player. Space plays or pauses, B and A or the left and right arrow keys switch.">' +
        (rows.length > 1 ? '<div class="ba-tabs" role="tablist" aria-label="Choose a song"></div>' : '') +
        '<div class="ba-meta"></div>' +
        '<canvas class="ba-spectrum" aria-hidden="true"></canvas>' +
        '<div class="ba-wave" role="slider" tabindex="-1" aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><canvas class="ba-canvas"></canvas></div>' +
        '<div class="ba-times"><span class="ba-t-cur">0:00</span><span class="ba-t-state" aria-live="polite"></span><span class="ba-t-dur">0:00</span></div>' +
        '<div class="ba-controls">' +
          '<button class="ba-play" type="button" aria-label="Play">' +
            '<svg class="ba-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="' + RING + '" stroke-dashoffset="' + RING + '" transform="rotate(-90 40 40)"/></svg>' +
            ICON_PLAY + ICON_PAUSE +
          '</button>' +
          '<div class="ba-switch is-before" role="radiogroup" aria-label="Version">' +
            '<span class="ba-thumb" aria-hidden="true"></span>' +
            '<button type="button" role="radio" aria-checked="true" data-side="before">Before</button>' +
            '<button type="button" role="radio" aria-checked="false" data-side="after">After</button>' +
          '</div>' +
        '</div>' +
        '<div class="ba-opts">' +
          '<label class="ba-match"><input type="checkbox"><span class="ba-box" aria-hidden="true"></span><span>Match loudness</span></label>' +
          '<p class="ba-hint">Louder often sounds better. Turn this on for a fair comparison.</p>' +
        '</div>' +
        '<p class="ba-err" role="alert" hidden>The audio could not be loaded. Please try again later.</p>' +
        (cta ? '<div class="ba-cta"><a class="button" href="' + esc(cta) + '">Get your track mixed ' + ICON_ARROW + '</a></div>' : '') +
      '</div>';
    root.setAttribute('aria-labelledby', tid);
    root.hidden = false;
    root.classList.toggle('ba-compact', compact);

    var $ = function (s) { return root.querySelector(s); };
    var card = $('.ba-card'), tabs = $('.ba-tabs'), meta = $('.ba-meta'), wave = $('.ba-wave'), cv = $('.ba-canvas'), sp = $('.ba-spectrum'),
        playBtn = $('.ba-play'), ring = $('.ba-ring circle'), sw = $('.ba-switch'), tCur = $('.ba-t-cur'), tDur = $('.ba-t-dur'), tState = $('.ba-t-state'),
        matchIn = $('.ba-match input'), errEl = $('.ba-err');
    var cx = cv.getContext('2d'), sx = sp.getContext('2d');

    // Zustand
    var idx = 0, ch = null, peaks = null, dur = 0, loadState = 'idle', loadTok = 0, pendingPlay = false;
    var ctx = null, bus = null, analyser = null, playing = false, offset = 0, syncTimer = 0;
    var side = 'before', match = false, rms = null, raf = 0, drag = null, lastDraw = '', freq = null;

    // ----- Meta / Tabs -----
    function renderTabs() {
      if (!tabs) return;
      tabs.innerHTML = rows.map(function (r, i) {
        return '<button type="button" role="tab" aria-selected="' + (i === idx) + '" data-i="' + i + '">' + esc(r.title) + (r.artist ? '<small>' + esc(r.artist) + '</small>' : '') + '</button>';
      }).join('');
    }
    function renderMeta() {
      var r = rows[idx], cover = r.cover_path ? '<img class="ba-cover" src="' + esc(pubUrl(r.cover_path)) + '" alt="" loading="lazy" width="56" height="56">' : '';
      meta.innerHTML = cover + '<div class="ba-meta-t"><strong>' + esc(r.title) + '</strong>' +
        (r.artist ? '<span>' + esc(r.artist) + '</span>' : '') + (r.note && !compact ? '<em>' + esc(r.note) + '</em>' : '') + '</div>';
      meta.classList.toggle('empty', !(rows.length > 1 || r.artist || r.note || r.cover_path));
    }

    // ----- Zeichnen -----
    function size() {
      var dpr = Math.min(2, window.devicePixelRatio || 1), w = wave.clientWidth, h = wave.clientHeight;
      if (!w || !h) return;
      var key = w + 'x' + h + '@' + dpr;
      if (key !== lastDraw) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
        var sw2 = sp.clientWidth, sh = sp.clientHeight;
        sp.width = Math.round(sw2 * dpr); sp.height = Math.round(sh * dpr);
        lastDraw = key;
      }
    }
    function bar(c, x, y, w, h) { if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, Math.min(w / 2, 2)); c.fill(); } else c.fillRect(x, y, w, h); }
    function pos() {
      if (drag) return drag.t;
      if (!playing || !ch) return offset;
      return Math.max(0, Math.min(dur, ch[side].el.currentTime));
    }
    function draw() {
      size();
      var W = cv.width, H = cv.height; if (!W || !H) return;
      var dpr = W / wave.clientWidth, bw = 3 * dpr, gap = 2 * dpr, n = Math.max(8, Math.floor(W / (bw + gap)));
      cx.clearRect(0, 0, W, H);
      var prog = dur ? pos() / dur : 0, mid = H / 2, ps = peaks;
      var g = cx.createLinearGradient(0, 0, W, 0);
      var active = side === 'after';
      g.addColorStop(0, active ? '#b68aff' : '#8f7fb0'); g.addColorStop(1, active ? '#e5a5ff' : '#a99cc4');
      for (var i = 0; i < n; i++) {
        var x = i * (bw + gap), a, b;
        if (ps) {
          var s = Math.floor(i / n * ps.after.length), e = Math.max(s + 1, Math.floor((i + 1) / n * ps.after.length)), pa = 0, pb = 0;
          for (var k = s; k < e; k++) { if (ps.after[k] > pa) pa = ps.after[k]; if (ps.before[k] > pb) pb = ps.before[k]; }
          a = pa; b = pb;
        } else { a = 0.18 + 0.12 * Math.sin(i * 0.37) + 0.08 * Math.sin(i * 1.3); b = a; }
        var ha = Math.max(2 * dpr, a * H * 0.92), hb = Math.max(2 * dpr, b * H * 0.92);
        // Ghost: BEFORE
        cx.fillStyle = ps ? 'rgba(255,255,255,' + (active ? '.16' : '.34') + ')' : 'rgba(255,255,255,.07)';
        bar(cx, x, mid - hb / 2, bw, hb);
        // Hauptwelle: AFTER
        var played = (i + 0.5) / n <= prog;
        cx.fillStyle = !ps ? 'rgba(182,138,255,.14)' : played ? g : (active ? 'rgba(182,138,255,.42)' : 'rgba(182,138,255,.22)');
        bar(cx, x, mid - ha / 2, bw, ha);
      }
      if (ps) { // Abspielposition
        var px = Math.round(prog * W);
        cx.fillStyle = '#fff'; cx.shadowColor = 'rgba(229,165,255,.9)'; cx.shadowBlur = 10 * dpr;
        cx.fillRect(Math.min(W - 2 * dpr, px), 0, 2 * dpr, H); cx.shadowBlur = 0;
      }
    }
    function drawSpectrum() {
      var W = sp.width, H = sp.height; if (!W || !H) return;
      sx.clearRect(0, 0, W, H);
      if (!analyser || !playing || reduced) return;
      if (!freq) freq = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freq);
      var n = W / (sp.clientWidth || 1) > 0 ? Math.max(16, Math.min(48, Math.floor(sp.clientWidth / 9))) : 32, bw = W / n, maxBin = Math.floor(freq.length * 0.7);
      var g = sx.createLinearGradient(0, H, 0, 0); g.addColorStop(0, 'rgba(182,138,255,.15)'); g.addColorStop(1, side === 'after' ? 'rgba(229,165,255,.95)' : 'rgba(170,160,183,.8)');
      sx.fillStyle = g;
      for (var i = 0; i < n; i++) {
        var a = Math.floor(Math.pow(i / n, 1.7) * maxBin) + 1, b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.7) * maxBin) + 1), m = 0;
        for (var k = a; k < b && k < freq.length; k++) if (freq[k] > m) m = freq[k];
        var h = Math.max(2, m / 255 * H);
        bar(sx, i * bw + bw * 0.2, H - h, bw * 0.6, h);
      }
    }
    function updateTime() {
      var p = pos();
      tCur.textContent = fmt(p); tDur.textContent = dur ? fmt(dur) : '0:00';
      wave.setAttribute('aria-valuenow', dur ? Math.round(p / dur * 100) : 0);
    }
    function loop() {
      raf = 0;
      if (playing && ch && dur && pos() >= dur - 0.03) { finish(); return; }
      updateTime(); draw(); drawSpectrum();
      if (playing || drag) raf = requestAnimationFrame(loop);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    function repaint() { updateTime(); draw(); drawSpectrum(); }

    // ----- Audio -----
    function ensureCtx() {
      if (!ctx) {
        ctx = new AC();
        bus = ctx.createGain(); bus.gain.value = 0.9;
        analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.78;
        bus.connect(analyser); analyser.connect(ctx.destination);
      }
      return ctx.state === 'suspended' ? ctx.resume().catch(function () {}) : Promise.resolve();
    }
    function trimFor(k) {
      if (!match || !rms || !rms.before || !rms.after) return 1;
      var q = Math.min(rms.before, rms.after);
      return rms[k] > q ? q / rms[k] : 1;
    }
    function ramp(param, v, t, d) { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + d); }
    // Audio-Element -> MediaElementSource -> trim -> fade -> bus (einmal pro Element, erst beim ersten Play)
    function routeEls() {
      if (!ch || ch.routed || !ctx) return;
      ['before', 'after'].forEach(function (k) {
        var c = ch[k]; c.src = ctx.createMediaElementSource(c.el); c.trim = ctx.createGain(); c.fade = ctx.createGain();
        c.trim.gain.value = trimFor(k); c.fade.gain.value = side === k ? 1 : 0;
        c.src.connect(c.trim); c.trim.connect(c.fade); c.fade.connect(bus);
      });
      ch.routed = true;
    }
    function hidden() { return ch[side === 'before' ? 'after' : 'before']; }
    function syncNow() {
      if (!ch || !playing) return;
      var a = ch[side].el, h = hidden().el, d = Math.abs(a.currentTime - h.currentTime);
      root._baDiff = d; updateTime();
      if (d > 0.03) { try { h.currentTime = a.currentTime; } catch (e) {} }
    }
    function startSync() { stopSync(); syncTimer = setInterval(syncNow, 250); }
    function stopSync() { if (syncTimer) { clearInterval(syncTimer); syncTimer = 0; } }
    function teardown() {
      stopSync();
      if (!ch) return;
      ['before', 'after'].forEach(function (k) {
        var c = ch[k];
        try { c.el.pause(); c.el.removeAttribute('src'); c.el.load(); } catch (e) {}
        try { if (c.src) { c.src.disconnect(); c.trim.disconnect(); c.fade.disconnect(); } } catch (e) {}
      });
      ch = null;
    }
    function setPlayUi() {
      playBtn.classList.toggle('playing', playing);
      playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      card.classList.toggle('is-playing', playing);
    }
    function play() {
      if (loadState === 'error') { load(); }
      var ready = ensureCtx();
      if (loadState !== 'ready') { pendingPlay = true; load(); tState.textContent = 'Loading'; return; }
      ready.then(function () {
        if (!ch || playing) return;
        // Browser hat den AudioContext nicht freigegeben (keine Nutzergeste): nicht starten, sonst steht das Audio still
        if (ctx.state !== 'running') { pendingPlay = false; tState.textContent = 'Press play again'; return; }
        tState.textContent = ''; routeEls();
        ch.before.el.currentTime = offset; ch.after.el.currentTime = offset;
        playing = true; setPlayUi(); kick(); startSync();
        var p1 = ch.before.el.play(), p2 = ch.after.el.play();
        [p1, p2].forEach(function (p) { if (p && p.catch) p.catch(function () { if (playing) pause(); }); });
        track('beforeafter-play');
      });
    }
    function pause() {
      pendingPlay = false; tState.textContent = '';
      if (playing && ch) { offset = pos(); ch.before.el.pause(); ch.after.el.pause(); }
      playing = false; stopSync();
      setPlayUi(); repaint();
    }
    function finish() {
      if (ch) { ch.before.el.pause(); ch.after.el.pause(); }
      playing = false; stopSync(); offset = 0; setPlayUi(); repaint();
    }
    function seek(t) {
      t = Math.max(0, Math.min(dur, t)); offset = t;
      if (ch) { try { ch.before.el.currentTime = t; ch.after.el.currentTime = t; } catch (e) {} }
      repaint();
    }
    function setSide(s, user) {
      if (s === side) return;
      side = s;
      sw.classList.toggle('is-before', s === 'before'); sw.classList.toggle('is-after', s === 'after');
      Array.prototype.forEach.call(sw.querySelectorAll('button'), function (b) { b.setAttribute('aria-checked', String(b.dataset.side === s)); });
      if (!reduced) { sw.classList.remove('morph'); void sw.offsetWidth; sw.classList.add('morph'); }
      if (ch && ch.routed && ctx) {
        var t = ctx.currentTime;
        ramp(ch.before.fade.gain, s === 'before' ? 1 : 0, t, 0.02);
        ramp(ch.after.fade.gain, s === 'after' ? 1 : 0, t, 0.02);
      }
      if (user) track('beforeafter-toggle');
      repaint();
    }
    function applyTrim() {
      if (ch && ch.routed && ctx) { var t = ctx.currentTime; ['before', 'after'].forEach(function (k) { ch[k].trim.gain.setTargetAtTime(trimFor(k), t, 0.015); }); }
    }
    function applyMatch() {
      if (match && !rms) { decodeFallback(); return; }   // keine vorberechnete Lautheit: im Hintergrund messen
      applyTrim();
    }
    // Fallback ohne vorberechnete Peaks/Lautheit: beide Dateien einmal dekodieren (nicht blockierend)
    var decoding = 0;
    function decodeFallback() {
      if (decoding || !rows[idx]) return;
      var tok = loadTok, r = rows[idx]; decoding = 1;
      Promise.all([fetchBuf(pubUrl(r.before_path)), fetchBuf(pubUrl(r.after_path))])
        .then(function (abs) { return Promise.all([decode(abs[0]), decode(abs[1])]); })
        .then(function (b) {
          decoding = 0; if (tok !== loadTok) return;
          if (!peaks) {
            var pb = peaksOf(b[0], 900), pa = peaksOf(b[1], 900), m = 0.0001, i;
            for (i = 0; i < 900; i++) { if (pb[i] > m) m = pb[i]; if (pa[i] > m) m = pa[i]; }
            for (i = 0; i < 900; i++) { pb[i] /= m; pa[i] /= m; }
            peaks = { before: pb, after: pa };
          }
          if (!rms) rms = { before: rmsOf(b[0]), after: rmsOf(b[1]) };
          applyTrim(); repaint();
        })
        .catch(function () { decoding = 0; });
    }

    // ----- Laden (Streaming) -----
    function setRing(f, indeterminate) {
      playBtn.classList.toggle('loading', f !== null);
      playBtn.classList.toggle('indet', !!indeterminate);
      if (f !== null) ring.style.strokeDashoffset = String(RING * (1 - Math.max(0.03, Math.min(1, f))));
    }
    function validPeaks(p) {
      return p && Array.isArray(p.before) && Array.isArray(p.after) && p.before.length > 8 && p.before.length === p.after.length;
    }
    function load() {
      if (loadState === 'loading' || loadState === 'ready') return;
      var tok = ++loadTok, r = rows[idx], pk = r.peaks;
      if (typeof pk === 'string') { try { pk = JSON.parse(pk); } catch (e) { pk = null; } }
      loadState = 'loading'; errEl.hidden = true; setRing(0.3, true);
      if (validPeaks(pk)) {
        var m = 0.0001, i;
        for (i = 0; i < pk.before.length; i++) { if (pk.before[i] > m) m = pk.before[i]; if (pk.after[i] > m) m = pk.after[i]; }
        peaks = { before: pk.before.map(function (v) { return v / m; }), after: pk.after.map(function (v) { return v / m; }) };
        if (pk.rms && pk.rms.before > 0 && pk.rms.after > 0) rms = { before: +pk.rms.before, after: +pk.rms.after };
      }
      teardown();
      var made = {}, ready = { before: false, after: false };
      ch = made;
      ['before', 'after'].forEach(function (k) {
        var el = new Audio();
        el.crossOrigin = 'anonymous'; el.preload = 'auto';
        el.addEventListener('canplay', function () {
          if (tok !== loadTok) return;
          ready[k] = true;
          if (ready.before && ready.after && loadState === 'loading') {
            dur = Math.min(made.before.el.duration || 0, made.after.el.duration || 0);
            if (!isFinite(dur) || dur <= 0) dur = Math.max(made.before.el.duration || 0, made.after.el.duration || 0) || 0;
            loadState = 'ready'; setRing(null); if (!pendingPlay) tState.textContent = '';
            if (!peaks || !rms) decodeFallback();
            repaint();
            if (pendingPlay) { pendingPlay = false; tState.textContent = ''; play(); }
          }
        });
        el.addEventListener('loadedmetadata', function () {
          if (tok !== loadTok) return;
          var d = Math.min(made.before.el.duration || 0, made.after.el.duration || 0);
          if (d > 0 && isFinite(d) && !dur) { dur = d; repaint(); }
        });
        el.addEventListener('waiting', function () { if (tok === loadTok && playing && k === side) setRing(0.3, true); });
        el.addEventListener('playing', function () { if (tok === loadTok && k === side) setRing(null); });
        el.addEventListener('ended', function () { if (tok === loadTok && playing && k === side) finish(); });
        el.addEventListener('error', function () {
          if (tok !== loadTok) return;
          loadState = 'error'; setRing(null); pendingPlay = false; playing = false; stopSync(); setPlayUi(); tState.textContent = ''; errEl.hidden = false;
        });
        el.src = pubUrl(k === 'before' ? r.before_path : r.after_path);
        made[k] = { el: el };
      });
    }
    function selectRow(i) {
      if (i === idx && loadState !== 'idle') return;
      pause(); loadTok++; teardown(); idx = i; peaks = null; rms = null; dur = 0; offset = 0; decoding = 0; loadState = 'idle'; errEl.hidden = true; setRing(null);
      renderTabs(); renderMeta(); repaint();
      if (near) load();
    }

    // ----- Events -----
    playBtn.addEventListener('click', function () { playing ? pause() : play(); });
    sw.addEventListener('click', function (e) { var b = e.target.closest('button[data-side]'); if (b) setSide(b.dataset.side, true); });
    matchIn.addEventListener('change', function () { match = matchIn.checked; applyMatch(); });
    if (tabs) tabs.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) selectRow(+b.dataset.i); });

    function tFromEvent(e) { var r = wave.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width))) * dur; }
    wave.addEventListener('pointerdown', function (e) {
      if (loadState !== 'ready') { load(); return; }
      drag = { t: tFromEvent(e), id: e.pointerId };
      try { wave.setPointerCapture(e.pointerId); } catch (x) {}
      card.focus({ preventScroll: true }); kick(); repaint();
    });
    wave.addEventListener('pointermove', function (e) { if (drag) { drag.t = tFromEvent(e); repaint(); } });
    function endDrag(e, cancel) { if (!drag) return; var t = drag.t; drag = null; if (!cancel) seek(t); else repaint(); }
    wave.addEventListener('pointerup', function (e) { endDrag(e, false); });
    wave.addEventListener('pointercancel', function (e) { endDrag(e, true); });

    card.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target.tagName || '').toLowerCase(), k = e.key, kl = k.length === 1 ? k.toLowerCase() : k;
      if (tag === 'input' && e.target.type !== 'checkbox') return;
      if (k === ' ' || k === 'Spacebar') {
        if (tag === 'button' || tag === 'a' || tag === 'input') return; // Taste loest dort schon selbst aus
        e.preventDefault(); playing ? pause() : play();
      } else if ((k === 'ArrowLeft' || k === 'ArrowRight') && e.shiftKey) {
        if (loadState === 'ready') { e.preventDefault(); seek(pos() + (k === 'ArrowRight' ? 5 : -5)); }
      } else if (kl === 'b' || k === 'ArrowLeft') { e.preventDefault(); setSide('before', true); }
      else if (kl === 'a' || k === 'ArrowRight') { e.preventDefault(); setSide('after', true); }
    });

    document.addEventListener('visibilitychange', function () { if (document.hidden && playing) pause(); });
    window.addEventListener('pagehide', function () { if (playing) pause(); });
    if (window.ResizeObserver) new ResizeObserver(function () { lastDraw = ''; repaint(); }).observe(wave);
    else window.addEventListener('resize', function () { lastDraw = ''; repaint(); });

    // lazy: laden, sobald der Bereich in die Naehe des Bildschirms kommt
    var near = false;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es, o) {
        if (es.some(function (x) { return x.isIntersecting; })) { near = true; load(); o.disconnect(); }
      }, { rootMargin: '600px 0px' }).observe(root);
    }

    renderTabs(); renderMeta(); repaint();
  }

  // ---------- Start ----------
  fetchRows().then(function (rows) {
    if (!rows.length) return;
    sections.forEach(function (s, i) { try { mount(s, rows, i); } catch (e) { s.hidden = true; } });
  }).catch(function () {});
})();

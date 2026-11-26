/* hero-audio.js – Hero der Startseite: Zufalls-Track ("Play a beat"), Oszilloskop-Linie, Headline pumpt auf den Kick,
   plus der 808-Hit fuer den greifbaren Diamanten (home-scroll.js ruft window.YLYHeroAudio.hit(v) auf).
   Tracks kommen aus window.YLYPortfolio.tracks (portfolio.js). Es spielt immer nur eine Quelle: Event 'yly:audio'.
   CORS: audio.yardslovesyou.com erlaubt nur die Produktiv-Domains. Schlaegt das Laden mit crossOrigin fehl (z. B. localhost),
   laeuft derselbe Track ohne Web-Audio-Routing weiter und Linie/Headline folgen dem BPM-Raster (kein Stummschalten).
   Animation nur waehrend Musik laeuft und der Hero im Bild ist. Bei "Bewegung reduzieren": Audio ja, Linie/Pump nein. */
(function () {
  'use strict';
  try {
    var doc = document, win = window;
    var AC = win.AudioContext || win.webkitAudioContext;
    var reduce = false;
    try { reduce = !!(win.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var noop = function () {};

    /* ---------- gemeinsamer AudioContext (nur nach Nutzergeste) ---------- */
    var ctx = null, analyser = null, out808 = null, noiseBuf = null, lastHit = -1;
    var playing = false;
    function ensureCtx() {
      if (!AC) return null;
      if (!ctx) {
        try { ctx = new AC(); } catch (e) { ctx = null; return null; }
        analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.3;
        analyser.minDecibels = -75; analyser.maxDecibels = 0;   // sonst saettigt der Bass-Bereich bei lauten Tracks
        analyser.connect(ctx.destination);
        // 808: Gain -> weicher Begrenzer (tanh) -> Ausgang
        var sh = ctx.createWaveShaper(), curve = new Float32Array(1024), i, k = 2.2, n = Math.tanh(k);
        for (i = 0; i < 1024; i++) curve[i] = Math.tanh(k * (i / 511.5 - 1)) / n;
        sh.curve = curve; sh.oversample = '2x';
        var master = ctx.createGain(); master.gain.value = 0.75;
        out808 = ctx.createGain(); out808.gain.value = 1;
        out808.connect(sh); sh.connect(master); master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') { try { ctx.resume().catch(noop); } catch (e) {} }
      return ctx;
    }

    /* ---------- 808-Hit: Sinus mit schnellem Pitch-Drop auf F1 (43.65 Hz) + kurzer Klick ---------- */
    function hit(vel) {
      if (reduce) return;
      var c = ensureCtx();
      if (!c || c.state !== 'running') return;
      var now = c.currentTime;
      if (lastHit >= 0 && now - lastHit < 0.12) return;
      lastHit = now;
      var v = clamp(+vel || 0, 0, 1);
      var level = (0.25 + 0.75 * Math.pow(v, 1.2)) * (playing ? 0.355 : 1);   // laeuft ein Track: -9 dB
      var osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, now);
      osc.frequency.exponentialRampToValueAtTime(43.65, now + 0.11);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.9 * level, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
      osc.connect(g); g.connect(out808);
      osc.start(now); osc.stop(now + 0.66);
      // Klick: 12 ms Rauschen, hochpassgefiltert
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.012), c.sampleRate);
        var d = noiseBuf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      }
      var ns = c.createBufferSource(), hp = c.createBiquadFilter(), cg = c.createGain();
      ns.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 1800;
      cg.gain.value = 0.3 * level;
      ns.connect(hp); hp.connect(cg); cg.connect(out808); ns.start(now);
    }

    win.YLYHeroAudio = { hit: hit, unlock: ensureCtx, isPlaying: function () { return playing; }, stop: function () { if (playing) stop(); } };

    /* ---------- Hero-Elemente ---------- */
    var hero = doc.getElementById('hero');
    if (!hero) return;
    var btn = hero.querySelector('.hx-ghost'), nowBox = hero.querySelector('.hx-now');
    var nowIn = nowBox && nowBox.querySelector('.hx-now-in'), nowT = nowBox && nowBox.querySelector('.hx-now-t'), nextBtn = nowBox && nowBox.querySelector('.hx-next');
    var wave = hero.querySelector('.hx-wave'), path = wave && wave.querySelector('path'), h1 = hero.querySelector('.hx-h1');
    if (!btn || !nowIn || !nowT || !nextBtn) return;

    var tracks = function () { var P = win.YLYPortfolio; return (P && P.tracks) || []; };
    var elW = null, elP = null, cur = null, mode = 'web', corsFail = false, tok = 0, idx = -1, lastIdx = -1, errTimer = 0;
    var bpm = 120, lastBeat = -1;

    function pick() {
      var n = tracks().length, i;
      if (n < 2) return 0;
      do { i = Math.floor(Math.random() * n); } while (i === lastIdx);
      return i;
    }
    function ui() {
      btn.textContent = playing ? 'Stop' : 'Play a beat';
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      nowIn.hidden = !playing;
      nextBtn.hidden = false;
    }
    function mkEl(cors) {
      var el = new Audio();
      el.preload = 'auto';
      if (cors) el.crossOrigin = 'anonymous';
      el.addEventListener('ended', function () { if (el === cur && playing) next(); });
      el.addEventListener('error', function () { if (el === cur && playing) onError(tok); });
      return el;
    }
    function load(i) {
      var t = tracks()[i];
      if (!t) { fail(); return; }
      tok++; idx = lastIdx = i; bpm = +t.bpm > 0 ? +t.bpm : 120; lastBeat = -1;
      if (!corsFail && AC && ctx && !elW) {
        elW = mkEl(true);
        try { ctx.createMediaElementSource(elW).connect(analyser); } catch (e) { elW = null; corsFail = true; }
      }
      cur = (!corsFail && elW) ? elW : (elP || (elP = mkEl(false)));
      mode = cur === elW ? 'web' : 'fallback';
      [elW, elP].forEach(function (e) { if (e && e !== cur) { try { e.pause(); } catch (x) {} } });
      nowT.textContent = t.title + ' · ' + bpm + ' BPM';
      var my = tok;
      cur.src = t.audio;
      var p = cur.play();
      if (p && p.catch) p.catch(function (err) {
        if (my !== tok || !playing) return;
        var nm = err && err.name;
        if (nm === 'AbortError') return;
        if (nm === 'NotSupportedError') onError(my); else fail();
      });
      kickSched();
    }
    // Web-Audio-Variante gescheitert (CORS): derselbe Track ohne crossOrigin und ohne Routing
    function onError(my) {
      if (my !== tok) return;
      if (mode === 'web') {
        corsFail = true;
        try { elW.pause(); elW.removeAttribute('src'); elW.load(); } catch (e) {}
        load(idx);
      } else fail();
    }
    function fail() {
      stop();
      nowT.textContent = 'That track would not load. Try again.';
      nowIn.hidden = false; nextBtn.hidden = true;
      clearTimeout(errTimer);
      errTimer = setTimeout(function () { if (!playing) nowIn.hidden = true; }, 4000);
    }
    function next() { if (playing) load(pick()); }
    function start() {
      if (!tracks().length) return false;
      clearTimeout(errTimer);
      ensureCtx();   // innerhalb des Klicks freigeben
      playing = true; ui();
      try { win.dispatchEvent(new CustomEvent('yly:audio', { detail: { who: 'hero' } })); } catch (e) {}
      load(pick());
      return true;
    }
    function stop() {
      var was = playing;
      playing = false; tok++;
      [elW, elP].forEach(function (e) { if (e) { try { e.pause(); } catch (x) {} } });
      ui();
      if (was && !inView) resetWave();
    }

    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function (e) {
      if (!tracks().length) return;   // ohne Daten: normaler Link nach #work
      e.preventDefault();
      if (playing) stop(); else start();
    });
    btn.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); btn.click(); }
    });
    nextBtn.addEventListener('click', function () { next(); });
    win.addEventListener('yly:audio', function (e) { if (playing && e.detail && e.detail.who !== 'hero') stop(); });
    win.addEventListener('pagehide', function () { if (playing) stop(); });

    /* ---------- Oszilloskop-Linie + Kick-Pump (rAF nur bei Musik und sichtbarem Hero) ---------- */
    var N = 200, FLAT = 'M0 100H1000';
    var raf = 0, inView = true, amp = 0, lastT = 0, live = false;
    var td = new Uint8Array(2048), fd = new Uint8Array(1024), tv = new Float32Array(N), sm = new Float32Array(N);
    var hist = new Float32Array(45), hi = 0, hn = 0, prevE = 0, lastKick = -1e9;
    var pv = 0, pA = 0, pState = 0, pBase = 100, pBaseH = 0, pCap = 4;   // pCap: max. Prozentpunkte, wird verkleinert falls die Headline umbrechen wuerde

    function kickSched() { if (!reduce) schedule(); }
    function schedule() {
      if (reduce || raf || !inView || !path) return;
      if (!playing && amp <= 0 && pv <= 0) return;
      raf = requestAnimationFrame(frame);
    }
    function resetWave() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      amp = 0; pv = 0; pState = 0; lastT = 0;
      for (var i = 0; i < N; i++) sm[i] = 0;
      if (path) path.setAttribute('d', FLAT);
      if (wave) wave.classList.remove('is-live');
      live = false;
      if (h1) h1.style.fontStretch = '';
    }
    function pump(s) {
      if (!h1) return;
      if (pCap < 0.3) return;
      var a = pCap * (0.55 + 0.45 * s);
      if (pv <= 0) {
        var b = parseFloat(getComputedStyle(h1).fontStretch);
        pBase = b > 0 ? b : 100; pBaseH = h1.offsetHeight;
      }
      pA = Math.max(pv, a); pState = 1;
    }
    function pumpStep(dt) {
      if (pState === 0) return;
      if (pState === 1) {
        pv += pA * dt / 0.03;
        if (pv >= pA) {
          pv = pA; pState = 2;
          h1.style.fontStretch = Math.min(125, pBase + pv).toFixed(2) + '%';
          if (h1.offsetHeight !== pBaseH) { pCap /= 2; pA = pv = Math.min(pA, pCap); }   // Zeilenzahl darf sich nie aendern
        }
      }
      else { pv -= pA * dt / 0.18; if (pv <= 0) { pv = 0; pState = 0; } }
      // exakt zurueck: Inline-Wert entfernen -> berechneter Basiswert
      h1.style.fontStretch = pv <= 0 ? '' : Math.min(125, pBase + pv).toFixed(2) + '%';
    }
    function sampleWeb(now) {
      analyser.getByteTimeDomainData(td);
      analyser.getByteFrequencyData(fd);
      var s0 = 0, i, k;
      for (i = 0; i < 512; i++) if (td[i] < 128 && td[i + 1] >= 128) { s0 = i; break; }
      var span = Math.floor(1024 / N) || 5;
      for (k = 0; k < N; k++) {
        var a = s0 + Math.floor(k * 1024 / N), sum = 0;
        for (i = 0; i < span; i++) sum += td[a + i];
        tv[k] = Math.tanh(((sum / span) - 128) / 128 * 2.2);
      }
      // Kick: Energie unter ~150 Hz gegen adaptive Schwelle (Mittel + Streuung der letzten ~0.75 s)
      var nb = Math.max(2, Math.floor(150 / (ctx.sampleRate / analyser.fftSize))), e = 0;
      for (i = 1; i <= nb; i++) e += fd[i];
      e = e / (nb * 255);
      var m = 0, sd = 0, n = hn;
      for (i = 0; i < n; i++) m += hist[i];
      m = n ? m / n : 0;
      for (i = 0; i < n; i++) sd += (hist[i] - m) * (hist[i] - m);
      sd = n ? Math.sqrt(sd / n) : 0;
      // zusaetzlich: steiler Anstieg aus der juengsten Senke (Bass mit Sidechain-Ducking)
      var tr = 1, L = Math.min(8, n);
      for (i = 1; i <= L; i++) { var hv = hist[(hi - i + hist.length) % hist.length]; if (hv < tr) tr = hv; }
      var rise = e - tr;
      if (n > 10 && e > prevE && e > 0.2 && now - lastKick > 140 && (e > m + Math.max(0.06, 1.3 * sd) || rise > Math.max(0.14, sd))) {
        lastKick = now; pump(clamp(Math.max(e - m, rise) / 0.35, 0.35, 1));
      }
      hist[hi] = e; hi = (hi + 1) % hist.length; if (hn < hist.length) hn++;
      prevE = e;
    }
    function sampleFallback(now) {
      var t = cur ? cur.currentTime : 0, beat = t * bpm / 60, ph = beat - Math.floor(beat), p = Math.exp(-ph * 5), k;
      for (k = 0; k < N; k++) {
        var x = k / N;
        tv[k] = (Math.sin(6.283 * (x * 3 - t * 0.7)) * 0.3 + Math.sin(6.283 * (x * 7.5 + t * 1.3)) * 0.12) * (0.4 + 0.9 * p);
      }
      var b = Math.floor(beat);
      if (lastBeat >= 0 && b !== lastBeat && now - lastKick > 140) { lastKick = now; pump(0.8); }
      lastBeat = b;
    }
    function frame(now) {
      raf = 0;
      var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
      lastT = now;
      amp += ((playing ? 1 : 0) - amp) * (1 - Math.exp(-dt / (playing ? 0.12 : 0.08)));
      if (!playing && amp < 0.01) amp = 0;
      if (playing && cur && !cur.paused) { if (mode === 'web' && analyser) sampleWeb(now); else sampleFallback(now); }
      else for (var z = 0; z < N; z++) tv[z] = 0;
      if (!live) { wave.classList.add('is-live'); live = true; }
      var d = 'M0 100', k;
      for (k = 0; k < N; k++) {
        sm[k] += (tv[k] - sm[k]) * 0.45;
        var x = k / (N - 1), tp = clamp(x / 0.06, 0, 1);
        tp = tp * tp * (3 - 2 * tp);   // linkes Ende bleibt auf der Mittellinie (Anschluss an die Thread-Linie)
        d += 'L' + (x * 1000).toFixed(1) + ' ' + (100 - 70 * amp * tp * sm[k]).toFixed(2);
      }
      path.setAttribute('d', d);
      pumpStep(dt);
      if (playing || amp > 0 || pv > 0) schedule();
      else resetWave();
    }
    if (!reduce && win.IntersectionObserver) {
      new IntersectionObserver(function (es) {
        inView = es[es.length - 1].isIntersecting;
        if (inView) { lastT = 0; schedule(); }
        else if (raf) { cancelAnimationFrame(raf); raf = 0; if (!playing) resetWave(); else if (h1) { pv = 0; pState = 0; h1.style.fontStretch = ''; } }
      }, { threshold: 0 }).observe(hero);
    }
  } catch (err) { /* Seite darf nie wegen des Heros kaputtgehen */ }
})();

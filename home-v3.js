/* home-v3.js - index.html (home): selected work, featured release, mini Chord Starter, newsletter signup.
   Needs config.js, media.js and portfolio.js before it (all deferred, in this order). No autoplay. No inline code (CSP). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.APP_CONFIG || {};
  var reduce = false;
  try { reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  /* ---------- portfolio ---------- */
  if (window.YLYPortfolio) {
    window.YLYPortfolio.renderGrid($('work-grid'), { limit: 8 });
  }

  /* ---------- mini Chord Starter (natural minor, triads; same theory as chords.js) ---------- */
  (function () {
    var list = $('hc-chords'), keySel = $('hc-key'), newBtn = $('hc-new'), playBtn = $('hc-play');
    if (!list || !keySel || !newBtn || !playBtn) return;
    var NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var MINOR = [0, 2, 3, 5, 7, 8, 10];
    var QUAL = ['m', 'dim', '', 'm', 'm', '', '']; // i ii° III iv v VI VII
    var PROGS = [[0, 5, 2, 6], [0, 3, 6, 2], [0, 5, 3, 4], [0, 6, 5, 6], [5, 3, 0, 6], [0, 3, 5, 4], [0, 2, 3, 4]];
    var state = { key: 9, prog: PROGS[0], last: -1 };
    NOTES.forEach(function (n, i) { var o = document.createElement('option'); o.value = i; o.textContent = n + ' minor'; keySel.appendChild(o); });
    keySel.value = String(state.key);

    function deg(d) { return state.key + MINOR[d]; }
    function name(d) { return NOTES[deg(d) % 12] + QUAL[d]; }
    function tones(d) { // triad built on scale degree d, root in octave 3 (MIDI 48+)
      var base = 48 + state.key;
      return [0, 2, 4].map(function (k) { var x = d + k; return base + MINOR[x % 7] + 12 * Math.floor(x / 7); });
    }
    function render() {
      list.innerHTML = '';
      state.prog.forEach(function (d, i) {
        var li = document.createElement('li');
        li.setAttribute('data-i', i);
        li.textContent = name(d);
        list.appendChild(li);
      });
    }
    function newProg() {
      var i; do { i = Math.floor(Math.random() * PROGS.length); } while (i === state.last && PROGS.length > 1);
      state.last = i; state.prog = PROGS[i]; render(); stop();
    }

    var ctx = null, timers = [], playing = false;
    function ensure() {
      if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(ac, midi, t, dur) {
      var f = 440 * Math.pow(2, (midi - 69) / 12);
      var o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = f; o2.frequency.value = f * 2; o2.detune.value = 4;
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(ac.destination);
      o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    }
    function mark(i) {
      [].forEach.call(list.children, function (li, j) { li.classList.toggle('is-now', j === i); });
    }
    function stop() {
      timers.forEach(clearTimeout); timers = []; playing = false; mark(-1);
      playBtn.textContent = 'Play'; playBtn.setAttribute('aria-pressed', 'false');
    }
    function play() {
      var ac = ensure(); if (!ac) return;
      var step = 1.15, t0 = ac.currentTime + 0.05;
      playing = true; playBtn.textContent = 'Stop'; playBtn.setAttribute('aria-pressed', 'true');
      state.prog.forEach(function (d, i) {
        var tn = tones(d);
        tn.forEach(function (m) { tone(ac, m, t0 + i * step, step * 1.05); });
        tone(ac, tn[0] - 12, t0 + i * step, step * 1.05);
        timers.push(setTimeout(function () { mark(i); }, 50 + i * step * 1000));
      });
      timers.push(setTimeout(stop, 50 + state.prog.length * step * 1000));
    }
    playBtn.addEventListener('click', function () { if (playing) stop(); else play(); });
    newBtn.addEventListener('click', newProg);
    keySel.addEventListener('change', function () { state.key = +keySel.value; render(); stop(); });
    render();
  })();

  /* ---------- newsletter: same edge functions as free.html (free-kit + sound-drop) ---------- */
  (function () {
    var form = $('nl-form'); if (!form) return;
    var email = $('nl-email'), consent = $('nl-consent'), btn = $('nl-btn'), status = $('nl-status');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    function fail(msg) { status.textContent = msg; status.classList.add('danger'); }
    function call(fn, body) {
      var h = { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
      if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
      return fetch(cfg.SUPABASE_URL + '/functions/v1/' + fn, { method: 'POST', headers: h, body: JSON.stringify(body) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j && j.ok, j: j || {} }; }); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.classList.remove('danger'); status.textContent = '';
      var addr = email.value.trim();
      if (!EMAIL_RE.test(addr)) { fail('Please enter a valid email address.'); email.focus(); return; }
      if (!consent.checked) { fail('Please tick the box to get the kit and news by email.'); return; }
      if (!cfg.SUPABASE_URL) { fail('Service is not available right now. Please try again.'); return; }
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending …';
      call('free-kit', { email: addr, marketing_consent: true }).then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Something went wrong.');
        try { if (window.ylyTrack) window.ylyTrack('freekit-signup'); } catch (x) {}
        // monthly Sound Drop subscription; the kit mail is already out, so a failure here is not shown as an error
        return call('sound-drop', { email: addr, marketing_consent: true, action: 'subscribe' }).catch(function () {}).then(function () { return res; });
      }).then(function (res) {
        status.textContent = res.j.already_sent ? 'We just sent it to you. Please check your inbox (and spam folder).' : 'You are in. Check your inbox (and spam folder) for the free kit, and confirm your subscription in that email.';
        email.value = ''; consent.checked = false;
      }).catch(function (err) {
        var m = String(err && err.message || 'Something went wrong.');
        fail(/try again|try another/i.test(m) ? m : m.replace(/[.!?\s]*$/, '') + '. Please try again.');
      }).then(function () { btn.disabled = false; btn.textContent = label; });
    });
  })();
})();

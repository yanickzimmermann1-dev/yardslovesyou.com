/* uisound.js - optionale UI-Sounds (Web Audio, synthetisiert, standardmaessig aus). Blockiert nie Klicks. */
(function () {
  'use strict';
  var KEY = 'yly_ui_sound', ctx = null, master = null, on = false, lastHover = 0, lastGesture = 0, hoverEl = null, btn = null, lastCount = null;
  var fine = false;
  try { fine = matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  var NOSND = /(^|\s)(ba|bl|et|sp)(-|\s|$)/;

  function inPlayer(t) {
    for (var n = t; n && n.nodeType === 1; n = n.parentNode) {
      if (n.hasAttribute && n.hasAttribute('data-player')) return true;
      var c = n.className; if (typeof c === 'string' && c && NOSND.test(c.replace(/(^|\s)([a-z]+)-[^\s]*/g, '$1$2-'))) return true;
    }
    return false;
  }
  function busy() {
    if (document.hidden) return true;
    try {
      var m = document.querySelectorAll('audio,video');
      for (var i = 0; i < m.length; i++) if (!m[i].paused && !m[i].ended) return true;
      if (document.querySelector('.is-playing,.playing,[data-playing="true"]')) return true;
    } catch (e) {}
    return false;
  }
  function ok(t) { return on && ctx && ctx.state === 'running' && !busy() && !(t && inPlayer(t)); }
  function ensure() {
    if (!ctx) {
      try {
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 1;
        var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = .005; comp.release.value = .15;
        master.connect(comp); comp.connect(ctx.destination);
      } catch (e) { ctx = null; return; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }
  function mk() {}
  function noise(dur) {
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur)), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var s = ctx.createBufferSource(); s.buffer = buf; return s;
  }
  function env(g, t, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function tone(type, f0, f1, t, dur, peak) {
    var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * .6);
    env(g, t, peak, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
  }
  function burst(kind, t, dur, peak, f, f2) {
    var s = noise(dur), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = kind; fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (kind === 'bandpass') fl.Q.value = .8;
    env(g, t, peak, dur); s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .02);
  }
  var S = {
    hover: function (t) { burst('highpass', t, .025, .035, 5000); },
    click: function (t) { tone('sine', 520, 260, t, .06, .07); burst('highpass', t, .02, .015, 2500); },
    cart: function (t) { tone('triangle', 659.25, 0, t, .12, .05); tone('sine', 987.77, 0, t, .12, .03); tone('triangle', 830.61, 0, t + .08, .18, .06); tone('sine', 1244.5, 0, t + .08, .18, .025); },
    whoosh: function (t) { burst('bandpass', t, .18, .05, 300, 2400); },
    chime: function (t) { tone('sine', 783.99, 0, t, .14, .05); tone('sine', 1174.66, 0, t + .07, .2, .05); }
  };
  function play(name, t) {
    if (!ok(t)) return;
    try { mk(name); S[name](ctx.currentTime + .005); } catch (e) {}
  }

  function setOn(v, silent) {
    on = v;
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    if (btn) btn.setAttribute('aria-pressed', v ? 'true' : 'false');
    if (v) { ensure(); if (!silent && ctx) { var go = function () { if (ctx.state === 'running') { try { mk('chime'); S.chime(ctx.currentTime + .005); } catch (e) {} } }; ctx.state === 'running' ? go() : ctx.resume().then(go, function () {}); } }
  }

  function build() {
    if (btn) return;
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'uis-btn';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.setAttribute('aria-label', 'UI sounds'); btn.title = 'UI sounds on/off';
    var sv = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    btn.innerHTML = sv + ' class="uis-on"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>' + sv + ' class="uis-off"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>';
    var top = document.querySelector('.topbar');
    if (top) top.appendChild(btn); else { btn.classList.add('uis-float'); document.body.appendChild(btn); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); lastGesture = Date.now(); setOn(!on); });
  }

  var SEL = 'a[href],button,[role="button"],summary,.product,input[type="checkbox"],input[type="radio"],label';
  function init() {
    build();
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, function () { lastGesture = Date.now(); if (on) ensure(); }, { capture: true, passive: true });
    });
    document.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest || !on || t === btn || btn.contains(t)) return;
      var el = t.closest(SEL); if (!el || el.closest('[data-cart-add]')) return;
      play('click', el);
    }, { capture: true, passive: true });
    if (fine) document.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var t = e.target; if (!on || !t || !t.closest) return;
      var el = t.closest(SEL); if (!el || el === hoverEl || el === btn) return;
      hoverEl = el;
      var n = Date.now(); if (n - lastHover < 70) return; lastHover = n;
      play('hover', el);
    }, { passive: true });
    // Warenkorb: Zaehler im Badge beobachten (nur nach Nutzer-Geste)
    var watch = function () {
      var b = document.querySelector('.cart-badge'); if (!b) return false;
      lastCount = parseInt(b.textContent, 10) || 0;
      new MutationObserver(function () {
        var c = parseInt(b.textContent, 10) || 0;
        if (c > lastCount && Date.now() - lastGesture < 1500) play('cart', document.activeElement);
        lastCount = c;
      }).observe(b, { childList: true, characterData: true, subtree: true });
      return true;
    };
    if (!watch()) { var tries = 0, iv = setInterval(function () { if (watch() || ++tries > 20) clearInterval(iv); }, 300); }
    // Seitenwechsel: YLYFX.blackout nicht-invasiv umhuellen
    var wrap = function () {
      var F = window.YLYFX; if (!F || typeof F.blackout !== 'function' || F.blackout.__uis) return;
      var orig = F.blackout;
      F.blackout = function (o) { try { if (!(o && o.arrive)) play('whoosh'); } catch (e) {} return orig.apply(this, arguments); };
      F.blackout.__uis = 1;
    };
    wrap(); setTimeout(wrap, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

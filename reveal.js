/* reveal.js – Text-Reveals (Zeilenmasken), rollende Ziffern, Blur-up für Bilder (.bu). Kein Inline-Code (strikte CSP).
   Respektiert prefers-reduced-motion, html.fx-arrived (Elemente im ersten Viewport bleiben unverändert), [data-hs], Hero, Intro. */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body;
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var arrived = root.classList.contains('fx-arrived');
  var T0 = (window.performance && performance.now) ? performance.now() : 0;

  /* ---------- Blur-up ---------- */
  root.classList.add('bu-on');
  function buDone(img) { img.classList.add('bu-in'); }
  function buScan(scope) {
    var list = (scope.matches && scope.matches('img.bu')) ? [scope] : [];
    if (scope.querySelectorAll) list = list.concat([].slice.call(scope.querySelectorAll('img.bu')));
    list.forEach(function (img) { if (!img.classList.contains('bu-in') && img.complete) buDone(img); });
  }
  document.addEventListener('load', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('bu')) buDone(t); }, true);
  document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('bu')) buDone(t); }, true);
  buScan(document);

  /* ---------- Text / Zahlen ---------- */
  var HEAD = 'h1, h2, .eyebrow';
  var ROLL = '[data-roll], .price, .mc-price, .stat-value, .stat-num';
  var SKIP = '.hero, [data-hs], .intro, #intro, [class*="intro-"], .holo, [class*="holo"], dialog, .sk, .sk-card, [hidden], .pd-sticky, .cart-drawer, #cart-drawer, script, style';
  var items = [], seen = (typeof WeakSet === 'function') ? new WeakSet() : null;
  var io = null;

  function eligible(el) {
    if (seen && seen.has(el)) return false;
    var sk = el.closest(SKIP); if (sk && sk !== root && sk !== body) return false;
    if (!el.getClientRects().length) return false;
    if (!(el.textContent || '').trim()) return false;
    if (arrived && (performance.now() - T0) < 3000) {
      var r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) { if (seen) seen.add(el); return false; }
    }
    return true;
  }

  function onlyText(el) { for (var i = 0; i < el.childNodes.length; i++) if (el.childNodes[i].nodeType !== 3) return false; return true; }
  function mk(cls, txt) { var s = document.createElement('span'); if (cls) s.className = cls; if (txt != null) s.textContent = txt; return s; }

  function splitLines(it) {
    var el = it.el, text = it.text;
    el.textContent = '';
    var words = text.split(/\s+/).filter(Boolean), spans = [];
    words.forEach(function (w, i) { var s = mk('', w); spans.push(s); el.appendChild(s); if (i < words.length - 1) el.appendChild(document.createTextNode(' ')); });
    var lines = [], top = null;
    spans.forEach(function (s, i) {
      var t = s.offsetTop;
      if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
      lines[lines.length - 1].push(words[i]);
    });
    el.textContent = '';
    lines.forEach(function (ws, n) {
      var l = mk('rvl-line'), inn = mk('rvl-in', ws.join(' '));
      inn.style.whiteSpace = 'nowrap'; inn.style.setProperty('--i', n);
      l.appendChild(inn); el.appendChild(l);
    });
  }

  function prepHead(el) {
    var it = { el: el, kind: 'head', text: el.textContent.replace(/\s+/g, ' ').trim(), w: el.clientWidth };
    var h0 = el.getBoundingClientRect().height;
    el.setAttribute('aria-label', it.text);
    if (el.classList.contains('eyebrow')) { el.classList.add('rvl-eb'); }
    else if (onlyText(el)) {
      splitLines(it);
    } else { // gemischter Inhalt (Spans/Links): ganze Überschrift als eine Zeile maskieren
      var l = mk('rvl-line'), inn = mk('rvl-in');
      inn.style.setProperty('--i', 0);
      while (el.firstChild) inn.appendChild(el.firstChild);
      l.appendChild(inn); el.appendChild(l); it.mixed = true;
    }
    var tol = 2 + 0.13 * parseFloat(getComputedStyle(el).fontSize || 16); // Maskenpuffer unten (per Negativmargin ausgeglichen)
    if (Math.abs(el.getBoundingClientRect().height - h0) > tol) { // Layout verändert: zurücksetzen
      el.textContent = it.text; el.removeAttribute('aria-label'); el.classList.remove('rvl-eb'); return null;
    }
    return it;
  }

  function prepRoll(el) {
    if (!onlyText(el)) return null;
    var text = el.textContent, h0 = el.getBoundingClientRect().height, w0 = el.getBoundingClientRect().width;
    if (!/\d/.test(text) || text.length > 24) return null;
    var it = { el: el, kind: 'roll', text: text, cols: [] };
    el.style.whiteSpace = 'nowrap';
    el.textContent = '';
    var sr = mk('rvl-sr', text.trim()); el.appendChild(sr);
    var run = null;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (/\d/.test(ch)) {
        run = null;
        var d = mk('rvl-d'), col = document.createElement('span');
        for (var k = 0; k < 10; k++) { var n = document.createElement('i'); n.textContent = k; col.appendChild(n); }
        d.appendChild(col); d.setAttribute('aria-hidden', 'true'); el.appendChild(d);
        it.cols.push({ col: col, d: +ch, i: it.cols.length });
      } else {
        if (!run) { run = mk(''); run.setAttribute('aria-hidden', 'true'); el.appendChild(run); }
        run.textContent += ch;
      }
    }
    var r = el.getBoundingClientRect();
    if (Math.abs(r.height - h0) > 2 || Math.abs(r.width - w0) > 3) { el.textContent = text; el.style.whiteSpace = ''; return null; }
    return it;
  }

  function play(it) {
    if (it.kind === 'roll') {
      setTimeout(function () { if (it.el.isConnected && it.el.querySelector('.rvl-sr')) { it.el.textContent = it.text; it.el.style.whiteSpace = ''; } }, 1600 + it.cols.length * 60); // danach wieder normaler Text (Auswahl/Kopieren, Screenreader)
      it.cols.forEach(function (c) { c.col.parentNode.style.setProperty('--i', c.i); c.col.style.setProperty('--i', c.i); c.col.style.transform = 'translateY(' + (-c.d * 1.2) + 'em)'; });
    } else it.el.classList.add('rvl-go');
    it.played = true;
  }

  function scan(scope) {
    if (reduce || !body || !io) return;
    var sc = scope || body, list = sc.querySelectorAll ? [].slice.call(sc.querySelectorAll(HEAD + ',' + ROLL)) : [];
    if (sc.matches && sc.matches(HEAD + ',' + ROLL)) list.unshift(sc);
    list.forEach(function (el) {
      if (!eligible(el)) return;
      if (seen) seen.add(el);
      var it = el.matches(ROLL) && !el.matches(HEAD) ? prepRoll(el) : prepHead(el);
      if (!it) return;
      items.push(it);
      if (io) io.observe(el);
    });
  }

  function resplit() {
    items.forEach(function (it) {
      if (it.kind !== 'head' || it.mixed || it.el.classList.contains('rvl-eb') || !it.el.isConnected) return;
      var w = it.el.clientWidth; if (w === it.w) return; it.w = w;
      splitLines(it);
      if (it.played) it.el.classList.add('rvl-go');
    });
  }

  function init() {
    if (reduce) return;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          for (var i = 0; i < items.length; i++) if (items[i].el === en.target) { play(items[i]); break; }
        });
      }, { threshold: 0.2, rootMargin: '0px 0px -5% 0px' });
    } else return;
    scan();
  }

  var queued = false, pending = [];
  function queue(n) { pending.push(n); if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; var p = pending; pending = []; p.forEach(function (n) { if (n.isConnected) scan(n); }); }); }

  function boot() {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        [].forEach.call(m.addedNodes, function (n) {
          if (n.nodeType !== 1) return;
          buScan(n);
          if (!reduce && !n.closest('[aria-label][data-rvl-x]') && !(n.parentNode && n.parentNode.closest && n.parentNode.closest('.rvl-line,.rvl-d,.rvl-eb'))) queue(n);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
    var go = function () { init(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go();
    var rt, lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return; lastW = window.innerWidth;
      clearTimeout(rt); rt = setTimeout(resplit, 200);
    }, { passive: true });
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();

/* sample.js - "Free sample page" auf den sechs Guide-Seiten (vanilla JS, CSP-konform).
   E-Mail eingeben -> Function free-kit (Pack "sample-<guide>") schickt per Mail den Link zu einer Probeseite (PDF).
   Voraussetzung: Zeilen in der Tabelle free_packs (siehe 22-guide-samples.sql). Die Sektion wird vor "Complete the set" eingehaengt. */
(function () {
  'use strict';
  var cfg = window.APP_CONFIG || {};
  var root = document.getElementById('product-root');
  var slug = location.pathname.replace(/^.*\//, '').replace(/\.html$/, '');
  if (!root || !/^guide-[a-z0-9-]+$/.test(slug)) return;
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY || String(cfg.SUPABASE_URL).indexOf('https://') !== 0) return;
  var pack = 'sample-' + slug.slice(6);
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var track = function (n, d) { try { if (window.ylyTrack) window.ylyTrack(n, d); } catch (e) {} };

  (function () { if (!document.querySelector('link[href^="sample.css"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'sample.css?v=20261122a'; document.head.appendChild(l); } })();

  function build() {
    if (document.getElementById('sample-gate')) return;
    var sec = document.createElement('section');
    sec.id = 'sample-gate'; sec.className = 'wrap sg'; sec.setAttribute('aria-labelledby', 'sg-h');
    sec.innerHTML =
      '<div class="sg-card" id="sg-card">' +
      '<h2 id="sg-h">Read a free page first</h2>' +
      '<p class="muted sg-lead">Get one page from this guide by email and see how it works before you buy.</p>' +
      '<form id="sg-form" novalidate>' +
      '<div class="sg-row"><input id="sg-email" type="email" placeholder="your@email.com" autocomplete="email" aria-label="Email address" required>' +
      '<button id="sg-btn" class="button" type="submit">Send me a page</button></div>' +
      '<label class="sg-consent"><input id="sg-consent" type="checkbox"><span>Yes, send me new releases and deals by email. I can unsubscribe at any time.</span></label>' +
      '<p class="sg-hint">We use your email to send you the sample. See our <a href="privacy.html">privacy policy</a>.</p>' +
      '<p id="sg-status" class="status" role="status"></p>' +
      '</form></div>';
    root.parentNode.insertBefore(sec, root.nextSibling);
    wire();
    jumpLink();
  }

  // Small text link under the Buy / Add-to-cart row: scrolls to the form and focuses the email field.
  function jumpLink() {
    var place = function () {
      var row = root.querySelector('.gd-buyrow') || root.querySelector('.pd-buy');
      if (!row || !document.getElementById('sg-form')) return;
      if (row.parentNode.querySelector('.sg-jump')) return;
      var p = document.createElement('p');
      p.className = 'sg-jump';
      p.innerHTML = '<a href="#sample-gate">Read a free sample page \u2193</a>';
      row.parentNode.insertBefore(p, row.nextSibling);
      p.firstChild.addEventListener('click', function (e) {
        e.preventDefault();
        var f = document.getElementById('sg-form'), em = document.getElementById('sg-email');
        var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (f && f.scrollIntoView) f.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        setTimeout(function () { try { if (em) em.focus({ preventScroll: true }); } catch (x) {} }, reduce ? 0 : 500);
        track('sample-jump', { pack: pack });
      });
    };
    place();
    if (window.MutationObserver) new MutationObserver(place).observe(root, { childList: true, subtree: true });
  }

  function wire() {
    var form = document.getElementById('sg-form'), email = document.getElementById('sg-email'), consent = document.getElementById('sg-consent');
    var btn = document.getElementById('sg-btn'), status = document.getElementById('sg-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.classList.remove('danger'); status.textContent = '';
      var addr = email.value.trim();
      if (!EMAIL_RE.test(addr)) { status.textContent = 'Please enter a valid email address.'; status.classList.add('danger'); email.focus(); return; }
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending …';
      var h = { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
      if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
      fetch(cfg.SUPABASE_URL + '/functions/v1/free-kit', { method: 'POST', headers: h, body: JSON.stringify({ email: addr, marketing_consent: consent.checked, pack: pack }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok || !res.j.ok) throw new Error((res.j && res.j.error) || 'Something went wrong.');
          track('sample-signup', { pack: pack });
          var card = document.getElementById('sg-card');
          card.innerHTML = '<h2>' + (res.j.already_sent ? 'Already on its way' : 'Check your inbox') + '</h2>' +
            '<p class="muted sg-lead" role="status">' + (res.j.already_sent ? 'We just sent it to you. Please check your inbox (and your spam folder).' : 'Your free page is on its way. Check your inbox (and your spam folder, just in case).') + '</p>';
        })
        .catch(function (err) {
          var m = String((err && err.message) || 'Something went wrong.');
          status.textContent = /try again|try another|not available/i.test(m) ? m : m.replace(/[.!?\s]*$/, '') + '. Please try again.';
          status.classList.add('danger');
          btn.disabled = false; btn.textContent = label;
        });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();

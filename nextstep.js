/* nextstep.js – "Next step" block before footer.site-footer on every page + scroll reveal for the home entry cards.
   Per-page config: <body data-next='{"line":"...","btns":[["Label","href"],...]}'> or the MAP below (keyed by page name). No inline code (CSP). */
(function () {
  'use strict';
  try {
    var doc = document, root = doc.documentElement, body = doc.body;
    var footer = doc.querySelector('footer.site-footer');
    var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var arrived = root.classList.contains('fx-arrived'), T0 = performance.now();
    var io = null;

    function reveal(els) {
      if (reduce || !window.IntersectionObserver) return;
      io = io || new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('ns-in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      els.forEach(function (el, i) {
        var r = el.getBoundingClientRect();
        if (arrived && performance.now() - T0 < 3000 && r.bottom > 0 && r.top < window.innerHeight) return;
        el.style.setProperty('--i', i);
        el.classList.add('ns-rv'); io.observe(el);
      });
    }
    function track(from, to) { try { window.ylyTrack && window.ylyTrack('nextstep-click', { from: from, to: to }); } catch (e) {} }

    var page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';

    // entry cards on home
    var ep = doc.querySelector('.entry-paths');
    if (ep) {
      reveal([].slice.call(ep.querySelectorAll('.section-head, .ep-card')));
      ep.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a'); if (a) track('entry', a.getAttribute('href')); });
    }

    if (!footer || doc.querySelector('.next-step')) return;

    var UP = ['Send your track', 'upload.html'], SHOP = ['Browse the shop', 'shop.html'], FREE = ['Try the free tools', 'free.html'];
    var LAB = ['Share in the Lab', 'community.html'], HOME = ['Back to home', '/'];
    var LEGAL = { line: 'Looking for something else?', btns: [HOME, ['Shop', 'shop.html']] };
    var MAP = {
      index: { line: 'Ready? Send your track.', btns: [['Upload your track', 'upload.html'], ['Browse the shop', 'shop.html']] },
      shop: { line: 'Need a mix too?', btns: [['Upload your track', 'upload.html'], FREE] },
      product: { line: 'Looking for more?', btns: [SHOP, FREE] },
      upload: { line: 'While you wait: train your ears.', btns: [['Try the Ear Trainer', 'eartrainer.html'], ['Get the guide', 'shop.html']] },
      success: { line: 'Your order is on its way. What next?', btns: [['Explore the Perc Lab', 'beatlab.html'], ['Back to shop', 'shop.html']] },
      status: { line: 'Your order is on its way. What next?', btns: [['Explore the Perc Lab', 'beatlab.html'], ['Back to shop', 'shop.html']] },
      free: { line: 'Want pro sounds?', btns: [['Get Essentials', 'shop.html'], ['Get your track mixed', 'upload.html']] },
      beatlab: { line: 'Like the sounds? Take the loop further.', btns: [['Write chords for your loop', 'chords.html'], LAB] },
      chords: { line: 'Add percussion to your chords.', btns: [['Open the Perc Lab', 'beatlab.html'], LAB] },
      eartrainer: { line: 'Hear it in a real mix.', btns: [['Hear the difference', '/#hear'], ['Get your track mixed', 'upload.html']] },
      community: { line: 'Make something new.', btns: [['Perc Lab', 'beatlab.html'], ['Chord Starter', 'chords.html']] },
      profile: { line: 'Make something new.', btns: [['Perc Lab', 'beatlab.html'], ['Chord Starter', 'chords.html']] },
      account: { line: 'Your next stop.', btns: [['Go to the Lab', 'community.html']] },
      imprint: LEGAL, privacy: LEGAL, license: LEGAL, security: LEGAL, contributing: LEGAL,
      'code-of-conduct': LEGAL, 'community-guidelines': LEGAL
    };

    var cfg = null, attr = body.getAttribute('data-next');
    if (attr === 'none') return;
    if (attr) { try { cfg = JSON.parse(attr); } catch (e) {} }
    cfg = cfg || MAP[page];
    if (!cfg) return;

    function build(c) {
      var sec = doc.createElement('section'); sec.className = 'next-step'; sec.setAttribute('aria-label', 'Next step');
      var box = doc.createElement('div'); box.className = 'ns-box';
      var tx = doc.createElement('div'); tx.className = 'ns-text';
      var ey = doc.createElement('p'); ey.className = 'eyebrow';
      var ic = doc.createElement('span'); ic.className = 'area-ico'; ic.setAttribute('aria-hidden', 'true');
      ey.appendChild(ic); ey.appendChild(doc.createTextNode('Next step'));
      var ln = doc.createElement('p'); ln.className = 'ns-line'; ln.textContent = c.line;
      tx.appendChild(ey); tx.appendChild(ln);
      var ac = doc.createElement('div'); ac.className = 'ns-actions';
      c.btns.forEach(function (b, i) {
        var a = doc.createElement('a'); a.className = i ? 'outline' : 'button'; a.href = b[1]; a.textContent = b[0];
        a.addEventListener('click', function () { track(page, b[1]); });
        ac.appendChild(a);
      });
      box.appendChild(tx); box.appendChild(ac); sec.appendChild(box);
      return sec;
    }
    var sec = build(cfg);
    footer.parentNode.insertBefore(sec, footer);
    reveal([sec]);

    // product page: choose by content (guide vs. kit) once product.js has rendered
    if (page === 'product') {
      var pr = doc.getElementById('product-root'), done = false;
      var apply = function () {
        if (done || !pr) return;
        var guide = !!doc.getElementById('guide-root');
        if (!guide && !pr.querySelector('h1')) return;
        done = true;
        var c = guide ? { line: 'Train your ears with the free Ear Trainer.', btns: [['Open the Ear Trainer', 'eartrainer.html'], SHOP] }
                      : { line: 'Make loops with these sounds in the Perc Lab.', btns: [['Open the Perc Lab', 'beatlab.html'], SHOP] };
        var n = build(c); sec.parentNode.replaceChild(n, sec); sec = n; n.classList.add('ns-rv', 'ns-in');
      };
      if (pr && window.MutationObserver) { new MutationObserver(apply).observe(pr, { childList: true, subtree: true }); apply(); }
    }
  } catch (err) { /* never break the page */ }
})();

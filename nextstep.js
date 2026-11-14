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
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          var el = e.target; el.classList.add('ns-in'); io.unobserve(el);
          /* One-shot reveal: when it has finished, drop the reveal classes so the element's own CSS (hover lift) is the only
             writer of transform/transition from then on (the reveal transition + stagger delay used to leak into :hover). */
          setTimeout(function () { el.classList.remove('ns-rv', 'ns-in'); el.style.removeProperty('--i'); }, 700 + (+el.style.getPropertyValue('--i') || 0) * 90 + 160);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      els.forEach(function (el, i) {
        if (el.classList.contains('rv') || el.matches('.section-head,[data-hs]')) return;   /* motion.js owns these reveals (no second writer) */
        var r = el.getBoundingClientRect();
        if (arrived && performance.now() - T0 < 3000 && r.bottom > 0 && r.top < window.innerHeight) return;
        el.style.setProperty('--i', i);
        el.classList.add('ns-rv'); io.observe(el);
      });
    }
    function track(from, to) { try { window.ylyTrack && window.ylyTrack('nextstep-click', { from: from, to: to }); } catch (e) {} }

    var page = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
    if (body.hasAttribute('data-product-id')) page = 'product';

    // entry cards on home
    var ep = doc.querySelector('.entry-paths');
    if (ep) {
      reveal([].slice.call(ep.querySelectorAll('.section-head, .ar-card, .ep-card')));
      ep.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a'); if (a) track('entry', a.getAttribute('href')); });
    }

    if (!footer || doc.querySelector('.next-step')) return;

    var UP = ['Send your track', 'upload.html'], SHOP = ['Browse the shop', 'shop.html'], FREE = ['Try the Lab tools', 'community.html#tools'];
    var LAB = ['Share in the Lab', 'community.html#community'], HOME = ['Back to home', '/'];
    var LEGAL = { line: 'Looking for something else?', btns: [HOME, ['Shop', 'shop.html']] };
    var MAP = {
      index: { line: 'Ready? Send your track.', btns: [['Upload your track', 'upload.html'], ['Browse the shop', 'shop.html']] },
      shop: { line: 'Need a mix too?', btns: [['Upload your track', 'upload.html'], FREE] },
      product: { line: 'Looking for more?', btns: [SHOP, FREE] },
      upload: { line: 'While you wait: train your ears.', btns: [['Try the Ear Trainer', 'eartrainer.html'], ['Get the guide', 'shop.html']] },
      success: { line: 'Your order is on its way. What next?', btns: [['Explore the Perc Lab', 'beatlab.html'], ['Back to shop', 'shop.html']] },
      status: { line: 'Your order is on its way. What next?', btns: [['Explore the Perc Lab', 'beatlab.html'], ['Back to shop', 'shop.html']] },
      free: { line: 'Turn the sounds into music.', btns: [['Make loops with the free tools', 'community.html#tools'], ['Pro sounds: Essentials', 'essentials.html']] },
      mixcheck: { line: 'Want a pro to take it from here?', btns: [['Get your track mixed', 'upload.html'], ['Train your ears', 'eartrainer.html']] },
      beatlab: { line: 'Like the sounds? Take the loop further.', btns: [['Write chords for your loop', 'chords.html'], LAB] },
      chords: { line: 'Add percussion to your chords.', btns: [['Open the Perc Lab', 'beatlab.html'], LAB] },
      eartrainer: { line: 'Hear it in a real mix.', btns: [['Hear the difference', 'upload.html#hear'], ['Get your track mixed', 'upload.html']] },
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

    // Farbe des Ziels: Upload pink, Shop gold, Free tuerkis, Lab blau, sonst lila
    function tone(href) {
      var h = String(href || '').split(/[?#]/)[0].replace(/^\//, '');
      if (h === 'upload.html') return 'service';
      if (/^(shop|product|essentials|the-last-yards)\.html$/.test(h)) return 'shop';
      if (h === 'free.html') return 'free';
      if (/^(community|beatlab|chords|eartrainer|mixcheck|profile)\.html$/.test(h)) return 'lab';
      return 'home';
    }
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
      c.btns.slice(0, 1).forEach(function (b, i) {
        var a = doc.createElement('a'); a.className = i ? 'outline' : 'button'; a.href = b[1]; a.textContent = b[0];
        var t = tone(b[1]); a.setAttribute('data-tone', t); if (!i) box.setAttribute('data-tone', t);
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
        if (!guide && !pr.querySelector('#add-cart-btn')) return;
        done = true;
        var c = guide ? { line: 'Train your ears with the free Ear Trainer.', btns: [['Open the Ear Trainer', 'eartrainer.html'], SHOP] }
                      : { line: 'Make loops with these sounds in the Perc Lab.', btns: [['Open the Perc Lab', 'beatlab.html'], SHOP] };
        var n = build(c); sec.parentNode.replaceChild(n, sec); sec = n; n.classList.add('ns-rv', 'ns-in');
      };
      if (pr && window.MutationObserver) { new MutationObserver(apply).observe(pr, { childList: true, subtree: true }); apply(); }
    }
  } catch (err) { /* never break the page */ }
})();

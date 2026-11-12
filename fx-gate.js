/* fx-gate.js – blockierend im <head>: kam der Besucher per Seitenübergang (Schwarz + Partikel), Seite sofort abdunkeln (kein Flackern)
   und bis zur Bereitschaft verborgen halten (fx-hold), damit nichts mehr springt, wenn das Schwarz weicht.
   fx-arrived bleibt für die Lebensdauer der Seite: Hero-Einblendung und Scroll-Reveal im ersten Viewport werden übersprungen. */
(function () {
  try {
    var r = document.documentElement;
    if (sessionStorage.getItem('yly_nav_fx')) {
      sessionStorage.removeItem('yly_nav_fx');
      if (!r.classList.contains('intro-on')) {
        r.classList.add('fx-arrive', 'fx-arrived', 'fx-hold');
        setTimeout(function () { r.classList.remove('fx-hold'); }, 1500); // Notbremse, falls fx.js ausfällt
        // laufende Netzwerkanfragen zählen (für „Seite ist bereit“)
        var net = window.__ylyNet = { pending: 0, last: performance.now() };
        if (window.fetch) {
          var of = window.fetch;
          window.fetch = function () {
            var u = ''; try { u = String(arguments[0] && arguments[0].url || arguments[0]); } catch (e) {}
            if (/umami|analytics/i.test(u)) return of.apply(this, arguments);
            net.pending++;
            var done = function () { net.pending = Math.max(0, net.pending - 1); net.last = performance.now(); };
            var p = of.apply(this, arguments);
            p.then(done, done);
            return p;
          };
        }
      }
    }
  } catch (e) {}
})();

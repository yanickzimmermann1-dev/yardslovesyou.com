/* fx-gate.js – blockierend im <head>: kam der Besucher per Seitenübergang (Schwarz + Partikel), Seite sofort abdunkeln (kein Flackern). */
(function () {
  try {
    var r = document.documentElement;
    if (sessionStorage.getItem('yly_nav_fx')) {
      sessionStorage.removeItem('yly_nav_fx');
      if (!r.classList.contains('intro-on')) r.classList.add('fx-arrive');
    }
  } catch (e) {}
})();

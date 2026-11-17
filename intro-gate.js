/* intro-gate.js – entscheidet blockierend (vor dem CSS), ob das Intro läuft. */
(function () {
  try {
    var l = location, play = true;
    if (navigator.webdriver) play = false;
    if (l.hash || /[?&]nointro\b/.test(l.search)) play = false;
    // Kein Intro auf kleinen / Touch-Screens (versteckt sonst ~2.5s den Hero)
    try { if (window.matchMedia && (matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches)) play = false; } catch (e) {}
    if (play) {
      try {
        if (sessionStorage.getItem('yly_intro_seen')) play = false;
        else sessionStorage.setItem('yly_intro_seen', '1');
      } catch (e) {}
    }
    if (play) document.documentElement.classList.add('intro-on');
  } catch (e) {}
})();

/* free-gate.js - setzt VOR dem ersten Rendern die Klasse fp-focus, wenn free.html?ep=... geoeffnet wird
   (Fokus-Seite ohne Navigation; verhindert, dass kurz die ganze Seite aufblitzt). freepacks.js nimmt sie bei Bedarf wieder weg. */
(function () {
  try { if (/[?&]ep=/.test(location.search)) document.documentElement.classList.add('fp-focus'); } catch (e) {}
})();

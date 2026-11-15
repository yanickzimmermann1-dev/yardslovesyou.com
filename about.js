/* about.js - accessible photo lightbox for the About gallery (native <dialog>). */
(function () {
  'use strict';
  var dlg = document.getElementById('ab-lb');
  var btns = Array.prototype.slice.call(document.querySelectorAll('.ab-shot-btn'));
  if (!dlg || !btns.length || typeof dlg.showModal !== 'function') return;
  var img = dlg.querySelector('img');
  var cap = dlg.querySelector('figcaption');
  var idx = 0, opener = null;

  function show(i) {
    idx = (i + btns.length) % btns.length;
    var src = btns[idx].querySelector('img');
    img.src = src.getAttribute('src');
    img.alt = src.alt;
    cap.textContent = src.alt + ' (' + (idx + 1) + '/' + btns.length + ')';
  }
  btns.forEach(function (b, i) {
    b.addEventListener('click', function () {
      opener = b; show(i); dlg.showModal();
    });
  });
  dlg.querySelector('.ab-lb-close').addEventListener('click', function () { dlg.close(); });
  dlg.querySelector('.ab-lb-prev').addEventListener('click', function () { show(idx - 1); });
  dlg.querySelector('.ab-lb-next').addEventListener('click', function () { show(idx + 1); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
  });
  dlg.addEventListener('close', function () {
    img.removeAttribute('src');
    if (opener) opener.focus();
  });
})();

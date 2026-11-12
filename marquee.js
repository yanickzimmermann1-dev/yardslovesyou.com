(function () {
  'use strict';
  var host = document.querySelector('main') || document.body;
  var about = document.getElementById('about');
  if (!document.querySelector('.hero') || !about || !document.getElementById('services')) return;
  var WORDS = ['HIP-HOP', 'TRAP', 'DRILL', 'AFROBEATS', 'R&B', 'MIXING', 'MASTERING', 'VOCAL HOOKS', 'PERCUSSION'];
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function star() {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'mq-star'); s.setAttribute('focusable', 'false');
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M12 1 14.6 9.4 23 12 14.6 14.6 12 23 9.4 14.6 1 12 9.4 9.4z');
    p.setAttribute('fill', 'currentColor'); s.appendChild(p); return s;
  }
  function makeSet(offset) {
    var set = document.createElement('div'); set.className = 'mq-set';
    WORDS.forEach(function (w, i) {
      var sp = document.createElement('span');
      sp.className = 'mq-w' + (((i + offset) % 2) ? ' o' : '');
      sp.textContent = w; set.appendChild(sp); set.appendChild(star());
    });
    return set;
  }
  var band = document.createElement('div');
  band.className = 'mq-band'; band.setAttribute('aria-hidden', 'true');
  var rows = [];
  [0, 1].forEach(function (r) {
    var row = document.createElement('div'); row.className = 'mq-row';
    for (var k = 0; k < 4; k++) row.appendChild(makeSet(r)); // 4 sets: >= 2 viewports
    band.appendChild(row);
    rows.push({ el: row, x: 0, w: 0, dir: r ? 1 : -1, mult: r ? 0.7 : 1 });
  });
  about.parentNode.insertBefore(band, about); // divider between the work showcase and About

  function measure() {
    band.style.marginLeft = '0'; band.style.width = '';
    var l = band.getBoundingClientRect().left, cw = document.documentElement.clientWidth;
    band.style.marginLeft = (-l) + 'px'; band.style.width = cw + 'px';
    rows.forEach(function (r) {
      var s = r.el.firstChild; r.w = s ? s.getBoundingClientRect().width : 0;
      if (r.w) { r.x = ((r.x % r.w) + r.w) % r.w - r.w; }
    });
  }
  function render() {
    rows.forEach(function (r) {
      if (r.w) { while (r.x <= -r.w) r.x += r.w; while (r.x > 0) r.x -= r.w; }
      r.el.style.transform = 'translate3d(' + r.x.toFixed(2) + 'px,0,0)';
    });
  }
  measure(); render();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); render(); });
  addEventListener('resize', function () { measure(); render(); });
  if (reduce) return;

  var BASE = 40, vis = true, raf = 0, last = 0, lastY = scrollY, vel = 0, flip = 1, flipT = 1, boost = 0;
  addEventListener('scroll', function () {
    var y = scrollY, d = y - lastY; lastY = y;
    if (Math.abs(d) > 0.5) { flipT = d > 0 ? 1 : -1; vel = Math.min(Math.abs(d), 120); }
  }, { passive: true });
  function tick(t) {
    raf = 0; if (!vis || document.hidden) return;
    var dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    flip += (flipT - flip) * Math.min(1, dt * 4);
    boost += (vel * 0.12 - boost) * Math.min(1, dt * 6);
    vel *= Math.pow(0.02, dt);
    var sp = (BASE * (1 + boost * 3)) * dt;
    rows.forEach(function (r) { r.x += r.dir * flip * -1 * sp * r.mult * -1; });
    // dir -1 + flip 1 => moves left
    render(); raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf && vis && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) start(); }, { rootMargin: '100px' }).observe(band);
  }
  document.addEventListener('visibilitychange', start);
  start();
})();

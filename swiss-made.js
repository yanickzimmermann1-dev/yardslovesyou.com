/* swiss-made.js - SWISS MADE landing page (draft): SVG map, synth sketches (Web Audio), waitlist form. No inline code (CSP). */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function $(id) { return document.getElementById(id); }
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- data ---------- */
  var PLACES = [
    { id: 'appenzell', name: 'Appenzell', canton: 'AI', lat: 47.33, lon: 9.41, snd: 'cowbell',
      fact: 'Appenzell is known for its alpine cowbell tradition; huge "Schellen" bells are worn and rung when herds move to and from the summer pastures.',
      rec: 'Brass and forged cowbells', becomes: 'Cowbells (the trap cowbell, tuned)', dx: 14, dy: -10 },
    { id: 'aletsch', name: 'Aletsch Glacier', canton: 'VS', lat: 46.50, lon: 8.03, snd: 'snare',
      fact: 'The largest glacier in the Alps, about 20 km long, part of a UNESCO World Heritage site.',
      rec: 'Cracking and shifting ice, meltwater', becomes: 'Snares and claps', dx: 14, dy: -10 },
    { id: 'zurich', name: 'Zürich, Paradeplatz', canton: 'ZH', lat: 47.37, lon: 8.54, snd: 'riser',
      fact: 'One of the busiest tram hubs in Zürich\'s tram network.',
      rec: 'Tram brakes, bells, rail squeal', becomes: 'Risers, FX and transitions', dx: -14, dy: -12, anchor: 'end' },
    { id: 'joux', name: 'Vallée de Joux', canton: 'VD', lat: 46.62, lon: 6.23, snd: 'hat',
      fact: 'A high valley in the Jura that has been a centre of Swiss watchmaking for centuries.',
      rec: 'Watch movements ticking, tiny metal parts', becomes: 'Hi-hats and percs', dx: 14, dy: -10 },
    { id: 'nendaz', name: 'Nendaz', canton: 'VS', lat: 46.19, lon: 7.29, snd: 'sub',
      fact: 'Home of a well-known international alphorn festival.',
      rec: 'Alphorn, pitched down', becomes: '808s and subs', dx: 14, dy: 16 },
    { id: 'rhine', name: 'Rhine Falls', canton: 'SH', lat: 47.68, lon: 8.62, snd: 'impact',
      fact: 'The largest plain waterfall in Europe by water flow.',
      rec: 'Falling water, spray, rumble', becomes: 'Noise layers and impacts', dx: 14, dy: -10 },
    { id: 'bern', name: 'Bern, Zytglogge', canton: 'BE', lat: 46.95, lon: 7.45, snd: 'bell',
      fact: 'Bern\'s medieval clock tower, with an astronomical clock and a bell struck every hour.',
      rec: 'The tower bell and clockwork', becomes: 'Bells and melodic one-shots', dx: -14, dy: -10, anchor: 'end' }
  ];

  /* Swiss border + lakes, [lon, lat], Natural Earth 1:10m (public domain), simplified */
  var BORDER = [[10.454,46.864],[10.445,46.823],[10.417,46.799],[10.429,46.756],[10.400,46.736],[10.394,46.701],[10.369,46.672],[10.396,46.639],[10.438,46.636],[10.459,46.624],[10.466,46.578],[10.444,46.538],[10.295,46.551],[10.276,46.566],[10.235,46.575],[10.234,46.618],[10.192,46.627],[10.088,46.604],[10.071,46.564],[10.033,46.533],[10.028,46.484],[10.044,46.467],[10.026,46.446],[10.042,46.433],[10.133,46.414],[10.141,46.403],[10.133,46.381],[10.105,46.361],[10.092,46.338],[10.105,46.309],[10.159,46.262],[10.146,46.243],[10.118,46.231],[10.043,46.220],[10.032,46.260],[9.978,46.298],[9.964,46.356],[9.918,46.371],[9.855,46.367],[9.768,46.339],[9.720,46.351],[9.709,46.342],[9.708,46.312],[9.674,46.292],[9.536,46.299],[9.503,46.321],[9.483,46.357],[9.444,46.375],[9.435,46.498],[9.385,46.466],[9.352,46.485],[9.351,46.498],[9.331,46.502],[9.282,46.497],[9.263,46.485],[9.238,46.437],[9.261,46.417],[9.260,46.380],[9.275,46.331],[9.225,46.231],[9.181,46.204],[9.163,46.172],[9.091,46.138],[9.072,46.119],[9.070,46.083],[9.059,46.062],[9.002,46.039],[8.998,46.028],[9.016,45.993],[8.981,45.964],[9.011,45.927],[9.052,45.916],[9.063,45.899],[9.034,45.848],[9.002,45.821],[8.940,45.835],[8.900,45.826],[8.912,45.883],[8.871,45.947],[8.800,45.979],[8.768,45.983],[8.834,46.066],[8.809,46.090],[8.747,46.094],[8.724,46.110],[8.677,46.096],[8.602,46.123],[8.510,46.208],[8.438,46.235],[8.423,46.276],[8.443,46.353],[8.446,46.412],[8.442,46.435],[8.428,46.449],[8.399,46.452],[8.316,46.434],[8.287,46.405],[8.297,46.388],[8.282,46.370],[8.242,46.354],[8.193,46.309],[8.107,46.286],[8.087,46.272],[8.073,46.254],[8.100,46.236],[8.130,46.196],[8.132,46.159],[8.111,46.127],[8.067,46.101],[8.025,46.091],[8.011,46.030],[7.986,45.999],[7.898,45.982],[7.873,45.959],[7.870,45.940],[7.850,45.940],[7.844,45.919],[7.831,45.914],[7.694,45.929],[7.643,45.966],[7.541,45.984],[7.504,45.957],[7.453,45.946],[7.362,45.908],[7.287,45.913],[7.154,45.877],[7.067,45.890],[7.015,45.933],[6.988,45.993],[6.915,46.049],[6.892,46.056],[6.869,46.044],[6.851,46.050],[6.849,46.085],[6.869,46.112],[6.854,46.123],[6.774,46.135],[6.766,46.152],[6.775,46.186],[6.828,46.269],[6.750,46.346],[6.789,46.395],[6.787,46.414],[6.763,46.429],[6.614,46.456],[6.547,46.457],[6.483,46.449],[6.398,46.408],[6.302,46.394],[6.269,46.375],[6.214,46.315],[6.238,46.268],[6.252,46.260],[6.276,46.263],[6.281,46.240],[6.191,46.192],[6.140,46.150],[6.108,46.139],[6.074,46.149],[6.028,46.148],[5.959,46.130],[5.983,46.171],[5.955,46.200],[5.959,46.212],[6.043,46.243],[6.090,46.246],[6.101,46.301],[6.136,46.359],[6.135,46.370],[6.108,46.396],[6.054,46.419],[6.068,46.434],[6.064,46.471],[6.146,46.552],[6.122,46.570],[6.118,46.583],[6.266,46.680],[6.338,46.707],[6.429,46.761],[6.433,46.786],[6.417,46.802],[6.447,46.858],[6.445,46.883],[6.428,46.909],[6.443,46.944],[6.599,46.987],[6.665,47.021],[6.688,47.044],[6.676,47.062],[6.690,47.078],[6.746,47.104],[6.745,47.121],[6.775,47.128],[6.888,47.211],[6.956,47.245],[6.959,47.291],[7.037,47.330],[7.044,47.340],[7.004,47.368],[6.867,47.354],[6.884,47.383],[6.925,47.406],[6.926,47.425],[6.969,47.435],[6.991,47.452],[6.973,47.489],[7.010,47.499],[7.054,47.490],[7.104,47.496],[7.181,47.488],[7.163,47.460],[7.168,47.444],[7.238,47.417],[7.309,47.433],[7.406,47.438],[7.429,47.465],[7.414,47.490],[7.467,47.482],[7.484,47.493],[7.477,47.515],[7.501,47.517],[7.505,47.533],[7.483,47.542],[7.550,47.575],[7.637,47.595],[7.660,47.597],[7.647,47.572],[7.610,47.565],[7.683,47.544],[7.767,47.556],[7.820,47.595],[7.898,47.588],[7.912,47.561],[8.042,47.561],[8.087,47.567],[8.179,47.616],[8.233,47.622],[8.289,47.616],[8.306,47.592],[8.354,47.581],[8.449,47.584],[8.462,47.606],[8.522,47.622],[8.561,47.589],[8.581,47.600],[8.580,47.639],[8.594,47.643],[8.602,47.633],[8.607,47.656],[8.568,47.663],[8.458,47.640],[8.391,47.665],[8.398,47.676],[8.392,47.700],[8.438,47.723],[8.464,47.764],[8.552,47.779],[8.542,47.795],[8.558,47.801],[8.602,47.795],[8.608,47.762],[8.617,47.757],[8.630,47.763],[8.644,47.791],[8.657,47.788],[8.682,47.759],[8.713,47.757],[8.720,47.747],[8.700,47.723],[8.717,47.695],[8.770,47.695],[8.762,47.701],[8.771,47.721],[8.798,47.720],[8.856,47.691],[8.838,47.688],[8.838,47.681],[8.882,47.656],[8.945,47.654],[9.017,47.679],[9.183,47.670],[9.197,47.656],[9.273,47.650],[9.547,47.535],[9.555,47.511],[9.585,47.481],[9.650,47.452],[9.650,47.410],[9.640,47.395],[9.601,47.361],[9.587,47.328],[9.505,47.244],[9.487,47.210],[9.485,47.176],[9.512,47.129],[9.512,47.108],[9.476,47.073],[9.477,47.064],[9.561,47.052],[9.669,47.056],[9.858,47.015],[9.856,47.004],[9.871,46.999],[9.862,46.940],[9.875,46.927],[10.007,46.891],[10.046,46.866],[10.111,46.847],[10.201,46.867],[10.235,46.923],[10.296,46.923],[10.296,46.941],[10.314,46.964],[10.339,46.984],[10.379,46.996],[10.458,46.937],[10.464,46.920],[10.451,46.886]];
  var LAKES = [[[6.871,46.459],[6.917,46.442],[6.935,46.423],[6.914,46.404],[6.868,46.402],[6.697,46.423],[6.499,46.409],[6.479,46.389],[6.408,46.365],[6.384,46.348],[6.355,46.372],[6.295,46.374],[6.237,46.312],[6.183,46.239],[6.133,46.205],[6.153,46.231],[6.160,46.269],[6.176,46.300],[6.318,46.451],[6.353,46.467],[6.419,46.473],[6.511,46.518],[6.620,46.519]],[[9.719,47.547],[9.732,47.538],[9.744,47.520],[9.690,47.520],[9.676,47.499],[9.649,47.499],[9.635,47.512],[9.608,47.499],[9.593,47.499],[9.553,47.512],[9.518,47.493],[9.495,47.488],[9.398,47.544],[9.371,47.581],[9.207,47.647],[9.183,47.671],[9.206,47.672],[9.206,47.682],[9.175,47.719],[9.162,47.747],[9.149,47.760],[9.073,47.787],[9.040,47.811],[9.032,47.821],[9.072,47.817],[9.176,47.766],[9.211,47.760],[9.227,47.725],[9.322,47.682],[9.403,47.675],[9.457,47.656],[9.488,47.654],[9.507,47.642],[9.522,47.613],[9.538,47.599],[9.594,47.588],[9.676,47.554]],[[9.066,47.723],[9.104,47.701],[9.127,47.671],[9.016,47.679],[8.981,47.662],[8.906,47.652],[8.881,47.656],[8.915,47.656],[8.986,47.687],[9.005,47.704],[8.943,47.734],[8.946,47.743],[8.956,47.747],[9.005,47.732],[9.005,47.739],[8.984,47.746],[8.984,47.752]],[[8.846,46.169],[8.849,46.165],[8.842,46.154],[8.746,46.093],[8.742,46.064],[8.753,46.017],[8.738,45.995],[8.649,45.945],[8.608,45.909],[8.604,45.883],[8.621,45.847],[8.621,45.827],[8.613,45.814],[8.575,45.794],[8.573,45.774],[8.621,45.725],[8.612,45.722],[8.579,45.742],[8.549,45.791],[8.567,45.818],[8.574,45.852],[8.566,45.870],[8.521,45.898],[8.493,45.938],[8.504,45.943],[8.560,45.932],[8.616,45.955],[8.714,46.039],[8.714,46.052],[8.700,46.081],[8.711,46.110],[8.733,46.131],[8.795,46.164]]];

  /* ---------- map ---------- */
  var svg = $('sm-map');
  var K = 250, COS = Math.cos(46.8 * Math.PI / 180), PAD = 24;
  var LON0 = 5.85, LAT0 = 47.9, W = Math.round((10.6 - LON0) * COS * K + PAD * 2), H = Math.round((LAT0 - 45.75) * K + PAD * 2);
  function px(lon) { return +((lon - LON0) * COS * K + PAD).toFixed(1); }
  function py(lat) { return +((LAT0 - lat) * K + PAD).toFixed(1); }
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function pts(list) { return list.map(function (p) { return px(p[0]) + ',' + py(p[1]); }).join(' '); }

  var pinEls = [], sel = -1;
  function selectPin(i, focus) {
    if (i < 0) i = PLACES.length - 1;
    if (i >= PLACES.length) i = 0;
    sel = i;
    var p = PLACES[i];
    pinEls.forEach(function (g, n) {
      var on = n === i;
      g.classList.toggle('on', on);
      g.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    $('sm-empty').hidden = true; $('sm-body').hidden = false;
    $('sm-canton').textContent = 'Canton ' + p.canton;
    $('sm-name').textContent = p.name;
    $('sm-coords').textContent = p.lat.toFixed(2) + '° N, ' + p.lon.toFixed(2) + '° E';
    $('sm-fact').textContent = p.fact;
    $('sm-rec').textContent = p.rec;
    $('sm-becomes').textContent = p.becomes;
    $('sm-count').textContent = (i + 1) + ' / ' + PLACES.length + ' · ' + p.name;
    if (focus) pinEls[i].focus();
  }

  if (svg) {
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    el('polygon', { 'class': 'sm-ch', points: pts(BORDER), 'fill-opacity': '.92' }, svg);
    LAKES.forEach(function (l) { el('polygon', { 'class': 'sm-lake', points: pts(l) }, svg); });
    el('polyline', { 'class': 'sm-route', points: PLACES.map(function (p) { return px(p.lon) + ',' + py(p.lat); }).join(' ') }, svg);
    PLACES.forEach(function (p, i) {
      var x = px(p.lon), y = py(p.lat);
      var g = el('g', { 'class': 'sm-pin', role: 'button', tabindex: '0', 'aria-pressed': 'false',
        'aria-label': p.name + ', canton ' + p.canton + '. ' + p.becomes, transform: 'translate(' + x + ' ' + y + ')' }, svg);
      el('circle', { 'class': 'hit', r: '30' }, g);
      el('circle', { 'class': 'ring', r: '8' }, g);
      el('circle', { 'class': 'dot', r: '6' }, g);
      var t = el('text', { 'class': 'lbl', x: p.dx, y: p.dy }, g);
      if (p.anchor) t.setAttribute('text-anchor', p.anchor);
      t.textContent = p.name;
      g.addEventListener('click', function () { selectPin(i, false); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); selectPin(i, false); }
      });
      pinEls.push(g);
    });
    // arrow keys cycle while the map has focus
    svg.addEventListener('keydown', function (e) {
      var d = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') d = 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') d = -1;
      if (!d) return;
      e.preventDefault();
      var cur = pinEls.indexOf(document.activeElement);
      if (cur < 0) cur = sel;
      selectPin(cur < 0 ? 0 : cur + d, true);
    });
  }
  $('sm-prev').addEventListener('click', function () { selectPin(sel < 0 ? PLACES.length - 1 : sel - 1, false); });
  $('sm-next').addEventListener('click', function () { selectPin(sel + 1, false); });

  /* ---------- audio sketches (Web Audio, synthesized) ---------- */
  var ac = null, master = null, noiseBuf = null;
  function ctx() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.3; master.connect(ac.destination);
    var len = ac.sampleRate * 2, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
    return ac;
  }
  function env(g, t, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
  }
  function noise(t, dur) {
    var s = ac.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random()); s.stop(t + dur);
    return s;
  }
  var S = {
    cowbell: function (t) {
      var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.4;
      var g = ac.createGain(); env(g, t, 0.9, 0.35);
      [540, 800].forEach(function (f) {
        var o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(bp); o.start(t); o.stop(t + 0.4);
      });
      bp.connect(g); g.connect(master);
    },
    snare: function (t) {
      var n = noise(t, 0.3), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 0.7;
      var g = ac.createGain(); env(g, t, 0.8, 0.22); n.connect(f); f.connect(g); g.connect(master);
      var o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
      var g2 = ac.createGain(); env(g2, t, 0.5, 0.14); o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.2);
    },
    hat: function (t, open) {
      var n = noise(t, 0.3), f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      var g = ac.createGain(); env(g, t, 0.45, open ? 0.2 : 0.05); n.connect(f); f.connect(g); g.connect(master);
    },
    sub: function (t, len) {
      var o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
      var g = ac.createGain(); env(g, t, 1, len || 1.1); o.connect(g); g.connect(master); o.start(t); o.stop(t + (len || 1.1) + 0.05);
    },
    impact: function (t) {
      var n = noise(t, 1.6), f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(70, t + 1.2);
      var g = ac.createGain(); env(g, t, 1, 1.4); n.connect(f); f.connect(g); g.connect(master);
      var o = ac.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.6);
      var g2 = ac.createGain(); env(g2, t, 0.8, 0.9); o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 1);
    },
    bell: function (t) {
      var base = 440, ratios = [1, 2.76, 5.4, 8.93], amps = [0.5, 0.3, 0.2, 0.1];
      ratios.forEach(function (r, i) {
        var o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = base * r;
        var g = ac.createGain(); env(g, t, amps[i], 1.8 / (1 + i * 0.5)); o.connect(g); g.connect(master); o.start(t); o.stop(t + 2);
      });
    },
    riser: function (t) {
      var n = noise(t, 1.5), f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + 1.3);
      var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.7, t + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.45);
      n.connect(f); f.connect(g); g.connect(master);
    }
  };
  function sketch(kind) {
    if (!ctx()) return;
    var t = ac.currentTime + 0.03;
    if (kind === 'hat') { for (var i = 0; i < 8; i++) S.hat(t + i * 0.075 + (i > 5 ? 0.0 : 0), i === 7); }
    else if (kind === 'snare') { S.snare(t); S.snare(t + 0.38); }
    else if (kind === 'cowbell') { S.cowbell(t); S.cowbell(t + 0.3); S.cowbell(t + 0.6); }
    else if (kind === 'sub') S.sub(t, 1.4);
    else S[kind](t);
  }
  $('sm-play').addEventListener('click', function () {
    if (sel < 0) return;
    stopBeat();
    sketch(PLACES[sel].snd);
  });

  /* ---------- Swiss beat: 1 bar, 16 steps @ 140 bpm ---------- */
  var beatBtn = $('sm-beat'), beatTimer = null, step = 0, nextT = 0;
  function bar(s, t) {
    if (s === 0 || s === 7 || s === 10) S.sub(t, 0.45);
    if (s === 8) { S.snare(t); }
    if (s === 4 || s === 12) S.cowbell(t);
    if (s === 0) S.bell(t);
    if (s === 14) S.hat(t, true); else if (s % 2 === 0 || s === 11 || s === 15) S.hat(t, false);
    if (s === 15) S.hat(t + 0.5 * (60 / 140 / 4), false);
  }
  function tick() {
    var spb = 60 / 140 / 4;
    while (nextT < ac.currentTime + 0.2) { bar(step, nextT); nextT += spb; step = (step + 1) % 16; }
  }
  function stopBeat() {
    if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
    beatBtn.setAttribute('aria-pressed', 'false');
    $('sm-beat-t').textContent = 'Play Swiss beat';
    $('sm-beat-ic').innerHTML = '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>';
  }
  beatBtn.addEventListener('click', function () {
    if (beatTimer) { stopBeat(); return; }
    if (!ctx()) return;
    step = 0; nextT = ac.currentTime + 0.05;
    beatTimer = setInterval(tick, 50); tick();
    beatBtn.setAttribute('aria-pressed', 'true');
    $('sm-beat-t').textContent = 'Stop';
    $('sm-beat-ic').innerHTML = '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>';
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopBeat(); });

  /* ---------- waitlist (sound-drop subscribe only) ---------- */
  (function () {
    var form = $('sm-form'); if (!form) return;
    var cfg = window.APP_CONFIG || {};
    var email = $('sm-email'), consent = $('sm-consent'), btn = $('sm-btn'), status = $('sm-status');
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    function fail(msg) { status.textContent = msg; status.classList.add('danger'); }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      cfg = window.APP_CONFIG || cfg;
      status.classList.remove('danger'); status.textContent = '';
      var addr = email.value.trim();
      if (!EMAIL_RE.test(addr)) { fail('Please enter a valid email address.'); email.focus(); return; }
      if (!consent.checked) { fail('Please tick the box to join the waitlist.'); return; }
      if (!cfg.SUPABASE_URL) { fail('Service is not available right now. Please try again.'); return; }
      var label = btn.textContent; btn.disabled = true; btn.textContent = 'Sending …';
      var h = { 'Content-Type': 'application/json', apikey: cfg.SUPABASE_PUBLISHABLE_KEY };
      if (String(cfg.SUPABASE_PUBLISHABLE_KEY).split('.').length === 3) h.Authorization = 'Bearer ' + cfg.SUPABASE_PUBLISHABLE_KEY;
      fetch(cfg.SUPABASE_URL + '/functions/v1/sound-drop', { method: 'POST', headers: h, body: JSON.stringify({ email: addr, marketing_consent: true, action: 'subscribe' }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok && j && j.ok, j: j || {} }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.j.error || 'Something went wrong.');
          try { if (window.ylyTrack) window.ylyTrack('swissmade-waitlist'); } catch (x) {}
          status.textContent = 'You are on the list. We will email you when SWISS MADE is ready.';
          email.value = ''; consent.checked = false;
        })
        .catch(function (err) {
          var m = String(err && err.message || 'Something went wrong.');
          fail(/try again|try another/i.test(m) ? m : m.replace(/[.!?\s]*$/, '') + '. Please try again.');
        })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  })();
})();

/* =====================================================================
   EAR TRAINER "Hear it?"
   - Musical loop (perclab samples + synth pad/bass/hats, full synth fallback)
   - A/B engine: zwei parallele Signalketten, 15 ms Crossfade, Loop laeuft durch
   - 7 Fragetypen x 3 Schwierigkeiten, Daily (seed = UTC-Datum) + Practice
   - Rangliste ueber Supabase (Tabelle ear_scores)
   ===================================================================== */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const cfg = window.APP_CONFIG || {};
  const RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => (window.YLY && window.YLY.esc) ? window.YLY.esc(s) : String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toast = (m, bad) => { if (window.YLY && window.YLY.toast) window.YLY.toast(m, bad); };
  const buzz = p => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch (_) {} };
  const dbToGain = d => Math.pow(10, d / 20);

  /* ---------- localStorage (immer mit try/catch) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };

  /* ---------- Seeded RNG ---------- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = typeof seed === "string" ? hashStr(seed) : seed >>> 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* ---------- Datum (UTC) ---------- */
  const pad2 = n => String(n).padStart(2, "0");
  const utcDay = (d = new Date()) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  const dailyNo = (day = utcDay()) => Math.floor((Date.parse(day + "T00:00:00Z") - Date.parse("2026-11-01T00:00:00Z")) / 864e5) + 1;
  const msToMidnight = () => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime(); };

  /* =====================================================================
     FRAGETYPEN
     ===================================================================== */
  const DIFFS = ["Easy", "Pro", "Golden Ears"];
  const DIFF_HINT = [
    "Big differences, few choices. A good start.",
    "Smaller differences and more choices.",
    "Subtle changes and neighbouring choices. For trained ears."
  ];
  const TYPES = {
    boost:  { name: "Boost",       prompt: "Which frequency got boosted?",  kind: "strip" },
    cut:    { name: "Cut",         prompt: "Which frequency got cut?",      kind: "strip" },
    comp:   { name: "Compression", prompt: "Which one is compressed?",      kind: "ab" },
    level:  { name: "Level",       prompt: "Which one is louder?",          kind: "ab" },
    pan:    { name: "Panning",     prompt: "Where is the clap?",            kind: "strip" },
    reverb: { name: "Reverb",      prompt: "How much space does B have?",   kind: "buttons" },
    sat:    { name: "Saturation",  prompt: "Which one is saturated?",       kind: "ab" }
  };
  const TYPE_KEYS = Object.keys(TYPES);

  const FREQS = [60, 125, 250, 500, 1000, 2000, 4000, 8000, 12000];
  const fmtF = f => f >= 1000 ? (f / 1000) + "k" : String(f);
  const fmtFull = f => f >= 1000 ? (f / 1000) + " kHz" : f + " Hz";
  const fx = f => (Math.log2(f) - Math.log2(60)) / (Math.log2(12000) - Math.log2(60));   // 0..1 auf der Dial-Schiene
  const FREQ_TIPS = {
    60:    ["40-80 Hz = sub weight.", "Too much and the mix turns boomy.", "Cut here and the low end feels thin."],
    125:   ["100-200 Hz = punch and body.", "Kick punch and bass warmth live here.", "Cut here and the kick loses its thump."],
    250:   ["200-400 Hz = the mud zone.", "A boost makes things cloudy and boxy.", "Cutting here is the classic way to clean a muddy mix."],
    500:   ["400-800 Hz = boxy midrange.", "A boost sounds honky and cardboard-like.", "Cut here and things open up but get hollow."],
    1000:  ["1 kHz = nasal midrange.", "A boost sounds like a telephone.", "Cut here and the mix loses its bite."],
    2000:  ["2-4 kHz = presence. Vocals and claps live here.", "A boost brings elements forward.", "Cut here and things sink back and lose clarity."],
    4000:  ["4 kHz = attack and clarity.", "A boost gives claps and snares snap, and also harshness.", "Cut here and transients get soft."],
    8000:  ["6-10 kHz = sizzle and sibilance.", "A boost makes hats crisp and ess sounds sharp.", "Cut here and the top end gets dull and smooth."],
    12000: ["12 kHz and up = air and shine.", "A boost opens the top end without much harshness.", "Cut here and the mix sounds closed in."]
  };
  const TIPS = {
    comp: "Compression squashes the loud peaks. Drums lose snap and the loop gets denser and flatter. Listen to the kick and clap transients.",
    level: "Louder almost always sounds better. Always level-match before you judge any change.",
    pan: "Panned sounds leave the centre. Keep kick, bass and lead vocal centred and spread the rest.",
    reverb: "Reverb adds depth. Dry sounds close and upfront, a hall pushes things back and blurs the transients.",
    sat: "Saturation adds harmonics. Listen for extra grit in the highs and a thicker, warmer kick."
  };

  const REV = {   // Optionen je Schwierigkeit: decay in Sekunden, wet-Anteil
    0: [{ id: "dry", label: "Dry", decay: 0, wet: 0 }, { id: "room", label: "Room", decay: 0.6, wet: 0.5 }, { id: "hall", label: "Hall", decay: 2.4, wet: 0.8 }],
    1: [{ id: "dry", label: "Dry", decay: 0, wet: 0 }, { id: "room", label: "Room", decay: 0.7, wet: 0.3 }, { id: "hall", label: "Hall", decay: 2.2, wet: 0.5 }],
    2: [{ id: "dry", label: "Dry", decay: 0, wet: 0 }, { id: "small", label: "Small", decay: 0.4, wet: 0.2 }, { id: "room", label: "Room", decay: 0.9, wet: 0.28 }, { id: "hall", label: "Hall", decay: 2.0, wet: 0.32 }]
  };

  /* Eine Frage aus Seed + Typ + Schwierigkeit erzeugen (deterministisch) */
  function makeQuestion(seed, type, diff) {
    const r = rng(seed);
    const pick = a => a[Math.floor(r() * a.length)];
    // Loop-Parameter (unabhaengig vom Typ)
    const loop = {
      bpm: 80 + Math.floor(r() * 19),
      key: Math.floor(r() * 12),
      prog: Math.floor(r() * 4),
      kick: Math.floor(r() * 4),
      bass: Math.floor(r() * 3),
      hat: Math.floor(r() * 3),
      kickIdx: Math.floor(r() * 1e6), clapIdx: Math.floor(r() * 1e6), percIdx: [Math.floor(r() * 1e6), Math.floor(r() * 1e6)],
      seed: Math.floor(r() * 1e9)
    };
    const q = { seed, type, diff, loop, procSide: "B", match: true, aSub: "Original", bSub: "Altered", options: [], answer: null, kind: TYPES[type].kind, prompt: TYPES[type].prompt };
    if (type === "boost" || type === "cut") {
      let opts;
      if (diff === 0) opts = pick([[60, 250, 1000, 4000], [125, 500, 2000, 8000], [60, 250, 1000, 4000], [125, 500, 2000, 8000]]);
      else if (diff === 1) { const s = Math.floor(r() * 4); opts = FREQS.slice(s, s + 6); }
      else { const s = Math.floor(r() * 2); opts = FREQS.slice(s, s + 8); }
      q.freq = pick(opts); q.answer = q.freq;
      q.gain = [9, 6, 4][diff] * (type === "cut" ? -1 : 1); q.Q = 1.4;
      q.options = opts.map(f => ({ id: f, label: fmtF(f), x: fx(f) }));
      q.sub = type === "boost" ? "A is the original. B has one boosted band." : "A is the original. B has one band cut.";
    } else if (type === "comp") {
      q.procSide = r() < 0.5 ? "A" : "B"; q.answer = q.procSide;
      q.comp = [{ th: -34, ratio: 12, knee: 6 }, { th: -29, ratio: 6, knee: 10 }, { th: -25, ratio: 3, knee: 12 }][diff];
      q.aSub = "Option A"; q.bSub = "Option B"; q.sub = "One of them is compressed. Listen to the drum transients.";
      q.options = [{ id: "A", label: "A" }, { id: "B", label: "B" }];
    } else if (type === "level") {
      q.match = false; q.procSide = r() < 0.5 ? "A" : "B"; q.answer = q.procSide; q.dB = [3, 1.5, 0.75][diff];
      q.aSub = "Option A"; q.bSub = "Option B"; q.sub = "Everything else is identical. Only the level differs.";
      q.options = [{ id: "A", label: "A" }, { id: "B", label: "B" }];
    } else if (type === "pan") {
      const P = diff === 0 ? [-1, 0, 1] : diff === 1 ? [-1, -0.5, 0, 0.5, 1] : [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
      q.pos = pick(P); q.answer = String(q.pos);
      const lab = p => diff === 0 ? (p < 0 ? "Left" : p > 0 ? "Right" : "Center") : (p === 0 ? "C" : (p < 0 ? "L" : "R") + Math.round(Math.abs(p) * 100));
      q.options = P.map(p => ({ id: String(p), label: lab(p), x: (p + 1) / 2 }));
      q.sub = "A has the clap in the centre. In B the clap sits somewhere else (or stays put).";
    } else if (type === "reverb") {
      q.options = REV[diff].map(o => ({ id: o.id, label: o.label, o }));
      q.rev = pick(REV[diff]); q.answer = q.rev.id;
      q.sub = "A is dry. B has some amount of space.";
    } else if (type === "sat") {
      q.procSide = r() < 0.5 ? "A" : "B"; q.answer = q.procSide; q.drive = [6, 3.5, 2.2][diff];
      q.aSub = "Option A"; q.bSub = "Option B"; q.sub = "One of them is saturated. Both are level-matched.";
      q.options = [{ id: "A", label: "A" }, { id: "B", label: "B" }];
    }
    const o = q.options.find(o => String(o.id) === String(q.answer));
    q.answerLabel = type === "boost" || type === "cut" ? fmtFull(q.freq) : type === "pan" ? (q.pos === 0 ? "the centre" : (q.pos < 0 ? "left " : "right ") + Math.round(Math.abs(q.pos) * 100) + "%") : type === "reverb" ? q.rev.label.toLowerCase() : "option " + q.answer;
    if (!o) q.answerLabel = String(q.answer);
    return q;
  }

  function tipFor(q) {
    if (q.type === "boost") return FREQ_TIPS[q.freq][0] + " " + FREQ_TIPS[q.freq][1];
    if (q.type === "cut") return FREQ_TIPS[q.freq][0] + " " + FREQ_TIPS[q.freq][2];
    return TIPS[q.type];
  }

  /* Daily: 5 Fragen, gemischte Typen, steigende Schwierigkeit */
  function dailyQuestions(day) {
    const r = rng("yly-ear-" + day);
    const types = TYPE_KEYS.slice();
    for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
    return [0, 0, 1, 1, 2].map((d, i) => makeQuestion(`yly-ear-${day}-q${i}`, types[i], d));
  }

  /* =====================================================================
     AUDIO ENGINE
     ===================================================================== */
  const AUDIO_RE = /\.(wav|mp3|ogg|aif|aiff|flac)$/i;
  const BUCKET = `${cfg.SUPABASE_URL}/storage/v1/object/public/coverart-products/`;
  let ctx = null, master, limiter, analyser, noiseBuf;
  let playing = false, side = "A", session = null, sessionId = 0;
  let pools = null;                                       // { kick:[], clap:[], perc:[] } URLs
  const bufCache = new Map(), badUrls = new Set(), peakCache = new WeakMap(), irCache = new Map();

  function ensureAudio() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("no webaudio");
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain(); master.gain.value = 0;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.1;
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.78;
    master.connect(limiter); limiter.connect(ctx.destination); limiter.connect(analyser);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }

  /* Sample-Liste aus dem Storage (einmal) */
  async function loadPools() {
    if (pools) return pools;
    pools = { kick: [], clap: [], perc: [] };
    try {
      const db = window.YLY && window.YLY.db;
      if (!db) return pools;
      const list = async path => {
        try {
          const { data, error } = await db.storage.from("coverart-products").list(path, { limit: 1000, sortBy: { column: "name", order: "asc" } });
          if (error) throw error;
          return (data || []).map(x => x.name).filter(n => n && AUDIO_RE.test(n) && !/808/i.test(n)).map(n => { const u = BUCKET + path + "/" + encodeURIComponent(n); return window.YLYMedia ? window.YLYMedia.url(u) : u; });
        } catch (_) { return []; }
      };
      const [k, c, p] = await Promise.all([list("perclab/kick"), list("perclab/clap"), list("perclab")]);
      pools = { kick: k, clap: c, perc: p };
    } catch (_) {}
    return pools;
  }

  async function getBuffer(url) {
    if (!url || badUrls.has(url)) return null;
    if (bufCache.has(url)) return bufCache.get(url);
    const p = (async () => {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
      try {
        const res = await fetch(url, { signal: ctl.signal });
        if (!res.ok) throw new Error("http " + res.status);
        const ab = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        if (buf.duration > 4) throw new Error("too long");
        return buf;
      } catch (_) { badUrls.add(url); return null; } finally { clearTimeout(to); }
    })();
    bufCache.set(url, p);
    return p;
  }
  const poolPick = (arr, idx) => arr.length ? arr[idx % arr.length] : null;
  const peakOf = buf => { let p = peakCache.get(buf); if (p) return p; p = 0; const d = buf.getChannelData(0); for (let i = 0; i < d.length; i += 3) { const a = Math.abs(d[i]); if (a > p) p = a; } p = p || 1; peakCache.set(buf, p); return p; };

  /* Impulsantwort fuer Hall / Raum (Rauschen mit exponentiellem Abklingen) */
  function makeIR(sec) {
    const key = sec.toFixed(2);
    if (irCache.has(key)) return irCache.get(key);
    const sr = ctx.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.012);
    const b = ctx.createBuffer(2, len + pre, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0, e = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len, n = Math.random() * 2 - 1;
        lp += (n - lp) * (0.85 - 0.7 * t);               // Hoehen klingen schneller ab
        const v = lp * Math.exp(-6.9 * t);
        d[pre + i] = v; e += v * v;
      }
      const s = 1 / Math.sqrt(e || 1);
      for (let i = 0; i < d.length; i++) d[i] *= s;      // Energie normieren
    }
    irCache.set(key, b);
    return b;
  }

  /* ---------- Stimmen ---------- */
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function playBuf(S, buf, t, vol, bus, maxDur) {
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = vol * (0.9 / peakOf(buf));
    src.connect(g); g.connect(bus);
    src.start(t);
    if (maxDur) { g.gain.setValueAtTime(g.gain.value, t + maxDur - 0.05); g.gain.linearRampToValueAtTime(0, t + maxDur); src.stop(t + maxDur + 0.02); }
    S.nodes.push(src, g);
  }
  function noiseHit(S, t, type, freq, q, vol, dur, bus) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * 1.5, dur + 0.05);
    S.nodes.push(src, f, g);
  }
  function kickVoice(S, t, v) {
    if (S.bufs.kick) return playBuf(S, S.bufs.kick, t, 0.95 * v, S.bus.rest, 0.9);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
    g.gain.setValueAtTime(0.95 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); g.connect(S.bus.rest); o.start(t); o.stop(t + 0.45); S.nodes.push(o, g);
  }
  function clapVoice(S, t, v) {
    if (S.bufs.clap) return playBuf(S, S.bufs.clap, t, 0.75 * v, S.bus.clap, 1.2);
    [0, 0.011, 0.022].forEach(o => noiseHit(S, t + o, "bandpass", 1500, 0.9, 0.45 * v, 0.02, S.bus.clap));
    noiseHit(S, t + 0.03, "bandpass", 1400, 0.8, 0.5 * v, 0.16, S.bus.clap);
  }
  function hatVoice(S, t, v, open) {
    noiseHit(S, t, "highpass", 7000, 0.7, 0.2 * v, open ? 0.22 : 0.045, S.bus.rest);
  }
  function percVoice(S, t, v, i) {
    const b = S.bufs.perc[i % Math.max(1, S.bufs.perc.length)];
    if (b) return playBuf(S, b, t, 0.5 * v, S.bus.rest, 0.8);
    const o = ctx.createOscillator(), g = ctx.createGain();      // Synth-Ersatz: kurzer Holzblock
    o.type = "triangle"; o.frequency.setValueAtTime(i ? 520 : 780, t); o.frequency.exponentialRampToValueAtTime(i ? 380 : 560, t + 0.05);
    g.gain.setValueAtTime(0.35 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(S.bus.rest); o.start(t); o.stop(t + 0.15); S.nodes.push(o, g);
  }
  function bassVoice(S, t, midi, dur) {
    const f = mtof(midi);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain();
    o1.type = "sine"; o1.frequency.value = f;
    o2.type = "sawtooth"; o2.frequency.value = f; g2.gain.value = 0.22;
    lp.type = "lowpass"; lp.frequency.value = 340; lp.Q.value = 0.7;
    env(g, t, 0.008, 0.62, Math.max(0.05, dur - 0.05), 0.06);
    o1.connect(g); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(S.bus.rest);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
    S.nodes.push(o1, o2, lp, g, g2);
  }
  function padChord(S, t, notes, dur) {
    const lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = "lowpass"; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2800, t + dur * 0.8);
    env(g, t, 0.18, 0.5, dur - 0.1, 0.45);
    lp.connect(g); g.connect(S.bus.rest);
    S.nodes.push(lp, g);
    notes.forEach(m => [-7, 7].forEach(det => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sawtooth"; o.frequency.value = mtof(m); o.detune.value = det;
      og.gain.value = 0.045;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.8);
      S.nodes.push(o, og);
    }));
  }

  /* ---------- Pattern ---------- */
  const KICKS = [[0, 10, 16, 23, 26], [0, 7, 10, 16, 20, 26], [0, 6, 10, 16, 22, 26, 30], [0, 10, 14, 16, 24, 26]];
  const BASS = [[[0, 6], [8, 4], [12, 3]], [[0, 4], [6, 2], [10, 6]], [[0, 8], [10, 3], [14, 2]]];
  const CH = { m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dom: [0, 4, 7, 10] };
  const PROGS = [
    [[0, "m7"], [8, "maj7"]], [[0, "m7"], [5, "m7"]], [[0, "m7"], [10, "dom"]], [[8, "maj7"], [7, "dom"]]
  ];

  function scheduleLoop(S, t0) {
    const L = S.q.loop, sd = S.sd, r = rng(L.seed);   // gleiche Variation in jeder Runde: nahtloser Loop
    const pick = a => a[Math.floor(r() * a.length)];
    // Kick + Clap
    KICKS[L.kick].forEach(s => kickVoice(S, t0 + s * sd, s % 16 === 0 ? 1 : 0.85));
    [4, 12, 20, 28].forEach(s => clapVoice(S, t0 + s * sd, 1));
    // Hats
    for (let s = 0; s < 32; s += 2) {
      const open = (s % 16) === 14 && L.hat !== 1;
      hatVoice(S, t0 + s * sd, s % 4 === 0 ? 1 : 0.65, open);
      if (L.hat === 2 && r() < 0.4) hatVoice(S, t0 + (s + 1) * sd, 0.45, false);
    }
    if (L.hat === 1) for (let s = 1; s < 32; s += 4) if (r() < 0.5) hatVoice(S, t0 + s * sd, 0.5, false);
    // Percussion (wenige Schlaege, versetzt)
    const slots = [3, 7, 9, 11, 15, 19, 23, 25, 27, 31];
    for (let i = 0; i < 5; i++) { const s = pick(slots); percVoice(S, t0 + s * sd, 0.55 + r() * 0.45, i % 2); }
    // Akkorde + Bass: je ein Akkord pro Takt
    const prog = PROGS[L.prog];
    for (let bar = 0; bar < 2; bar++) {
      const [off, type] = prog[bar];
      const pc = (L.key + off) % 12, tb = t0 + bar * 16 * sd;
      const base = 48 + pc;
      padChord(S, tb, CH[type].map(i => base + i), 16 * sd);
      const bm = 28 + ((pc - 4 + 12) % 12);
      BASS[L.bass].forEach(([s, len]) => bassVoice(S, tb + s * sd, bm, len * sd));
    }
  }

  /* ---------- Signalketten ---------- */
  function rms(an, buf) {
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return s / buf.length;
  }
  function makeChain(S, which) {
    const q = S.q, proc = (q.type !== "level") ? (which === q.procSide) : false;
    const mix = ctx.createGain();
    const panN = ctx.createStereoPanner(); panN.pan.value = (q.type === "pan" && proc) ? q.pos : 0;
    S.bus.clap.connect(panN); panN.connect(mix); S.bus.rest.connect(mix);
    const nodes = [mix, panN];
    let node = mix;
    if (proc) {
      if (q.type === "boost" || q.type === "cut") {
        const f = ctx.createBiquadFilter(); f.type = "peaking"; f.frequency.value = q.freq; f.gain.value = q.gain; f.Q.value = q.Q;
        node.connect(f); node = f; nodes.push(f);
      } else if (q.type === "comp") {
        const c = ctx.createDynamicsCompressor(); const p = q.comp;
        c.threshold.value = p.th; c.ratio.value = p.ratio; c.knee.value = p.knee; c.attack.value = 0.004; c.release.value = 0.14;
        node.connect(c); node = c; nodes.push(c);
      } else if (q.type === "sat") {
        const pre = ctx.createGain(), sh = ctx.createWaveShaper(), post = ctx.createGain();
        const n = 2048, curve = new Float32Array(n), k = q.drive, nrm = Math.tanh(k);
        for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(k * x) / nrm; }
        sh.curve = curve; sh.oversample = "4x"; pre.gain.value = 2.2; post.gain.value = 0.45;
        node.connect(pre); pre.connect(sh); sh.connect(post); node = post; nodes.push(pre, sh, post);
      } else if (q.type === "reverb" && q.rev.wet > 0) {
        const conv = ctx.createConvolver(); conv.buffer = makeIR(q.rev.decay);
        const wet = ctx.createGain(), sum = ctx.createGain(), dry = ctx.createGain();
        wet.gain.value = q.rev.wet; dry.gain.value = 1 - q.rev.wet * 0.25;
        node.connect(dry); dry.connect(sum); node.connect(conv); conv.connect(wet); wet.connect(sum);
        node = sum; nodes.push(conv, wet, sum, dry);
      }
    }
    // Messpunkt fuer Level-Matching, dann Trim, Ausgang, Crossfader
    const an = ctx.createAnalyser(); an.fftSize = 2048; node.connect(an);
    const trim = ctx.createGain(), out = ctx.createGain(), xf = ctx.createGain();
    out.gain.value = 0.8;
    if (q.type === "level") out.gain.value = 0.8 * dbToGain(which === q.procSide ? q.dB / 2 : -q.dB / 2);
    node.connect(trim); trim.connect(out); out.connect(xf); xf.connect(master);
    xf.gain.value = which === side ? 1 : 0;
    nodes.push(an, trim, out, xf);
    S.nodes.push(...nodes);
    return { which, proc, an, trim, xf, buf: new Float32Array(2048), pw: 0 };
  }

  /* Level-Matching: bearbeitete Kette wird auf Pegel der Referenz getrimmt */
  function matchTick(S) {
    if (!S.alive || !S.q.match) return;
    const ref = S.chains[S.q.procSide === "A" ? "B" : "A"], pr = S.chains[S.q.procSide];
    const a = S.mt < 30 ? 0.3 : 0.05; S.mt++;
    const pa = rms(ref.an, ref.buf), pb = rms(pr.an, pr.buf);
    if (pa < 1e-9 || pb < 1e-9) return;
    ref.pw = ref.pw ? ref.pw * (1 - a) + pa * a : pa;
    pr.pw = pr.pw ? pr.pw * (1 - a) + pb * a : pb;
    pr.trim.gain.setTargetAtTime(clamp(Math.sqrt(ref.pw / pr.pw), 0.2, 5), ctx.currentTime, 0.12);
  }

  function setSide(s) {
    side = s;
    if (session) {
      const now = ctx.currentTime;
      ["A", "B"].forEach(k => {
        const g = session.chains[k].xf.gain;
        g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(k === s ? 1 : 0, now + 0.015);        // ~15 ms Crossfade
      });
    }
    ui.side(s);
  }
  function setPlaying(p) {
    playing = p;
    if (ctx) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(p ? 0.9 : 0, now + 0.03);
    }
    ui.playing(p);
  }

  function stopSession() {
    const S = session; session = null;
    if (!S) return;
    S.alive = false; clearInterval(S.timer); clearInterval(S.mtimer);
    const now = ctx.currentTime;
    S.bus.rest.gain.setTargetAtTime(0, now, 0.01); S.bus.clap.gain.setTargetAtTime(0, now, 0.01);
    setTimeout(() => { S.nodes.forEach(n => { try { n.disconnect(); } catch (_) {} }); S.nodes.length = 0; }, 400);
  }

  async function startSession(q) {
    ensureAudio();
    const myId = ++sessionId;
    stopSession();
    const P = await loadPools();
    const [kick, clap, p1, p2] = await Promise.all([
      getBuffer(poolPick(P.kick, q.loop.kickIdx)), getBuffer(poolPick(P.clap, q.loop.clapIdx)),
      getBuffer(poolPick(P.perc, q.loop.percIdx[0])), getBuffer(poolPick(P.perc, q.loop.percIdx[1]))
    ]);
    if (myId !== sessionId) return null;                  // zwischenzeitlich neue Frage
    const S = { q, id: myId, alive: true, nodes: [], bufs: { kick, clap, perc: [p1, p2].filter(Boolean) }, iter: 0, mt: 0 };
    S.sd = 60 / q.loop.bpm / 4; S.loopDur = S.sd * 32;
    S.bus = { clap: ctx.createGain(), rest: ctx.createGain() };
    S.bus.clap.gain.value = 0.35; S.bus.rest.gain.value = 0.35;     // Headroom
    S.nodes.push(S.bus.clap, S.bus.rest);
    S.chains = { A: makeChain(S, "A"), B: makeChain(S, "B") };
    session = S;
    S.nextT = ctx.currentTime + 0.1;
    const pump = () => { if (!S.alive) return; while (S.nextT < ctx.currentTime + 0.7) { scheduleLoop(S, S.nextT); S.nextT += S.loopDur; S.iter++; } };
    pump(); S.timer = setInterval(pump, 50);
    S.mtimer = setInterval(() => matchTick(S), 80);
    setSide("A");
    return S;
  }

  /* ---------- Soundeffekte (nicht durch die A/B-Ketten) ---------- */
  function sfxDing() {
    if (!ctx || !playing) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o2.type = "triangle"; o.frequency.value = f; o2.frequency.value = f * 2;
      const s = t + i * 0.06;
      g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.11, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.7);
      o.connect(g); o2.connect(g); g.connect(ctx.destination);
      o.start(s); o2.start(s); o.stop(s + 0.75); o2.stop(s + 0.75);
    });
  }
  function sfxBlip() {
    if (!ctx || !playing) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = "sine"; o.frequency.setValueAtTime(230, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.25);
    lp.type = "lowpass"; lp.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(lp); lp.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.32);
  }

  /* =====================================================================
     VISUALIZER
     ===================================================================== */
  const viz = $("et-viz"), vctx = viz.getContext("2d");
  let vSmooth = new Float32Array(64), vRun = false, vSide = 0;
  function vResize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = viz.clientWidth, h = viz.clientHeight;
    if (!w || !h) return;
    if (viz.width !== Math.round(w * dpr) || viz.height !== Math.round(h * dpr)) { viz.width = Math.round(w * dpr); viz.height = Math.round(h * dpr); }
  }
  function vDraw(ts) {
    if (!vRun) return;
    vResize();
    const W = viz.width, H = viz.height, c = vctx, dpr = W / (viz.clientWidth || W);
    c.clearRect(0, 0, W, H);
    const N = 64, bins = new Uint8Array(analyser ? analyser.frequencyBinCount : 1024);
    if (analyser) analyser.getByteFrequencyData(bins);
    vSide += ((side === "B" ? 1 : 0) - vSide) * 0.18;
    const g = c.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, `rgba(${Math.round(120 + 40 * vSide)},70,${Math.round(235 - 10 * vSide)},.95)`);
    g.addColorStop(0.55, "rgba(182,138,255,.95)");
    g.addColorStop(1, `rgba(${Math.round(229 + 10 * vSide)},${Math.round(190 - 25 * vSide)},255,1)`);
    const sr = ctx ? ctx.sampleRate : 48000, nb = bins.length;
    const gap = 3 * dpr, bw = (W - gap * (N - 1)) / N;
    c.shadowColor = "rgba(182,138,255,.75)"; c.shadowBlur = 14 * dpr; c.fillStyle = g;
    for (let i = 0; i < N; i++) {
      const f0 = 30 * Math.pow(16000 / 30, i / N), f1 = 30 * Math.pow(16000 / 30, (i + 1) / N);
      const b0 = Math.floor(f0 / (sr / 2) * nb), b1 = Math.max(b0 + 1, Math.ceil(f1 / (sr / 2) * nb));
      let m = 0; for (let b = b0; b < b1 && b < nb; b++) if (bins[b] > m) m = bins[b];
      let v = m / 255; v = Math.pow(v, 1.6) * (0.7 + 1.0 * i / N);            // hoehere Baender etwas anheben
      if (!playing || !analyser) v = 0.04 + 0.03 * (RM ? 0 : Math.sin(ts / 700 + i * 0.4));
      vSmooth[i] += (v - vSmooth[i]) * (v > vSmooth[i] ? 0.5 : 0.14);
      const h = Math.max(3 * dpr, vSmooth[i] * H * 0.92), x = i * (bw + gap);
      const r = Math.min(bw / 2, 4 * dpr);
      c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - h + r); c.quadraticCurveTo(x, H - h, x + r, H - h); c.lineTo(x + bw - r, H - h);
      c.quadraticCurveTo(x + bw, H - h, x + bw, H - h + r); c.lineTo(x + bw, H); c.closePath(); c.fill();
    }
    c.shadowBlur = 0;
    requestAnimationFrame(vDraw);
  }
  function vStart() { if (vRun) return; vRun = true; requestAnimationFrame(vDraw); }
  function vStop() { vRun = false; }

  /* =====================================================================
     SPIELZUSTAND
     ===================================================================== */
  const G = { mode: null, qs: [], i: 0, q: null, score: 0, streak: 0, maxStreak: 0, lives: 3, correct: 0, answered: false, loading: false, t0: 0, results: [], cfg: null, n: 0, over: false, ptsLast: 0 };
  const DAILY_KEY = "yly_ear_daily", BEST_KEY = "yly_ear_best", PRAC_KEY = "yly_ear_prac";
  const scoreFor = (t, streakBefore) => Math.round((500 + 200 * Math.max(0, 1 - t / 20)) * (1 + 0.1 * Math.min(streakBefore, 4)));

  /* ---------- Screens ---------- */
  const screens = ["start", "setup", "game", "result"];
  function show(name) {
    screens.forEach(n => {
      const el = $("et-" + n); const on = n === name;
      el.classList.toggle("hidden", !on);
      if (on) { el.classList.remove("et-in"); void el.offsetWidth; el.classList.add("et-in"); }
    });
    if (name === "game") vStart(); else { vStop(); endAudio(); }
    window.scrollTo({ top: 0, behavior: "instant" });
    if (name === "start") refreshStart();
  }
  function endAudio() { if (ctx) { stopSession(); setPlaying(false); } }

  /* ---------- UI-Helfer fuer die Engine ---------- */
  const ui = {
    side(s) {
      const ab = $("et-ab"); ab.dataset.side = s;
      ab.querySelectorAll("button").forEach(b => { const on = b.dataset.side === s; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
      if (!RM) { ab.classList.remove("morph"); void ab.offsetWidth; ab.classList.add("morph"); }
    },
    playing(p) { $("et-play").classList.toggle("is-playing", p); $("et-play").setAttribute("aria-label", p ? "Pause" : "Play"); }
  };

  /* ---------- HUD ---------- */
  function rollTo(el, to, ms = 700) {
    const from = +el.dataset.v || 0; el.dataset.v = to;
    if (RM || from === to) { el.textContent = to; return; }
    const t0 = performance.now();
    const step = t => { const k = clamp((t - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const HEART = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.7 3.5 4.5 6.8 4.5c2 0 3.6 1 5.2 3 1.6-2 3.2-3 5.2-3 3.3 0 5.2 3.2 4 6.6-1.7 4.8-9.2 9.4-9.2 9.4Z"/></svg>';
  function hud() {
    const prog = $("et-prog");
    if (G.mode === "daily") {
      prog.className = "et-prog dots"; prog.setAttribute("aria-label", `Question ${Math.min(G.i + 1, 5)} of 5`);
      prog.innerHTML = G.qs.map((_, i) => { const r = G.results[i]; return `<i class="${r ? (r.ok ? "ok" : "bad") : (i === G.i ? "cur" : "")}"></i>`; }).join("");
    } else {
      prog.className = "et-prog hearts"; prog.setAttribute("aria-label", `${G.lives} lives left`);
      prog.innerHTML = [0, 1, 2].map(i => `<span class="${i < G.lives ? "full" : "lost"}">${HEART}</span>`).join("");
    }
    rollTo($("et-score"), G.score);
    $("et-streak-n").textContent = G.streak;
    const fl = $("et-flame"), k = Math.min(G.streak, 8);
    fl.style.transform = `scale(${1 + k * 0.09})`; fl.parentNode.classList.toggle("hot", G.streak >= 3); fl.parentNode.classList.toggle("on", G.streak >= 1);
  }

  /* =====================================================================
     FRAGE ANZEIGEN
     ===================================================================== */
  let hotIdx = -1;
  function renderQuestion(q) {
    const qbox = $("et-q");
    $("et-qtype").textContent = TYPES[q.type].name;
    $("et-qtext").textContent = q.prompt;
    $("et-diff-badge").textContent = DIFFS[q.diff];
    $("et-diff-badge").dataset.d = q.diff;
    $("et-a-sub").textContent = q.aSub; $("et-b-sub").textContent = q.bSub;
    const ans = $("et-answers"); ans.className = "et-answers";
    $("et-fb").classList.add("hidden");
    qbox.classList.remove("et-shake");
    if (q.kind === "strip") {
      ans.classList.add("is-strip");
      const rail = q.type === "pan" ? "pan" : "freq";
      let h = `<p class="et-sub">${esc(q.sub)}</p><div class="et-strip ${rail}" id="et-strip" role="group" aria-label="Answers"><div class="et-read" id="et-read">Tap or drag to answer</div><div class="et-rail"><div class="et-rail-in">`;
      if (rail === "freq") FREQS.forEach(f => { h += `<span class="et-tick" style="left:calc(${(fx(f) * 100).toFixed(2)}%)"></span>`; });
      else h += `<span class="et-tick mid" style="left:50%"></span>`;
      q.options.forEach((o, i) => { h += `<button type="button" class="et-node" data-id="${esc(o.id)}" data-i="${i}" style="left:${(o.x * 100).toFixed(2)}%" aria-label="${esc(rail === "freq" ? fmtFull(o.id) : o.label)}"><i></i><span>${esc(o.label)}</span></button>`; });
      h += `</div></div>${rail === "freq" ? '<div class="et-hz"><span>60 Hz</span><span>12 kHz</span></div>' : '<div class="et-hz"><span>Left</span><span>Right</span></div>'}</div>`;
      ans.innerHTML = h;
      bindStrip(q);
    } else {
      ans.classList.add(q.kind === "ab" ? "is-ab" : "is-btn");
      ans.classList.toggle("n4", q.options.length === 4);
      ans.innerHTML = `<p class="et-sub">${esc(q.sub)}</p><div class="et-opts">` + q.options.map((o, i) => `<button type="button" class="et-opt" data-id="${esc(o.id)}"><b>${esc(o.label)}</b><kbd>${i + 1}</kbd></button>`).join("") + "</div>";
      ans.querySelectorAll(".et-opt").forEach(b => b.addEventListener("click", () => answer(b.dataset.id, b)));
    }
    lockAnswers(G.loading);
  }
  function lockAnswers(on) { $("et-answers").classList.toggle("locked", !!on); $("et-answers").querySelectorAll("button").forEach(b => { b.disabled = !!on; }); }

  function bindStrip(q) {
    const strip = $("et-strip"), rail = strip.querySelector(".et-rail"), nodes = [...strip.querySelectorAll(".et-node")], read = $("et-read");
    let drag = false, idx = -1;
    const at = e => {
      const rc = rail.getBoundingClientRect(), u = clamp((e.clientX - rc.left - 16) / Math.max(1, rc.width - 32), 0, 1);
      let best = 0, bd = 9; q.options.forEach((o, i) => { const d = Math.abs(o.x - u); if (d < bd) { bd = d; best = i; } });
      return best;
    };
    const hi = i => {
      if (i === idx) return; idx = i;
      nodes.forEach((n, k) => n.classList.toggle("hot", k === i));
      const o = q.options[i]; read.textContent = q.type === "pan" ? (q.options[i].label) : fmtFull(+o.id); read.classList.add("live");
      buzz(4);
    };
    strip.addEventListener("pointerdown", e => { if (G.answered || G.loading || e.button > 0) return; drag = true; try { strip.setPointerCapture(e.pointerId); } catch (_) {} hi(at(e)); });
    strip.addEventListener("pointermove", e => { if (drag) hi(at(e)); });
    strip.addEventListener("pointerup", e => { if (!drag) return; drag = false; const i = at(e); hi(i); answer(q.options[i].id, nodes[i]); });
    strip.addEventListener("pointercancel", () => { drag = false; nodes.forEach(n => n.classList.remove("hot")); idx = -1; read.classList.remove("live"); read.textContent = "Tap or drag to answer"; });
    nodes.forEach(n => n.addEventListener("click", e => { if (e.detail === 0) answer(n.dataset.id, n); }));   // Tastatur
  }

  /* =====================================================================
     SPIELABLAUF
     ===================================================================== */
  async function loadQuestion(q) {
    G.q = q; G.answered = false; G.loading = true;
    $("et-game").classList.add("is-loading");
    renderQuestion(q); hud();
    let ok = true;
    try { ensureAudio(); await startSession(q); }
    catch (e) { ok = false; toast("Audio is not available in this browser.", true); }
    if (G.q !== q) return;
    G.loading = false; $("et-game").classList.remove("is-loading");
    if (ok) setPlaying(true);
    lockAnswers(false); G.t0 = performance.now();
  }

  function startDaily() {
    const day = utcDay();
    Object.assign(G, { mode: "daily", qs: dailyQuestions(day), i: 0, score: 0, streak: 0, maxStreak: 0, correct: 0, results: [], over: false, day });
    store.set(DAILY_KEY, { day, done: false, score: 0, correct: 0, results: [], saved: false });
    show("game"); $("et-score").dataset.v = 0;
    loadQuestion(G.qs[0]);
  }
  function startPractice(c) {
    window.ylyTrack && ylyTrack("eartrainer-practice-start");
    Object.assign(G, { mode: "practice", qs: [], i: 0, score: 0, streak: 0, maxStreak: 0, lives: 3, correct: 0, results: [], cfg: c, over: false, n: 0 });
    show("game"); $("et-score").dataset.v = 0;
    nextPractice();
  }
  function nextPractice() {
    const types = G.cfg.types.length ? G.cfg.types : TYPE_KEYS;
    const r = rng("p-" + Date.now() + "-" + G.n + "-" + Math.random());
    const t = types[Math.floor(r() * types.length)];
    G.n++;
    loadQuestion(makeQuestion("p-" + Date.now() + "-" + G.n + "-" + Math.floor(Math.random() * 1e9), t, G.cfg.diff));
  }

  function answer(id, el) {
    if (G.answered || G.loading || !G.q) return;
    G.answered = true;
    const q = G.q, ok = String(id) === String(q.answer);
    const secs = (performance.now() - G.t0) / 1000;
    const pts = ok ? scoreFor(secs, G.streak) : 0;
    if (ok) { G.streak++; G.correct++; G.score += pts; G.maxStreak = Math.max(G.maxStreak, G.streak); }
    else { G.streak = 0; if (G.mode === "practice") G.lives--; }
    G.results.push({ type: q.type, diff: q.diff, ok, pts, secs: Math.round(secs * 10) / 10 });
    G.ptsLast = pts;
    if (G.mode === "daily") store.set(DAILY_KEY, { day: G.day, done: false, score: G.score, correct: G.correct, results: G.results, saved: false });
    if (G.mode === "practice" && G.maxStreak > store.get(BEST_KEY, 0)) store.set(BEST_KEY, G.maxStreak);

    // Antworten einfärben
    const ans = $("et-answers");
    ans.classList.add("done");
    ans.querySelectorAll("button").forEach(b => { b.disabled = true; if (String(b.dataset.id) === String(q.answer)) b.classList.add("right"); else if (b === el) b.classList.add("wrong"); });
    const strip = $("et-strip"); if (strip) { strip.querySelectorAll(".hot").forEach(n => n.classList.remove("hot")); $("et-read").textContent = ok ? fmtReadout(q) : "It was " + fmtReadout(q); }

    // Feedback-Panel
    const fb = $("et-fb");
    $("et-verdict").textContent = ok ? pickOf(["Nice ear.", "Spot on.", "You heard it.", "Golden."]) : "Not quite. It was " + q.answerLabel + ".";
    $("et-verdict").className = "et-verdict " + (ok ? "ok" : "bad");
    $("et-pts").textContent = ok ? "+" + pts : "";
    $("et-tip").textContent = tipFor(q);
    $("et-reveal").innerHTML = revealHTML(q, id);
    const last = (G.mode === "daily" && G.i >= G.qs.length - 1) || (G.mode === "practice" && G.lives <= 0);
    $("et-next").textContent = last ? "See results" : "Next";
    fb.classList.remove("hidden"); fb.classList.remove("et-in"); void fb.offsetWidth; fb.classList.add("et-in");
    requestAnimationFrame(() => requestAnimationFrame(() => $("et-reveal").classList.add("go")));
    $("et-reveal").classList.remove("go");
    hud();
    setTimeout(() => fb.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "nearest" }), 60);

    // Feedback-Effekte
    if (ok) { sfxDing(); buzz(18); burstAt(el || $("et-q")); }
    else { sfxBlip(); buzz([30, 40, 30]); if (!RM) { const qb = $("et-q"); qb.classList.remove("et-shake"); void qb.offsetWidth; qb.classList.add("et-shake"); } }
  }
  const pickOf = a => a[Math.floor(Math.random() * a.length)];
  const fmtReadout = q => q.type === "boost" || q.type === "cut" ? fmtFull(q.freq) : q.answerLabel;

  function next() {
    if (!G.answered) return;
    if (G.mode === "daily") {
      if (G.i >= G.qs.length - 1) return finishDaily();
      G.i++; swap(() => loadQuestion(G.qs[G.i]));
    } else {
      if (G.lives <= 0) return finishPractice();
      swap(nextPractice);
    }
  }
  function swap(fn) {
    const g = $("et-game");
    if (RM) return fn();
    g.classList.add("et-out");
    setTimeout(() => { g.classList.remove("et-out"); fn(); g.classList.remove("et-in"); void g.offsetWidth; g.classList.add("et-in"); }, 170);
  }

  /* ---------- Ende ---------- */
  function finishDaily() {
    const rec = { day: G.day, done: true, score: G.score, correct: G.correct, results: G.results, saved: false };
    const old = store.get(DAILY_KEY, null); if (old && old.saved) rec.saved = true;
    store.set(DAILY_KEY, rec);
    window.ylyTrack && ylyTrack("eartrainer-daily-finished", { score: G.score });
    showResult(rec, "daily");
    submitScore(rec);
  }
  function finishPractice() {
    const best = store.get(BEST_KEY, 0);
    showResult({ day: utcDay(), score: G.score, correct: G.correct, results: G.results, streak: G.maxStreak, best }, "practice");
  }

  let resCtx = null;
  function showResult(rec, mode) {
    resCtx = { rec, mode };
    show("result");
    const daily = mode === "daily";
    $("et-res-eyebrow").textContent = daily ? `DAILY #${dailyNo(rec.day)} RESULT` : "PRACTICE OVER";
    rollTo($("et-res-score"), 0, 1); $("et-res-score").dataset.v = 0;
    setTimeout(() => rollTo($("et-res-score"), rec.score, 1400), 120);
    $("et-res-sub").textContent = daily
      ? `${rec.correct} of 5 correct`
      : `${rec.correct} correct. Best streak this run: ${rec.streak}. All-time best: ${Math.max(rec.best || 0, rec.streak || 0)}.`;
    $("et-recap").innerHTML = rec.results.map((r, i) => `<li class="${r.ok ? "ok" : "bad"}" style="--d:${i * 70}ms"><span class="et-ri">${r.ok
      ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
      : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'}</span><span class="et-rn">${esc(TYPES[r.type].name)}</span><span class="et-rd">${esc(DIFFS[r.diff])}</span><span class="et-rp">${r.ok ? "+" + r.pts : "0"}</span></li>`).join("");
    $("et-lb").hidden = !daily;
    $("et-res-again").classList.toggle("hidden", daily);
    if (daily) { renderBoard($("et-board-res")); }
    if (!daily && rec.correct >= 1 && !RM) setTimeout(() => burstAt($("et-res-score")), 400);
    if (daily && rec.correct >= 3 && !RM) setTimeout(() => burstAt($("et-res-score")), 500);
  }

  /* ---------- Teilen & Karte ---------- */
  function shareText() {
    const { rec, mode } = resCtx;
    return mode === "daily"
      ? `Hear it? Daily #${dailyNo(rec.day)} – ${rec.correct}/5 – ${rec.score} pts yardslovesyou.com/eartrainer.html`
      : `Hear it? Practice – best streak ${rec.streak} – ${rec.score} pts yardslovesyou.com/eartrainer.html`;
  }
  async function doShare() {
    const text = shareText();
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); toast("Result copied. Paste it anywhere."); }
    catch (_) { try { window.prompt("Copy your result:", text); } catch (__) {} }
  }
  async function doCard() {
    const { rec, mode } = resCtx;
    try { await Promise.all([document.fonts.load('700 120px "Space Grotesk"'), document.fonts.load('500 40px "DM Sans"')]); } catch (_) {}
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#2a1450"); bg.addColorStop(0.55, "#17102a"); bg.addColorStop(1, "#0d0b12");
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const gl = c.createRadialGradient(W / 2, 640, 40, W / 2, 640, 620); gl.addColorStop(0, "rgba(182,138,255,.55)"); gl.addColorStop(1, "rgba(182,138,255,0)");
    c.fillStyle = gl; c.fillRect(0, 0, W, H);
    // Equalizer-Balken als Deko
    const r = rng("card" + rec.score + rec.day);
    for (let i = 0; i < 40; i++) { const h = 30 + r() * 90, x = 60 + i * 24; const g = c.createLinearGradient(0, H - 50, 0, H - 50 - h); g.addColorStop(0, "rgba(182,138,255,.15)"); g.addColorStop(1, "rgba(229,165,255,.55)"); c.fillStyle = g; c.beginPath(); c.roundRect ? c.roundRect(x, H - 50 - h, 14, h, 7) : c.rect(x, H - 50 - h, 14, h); c.fill(); }
    const F = "'Space Grotesk','DM Sans',Helvetica,Arial,sans-serif";
    c.textAlign = "center"; c.fillStyle = "#f5f0fb";
    c.font = `700 150px ${F}`; c.fillText("Hear it?", W / 2, 250);
    c.fillStyle = "#b68aff"; c.font = `600 38px ${F}`;
    c.fillText(mode === "daily" ? `DAILY CHALLENGE #${dailyNo(rec.day)}` : "PRACTICE RUN", W / 2, 330);
    c.fillStyle = "#aaa0b7"; c.font = `500 34px ${F}`; c.fillText(rec.day, W / 2, 382);
    c.shadowColor = "rgba(182,138,255,.8)"; c.shadowBlur = 50; c.fillStyle = "#ffffff"; c.font = `700 300px ${F}`;
    c.fillText(String(rec.score), W / 2, 690); c.shadowBlur = 0;
    c.fillStyle = "#e5a5ff"; c.font = `600 48px ${F}`; c.fillText("POINTS", W / 2, 760);
    c.fillStyle = "#f5f0fb"; c.font = `600 64px ${F}`;
    c.fillText(mode === "daily" ? `${rec.correct} of 5 correct` : `Best streak ${rec.streak}`, W / 2, 880);
    const n = mode === "daily" ? 5 : Math.min(rec.results.length, 10), gap = 90, x0 = W / 2 - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      const res = rec.results[i], ok = res && res.ok;
      c.beginPath(); c.arc(x0 + i * gap, 960, 26, 0, Math.PI * 2);
      if (ok) { c.fillStyle = "#b68aff"; c.fill(); } else { c.strokeStyle = res ? "#7a6a90" : "#3a2f4a"; c.lineWidth = 5; c.stroke(); }
    }
    c.fillStyle = "#f5f0fb"; c.font = `700 46px ${F}`; c.fillText("YARDS", W / 2 - 115, 1110);
    c.fillStyle = "#b68aff"; c.fillText("LOVESYOU", W / 2 + 95, 1110);
    c.fillStyle = "#aaa0b7"; c.font = `500 34px ${F}`; c.fillText("yardslovesyou.com/eartrainer.html", W / 2, 1165);
    cv.toBlob(b => {
      if (!b) return toast("Could not create the image.", true);
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `hear-it-${rec.day}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, "image/png");
  }

  /* =====================================================================
     REVEAL (Wahrheit visuell zeigen)
     ===================================================================== */
  function respPath(q) {
    // Frequenzgang des Peaking-Filters ueber die echte Biquad-Funktion
    const f = ctx.createBiquadFilter(); f.type = "peaking"; f.frequency.value = q.freq; f.gain.value = q.gain; f.Q.value = q.Q;
    const n = 96, fr = new Float32Array(n), mag = new Float32Array(n), ph = new Float32Array(n);
    for (let i = 0; i < n; i++) fr[i] = 20 * Math.pow(1000, i / (n - 1));
    f.getFrequencyResponse(fr, mag, ph);
    let d = ""; const pts = [];
    for (let i = 0; i < n; i++) {
      const x = (Math.log10(fr[i] / 20) / 3) * 300 + 10, db = 20 * Math.log10(mag[i]), y = 60 - clamp(db, -12, 12) * 4.2;
      pts.push([x, y]); d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return { d, area: d + `L310 60L10 60Z`, pts };
  }
  function revealHTML(q, picked) {
    const ok = String(picked) === String(q.answer);
    if (q.type === "boost" || q.type === "cut") {
      let r; try { r = respPath(q); } catch (_) { return ""; }
      const xOf = f => (Math.log10(f / 20) / 3) * 300 + 10;
      let grid = ""; q.options.forEach(o => { grid += `<line x1="${xOf(o.id).toFixed(1)}" x2="${xOf(o.id).toFixed(1)}" y1="14" y2="106" class="g"/><text x="${xOf(o.id).toFixed(1)}" y="118" class="t">${fmtF(o.id)}</text>`; });
      const gx = xOf(q.freq).toFixed(1), py = (60 - q.gain * 4.2).toFixed(1);
      const you = !ok ? `<line x1="${xOf(picked).toFixed(1)}" x2="${xOf(picked).toFixed(1)}" y1="14" y2="106" class="you"/><text x="${xOf(picked).toFixed(1)}" y="11" class="t y">You</text>` : "";
      return `<svg class="et-eq" viewBox="0 0 320 124" role="img" aria-label="EQ curve: ${q.gain > 0 ? "boost" : "cut"} of ${Math.abs(q.gain)} dB at ${fmtFull(q.freq)}"><defs><linearGradient id="etg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b68aff" stop-opacity=".55"/><stop offset="1" stop-color="#b68aff" stop-opacity="0"/></linearGradient></defs>${grid}<line x1="10" x2="310" y1="60" y2="60" class="zero"/>${you}<path d="${r.area}" fill="url(#etg)" class="area"/><path d="${r.d}" class="curve" pathLength="1"/><circle cx="${gx}" cy="${py}" r="5" class="dot"/><text x="${gx}" y="${(+py + (q.gain > 0 ? -10 : 18)).toFixed(1)}" class="t big">${q.gain > 0 ? "+" : ""}${q.gain} dB</text></svg>`;
    }
    if (q.type === "pan") {
      const pos = q.pos, p = picked != null ? +picked : 0;
      return `<div class="et-pan" style="--p:${pos};--u:${p}"><div class="et-pan-track"><span class="l">L</span><span class="c"></span><span class="r">R</span><i class="et-pan-you ${ok ? "hidden" : ""}"></i><i class="et-pan-dot"></i></div><p>The clap in B sat ${pos === 0 ? "in the centre" : (pos < 0 ? "left" : "right") + " at " + Math.round(Math.abs(pos) * 100) + "%"}.</p></div>`;
    }
    if (q.type === "level") {
      const hi = q.procSide, lo = hi === "A" ? "B" : "A", h2 = 60 + q.dB * 8;
      return `<div class="et-bars"><div class="${hi}"><i style="--h:${h2.toFixed(0)}%"></i><span>${hi}</span><em>+${q.dB} dB</em></div><div class="${lo}"><i style="--h:60%"></i><span>${lo}</span><em>ref</em></div></div>`;
    }
    if (q.type === "comp") {
      const base = [1, .42, .62, .35, .95, .4, .55, .3, .88, .38, .6, .34, .98, .4, .5, .32];
      const sq = base.map(v => 0.55 + (v - 0.55) * (q.diff === 0 ? 0.22 : q.diff === 1 ? 0.4 : 0.62));
      const col = (arr, nm, tag) => `<div class="et-env"><div class="e">${arr.map((v, i) => `<i style="--h:${(v * 100).toFixed(0)}%;--i:${i}"></i>`).join("")}</div><span>${nm}${tag ? ` <em>${tag}</em>` : ""}</span></div>`;
      const A = q.procSide === "A" ? sq : base, B = q.procSide === "B" ? sq : base;
      return `<div class="et-envs">${col(A, "A", q.procSide === "A" ? "compressed" : "")}${col(B, "B", q.procSide === "B" ? "compressed" : "")}</div>`;
    }
    if (q.type === "reverb") {
      const o = q.rev, tau = o.decay;
      let d = "M10 100L310 100";
      if (tau) { d = ""; for (let i = 0; i <= 60; i++) { const t = i / 60, y = 100 - 80 * Math.exp(-6.9 * (t * 2.5) / tau); d += (i ? "L" : "M") + (10 + t * 300).toFixed(1) + " " + y.toFixed(1); } }
      const lab = tau ? `${o.label}, about ${tau.toFixed(1)} s tail` : "Dry, no tail";
      return `<svg class="et-eq" viewBox="0 0 320 124" role="img" aria-label="${esc(lab)}"><line x1="10" x2="310" y1="100" y2="100" class="zero"/><path d="${d}" class="curve" pathLength="1"/><text x="160" y="118" class="t big">${esc(lab)}</text></svg>`;
    }
    if (q.type === "sat") {
      let d = ""; const k = q.drive;
      for (let i = 0; i <= 60; i++) { const x = i / 60 * 2 - 1, y = Math.tanh(k * x * 0.7) / Math.tanh(k * 0.7); d += (i ? "L" : "M") + (10 + (x + 1) * 100).toFixed(1) + " " + (62 - y * 48).toFixed(1); }
      return `<div class="et-sat"><svg class="et-eq" viewBox="0 0 220 124" role="img" aria-label="Transfer curve of the saturated signal"><line x1="10" x2="210" y1="62" y2="62" class="zero"/><line x1="110" x2="110" y1="12" y2="112" class="zero"/><path d="M10 110L210 14" class="lin"/><path d="${d}" class="curve" pathLength="1"/></svg><p>${q.procSide} was saturated: the wave gets rounded off, which adds harmonics.</p></div>`;
    }
    return "";
  }

  /* =====================================================================
     PARTIKEL (leichtgewichtig, eigener Burst)
     ===================================================================== */
  function burstAt(el) {
    if (RM || !el || !el.getBoundingClientRect) return;
    const rc = el.getBoundingClientRect(), cx = rc.left + rc.width / 2, cy = rc.top + rc.height / 2;
    const layer = document.createElement("div"); layer.className = "et-fx"; document.body.appendChild(layer);
    const cols = ["#b68aff", "#c9a4ff", "#e5a5ff", "#9d6bff", "#f5f0fb"];
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("i"), s = 5 + Math.random() * 7, a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 120;
      p.style.cssText = `left:${cx}px;top:${cy}px;width:${s}px;height:${s}px;background:${cols[i % cols.length]};box-shadow:0 0 10px ${cols[i % cols.length]}`;
      layer.appendChild(p);
      p.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d + 30}px)) scale(.2)`, opacity: 0 }], { duration: 650 + Math.random() * 450, easing: "cubic-bezier(.12,.7,.3,1)", fill: "forwards" });
    }
    setTimeout(() => layer.remove(), 1200);
  }

  /* =====================================================================
     RANGLISTE
     ===================================================================== */
  const hasLb = () => !!(window.YLY && window.YLY.db);
  async function fetchBoard() {
    const db = window.YLY.db;
    const { data, error } = await db.from("ear_scores").select("score,correct,user_id").eq("day", utcDay()).order("score", { ascending: false }).order("created_at", { ascending: true }).limit(10);
    if (error) throw error;
    const rows = data || [];
    let names = {};
    if (rows.length) {                                              // zweite Abfrage: Handles (kein FK noetig)
      const { data: ps } = await db.from("profiles").select("id,handle").in("id", rows.map(r => r.user_id));
      (ps || []).forEach(p => { names[p.id] = p.handle; });
    }
    return rows.map(r => ({ ...r, handle: names[r.user_id] || null }));
  }
  async function renderBoard(el) {
    if (!el) return;
    const ST = o => { if (window.YLYState) window.YLYState.render(el, Object.assign({ compact: true }, o)); else el.innerHTML = '<p class="et-empty">' + esc(o.title) + "</p>"; };
    if (!hasLb()) { ST({ icon: "trophy", error: true, title: "Leaderboard unavailable", text: "We couldn't reach the leaderboard. Your daily challenge still works.", actions: [{ label: "Retry", onClick: () => renderBoard(el) }] }); return; }
    el.innerHTML = '<p class="et-empty">Loading ...</p>';
    try {
      const rows = await fetchBoard();
      const m = await window.YLY.me().catch(() => null), mine = m && m.user && m.user.id;
      if (!rows.length) { ST({ icon: "trophy", title: "Be the first today", text: "No scores yet. Play the Daily Challenge and take the top spot.", actions: [{ label: "Play the Daily Challenge", onClick: () => { const g = $("et-daily-go"); if (g) { g.scrollIntoView && g.scrollIntoView({ block: "center" }); g.click(); } } }] }); return; }
      el.innerHTML = "<ol>" + rows.map((r, i) => {
        const who = r.handle ? `<a href="profile.html?u=${encodeURIComponent(r.handle)}">@${esc(r.handle)}</a>` : "<span>anonymous</span>";
        return `<li class="${r.user_id === mine ? "me" : ""}"><span class="rk">${i + 1}</span><span class="who">${who}</span><span class="cr">${+r.correct}/5</span><span class="sc">${+r.score}</span></li>`;
      }).join("") + "</ol>";
    } catch (e) {
      ST({ icon: "trophy", error: true, title: "Leaderboard couldn't load", text: "Something went wrong. Please try again, or play the Daily Challenge meanwhile.", actions: [{ label: "Retry", onClick: () => renderBoard(el) }] });
    }
  }

  let submitting = false;
  async function submitScore(rec) {
    const st = $("et-lb-status"), cta = $("et-lb-cta");
    if (st) st.textContent = ""; if (cta) cta.innerHTML = "";
    if (!hasLb() || !rec || !rec.done) return;
    if (rec.saved) { if (st) st.textContent = "Your score for today is already saved."; return; }
    if (submitting) return; submitting = true;
    try {
      const m = await window.YLY.me();
      if (!m) { if (cta) cta.innerHTML = `<a class="button" href="${esc(window.YLY.loginUrl())}">Sign in to join today's leaderboard</a>`; return; }
      if (!m.profile) { if (cta) cta.innerHTML = '<a class="button" href="account.html">Finish your profile to join the leaderboard</a>'; return; }
      const { error } = await window.YLY.db.from("ear_scores").insert({ day: rec.day, score: rec.score, correct: rec.correct });
      if (error && error.code !== "23505") throw error;
      rec.saved = true; store.set(DAILY_KEY, rec);
      if (st) st.textContent = error ? "Your score for today is already saved." : "Score saved. You're on today's leaderboard.";
      renderBoard($("et-board-res")); renderBoard($("et-board-start"));
    } catch (e) {
      if (st) st.textContent = "Could not save your score right now.";
    } finally { submitting = false; }
  }

  /* =====================================================================
     STARTSEITE
     ===================================================================== */
  function dailyRec() {
    const r = store.get(DAILY_KEY, null);
    if (!r || r.day !== utcDay()) return null;
    if (!r.done) {                                         // abgebrochen: gilt als Versuch (Rest = falsch)
      r.done = true; r.results = r.results || [];
      const qs = dailyQuestions(r.day);
      while (r.results.length < 5) { const q = qs[r.results.length]; r.results.push({ type: q.type, diff: q.diff, ok: false, pts: 0, secs: 0 }); }
      store.set(DAILY_KEY, r);
    }
    return r;
  }
  let cdTimer = null;
  function refreshStart() {
    const rec = dailyRec(), day = utcDay();
    $("et-daily-no").textContent = `DAILY #${dailyNo(day)}`;
    $("et-board-date").textContent = day;
    const done = !!rec;
    $("et-daily-card").classList.toggle("is-done", done);
    $("et-count").classList.toggle("hidden", !done);
    $("et-daily-text").textContent = done ? `You played today: ${rec.correct} of 5 correct, ${rec.score} pts.` : "5 questions, the same for everyone today. One attempt. Time bonus and streak multiplier.";
    $("et-daily-go").textContent = done ? "View today's result" : "Play today's challenge";
    const b = store.get(BEST_KEY, 0);
    $("et-best-line").textContent = b ? `Best streak: ${b}` : "";
    clearInterval(cdTimer);
    const tick = () => {
      const ms = msToMidnight(); if (ms <= 0 || ms > 864e5) { refreshStart(); return; }
      const s = Math.floor(ms / 1000); $("et-count-t").textContent = `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s % 3600 / 60))}:${pad2(s % 60)}`;
    };
    tick(); cdTimer = setInterval(tick, 1000);
    renderBoard($("et-board-start"));
  }

  /* ---------- Practice-Setup ---------- */
  function initSetup() {
    const saved = store.get(PRAC_KEY, null);
    const pc = { types: (saved && Array.isArray(saved.types) ? saved.types.filter(t => TYPES[t]) : TYPE_KEYS.slice()), diff: saved && saved.diff >= 0 && saved.diff <= 2 ? saved.diff : 0 };
    if (!pc.types.length) pc.types = TYPE_KEYS.slice();
    const tp = $("et-types");
    tp.innerHTML = TYPE_KEYS.map(k => `<button type="button" class="et-chip" data-t="${k}" aria-pressed="${pc.types.includes(k)}">${TYPES[k].name}</button>`).join("");
    tp.addEventListener("click", e => {
      const b = e.target.closest(".et-chip"); if (!b) return;
      const k = b.dataset.t, on = pc.types.includes(k);
      if (on && pc.types.length === 1) { toast("Keep at least one type selected."); return; }
      pc.types = on ? pc.types.filter(x => x !== k) : [...pc.types, k];
      b.setAttribute("aria-pressed", !on); store.set(PRAC_KEY, pc);
    });
    const dg = $("et-diff");
    const paint = () => { dg.querySelectorAll("button").forEach((b, i) => { b.setAttribute("aria-checked", i === pc.diff); b.classList.toggle("on", i === pc.diff); }); $("et-diff-hint").textContent = DIFF_HINT[pc.diff]; };
    dg.innerHTML = DIFFS.map((d, i) => `<button type="button" role="radio" data-d="${i}">${d}</button>`).join("");
    dg.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; pc.diff = +b.dataset.d; store.set(PRAC_KEY, pc); paint(); });
    paint();
    $("et-prac-start").addEventListener("click", () => { try { ensureAudio(); } catch (_) {} startPractice({ types: pc.types.slice(), diff: pc.diff }); });
  }

  /* =====================================================================
     EVENTS
     ===================================================================== */
  function bind() {
    $("et-daily-go").addEventListener("click", () => {
      const rec = dailyRec();
      if (rec) { showResult(rec, "daily"); submitScore(rec); return; }
      try { ensureAudio(); } catch (_) {}
      startDaily();
    });
    $("et-prac-go").addEventListener("click", () => show("setup"));
    document.querySelectorAll("[data-nav]").forEach(b => b.addEventListener("click", () => show(b.dataset.nav)));
    $("et-exit").addEventListener("click", () => {
      if (G.mode === "daily") {
        if (!confirm("Quit the daily challenge? Today's attempt ends with your current score.")) return;
        const rs = G.results.slice();
        while (rs.length < 5) { const q = G.qs[rs.length]; rs.push({ type: q.type, diff: q.diff, ok: false, pts: 0, secs: 0 }); }
        const rec = { day: G.day, done: true, score: G.score, correct: G.correct, results: rs, saved: false };
        store.set(DAILY_KEY, rec);
        if (!G.results.length) return show("start");
        showResult(rec, "daily"); submitScore(rec); return;
      }
      if (G.mode === "practice" && G.results.length) return finishPractice();
      show("start");
    });
    $("et-next").addEventListener("click", next);
    $("et-play").addEventListener("click", () => { try { ensureAudio(); } catch (_) { return; } setPlaying(!playing); });
    $("et-ab").addEventListener("click", e => { const b = e.target.closest("button[data-side]"); if (b) setSide(b.dataset.side); });
    $("et-share").addEventListener("click", doShare);
    $("et-card").addEventListener("click", doCard);
    $("et-res-again").addEventListener("click", () => { if (G.mode === "practice") startPractice(G.cfg); });

    document.addEventListener("keydown", e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ($("et-game").classList.contains("hidden")) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      const k = e.key.toLowerCase();
      if (k === " " || e.code === "Space") { e.preventDefault(); if (!e.repeat) { try { ensureAudio(); } catch (_) { return; } setPlaying(!playing); } }
      else if (k === "a") setSide("A");
      else if (k === "b") setSide("B");
      else if (/^[1-9]$/.test(k)) { if (G.q && !G.answered && !G.loading) { const o = G.q.options[+k - 1]; if (o) answer(o.id, $("et-answers").querySelector(`[data-id="${CSS.escape(String(o.id))}"]`)); } }
      else if (k === "enter" || k === "n") { if (G.answered && tag !== "a" && !(tag === "button" && e.target.id !== "et-next" && k === "enter")) { e.preventDefault(); next(); } }
    });
    document.addEventListener("keyup", e => { if ((e.code === "Space") && !$("et-game").classList.contains("hidden")) e.preventDefault(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && playing) setPlaying(false); });
    window.addEventListener("pagehide", () => { try { if (ctx) ctx.close(); } catch (_) {} });
  }

  /* ---------- Start ---------- */
  initSetup(); bind(); refreshStart();
  loadPools();                                              // Sample-Liste schon mal holen (kein Audio noetig)
  // Nach Login zurueck: ungespeichertes Ergebnis von heute nachtragen
  (async () => { try { const rec = dailyRec(); if (rec && !rec.saved && hasLb()) { const m = await window.YLY.me(); if (m && m.profile) { const { error } = await window.YLY.db.from("ear_scores").insert({ day: rec.day, score: rec.score, correct: rec.correct }); if (!error || error.code === "23505") { rec.saved = true; store.set(DAILY_KEY, rec); renderBoard($("et-board-start")); } } } } catch (_) {} })();

  window.EarTrainer = { G, answer, next, makeQuestion, dailyQuestions, setSide, get session() { return session; }, get ctx() { return ctx; }, TYPES };
})();

/* =====================================================================
   CHORD & MELODY STARTER – Akkorde, Melodie und Bass im Browser erzeugen
   Synths, Abspielen, Teilen-Link und MIDI-Export laufen komplett im Browser
   ===================================================================== */
(() => {
  const cfg = window.APP_CONFIG || {}, $ = id => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const BARS = 4, SPB = 16, TOTAL = BARS * SPB;            // 4 Takte à 16 Schritte
  const rnd = n => Math.floor(Math.random() * n);
  const pick = a => a[rnd(a.length)];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  // ---------- Musiktheorie ----------
  const SCALES = {
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
  };
  // Stufen sind 0-basiert: 0 = I/i, 3 = IV/iv, 4 = V/v, 5 = VI/vi, 6 = VII
  const MOODS = {
    dark: { name: "Dark", scale: "harmonic", sevenths: false,
      progs: [[0, 5, 4, 0], [0, 3, 4, 4], [0, 5, 1, 4], [0, 3, 5, 4], [0, 0, 5, 4], [5, 4, 0, 0]] },
    sad: { name: "Sad", scale: "minor", sevenths: false,
      progs: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 5, 3, 4], [5, 6, 0, 0], [0, 6, 5, 6], [0, 3, 5, 6]] },
    emotional: { name: "Emotional", scale: "minor", sevenths: true,
      progs: [[0, 3, 6, 2], [0, 5, 2, 6], [5, 3, 0, 6], [0, 2, 3, 4], [3, 6, 2, 5]] },
    dreamy: { name: "Dreamy", scale: "major", sevenths: true,
      progs: [[3, 0, 4, 5], [0, 3, 5, 4], [5, 3, 0, 4], [0, 2, 3, 3], [3, 4, 2, 5], [0, 5, 3, 4]] },
    hype: { name: "Hype", scale: "minor", sevenths: false,
      progs: [[0, 0, 5, 6], [0, 6, 5, 4], [0, 3, 0, 6], [0, 5, 0, 6], [0, 0, 3, 4]] },
  };

  // Rhythmen pro Takt: [Startschritt, Länge]
  const CHORD_RHYTHMS = {
    whole: [[0, 16]],
    half: [[0, 8], [8, 8]],
    stabs: [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]],
    sync: [[0, 6], [6, 4], [10, 6]],
    offbeat: [[2, 2], [6, 2], [10, 2], [14, 2]],
  };
  const MEL_RHYTHMS = {
    a: [[0, 2], [3, 1], [4, 2], [6, 2], [10, 2], [12, 4]],
    b: [[0, 3], [3, 3], [6, 2], [8, 4], [12, 2], [14, 2]],
    c: [[2, 2], [4, 2], [7, 1], [8, 4], [14, 2]],
    d: [[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]],
    e: [[0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2], [8, 2], [10, 2], [12, 4]],
    f: [[0, 6], [8, 4], [12, 4]],
  };
  const BASS_RHYTHMS = {
    whole: [[0, 16]],
    trap: [[0, 6], [6, 4], [10, 6]],
    drill: [[0, 3], [3, 5], [10, 6]],
    bounce: [[0, 3], [3, 3], [8, 3], [11, 5]],
  };
  const GENRES = {
    trap: { name: "Trap", bpm: [130, 150], swing: 0, chords: ["whole", "half"], mel: ["a", "c", "e", "f"], bass: ["trap", "whole"] },
    drill: { name: "Drill", bpm: [138, 146], swing: 0, chords: ["whole", "stabs"], mel: ["b", "c", "e"], bass: ["drill", "whole"] },
    rnb: { name: "R&B", bpm: [70, 90], swing: 25, chords: ["whole", "sync"], mel: ["a", "d", "f"], bass: ["whole", "trap"], sevenths: true },
    lofi: { name: "Lo-fi", bpm: [75, 90], swing: 50, chords: ["whole", "half"], mel: ["a", "d", "f"], bass: ["whole", "bounce"], sevenths: true },
    afro: { name: "Afro", bpm: [100, 115], swing: 15, chords: ["stabs", "offbeat"], mel: ["b", "c", "a"], bass: ["bounce"] },
  };
  const SOUNDS = { piano: "Piano", pad: "Pad", pluck: "Pluck", bell: "Bell" };

  const scaleOf = () => SCALES[MOODS[state.mood].scale];
  const midiOfDeg = (deg, base) => base + 12 * Math.floor(deg / 7) + scaleOf()[((deg % 7) + 7) % 7];
  const CHORD_TYPES = { auto: "Auto", triad: "Triads", seventh: "7ths", ninth: "9ths" };
  const RHYTHM_NAMES = { auto: "Auto", whole: "Whole", half: "Half", stabs: "Stabs", sync: "Syncopated", offbeat: "Offbeat" };
  // Akkordtyp: "Auto" nimmt Septakkorde bei Emotional/Dreamy bzw. R&B/Lo-fi, sonst Dreiklänge
  const chordExt = () => state.chordType && state.chordType !== "auto" ? state.chordType
    : (MOODS[state.mood].sevenths || GENRES[state.genre].sevenths ? "seventh" : "triad");

  // Akkord aus Stufe bauen (Dreiklang oder Septakkord)
  function chordTones(deg) {
    const base = 48 + state.key;                                   // um C3
    const ext = chordExt();
    const degs = [deg, deg + 2, deg + 4].concat(ext === "seventh" || ext === "ninth" ? [deg + 6] : []).concat(ext === "ninth" ? [deg + 8] : []);
    return degs.map(d => midiOfDeg(d, base));
  }
  function chordName(deg) {
    const d = detectChord(chordTones(deg));
    return d ? d.name : "";
  }

  // Stimmführung: Umkehrung wählen, die am nächsten am vorherigen Akkord liegt
  function voice(tones, prev) {
    const cands = [];
    for (let inv = 0; inv < tones.length; inv++) {
      const v = tones.map((n, i) => i < inv ? n + 12 : n).sort((a, b) => a - b);
      [-12, 0].forEach(sh => { const c = v.map(n => n + sh); if (c[0] >= 45 && c[c.length - 1] <= 79) cands.push(c); });
    }
    if (!prev || !cands.length) return cands[0] || tones;
    const cost = c => c.reduce((s, n, i) => s + Math.abs(n - (prev[i] ?? prev[prev.length - 1])), 0);
    return cands.sort((a, b) => cost(a) - cost(b))[0];
  }

  // ---------- Erzeugen ----------
  function newChords() {
    state.chordNotes = null;                                       // eigene Akkord-Noten verwerfen
    state.prog = pick(MOODS[state.mood].progs).slice();
    state.chordRhythm = state.rhythmSel && state.rhythmSel !== "auto" ? state.rhythmSel : pick(GENRES[state.genre].chords);
    state.bassRhythm = pick(GENRES[state.genre].bass);
  }
  function newMelody() {
    const g = GENRES[state.genre];
    const r1 = pick(g.mel), r2 = pick(g.mel), r3 = pick(g.mel);
    const rhythms = [r1, r2, r1, r3];
    const base = 60 + state.key, lo = base - 3, hi = base + 19;
    const scaleNotes = [];
    for (let d = -7; d < 21; d++) { const m = midiOfDeg(d, base); if (m >= lo && m <= hi) scaleNotes.push(m); }
    const nearestIdx = m => scaleNotes.reduce((bi, n, i) => Math.abs(n - m) < Math.abs(scaleNotes[bi] - m) ? i : bi, 0);
    let prev = base + scaleOf()[2] + (rnd(2) ? 12 : 0);           // Start auf der Terz
    const mel = [], barNotes = [];
    for (let bar = 0; bar < BARS; bar++) {
      const chordPcs = chordTones(state.prog[bar]).map(n => n % 12);
      if (bar === 2) {                                             // Takt 3 wiederholt Takt 1 (Motiv)
        barNotes[0].forEach(n => mel.push({ s: n.s + 2 * SPB, l: n.l, p: n.p }));
        barNotes.push(barNotes[0]); prev = barNotes[0][barNotes[0].length - 1].p; continue;
      }
      const notes = [];
      MEL_RHYTHMS[rhythms[bar]].forEach(([s, l], i, arr) => {
        let p;
        const strong = s % 4 === 0 || i === 0;
        const lastOfAll = bar === BARS - 1 && i === arr.length - 1;
        if (lastOfAll) {
          const rootPc = (chordTones(state.prog[bar])[0]) % 12;
          p = scaleNotes.filter(n => n % 12 === rootPc).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0] ?? prev;
        } else if (strong) {
          const cands = scaleNotes.filter(n => chordPcs.includes(n % 12)).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
          p = cands[Math.min(cands.length - 1, rnd(3) === 0 ? 1 : 0)] ?? prev;
        } else {
          const step = pick([-2, -1, -1, 1, 1, 2, 0]);
          p = scaleNotes[clamp(nearestIdx(prev) + step, 0, scaleNotes.length - 1)];
        }
        notes.push({ s: bar * SPB + s, l, p }); prev = p;
      });
      barNotes.push(notes.map(n => ({ s: n.s - bar * SPB, l: n.l, p: n.p })));
      mel.push(...notes);
    }
    state.melody = mel;
  }
  function generateAll(randomBpm) {
    if (randomBpm) { const [a, b] = GENRES[state.genre].bpm; state.bpm = a + rnd(b - a + 1); }
    newChords(); state.melody = [];                                 // nur Akkorde (keine Melodie mehr)
  }

  // Akkord-Noten aus der Akkordfolge (wenn nicht von Hand bearbeitet)
  function progChordNotes(s = state) {
    const list = []; let prevVoicing = null;
    for (let bar = 0; bar < BARS; bar++) {
      const v = voice(chordTones(s.prog[bar]), prevVoicing); prevVoicing = v;
      CHORD_RHYTHMS[s.chordRhythm].forEach(([st, l]) => v.forEach(p => list.push({ s: bar * SPB + st, l, p })));
    }
    return list;
  }
  const chordNotesOf = (s = state) => s.chordNotes || progChordNotes(s);

  // Akkord aus gespielten Tönen erkennen (für eigene Akkorde)
  const CHORD_SHAPES = [
    ["maj9", [0, 4, 7, 11, 2]], ["9", [0, 4, 7, 10, 2]], ["m9", [0, 3, 7, 10, 2]], ["m(maj9)", [0, 3, 7, 11, 2]],
    ["7♭9", [0, 4, 7, 10, 1]], ["m7♭9", [0, 3, 7, 10, 1]], ["maj7♯9", [0, 4, 7, 11, 3]], ["m9♭5", [0, 3, 6, 10, 2]], ["m7♭5(♭9)", [0, 3, 6, 10, 1]], ["maj9♯5", [0, 4, 8, 11, 2]],
    ["dim7", [0, 3, 6, 9]], ["add9", [0, 4, 7, 2]], ["m(add9)", [0, 3, 7, 2]],
    ["maj7", [0, 4, 7, 11]], ["7", [0, 4, 7, 10]], ["m7", [0, 3, 7, 10]], ["m7♭5", [0, 3, 6, 10]], ["m(maj7)", [0, 3, 7, 11]],
    ["", [0, 4, 7]], ["m", [0, 3, 7]], ["dim", [0, 3, 6]], ["aug", [0, 4, 8]], ["sus4", [0, 5, 7]], ["sus2", [0, 2, 7]],
    ["5", [0, 7]],
  ];
  function detectChord(pitches) {
    if (!pitches.length) return null;
    const pcs = [...new Set(pitches.map(p => p % 12))];
    const lowest = Math.min(...pitches) % 12;
    let best = null;
    for (const root of pcs) {
      const iv = new Set(pcs.map(pc => (pc - root + 12) % 12));
      for (const [q, shape] of CHORD_SHAPES) {
        if (shape.every(x => iv.has(x)) && iv.size <= shape.length + 1) {
          const score = shape.length * 10 - (iv.size - shape.length) * 3 + (root === lowest ? 2 : 0);
          if (!best || score > best.score) best = { root, name: NOTES[root] + q, score };
        }
      }
    }
    return best || { root: lowest, name: pcs.length === 1 ? NOTES[lowest] : pcs.map(pc => NOTES[pc]).join("·") };
  }
  // Akkordname und Grundton pro Takt
  function barChords(s = state) {
    if (!s.chordNotes) return s.prog.map(d => ({ name: chordName(d), root: chordTones(d)[0] % 12 }));
    return Array.from({ length: BARS }, (_, bar) => {
      const ps = s.chordNotes.filter(n => n.s >= bar * SPB && n.s < (bar + 1) * SPB).map(n => n.p);
      const d = detectChord(ps);
      return d ? { name: d.name, root: d.root } : { name: "–", root: null };
    });
  }

  // Alle Noten (für Wiedergabe, Anzeige, MIDI)
  function buildEvents(s = state) {
    const ev = [];
    chordNotesOf(s).forEach(n => ev.push({ part: "chords", s: n.s, l: n.l, p: n.p }));
    barChords(s).forEach((c, bar) => {
      if (c.root === null) return;
      let bp = 36 + c.root; if (bp > 43) bp -= 12;                 // Bass um C2
      BASS_RHYTHMS[s.bassRhythm].forEach(([st, l]) => ev.push({ part: "bass", s: bar * SPB + st, l, p: bp }));
    });
    s.melody.forEach(n => ev.push({ part: "melody", s: n.s, l: n.l, p: n.p }));
    return ev;
  }

  // ---------- Zustand ----------
  let state = {
    key: 9, mood: "sad", genre: "trap", bpm: 140,
    chordSound: "pad", melSound: "pluck", chordType: "auto", rhythmSel: "auto",
    on: { chords: true, melody: true, bass: true },
    prog: [0, 5, 2, 6], chordRhythm: "whole", bassRhythm: "trap", melody: [],
    chordNotes: null,                                              // eigene Akkord-Noten (nach Bearbeitung)
  };

  // ---------- Teilen-Link ----------
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  function encodeState() {
    return b64e(JSON.stringify({
      v: 1, k: state.key, m: state.mood, g: state.genre, b: state.bpm, cs: state.chordSound, ms: state.melSound,
      ct: state.chordType, rs: state.rhythmSel,
      o: [state.on.chords, state.on.melody, state.on.bass].map(x => x ? 1 : 0).join(""),
      p: state.prog.join(""), cr: state.chordRhythm, br: state.bassRhythm,
      n: packNotes(state.melody),
      ...(state.chordNotes ? { cn: packNotes(state.chordNotes) } : {}),
    }));
  }
  // Note -> 5 Zeichen: Schritt (2), Länge (1), Tonhöhe (2) in Base36
  const b36 = (n, w) => n.toString(36).padStart(w, "0");
  const packNotes = list => list.map(n => b36(n.s, 2) + b36(n.l - 1, 1) + b36(n.p - 24, 2)).join("");
  function unpackNotes(v, max) {
    if (Array.isArray(v)) return v.slice(0, max).map(([s, l, p]) => ({ s: +s, l: +l, p: +p }));
    if (typeof v !== "string") return [];
    const out = [];
    for (let i = 0; i + 5 <= v.length && out.length < max; i += 5)
      out.push({ s: parseInt(v.slice(i, i + 2), 36), l: parseInt(v[i + 2], 36) + 1, p: parseInt(v.slice(i + 3, i + 5), 36) + 24 });
    return out;
  }
  const cleanNotes = list => list.filter(n => [n.s, n.l, n.p].every(Number.isFinite))
    .map(n => ({ s: clamp(n.s, 0, TOTAL - 1), l: clamp(n.l, 1, 16), p: clamp(n.p, 36, 96) }))
    .map(n => ({ ...n, l: Math.min(n.l, TOTAL - n.s) }));
  function decodeState(str) {
    try {
      const o = JSON.parse(b64d(str));
      if (o.v !== 1 || !MOODS[o.m] || !GENRES[o.g] || !CHORD_RHYTHMS[o.cr] || !BASS_RHYTHMS[o.br]) return null;
      const prog = String(o.p).split("").map(Number);
      if (prog.length !== BARS || prog.some(d => isNaN(d) || d < 0 || d > 6)) return null;
      const mel = cleanNotes(unpackNotes(o.n, MAX_MEL));
      const cn = o.cn ? cleanNotes(unpackNotes(o.cn, MAX_CHORD)) : null;
      return {
        key: clamp(+o.k, 0, 11), mood: o.m, genre: o.g, bpm: clamp(+o.b, 60, 180),
        chordSound: SOUNDS[o.cs] ? o.cs : "pad", melSound: SOUNDS[o.ms] ? o.ms : "pluck",
        on: { chords: o.o?.[0] !== "0", melody: o.o?.[1] !== "0", bass: o.o?.[2] !== "0" },
        chordType: CHORD_TYPES[o.ct] ? o.ct : "auto", rhythmSel: RHYTHM_NAMES[o.rs] ? o.rs : "auto",
        prog, chordRhythm: o.cr, bassRhythm: o.br, melody: [], chordNotes: cn && cn.length ? cn : null,
      };
    } catch (_) { return null; }
  }
  let hashTimer = null;
  const saveHash = () => { clearTimeout(hashTimer); hashTimer = setTimeout(() => { try { history.replaceState(null, "", "#c=" + encodeState()); } catch (_) {} }, 300); };

  // ---------- Synths ----------
  let ctx = null, out = null, verb = null, partGain = {};
  function ensureAudio() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    out = ctx.createGain(); out.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 3;
    out.connect(comp).connect(ctx.destination);
    verb = makeReverb(ctx, out);
    ["chords", "melody", "bass"].forEach(p => { partGain[p] = ctx.createGain(); partGain[p].connect(out); });
    partGain.chords.gain.value = 0.55; partGain.melody.gain.value = 0.6; partGain.bass.gain.value = 0.7;
    return ctx;
  }
  function makeReverb(ac, dest) {
    const len = ac.sampleRate * 2.2, imp = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = imp.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    const conv = ac.createConvolver(); conv.buffer = imp;
    const g = ac.createGain(); g.gain.value = 0.35; conv.connect(g).connect(dest);
    return conv;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // Eine Note spielen: type = piano | pad | pluck | bell | bass
  function note(ac, dest, rev, type, midi, t, dur, vel = 0.5) {
    const f = hz(midi), g = ac.createGain(); g.gain.value = 0;
    const send = ac.createGain(); send.gain.value = { pad: 0.45, piano: 0.25, pluck: 0.3, bell: 0.35, bass: 0 }[type];
    g.connect(dest); g.connect(send); send.connect(rev);
    const end = t + dur;
    const osc = (wave, freq, det = 0) => { const o = ac.createOscillator(); o.type = wave; o.frequency.value = freq; o.detune.value = det; return o; };
    if (type === "pad") {
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1500; lp.Q.value = 0.4; lp.connect(g);
      [-9, 0, 9].forEach(d => { const o = osc("sawtooth", f, d); o.connect(lp); o.start(t); o.stop(end + 0.8); });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.22, t + 0.25);
      g.gain.setValueAtTime(vel * 0.22, end); g.gain.linearRampToValueAtTime(0, end + 0.7);
    } else if (type === "piano") {
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(900, t + 1.2); lp.connect(g);
      const o1 = osc("triangle", f), o2 = osc("sine", f * 2), g2 = ac.createGain(); g2.gain.value = 0.25;
      o1.connect(lp); o2.connect(g2).connect(lp);
      const stop = Math.min(end + 0.4, t + 3);
      [o1, o2].forEach(o => { o.start(t); o.stop(stop + 0.05); });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.6, t + 0.006);
      g.gain.exponentialRampToValueAtTime(vel * 0.2, t + 0.5); g.gain.setValueAtTime(vel * 0.2, Math.max(t + 0.5, end));
      g.gain.exponentialRampToValueAtTime(0.0001, stop);
    } else if (type === "pluck") {
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 2;
      lp.frequency.setValueAtTime(4500, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.3); lp.connect(g);
      const o = osc("sawtooth", f), o2 = osc("square", f, 7); const g2 = ac.createGain(); g2.gain.value = 0.4;
      o.connect(lp); o2.connect(g2).connect(lp);
      const stop = t + Math.min(0.9, dur + 0.4);
      [o, o2].forEach(x => { x.start(t); x.stop(stop + 0.05); });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.45, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, stop);
    } else if (type === "bell") {
      const c = osc("sine", f), m = osc("sine", f * 3.5), mg = ac.createGain();
      mg.gain.setValueAtTime(f * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
      m.connect(mg).connect(c.frequency); c.connect(g);
      const stop = t + Math.max(1.4, Math.min(dur + 0.8, 3));
      [c, m].forEach(x => { x.start(t); x.stop(stop + 0.05); });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, stop);
    } else {                                                          // bass
      const o = osc("sine", f), o2 = osc("triangle", f * 2), g2 = ac.createGain(); g2.gain.value = 0.15;
      const sh = ac.createWaveShaper(); const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(2.2 * x); } sh.curve = curve;
      o.connect(sh); o2.connect(g2).connect(sh); sh.connect(g);
      [o, o2].forEach(x => { x.start(t); x.stop(end + 0.15); });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel * 0.7, t + 0.006);
      g.gain.setValueAtTime(vel * 0.7, end); g.gain.linearRampToValueAtTime(0, end + 0.1);
    }
  }
  const typeFor = part => part === "chords" ? state.chordSound : part === "melody" ? state.melSound : "bass";
  const swingOf = (step, sd) => step % 2 === 1 ? (GENRES[state.genre].swing / 100) * sd * 0.33 : 0;

  // ---------- Wiedergabe ----------
  let playing = false, timer = null, nextTime = 0, cur = 0, events = [], byStep = [];
  const visQ = [];
  function indexEvents() {
    events = buildEvents();
    byStep = Array.from({ length: TOTAL }, () => []);
    events.forEach(e => byStep[e.s].push(e));
  }
  function tick() {
    const sd = 60 / state.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      const t = nextTime + swingOf(cur, sd);
      byStep[cur].forEach(e => { if (e.part === "melody") return; if (e.part === "chords" || state.on[e.part]) note(ctx, partGain[e.part], verb, typeFor(e.part), e.p, t, e.l * sd, e.part === "melody" ? 0.7 : 0.55); });
      visQ.push({ step: cur, time: t });
      nextTime += sd; cur = (cur + 1) % TOTAL;
    }
  }
  function draw() {
    if (!playing) return;
    let s = null;
    while (visQ.length && visQ[0].time <= ctx.currentTime) s = visQ.shift().step;
    if (s !== null) {
      $("cm-playhead").style.left = (s / TOTAL * 100) + "%";
      const bar = Math.floor(s / SPB);
      document.querySelectorAll(".cm-chord").forEach((c, i) => c.classList.toggle("now", i === bar));
    }
    requestAnimationFrame(draw);
  }
  async function play() {
    ensureAudio(); if (ctx.state === "suspended") await ctx.resume();
    indexEvents();
    playing = true; cur = 0; visQ.length = 0; nextTime = ctx.currentTime + 0.06;
    tick(); timer = setInterval(tick, 25);
    $("cm-play").classList.add("playing"); $("cm-play").setAttribute("aria-label", "Stop");
    $("cm-playhead").classList.remove("hidden");
    requestAnimationFrame(draw);
  }
  function stop() {
    playing = false; clearInterval(timer);
    $("cm-play").classList.remove("playing"); $("cm-play").setAttribute("aria-label", "Play");
    $("cm-playhead").classList.add("hidden");
    document.querySelectorAll(".cm-chord.now").forEach(c => c.classList.remove("now"));
  }
  const toggle = () => playing ? stop() : play();
  function refresh() { if (playing) indexEvents(); renderView(); saveHash(); }

  // ---------- Anzeige ----------
  function renderSettings() {
    $("cm-key").value = state.key;
    $("cm-bpm").value = state.bpm; $("cm-bpm-val").textContent = state.bpm;
    $("cm-chord-sound").value = state.chordSound;
    document.querySelectorAll("[data-ctype]").forEach(b => b.classList.toggle("active", b.dataset.ctype === state.chordType));
    document.querySelectorAll("[data-rhythm]").forEach(b => b.classList.toggle("active", b.dataset.rhythm === state.rhythmSel));
    document.querySelectorAll("[data-mood]").forEach(b => b.classList.toggle("active", b.dataset.mood === state.mood));
    document.querySelectorAll("[data-genre]").forEach(b => b.classList.toggle("active", b.dataset.genre === state.genre));
    document.querySelectorAll("[data-part]").forEach(b => { b.classList.toggle("active", state.on[b.dataset.part]); b.setAttribute("aria-pressed", state.on[b.dataset.part]); });
  }
  function renderView() {
    $("cm-chords").innerHTML = barChords().map((c, i) => `<div class="cm-chord"><span>Bar ${i + 1}${state.chordNotes ? " · edited" : ""}</span><strong>${c.name}</strong></div>`).join("");
    renderRoll();
    $("cm-scale").textContent = `${NOTES[state.key]} ${MOODS[state.mood].scale === "major" ? "major" : MOODS[state.mood].scale === "harmonic" ? "harmonic minor" : "minor"}`;
  }

  // ---------- Bedienung ----------
  $("cm-key").innerHTML = NOTES.map((n, i) => `<option value="${i}">${n}</option>`).join("");
  const soundOpts = Object.entries(SOUNDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  $("cm-chord-sound").innerHTML = soundOpts;
  $("cm-types").innerHTML = Object.entries(CHORD_TYPES).map(([k, v]) => `<button type="button" class="cm-pill" data-ctype="${k}">${v}</button>`).join("");
  $("cm-rhythms").innerHTML = Object.entries(RHYTHM_NAMES).map(([k, v]) => `<button type="button" class="cm-pill" data-rhythm="${k}">${v}</button>`).join("");
  $("cm-moods").innerHTML = Object.entries(MOODS).map(([k, m]) => `<button type="button" class="cm-pill" data-mood="${k}">${m.name}</button>`).join("");
  $("cm-genres").innerHTML = Object.entries(GENRES).map(([k, g]) => `<button type="button" class="cm-pill" data-genre="${k}">${g.name}</button>`).join("");

  $("cm-play").onclick = toggle;
  $("cm-key").onchange = e => {
    const nk = +e.target.value; let d = ((nk - state.key) % 12 + 12) % 12; if (d > 6) d -= 12;
    const shift = list => list.map(n => ({ ...n, p: clamp(n.p + d, 36, 96) }));
    state.key = nk; state.melody = shift(state.melody); if (state.chordNotes) state.chordNotes = shift(state.chordNotes);
    refresh();
  };
  $("cm-bpm").oninput = e => { state.bpm = +e.target.value; $("cm-bpm-val").textContent = state.bpm; saveHash(); };
  $("cm-chord-sound").onchange = e => { state.chordSound = e.target.value; saveHash(); };
  // Akkordtyp wechseln: gleiche Akkordfolge, neue Klangfarbe (eigene Bearbeitung wird ersetzt, Undo möglich)
  $("cm-types").onclick = e => {
    const b = e.target.closest("[data-ctype]"); if (!b || b.dataset.ctype === state.chordType) return;
    pushUndo(); state.chordType = b.dataset.ctype; state.chordNotes = null; renderSettings(); refresh();
  };
  // Rhythmus wechseln: gleiche Akkorde, neuer Rhythmus
  $("cm-rhythms").onclick = e => {
    const b = e.target.closest("[data-rhythm]"); if (!b || b.dataset.rhythm === state.rhythmSel) return;
    pushUndo(); state.rhythmSel = b.dataset.rhythm;
    state.chordRhythm = state.rhythmSel !== "auto" ? state.rhythmSel : pick(GENRES[state.genre].chords);
    state.chordNotes = null; renderSettings(); refresh();
  };
  $("cm-moods").onclick = e => { const b = e.target.closest("[data-mood]"); if (!b) return; pushUndo(); state.mood = b.dataset.mood; generateAll(false); renderSettings(); refresh(); };
  $("cm-genres").onclick = e => { const b = e.target.closest("[data-genre]"); if (!b) return; pushUndo(); state.genre = b.dataset.genre; generateAll(true); renderSettings(); refresh(); };
  $("cm-parts").onclick = e => { const b = e.target.closest("[data-part]"); if (!b) return; state.on[b.dataset.part] = !state.on[b.dataset.part]; renderSettings(); saveHash(); };
  $("cm-generate").onclick = () => { pushUndo(); generateAll(false); refresh(); if (!playing) play(); };

  document.addEventListener("keydown", e => {
    if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); toggle(); }
  });

  function setStatus(msg, bad) { const el = $("cm-status"); el.textContent = msg; el.classList.toggle("danger", !!bad); }


  // =====================================================================
  // PIANO-ROLL-EDITOR: Noten setzen, verschieben, verlängern, löschen
  // =====================================================================
  const MAX_MEL = 128, MAX_CHORD = 160;
  const ed = { target: "chords", snap: true, sel: -1, lastLen: 4, drag: null };
  const undoStack = [];
  const snapshot = () => JSON.stringify({ m: state.melody, c: state.chordNotes, p: state.prog, cr: state.chordRhythm, br: state.bassRhythm });
  function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); $("ed-undo").disabled = false; }
  function undo() {
    const s = undoStack.pop(); if (!s) return;
    const o = JSON.parse(s);
    state.melody = o.m; state.chordNotes = o.c; state.prog = o.p; state.chordRhythm = o.cr; state.bassRhythm = o.br;
    ed.sel = -1; $("ed-undo").disabled = !undoStack.length; refresh();
  }

  // Sichtbarer Tonbereich je nach Ziel
  const range = () => ed.target === "melody"
    ? { lo: 60 + state.key - 5, hi: 60 + state.key + 24 }
    : { lo: 45, hi: 79 };
  const inScale = p => scaleOf().includes(((p - state.key) % 12 + 12) % 12);
  const snapPitch = p => {
    if (!ed.snap || inScale(p)) return p;
    for (let d = 1; d < 3; d++) { if (inScale(p - d)) return p - d; if (inScale(p + d)) return p + d; }
    return p;
  };
  // Liste, die gerade bearbeitet wird (Akkorde werden beim ersten Bearbeiten „aufgeklappt“)
  function targetList(create) {
    if (ed.target === "melody") return state.melody;
    if (!state.chordNotes && create) state.chordNotes = progChordNotes();
    return state.chordNotes || progChordNotes();
  }

  function renderRoll() {
    const { lo, hi } = range(), rows = hi - lo + 1, grid = $("cm-grid");
    const rowH = matchMedia("(max-width: 600px)").matches ? 14 : 12;
    grid.style.height = (rows * rowH) + "px"; $("cm-keys").style.height = (rows * rowH) + "px";
    grid.style.setProperty("--rowh", rowH + "px");
    // Tasten links + Zeilen der Tonleiter hervorheben
    let keys = "", lanes = "";
    for (let p = hi; p >= lo; p--) {
      const isC = p % 12 === 0, sc = inScale(p), y = (hi - p) * rowH;
      keys += `<span class="${sc ? "sc" : ""} ${isC ? "c" : ""}" style="top:${y}px;height:${rowH}px">${isC || (p - state.key) % 12 === 0 ? NOTES[p % 12] + (Math.floor(p / 12) - 1) : ""}</span>`;
      if (sc) lanes += `<i class="lane" style="top:${y}px;height:${rowH}px"></i>`;
    }
    $("cm-keys").innerHTML = keys;
    const other = ed.target === "melody" ? chordNotesOf() : state.melody;
    const mine = ed.target === "melody" ? state.melody : chordNotesOf();
    const block = (n, i, cls) => {
      if (n.p < lo || n.p > hi) return "";
      return `<span class="cm-note ${cls}${i === ed.sel ? " sel" : ""}" ${i >= 0 ? `data-i="${i}"` : ""} style="left:${n.s / TOTAL * 100}%;width:${n.l / TOTAL * 100}%;top:${(hi - n.p) * rowH}px;height:${rowH}px">${i >= 0 ? '<b class="rz"></b>' : ""}</span>`;
    };
    $("cm-notes").innerHTML = lanes + other.map(n => block(n, -1, "ghost")).join("") +
      mine.map((n, i) => block(n, i, ed.target === "melody" ? "mel ed" : "ch ed")).join("");
    $("ed-delete").disabled = ed.sel < 0;
  }

  async function previewNote(p, part) {
    ensureAudio(); if (ctx.state === "suspended") await ctx.resume();
    note(ctx, partGain[part], verb, typeFor(part), p, ctx.currentTime + 0.01, 0.25, 0.6);
  }
  const part = () => ed.target === "melody" ? "melody" : "chords";

  function cellFromEvent(e) {
    const r = $("cm-grid").getBoundingClientRect(), { hi } = range();
    const rowH = parseFloat(getComputedStyle($("cm-grid")).getPropertyValue("--rowh")) || 12;
    const x = clamp(e.clientX - r.left, 0, r.width - 1), y = clamp(e.clientY - r.top, 0, r.height - 1);
    return { step: Math.floor(x / r.width * TOTAL), pitch: hi - Math.floor(y / rowH), colW: r.width / TOTAL, rowH };
  }

  $("cm-grid").addEventListener("pointerdown", e => {
    if (e.button !== undefined && e.button !== 0) return;
    const c = cellFromEvent(e), hitEl = e.target.closest(".cm-note.ed");
    const before = snapshot();
    const list = targetList(true);
    let i;
    if (hitEl) {
      i = +hitEl.dataset.i;
      // Zweiter Klick auf dieselbe Note innerhalb von 350 ms = löschen (eigener Doppelklick)
      const now = performance.now();
      if (ed.lastTap && ed.lastTap.i === i && ed.lastTap.t > now - 350) { ed.lastTap = null; ed.sel = i; deleteSel(); return; }
      ed.lastTap = { i, t: now };
      const mode = e.target.classList.contains("rz") ? "resize" : "move";
      ed.drag = { i, mode, x0: e.clientX, y0: e.clientY, orig: { ...list[i] }, before, moved: false };
    } else {
      const max = ed.target === "melody" ? MAX_MEL : MAX_CHORD;
      if (list.length >= max) { setStatus("That's the maximum number of notes for this part.", true); return; }
      const s = Math.min(c.step, TOTAL - 1), l = Math.min(ed.lastLen, TOTAL - s), p = snapPitch(c.pitch);
      list.push({ s, l, p }); i = list.length - 1;
      ed.drag = { i, mode: "move", x0: e.clientX, y0: e.clientY, orig: { s, l, p }, before, moved: true };
      previewNote(p, part());
    }
    ed.sel = i;
    try { $("cm-grid").setPointerCapture(e.pointerId); } catch (_) {}
    renderRoll();
  });
  $("cm-grid").addEventListener("pointermove", e => {
    const d = ed.drag; if (!d) return;
    const list = targetList(true), n = list[d.i]; if (!n) return;
    const { colW, rowH } = cellFromEvent(e);
    const ds = Math.round((e.clientX - d.x0) / colW), dp = -Math.round((e.clientY - d.y0) / rowH);
    if (d.mode === "resize") {
      n.l = clamp(d.orig.l + ds, 1, Math.min(16, TOTAL - n.s));
    } else {
      const { lo, hi } = range();
      const np = snapPitch(clamp(d.orig.p + dp, lo, hi)), ns = clamp(d.orig.s + ds, 0, TOTAL - n.l);
      if (np !== n.p) previewNote(np, part());
      n.p = np; n.s = ns;
    }
    if (ds || dp) d.moved = true;
    renderRoll();
  });
  function endDrag() {
    const d = ed.drag; if (!d) return; ed.drag = null;
    const n = targetList(false)[d.i];
    if (n && d.mode === "resize") ed.lastLen = n.l;
    if (d.moved) ed.lastTap = null;
    if (d.moved || snapshot() !== d.before) { undoStack.push(d.before); if (undoStack.length > 60) undoStack.shift(); $("ed-undo").disabled = false; }
    refresh();
  }
  $("cm-grid").addEventListener("pointerup", endDrag);
  $("cm-grid").addEventListener("pointercancel", endDrag);
  // Rechtsklick auf eine Note löscht sie ebenfalls
  $("cm-grid").addEventListener("contextmenu", e => { const el = e.target.closest(".cm-note.ed"); if (el) { e.preventDefault(); ed.sel = +el.dataset.i; deleteSel(); } });

  function deleteSel() {
    if (ed.sel < 0) return;
    pushUndo();
    targetList(true).splice(ed.sel, 1); ed.sel = -1; refresh();
  }
  $("ed-delete").onclick = deleteSel;
  $("ed-undo").onclick = undo;
  $("ed-clear").onclick = () => {
    if (!confirm("Remove all chord notes?")) return;
    pushUndo();
    if (ed.target === "melody") state.melody = []; else state.chordNotes = [];
    ed.sel = -1; refresh();
  };
  $("ed-snap").onchange = e => { ed.snap = e.target.checked; renderRoll(); };
  // Tastatur: Entf = löschen, Pfeile = verschieben, Cmd/Ctrl+Z = rückgängig
  document.addEventListener("keydown", e => {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (ed.sel < 0) return;
    const n = targetList(false)[ed.sel]; if (!n) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); return; }
    const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!mv) return;
    e.preventDefault(); pushUndo();
    const l = targetList(true)[ed.sel], { lo, hi } = range();
    l.s = clamp(l.s + mv[0], 0, TOTAL - l.l);
    if (mv[1]) { let p = l.p + mv[1]; if (ed.snap) while (!inScale(p) && p > lo && p < hi) p += mv[1]; l.p = clamp(p, lo, hi); previewNote(l.p, part()); }
    refresh();
  });

  // ---------- Teilen ----------
  $("cm-share").onclick = async () => {
    const url = `${location.origin}${location.pathname}#c=${encodeState()}`;
    try {
      if (navigator.share && matchMedia("(max-width: 760px)").matches) { await navigator.share({ title: "My chords – YARDSLOVESYOU", url }); return; }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied! Whoever opens it hears exactly these chords.");
    } catch (_) { prompt("Copy this link:", url); }
  };

  // ---------- MIDI ----------
  function midiFile(s) {
    const PPQ = 96, T = PPQ / 4;
    const sw = st => st % 2 === 1 ? Math.round((GENRES[s.genre].swing / 100) * T * 0.33) : 0;
    const ev = buildEvents(s);
    const vlq = n => { const o = [n & 0x7f]; while ((n >>= 7)) o.unshift((n & 0x7f) | 0x80); return o; };
    const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const txt = (type, str) => { const b = [...str].map(c => c.charCodeAt(0) & 127); return [0x00, 0xff, type, b.length, ...b]; };
    const trackChunk = data => [0x4d, 0x54, 0x72, 0x6b, ...u32(data.length), ...data];
    const tempo = Math.round(60000000 / s.bpm);
    const t0 = [...txt(0x03, "YARDSLOVESYOU Chord Starter"), 0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
      0x00, 0xff, 0x58, 0x04, 4, 2, 24, 8, 0x00, 0xff, 0x2f, 0x00];
    const parts = [["chords", "Chords", 0, 90]].concat(s.on && s.on.bass ? [["bass", "Bass", 1, 100]] : []);
    const tracks = parts.map(([part, name, ch, vel]) => {
      const list = [];
      ev.filter(e => e.part === part).forEach(e => {
        const on = e.s * T + sw(e.s), off = (e.s + e.l) * T + sw(e.s + e.l) - 1;
        list.push([on, [0x90 | ch, e.p, vel]], [off, [0x80 | ch, e.p, 0]]);
      });
      list.sort((a, b) => a[0] - b[0] || (a[1][0] & 0xf0) - (b[1][0] & 0xf0));
      const data = [...txt(0x03, name)]; let last = 0;
      list.forEach(([tk, b]) => { data.push(...vlq(tk - last), ...b); last = tk; });
      data.push(0x00, 0xff, 0x2f, 0x00);
      return trackChunk(data);
    });
    const bytes = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 1, 0, 1 + tracks.length, (PPQ >> 8) & 255, PPQ & 255, ...trackChunk(t0), ...tracks.flat()];
    return new Uint8Array(bytes);
  }
  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const progName = s => barChords(s).map(c => c.name).join("-").replace(/♭/g, "b").replace(/·/g, "+");
  const fileName = s => `${NOTES[s.key].replace("#", "s")} ${MOODS[s.mood].name} ${GENRES[s.genre].name} ${s.bpm}bpm - ${progName(s)}`;
  $("cm-midi").onclick = () => {
    download(new Blob([midiFile(state)], { type: "audio/midi" }), fileName(state) + ".mid");
    setStatus("MIDI downloaded – drag it into your DAW. Chords and bass are on separate tracks.");
  };

  // ---------- MIDI-Pack (10 Ideen) gegen E-Mail ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + size;
    });
    const cSize = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
  }
  function exportPack() {
    const saved = JSON.parse(JSON.stringify(state));
    const files = [{ name: "01 " + fileName(saved) + ".mid", data: midiFile(saved) }];
    // 9 weitere, möglichst verschiedene Akkordfolgen: Pool + Umstellungen, ohne Doppelte
    const seen = new Set([saved.prog.join("")]), pool = [];
    const base = MOODS[saved.mood].progs.slice().sort(() => Math.random() - 0.5);
    [0, 2, 1, 3].forEach(rot => base.forEach(pr => {
      const r = pr.slice(rot).concat(pr.slice(0, rot)), k = r.join("");
      if (!seen.has(k)) { seen.add(k); pool.push(r); }
    }));
    for (let i = 2; i <= 10; i++) {
      newChords(); if (pool.length) state.prog = pool.shift();
      state.melody = [];
      const s = JSON.parse(JSON.stringify(state));
      files.push({ name: String(i).padStart(2, "0") + " " + fileName(s) + ".mid", data: midiFile(s) });
    }
    state = saved;
    files.push({ name: "readme.txt", data: new TextEncoder().encode(`10 chord progressions in ${NOTES[saved.key]} – ${MOODS[saved.mood].name} ${GENRES[saved.genre].name}\nMade with the YARDSLOVESYOU Chord Starter: https://yardslovesyou.com/chords.html\nEach MIDI file contains the chords (and the bass, if switched on). Free to use in your own music.\nAdd percussion in the Percussion Loop Lab: https://yardslovesyou.com/beatlab.html\n`) });
    download(zip(files), `YARDSLOVESYOU MIDI pack - ${NOTES[saved.key].replace("#", "s")} ${MOODS[saved.mood].name} ${GENRES[saved.genre].name}.zip`);
    setStatus("Your MIDI pack with 10 ideas is downloading.");
  }
  const UNLOCK_KEYS = ["yly_unlocked", "yly_beatlab_unlocked"];
  const isUnlocked = () => { try { return UNLOCK_KEYS.some(k => localStorage.getItem(k) === "1"); } catch (_) { return false; } };
  function showUnlocked() { $("cm-pack").classList.remove("locked"); $("cm-pack").textContent = "Download MIDI pack (10 ideas)"; $("cm-unlock").classList.add("hidden"); }
  $("cm-pack").onclick = () => {
    if (isUnlocked()) return exportPack();
    $("cm-unlock").classList.remove("hidden");
    $("cm-unlock").scrollIntoView({ behavior: "smooth", block: "center" });
    $("cm-email").focus({ preventScroll: true });
  };
  $("cm-unlock").onsubmit = async e => {
    e.preventDefault();
    const email = $("cm-email").value.trim(), st = $("cm-unlock-status"), btn = $("cm-unlock-btn");
    st.classList.remove("danger"); st.textContent = "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { st.textContent = "Please enter a valid email address."; st.classList.add("danger"); return; }
    btn.disabled = true; btn.textContent = "Sending …";
    try {
      const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await db.functions.invoke("free-kit", { body: { email, marketing_consent: $("cm-consent").checked } });
      if (error) { let m = error.message; try { const j = await error.context.json(); if (j?.error) m = j.error; } catch (_) {} throw new Error(m); }
      if (!data?.ok) throw new Error(data?.error || "Something went wrong.");
      try { UNLOCK_KEYS.forEach(k => localStorage.setItem(k, "1")); } catch (_) {}
      showUnlocked();
      setStatus("Unlocked! Essentials Lite is on its way to your inbox.");
      exportPack();
    } catch (err) {
      st.textContent = err.message || "Something went wrong. Please try again."; st.classList.add("danger");
    } finally { btn.disabled = false; btn.textContent = "Unlock & download"; }
  };

  // ---------- Start ----------
  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#c=") || location.hash.slice(3) === encodeState()) return;
    const s = decodeState(location.hash.slice(3)); if (!s) return;
    state = s; renderSettings(); refresh(); setStatus("Shared idea loaded – press play!");
  });
  const shared = location.hash.startsWith("#c=") ? decodeState(location.hash.slice(3)) : null;
  if (shared) { state = shared; setStatus("You're listening to a shared idea – press play, then make it yours!"); }
  else generateAll(false);
  state.melody = [];
  renderSettings(); renderView(); saveHash();
  if (isUnlocked()) showUnlocked();
})();

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
  const useSevenths = () => MOODS[state.mood].sevenths || !!GENRES[state.genre].sevenths;

  // Akkord aus Stufe bauen (Dreiklang oder Septakkord)
  function chordTones(deg) {
    const base = 48 + state.key;                                   // um C3
    const degs = [deg, deg + 2, deg + 4].concat(useSevenths() ? [deg + 6] : []);
    return degs.map(d => midiOfDeg(d, base));
  }
  function chordName(deg) {
    const t = chordTones(deg), root = t[0] % 12;
    const iv = t.map(n => (n - t[0] + 120) % 12);
    let q = iv[1] === 3 ? (iv[2] === 6 ? "dim" : "m") : (iv[2] === 8 ? "aug" : "");
    if (t.length > 3) {
      const s = iv[3];
      if (s === 11) q = q === "m" ? "m(maj7)" : q === "" ? "maj7" : q + "maj7";
      else if (s === 10) q = q === "dim" ? "m7♭5" : q + "7";
    }
    return NOTES[root] + q;
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
    state.prog = pick(MOODS[state.mood].progs).slice();
    state.chordRhythm = pick(GENRES[state.genre].chords);
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
    newChords(); newMelody();
  }

  // Alle Noten (für Wiedergabe, Anzeige, MIDI)
  function buildEvents(s = state) {
    const ev = [];
    let prevVoicing = null;
    for (let bar = 0; bar < BARS; bar++) {
      const v = voice(chordTones(s.prog[bar]), prevVoicing); prevVoicing = v;
      CHORD_RHYTHMS[s.chordRhythm].forEach(([st, l]) => v.forEach(p => ev.push({ part: "chords", s: bar * SPB + st, l, p })));
      const root = chordTones(s.prog[bar])[0] % 12;
      let bp = 36 + root; if (bp > 43) bp -= 12;                    // Bass um C2
      BASS_RHYTHMS[s.bassRhythm].forEach(([st, l]) => ev.push({ part: "bass", s: bar * SPB + st, l, p: bp }));
    }
    s.melody.forEach(n => ev.push({ part: "melody", s: n.s, l: n.l, p: n.p }));
    return ev;
  }

  // ---------- Zustand ----------
  let state = {
    key: 9, mood: "sad", genre: "trap", bpm: 140,
    chordSound: "pad", melSound: "pluck",
    on: { chords: true, melody: true, bass: true },
    prog: [0, 5, 2, 6], chordRhythm: "whole", bassRhythm: "trap", melody: [],
  };

  // ---------- Teilen-Link ----------
  const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  function encodeState() {
    return b64e(JSON.stringify({
      v: 1, k: state.key, m: state.mood, g: state.genre, b: state.bpm, cs: state.chordSound, ms: state.melSound,
      o: [state.on.chords, state.on.melody, state.on.bass].map(x => x ? 1 : 0).join(""),
      p: state.prog.join(""), cr: state.chordRhythm, br: state.bassRhythm,
      n: state.melody.map(n => [n.s, n.l, n.p]),
    }));
  }
  function decodeState(str) {
    try {
      const o = JSON.parse(b64d(str));
      if (o.v !== 1 || !MOODS[o.m] || !GENRES[o.g] || !CHORD_RHYTHMS[o.cr] || !BASS_RHYTHMS[o.br]) return null;
      const prog = String(o.p).split("").map(Number);
      if (prog.length !== BARS || prog.some(d => isNaN(d) || d < 0 || d > 6)) return null;
      const mel = (o.n || []).slice(0, 128).map(([s, l, p]) => ({ s: clamp(+s, 0, TOTAL - 1), l: clamp(+l, 1, 16), p: clamp(+p, 36, 96) }));
      return {
        key: clamp(+o.k, 0, 11), mood: o.m, genre: o.g, bpm: clamp(+o.b, 60, 180),
        chordSound: SOUNDS[o.cs] ? o.cs : "pad", melSound: SOUNDS[o.ms] ? o.ms : "pluck",
        on: { chords: o.o?.[0] !== "0", melody: o.o?.[1] !== "0", bass: o.o?.[2] !== "0" },
        prog, chordRhythm: o.cr, bassRhythm: o.br, melody: mel,
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
      byStep[cur].forEach(e => { if (state.on[e.part]) note(ctx, partGain[e.part], verb, typeFor(e.part), e.p, t, e.l * sd, e.part === "melody" ? 0.7 : 0.55); });
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
    $("cm-chord-sound").value = state.chordSound; $("cm-mel-sound").value = state.melSound;
    document.querySelectorAll("[data-mood]").forEach(b => b.classList.toggle("active", b.dataset.mood === state.mood));
    document.querySelectorAll("[data-genre]").forEach(b => b.classList.toggle("active", b.dataset.genre === state.genre));
    document.querySelectorAll("[data-part]").forEach(b => { b.classList.toggle("active", state.on[b.dataset.part]); b.setAttribute("aria-pressed", state.on[b.dataset.part]); });
  }
  function renderView() {
    $("cm-chords").innerHTML = state.prog.map((d, i) => `<div class="cm-chord"><span>Bar ${i + 1}</span><strong>${chordName(d)}</strong></div>`).join("");
    const ev = buildEvents();
    const mel = ev.filter(e => e.part === "melody"), ch = ev.filter(e => e.part === "chords");
    // Melodie oben (0–64 %), Akkorde unten (70–100 %), jeweils auf ihren eigenen Tonumfang skaliert
    const zone = (list, top, height, cls) => {
      if (!list.length) return "";
      const lo = Math.min(...list.map(e => e.p)) - 1, hi = Math.max(...list.map(e => e.p)) + 1, rows = hi - lo + 1;
      return list.map(e => `<span class="cm-note ${cls}" style="left:${e.s / TOTAL * 100}%;width:${e.l / TOTAL * 100}%;top:${top + (hi - e.p) / rows * height}%;height:${height / rows}%"></span>`).join("");
    };
    $("cm-roll-notes").innerHTML = zone(mel, 0, 64, "mel") + zone(ch, 70, 30, "ch");
    $("cm-scale").textContent = `${NOTES[state.key]} ${MOODS[state.mood].scale === "major" ? "major" : MOODS[state.mood].scale === "harmonic" ? "harmonic minor" : "minor"}`;
  }

  // ---------- Bedienung ----------
  $("cm-key").innerHTML = NOTES.map((n, i) => `<option value="${i}">${n}</option>`).join("");
  const soundOpts = Object.entries(SOUNDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  $("cm-chord-sound").innerHTML = soundOpts; $("cm-mel-sound").innerHTML = soundOpts;
  $("cm-moods").innerHTML = Object.entries(MOODS).map(([k, m]) => `<button type="button" class="cm-pill" data-mood="${k}">${m.name}</button>`).join("");
  $("cm-genres").innerHTML = Object.entries(GENRES).map(([k, g]) => `<button type="button" class="cm-pill" data-genre="${k}">${g.name}</button>`).join("");

  $("cm-play").onclick = toggle;
  $("cm-key").onchange = e => { state.key = +e.target.value; newMelodyKeepRhythm(); refresh(); };
  $("cm-bpm").oninput = e => { state.bpm = +e.target.value; $("cm-bpm-val").textContent = state.bpm; saveHash(); };
  $("cm-chord-sound").onchange = e => { state.chordSound = e.target.value; saveHash(); };
  $("cm-mel-sound").onchange = e => { state.melSound = e.target.value; saveHash(); };
  $("cm-moods").onclick = e => { const b = e.target.closest("[data-mood]"); if (!b) return; state.mood = b.dataset.mood; generateAll(false); renderSettings(); refresh(); };
  $("cm-genres").onclick = e => { const b = e.target.closest("[data-genre]"); if (!b) return; state.genre = b.dataset.genre; generateAll(true); renderSettings(); refresh(); };
  $("cm-parts").onclick = e => { const b = e.target.closest("[data-part]"); if (!b) return; state.on[b.dataset.part] = !state.on[b.dataset.part]; renderSettings(); saveHash(); };
  $("cm-generate").onclick = () => { generateAll(false); refresh(); if (!playing) play(); };
  $("cm-new-chords").onclick = () => { newChords(); newMelody(); refresh(); };
  $("cm-new-melody").onclick = () => { newMelody(); refresh(); };
  document.addEventListener("keydown", e => {
    if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); toggle(); }
  });
  // Tonart wechseln: Melodie neu passend erzeugen (Rhythmus/Akkorde bleiben)
  function newMelodyKeepRhythm() { newMelody(); }

  function setStatus(msg, bad) { const el = $("cm-status"); el.textContent = msg; el.classList.toggle("danger", !!bad); }

  // ---------- Teilen ----------
  $("cm-share").onclick = async () => {
    const url = `${location.origin}${location.pathname}#c=${encodeState()}`;
    try {
      if (navigator.share && matchMedia("(max-width: 760px)").matches) { await navigator.share({ title: "My chords – YARDSLOVESYOU", url }); return; }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied! Whoever opens it hears exactly these chords and this melody.");
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
    const t0 = [...txt(0x03, "YARDSLOVESYOU Chord & Melody Starter"), 0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
      0x00, 0xff, 0x58, 0x04, 4, 2, 24, 8, 0x00, 0xff, 0x2f, 0x00];
    const parts = [["chords", "Chords", 0, 85], ["melody", "Melody", 1, 100], ["bass", "Bass", 2, 100]];
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
  const progName = s => s.prog.map(d => chordName(d)).join("-").replace(/♭/g, "b");
  const fileName = s => `${NOTES[s.key].replace("#", "s")} ${MOODS[s.mood].name} ${GENRES[s.genre].name} ${s.bpm}bpm - ${progName(s)}`;
  $("cm-midi").onclick = () => {
    download(new Blob([midiFile(state)], { type: "audio/midi" }), fileName(state) + ".mid");
    setStatus("MIDI downloaded – drag it into your DAW. Chords, melody and bass are on separate tracks.");
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
      newMelody();
      const s = JSON.parse(JSON.stringify(state));
      files.push({ name: String(i).padStart(2, "0") + " " + fileName(s) + ".mid", data: midiFile(s) });
    }
    state = saved;
    files.push({ name: "readme.txt", data: new TextEncoder().encode(`10 chord & melody ideas in ${NOTES[saved.key]} – ${MOODS[saved.mood].name} ${GENRES[saved.genre].name}\nMade with the YARDSLOVESYOU Chord & Melody Starter: https://yardslovesyou.com/chords.html\nEach MIDI file has 3 tracks: chords, melody and bass. Free to use in your own music.\nAdd drums in the Beat Lab: https://yardslovesyou.com/beatlab.html\n`) });
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
  if (!state.melody.length) newMelody();
  renderSettings(); renderView(); saveHash();
  if (isUnlocked()) showUnlocked();
})();

/* =====================================================================
   PERCUSSION LOOP LAB – Perkussions-Loops im Browser
   10 Spuren x 32 Schritte, Rhythmus-Generator (Genre/Mood/Density/...),
   Sounds aus dem Storage-Ordner "perclab", Teilen-Link, MIDI- und WAV-Export.
   Läuft komplett im Browser.
   ===================================================================== */
(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, isNaN(x) ? a : x));
  const STEPS = 32, MAX_TRACKS = 10;

  /* ===================================================================
     REINE LOGIK (kein DOM): Zufall, Genres, Generator, Hash
     =================================================================== */
  // ==PURE-START==

  // ---------- Zufall (reproduzierbar über Seed) ----------
  const mulberry32 = a => () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const h32 = (a, b, c) => {
    let h = (a ^ Math.imul(b + 1, 0x9e3779b1) ^ Math.imul(c + 1, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    return (h ^ (h >>> 12)) >>> 0;
  };
  const newSeed = () => (Math.random() * 4294967296) >>> 0;

  // ---------- Listen (Reihenfolge NIE ändern, sie steckt im Hash!) ----------
  const GENRE_KEYS = ["trap", "drill", "afro", "amapiano", "reggaeton", "dancehall", "baile", "jersey", "boombap", "lofi", "house", "latin", "rnb"];
  const GENRE_NAMES = ["Trap", "Drill", "Afrobeats", "Amapiano", "Reggaeton", "Dancehall", "Baile Funk", "Jersey Club", "Boom Bap", "Lo-fi", "House", "Latin / Clave", "R&B"];
  const MOOD_KEYS = ["dark", "bouncy", "chill", "energetic", "hypnotic", "tribal"];
  const MOOD_NAMES = ["Dark", "Bouncy", "Chill", "Energetic", "Hypnotic", "Tribal"];
  const DENS_NAMES = ["Sparse", "Medium", "Busy"], CX_NAMES = ["Simple", "Groovy", "Wild"];

  // Mood: d = Dichte-Verschiebung, bpm/sw = Auto-Werte auf BPM und Swing
  const MOOD = {
    dark:      { d: -0.5, bpm: -4, sw: 0 },
    bouncy:    { d: 0,    bpm: 0,  sw: 8 },
    chill:     { d: -1,   bpm: -6, sw: 12 },
    energetic: { d: 1,    bpm: 6,  sw: -5 },
    hypnotic:  { d: -0.3, bpm: 0,  sw: 0 },
    tribal:    { d: 0.3,  bpm: 2,  sw: 5 },
  };

  // ---------- Referenz-Grooves auf dem 16er-Raster ----------
  // x = Schlag, X = Akzent, . = Pause. Leerzeichen sind nur Lesehilfe (4er-Gruppen = Beats).
  // Varianten mit | getrennt (Variante 2 dient u.a. als Abwandlung für Takt 2).
  // p = Puls/Kick-artig, b = Backbeat, s = Shaker/Hats, o = Offbeat, t = Timeline (Clave/Tresillo...), y = Synkope
  const RAW = {
    trap: { bpm: 140, sw: 0,
      p: "x... .... x..x ....|x... ..x. ..x. ....|x..x .... x... ..x.",
      b: ".... .... x... ....|.... .... x... ...x",
      s: "x.x. x.x. x.x. x.x.|xxxx xxxx xxxx xxxx|x.x. x.xx x.x. xxxx",
      o: ".... ..x. .... ..x.|.... .... ..x. ....",
      t: "x..x ..x. x..x ..x.|x..x ..x. .... x.x.",
      y: "..x. ...x ..x. ...x|.x.. ..x. ...x ..x." },
    drill: { bpm: 142, sw: 0,
      p: "x... ...x ..x. ....|x... .... .x.. x...",
      b: ".... .... x... ....|.... .... x... ..x.",
      s: "x.xx x.x. x.xx x.x.|x.x. xx.x x.x. xx.x",
      o: ".... .... .... ..x.|.... ...x .... ....",
      t: "x..x ..x. ..x. ....|..x. x..x ..x. ....",
      y: ".... .x.. ...x ..x.|..x. .... .x.. x..x" },
    afro: { bpm: 104, sw: 10,
      p: "x... ..x. x... ..x.|x..x ..x. x..x ..x.",
      b: ".... x... .... x...|.... x..x .... x...",
      s: "xxxx xxxx xxxx xxxx|x.xx x.xx x.xx x.xx|x.x. x.x. x.x. x.x.",
      o: "..x. ..x. ..x. ..x.|.x.x .... .x.x ....",
      t: "x..x ..x. x..x ..x.|x..x ..x. ..x. x...",
      y: "..x. x..x ..x. x...|x.x. ..x. x... ..x." },
    amapiano: { bpm: 112, sw: 15,
      p: "x... x... x... x...|x... x... x... x..x",
      b: ".... .... x... ....|.... x... .... x...",
      s: "..x. ..x. ..x. ..x.|x.xx .xx. x.xx .xx.",
      o: ".x.. .x.. .x.. .x..|..x. .... ..x. ....",
      t: "x..x ..x. .x.. x...|x..x ..x. ...x ..x.",
      y: "...x ..x. ..x. .x..|x..x .... x..x ..x." },
    reggaeton: { bpm: 94, sw: 0,
      p: "x... x... x... x...|x... x... x... x..x",
      b: "...x ..x. ...x ..x.|...x ..x. ...x ..xx",
      s: "x.xx x.xx x.xx x.xx|x.x. x.x. x.x. x.x.",
      o: "..x. ..x. ..x. ..x.",
      t: "x..x ..x. x..x ..x.",
      y: ".... ..x. .... ..x.|..x. .... ...x ..x." },
    dancehall: { bpm: 100, sw: 5,
      p: "x... .x.. x... .x..|x..x ..x. x..x ..x.",
      b: "...x ..x. ...x ..x.|.... .x.. ...x ..x.",
      s: "x.x. x.x. x.x. x.x.|xxxx xxxx xxxx xxxx",
      o: ".x.. .x.. .x.. .x..|..x. ..x. ..x. ..x.",
      t: "x..x ..x. x... ..x.|x..x .... x..x ....",
      y: "...x ..x. ...x ...x|..x. .... ..x. x..." },
    baile: { bpm: 130, sw: 0,
      p: "x..x ..x. x..x ..x.|x..x .x.. x..x .x..",
      b: "..x. .... ..x. ....|.... x... .... x...",
      s: "x.xx x.xx x.xx x.xx|xxxx xxxx xxxx xxxx",
      o: "..x. ..x. ..x. ..x.",
      t: "x..x ..x. x..x ..x.",
      y: ".x.. x..x ..x. x..x|..x. ..x. x..x ..x." },
    jersey: { bpm: 140, sw: 0,
      p: "x..x ..x. ..x. ..x.|x..x ..x. x..x ....",
      b: ".... x... .... x...|.... x... ..x. x..x",
      s: "x.x. x.x. x.x. x.x.|xxxx xxxx xxxx xxxx",
      o: "..x. ..x. ..x. ..x.",
      t: "x..x ..x. x..x ..x.",
      y: "...x .x.. ...x .x..|..x. ..x. x..x ...x" },
    boombap: { bpm: 90, sw: 40,
      p: "x... ..x. ..x. ....|x... .... x.x. ....",
      b: ".... x... .... x...|.... x... .... x..x",
      s: "x.x. x.x. x.x. x.x.|x.x. x.x. x.x. xxx.",
      o: ".... .... .... ..x.|.... .... .... ...x",
      t: "x... ..x. .x.. ..x.|x..x .... x..x ....",
      y: ".... ...x ..x. ....|.... ..x. ...x ...." },
    lofi: { bpm: 76, sw: 45,
      p: "x... .... ..x. ....|x... ..x. .... .x..",
      b: ".... x... .... x...|.... x... .... x..x",
      s: "x... x... x... x...|x.x. x.x. x.x. x.x.",
      o: ".... .... .... ..x.|.... ..x. .... ....",
      t: "..x. .... x... ..x.|x... ..x. ...x ....",
      y: ".... .x.. ...x ....|..x. ...x .... .x.." },
    house: { bpm: 124, sw: 12,
      p: "x... x... x... x...|x... x... x... x..x",
      b: ".... x... .... x...|.... x... .... x..x",
      s: "x.x. x.x. x.x. x.x.|xxxx xxxx xxxx xxxx|.xx. .xx. .xx. .xx.",
      o: "..x. ..x. ..x. ..x.",
      t: "..x. x..x ..x. x...|x..x ..x. ..x. x..x",
      y: ".x.. ..x. .x.. ..x.|..x. ...x ..x. .x.." },
    latin: { bpm: 100, sw: 5,
      p: "..x. ...x ..x. .xx.|..x. x... ..x. .x.x",
      b: "...x ..x. ...x ....|...x .... ...x ..x.",
      s: "x.xx .x.x x.x. x.x.|x.xx .x.x x.x. xxx.",
      o: "..x. ..x. ..x. ..x.",
      t: "x..x ..x. ..x. x...|x..x ...x ..x. x...|..x. x... x..x ..x.",
      y: ".x.. ..x. .x.. x...|..x. .x.. .... x.x." },
    rnb: { bpm: 88, sw: 30,
      p: "x... .... ..x. ....|x... ..x. ..x. ....",
      b: ".... x... .... x...|.... x... .... x..x",
      s: "x.x. x.x. x.x. x.x.|x.xx x.x. x.xx x.x.",
      o: ".... ..x. .... ..x.|.... .... ..x. ....",
      t: "x... ..x. x... .x..|..x. x... ..x. ...x",
      y: ".... ..x. ...x ....|..x. .... .x.. ..x." },
  };
  const parseV = str => str.split("|").map(v => v.replace(/\s/g, "").split("").map(c => c === "X" ? 2 : c === "x" ? 1 : 0));
  const GEN = {};
  GENRE_KEYS.forEach(k => {
    const g = RAW[k]; GEN[k] = { bpm: g.bpm, sw: g.sw };
    ["p", "b", "s", "o", "t", "y"].forEach(r => GEN[k][r] = parseV(g[r]));
  });

  // Rollen: Reihenfolge = Priorität bei weniger als 10 Spuren
  const ROLE_ORDER = ["pulse", "back", "shaker", "timeline", "offbeat", "synco", "ghost", "roll", "accent", "ear"];
  const ROLE_KEY = { pulse: "p", back: "b", shaker: "s", offbeat: "o", timeline: "t", synco: "y" };
  const ROLE_NAME = { pulse: "Main pulse", back: "Backbeat", shaker: "Shaker 16ths", timeline: "Timeline / clave", offbeat: "Offbeat", synco: "Syncopation", ghost: "Ghost notes", roll: "Rolls / triplet feel", accent: "Accents", ear: "Ear candy" };
  const ROLE_VOL = { pulse: 8, back: 7, shaker: 5, timeline: 6, offbeat: 5, synco: 6, ghost: 4, roll: 5, accent: 7, ear: 5 };   // Start-Lautstärke 0-9
  const HIGH = new Set(["shaker", "offbeat", "ear", "ghost", "roll"]), LOW = new Set(["pulse", "synco", "timeline"]);

  const rolesFor = (seed, n) => {
    const r = mulberry32((seed ^ 0x5bd1e995) >>> 0), a = ROLE_ORDER.slice(0, n);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // ---------- Einstellungen ----------
  const state = { bpm: 140, swing: 0, genre: "trap", mood: "bouncy", density: 1, complexity: 1, humanize: 20, seed: 1 };
  const autoBpm = () => clamp(GEN[state.genre].bpm + MOOD[state.mood].bpm, 60, 200);
  const autoSwing = () => clamp(GEN[state.genre].sw + MOOD[state.mood].sw, 0, 60);

  // ---------- Generator ----------
  const sameBar = (a, b) => a.every((v, i) => v === b[i]);

  // Grundmuster für Rollen ohne feste Genre-Vorlage (Ghost, Rolls, Accent, Ear Candy)
  function baseBar(role, r, dEff) {
    const a = Array(16).fill(0);
    const pickN = (pool, n, val) => { const p = pool.slice(); for (let k = 0; k < n && p.length; k++) a[p.splice(Math.floor(r() * p.length), 1)[0]] = val; };
    if (role === "ghost") {
      for (let i = 0; i < 16; i++) { const p = (i % 4 === 3 ? 0.4 : i % 2 ? 0.25 : 0.08) * (0.5 + Math.max(0, dEff) * 0.6); if (r() < p) a[i] = 1; }
    } else if (role === "accent") {
      pickN([0, 6, 10, 12, 14], 2 + (dEff > 1.3 ? 1 : 0), 2);
    } else if (role === "ear") {
      pickN([1, 3, 5, 7, 9, 11, 13, 15], 1 + (r() < 0.5 ? 1 : 0) + (dEff > 1.5 ? 1 : 0), 1);
    } else if (role === "roll") {
      // Wirbel: kurze Bursts, die zum Ende der Zählzeit hin lauter werden
      const starts = [12, 6, 14, 9].slice(0, dEff > 1.4 ? 2 : 1);
      starts.forEach(s => { const len = s === 12 ? 4 : 3; for (let k = 0; k < len && s + k < 16; k++) a[s + k] = k === len - 1 ? 2 : 1; });
    }
    return a;
  }

  // Ein Takt (16 Schritte) formen: Dichte + Mood
  function shape(b, role, r, dEff, mood) {
    const o = b.slice(), high = HIGH.has(role), low = LOW.has(role);
    const anchor = i => (role === "pulse" && i === 0) || role === "back";
    // ausdünnen
    const pRem = clamp((1 - dEff) * 0.3, 0, 0.6) + (mood === "dark" && high ? 0.4 : 0) + (mood === "tribal" && (role === "shaker" || role === "offbeat") ? 0.35 : 0);
    if (pRem > 0) for (let i = 0; i < 16; i++) if (o[i] && !anchor(i) && r() < pRem) o[i] = 0;
    // auffüllen (nicht beim Backbeat)
    if (role !== "back" && role !== "ear") {
      let pAdd = clamp((dEff - 1) * 0.13, 0, 0.3) * (high || role === "shaker" ? 1.2 : 0.8);
      if (mood === "dark" && high) pAdd *= 0.3;
      if (pAdd > 0) for (let i = 0; i < 16; i++) if (!o[i] && (i % 2 || i % 4 === 2) && r() < pAdd * (i % 2 ? 1 : 0.7)) o[i] = 1;
    }
    // Mood-Färbung
    if (mood === "chill") {
      if (role === "shaker" || role === "ghost" || role === "offbeat") for (let i = 1; i < 16; i += 2) if (o[i] && r() < 0.65) o[i] = 0;
      for (let i = 0; i < 16; i++) if (o[i] === 2 && r() < 0.8) o[i] = 1;
    } else if (mood === "energetic") {
      if (role === "shaker") for (let i = 1; i < 16; i += 2) if (!o[i] && r() < 0.55) o[i] = 1;
      if (role === "shaker" || role === "offbeat" || role === "accent") for (let i = 2; i < 16; i += 4) if (o[i]) o[i] = 2;
      if (role === "pulse") o[0] = 2;
    } else if (mood === "bouncy") {
      if (role === "offbeat" || role === "synco" || role === "timeline" || role === "pulse") for (let i = 2; i < 16; i += 4) { if (!o[i] && r() < 0.2) o[i] = 1; if (o[i]) o[i] = 2; }
    } else if (mood === "dark") {
      if (low && r() < 0.35) o[[3, 6, 10, 11, 14][Math.floor(r() * 5)]] = 1;
      if (high) for (let i = 0; i < 16; i++) if (o[i] === 2) o[i] = 1;
    } else if (mood === "tribal") {
      if (low) for (let k = 0; k < 2; k++) if (r() < 0.3) o[[3, 6, 9, 10, 12][Math.floor(r() * 5)]] = 1;
    }
    if (!o.some(Boolean)) o[role === "ear" ? 13 : 2] = 1;
    return o;
  }

  // Takt 2 als Variation von Takt 1 (verschobene Schläge, Fill am Ende)
  function vary(b2, b1, role, r, cI, mood) {
    const anchor = i => (role === "pulse" && i === 0) || role === "back";
    const hyp = mood === "hypnotic", hot = mood === "energetic" ? 1.25 : mood === "chill" ? 0.55 : 1;
    if (hyp) {
      if (r() < 0.3) { const i = [15, 14, 13][Math.floor(r() * 3)]; b2[i] = b2[i] ? 0 : 1; }
    } else {
      const pD = [0.05, 0.16, 0.34][cI];
      for (let i = 0; i < 16; i++) if (b2[i] && !anchor(i) && r() < pD) {
        const j = i + (r() < 0.5 ? -1 : 1);
        if (j >= 0 && j < 16 && !b2[j]) { b2[j] = b2[i]; b2[i] = 0; }
      }
      if (r() < [0.4, 0.75, 0.95][cI] * hot) {                 // Fill im letzten Viertel
        if (role === "shaker" || role === "ghost" || role === "roll") {
          for (let k = 12; k < 16; k++) if (!b2[k] && r() < 0.65) b2[k] = 1;
          b2[15] = 2;
        } else {
          const n = 1 + (r() < 0.4 ? 1 : 0), pool = [11, 13, 14, 15];
          for (let k = 0; k < n; k++) b2[pool.splice(Math.floor(r() * pool.length), 1)[0]] = 1;
        }
      }
      if (cI > 0 && r() < 0.3) {                                // ein Schlag in der Mitte weglassen
        const i = 8 + Math.floor(r() * 4); if (b2[i] && !anchor(i)) b2[i] = 0;
      }
    }
    if (!hyp && sameBar(b1, b2)) { const i = [15, 14, 13, 11, 10][Math.floor(r() * 5)]; b2[i] = b2[i] ? 0 : 1; }
    if (!b2.some(Boolean)) b2[2] = 1;
    return b2;
  }

  // Eine komplette Zeile (32 Schritte) für eine Rolle erzeugen; nonce 0 = Gesamt-Generate
  function genRow(role, ti, nonce) {
    const G = GEN[state.genre], r = mulberry32(h32(state.seed, ti, nonce));
    const cI = state.complexity, mood = state.mood, dEff = state.density + MOOD[mood].d, hyp = mood === "hypnotic";
    // Polyrhythmus 3 gegen 4 (läuft über beide Takte durch)
    if (role === "roll" && (mood === "tribal" || (["afro", "latin", "amapiano"].includes(state.genre) && r() < 0.5))) {
      const a = Array(STEPS).fill(0);
      for (let i = 0; i < STEPS; i += 3) a[i] = i % 12 === 0 ? 2 : 1;
      if (dEff < 1) for (let i = 3; i < STEPS; i += 6) a[i] = 0;
      return a;
    }
    const vs = ROLE_KEY[role] ? G[ROLE_KEY[role]] : null;
    let b1, b2;
    if (vs) {
      const i1 = cI === 0 || hyp ? 0 : Math.floor(r() * vs.length);
      b1 = vs[i1].slice();
      b2 = vs.length > 1 && cI > 0 && !hyp && r() < 0.65 ? vs[(i1 + 1 + Math.floor(r() * (vs.length - 1))) % vs.length].slice() : b1.slice();
    } else {
      b1 = baseBar(role, r, dEff);
      b2 = hyp ? b1.slice() : baseBar(role, r, dEff);
    }
    b1 = shape(b1, role, r, dEff, mood);
    b2 = hyp ? b1.slice() : shape(b2, role, r, dEff, mood);
    if (role !== "ear") b2 = vary(b2, b1, role, r, cI, mood);
    else if (hyp) b2 = b1.slice();
    return b1.concat(b2);
  }

  // ---------- Teilen-Link ----------
  // Neues Format (Version "p1", nur Zeichen 0-9 a-z und "."), z. B.
  // p1.<bpm>.<swing>.<genre>.<mood>.<density>.<complexity>.<humanize>.<seed36>.<n>.<vols>.<mutes>.<files>.<rows>
  //   vols  = n Ziffern 0-9, mutes = n x 0/1, files = n x 7 Zeichen (FNV-Hash des Dateinamens, base36)
  //   rows  = n x 10 Zeichen: 32 Schritte (0/1/2) als Zahl zur Basis 3, dann base36
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36).padStart(7, "0"); };
  const pack = row => { let n = 0; for (let i = 0; i < STEPS; i++) n = n * 3 + (row[i] || 0); return n.toString(36).padStart(10, "0"); };
  const unpack = s => { let n = parseInt(s, 36) || 0; const out = Array(STEPS); for (let i = STEPS - 1; i >= 0; i--) { out[i] = n % 3; n = Math.floor(n / 3); } return out; };

  function encodeHash(s, trs) {
    return ["p1", s.bpm, s.swing, GENRE_KEYS.indexOf(s.genre), MOOD_KEYS.indexOf(s.mood), s.density, s.complexity, s.humanize,
      (s.seed >>> 0).toString(36), trs.length,
      trs.map(t => t.vol).join(""), trs.map(t => t.mute ? 1 : 0).join(""),
      trs.map(t => fnv(t.file)).join(""), trs.map(t => pack(t.steps)).join("")].join(".");
  }

  // Liefert { settings, specs:[{h,vol,mute,steps}] } oder null. Altes Format ("1-140-0-...") wird übernommen.
  function decodeHash(str) {
    try {
      if (str.startsWith("p1.")) {
        const p = str.split("."), n = clamp(parseInt(p[9], 10), 1, MAX_TRACKS);
        if (p.length < 14 || p[10].length < n || p[11].length < n || p[12].length < n * 7 || p[13].length < n * 10) return null;
        const g = GENRE_KEYS[parseInt(p[3], 10)], m = MOOD_KEYS[parseInt(p[4], 10)];
        if (!g || !m) return null;
        const settings = { bpm: clamp(parseInt(p[1], 10), 60, 200), swing: clamp(parseInt(p[2], 10), 0, 60), genre: g, mood: m,
          density: clamp(parseInt(p[5], 10), 0, 2), complexity: clamp(parseInt(p[6], 10), 0, 2), humanize: clamp(parseInt(p[7], 10), 0, 100),
          seed: (parseInt(p[8], 36) >>> 0) || 1 };
        const specs = [];
        for (let i = 0; i < n; i++) specs.push({ h: p[12].slice(i * 7, i * 7 + 7), vol: clamp(parseInt(p[10][i], 10), 0, 9), mute: p[11][i] === "1", steps: unpack(p[13].slice(i * 10, i * 10 + 10)) });
        return { old: false, settings, specs };
      }
      // Altes Beat-Lab-Format: 7 Zeilen à 16 Schritte -> erste 7 Spuren, auf 32 Schritte verdoppelt
      const [v, bpm, swing, , , vol, mute, steps] = str.split("-");
      if (v !== "1" || !steps) return null;
      const rows = steps.split("."), specs = [];
      for (let i = 0; i < 7; i++) {
        const r16 = (rows[i] || "").padEnd(16, "0").slice(0, 16).split("").map(x => (+x > 0 ? 1 : 0));
        specs.push({ h: null, vol: clamp(/\d/.test((vol || "")[i] || "") ? +vol[i] : 5, 0, 9), mute: (mute || "")[i] === "1", steps: r16.concat(r16) });
      }
      return { old: true, settings: { bpm: clamp(+bpm, 60, 200), swing: clamp(Math.round((+swing || 0) * 0.6), 0, 60), genre: "trap", mood: "bouncy", density: 1, complexity: 1, humanize: 20, seed: newSeed() }, specs };
    } catch (_) { return null; }
  }
  // ==PURE-END==

  /* ===================================================================
     SOUND-POOL (Ordner "perclab" oder Fallback) und Spuren
     =================================================================== */
  const SB = window.BEATLAB_SOUND_BASE || `${cfg.SUPABASE_URL}/storage/v1/object/public/coverart-products/beatlab/beatlab-sounds%202/`;
  const FALLBACK = ["kick-1-anvil", "kick-2-titan", "kick-3-boulder", "snare-1-whip", "snare-2-crack", "snare-3-blaze", "clap-1-fireworks", "clap-2-velvet", "clap-3-ritual",
    "hat-1-sparrow", "hat-2-ticker", "hat-3-glitter", "openhat-1-keeper", "openhat-2-dinged", "openhat-3-sniff", "perc-1-pebble", "perc-2-bamboo", "perc-3-marble",
    "808-1-gravity", "808-2-monsoon", "808-3-voltage"].map(n => n + ".wav");
  const AUDIO_RE = /\.(wav|mp3|ogg|aif|aiff|flac)$/i;

  let pool = [], poolMode = "folder", ready = false;
  const bad = new Set();                                   // Sounds, die nicht laden
  const fileUrl = f => poolMode === "folder"
    ? `${cfg.SUPABASE_URL}/storage/v1/object/public/coverart-products/perclab/${encodeURIComponent(f)}` : SB + encodeURIComponent(f);
  // Anzeigename: Endung weg, _ und - zu Leerzeichen, "perc"-Präfix weg, Title Case, max. 18 Zeichen
  function niceName(f) {
    let n = f.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^(perc|percussion)\s+/i, "");
    n = n.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
    return (n.length > 18 ? n.slice(0, 18).trim() : n) || f.slice(0, 18);
  }
  const poolEntry = f => pool.find(p => p.file === f);
  const nameOf = f => (poolEntry(f) || { name: niceName(f) }).name;

  async function loadPool() {
    let files = [];
    try {
      const db = (window.YLY && window.YLY.db) || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await db.storage.from("coverart-products").list("perclab", { limit: 1000, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      files = (data || []).map(x => x.name).filter(n => n && n !== ".emptyFolderPlaceholder" && AUDIO_RE.test(n));
    } catch (e) { console.warn("Percussion Lab: sound list failed, using fallback", e && e.message); }
    if (files.length) poolMode = "folder"; else { files = FALLBACK; poolMode = "fallback"; }
    pool = files.map(f => ({ file: f, name: niceName(f), h: fnv(f) }));
  }

  // Mood beeinflusst die Sound-Auswahl leicht (Namen mit passenden Stichworten sind wahrscheinlicher)
  const MOOD_KW = { tribal: /tom|conga|bongo|djembe|drum|log|tabla|timbale|talking|cajon/i, dark: /low|deep|tom|log|kick|808|dark|boom/i,
    chill: /shaker|rim|click|soft|wood|block|egg/i, energetic: /clap|snap|shaker|cowbell|hat|tamb/i, bouncy: /cowbell|clave|block|snap|bell/i };
  function pickDistinct(n, exclude) {
    const taken = new Set(exclude || []), out = [], kw = MOOD_KW[state.mood];
    let cand = pool.filter(p => !bad.has(p.file));
    while (out.length < n) {
      const free = cand.filter(p => !taken.has(p.file));
      if (!free.length) break;
      const w = free.map(p => kw && kw.test(p.file) ? 3 : 1);
      let x = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < free.length - 1 && (x -= w[k]) >= 0) k++;
      out.push(free[k].file); taken.add(free[k].file);
    }
    return out;
  }
  const trackCount = () => Math.min(MAX_TRACKS, pool.filter(p => !bad.has(p.file)).length);

  // tracks: { file, vol 0-9, mute, solo, steps[32] }
  let tracks = [];
  const roles = () => rolesFor(state.seed, tracks.length);
  const blankSteps = () => Array(STEPS).fill(0);

  function generateAll(newSeedToo) {
    if (newSeedToo) {
      state.seed = newSeed();
      if (!touched.bpm) state.bpm = autoBpm();
      if (!touched.swing) state.swing = autoSwing();
    }
    const rl = roles();
    tracks.forEach((t, i) => {
      t.steps = genRow(rl[i], i, 0);
      if (newSeedToo) { t.vol = ROLE_VOL[rl[i]]; t.mute = false; t.solo = false; }
    });
  }
  const touched = { bpm: false, swing: false };           // vom Nutzer angefasst -> nicht automatisch überschreiben

  // Spuren aus Hash-Vorgaben aufbauen: fehlende/doppelte Sounds werden ersetzt
  function buildTracks(specs) {
    const n = Math.min(MAX_TRACKS, pool.length), used = new Set(), out = [];
    for (let i = 0; i < n; i++) {
      const sp = specs[i] || { vol: 6, mute: false, steps: blankSteps() };
      let f = null;
      if (sp.h) { const e = pool.find(p => p.h === sp.h && !used.has(p.file) && !bad.has(p.file)); if (e) f = e.file; }
      if (!f) f = pickDistinct(1, used)[0];
      if (!f) break;
      used.add(f);
      out.push({ file: f, vol: sp.vol, mute: !!sp.mute, solo: false, steps: sp.steps.slice(0, STEPS) });
    }
    return out;
  }

  /* ===================================================================
     AUDIO
     =================================================================== */
  const VEL = [0, 0.66, 1];                                // Schrittwert -> Lautstärke (an / Akzent)
  const volGain = v => Math.pow(v / 9, 1.5);
  let ctx = null, master = null;
  const trackGain = [], rawCache = {}, bufCache = {};
  let status = "";

  function ensureAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();           // sanfter Limiter gegen Übersteuern
    comp.threshold.value = -8; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    for (let i = 0; i < MAX_TRACKS; i++) { const g = ctx.createGain(); g.connect(master); trackGain.push(g); }
    updateGains();
    return ctx;
  }
  const anySolo = () => tracks.some(t => t.solo);
  const effGain = t => t.mute || (anySolo() && !t.solo) ? 0 : volGain(t.vol);
  function updateGains() { if (ctx) tracks.forEach((t, i) => { trackGain[i].gain.value = effGain(t); }); }

  // Download vorab (ohne AudioContext), Decodieren erst bei Bedarf
  const fetchRaw = f => rawCache[f] || (rawCache[f] = fetch(fileUrl(f)).then(r => { if (!r.ok) throw new Error("missing " + f); return r.arrayBuffer(); }));
  const prefetch = () => tracks.forEach(t => { if (!bufCache[t.file]) fetchRaw(t.file).catch(() => {}); });
  async function decodeFile(f) {
    if (bufCache[f]) return;
    const ab = await fetchRaw(f);
    bufCache[f] = await ctx.decodeAudioData(ab.slice(0));
  }

  // Nur die zugewiesenen Sounds laden; fehlerhafte werden durch andere ersetzt
  let loadChain = Promise.resolve();
  async function loadRun() {
    ensureAudio();
    for (let attempt = 0; attempt < 8; attempt++) {
      const need = [...new Set(tracks.map(t => t.file).filter(f => !bufCache[f]))];
      if (!need.length) { if (status.startsWith("Loading")) setStatus(""); return; }
      setStatus("Loading sounds …");
      const res = await Promise.allSettled(need.map(decodeFile));
      const failed = need.filter((f, k) => res[k].status === "rejected");
      if (!failed.length) { setStatus(""); return; }
      failed.forEach(f => { bad.add(f); delete rawCache[f]; });
      // kaputte Sounds durch andere, ungenutzte ersetzen (sonst Spur entfernen)
      tracks.forEach(t => { if (bad.has(t.file)) { const f = pickDistinct(1, tracks.map(x => x.file))[0]; if (f) t.file = f; } });
      tracks = tracks.filter(t => !bad.has(t.file));
      renderGrid(); saveHash();
    }
    if (!tracks.length) { setStatus("Sounds could not be loaded. Please reload the page.", true); throw new Error("no sounds"); }
  }
  function ensureLoaded() {
    const p = loadChain.then(loadRun);
    loadChain = p.catch(() => {});
    return p;
  }

  // Einen Schlag planen (auch für den Offline-Export)
  function playHit(ac, dest, buf, when, vel) {
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = vel;
    src.connect(g).connect(dest); src.start(Math.max(when, 0));
  }
  const swingOffset = (step, stepDur) => step % 2 === 1 ? (state.swing / 100) * 0.55 * stepDur : 0;

  // ---------- Transport (Look-ahead-Scheduler) ----------
  let playing = false, timer = null, nextTime = 0, curStep = 0;
  const queue = [];

  function scheduleStep(step, time) {
    const hum = state.humanize / 100;
    tracks.forEach((t, i) => {
      const v = t.steps[step], buf = bufCache[t.file];
      if (!v || !buf) return;
      let when = time, vel = VEL[v];
      if (hum) { when += (Math.random() - 0.5) * 2 * hum * 0.012; vel *= 1 + (Math.random() - 0.5) * 2 * hum * 0.22; }
      playHit(ctx, trackGain[i], buf, Math.max(when, ctx.currentTime), Math.min(vel, 1.1));
    });
  }
  function tickScheduler() {
    const stepDur = 60 / state.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      const t = nextTime + swingOffset(curStep, stepDur);
      scheduleStep(curStep, t);
      queue.push({ step: curStep, time: t });
      nextTime += stepDur; curStep = (curStep + 1) % STEPS;
    }
  }
  let cols = [], nowStep = -1;
  function setNow(s) {
    if (nowStep >= 0 && cols[nowStep]) cols[nowStep].forEach(c => c.classList.remove("now"));
    nowStep = s;
    if (s >= 0 && cols[s]) cols[s].forEach(c => c.classList.add("now"));
  }
  function drawPlayhead() {
    if (!playing) return;
    let s = null;
    while (queue.length && queue[0].time <= ctx.currentTime) s = queue.shift().step;
    if (s !== null) setNow(s);
    requestAnimationFrame(drawPlayhead);
  }
  async function play() {
    if (!ready || !tracks.length) return;
    ensureAudio();
    if (ctx.state === "suspended") await ctx.resume();
    try { await ensureLoaded(); } catch (_) { return; }
    if (playing) return;
    playing = true; curStep = 0; queue.length = 0;
    nextTime = ctx.currentTime + 0.05;
    tickScheduler(); timer = setInterval(tickScheduler, 25);
    $("bl-play").classList.add("playing"); $("bl-play").setAttribute("aria-label", "Stop");
    requestAnimationFrame(drawPlayhead);
  }
  function stop() {
    playing = false; clearInterval(timer);
    setNow(-1);
    $("bl-play").classList.remove("playing"); $("bl-play").setAttribute("aria-label", "Play");
  }
  const toggle = () => playing ? stop() : play();

  // Vorhören beim Klicken (auch während der Wiedergabe)
  async function preview(i, v) {
    const t = tracks[i]; if (!t) return;
    try { ensureAudio(); if (ctx.state === "suspended") await ctx.resume(); await ensureLoaded(); } catch (_) { return; }
    const buf = bufCache[t.file]; if (!buf || !tracks[i]) return;
    playHit(ctx, trackGain[i], buf, ctx.currentTime + 0.01, VEL[v || 1]);
  }

  /* ===================================================================
     OBERFLÄCHE
     =================================================================== */
  const ICON_SWAP = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg>`;
  const ICON_REGEN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`;

  function cellsHtml(ti) {
    const t = tracks[ti], nm = esc(nameOf(t.file));
    let h = "";
    for (let bar = 0; bar < 2; bar++) {
      h += `<div class="pl-bar">`;
      for (let be = 0; be < 4; be++) {
        h += `<div class="pl-beat">`;
        for (let k = 0; k < 4; k++) {
          const s = bar * 16 + be * 4 + k, v = t.steps[s];
          h += `<button type="button" class="pl-cell${v ? " on" : ""}${v === 2 ? " acc" : ""}" data-t="${ti}" data-s="${s}" aria-pressed="${!!v}" aria-label="${nm} step ${s + 1}"></button>`;
        }
        h += `</div>`;
      }
      h += `</div>`;
    }
    return h;
  }
  function renderGrid() {
    const rl = roles();
    const ruler = [0, 1].map(b => `<div class="pl-bar">${[0, 1, 2, 3].map(be => `<div class="pl-beat">${[0, 1, 2, 3].map(k => `<span>${k === 0 ? b * 4 + be + 1 : ""}</span>`).join("")}</div>`).join("")}</div>`).join("");
    $("pl-grid").innerHTML = `<div class="pl-row pl-ruler"><div class="pl-head"></div><div class="pl-cells">${ruler}</div></div>` +
      tracks.map((t, i) => `
      <div class="pl-row" data-row="${i}">
        <div class="pl-head">
          <button type="button" class="pl-sound" data-act="sound" data-t="${i}" title="Click to swap the sound (${esc(ROLE_NAME[rl[i]] || "")})"><span class="pl-sname">${esc(nameOf(t.file))}</span>${ICON_SWAP}</button>
          <button type="button" class="pl-mini pl-mute${t.mute ? " on" : ""}" data-act="mute" data-t="${i}" aria-pressed="${t.mute}" title="Mute">M</button>
          <button type="button" class="pl-mini pl-solo${t.solo ? " on" : ""}" data-act="solo" data-t="${i}" aria-pressed="${t.solo}" title="Solo">S</button>
          <input type="range" class="pl-vol" data-t="${i}" min="0" max="9" step="1" value="${t.vol}" aria-label="${esc(nameOf(t.file))} volume">
          <button type="button" class="pl-mini gen-btn pl-regen" data-act="regen" data-t="${i}" aria-label="Regenerate this row" title="Regenerate this row">${ICON_REGEN}</button>
        </div>
        <div class="pl-cells">${cellsHtml(i)}</div>
      </div>`).join("");
    cols = Array.from({ length: STEPS }, (_, s) => [...$("pl-grid").querySelectorAll(`.pl-cell[data-s="${s}"]`)]);
    nowStep = -1;
  }

  const seg = (id, names, key) => {
    $(id).innerHTML = names.map((n, i) => `<button type="button" role="radio" data-v="${i}" aria-checked="false">${n}</button>`).join("");
    $(id).onclick = e => {
      const b = e.target.closest("button[data-v]"); if (!b) return;
      state[key] = +b.dataset.v; regenKeepSeed();
    };
  };
  function renderControls() {
    $("pl-genre").value = state.genre; $("pl-mood").value = state.mood;
    [["pl-dens", state.density], ["pl-cx", state.complexity]].forEach(([id, v]) =>
      $(id).querySelectorAll("button").forEach(b => { const on = +b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); }));
    $("pl-bpm").value = state.bpm; $("pl-bpm-val").textContent = state.bpm;
    $("pl-swing").value = state.swing; $("pl-swing-val").textContent = state.swing + "%";
    $("pl-hum").value = state.humanize; $("pl-hum-val").textContent = state.humanize + "%";
    $("pl-seed").textContent = (state.seed >>> 0).toString(36);
    updateGains();
  }
  const renderAll = () => { renderControls(); renderGrid(); saveHash(); };

  // Genre/Mood/Density/Complexity geändert: gleicher Seed, neues Muster
  function regenKeepSeed() {
    if (!ready) return;
    if (!touched.bpm) state.bpm = autoBpm();
    if (!touched.swing) state.swing = autoSwing();
    generateAll(false); renderAll();
  }

  let hashTimer = null;
  const currentHash = () => encodeHash(state, tracks);
  function saveHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => { if (!tracks.length) return; try { history.replaceState(null, "", "#b=" + currentHash()); } catch (_) {} }, 300);
  }
  const shareUrl = () => `${location.origin}${location.pathname}#b=${currentHash()}`;
  function setStatus(msg, bad) { status = msg; const el = $("bl-status"); el.textContent = msg; el.classList.toggle("danger", !!bad); }

  // Schritt setzen und Zelle aktualisieren
  function setCell(ti, si, v, doPreview) {
    const t = tracks[ti]; if (!t || t.steps[si] === v) return;
    t.steps[si] = v;
    const c = $("pl-grid").querySelector(`.pl-cell[data-t="${ti}"][data-s="${si}"]`);
    if (c) { c.classList.toggle("on", !!v); c.classList.toggle("acc", v === 2); c.setAttribute("aria-pressed", !!v); }
    if (v && doPreview) preview(ti, v);
  }

  // Sound einer Spur tauschen: zufälliger ungenutzter Sound, sonst Tausch mit einer anderen Spur
  function swapSound(i) {
    const t = tracks[i], used = tracks.map(x => x.file);
    const f = pickDistinct(1, used)[0];
    if (f) t.file = f;
    else if (tracks.length > 1) { let j; do j = Math.floor(Math.random() * tracks.length); while (j === i); [t.file, tracks[j].file] = [tracks[j].file, t.file]; }
    renderGrid(); saveHash(); prefetch();
    preview(i, 1);
  }
  function shuffleSounds() {
    if (!ready) return;
    const files = pickDistinct(tracks.length);
    tracks.forEach((t, i) => { if (files[i]) t.file = files[i]; });
    renderGrid(); saveHash(); prefetch();
    if (ctx) ensureLoaded().catch(() => {});
    setStatus("New sounds picked. The pattern stays.");
  }

  // ---------- Klicks im Raster ----------
  let mouseHandled = false, paintVal = null;
  const grid = $("pl-grid");
  grid.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const c = e.target.closest(".pl-cell"); if (!c) return;
    mouseHandled = true;
    const ti = +c.dataset.t, si = +c.dataset.s;
    paintVal = (tracks[ti].steps[si] + 1) % 3;
    setCell(ti, si, paintVal, true);
    e.preventDefault();
  });
  document.addEventListener("pointermove", e => {
    if (paintVal === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), c = el && el.closest && el.closest(".pl-cell");
    if (c) setCell(+c.dataset.t, +c.dataset.s, paintVal, false);
  });
  document.addEventListener("pointerup", () => {
    if (paintVal !== null) { paintVal = null; saveHash(); }
    setTimeout(() => { mouseHandled = false; }, 60);
  });
  grid.addEventListener("click", e => {
    const c = e.target.closest(".pl-cell");
    if (c) {                                                // Touch / Tastatur (Maus läuft über pointerdown)
      if (mouseHandled) return;
      const ti = +c.dataset.t, si = +c.dataset.s;
      setCell(ti, si, (tracks[ti].steps[si] + 1) % 3, true); saveHash(); return;
    }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const i = +b.dataset.t, t = tracks[i]; if (!t) return;
    if (b.dataset.act === "sound") swapSound(i);
    else if (b.dataset.act === "mute") { t.mute = !t.mute; b.classList.toggle("on", t.mute); b.setAttribute("aria-pressed", t.mute); updateGains(); saveHash(); }
    else if (b.dataset.act === "solo") { t.solo = !t.solo; b.classList.toggle("on", t.solo); b.setAttribute("aria-pressed", t.solo); updateGains(); }
    else if (b.dataset.act === "regen") { t.steps = genRow(roles()[i], i, 1 + Math.floor(Math.random() * 1e6)); renderGrid(); saveHash(); }
  });
  grid.addEventListener("input", e => {
    const r = e.target.closest(".pl-vol"); if (!r) return;
    tracks[+r.dataset.t].vol = +r.value; updateGains(); saveHash();
  });

  // ---------- Steuerelemente ----------
  $("pl-genre").innerHTML = GENRE_KEYS.map((k, i) => `<option value="${k}">${GENRE_NAMES[i]}</option>`).join("");
  $("pl-mood").innerHTML = MOOD_KEYS.map((k, i) => `<option value="${k}">${MOOD_NAMES[i]}</option>`).join("");
  seg("pl-dens", DENS_NAMES, "density"); seg("pl-cx", CX_NAMES, "complexity");
  $("pl-genre").onchange = e => { state.genre = e.target.value; regenKeepSeed(); };
  $("pl-mood").onchange = e => { state.mood = e.target.value; regenKeepSeed(); };
  $("pl-bpm").oninput = e => { state.bpm = +e.target.value; touched.bpm = true; $("pl-bpm-val").textContent = state.bpm; saveHash(); };
  $("pl-swing").oninput = e => { state.swing = +e.target.value; touched.swing = true; $("pl-swing-val").textContent = state.swing + "%"; saveHash(); };
  $("pl-hum").oninput = e => { state.humanize = +e.target.value; $("pl-hum-val").textContent = state.humanize + "%"; saveHash(); };
  $("bl-play").onclick = toggle;
  $("pl-gen").onclick = () => { if (!ready) return; generateAll(true); renderAll(); setStatus(""); };
  $("pl-shuffle").onclick = shuffleSounds;
  $("pl-clear").onclick = () => { tracks.forEach(t => t.steps = blankSteps()); renderGrid(); saveHash(); };
  document.addEventListener("keydown", e => {
    if (e.code !== "Space") return;
    const el = e.target, tag = el.tagName;
    if (el.isContentEditable || tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && !/range|checkbox/.test(el.type)) || (el.classList && el.classList.contains("pl-cell")) || document.querySelector("dialog[open]")) return;
    e.preventDefault(); toggle();
  });
  document.addEventListener("keyup", e => {                  // verhindert, dass ein fokussierter Button zusätzlich "klickt"
    if (e.code === "Space" && e.target.tagName === "BUTTON" && !e.target.classList.contains("pl-cell") && !document.querySelector("dialog[open]")) e.preventDefault();
  });

  // ---------- Teilen ----------
  $("bl-share").onclick = async () => {
    if (!tracks.length) return;
    const url = shareUrl();
    try {
      if (navigator.share && matchMedia("(max-width: 760px)").matches) { await navigator.share({ title: "My percussion loop – YARDSLOVESYOU Percussion Loop Lab", url }); return; }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied! Send it to a friend – they'll hear exactly this loop.");
    } catch (_) { prompt("Copy this link:", url); }
  };

  // ---------- MIDI-Export (2 Takte, eine Note pro Spur, GM-Percussion ab 60) ----------
  function midiFile() {
    const PPQ = 96, T16 = PPQ / 4, ev = [];
    const swingTicks = s => s % 2 === 1 ? Math.round((state.swing / 100) * 0.55 * T16) : 0;
    for (let s = 0; s < STEPS; s++) tracks.forEach((t, i) => {
      const v = t.steps[s]; if (!v || t.mute || (anySolo() && !t.solo)) return;
      const vel = Math.round(clamp((v === 2 ? 112 : 84) * (0.45 + 0.55 * t.vol / 9), 20, 127));
      const at = s * T16 + swingTicks(s), note = 60 + i;
      ev.push([at, [0x99, note, vel]], [at + Math.max(4, Math.round(T16 * 0.8)), [0x89, note, 0]]);
    });
    ev.sort((a, b) => a[0] - b[0] || (a[1][0] & 0xf0) - (b[1][0] & 0xf0));
    const vlq = n => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
    const tempo = Math.round(60000000 / state.bpm);
    const name = [..."YARDSLOVESYOU Percussion Loop Lab"].map(c => c.charCodeAt(0));
    const data = [0x00, 0xff, 0x03, name.length, ...name, 0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0x00, 0xff, 0x58, 0x04, 4, 2, 24, 8];
    let last = 0;
    ev.forEach(([tick, bytes]) => { data.push(...vlq(tick - last), ...bytes); last = tick; });
    const end = STEPS * T16;                                // Ende exakt nach 2 Takten (sauberer Loop)
    data.push(...vlq(Math.max(0, end - last)), 0xff, 0x2f, 0x00);
    const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const bytes = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (PPQ >> 8) & 255, PPQ & 255, 0x4d, 0x54, 0x72, 0x6b, ...u32(data.length), ...data];
    return new Blob([new Uint8Array(bytes)], { type: "audio/midi" });
  }
  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileBase = () => `yardslovesyou-percussion-loop-${state.bpm}bpm`;
  $("bl-midi").onclick = () => {
    if (!tracks.length) return;
    download(midiFile(), fileBase() + ".mid");
    setStatus(`MIDI downloaded – 2 bars, one note per track (GM percussion, channel 10, notes 60-${59 + tracks.length}).`);
  };

  // ---------- WAV- und Stems-Export (Loop über OfflineAudioContext) ----------
  async function renderMix(onlyIdx) {
    const SR = 44100, stepDur = 60 / state.bpm / 4, loopSamples = Math.round(STEPS * stepDur * SR);
    const off = new OfflineAudioContext(2, loopSamples + Math.ceil(2.5 * SR), SR);
    const m = off.createGain(); m.gain.value = 0.9; m.connect(off.destination);
    const g = tracks.map((t, i) => {
      const n = off.createGain();
      n.gain.value = onlyIdx !== undefined ? volGain(t.vol) : effGain(t);
      n.connect(m); return n;
    });
    for (let s = 0; s < STEPS; s++) {
      const when = s * stepDur + swingOffset(s, stepDur);
      tracks.forEach((t, i) => {
        if (onlyIdx !== undefined && i !== onlyIdx) return;
        const v = t.steps[s], buf = bufCache[t.file];
        if (v && buf) playHit(off, g[i], buf, when, VEL[v]);
      });
    }
    const out = await off.startRendering();
    // Ausklang hinten wieder an den Anfang mischen, damit der Loop nahtlos wiederholt
    for (let c = 0; c < out.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      for (let i = loopSamples; i < d.length; i++) d[i - loopSamples] += d[i];
    }
    return { buf: out, n: loopSamples };
  }
  function wavBlob({ buf, n }) {
    let pk = 0;                                             // Spitzen auf -1 dBFS begrenzen
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i])); }
    const gain = pk > 0.891 ? 0.891 / pk : 1, ch = 2, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); out.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt ");
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, buf.sampleRate, true);
    out.setUint32(28, buf.sampleRate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    w(36, "data"); out.setUint32(40, n * ch * 2, true);
    const L = buf.getChannelData(0), R = buf.getChannelData(buf.numberOfChannels > 1 ? 1 : 0);
    for (let i = 0, o = 44; i < n; i++, o += 4) {
      out.setInt16(o, Math.max(-1, Math.min(1, L[i] * gain)) * 32767, true);
      out.setInt16(o + 2, Math.max(-1, Math.min(1, R[i] * gain)) * 32767, true);
    }
    return new Uint8Array(out.buffer);
  }
  // Einfaches ZIP (ohne Kompression), damit kein Zusatz-Script nötig ist
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = d => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + size;
    });
    const cSize = central.reduce((s, p) => s + p.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cSize, true); e.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
  }
  async function exportWav() {
    const btn = $("bl-wav"); btn.disabled = true;
    try {
      ensureAudio(); await ensureLoaded();
      setStatus("Rendering your loop …");
      const files = [{ name: fileBase() + " - full loop.wav", data: wavBlob(await renderMix()) }];
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (!t.steps.some(Boolean)) continue;
        setStatus(`Rendering stems … ${nameOf(t.file)}`);
        files.push({ name: `stems/${String(i + 1).padStart(2, "0")} ${nameOf(t.file).replace(/[^\w -]/g, "")}.wav`, data: wavBlob(await renderMix(i)) });
      }
      files.push({ name: "license.txt", data: new TextEncoder().encode("Made with the YARDSLOVESYOU Percussion Loop Lab (yardslovesyou.com/beatlab.html).\nThe sounds are royalty-free for use in your own music. You may not resell or share the sounds on their own.\nGet the full Essentials kit: https://yardslovesyou.com/shop.html\n") });
      download(zip(files), fileBase() + ".zip");
      setStatus("Done! Your loop and stems are downloading (2 bars, WAV, seamless loop).");
    } catch (e) {
      setStatus("Export failed. Please try again.", true);
    } finally { btn.disabled = false; }
  }

  // ---------- Freischalten per E-Mail (nutzt die bestehende free-kit Function) ----------
  const UNLOCK_KEY = "yly_beatlab_unlocked";
  const isUnlocked = () => { try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch (_) { return false; } };
  function showUnlocked() {
    $("bl-wav").classList.remove("locked"); $("bl-wav").textContent = "Download WAV + stems";
    $("bl-unlock").classList.add("hidden");
  }
  $("bl-wav").onclick = () => {
    if (isUnlocked()) return exportWav();
    $("bl-unlock").classList.remove("hidden");
    $("bl-unlock").scrollIntoView({ behavior: "smooth", block: "center" });
    $("bl-email").focus({ preventScroll: true });
  };
  $("bl-unlock").onsubmit = async e => {
    e.preventDefault();
    const email = $("bl-email").value.trim(), st = $("bl-unlock-status"), btn = $("bl-unlock-btn");
    st.classList.remove("danger"); st.textContent = "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { st.textContent = "Please enter a valid email address."; st.classList.add("danger"); return; }
    btn.disabled = true; btn.textContent = "Sending …";
    try {
      const db = (window.YLY && window.YLY.db) || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await db.functions.invoke("free-kit", { body: { email, marketing_consent: $("bl-consent").checked } });
      if (error) { let m = error.message; try { const j = await error.context.json(); if (j?.error) m = j.error; } catch (_) {} throw new Error(m); }
      if (!data?.ok) throw new Error(data?.error || "Something went wrong.");
      try { localStorage.setItem(UNLOCK_KEY, "1"); } catch (_) {}
      showUnlocked();
      setStatus("Unlocked! Essentials Lite is on its way to your inbox. Exporting your loop …");
      exportWav();
    } catch (err) {
      st.textContent = err.message || "Something went wrong. Please try again."; st.classList.add("danger");
    } finally { btn.disabled = false; btn.textContent = "Unlock & download"; }
  };

  /* ===================================================================
     START
     =================================================================== */
  function applyDecoded(d) {
    Object.assign(state, d.settings);
    touched.bpm = touched.swing = true;                     // Link-Werte nicht automatisch überschreiben
    tracks = buildTracks(d.specs);
  }
  function freshStart() {
    state.genre = "trap"; state.mood = "bouncy"; state.density = 1; state.complexity = 1; state.humanize = 20;
    touched.bpm = touched.swing = false;
    tracks = pickDistinct(Math.min(MAX_TRACKS, pool.length)).map(f => ({ file: f, vol: 6, mute: false, solo: false, steps: blankSteps() }));
    generateAll(true);
  }
  const hashData = () => location.hash.startsWith("#b=") ? location.hash.slice(3) : "";

  // Geteilter Link, während die Seite schon offen ist
  window.addEventListener("hashchange", () => {
    const h = hashData();
    if (!ready || !h || h === currentHash()) return;
    const d = decodeHash(h);
    if (d) { stop(); applyDecoded(d); renderAll(); prefetch(); setStatus("Shared loop loaded – press play, then remix it!"); }
  });

  (async function init() {
    setStatus("Loading sounds …");
    await loadPool();
    const h = hashData(), d = h ? decodeHash(h) : null;
    if (d) { applyDecoded(d); setStatus(d.old ? "Loaded an older Beat Lab link – the pattern now lives in the first tracks. Press play!" : "You're listening to a shared loop – press play, then remix it!"); }
    else { freshStart(); setStatus(""); }
    ready = true;
    renderAll(); prefetch();
    if (isUnlocked()) showUnlocked();
  })();
})();

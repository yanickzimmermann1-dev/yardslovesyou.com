/* =====================================================================
   PERC LAB - relaxed percussion loops in the browser
   5 rows x 32 steps: Kick, Clap and three percussion tracks (Timeline, Steady, Accent)
   that interlock. Sounds come from the storage folders "perclab", "perclab/kick" and
   "perclab/clap" (with fallback to the old Beat Lab files). Rows can be locked.
   Share link, MIDI and WAV export. Runs completely in the browser.
   ===================================================================== */
(() => {
  "use strict";
  const cfg = window.APP_CONFIG || {}, $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, isNaN(x) ? a : x));
  const STEPS = 32, MAX_TRACKS = 5;

  /* ===================================================================
     PURE LOGIC (no DOM): random, genres, generator, hash
     =================================================================== */
  // ==PURE-START==

  // ---------- Random (reproducible via seed) ----------
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

  // ---------- Lists (NEVER reorder: the indexes live in the p2 hash) ----------
  const GENRE_KEYS = ["trap", "drill", "afro", "amapiano", "reggaeton", "dancehall", "boombap", "lofi", "house", "latin", "rnb"];
  const GENRE_NAMES = ["Trap", "Drill", "Afrobeats", "Amapiano", "Reggaeton", "Dancehall", "Boom Bap", "Lo-fi", "House", "Latin / Clave", "R&B"];
  const OLD_GENRE_KEYS = ["trap", "drill", "afro", "amapiano", "reggaeton", "dancehall", "baile", "jersey", "boombap", "lofi", "house", "latin", "rnb"];   // p1 hashes
  const OLD_GENRE_MAP = { baile: "reggaeton", jersey: "trap" };
  const MOOD_KEYS = ["dark", "bouncy", "chill", "energetic", "hypnotic", "tribal"];
  const MOOD_NAMES = ["Dark", "Bouncy", "Chill", "Energetic", "Hypnotic", "Tribal"];
  const DENS_NAMES = ["Sparse", "Medium", "Busy"], CX_NAMES = ["Simple", "Groovy", "Wild"];

  // Mood: bpm/sw = automatic offsets for BPM and swing
  const MOOD = {
    dark:      { bpm: -4, sw: 0 },
    bouncy:    { bpm: 0,  sw: 8 },
    chill:     { bpm: -6, sw: 12 },
    energetic: { bpm: 6,  sw: -5 },
    hypnotic:  { bpm: 0,  sw: 0 },
    tribal:    { bpm: 2,  sw: 5 },
  };

  // ---------- Genre templates on the 16th grid (step 0 = beat 1, 4 = beat 2, 8 = beat 3, 12 = beat 4) ----------
  // clap: list of backbeat variants. kick: fix = always, opt = [step, weight], n = [min, max] hits per bar.
  // tl: timeline variants in priority order (the last one is the syncopated one, used by Bouncy).
  const GEN = {
    trap:      { bpm: 140, sw: 0,  clap: [[8]],                       kick: { opt: [[7, 2], [10, 3], [3, 1], [14, 2], [11, 1]], n: [2, 4] }, tl: [[6, 12, 3, 11, 14, 8], [10, 6, 14, 3, 2]] },
    drill:     { bpm: 142, sw: 0,  clap: [[8]],                       kick: { opt: [[6, 2], [10, 2], [7, 1], [13, 1], [3, 1]],  n: [2, 4] }, tl: [[6, 10, 14, 3, 11], [10, 3, 6, 14]] },
    afro:      { bpm: 104, sw: 10, clap: [[4, 12]],                   kick: { opt: [[6, 3], [10, 2], [8, 1], [3, 1]],           n: [2, 4] }, tl: [[6, 10, 3, 14, 2], [3, 6, 10, 14]] },
    amapiano:  { bpm: 112, sw: 15, clap: [[4, 12], [12]],             kick: { opt: [[8, 3], [6, 2], [10, 2], [3, 1], [14, 1]],  n: [2, 4] }, tl: [[6, 10, 14, 3, 2], [3, 10, 14, 7]] },
    reggaeton: { bpm: 94,  sw: 0,  clap: [[3, 6, 11, 14], [3, 11]],   kick: { opt: [[8, 3], [4, 3], [12, 3]],                    n: [2, 4] }, tl: [[10, 2, 13, 5, 7], [2, 5, 10, 13]] },
    dancehall: { bpm: 100, sw: 5,  clap: [[6, 14], [3, 6, 11, 14], [4, 12]], kick: { opt: [[3, 2], [6, 2], [8, 2], [11, 2], [10, 1]], n: [2, 4] }, tl: [[6, 10, 14, 2, 3], [3, 6, 10, 14, 11]] },
    boombap:   { bpm: 90,  sw: 40, clap: [[4, 12]],                   kick: { opt: [[10, 3], [7, 2], [2, 2], [11, 1]],          n: [2, 4] }, tl: [[6, 10, 14, 2, 3], [10, 3, 14, 6]] },
    lofi:      { bpm: 76,  sw: 45, clap: [[4, 12]],                   kick: { opt: [[10, 3], [7, 2], [3, 1], [14, 1]],          n: [2, 3] }, tl: [[6, 14, 10, 2], [10, 3, 14, 6]] },
    house:     { bpm: 124, sw: 12, clap: [[4, 12]],                   kick: { fix: [0, 4, 8, 12], opt: [],                      n: [4, 4] }, tl: [[6, 10, 3, 14, 2], [3, 6, 11, 14, 2]] },
    latin:     { bpm: 100, sw: 5,  clap: [[12], [4, 12]],             kick: { opt: [[6, 2], [8, 2], [10, 2], [3, 1]],           n: [2, 4] }, tl: [[6, 10, 3, 12, 0], [3, 10, 7, 12, 6]] },
    rnb:       { bpm: 88,  sw: 30, clap: [[4, 12], [12]],             kick: { opt: [[10, 3], [7, 2], [3, 1], [14, 1]],          n: [2, 3] }, tl: [[6, 10, 14, 3, 2], [3, 10, 6, 14, 11]] },
  };

  // Roles: row 0 = kick, row 1 = clap, rows 2-4 = percussion with a role each
  const ROLES = ["kick", "clap", "timeline", "steady", "accent"];       // index = role digit in the hash
  const PERC_ROLES = ["timeline", "steady", "accent"];
  const ROLE_NAME = { kick: "Kick", clap: "Clap", timeline: "Timeline", steady: "Steady", accent: "Accent" };
  const ROLE_VOL = { kick: 8, clap: 7, timeline: 6, steady: 5, accent: 5 };    // start volume 0-9
  const MIDI_NOTE = { kick: 36, clap: 39, timeline: 75, steady: 70, accent: 56 };   // GM percussion
  const CAP = [3, 4, 6], TOT = [7, 10, 14];                              // per perc track / all perc tracks, per bar, by density

  // ---------- Settings ----------
  const state = { bpm: 140, swing: 0, genre: "trap", mood: "bouncy", density: 1, complexity: 0, humanize: 10, seed: 1 };
  const autoBpm = () => clamp(GEN[state.genre].bpm + MOOD[state.mood].bpm, 60, 200);
  const autoSwing = () => clamp(GEN[state.genre].sw + MOOD[state.mood].sw, 0, 60);

  // ---------- Generator ----------
  const barCnt = (row, bar) => { let c = 0; for (let k = 0; k < 16; k++) if (row[bar * 16 + k]) c++; return c; };
  function weightedOrder(r, pairs) {
    const p = pairs.slice(), out = [];
    while (p.length) {
      let x = r() * p.reduce((a, q) => a + q[1], 0), k = 0;
      while (k < p.length - 1 && (x -= p[k][1]) >= 0) k++;
      out.push(p.splice(k, 1)[0][0]);
    }
    return out;
  }

  // Generates the rows listed in `which` (array of row indexes 0-4). Other rows are fixed context
  // (locked rows). rows = array of 5 arrays with 32 steps, roles = role names per row, r = random function.
  function genLoop(rows, which, roles, r, S) {
    S = S || state;
    const d = S.density, cx = S.complexity, mood = S.mood, G = GEN[S.genre], hyp = mood === "hypnotic";
    const has = ri => which.includes(ri);
    const mk = (ri, s, v) => { rows[ri][s] = v; rows[ri][s + 16] = v; };            // bar 1 and its copy in bar 2
    which.forEach(ri => rows[ri].fill(0));
    const clapAt = s => rows[1][s] || rows[1][s + 16];

    // --- Clap: genre backbeat, rarely one pickup before bar 2 (Groovy / Wild)
    if (has(1)) {
      const v = G.clap[Math.floor(r() * G.clap.length)];
      v.forEach(p => mk(1, p, 1));
      if (cx > 0 && !hyp && r() < (cx === 2 ? 0.45 : 0.3) && !rows[1][14]) rows[1][14] = 1;
    }

    // --- Kick: genre positions, always step 1 of each bar
    if (has(0)) {
      const K = G.kick, fix = K.fix || [0];
      const eff = clamp(d + (mood === "chill" ? -1 : mood === "dark" ? -0.5 : mood === "energetic" ? 1 : 0), 0, 2);
      let n = K.n[0] + Math.round((K.n[1] - K.n[0]) * eff / 2);
      if (cx === 2 && r() < 0.4) n++;
      n = Math.max(clamp(n, 2, 5), fix.length);
      const ch = fix.slice();
      let opts = K.opt.map(([p, w]) => [p, p % 2 && cx === 0 ? w * 0.3 : w]);
      while (ch.length < n) {
        opts = opts.filter(([p]) => !clapAt(p) && ch.every(q => Math.abs(q - p) > 1));
        if (!opts.length) break;
        const p = weightedOrder(r, opts)[0];
        ch.push(p);
      }
      ch.forEach(p => mk(0, p, 1));
    }

    // --- Percussion rows: Timeline, then Steady, then Accent (ear candy in what is left open)
    const gen = [2, 3, 4].filter(has).sort((a, b) => PERC_ROLES.indexOf(roles[a]) - PERC_ROLES.indexOf(roles[b]));
    const oddMax = cx === 0 ? 0 : cx === 1 ? 1 : 2;
    const oddLim = ri => mood === "tribal" && roles[ri] === "timeline" ? Math.max(2, oddMax) : oddMax;
    const oddCnt = (ri, bar) => { let c = 0; for (let k = 1; k < 16; k += 2) if (rows[ri][bar * 16 + k]) c++; return c; };
    const sharedCnt = bar => { let c = 0; for (let k = 0; k < 16; k++) { const s = bar * 16 + k; if ((rows[2][s] ? 1 : 0) + (rows[3][s] ? 1 : 0) + (rows[4][s] ? 1 : 0) >= 2) c++; } return c; };
    const capOf = role => role === "steady" && d === 2 ? 8 : CAP[d];

    // Is it OK to put a hit on step s (mirror = also on s+16)?
    const okP = (ri, s, mirror, strict, loose) => {
      const ps = mirror ? [s, s + 16] : [s], row = rows[ri];
      if (!loose && s % 2 && oddCnt(ri, s >= 16 ? 1 : 0) >= oddLim(ri)) return false;
      for (const p of ps) {
        const b = p >= 16 ? 1 : 0;
        if (row[p] || rows[1][p]) return false;                                  // not on the clap
        if (row[(p + 1) % 32] || row[(p + 31) % 32]) return false;               // never two adjacent 16ths
        if (strict) { if (rows.some((x, i) => i !== ri && x[p])) return false; continue; }
        if (!loose && rows[0][p] && r() < 0.85) return false;                              // mostly avoid the kick
        if (loose !== 2) for (let o = 2; o < 5; o++) if (o !== ri && rows[o][p] && sharedCnt(b) >= 1) return false;   // share a step max 1x per bar
      }
      return true;
    };
    const put = (ri, cands, n, strict, loose) => { let c = 0; for (const s of cands) { if (c >= n) break; if (okP(ri, s, true, strict, loose)) { mk(ri, s, 1); c++; } } return c; };

    if (gen.length) {
      const others = [2, 3, 4].filter(i => !has(i)).reduce((a, i) => a + Math.max(barCnt(rows[i], 0), barCnt(rows[i], 1)), 0);
      const cool = mood === "chill" || mood === "dark", hot = mood === "energetic";
      const target = role => {
        let t;
        if (role === "timeline") { t = [3, 3, 5][d] + (d === 1 && r() < 0.35 ? 1 : 0); if (cool) t = Math.max(2, t - 1); if (hot) t++; }
        else if (role === "steady") {
          t = d === 0 ? 2 : d === 1 ? (r() < 0.3 ? 2 : 4) : 4;
          if (hot) t = d === 2 ? 6 + (r() < 0.5 ? 2 : 0) : t + 1;
          if (cool) t = Math.max(2, t - 1);
        } else { t = 1 + (r() < [0, 0.3, 0.6][d] ? 1 : 0); if (hot && d > 0) t = 2; }
        return clamp(t, 1, capOf(role));
      };
      const tg = gen.map(ri => target(roles[ri])), room = Math.max(gen.length, TOT[d] - others);
      while (tg.reduce((a, b) => a + b, 0) > room) {
        let k = 0; tg.forEach((v, i) => { if (v > tg[k]) k = i; });
        if (tg[k] <= 1) break; tg[k]--;
      }
      const evens = [2, 6, 10, 14, 4, 12, 8, 0];
      gen.forEach((ri, gi) => {
        const role = roles[ri], n = tg[gi];
        let c = 0;
        if (role === "timeline") {
          const vs = G.tl;
          const v = mood === "tribal" ? [0, 6, 12, 9, 3] : mood === "bouncy" ? vs[vs.length - 1] : vs[cx === 0 ? 0 : Math.floor(r() * vs.length)];
          c = put(ri, v, n);
          if (c < n) c += put(ri, evens, n - c);
        } else if (role === "steady") {
          const a = hyp || r() < 0.5 ? [6, 14, 2, 10] : [14, 6, 10, 2];
          c = put(ri, a.concat(r() < 0.5 ? [12, 4, 8, 0] : [4, 12, 0, 8]), n);
        } else {
          const w = [[14, 3], [10, 3], [6, 2], [2, 1], [12, 1], [8, 1], [4, 1]];
          if (cx > 0) w.push([15, 1.5], [13, 1.5], [11, 1], [7, 1]);
          const order = weightedOrder(r, w);
          c = put(ri, order, n, true);
          if (c < n) c += put(ri, order, n - c);
        }
        if (!barCnt(rows[ri], 0)) { const odds = [1, 3, 5, 7, 9, 11, 13, 15]; if (!put(ri, evens, 1, false, 1) && !put(ri, odds, 1, false, 1) && !put(ri, evens, 1, false, 2)) put(ri, odds, 1, false, 2); }
      });

      // Variation: bar 2 = exact repeat, except small changes in its last 4 steps (Groovy 1, Wild 2, never Simple/Hypnotic)
      if (!hyp && cx > 0) {
        let nCh = cx === 1 ? 1 : 2, tries = 0;
        while (nCh > 0 && tries++ < 8) {
          const ri = weightedOrder(r, gen.map((g, i) => [g, roles[g] === "accent" ? 3 : 1]))[0];
          const loc = [14, 12].sort(() => r() - 0.5).concat(oddMax ? [13, 15].sort(() => r() - 0.5) : []);
          const total2 = [2, 3, 4].reduce((a, i) => a + barCnt(rows[i], 1), 0);
          let done = false;
          if (barCnt(rows[ri], 1) < capOf(roles[ri]) && total2 < TOT[d]) {
            for (const l of loc) if (okP(ri, 16 + l, false)) { rows[ri][16 + l] = 1; done = true; break; }
          }
          if (!done) {
            const from = [28, 29, 30, 31].find(s => rows[ri][s]);
            if (from !== undefined) {
              rows[ri][from] = 0;
              for (const l of loc) if (16 + l !== from && okP(ri, 16 + l, false)) { rows[ri][16 + l] = 1; done = true; break; }
              if (!done) rows[ri][from] = 1;
            }
          }
          if (done) nCh--;
        }
      }
    }

    // --- Accents: only rarely, one per bar at most, on the first hit ("downbeat") of the row
    const accP = role => mood === "chill" ? 0.05 : mood === "energetic" ? 0.4 : mood === "dark" ? (role === "timeline" || role === "kick" ? 0.12 : 0) : 0.2;
    if (has(0) && r() < accP("kick")) { rows[0][0] = 2; rows[0][16] = 2; }
    [2, 3, 4].filter(has).forEach(ri => {
      if (r() >= accP(roles[ri])) return;
      const s0 = rows[ri].findIndex((v, i) => i < 16 && v);
      if (s0 >= 0) { rows[ri][s0] = 2; if (rows[ri][s0 + 16]) rows[ri][s0 + 16] = 2; }
    });
  }

  // ---------- Share link ----------
  // Format "p2" (only characters 0-9 a-z and "."):
  // p2.<bpm>.<swing>.<genre>.<mood>.<density>.<complexity>.<humanize>.<seed36>.<vols>.<mutes>.<locks>.<roles>.<files>.<rows>
  //   vols/mutes/locks/roles = 5 characters each (vol 0-9, 0/1, 0/1, role digit 0 kick,1 clap,2 timeline,3 steady,4 accent;
  //   the role digit also tells the sound pool: kick / clap / perc), files = 5 x 7 characters (FNV hash of the file name, base36),
  //   rows = 5 x 10 characters: 32 steps (0/1/2) as a base-3 number written in base36.
  // The old format "p1" (up to 5 tracks) and "1-..." (Beat Lab) can still be read.
  const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36).padStart(7, "0"); };
  const pack = row => { let n = 0; for (let i = 0; i < STEPS; i++) n = n * 3 + (row[i] || 0); return n.toString(36).padStart(10, "0"); };
  const unpack = s => { let n = parseInt(s, 36) || 0; const out = Array(STEPS); for (let i = STEPS - 1; i >= 0; i--) { out[i] = n % 3; n = Math.floor(n / 3); } return out; };

  function encodeHash(s, trs) {
    return ["p2", s.bpm, s.swing, GENRE_KEYS.indexOf(s.genre), MOOD_KEYS.indexOf(s.mood), s.density, s.complexity, s.humanize,
      (s.seed >>> 0).toString(36),
      trs.map(t => t.vol).join(""), trs.map(t => t.mute ? 1 : 0).join(""), trs.map(t => t.lock ? 1 : 0).join(""),
      trs.map(t => Math.max(0, ROLES.indexOf(t.role))).join(""),
      trs.map(t => fnv(t.e.file)).join(""), trs.map(t => pack(t.steps)).join("")].join(".");
  }

  const rolesByHits = specs => {                           // old loops: fewest hits = Accent, most = Steady
    const idx = specs.map((s, i) => [i, s.steps.filter(Boolean).length]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    const order = ["accent", "timeline", "steady"], out = [];
    idx.forEach(([i], k) => { out[i] = order[k] || "timeline"; });
    return out;
  };

  // Returns { ver, settings, specs:[5 x spec|null], old } or null. spec = {h, vol, mute, lock, role, steps}
  function decodeHash(str) {
    try {
      const num = (v, a, b) => clamp(parseInt(v, 10), a, b);
      if (str.startsWith("p2.")) {
        const p = str.split(".");
        if (p.length < 15 || p[9].length < 5 || p[10].length < 5 || p[11].length < 5 || p[12].length < 5 || p[13].length < 35 || p[14].length < 50) return null;
        const g = GENRE_KEYS[parseInt(p[3], 10)], m = MOOD_KEYS[parseInt(p[4], 10)];
        if (!g || !m) return null;
        const settings = { bpm: num(p[1], 60, 200), swing: num(p[2], 0, 60), genre: g, mood: m, density: num(p[5], 0, 2), complexity: num(p[6], 0, 2),
          humanize: num(p[7], 0, 100), seed: (parseInt(p[8], 36) >>> 0) || 1 };
        const specs = [];
        for (let i = 0; i < 5; i++) {
          let role = ROLES[parseInt(p[12][i], 10)];
          if (i === 0) role = "kick"; else if (i === 1) role = "clap"; else if (!PERC_ROLES.includes(role)) role = PERC_ROLES[i - 2];
          specs.push({ h: p[13].slice(i * 7, i * 7 + 7), vol: num(p[9][i], 0, 9), mute: p[10][i] === "1", lock: p[11][i] === "1", role, steps: unpack(p[14].slice(i * 10, i * 10 + 10)) });
        }
        return { ver: "p2", old: false, settings, specs };
      }
      if (str.startsWith("p1.")) {
        const p = str.split("."), n = clamp(parseInt(p[9], 10), 1, 5);
        if (p.length < 14 || p[10].length < n || p[11].length < n || p[12].length < n * 7 || p[13].length < n * 10) return null;
        let gk = OLD_GENRE_KEYS[parseInt(p[3], 10)]; const m = MOOD_KEYS[parseInt(p[4], 10)];
        if (!gk || !m) return null;
        gk = OLD_GENRE_MAP[gk] || gk;
        const settings = { bpm: num(p[1], 60, 200), swing: num(p[2], 0, 60), genre: gk, mood: m, density: num(p[5], 0, 2), complexity: num(p[6], 0, 2),
          humanize: num(p[7], 0, 100), seed: (parseInt(p[8], 36) >>> 0) || 1 };
        const pr = [];
        for (let i = 0; i < Math.min(3, n); i++) pr.push({ h: p[12].slice(i * 7, i * 7 + 7), vol: num(p[10][i], 0, 9), mute: p[11][i] === "1", lock: false, steps: unpack(p[13].slice(i * 10, i * 10 + 10)) });
        const rl = rolesByHits(pr);
        pr.forEach((s, i) => { s.role = rl[i]; });
        return { ver: "p1", old: true, settings, specs: [null, null, pr[0] || null, pr[1] || null, pr[2] || null] };
      }
      // Old Beat Lab format: 7 rows of 16 steps (kick, snare, clap, hat, open hat, perc, 808), doubled to 32 steps
      const [v, bpm, swing, , , vol, mute, steps] = str.split("-");
      if (v !== "1" || !steps) return null;
      const rows = steps.split("."), r32 = i => { const r16 = (rows[i] || "").padEnd(16, "0").slice(0, 16).split("").map(x => (+x > 0 ? 1 : 0)); return r16.concat(r16); };
      const vl = i => clamp(/\d/.test((vol || "")[i] || "") ? +vol[i] : 5, 0, 9), mt = i => (mute || "")[i] === "1";
      const clapSteps = r32(1).map((x, i) => x || r32(2)[i] ? 1 : 0);
      const pr = [3, 4, 5].map(i => ({ h: null, vol: vl(i), mute: mt(i), lock: false, steps: r32(i) })), rl = rolesByHits(pr);
      pr.forEach((s, i) => { s.role = rl[i]; });
      return { ver: "old", old: true,
        settings: { bpm: clamp(+bpm, 60, 200), swing: clamp(Math.round((+swing || 0) * 0.6), 0, 60), genre: "trap", mood: "bouncy", density: 1, complexity: 0, humanize: 10, seed: newSeed() },
        specs: [{ h: null, vol: vl(0), mute: mt(0), lock: false, role: "kick", steps: r32(0) },
                { h: null, vol: Math.max(vl(1), vl(2)), mute: mt(1) && mt(2), lock: false, role: "clap", steps: clapSteps }, pr[0], pr[1], pr[2]] };
    } catch (_) { return null; }
  }
  // ==PURE-END==

  /* ===================================================================
     SOUND POOLS (folders "perclab/kick", "perclab/clap", "perclab" or fallback) and tracks
     =================================================================== */
  const BUCKET = `${cfg.SUPABASE_URL}/storage/v1/object/public/coverart-products/`;
  const SB = window.BEATLAB_SOUND_BASE || `${BUCKET}beatlab/beatlab-sounds%202/`;
  const FALLBACK = ["kick-1-anvil", "kick-2-titan", "kick-3-boulder", "snare-1-whip", "snare-2-crack", "snare-3-blaze", "clap-1-fireworks", "clap-2-velvet", "clap-3-ritual",
    "hat-1-sparrow", "hat-2-ticker", "hat-3-glitter", "openhat-1-keeper", "openhat-2-dinged", "openhat-3-sniff", "perc-1-pebble", "perc-2-bamboo", "perc-3-marble",
    "808-1-gravity", "808-2-monsoon", "808-3-voltage"].map(n => n + ".wav");
  const AUDIO_RE = /\.(wav|mp3|ogg|aif|aiff|flac)$/i;

  let kickPool = [], clapPool = [], percPool = [], ready = false;
  const bad = new Set();                                   // urls of sounds that fail to load
  // Display name: no extension, _ and - to spaces, title case, max 18 characters
  function niceName(f, strip) {
    let n = f.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    n = n.replace(/^(kick|clap|snare|perc|percussion|hat|hihat|openhat|shaker|tom|rim|808)\s+(\d+\s+)?/i, "") || n;
    n = n.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
    return (n.length > 18 ? n.slice(0, 18).trim() : n) || f.slice(0, 18);
  }
  const mkEntry = (f, base, strip) => ({ file: f, name: niceName(f, strip), h: fnv(f), url: base + encodeURIComponent(f) });
  const poolFor = i => i === 0 ? kickPool : i === 1 ? clapPool : percPool;
  const poolName = i => i === 0 ? "kick" : i === 1 ? "clap" : "perc";
  const FB_KICK = f => /^kick/i.test(f), FB_CLAP = f => /^(clap|snare)/i.test(f), FB_PERC = f => !/^(kick|clap|snare)/i.test(f) && !/808/.test(f);

  async function loadPool() {
    let db = null;
    try { db = (window.YLY && window.YLY.db) || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY); } catch (e) { console.warn("Perc Lab: no storage client", e && e.message); }
    const list = async path => {
      try {
        if (!db) return [];
        const { data, error } = await db.storage.from("coverart-products").list(path, { limit: 1000, sortBy: { column: "name", order: "asc" } });
        if (error) throw error;
        return (data || []).map(x => x.name).filter(n => n && n !== ".emptyFolderPlaceholder" && AUDIO_RE.test(n) && !/808/i.test(n));
      } catch (e) { console.warn("Perc Lab: sound list failed for", path, e && e.message); return []; }
    };
    const [kf, cf, pf] = await Promise.all([list("perclab/kick"), list("perclab/clap"), list("perclab")]);
    const fbEntries = fn => FALLBACK.filter(fn).map(f => mkEntry(f, SB, true));
    kickPool = kf.length ? kf.map(f => mkEntry(f, BUCKET + "perclab/kick/", true)) : fbEntries(FB_KICK);
    clapPool = cf.length ? cf.map(f => mkEntry(f, BUCKET + "perclab/clap/", true)) : fbEntries(FB_CLAP);
    percPool = pf.map(f => mkEntry(f, BUCKET + "perclab/", false));
    if (percPool.length < 3) {                              // too few perc sounds: add old non-kick/clap/808 files
      const fb = FALLBACK.filter(FB_PERC).map(f => mkEntry(f, SB, false));
      percPool = percPool.concat(percPool.length ? fb.slice(0, 3 - percPool.length) : fb);
    }
  }

  // Mood nudges the perc sound choice (names with matching keywords are more likely)
  const MOOD_KW = { tribal: /tom|conga|bongo|djembe|drum|log|tabla|timbale|talking|cajon/i, dark: /low|deep|tom|log|dark|boom/i,
    chill: /shaker|rim|click|soft|wood|block|egg/i, energetic: /snap|shaker|cowbell|hat|tamb/i, bouncy: /cowbell|clave|block|snap|bell/i };
  function pick(poolArr, n, exclude) {
    const taken = new Set(exclude || []), out = [], kw = poolArr === percPool ? MOOD_KW[state.mood] : null;
    const cand = poolArr.filter(p => !bad.has(p.url));
    while (out.length < n) {
      const free = cand.filter(p => !taken.has(p.url));
      if (!free.length) break;
      const w = free.map(p => kw && kw.test(p.file) ? 3 : 1);
      let x = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < free.length - 1 && (x -= w[k]) >= 0) k++;
      out.push(free[k]); taken.add(free[k].url);
    }
    return out;
  }

  // tracks (always 5): { e: pool entry, role, vol 0-9, mute, solo, lock, steps[32] }
  let tracks = [];
  const blankSteps = () => Array(STEPS).fill(0);
  const touched = { bpm: false, swing: false };           // touched by the user -> do not overwrite automatically
  const rowLabel = t => t.role === "kick" ? "Kick" : t.role === "clap" ? "Clap" : t.e.name;
  const makeTrack = (i, e, sp) => ({ e, role: sp && sp.role || ROLES[i], vol: sp ? sp.vol : ROLE_VOL[ROLES[i]], mute: !!(sp && sp.mute), solo: false, lock: !!(sp && sp.lock), steps: sp && sp.steps ? sp.steps.slice(0, STEPS) : blankSteps() });

  // Percussion roles for the unlocked perc rows: shuffled by seed, locked rows keep theirs
  function assignRoles() {
    const r = mulberry32((state.seed ^ 0x5bd1e995) >>> 0);
    const free = PERC_ROLES.filter(x => ![2, 3, 4].some(i => tracks[i].lock && tracks[i].role === x));
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
    [2, 3, 4].filter(i => !tracks[i].lock).forEach((i, k) => { tracks[i].role = free.length ? free[k % free.length] : PERC_ROLES[k]; });
  }
  // Generate patterns for the given rows (default: all unlocked rows)
  function genRows(which, nonce) {
    const rows = tracks.map(t => t.steps.slice());
    genLoop(rows, which, tracks.map(t => t.role), mulberry32(h32(state.seed, which.length === 1 ? which[0] : 7, nonce || 0)));
    which.forEach(i => { tracks[i].steps = rows[i]; });
  }
  function generateAll(newSeedToo) {
    if (newSeedToo) {
      state.seed = newSeed();
      if (!touched.bpm) state.bpm = autoBpm();
      if (!touched.swing) state.swing = autoSwing();
    }
    assignRoles();
    const which = [0, 1, 2, 3, 4].filter(i => !tracks[i].lock);
    genRows(which, 0);
    if (newSeedToo) which.forEach(i => { tracks[i].vol = ROLE_VOL[tracks[i].role]; tracks[i].mute = false; tracks[i].solo = false; });
  }

  // Build tracks from hash specs: missing / duplicate sounds are replaced; rows without a pattern are generated
  function buildTracks(specs) {
    const used = new Set(), out = [], need = [];
    for (let i = 0; i < MAX_TRACKS; i++) {
      const sp = specs[i], P = poolFor(i);
      let e = null;
      if (sp && sp.h) e = P.find(p => p.h === sp.h && !used.has(p.url) && !bad.has(p.url));
      if (!e) e = pick(P, 1, used)[0] || P.find(p => !used.has(p.url)) || P[0];
      used.add(e.url);
      out.push(makeTrack(i, e, sp));
      if (!sp || !sp.steps) need.push(i);
    }
    tracks = out;
    if (need.length) {
      const lockedBefore = tracks.map(t => t.lock);
      tracks.forEach((t, i) => { t.lock = !need.includes(i); });          // only fill the missing rows
      assignRoles();
      tracks.forEach((t, i) => { t.lock = lockedBefore[i]; });
      genRows(need, 0);
    }
  }

  /* ===================================================================
     AUDIO
     =================================================================== */
  const VEL = [0, 0.66, 1];                                // step value -> loudness (on / accent)
  const volGain = v => Math.pow(v / 9, 1.5);
  let ctx = null, master = null;
  const trackGain = [], rawCache = {}, bufCache = {};
  let status = "";

  function ensureAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();           // soft limiter against clipping
    comp.threshold.value = -8; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    for (let i = 0; i < MAX_TRACKS; i++) { const g = ctx.createGain(); g.connect(master); trackGain.push(g); }
    updateGains();
    return ctx;
  }
  const anySolo = () => tracks.some(t => t.solo);
  const effGain = t => t.mute || (anySolo() && !t.solo) ? 0 : volGain(t.vol);
  function updateGains() { if (ctx) tracks.forEach((t, i) => { trackGain[i].gain.value = effGain(t); }); }

  // Download first (no AudioContext needed), decode on demand
  const fetchRaw = u => rawCache[u] || (rawCache[u] = fetch(u).then(r => { if (!r.ok) throw new Error("missing " + u); return r.arrayBuffer(); }));
  const prefetch = () => tracks.forEach(t => { if (!bufCache[t.e.url]) fetchRaw(t.e.url).catch(() => {}); });
  async function decodeUrl(u) {
    if (bufCache[u]) return;
    const ab = await fetchRaw(u);
    bufCache[u] = await ctx.decodeAudioData(ab.slice(0));
  }

  // Load only the assigned sounds; broken ones are replaced by others from the same pool
  let loadChain = Promise.resolve();
  async function loadRun() {
    ensureAudio();
    for (let attempt = 0; attempt < 8; attempt++) {
      const need = [...new Set(tracks.map(t => t.e.url).filter(u => !bufCache[u] && !bad.has(u)))];
      if (!need.length) { if (status.startsWith("Loading")) setStatus(""); break; }
      setStatus("Loading sounds …");
      const res = await Promise.allSettled(need.map(decodeUrl));
      const failed = need.filter((u, k) => res[k].status === "rejected");
      if (!failed.length) { setStatus(""); break; }
      failed.forEach(u => { bad.add(u); delete rawCache[u]; });
      tracks.forEach((t, i) => {
        if (!bad.has(t.e.url)) return;
        const e = pick(poolFor(i), 1, tracks.filter((x, j) => poolName(j) === poolName(i)).map(x => x.e.url))[0];
        if (e) t.e = e;
      });
      renderGrid(); saveHash();
    }
    if (!tracks.some(t => bufCache[t.e.url])) { setStatus("Sounds could not be loaded. Please reload the page.", true); throw new Error("no sounds"); }
  }
  function ensureLoaded() {
    const p = loadChain.then(loadRun);
    loadChain = p.catch(() => {});
    return p;
  }

  // Schedule one hit (also used for the offline export)
  function playHit(ac, dest, buf, when, vel) {
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = vel;
    src.connect(g).connect(dest); src.start(Math.max(when, 0));
  }
  const swingOffset = (step, stepDur) => step % 2 === 1 ? (state.swing / 100) * 0.55 * stepDur : 0;

  // ---------- Transport (look-ahead scheduler) ----------
  let playing = false, timer = null, nextTime = 0, curStep = 0;
  const queue = [];

  function scheduleStep(step, time) {
    const hum = state.humanize / 100;
    tracks.forEach((t, i) => {
      const v = t.steps[step], buf = bufCache[t.e.url];
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

  // Preview when clicking a cell (also while playing)
  async function preview(i, v) {
    const t = tracks[i]; if (!t) return;
    try { ensureAudio(); if (ctx.state === "suspended") await ctx.resume(); await ensureLoaded(); } catch (_) { return; }
    const buf = bufCache[t.e.url]; if (!buf || !tracks[i]) return;
    playHit(ctx, trackGain[i], buf, ctx.currentTime + 0.01, VEL[v || 1]);
  }

  /* ===================================================================
     INTERFACE
     =================================================================== */
  const ICON_SWAP = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg>`;
  const ICON_REGEN = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>`;
  const ICON_LOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
  const ICON_UNLOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-1.5"/></svg>`;
  const LOCK_TITLE = "Lock row: Generate and Shuffle won't change it";

  function cellsHtml(ti) {
    const t = tracks[ti], nm = esc(rowLabel(t));
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
    const ruler = [0, 1].map(b => `<div class="pl-bar">${[0, 1, 2, 3].map(be => `<div class="pl-beat">${[0, 1, 2, 3].map(k => `<span>${k === 0 ? b * 4 + be + 1 : ""}</span>`).join("")}</div>`).join("")}</div>`).join("");
    $("pl-grid").innerHTML = `<div class="pl-row pl-ruler"><div class="pl-head"></div><div class="pl-cells">${ruler}</div></div>` +
      tracks.map((t, i) => {
        const base = i < 2, lab = rowLabel(t);
        const nameHtml = base
          ? `<span class="pl-sname"><span class="pl-n pl-kind">${lab}</span>${t.e.name.toLowerCase() === lab.toLowerCase() ? "" : `<span class="pl-sub">${esc(t.e.name)}</span>`}</span>`
          : `<span class="pl-sname"><span class="pl-n">${esc(t.e.name)}</span><em class="pl-role">${ROLE_NAME[t.role]}</em></span>`;
        return `
      <div class="pl-row${t.lock ? " locked" : ""}${base ? " base" : ""}" data-row="${i}">
        <div class="pl-head">
          <button type="button" class="pl-sound" data-act="sound" data-t="${i}"${t.lock ? " disabled" : ""} title="${t.lock ? "Unlock the row to swap its sound" : `Click to swap the ${esc(base ? lab.toLowerCase() : "sound")} (${esc(t.e.name)})`}">${nameHtml}${ICON_SWAP}</button>
          <button type="button" class="pl-mini pl-lock${t.lock ? " on" : ""}" data-act="lock" data-t="${i}" aria-pressed="${t.lock}" aria-label="${esc(lab)}: lock row" title="${LOCK_TITLE}">${t.lock ? ICON_LOCK : ICON_UNLOCK}</button>
          <button type="button" class="pl-mini pl-mute${t.mute ? " on" : ""}" data-act="mute" data-t="${i}" aria-pressed="${t.mute}" title="Mute">M</button>
          <button type="button" class="pl-mini pl-solo${t.solo ? " on" : ""}" data-act="solo" data-t="${i}" aria-pressed="${t.solo}" title="Solo">S</button>
          <input type="range" class="pl-vol" data-t="${i}" min="0" max="9" step="1" value="${t.vol}" aria-label="${esc(lab)} volume">
          <button type="button" class="pl-mini gen-btn pl-regen" data-act="regen" data-t="${i}"${t.lock ? " disabled" : ""} aria-label="Regenerate this row" title="${t.lock ? "Unlock the row to regenerate it" : "Regenerate this row"}">${ICON_REGEN}</button>
        </div>
        <div class="pl-cells">${cellsHtml(i)}</div>
      </div>`;
      }).join("");
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

  // Genre/mood/density/complexity changed: same seed, new pattern (locked rows stay)
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

  // Set a step and update its cell
  function setCell(ti, si, v, doPreview) {
    const t = tracks[ti]; if (!t || t.steps[si] === v) return;
    t.steps[si] = v;
    const c = $("pl-grid").querySelector(`.pl-cell[data-t="${ti}"][data-s="${si}"]`);
    if (c) { c.classList.toggle("on", !!v); c.classList.toggle("acc", v === 2); c.setAttribute("aria-pressed", !!v); }
    if (v && doPreview) preview(ti, v);
  }

  // Swap the sound of one row (explicit click; locked rows are disabled). Perc: unused sound, else swap with another unlocked perc row.
  function swapSound(i) {
    const t = tracks[i]; if (t.lock) return;
    const used = tracks.filter((x, j) => poolName(j) === poolName(i)).map(x => x.e.url);
    const e = pick(poolFor(i), 1, used)[0];
    if (e) t.e = e;
    else if (i >= 2) {
      const others = [2, 3, 4].filter(j => j !== i && !tracks[j].lock);
      if (others.length) { const j = others[Math.floor(Math.random() * others.length)]; [t.e, tracks[j].e] = [tracks[j].e, t.e]; }
    }
    renderGrid(); saveHash(); prefetch();
    preview(i, 1);
  }
  // New sounds for all unlocked rows, patterns stay
  function shuffleSounds() {
    if (!ready) return;
    const lockedPerc = [2, 3, 4].filter(i => tracks[i].lock).map(i => tracks[i].e.url);
    if (!tracks[0].lock) { const e = pick(kickPool, 1, [tracks[0].e.url])[0]; if (e) tracks[0].e = e; }
    if (!tracks[1].lock) { const e = pick(clapPool, 1, [tracks[1].e.url])[0]; if (e) tracks[1].e = e; }
    const un = [2, 3, 4].filter(i => !tracks[i].lock), es = pick(percPool, un.length, lockedPerc);
    un.forEach((i, k) => { if (es[k]) tracks[i].e = es[k]; });
    renderGrid(); saveHash(); prefetch();
    if (ctx) ensureLoaded().catch(() => {});
    setStatus("New sounds picked. The patterns stay.");
  }

  // ---------- Clicks in the grid ----------
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
    if (c) {                                                // touch / keyboard (mouse goes through pointerdown)
      if (mouseHandled) return;
      const ti = +c.dataset.t, si = +c.dataset.s;
      setCell(ti, si, (tracks[ti].steps[si] + 1) % 3, true); saveHash(); return;
    }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const i = +b.dataset.t, t = tracks[i]; if (!t) return;
    if (b.dataset.act === "sound") swapSound(i);
    else if (b.dataset.act === "lock") { t.lock = !t.lock; renderGrid(); saveHash(); setStatus(t.lock ? `${rowLabel(t)} locked. Generate and Shuffle will leave it alone.` : ""); }
    else if (b.dataset.act === "mute") { t.mute = !t.mute; b.classList.toggle("on", t.mute); b.setAttribute("aria-pressed", t.mute); updateGains(); saveHash(); }
    else if (b.dataset.act === "solo") { t.solo = !t.solo; b.classList.toggle("on", t.solo); b.setAttribute("aria-pressed", t.solo); updateGains(); }
    else if (b.dataset.act === "regen") { if (t.lock) return; genRows([i], 1 + Math.floor(Math.random() * 1e6)); renderGrid(); saveHash(); }
  });
  grid.addEventListener("input", e => {
    const r = e.target.closest(".pl-vol"); if (!r) return;
    tracks[+r.dataset.t].vol = +r.value; updateGains(); saveHash();
  });

  // ---------- Controls ----------
  $("pl-genre").innerHTML = GENRE_KEYS.map((k, i) => `<option value="${k}">${GENRE_NAMES[i]}</option>`).join("");
  $("pl-mood").innerHTML = MOOD_KEYS.map((k, i) => `<option value="${k}">${MOOD_NAMES[i]}</option>`).join("");
  seg("pl-dens", DENS_NAMES, "density"); seg("pl-cx", CX_NAMES, "complexity");
  $("pl-genre").onchange = e => { state.genre = e.target.value; regenKeepSeed(); };
  $("pl-mood").onchange = e => { state.mood = e.target.value; regenKeepSeed(); };
  $("pl-bpm").oninput = e => { state.bpm = +e.target.value; touched.bpm = true; $("pl-bpm-val").textContent = state.bpm; saveHash(); };
  $("pl-swing").oninput = e => { state.swing = +e.target.value; touched.swing = true; $("pl-swing-val").textContent = state.swing + "%"; saveHash(); };
  $("pl-hum").oninput = e => { state.humanize = +e.target.value; $("pl-hum-val").textContent = state.humanize + "%"; saveHash(); };
  $("bl-play").onclick = toggle;
  $("pl-gen").onclick = () => { if (!ready) return; window.ylyTrack && ylyTrack("perclab-generate"); generateAll(true); renderAll(); setStatus(""); };
  $("pl-shuffle").onclick = shuffleSounds;
  $("pl-clear").onclick = () => { tracks.forEach(t => { if (!t.lock) t.steps = blankSteps(); }); renderGrid(); saveHash(); };
  document.addEventListener("keydown", e => {
    if (e.code !== "Space") return;
    const el = e.target, tag = el.tagName;
    if (el.isContentEditable || tag === "TEXTAREA" || tag === "SELECT" || (tag === "INPUT" && !/range|checkbox/.test(el.type)) || (el.classList && el.classList.contains("pl-cell")) || document.querySelector("dialog[open]")) return;
    e.preventDefault(); toggle();
  });
  document.addEventListener("keyup", e => {                  // stops a focused button from also "clicking"
    if (e.code === "Space" && e.target.tagName === "BUTTON" && !e.target.classList.contains("pl-cell") && !document.querySelector("dialog[open]")) e.preventDefault();
  });

  // ---------- Share ----------
  $("bl-share").onclick = async () => {
    if (!tracks.length) return;
    const url = shareUrl();
    try {
      if (navigator.share && matchMedia("(max-width: 760px)").matches) { await navigator.share({ title: "My percussion loop – YARDSLOVESYOU Perc Lab", url }); return; }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied! Send it to a friend – they'll hear exactly this loop.");
    } catch (_) { prompt("Copy this link:", url); }
  };

  // ---------- MIDI export (2 bars, one note per row: kick 36, clap 39, percussion by role) ----------
  function midiFile() {
    const PPQ = 96, T16 = PPQ / 4, ev = [];
    const swingTicks = s => s % 2 === 1 ? Math.round((state.swing / 100) * 0.55 * T16) : 0;
    for (let s = 0; s < STEPS; s++) tracks.forEach(t => {
      const v = t.steps[s]; if (!v || t.mute || (anySolo() && !t.solo)) return;
      const vel = Math.round(clamp((v === 2 ? 112 : 84) * (0.45 + 0.55 * t.vol / 9), 20, 127));
      const at = s * T16 + swingTicks(s), note = MIDI_NOTE[t.role] || 60;
      ev.push([at, [0x99, note, vel]], [at + Math.max(4, Math.round(T16 * 0.8)), [0x89, note, 0]]);
    });
    ev.sort((a, b) => a[0] - b[0] || (a[1][0] & 0xf0) - (b[1][0] & 0xf0));
    const vlq = n => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
    const tempo = Math.round(60000000 / state.bpm);
    const name = [..."YARDSLOVESYOU Perc Lab"].map(c => c.charCodeAt(0));
    const data = [0x00, 0xff, 0x03, name.length, ...name, 0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0x00, 0xff, 0x58, 0x04, 4, 2, 24, 8];
    let last = 0;
    ev.forEach(([tick, bytes]) => { data.push(...vlq(tick - last), ...bytes); last = tick; });
    const end = STEPS * T16;                                // ends exactly after 2 bars (clean loop)
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
    window.ylyTrack && ylyTrack("perclab-export-midi");
    setStatus("MIDI downloaded – 2 bars, one note per row (GM percussion, channel 10: kick 36, clap 39, timeline 75, steady 70, accent 56).");
  };

  // ---------- WAV and stems export (loop via OfflineAudioContext) ----------
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
        const v = t.steps[s], buf = bufCache[t.e.url];
        if (v && buf) playHit(off, g[i], buf, when, VEL[v]);
      });
    }
    const out = await off.startRendering();
    // Mix the tail back onto the start so the loop repeats seamlessly
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
        setStatus(`Rendering stems … ${rowLabel(t)}`);
        const nm = (t.role === "kick" || t.role === "clap" ? rowLabel(t) + " " + t.e.name : t.e.name + " " + ROLE_NAME[t.role]).replace(/[^\w -]/g, "");
        files.push({ name: `stems/${String(i + 1).padStart(2, "0")} ${nm}.wav`, data: wavBlob(await renderMix(i)) });
      }
      files.push({ name: "license.txt", data: new TextEncoder().encode("Made with the YARDSLOVESYOU Perc Lab (yardslovesyou.com/beatlab.html).\nThe sounds are royalty-free for use in your own music. You may not resell or share the sounds on their own.\nGet the full Essentials kit: https://yardslovesyou.com/shop.html\n") });
      download(zip(files), fileBase() + ".zip");
      window.ylyTrack && ylyTrack("perclab-export-wav");
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
      window.ylyTrack && ylyTrack("freekit-signup");
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
    touched.bpm = touched.swing = true;                     // values from a link are not overwritten automatically
    buildTracks(d.specs);
  }
  function freshStart() {
    state.genre = "trap"; state.mood = "bouncy"; state.density = 1; state.complexity = 0; state.humanize = 10;
    touched.bpm = touched.swing = false;
    const used = new Set();
    tracks = [0, 1, 2, 3, 4].map(i => {
      const e = pick(poolFor(i), 1, used)[0] || poolFor(i)[0]; used.add(e.url);
      return makeTrack(i, e);
    });
    generateAll(true);
  }
  const hashData = () => location.hash.startsWith("#b=") ? location.hash.slice(3) : "";
  const loadedMsg = d => d.ver === "p2" ? "You're listening to a shared loop – press play, then remix it!"
    : "Loaded an older Perc Lab / Beat Lab link – its percussion sits in the three percussion rows, kick and clap were added. Press play!";

  // Shared link while the page is already open
  window.addEventListener("hashchange", () => {
    const h = hashData();
    if (!ready || !h || h === currentHash()) return;
    const d = decodeHash(h);
    if (d) { stop(); applyDecoded(d); renderAll(); prefetch(); setStatus("Shared loop loaded – press play, then remix it!"); }
  });

  // Test hook (only with ?pltest in the address)
  if (/[?&]pltest\b/.test(location.search)) window.__plTest = {
    state, get tracks() { return tracks; }, set tracks(v) { tracks = v; }, generateAll, shuffleSounds, swapSound, genRows, encodeHash, decodeHash, applyDecoded, renderAll, genLoop, mulberry32,
    pools: () => ({ kickPool, clapPool, percPool }), GEN, CAP, TOT, GENRE_KEYS, MOOD_KEYS, currentHash,
  };

  (async function init() {
    setStatus("Loading sounds …");
    await loadPool();
    const h = hashData(), d = h ? decodeHash(h) : null;
    if (d) { applyDecoded(d); setStatus(loadedMsg(d)); }
    else { freshStart(); setStatus(""); }
    ready = true;
    renderAll(); prefetch();
    if (isUnlocked()) showUnlocked();
  })();
})();

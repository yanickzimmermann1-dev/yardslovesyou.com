/* =====================================================================
   BEAT LAB – Beatmaker im Browser mit den Sounds aus Essentials
   Läuft komplett im Browser: Abspielen, Teilen-Link, MIDI- und WAV-Export
   ===================================================================== */
(() => {
  const cfg = window.APP_CONFIG || {}, $ = id => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  const SOUND_BASE = window.BEATLAB_SOUND_BASE || `${cfg.SUPABASE_URL}/storage/v1/object/public/coverart-products/beatlab/beatlab-sounds%202/`;
  const STEPS = 16, BARS_EXPORT = 4;
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  // ---------- Spuren und Sounds ----------
  const TRACKS = [
    { id: "kick", name: "Kick", sounds: [["kick-1-anvil", "Anvil"], ["kick-2-titan", "Titan"], ["kick-3-boulder", "Boulder"]], midi: [36, 36, 36], vol: 0.9 },
    { id: "snare", name: "Snare", sounds: [["snare-1-whip", "Whip"], ["snare-2-crack", "Crack"], ["snare-3-blaze", "Blaze"]], midi: [38, 38, 38], vol: 0.75 },
    { id: "clap", name: "Clap", sounds: [["clap-1-fireworks", "Fireworks"], ["clap-2-velvet", "Velvet"], ["clap-3-ritual", "Ritual"]], midi: [39, 39, 39], vol: 0.75 },
    { id: "hat", name: "Hi-Hat", sounds: [["hat-1-sparrow", "Sparrow"], ["hat-2-ticker", "Ticker"], ["hat-3-glitter", "Glitter"]], midi: [42, 42, 42], vol: 0.5, rolls: true },
    { id: "openhat", name: "Open Hat", sounds: [["openhat-1-keeper", "Keeper"], ["openhat-2-dinged", "Dinged"], ["openhat-3-sniff", "Sniff"]], midi: [46, 46, 46], vol: 0.45 },
    { id: "perc", name: "Perc", sounds: [["perc-1-pebble", "Pebble"], ["perc-2-bamboo", "Bamboo"], ["perc-3-marble", "Marble"]], midi: [37, 76, 75], vol: 0.6 },
    { id: "808", name: "808", sounds: [["808-1-gravity", "Gravity"], ["808-2-monsoon", "Monsoon"], ["808-3-voltage", "Voltage"]], midi: [24, 24, 24], vol: 0.8, bass: true,
      tune: [-0.32, -1.56, 0] },   // Feinstimmung in Halbtönen, damit jedes 808 genau auf C klingt
  ];
  const BASS_OFFSETS = [0, 0, 7, 12];          // Stufe 1 = Grundton, 2 = Quinte, 3 = Oktave
  const BASS_LABEL = ["", "", "5", "8"];
  const ROLL_LABEL = ["", "", "×2", "×3"];

  // ---------- Presets ----------
  const P = s => s.split("").map(Number);
  const PRESETS = {
    "trap": { name: "Trap · 140", bpm: 140, swing: 0, key: 0, sound: { hat: 0, perc: 0, "808": 0 },
      steps: { kick: P("1000000100100000"), clap: P("0000000010000000"), hat: P("1010101010103020"), perc: P("0000001000000010"), "808": P("1000000100200000") } },
    "drill": { name: "Drill · 142", bpm: 142, swing: 0, key: 5, sound: { snare: 0, hat: 1, "808": 2 },
      steps: { kick: P("1000000001000100"), snare: P("0000000010000010"), hat: P("1001001010013010"), openhat: P("0000000000000001"), "808": P("1000000002000300") } },
    "boombap": { name: "Boom Bap · 90", bpm: 90, swing: 55, key: 9, sound: { kick: 0, snare: 2, hat: 0, perc: 0 },
      steps: { kick: P("1000001000100000"), snare: P("0000100000001000"), hat: P("1010101010101010"), openhat: P("0000000000000010"), perc: P("0000000100000001") } },
    "afro": { name: "Afro · 105", bpm: 105, swing: 20, key: 7, sound: { hat: 2, perc: 1, clap: 1 },
      steps: { kick: P("1000001000001000"), clap: P("0000100000001000"), hat: P("1111111111111111"), perc: P("0010010010010010"), "808": P("1000001000001000") } },
  };

  // ---------- Zustand ----------
  const blank = () => ({
    bpm: 140, swing: 0, key: 0,
    sound: Object.fromEntries(TRACKS.map(t => [t.id, 0])),
    vol: Object.fromEntries(TRACKS.map(t => [t.id, t.vol])),
    mute: Object.fromEntries(TRACKS.map(t => [t.id, false])),
    steps: Object.fromEntries(TRACKS.map(t => [t.id, Array(STEPS).fill(0)])),
  });
  let state = blank();

  function applyPreset(key) {
    const p = PRESETS[key]; if (!p) return;
    state = blank();
    state.bpm = p.bpm; state.swing = p.swing; state.key = p.key;
    Object.assign(state.sound, p.sound || {});
    for (const [id, arr] of Object.entries(p.steps)) state.steps[id] = arr.slice();
    renderAll();
  }

  // ---------- Teilen-Link (Zustand im URL-Hash) ----------
  function encodeState(s) {
    const parts = [
      "1", s.bpm, s.swing, s.key,
      TRACKS.map(t => s.sound[t.id]).join(""),
      TRACKS.map(t => Math.round(s.vol[t.id] * 9)).join(""),
      TRACKS.map(t => s.mute[t.id] ? 1 : 0).join(""),
      TRACKS.map(t => s.steps[t.id].join("")).join("."),
    ];
    return parts.join("-");
  }
  function decodeState(str) {
    try {
      const [v, bpm, swing, key, snd, vol, mute, steps] = str.split("-");
      if (v !== "1") return null;
      const s = blank();
      s.bpm = clamp(+bpm, 60, 200); s.swing = clamp(+swing, 0, 100); s.key = clamp(+key, 0, 11);
      const rows = steps.split(".");
      TRACKS.forEach((t, i) => {
        s.sound[t.id] = clamp(+snd[i] || 0, 0, t.sounds.length - 1);
        s.vol[t.id] = clamp((+vol[i]) / 9, 0, 1);
        s.mute[t.id] = mute[i] === "1";
        const r = (rows[i] || "").padEnd(STEPS, "0").slice(0, STEPS).split("").map(Number);
        s.steps[t.id] = r.map(x => clamp(isNaN(x) ? 0 : x, 0, t.rolls || t.bass ? 3 : 1));
      });
      return s;
    } catch (_) { return null; }
  }
  const clamp = (x, a, b) => Math.min(b, Math.max(a, isNaN(x) ? a : x));
  const shareUrl = () => `${location.origin}${location.pathname}#b=${encodeState(state)}`;

  // ---------- Audio ----------
  let ctx = null, master = null, trackGain = {};
  const buffers = {};                              // "kick-1-heavy" -> AudioBuffer
  let loading = null;

  function ensureAudio() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();        // sanfter Schutz gegen Übersteuern
    comp.threshold.value = -6; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp).connect(ctx.destination);
    TRACKS.forEach(t => { const g = ctx.createGain(); g.connect(master); trackGain[t.id] = g; });
    updateGains();
    return ctx;
  }
  function updateGains() {
    if (!ctx) return;
    TRACKS.forEach(t => trackGain[t.id].gain.value = state.mute[t.id] ? 0 : state.vol[t.id]);
  }

  async function loadSounds() {
    if (loading) return loading;
    ensureAudio();
    const names = TRACKS.flatMap(t => t.sounds.map(s => s[0]));
    let done = 0;
    setStatus("Loading sounds …");
    // Einzelne fehlende Sounds blockieren das Beat Lab nicht mehr
    loading = Promise.allSettled(names.map(async n => {
      const res = await fetch(SOUND_BASE + n + ".wav");
      if (!res.ok) throw new Error("Sound missing: " + n);
      buffers[n] = await ctx.decodeAudioData(await res.arrayBuffer());
      done++; setStatus(`Loading sounds … ${done}/${names.length}`);
    })).then(results => {
      const missing = results.filter(r => r.status === "rejected").length;
      if (missing === names.length) { loading = null; setStatus("Sounds could not be loaded. Please reload the page.", true); throw new Error("no sounds"); }
      if (missing) console.warn(`Beat Lab: ${missing} sound(s) missing`, results.filter(r => r.status === "rejected").map(r => r.reason && r.reason.message));
      setStatus("");
    });
    return loading;
  }

  // Einen Sound abspielen (auch für den Offline-Export nutzbar)
  function playSound(ac, dest, t, when, val, voices) {
    const name = t.sounds[state.sound[t.id]][0], buf = buffers[name];
    if (!buf) return;
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = 1;
    src.connect(g).connect(dest);
    if (t.bass) src.playbackRate.value = Math.pow(2, (state.key + BASS_OFFSETS[val] + ((t.tune || [])[state.sound[t.id]] || 0)) / 12);
    // Choke: neues 808 stoppt das alte, Closed Hat stoppt Open Hat
    const group = t.bass ? "808" : (t.id === "hat" || t.id === "openhat") ? "hats" : null;
    if (group && voices[group] && (t.bass || t.id === "hat")) {
      const v = voices[group];
      try { v.g.gain.setTargetAtTime(0, when, 0.008); v.src.stop(when + 0.06); } catch (_) {}
    }
    src.start(when);
    if (group) voices[group] = { src, g };
  }

  // Alle Schläge eines Schritts planen
  function scheduleStep(ac, destFor, step, time, stepDur, voices, onlyTrack) {
    TRACKS.forEach(t => {
      if (onlyTrack && t.id !== onlyTrack) return;
      const val = state.steps[t.id][step];
      if (!val) return;
      const dest = destFor(t.id);
      if (t.rolls && val > 1) {
        for (let k = 0; k < val; k++) playSound(ac, dest, t, time + k * stepDur / val, 1, voices);
      } else {
        playSound(ac, dest, t, time, val, voices);
      }
    });
  }
  const stepTime = (step, stepDur) => step % 2 === 1 ? (state.swing / 100) * stepDur * 0.33 : 0;

  // ---------- Transport (Look-ahead-Scheduler) ----------
  let playing = false, timer = null, nextTime = 0, curStep = 0, liveVoices = {};
  const queue = [];

  function tickScheduler() {
    const stepDur = 60 / state.bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      const t = nextTime + stepTime(curStep, stepDur);
      scheduleStep(ctx, id => trackGain[id], curStep, t, stepDur, liveVoices);
      queue.push({ step: curStep, time: t });
      nextTime += stepDur; curStep = (curStep + 1) % STEPS;
    }
  }
  function drawPlayhead() {
    if (!playing) return;
    let s = null;
    while (queue.length && queue[0].time <= ctx.currentTime) s = queue.shift().step;
    if (s !== null) {
      document.querySelectorAll(".bl-cell.now").forEach(c => c.classList.remove("now"));
      document.querySelectorAll(`.bl-cell[data-step="${s}"]`).forEach(c => c.classList.add("now"));
    }
    requestAnimationFrame(drawPlayhead);
  }
  async function play() {
    ensureAudio();
    if (ctx.state === "suspended") await ctx.resume();
    try { await loadSounds(); } catch (_) { return; }
    playing = true; curStep = 0; queue.length = 0; liveVoices = {};
    nextTime = ctx.currentTime + 0.05;
    tickScheduler(); timer = setInterval(tickScheduler, 25);
    $("bl-play").classList.add("playing"); $("bl-play").setAttribute("aria-label", "Stop");
    requestAnimationFrame(drawPlayhead);
  }
  function stop() {
    playing = false; clearInterval(timer);
    Object.values(liveVoices).forEach(v => { try { v.src.stop(); } catch (_) {} });
    document.querySelectorAll(".bl-cell.now").forEach(c => c.classList.remove("now"));
    $("bl-play").classList.remove("playing"); $("bl-play").setAttribute("aria-label", "Play");
  }
  const toggle = () => playing ? stop() : play();

  // Vorhören beim Klicken (nur wenn nicht abgespielt wird)
  async function preview(t, val) {
    if (playing) return;
    ensureAudio(); if (ctx.state === "suspended") await ctx.resume();
    try { await loadSounds(); } catch (_) { return; }
    const v = {};
    if (t.rolls && val > 1) { const d = 60 / state.bpm / 4; for (let k = 0; k < val; k++) playSound(ctx, trackGain[t.id], t, ctx.currentTime + 0.01 + k * d / val, 1, v); }
    else playSound(ctx, trackGain[t.id], t, ctx.currentTime + 0.01, val || 1, v);
  }

  // ---------- Oberfläche ----------
  function renderGrid() {
    $("bl-grid").innerHTML = TRACKS.map(t => `
      <div class="bl-row" data-track="${t.id}">
        <div class="bl-head">
          <span class="bl-name">${t.name}</span>
          <button type="button" class="bl-sound" data-sound="${t.id}" title="Change sound">${t.sounds[state.sound[t.id]][1]} <span aria-hidden="true">↻</span></button>
          <button type="button" class="bl-mute ${state.mute[t.id] ? "on" : ""}" data-mute="${t.id}" aria-pressed="${state.mute[t.id]}" title="Mute">M</button>
          <input type="range" class="bl-vol" data-vol="${t.id}" min="0" max="1" step="0.05" value="${state.vol[t.id]}" aria-label="${t.name} volume">
        </div>
        <div class="bl-cells">
          ${state.steps[t.id].map((v, i) => `<button type="button" class="bl-cell ${v ? "on" : ""} ${i % 4 === 0 ? "beat" : ""}" data-cell="${t.id}" data-step="${i}" aria-pressed="${!!v}" aria-label="${t.name} step ${i + 1}">${v > 1 ? (t.rolls ? ROLL_LABEL[v] : BASS_LABEL[v]) : ""}</button>`).join("")}
        </div>
      </div>`).join("");
  }
  function renderControls() {
    $("bl-bpm").value = state.bpm; $("bl-bpm-val").textContent = state.bpm;
    $("bl-swing").value = state.swing; $("bl-swing-val").textContent = state.swing + "%";
    $("bl-key").value = state.key;
    updateGains();
  }
  function renderAll() { renderControls(); renderGrid(); saveHash(); }

  let hashTimer = null;
  function saveHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => { try { history.replaceState(null, "", "#b=" + encodeState(state)); } catch (_) {} }, 300);
  }

  function setStatus(msg, bad) {
    const el = $("bl-status"); el.textContent = msg; el.classList.toggle("danger", !!bad);
  }

  // Klicks im Raster
  $("bl-grid").addEventListener("click", e => {
    const cell = e.target.closest("[data-cell]"), snd = e.target.closest("[data-sound]"), mute = e.target.closest("[data-mute]");
    if (cell) {
      const t = TRACKS.find(x => x.id === cell.dataset.cell), i = +cell.dataset.step;
      const max = t.rolls || t.bass ? 3 : 1;
      const v = (state.steps[t.id][i] + 1) % (max + 1);
      state.steps[t.id][i] = v;
      cell.classList.toggle("on", !!v); cell.setAttribute("aria-pressed", !!v);
      cell.textContent = v > 1 ? (t.rolls ? ROLL_LABEL[v] : BASS_LABEL[v]) : "";
      if (v) preview(t, v);
      saveHash();
    } else if (snd) {
      const t = TRACKS.find(x => x.id === snd.dataset.sound);
      state.sound[t.id] = (state.sound[t.id] + 1) % t.sounds.length;
      snd.innerHTML = `${t.sounds[state.sound[t.id]][1]} <span aria-hidden="true">↻</span>`;
      preview(t, 1); saveHash();
    } else if (mute) {
      const id = mute.dataset.mute;
      state.mute[id] = !state.mute[id];
      mute.classList.toggle("on", state.mute[id]); mute.setAttribute("aria-pressed", state.mute[id]);
      updateGains(); saveHash();
    }
  });
  $("bl-grid").addEventListener("input", e => {
    const r = e.target.closest("[data-vol]"); if (!r) return;
    state.vol[r.dataset.vol] = +r.value; updateGains(); saveHash();
  });

  // Steuerelemente
  $("bl-key").innerHTML = NOTES.map((n, i) => `<option value="${i}">${n}</option>`).join("");
  $("bl-preset").innerHTML = `<option value="">Presets …</option>` + Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.name}</option>`).join("");
  $("bl-play").onclick = toggle;
  $("bl-bpm").oninput = e => { state.bpm = +e.target.value; $("bl-bpm-val").textContent = state.bpm; saveHash(); };
  $("bl-swing").oninput = e => { state.swing = +e.target.value; $("bl-swing-val").textContent = state.swing + "%"; saveHash(); };
  $("bl-key").onchange = e => { state.key = +e.target.value; saveHash(); };
  $("bl-preset").onchange = e => { if (e.target.value) applyPreset(e.target.value); e.target.value = ""; };
  $("bl-clear").onclick = () => { TRACKS.forEach(t => state.steps[t.id] = Array(STEPS).fill(0)); renderGrid(); saveHash(); };
  $("bl-random").onclick = () => { randomize(); renderAll(); };
  document.addEventListener("keydown", e => {
    if (e.code === "Space" && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); toggle(); }
  });

  // ---------- Zufall (musikalisch sinnvoll) ----------
  function randomize() {
    const r = n => Math.floor(Math.random() * n), chance = p => Math.random() < p;
    const st = Object.fromEntries(TRACKS.map(t => [t.id, Array(STEPS).fill(0)]));
    const style = ["trap", "drill", "boombap", "afro"][r(4)];
    state.bpm = { trap: 130 + r(16), drill: 138 + r(8), boombap: 84 + r(12), afro: 98 + r(14) }[style];
    state.swing = style === "boombap" ? 45 + r(20) : style === "afro" ? 10 + r(20) : 0;
    state.key = r(12);
    TRACKS.forEach(t => state.sound[t.id] = r(t.sounds.length));
    st.kick[0] = 1;
    [3, 6, 7, 10, 11, 14].forEach(i => { if (chance(0.3)) st.kick[i] = 1; });
    const back = style === "boombap" || style === "afro" ? [4, 12] : [8];
    const snareRow = chance(0.5) ? "clap" : "snare";
    back.forEach(i => st[snareRow][i] = 1);
    if (chance(0.3)) st[snareRow][15] = 1;
    for (let i = 0; i < STEPS; i += (style === "afro" ? 1 : 2)) st.hat[i] = 1;
    if (style === "trap" || style === "drill") for (let k = 0; k < 2; k++) st.hat[2 * (4 + r(4))] = 2 + r(2);
    if (chance(0.5)) st.openhat[14] = 1;
    for (let i = 0; i < STEPS; i++) if (chance(0.12) && !st.kick[i]) st.perc[i] = 1;
    if (style !== "boombap") st.kick.forEach((v, i) => { if (v) st["808"][i] = chance(0.25) ? 2 + r(2) : 1; });
    state.steps = st;
  }

  // ---------- Teilen ----------
  $("bl-share").onclick = async () => {
    const url = shareUrl();
    try {
      if (navigator.share && matchMedia("(max-width: 760px)").matches) { await navigator.share({ title: "My beat – YARDSLOVESYOU Beat Lab", url }); return; }
      await navigator.clipboard.writeText(url);
      setStatus("Link copied! Send it to a friend – they'll hear exactly this beat.");
    } catch (_) {
      prompt("Copy this link:", url);
    }
  };

  // ---------- MIDI-Export ----------
  function midiFile() {
    const PPQ = 96, T16 = PPQ / 4;
    const ev = [];                                            // [tick, bytes]
    const swingTicks = s => s % 2 === 1 ? Math.round((state.swing / 100) * T16 * 0.33) : 0;
    for (let bar = 0; bar < BARS_EXPORT; bar++) {
      for (let s = 0; s < STEPS; s++) {
        const base = (bar * STEPS + s) * T16 + swingTicks(s);
        TRACKS.forEach(t => {
          const v = state.steps[t.id][s]; if (!v || state.mute[t.id]) return;
          const vel = Math.round(clamp(110 * state.vol[t.id] / t.vol, 40, 127));
          if (t.bass) {
            const note = t.midi[0] + state.key + BASS_OFFSETS[v];
            let len = T16 * 2;                                // bis zum nächsten 808 oder 2 Schritte
            for (let k = 1; k <= STEPS; k++) { if (state.steps[t.id][(s + k) % STEPS]) { len = k * T16; break; } }
            ev.push([base, [0x90, note, vel]], [base + len - 1, [0x80, note, 0]]);
          } else {
            const note = t.midi[state.sound[t.id]];
            const hits = t.rolls && v > 1 ? v : 1;
            for (let k = 0; k < hits; k++) {
              const at = base + Math.round(k * T16 / hits);
              ev.push([at, [0x99, note, vel]], [at + Math.max(2, Math.round(T16 / hits / 2)), [0x89, note, 0]]);
            }
          }
        });
      }
    }
    ev.sort((a, b) => a[0] - b[0] || (a[1][0] & 0xf0) - (b[1][0] & 0xf0));
    const vlq = n => { const out = [n & 0x7f]; while ((n >>= 7)) out.unshift((n & 0x7f) | 0x80); return out; };
    const tempo = Math.round(60000000 / state.bpm);
    const name = [..."YARDSLOVESYOU Beat Lab"].map(c => c.charCodeAt(0));
    let data = [0x00, 0xff, 0x03, name.length, ...name, 0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255,
      0x00, 0xff, 0x58, 0x04, 4, 2, 24, 8];
    let last = 0;
    ev.forEach(([tick, bytes]) => { data.push(...vlq(tick - last), ...bytes); last = tick; });
    data.push(0x00, 0xff, 0x2f, 0x00);
    const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const bytes = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (PPQ >> 8) & 255, PPQ & 255,
      0x4d, 0x54, 0x72, 0x6b, ...u32(data.length), ...data];
    return new Blob([new Uint8Array(bytes)], { type: "audio/midi" });
  }
  function download(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileBase = () => `yardslovesyou-beat-${state.bpm}bpm-${NOTES[state.key].replace("#", "s")}`;
  $("bl-midi").onclick = () => { download(midiFile(), fileBase() + ".mid"); setStatus("MIDI downloaded – drag it into your DAW. Drums are on channel 10, the 808 on channel 1."); };

  // ---------- WAV- und Stems-Export ----------
  async function renderMix(onlyTrack) {
    const SR = 44100, stepDur = 60 / state.bpm / 4;
    const len = Math.ceil((BARS_EXPORT * STEPS * stepDur + 2.5) * SR);
    const off = new OfflineAudioContext(2, len, SR);
    const m = off.createGain(); m.gain.value = 0.9; m.connect(off.destination);
    const g = {};
    TRACKS.forEach(t => { g[t.id] = off.createGain(); g[t.id].gain.value = state.mute[t.id] && !onlyTrack ? 0 : state.vol[t.id]; g[t.id].connect(m); });
    const voices = {};
    for (let bar = 0; bar < BARS_EXPORT; bar++)
      for (let s = 0; s < STEPS; s++) {
        const t0 = (bar * STEPS + s) * stepDur + stepTime(s, stepDur);
        scheduleStep(off, id => g[id], s, t0, stepDur, voices, onlyTrack);
      }
    return off.startRendering();
  }
  function wavBlob(buf) {
    // Spitzen auf -1 dBFS begrenzen, damit nichts clippt
    let pk = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }
    const gain = pk > 0.891 ? 0.891 / pk : 1;
    const n = buf.length, ch = 2, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
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
      ensureAudio(); await loadSounds();
      setStatus("Rendering your beat …");
      const files = [{ name: fileBase() + " - full beat.wav", data: wavBlob(await renderMix()) }];
      for (const t of TRACKS) {
        if (!state.steps[t.id].some(Boolean)) continue;
        setStatus(`Rendering stems … ${t.name}`);
        files.push({ name: `stems/${t.name.replace(/\s/g, "")}.wav`, data: wavBlob(await renderMix(t.id)) });
      }
      files.push({ name: "license.txt", data: new TextEncoder().encode("Made with the YARDSLOVESYOU Beat Lab (yardslovesyou.com/beatlab.html).\nThe sounds are royalty-free for use in your own music. You may not resell or share the sounds on their own.\nGet the full Essentials kit: https://yardslovesyou.com/shop.html\n") });
      download(zip(files), fileBase() + ".zip");
      setStatus("Done! Your beat and stems are downloading (4 bars, WAV).");
    } catch (e) {
      setStatus("Export failed. Please try again.", true);
    } finally { btn.disabled = false; }
  }

  // ---------- Freischalten per E-Mail (nutzt die bestehende free-kit Function) ----------
  const UNLOCK_KEY = "yly_beatlab_unlocked";
  const isUnlocked = () => { try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch (_) { return false; } };
  function showUnlocked() {
    $("bl-wav").classList.remove("locked"); $("bl-wav").innerHTML = "Download WAV + stems";
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
      const db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await db.functions.invoke("free-kit", { body: { email, marketing_consent: $("bl-consent").checked } });
      if (error) { let m = error.message; try { const j = await error.context.json(); if (j?.error) m = j.error; } catch (_) {} throw new Error(m); }
      if (!data?.ok) throw new Error(data?.error || "Something went wrong.");
      try { localStorage.setItem(UNLOCK_KEY, "1"); } catch (_) {}
      showUnlocked();
      setStatus("Unlocked! Essentials Lite is on its way to your inbox. Exporting your beat …");
      exportWav();
    } catch (err) {
      st.textContent = err.message || "Something went wrong. Please try again."; st.classList.add("danger");
    } finally { btn.disabled = false; btn.textContent = "Unlock & download"; }
  };

  // Geteilter Link, während die Seite schon offen ist
  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#b=") || location.hash.slice(3) === encodeState(state)) return;
    const s = decodeState(location.hash.slice(3));
    if (s) { state = s; renderControls(); renderGrid(); setStatus("Shared beat loaded – press play, then remix it!"); }
  });

  // ---------- Start ----------
  const fromHash = location.hash.startsWith("#b=") ? decodeState(location.hash.slice(3)) : null;
  if (fromHash) { state = fromHash; setStatus("You're listening to a shared beat – press play, then remix it!"); renderAll(); }
  else applyPreset("trap");
  if (isUnlocked()) showUnlocked();
})();

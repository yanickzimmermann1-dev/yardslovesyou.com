/* =====================================================================
   MIX CHECK – Analyse-Engine (läuft komplett im Browser, nichts wird hochgeladen)
   Misst: Integrated Loudness (LUFS, ITU-R BS.1770), True Peak (4x Oversampling),
   Clipping, Dynamik (PLR), Frequenzbalance, Stereo-Korrelation, Mono-Kompatibilität Bass
   ===================================================================== */
(() => {
  const MAX_SECONDS = 12 * 60;
  const MAX_BYTES = 250 * 1024 * 1024;
  const tick = () => new Promise(r => setTimeout(r, 0));
  const db = x => 10 * Math.log10(Math.max(x, 1e-12));
  const lin2db = x => 20 * Math.log10(Math.max(x, 1e-9));

  // ---------- Biquad-Filter (Direct Form I) ----------
  function biquad(input, c) {
    const out = new Float32Array(input.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < input.length; i++) {
      const x = input[i];
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y; out[i] = y;
    }
    return out;
  }

  // K-Weighting nach BS.1770 (Koeffizienten für jede Samplerate)
  function kWeightingCoeffs(fs) {
    let f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    let K = Math.tan(Math.PI * f0 / fs);
    const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    let a0 = 1 + K / Q + K * K;
    const shelf = {
      b0: (Vh + Vb * K / Q + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q + K * K) / a0,
      a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0,
    };
    f0 = 38.13547087602444; Q = 0.5003270373238773;
    K = Math.tan(Math.PI * f0 / fs);
    a0 = 1 + K / Q + K * K;
    const hp = { b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
    return [shelf, hp];
  }

  function lowpassCoeffs(fs, f0, Q = 0.7071) {
    const w = 2 * Math.PI * f0 / fs, cs = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al;
    return { b0: (1 - cs) / 2 / a0, b1: (1 - cs) / a0, b2: (1 - cs) / 2 / a0, a1: -2 * cs / a0, a2: (1 - al) / a0 };
  }

  // ---------- Integrated Loudness (LUFS) ----------
  function integratedLoudness(channels, fs) {
    const [s1, s2] = kWeightingCoeffs(fs);
    const seg = Math.round(fs * 0.1);               // 100-ms-Segmente
    const nSeg = Math.floor(channels[0].length / seg);
    const segSum = new Float64Array(nSeg);
    for (const ch of channels) {
      const w = biquad(biquad(ch, s1), s2);
      for (let s = 0; s < nSeg; s++) {
        let sum = 0; const off = s * seg;
        for (let i = 0; i < seg; i++) { const v = w[off + i]; sum += v * v; }
        segSum[s] += sum;
      }
    }
    const blocks = [];                               // 400-ms-Blöcke, 75 % Überlappung
    for (let s = 0; s + 4 <= nSeg; s++) blocks.push((segSum[s] + segSum[s + 1] + segSum[s + 2] + segSum[s + 3]) / (4 * seg));
    const L = z => -0.691 + db(z);
    const abs = blocks.filter(z => L(z) > -70);
    if (!abs.length) return -70;
    const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const gated = abs.filter(z => L(z) > rel);
    if (!gated.length) return -70;
    return L(gated.reduce((a, b) => a + b, 0) / gated.length);
  }

  // ---------- Sample Peak, True Peak (4x), Clipping ----------
  const TAPS = 16;
  const PHASES = [0.25, 0.5, 0.75].map(p => {
    const h = new Float32Array(2 * TAPS);
    for (let k = -TAPS + 1; k <= TAPS; k++) {
      const t = k - p, x = Math.PI * t;
      const sinc = t === 0 ? 1 : Math.sin(x) / x;
      const win = 0.5 + 0.5 * Math.cos(Math.PI * t / (TAPS + 0.5));
      h[k + TAPS - 1] = sinc * win;
    }
    return h;
  });

  function peaks(ch) {
    let sp = 0;
    for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > sp) sp = a; }
    // Clipping: mindestens 3 aufeinanderfolgende Samples am Anschlag
    let clips = 0, run = 0;
    const lim = Math.min(0.999, sp * 0.9995);
    for (let i = 0; i < ch.length; i++) {
      if (Math.abs(ch[i]) >= lim && sp >= 0.98) { run++; if (run === 3) clips++; } else run = 0;
    }
    // True Peak: Zwischenwerte nur dort berechnen, wo das Signal nahe am Maximum ist
    let tp = sp; const thr = sp * 0.7;
    for (let i = TAPS; i < ch.length - TAPS; i++) {
      if (Math.abs(ch[i]) < thr && Math.abs(ch[i + 1]) < thr) continue;
      for (const h of PHASES) {
        let y = 0;
        for (let k = 0; k < 2 * TAPS; k++) y += ch[i - TAPS + 1 + k] * h[k];
        const a = Math.abs(y); if (a > tp) tp = a;
      }
    }
    return { sp, tp, clips };
  }

  // ---------- Spektrum (gemittelte FFT) ----------
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }

  function bandLevels(mono, fs) {
    const N = 4096, frames = Math.min(500, Math.floor(mono.length / N));
    const power = new Float64Array(N / 2);
    const hann = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
    const step = Math.max(N, Math.floor((mono.length - N) / Math.max(frames, 1)));
    let used = 0;
    for (let f = 0; f < frames; f++) {
      const off = f * step; if (off + N > mono.length) break;
      let e = 0;
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < N; i++) { const v = mono[off + i]; re[i] = v * hann[i]; e += v * v; }
      if (e / N < 1e-7) continue;                    // Stille überspringen
      fft(re, im);
      for (let k = 0; k < N / 2; k++) power[k] += re[k] * re[k] + im[k] * im[k];
      used++;
    }
    const band = (lo, hi) => {
      let s = 0;
      for (let k = Math.ceil(lo * N / fs); k <= Math.min(N / 2 - 1, Math.floor(hi * N / fs)); k++) s += power[k];
      return s;
    };
    const sub = band(20, 60), bass = band(60, 250), lowmid = band(250, 2000), highmid = band(2000, 6000), air = band(6000, 20000);
    const mids = lowmid + highmid;
    return {
      used,
      lowEnd: db(sub + bass) - db(mids),            // Tiefen gegenüber Mitten (dB)
      highs: db(air) - db(mids),                    // Höhen gegenüber Mitten (dB)
    };
  }

  // ---------- Stereo ----------
  function correlation(a, b) {
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return aa && bb ? ab / Math.sqrt(aa * bb) : 1;
  }

  // ---------- Original-Samplerate aus dem Dateikopf lesen ----------
  // (damit der Browser beim Dekodieren nicht umrechnet – das würde die Spitzenwerte verfälschen)
  function sniffSampleRate(buf) {
    const v = new DataView(buf), n = buf.byteLength;
    const str = (o, l) => o + l <= n ? String.fromCharCode(...new Uint8Array(buf, o, l)) : "";
    try {
      if (str(0, 4) === "RIFF" && str(8, 4) === "WAVE") {          // WAV
        for (let o = 12; o + 8 <= n;) {
          const id = str(o, 4), size = v.getUint32(o + 4, true);
          if (id === "fmt ") return v.getUint32(o + 12, true);
          o += 8 + size + (size & 1);
        }
      }
      if (str(0, 4) === "FORM" && (str(8, 4) === "AIFF" || str(8, 4) === "AIFC")) {   // AIFF
        for (let o = 12; o + 8 <= n;) {
          const id = str(o, 4), size = v.getUint32(o + 4, false);
          if (id === "COMM") {
            const e = v.getUint16(o + 16, false) & 0x7fff, m = v.getUint32(o + 18, false);
            return Math.round(m * Math.pow(2, e - 16383 - 31));
          }
          o += 8 + size + (size & 1);
        }
      }
      if (str(0, 4) === "fLaC") return (v.getUint32(18, false) >>> 12);              // FLAC
      let o = 0;                                                                       // MP3 (ID3 überspringen)
      if (str(0, 3) === "ID3") o = 10 + ((v.getUint8(6) << 21) | (v.getUint8(7) << 14) | (v.getUint8(8) << 7) | v.getUint8(9));
      for (const end = Math.min(n - 4, o + 65536); o < end; o++) {
        if (v.getUint8(o) === 0xff && (v.getUint8(o + 1) & 0xe0) === 0xe0) {
          const ver = (v.getUint8(o + 1) >> 3) & 3, idx = (v.getUint8(o + 2) >> 2) & 3;
          if (idx === 3 || ver === 1) continue;
          const base = [44100, 48000, 32000][idx];
          return ver === 3 ? base : ver === 2 ? base / 2 : base / 4;
        }
      }
    } catch (_) {}
    return 0;
  }

  // ---------- Hauptfunktion ----------
  async function analyze(file, onProgress = () => {}) {
    if (file.size > MAX_BYTES) throw new Error("This file is too large (max. 250 MB).");
    onProgress(5, "Reading your file …");
    const data = await file.arrayBuffer();
    await tick();
    onProgress(15, "Decoding audio …");
    const AC = window.AudioContext || window.webkitAudioContext;
    const rate = sniffSampleRate(data);
    let ctx;
    try { ctx = rate >= 8000 && rate <= 384000 ? new AC({ sampleRate: rate }) : new AC(); }
    catch (_) { ctx = new AC(); }
    let audio;
    try { audio = await ctx.decodeAudioData(data); }
    catch (_) { throw new Error("This file could not be read. Please use a WAV, MP3, AIFF or FLAC file."); }
    finally { if (ctx.close) ctx.close(); }
    if (audio.duration > MAX_SECONDS) throw new Error("Please use a track shorter than 12 minutes.");
    if (audio.duration < 5) throw new Error("This track is too short to analyse (min. 5 seconds).");

    const fs = audio.sampleRate;
    const L = audio.getChannelData(0);
    const R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
    const channels = audio.numberOfChannels > 1 ? [L, R] : [L];

    onProgress(30, "Measuring loudness …"); await tick();
    const lufs = integratedLoudness(channels, fs);

    onProgress(55, "Checking peaks …"); await tick();
    const pL = peaks(L), pR = channels.length > 1 ? peaks(R) : pL;
    const samplePeak = lin2db(Math.max(pL.sp, pR.sp));
    const truePeak = lin2db(Math.max(pL.tp, pR.tp));
    const clips = pL.clips + (channels.length > 1 ? pR.clips : 0);

    onProgress(72, "Analysing frequencies …"); await tick();
    const mono = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
    const bands = bandLevels(mono, fs);

    onProgress(88, "Checking the stereo image …"); await tick();
    const isMono = channels.length === 1 || correlation(L, R) > 0.9999;
    const corr = channels.length > 1 ? correlation(L, R) : 1;
    let lowCorr = 1;
    if (channels.length > 1) {
      const lp = lowpassCoeffs(fs, 120);
      lowCorr = correlation(biquad(L, lp), biquad(R, lp));
    }

    onProgress(100, "Done");
    return {
      duration: audio.duration, sampleRate: fs, channels: audio.numberOfChannels,
      lufs, truePeak, samplePeak, plr: truePeak - lufs, clips,
      lowEnd: bands.lowEnd, highs: bands.highs, silent: bands.used === 0,
      correlation: corr, lowCorrelation: lowCorr, isMono,
    };
  }

  // ---------- Bewertung (Regeln) ----------
  // Jede Prüfung liefert einen Code. Texte dazu stehen in free.js (kurz) und in der E-Mail (ausführlich).
  const f1 = n => (Math.round(n * 10) / 10).toFixed(1).replace("-", "-");
  const sign = n => (n >= 0 ? "+" : "-") + Math.abs(Math.round(n * 10) / 10).toFixed(1);

  function evaluate(m, mode) {
    const checks = [];
    const add = (group, code, value) => checks.push({ group, code, value });

    if (mode === "master") {
      const l = m.lufs;
      add("loudness", l > -6 ? "loud_too_hot" : l > -8 ? "loud_hot" : l >= -12 ? "loud_good" : l >= -16 ? "loud_moderate" : "loud_quiet", `${f1(l)} LUFS`);
      add("peaks", m.clips > 0 ? "clipping" : m.truePeak > 0 ? "tp_over" : m.truePeak > -1 ? "tp_tight" : "tp_good",
        `${f1(m.truePeak)} dBTP${m.clips ? ` · ${m.clips} clip${m.clips > 1 ? "s" : ""}` : ""}`);
      add("dynamics", m.plr < 6 ? "dyn_squashed" : m.plr < 8 ? "dyn_dense" : m.plr <= 14 ? "dyn_good" : "dyn_open", `PLR ${f1(m.plr)} dB`);
    } else {
      const l = m.lufs;
      add("loudness", l > -12 ? "mixloud_hot" : l >= -24 ? "mixloud_good" : "mixloud_quiet", `${f1(l)} LUFS`);
      add("peaks", m.clips > 0 || m.samplePeak > -0.1 ? "mixpeak_clip" : m.samplePeak > -3 ? "mixpeak_hot" : m.samplePeak >= -12 ? "mixpeak_good" : "mixpeak_low",
        `${f1(m.samplePeak)} dBFS peak`);
      add("dynamics", m.plr < 8 ? "mixdyn_squashed" : "mixdyn_good", `PLR ${f1(m.plr)} dB`);
    }

    add("tone", m.lowEnd < -2 ? "low_thin" : m.lowEnd > 14 ? "low_boomy" : "low_good", `Low end ${sign(m.lowEnd)} dB`);
    add("tone", m.highs < -26 ? "high_dull" : m.highs > -6 ? "high_harsh" : "high_good", `Highs ${sign(m.highs)} dB`);

    if (m.isMono) {
      add("stereo", "st_monofile", "Mono");
    } else {
      add("stereo", m.correlation < 0 ? "st_phase" : m.correlation < 0.3 ? "st_wide" : m.correlation > 0.95 ? "st_narrow" : "st_good",
        `Correlation ${m.correlation.toFixed(2)}`);
      add("stereo", m.lowCorrelation < 0.8 ? "lowmono_bad" : "lowmono_good", `Low end mono ${m.lowCorrelation.toFixed(2)}`);
    }
    return checks;
  }

  window.MixCheck = { analyze, evaluate };
})();

/* =====================================================================
   m4a-encode.js - Audio im Browser dekodieren, kuerzen, nach AAC-LC (.m4a) wandeln.
   window.M4A = { supported(), decode(arrayBuffer), peaks(buf, start, dur, n),
                  encode(buf, start, dur, onProgress) -> Blob, verify(blob) -> seconds }
   Braucht WebCodecs AudioEncoder (Chrome, Edge, Safari) + vendor/mp4-muxer.min.js
   ===================================================================== */
window.M4A = (() => {
  const RATE = 44100, BITRATE = 128000, MAX_SEC = 30;
  const CFG = { codec: "mp4a.40.2", sampleRate: RATE, numberOfChannels: 2, bitrate: BITRATE };
  const NO_SUPPORT = "Your browser can't convert audio yet – please use Chrome, Edge or Safari.";

  const hasApi = () => typeof window.AudioEncoder === "function" && typeof window.AudioData === "function" && !!window.Mp4Muxer;
  async function supported() {
    if (!hasApi()) return false;
    try { const r = await AudioEncoder.isConfigSupported(CFG); return !!(r && r.supported); } catch (_) { return false; }
  }

  // Datei -> AudioBuffer (immer 44,1 kHz, damit alles gleich weiterlaeuft)
  async function decode(arrayBuffer) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) throw new Error("Your browser can't read audio here.");
    const c = new OAC(2, RATE, RATE);
    try {
      return await new Promise((res, rej) => { const p = c.decodeAudioData(arrayBuffer, res, rej); if (p && p.catch) p.catch(rej); });
    } catch (_) { throw new Error("That file could not be read. Try an MP3, WAV, M4A, FLAC or OGG file."); }
  }

  // Zwei Kanaele (Mono wird verdoppelt), Ausschnitt start..start+dur
  function slice(buf, start, dur) {
    const sr = buf.sampleRate, a = Math.max(0, Math.floor(start * sr));
    const n = Math.max(1, Math.min(buf.length - a, Math.floor(dur * sr)));
    const L = buf.getChannelData(0).subarray(a, a + n);
    const R = (buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0)).subarray(a, a + n);
    return { L, R, n, sr };
  }

  // n Spitzenwerte 0-255 (relativ zur lautesten Stelle)
  function peaks(buf, start, dur, n = 120) {
    const { L, R, n: len } = slice(buf, start, dur), out = new Array(n).fill(0);
    let max = 1e-6;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * len / n), b = Math.max(a + 1, Math.floor((i + 1) * len / n));
      let m = 0;
      for (let j = a; j < b; j += 4) { const v = Math.max(Math.abs(L[j]), Math.abs(R[j])); if (v > m) m = v; }
      out[i] = m; if (m > max) max = m;
    }
    return out.map(v => Math.round(Math.min(1, v / max) * 255));
  }

  async function encode(buf, start, dur, onProgress) {
    if (!(await supported())) throw new Error(NO_SUPPORT);
    dur = Math.min(dur, MAX_SEC);
    const { L, R, n, sr } = slice(buf, start, dur);
    if (sr !== RATE) throw new Error("Unexpected sample rate.");
    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({ target, audio: { codec: "aac", numberOfChannels: 2, sampleRate: RATE }, fastStart: "in-memory" });
    let err = null;
    const enc = new AudioEncoder({
      output: (chunk, meta) => { try { muxer.addAudioChunk(chunk, meta); } catch (e) { err = e; } },
      error: e => { err = e; }
    });
    enc.configure(CFG);
    const FR = 4096;     // Frames pro Block
    for (let i = 0; i < n && !err; i += FR) {
      const m = Math.min(FR, n - i), data = new Float32Array(m * 2);
      data.set(L.subarray(i, i + m), 0); data.set(R.subarray(i, i + m), m);   // f32-planar
      const ad = new AudioData({ format: "f32-planar", sampleRate: RATE, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round(i / RATE * 1e6), data });
      enc.encode(ad); ad.close();
      if (enc.encodeQueueSize > 16) await new Promise(r => setTimeout(r, 0));
      if (onProgress && (i / FR) % 20 === 0) onProgress(i / n);
    }
    await enc.flush(); enc.close();
    if (err) throw new Error("The audio could not be converted (" + (err.message || err) + ").");
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: "audio/mp4" });
    if (onProgress) onProgress(1);
    return blob;
  }

  // Prueft, ob das Ergebnis in einem <audio>-Element abspielbar ist; liefert die Dauer in Sekunden
  function verify(blob) {
    return new Promise((res, rej) => {
      const a = new Audio(), url = URL.createObjectURL(blob);
      const done = (fn, v) => { clearTimeout(t); a.removeAttribute("src"); URL.revokeObjectURL(url); fn(v); };
      const t = setTimeout(() => done(rej, new Error("The converted file does not play in this browser.")), 8000);
      a.preload = "metadata";
      a.onloadedmetadata = () => done(res, isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => done(rej, new Error("The converted file does not play in this browser."));
      a.src = url;
    });
  }

  return { supported, decode, peaks, encode, verify, MAX_SEC, NO_SUPPORT };
})();

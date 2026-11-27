/* gumball-engine.js - the ONLY thing gumball.js talks to.
 *
 * Contract (the WebAssembly engine will implement the same three calls):
 *
 *   GumballEngine.scan(files, onProgress) -> Promise<session>
 *     files:      array of File objects (or demo track descriptors {name, duration, demo:true})
 *     onProgress: ({ index, name, progress 0 to 1, stage }) called while a track is analysed
 *     session:    { demo:bool, key, bpm, suggestedName, tracks:[{name,duration}],
 *                   hits:[{ id, type, track (index), trackName, merged, quality, note, tonal, dur, thumb:[min,max,...] }] }
 *
 *   GumballEngine.roll(hitId, seedOrNull) -> Promise<variant>
 *     variant:    { id, flavour, flavourId, rarity:'common'|'rare'|'epic'|'legendary', desc, seed }
 *
 *   GumballEngine.getAudio(hitId, variantIdOrNull) -> Promise<ArrayBuffer>   (WAV bytes; null = the original hit)
 *
 * Two engines implement this contract:
 *   - WasmEngine: the real Gumball engine (C++ compiled to WebAssembly, gumball/gumball-engine.wasm) running in a Web Worker
 *     (gumball/gumball-worker.js). Dropped files are decoded here on the main thread and analysed on the device; nothing is uploaded.
 *   - DemoEngine: serves pre-rendered sounds from gumball-demo/ and is only used by the "Try it with demo stems" button.
 * window.GumballEngine picks one per scan() (demo track descriptors -> DemoEngine, File objects -> WasmEngine); roll() and getAudio() follow
 * the engine of the last scan. A failed engine start rejects with an Error whose .noRetry is true and .code is "engine-unavailable".
 */
(function () {
  "use strict";
  var BASE = "gumball-demo/";   // demo.json: one pre-rendered flavour per hit; roll() toggles original <-> flavour (gumball.js flips back when the same variant comes again)
  var demoPromise = null;
  var rollCount = {};   // hitId -> how many rolls so far (the demo cycles through the pre-rendered variants)
  var audioCache = {};  // url -> Promise<ArrayBuffer>

  function loadDemo() {
    if (!demoPromise) {
      demoPromise = fetch(BASE + "demo.json?v=20261123a", { cache: "force-cache" }).then(function (r) {
        if (!r.ok) throw new Error("Could not load the demo sounds (" + r.status + ").");
        return r.json();
      }).catch(function (e) { demoPromise = null; throw e; });
    }
    return demoPromise;
  }

  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function hitById(demo, id) { for (var i = 0; i < demo.hits.length; i++) if (demo.hits[i].id === id) return demo.hits[i]; return null; }

  var DemoEngine = {
    mode: "demo",

    scan: function (files, onProgress) {
      onProgress = onProgress || function () {};
      files = files || [];
      return loadDemo().then(function (demo) {
        // Simulated analysis: every track "reads" for a moment, so the UI shows real progress states.
        var chain = Promise.resolve();
        files.forEach(function (f, i) {
          chain = chain.then(function () {
            var steps = 6, name = f.name || ("Track " + (i + 1));
            return (function run(s) {
              onProgress({ index: i, name: name, progress: s / steps, stage: s < 3 ? "Reading" : "Listening for hits" });
              if (s >= steps) return Promise.resolve();
              return wait(70 + Math.random() * 60).then(function () { return run(s + 1); });
            })(0);
          });
        });
        return chain.then(function () {
          rollCount = {};
          return {
            demo: true,
            key: demo.key,
            bpm: demo.bpm,
            suggestedName: demo.suggestedName,
            tracks: demo.tracks.slice(),
            hits: demo.hits.map(function (h) {
              return {
                id: h.id, type: h.type, track: h.track, trackName: demo.tracks[h.track].name,
                merged: h.merged, quality: h.quality, note: h.note, tonal: h.tonal, dur: h.dur, thumb: h.thumb
              };
            })
          };
        });
      });
    },

    roll: function (hitId, seed) {
      return loadDemo().then(function (demo) {
        var h = hitById(demo, hitId);
        if (!h || !h.variants.length) throw new Error("No flavours for this sound.");
        var n = rollCount[hitId] || 0, idx;
        if (seed) { var s = 0; String(seed).split("").forEach(function (c) { s = (s * 31 + c.charCodeAt(0)) >>> 0; }); idx = s % h.variants.length; }
        else idx = n % h.variants.length;
        rollCount[hitId] = n + 1;
        var v = h.variants[idx];
        return wait(260).then(function () {
          return { id: v.id, flavour: v.flavour, flavourId: v.flavourId, rarity: v.rarity, desc: v.desc, seed: v.seed };
        });
      });
    },

    getAudio: function (hitId, variantId) {
      return loadDemo().then(function (demo) {
        var h = hitById(demo, hitId), file = null;
        if (!h) throw new Error("Unknown sound.");
        if (!variantId) file = h.file;
        else h.variants.forEach(function (v) { if (v.id === variantId) file = v.file; });
        if (!file) throw new Error("Unknown flavour.");
        var url = BASE + file;
        if (!audioCache[url]) {
          audioCache[url] = fetch(url).then(function (r) {
            if (!r.ok) throw new Error("Could not load the audio (" + r.status + ").");
            return r.arrayBuffer();
          }).catch(function (e) { delete audioCache[url]; throw e; });
        }
        // hand out a copy: decodeAudioData detaches the buffer it is given
        return audioCache[url].then(function (b) { return b.slice(0); });
      });
    },

    // demo-only helper for the "Try it with demo stems" button (a real engine does not need this)
    demoTracks: function () {
      return loadDemo().then(function (demo) {
        return demo.tracks.map(function (t) { return { name: t.name, duration: t.duration, demo: true }; });
      });
    }
  };

  // ================================================================ WasmEngine
  var ASSET_V = "20261127d";
  var WORKER_URL = "gumball/gumball-worker.js?v=" + ASSET_V;
  var STAGES = ["Reading", "Listening for hits", "Cutting out hits", "Sorting hits"];
  var MAX_IN_FLIGHT = 2;      // tracks decoded / queued for the worker at the same time (keeps memory low)

  function engineError(msg, code) { var e = new Error(msg); e.code = code || "engine-failed"; e.noRetry = code === "engine-unavailable"; return e; }
  var UNAVAILABLE = "Your browser could not start the sound engine. It needs a current Chrome, Firefox, Safari or Edge. You can still look around with the demo stems.";

  // 24-bit stereo PCM WAV (same as the desktop engine writes)
  function encodeWav24(L, R, sr) {
    var n = L.length, bytes = n * 6, buf = new ArrayBuffer(44 + bytes), v = new DataView(buf);
    function str(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, 36 + bytes, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, Math.round(sr), true); v.setUint32(28, Math.round(sr) * 6, true); v.setUint16(32, 6, true); v.setUint16(34, 24, true); str(36, "data"); v.setUint32(40, bytes, true);
    var o = 44;
    for (var i = 0; i < n; i++) {
      for (var c = 0; c < 2; c++) {
        var x = (c ? R : L)[i]; if (!(x === x)) x = 0; if (x > 1) x = 1; else if (x < -1) x = -1;
        var q = Math.round(x * 2147483647) >> 8;   // same rounding as the desktop (JUCE) writer
        v.setUint8(o++, q & 255); v.setUint8(o++, (q >> 8) & 255); v.setUint8(o++, (q >> 16) & 255);
      }
    }
    return buf;
  }

  // decodeAudioData resamples to the context's rate, so for WAV files the context is opened at the file's own rate (no resampling)
  function wavRate(file) {
    if (!/\.wav$/i.test(file.name || "") || !file.slice) return Promise.resolve(0);
    return file.slice(0, 4096).arrayBuffer().then(function (ab) {
      var v = new DataView(ab);
      if (ab.byteLength < 28 || v.getUint32(0, false) !== 0x52494646 || v.getUint32(8, false) !== 0x57415645) return 0;
      for (var p = 12; p + 24 <= ab.byteLength;) {
        var id = v.getUint32(p, false), sz = v.getUint32(p + 4, true);
        if (id === 0x666d7420) return v.getUint32(p + 12, true);
        p += 8 + sz + (sz & 1);
      }
      return 0;
    }).catch(function () { return 0; });
  }
  function decodeFile(ctxs, AC, file) {
    return Promise.all([file.arrayBuffer(), wavRate(file)]).then(function (r) {
      var ab = r[0], rate = r[1] >= 8000 && r[1] <= 96000 ? r[1] : 0, ctx = ctxs[rate];
      if (!ctx) {
        try { ctx = new AC(rate ? { sampleRate: rate } : undefined); } catch (e) { ctx = ctxs[0] || (ctxs[0] = new AC()); }
        ctxs[rate] = ctx;
      }
      var copy = ab.slice(0);   // decodeAudioData detaches its input; keep a copy for the AIFF fallback
      return new Promise(function (res, rej) {
        var p; try { p = ctx.decodeAudioData(ab, res, rej); } catch (e) { return rej(e); }
        if (p && p.catch) p.catch(rej);
      }).catch(function (err) {
        // Chrome and Firefox cannot decode AIFF (Safari can): read plain PCM AIFF / AIFC ourselves
        var a = parseAiff(copy);
        if (a) return a;
        throw err;
      });
    });
  }

  // Minimal AIFF / AIFC PCM reader (8/16/24/32-bit integer, 32-bit float, "sowt" little-endian). Returns an AudioBuffer-like object or null.
  function parseAiff(ab) {
    try {
      var v = new DataView(ab);
      if (ab.byteLength < 12 || v.getUint32(0, false) !== 0x464f524d) return null;           // "FORM"
      var form = v.getUint32(8, false); if (form !== 0x41494646 && form !== 0x41494643) return null;   // "AIFF" / "AIFC"
      var nch = 0, frames = 0, bits = 0, rate = 0, comp = "NONE", dataOff = -1, dataLen = 0;
      for (var p = 12; p + 8 <= ab.byteLength;) {
        var id = v.getUint32(p, false), sz = v.getUint32(p + 4, false), b = p + 8;
        if (id === 0x434f4d4d) {                                                              // "COMM"
          nch = v.getUint16(b, false); frames = v.getUint32(b + 2, false); bits = v.getUint16(b + 6, false);
          var ex = v.getUint16(b + 8, false), hi = v.getUint32(b + 10, false), lo = v.getUint32(b + 14, false);
          rate = (hi * 4294967296 + lo) * Math.pow(2, (ex & 0x7fff) - 16383 - 63);
          if (form === 0x41494643 && sz >= 22) comp = String.fromCharCode(v.getUint8(b + 18), v.getUint8(b + 19), v.getUint8(b + 20), v.getUint8(b + 21));
        } else if (id === 0x53534e44) {                                                       // "SSND"
          var off = v.getUint32(b, false); dataOff = b + 8 + off; dataLen = Math.min(sz - 8 - off, ab.byteLength - dataOff);
        }
        p += 8 + sz + (sz & 1);
      }
      var little = comp === "sowt", float = comp === "fl32" || comp === "FL32";
      if (!nch || nch > 8 || dataOff < 0 || !(rate >= 8000 && rate <= 192000)) return null;
      if (comp !== "NONE" && comp !== "twos" && !little && !float) return null;                 // compressed AIFC (ima4, ulaw ...): not supported
      var bytes = bits >> 3, n = Math.min(frames, Math.floor(dataLen / (bytes * nch)));
      if (!(bytes >= 1 && bytes <= 4) || n <= 0) return null;
      var ch = []; for (var c = 0; c < nch; c++) ch.push(new Float32Array(n));
      for (var i = 0; i < n; i++) for (var c2 = 0; c2 < nch; c2++) {
        var q = dataOff + (i * nch + c2) * bytes, x;
        if (float) x = v.getFloat32(q, little);
        else if (bytes === 1) x = v.getInt8(q) / 128;
        else if (bytes === 2) x = v.getInt16(q, little) / 32768;
        else if (bytes === 3) { var b0 = v.getUint8(q), b1 = v.getUint8(q + 1), b2 = v.getUint8(q + 2); var w = little ? (b2 << 16 | b1 << 8 | b0) : (b0 << 16 | b1 << 8 | b2); if (w & 0x800000) w -= 0x1000000; x = w / 8388608; }
        else x = v.getInt32(q, little) / 2147483648;
        ch[c2][i] = x;
      }
      return { numberOfChannels: nch, length: n, sampleRate: rate, duration: n / rate, copyFromChannel: function (dst, c, start) { dst.set(ch[c].subarray(start || 0, (start || 0) + dst.length)); } };
    } catch (e) { return null; }
  }

  var WasmEngine = (function () {
    var worker = null, readyP = null, session = null;       // session: {hitIndex:{id:i}, pcm:{hitId:{L,R,sr}}, variants:{variantId:{L,R,sr}}, lastFlavour:{}}
    var pending = [];                                       // {reject} of everything waiting for the worker
    var cur = { onProgress: null, trackWaiters: {}, sessionWaiter: null, started: null };
    var rollWaiters = {}, reqId = 0;

    function failAll(err) {
      var p = pending; pending = [];
      p.forEach(function (w) { try { w(err); } catch (_) {} });
    }
    function track(promiseExecutor) {
      return new Promise(function (resolve, reject) {
        var done = false;
        var settle = function () { done = true; var k = pending.indexOf(w); if (k >= 0) pending.splice(k, 1); };
        var w = function (err) { if (!done) { settle(); reject(err); } };
        pending.push(w);
        promiseExecutor(function (v) { if (!done) { settle(); resolve(v); } }, w);
      });
    }
    function killWorker() { if (worker) { try { worker.terminate(); } catch (_) {} } worker = null; readyP = null; }

    function onMessage(ev) {
      var m = ev.data || {};
      switch (m.type) {
        case "progress": if (cur.onProgress) cur.onProgress(m); break;
        case "trackDone": if (cur.trackWaiters[m.index]) { cur.trackWaiters[m.index](); delete cur.trackWaiters[m.index]; } break;
        case "started": if (cur.started) cur.started(); break;
        case "session": if (cur.sessionWaiter) cur.sessionWaiter(m); break;
        case "rolled": if (rollWaiters[m.reqId]) { rollWaiters[m.reqId].resolve(m); delete rollWaiters[m.reqId]; } break;
        case "error":
          if (m.reqId != null && rollWaiters[m.reqId]) { rollWaiters[m.reqId].reject(engineError(m.message)); delete rollWaiters[m.reqId]; }
          else failAll(engineError(m.message));
          break;
        case "fatal": killWorker(); failAll(engineError(UNAVAILABLE, "engine-unavailable")); break;
      }
    }

    function ensureWorker() {
      if (readyP) return readyP;
      if (typeof Worker === "undefined" || typeof WebAssembly !== "object") return Promise.reject(engineError(UNAVAILABLE, "engine-unavailable"));
      readyP = new Promise(function (resolve, reject) {
        var timer = null;
        function bad(code) { clearTimeout(timer); killWorker(); reject(engineError(UNAVAILABLE, "engine-unavailable")); }
        try { worker = new Worker(WORKER_URL); } catch (e) { return bad(); }
        var w = worker;
        w.onmessage = function (ev) {
          var m = ev.data || {};
          if (m.type === "ready") { clearTimeout(timer); w.onmessage = onMessage; resolve(w); }
          else if (m.type === "fatal") bad();
        };
        w.onerror = function (e) {
          if (e && e.preventDefault) e.preventDefault();
          if (w !== worker) return;
          var wasReady = w.onmessage === onMessage;
          killWorker();
          if (wasReady) failAll(engineError("The sound engine stopped unexpectedly. This usually means the tracks need more memory than the browser allows. Try fewer or shorter tracks."));
          else { clearTimeout(timer); reject(engineError(UNAVAILABLE, "engine-unavailable")); }
        };
        timer = setTimeout(function () { bad(); }, 30000);
        w.postMessage({ type: "init" });
      });
      readyP.catch(function () { readyP = null; });
      return readyP;
    }

    function scan(files, onProgress) {
      onProgress = onProgress || function () {};
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return Promise.reject(engineError("Add at least one track first."));
      session = null; cur = { onProgress: null, trackWaiters: {}, sessionWaiter: null, started: null };
      var names = files.map(function (f, i) { return (f.name || ("Track " + (i + 1))).replace(/\.[^.]+$/, ""); });
      var stageOf = function (phase) { return STAGES[Math.max(0, Math.min(STAGES.length - 1, phase | 0))]; };
      var AC = window.AudioContext || window.webkitAudioContext, ctxs = {};
      var durations = [];
      var doneP = [];

      function closeCtx() { Object.keys(ctxs).forEach(function (k) { var c = ctxs[k]; if (c && c.close) { try { c.close(); } catch (_) {} } }); ctxs = {}; }

      return ensureWorker().then(function (w) {
        if (!AC) throw engineError("Your browser cannot decode audio files here.");
        cur.onProgress = function (m) {
          // 0..0.08 reading, the rest is the analysis; 1 is only reported when the track is really done
          onProgress({ index: m.index, name: names[m.index], progress: Math.min(0.99, 0.08 + 0.91 * m.progress), stage: stageOf(m.phase) });
        };
        var started = track(function (res) { cur.started = res; });
        w.postMessage({ type: "start", bpm: 0, key: "auto", tune: 1 });
        return started.then(function () { return w; });
      }).then(function (w) {
        var chain = Promise.resolve();
        files.forEach(function (f, i) {
          chain = chain.then(function () {
            // at most MAX_IN_FLIGHT tracks queued in the worker: wait for the older ones before decoding the next
            return i >= MAX_IN_FLIGHT ? doneP[i - MAX_IN_FLIGHT] : null;
          }).then(function () {
            onProgress({ index: i, name: names[i], progress: 0.02, stage: "Reading" });
            return decodeFile(ctxs, AC, f).catch(function () {
              throw engineError("“" + f.name + "” could not be read. Try exporting it as a WAV file.");
            });
          }).then(function (buf) {
            var nch = Math.min(2, buf.numberOfChannels), chans = [];
            for (var c = 0; c < nch; c++) { var a = new Float32Array(buf.length); buf.copyFromChannel(a, c, 0); chans.push(a); }
            durations[i] = buf.duration;
            onProgress({ index: i, name: names[i], progress: 0.08, stage: "Reading" });
            doneP[i] = track(function (res) { cur.trackWaiters[i] = res; });
            doneP[i].then(function () { onProgress({ index: i, name: names[i], progress: 1, stage: "Done" }); }, function () {});
            w.postMessage({ type: "track", index: i, name: names[i], sr: buf.sampleRate, frames: buf.length, channels: chans }, chans.map(function (a) { return a.buffer; }));
          });
        });
        return chain.then(function () { return Promise.all(doneP); }).then(function () {
          closeCtx();
          var p = track(function (res) { cur.sessionWaiter = res; });
          w.postMessage({ type: "finish" });
          return p;
        });
      }).then(function (m) {
        closeCtx();
        var js = m.session, hitIndex = {}, pcm = {};
        m.hits.forEach(function (h, i) { hitIndex[h.id] = i; pcm[h.id] = { L: h.L, R: h.R, sr: h.sr }; });
        session = { hitIndex: hitIndex, pcm: pcm, variants: {}, lastFlavour: {}, key: js.key };
        return {
          demo: false,
          key: js.key,
          bpm: js.bpm || 0,
          suggestedName: js.suggested_name,
          tracks: js.tracks.map(function (t, i) { return { name: names[i] || t.name, duration: t.duration_seconds }; }),
          hits: js.hits.map(function (h) {
            return {
              id: h.id, type: h.type, track: h.track, trackName: names[h.track] || (js.tracks[h.track] && js.tracks[h.track].name) || "",
              merged: h.cs, quality: h.q, note: h.note, tonal: h.tonal, dur: h.dur, thumb: h.thumb
            };
          })
        };
      }).catch(function (e) {
        closeCtx();
        cur.onProgress = null; cur.trackWaiters = {};
        killWorker();   // drops anything still queued; the next scan starts a fresh worker
        throw e;
      });
    }

    function randomSeed() {
      var a = new Uint32Array(1);
      try { crypto.getRandomValues(a); } catch (_) { a[0] = (Math.random() * 4294967296) >>> 0; }
      return a[0] & 0xFFFFF;
    }

    function rollOnce(hitIndexNum, seed) {
      return ensureWorker().then(function (w) {
        return track(function (res, rej) {
          var id = ++reqId; rollWaiters[id] = { resolve: res, reject: rej };
          w.postMessage({ type: "roll", reqId: id, hitIndex: hitIndexNum, seed: seed });
        });
      });
    }

    function roll(hitId, seed) {
      if (!session || session.hitIndex[hitId] == null) return Promise.reject(engineError("Unknown sound."));
      var idx = session.hitIndex[hitId], fixed = seed != null && seed !== "";
      var seedNum = null;
      if (fixed) {
        if (typeof seed === "number") seedNum = seed & 0xFFFFF;
        else { var s = 0; String(seed).split("").forEach(function (c) { s = (s * 31 + c.charCodeAt(0)) >>> 0; }); seedNum = s & 0xFFFFF; }
      }
      var tries = 0;
      function attempt() {
        var sd = fixed ? seedNum : randomSeed();
        return rollOnce(idx, sd).then(function (m) {
          // a fresh roll never repeats the flavour that is already showing on this sound
          if (!fixed && m.info.flavour_id === session.lastFlavour[hitId] && ++tries < 4) return attempt();
          return m;
        });
      }
      return attempt().then(function (m) {
        var info = m.info, id = hitId + "_" + String(info.seed).replace(/[^A-Za-z0-9]/g, "");
        session.variants[id] = { L: m.L, R: m.R, sr: m.sr };
        session.lastFlavour[hitId] = info.flavour_id;
        return { id: id, flavour: info.name, flavourId: info.flavour_id, rarity: info.rarity, desc: info.desc, seed: info.seed };
      });
    }

    function getAudio(hitId, variantId) {
      if (!session) return Promise.reject(engineError("No sounds yet."));
      var p = variantId ? session.variants[variantId] : session.pcm[hitId];
      if (!p) return Promise.reject(engineError(variantId ? "Unknown flavour." : "Unknown sound."));
      return Promise.resolve(encodeWav24(p.L, p.R, p.sr));
    }

    return { mode: "wasm", scan: scan, roll: roll, getAudio: getAudio, encodeWav24: encodeWav24 };
  })();

  // ================================================================ router
  var active = DemoEngine;
  window.GumballEngine = {
    mode: "auto",
    scan: function (files, onProgress) {
      var arr = Array.prototype.slice.call(files || []);
      var demo = arr.length > 0 && arr.every(function (f) { return f && f.demo === true; });
      active = demo ? DemoEngine : WasmEngine;
      return active.scan(arr, onProgress);
    },
    roll: function (hitId, seed) { return active.roll(hitId, seed); },
    getAudio: function (hitId, variantId) { return active.getAudio(hitId, variantId); },
    demoTracks: function () { return DemoEngine.demoTracks(); }
  };
})();

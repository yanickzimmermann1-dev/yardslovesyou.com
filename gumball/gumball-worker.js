/* gumball-worker.js - runs the Gumball engine (WebAssembly) off the main thread.
 *
 * Classic worker (importScripts). Protocol (main -> worker, worker -> main):
 *   {type:"init"}                               -> {type:"ready", version}            | {type:"fatal", message}
 *   {type:"start", bpm, key, tune}              -> {type:"started"}                   | {type:"error", message}
 *   {type:"track", index, name, sr, frames, channels:[Float32Array, ...] (transferred)}
 *                                               -> {type:"progress", index, progress, phase}*, then {type:"trackDone", index}
 *   {type:"finish"}                             -> {type:"session", session, hits:[{id, sr, frames, L, R}]}   (L, R transferred)
 *   {type:"roll", reqId, hitIndex, seed}        -> {type:"rolled", reqId, info, sr, L, R}                     | {type:"error", reqId, message}
 *   {type:"reset"}                              -> {type:"reset"}
 * Tracks are analysed one after the other as they arrive; the audio is freed right after each track.
 */
"use strict";
var VERSION = (self.location.search.match(/[?&]v=([\w.-]+)/) || [])[1] || "";
var M = null, ready = null;

function load() {
  if (ready) return ready;
  ready = new Promise(function (resolve, reject) {
    try {
      if (typeof WebAssembly !== "object") throw new Error("WebAssembly is not available.");
      importScripts("gumball-engine.js" + (VERSION ? "?v=" + VERSION : ""));
      self.GumballEngineModule({
        locateFile: function (f) { return f + (VERSION ? "?v=" + VERSION : ""); },
        onProgress: function (track, frac, phase) { self.postMessage({ type: "progress", index: track, progress: frac, phase: phase }); }
      }).then(function (m) { M = m; resolve(m); }, reject);
    } catch (e) { reject(e); }
  });
  return ready;
}

function call(name, ret, args) {
  return M.ccall(name, ret, args.map(function (a) { return typeof a === "string" ? "string" : "number"; }), args);
}
function copyOut(ptr, frames) { return M.HEAPF32.slice(ptr >> 2, (ptr >> 2) + frames); }   // a fresh Float32Array (heap views change when memory grows)

self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.type === "init") {
    load().then(function () { self.postMessage({ type: "ready", version: call("gb_version", "number", []) }); },
                function (e) { self.postMessage({ type: "fatal", message: String(e && e.message || e) }); });
    return;
  }
  load().then(function () {
    try {
      switch (m.type) {
        case "start": {
          if (!call("gb_create", "number", [+m.bpm || 0, m.key || "auto", m.tune == null ? 1 : +m.tune])) throw new Error("Could not start the engine session.");
          self.postMessage({ type: "started" });
          break;
        }
        case "track": {
          var chans = m.channels, n = m.frames, mono = chans.length === 1;
          if (call("gb_track_begin", "number", [m.name || "", chans.length, m.sr, n]) < 0) throw new Error("The engine rejected this track.");
          for (var c = 0; c < Math.min(2, chans.length); c++) M.HEAPF32.set(chans[c], call("gb_track_ptr", "number", [c]) >> 2);
          m.channels = chans = null;
          call("gb_track_commit", "number", [mono ? 1 : 0]);
          self.postMessage({ type: "trackDone", index: m.index });
          break;
        }
        case "finish": {
          var count = call("gb_finish", "number", []);
          if (count < 0) throw new Error("The engine could not finish the analysis.");
          var session = JSON.parse(call("gb_session_json", "string", []));
          var hits = [], xfer = [];
          for (var i = 0; i < count; i++) {
            var fr = call("gb_hit_frames", "number", [i]);
            var L = copyOut(call("gb_hit_ptr", "number", [i, 0]), fr), R = copyOut(call("gb_hit_ptr", "number", [i, 1]), fr);
            hits.push({ id: session.hits[i].id, sr: call("gb_hit_sr", "number", [i]), frames: fr, L: L, R: R });
            xfer.push(L.buffer, R.buffer);
          }
          self.postMessage({ type: "session", session: session, hits: hits }, xfer);
          break;
        }
        case "roll": {
          var frames;
          try { frames = call("gb_roll", "number", [m.hitIndex, m.seed >>> 0]); } catch (e) { throw new Error("The roll failed inside the engine."); }
          if (frames <= 0) throw new Error("This sound could not be rolled.");
          var info = JSON.parse(call("gb_roll_json", "string", []));
          var l = copyOut(call("gb_roll_ptr", "number", [0]), frames), r = copyOut(call("gb_roll_ptr", "number", [1]), frames);
          self.postMessage({ type: "rolled", reqId: m.reqId, info: info, sr: info.sample_rate, L: l, R: r }, [l.buffer, r.buffer]);
          break;
        }
        case "reset": call("gb_destroy", null, []); self.postMessage({ type: "reset" }); break;
      }
    } catch (e) {
      self.postMessage({ type: "error", reqId: m.reqId, index: m.index, message: String(e && e.message || e) });
    }
  }, function (e) { self.postMessage({ type: "fatal", message: String(e && e.message || e) }); });
};

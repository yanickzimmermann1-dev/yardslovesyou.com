/* media.js - serves mirrored Supabase public-storage files from /media/ (GitHub Pages) to save egress.
   Generated manifest below (see media/README.txt). Unknown files fall back to the original URL. */
(function () {
  "use strict";
  var BASE = "media/";
  var FILES = {"coverart-products/finished-snippet-essentials.wav":"coverart-products/finished-snippet-essentials.m4a","coverart-portolio/omw.jpg":true,"coverart-products/The-Last-Yards-Shop-Cover.png":true,"coverart-products/beforeafter/nachher-160.m4a":true,"coverart-products/beforeafter/vorher-160.m4a":true,"coverart-products/perclab/ceng.wav":true,"coverart-products/perclab/chains.wav":true,"coverart-products/perclab/clap/clap.wav":true,"coverart-products/perclab/clap/clap2.wav":true,"coverart-products/perclab/clap/clap3.wav":true,"coverart-products/perclab/clap/clap4.wav":true,"coverart-products/perclab/clic.wav":true,"coverart-products/perclab/cnist.wav":true,"coverart-products/perclab/crisp.wav":true,"coverart-products/perclab/crunch.wav":true,"coverart-products/perclab/cube.wav":true,"coverart-products/perclab/cup.wav":true,"coverart-products/perclab/dagger.wav":true,"coverart-products/perclab/dolla.wav":true,"coverart-products/perclab/doors.wav":true,"coverart-products/perclab/dromedar.wav":true,"coverart-products/perclab/edd.wav":true,"coverart-products/perclab/edon.wav":true,"coverart-products/perclab/elon.wav":true,"coverart-products/perclab/endr.wav":true,"coverart-products/perclab/eno.wav":true,"coverart-products/perclab/erosion.wav":true,"coverart-products/perclab/eshe.wav":true,"coverart-products/perclab/eternit.wav":true,"coverart-products/perclab/fed.wav":true,"coverart-products/perclab/fenetre.wav":true,"coverart-products/perclab/fent.wav":true,"coverart-products/perclab/fonda.wav":true,"coverart-products/perclab/ganna.wav":true,"coverart-products/perclab/gerda.wav":true,"coverart-products/perclab/gett.wav":true,"coverart-products/perclab/glap.wav":true,"coverart-products/perclab/hash.wav":true,"coverart-products/perclab/holup.wav":true,"coverart-products/perclab/hump.wav":true,"coverart-products/perclab/ivy.wav":true,"coverart-products/perclab/keys.wav":true,"coverart-products/perclab/kick/kick.wav":true,"coverart-products/perclab/kick/kick2.wav":true,"coverart-products/perclab/kick/kick3.wav":true,"coverart-products/perclab/kick/kick4.wav":true,"coverart-products/perclab/knip.wav":true,"coverart-products/yardslovesyou-1-sd-card-white.jpg":true};
  var cfg = window.APP_CONFIG || {};
  var PREFIX = String(cfg.SUPABASE_URL || "").replace(/\/$/, "") + "/storage/v1/object/public/";
  function local(path) {
    if (!Object.prototype.hasOwnProperty.call(FILES, path)) return null;
    var target = typeof FILES[path] === "string" ? FILES[path] : path; // Ersatzdatei (z.B. WAV -> AAC)
    return BASE + target.split("/").map(encodeURIComponent).join("/");
  }
  function url(u) {
    if (typeof u !== "string" || !u) return u;
    var p;
    if (PREFIX.length > 30 && u.indexOf(PREFIX) === 0) {
      p = u.slice(PREFIX.length).split("?")[0];
      try { p = decodeURIComponent(p); } catch (e) { return u; }
    } else if (!/^[a-z][a-z0-9+.-]*:|^\/|^\.|^data:|^blob:/i.test(u)) {
      p = u; // "bucket/path" string
    } else return u;
    return local(p) || u;
  }
  window.YLYMedia = { url: url, has: function (path) { return !!local(path); } };
})();

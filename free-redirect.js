/* free-redirect.js - free.html ist in den Shop gezogen (shop.html#free). Alte Deep-Links (#mixcheck) macht nav.js. */
(function () {
  try {
    if (/^#(mixcheck|mix-check)$/i.test(location.hash)) { location.replace('mixcheck.html'); return; }
    location.replace('shop.html#free');
  } catch (e) {}
})();

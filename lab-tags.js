/* =====================================================================
   lab-tags.js - kleines Tag-Feld (Chips) fuer Uploads und das Chord-Starter-Publish.
   LabTags.mount(el, { max: 5 }) -> { get(): string[], set(arr), clear() }
   Regeln: max 5 Tags, klein geschrieben, 2-20 Zeichen, nur a-z 0-9 Leerzeichen Bindestrich.
   ===================================================================== */
window.LabTags = (() => {
  const SUGGEST = ["trap", "drill", "rnb", "lofi", "afro", "jersey", "ambient", "dark", "melodic", "808", "guitar", "piano", "vocal", "perc", "sample"];
  const clean = s => String(s || "").toLowerCase().replace(/^#+/, "").replace(/[^a-z0-9 -]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
  const ok = t => /^[a-z0-9][a-z0-9 -]{0,18}[a-z0-9]$/.test(t);
  let uid = 0;

  function mount(el, opts = {}) {
    const max = opts.max || 5, id = "lt" + (++uid);
    let tags = [];
    el.classList.add("lt");
    el.innerHTML = `
      <div class="lt-box">
        <ul class="lt-chips" aria-label="Your tags"></ul>
        <input class="lt-in" id="${id}" type="text" maxlength="20" placeholder="Add a tag and press Enter" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Add a tag">
      </div>
      <p class="lt-hint">Up to ${max} tags so others can find your sound.</p>
      <div class="lt-sug" role="group" aria-label="Suggested tags">${SUGGEST.map(t => `<button type="button" class="lt-s" data-t="${t}">${t}</button>`).join("")}</div>`;
    const chips = el.querySelector(".lt-chips"), inp = el.querySelector(".lt-in");

    function render() {
      chips.innerHTML = tags.map(t => `<li class="lt-chip"><span>#${t}</span><button type="button" data-rm="${t}" aria-label="Remove tag ${t}">&times;</button></li>`).join("");
      el.querySelectorAll(".lt-s").forEach(b => { b.setAttribute("aria-pressed", tags.includes(b.dataset.t)); b.classList.toggle("on", tags.includes(b.dataset.t)); });
      inp.disabled = tags.length >= max;
    }
    function add(raw) {
      const t = clean(raw);
      if (!ok(t) || tags.includes(t) || tags.length >= max) return false;
      tags.push(t); render(); return true;
    }
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); if (add(inp.value)) inp.value = ""; }
      else if (e.key === "Backspace" && !inp.value && tags.length) { tags.pop(); render(); }
    });
    inp.addEventListener("blur", () => { if (inp.value && add(inp.value)) inp.value = ""; });
    el.addEventListener("click", e => {
      const rm = e.target.closest("[data-rm]"), s = e.target.closest(".lt-s");
      if (rm) { tags = tags.filter(t => t !== rm.dataset.rm); render(); inp.focus(); }
      else if (s) { const t = s.dataset.t; if (tags.includes(t)) tags = tags.filter(x => x !== t); else add(t); render(); }
    });
    render();
    return {
      get: () => { if (inp.value) { add(inp.value); inp.value = ""; } return tags.slice(); },
      set: a => { tags = []; (a || []).forEach(add); render(); },
      clear: () => { tags = []; inp.value = ""; render(); }
    };
  }
  return { mount, clean, ok, SUGGEST };
})();

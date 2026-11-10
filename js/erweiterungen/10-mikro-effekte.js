/* Fallpfad Mikro-Effekte: kurzer Ring beim Antippen, sanftes Einblenden neuer Seiten, kleine Pops bei Auswahl.
   Alles dezent und abgeschaltet, wenn das Gerät "Bewegung reduzieren" verlangt. */
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var css =
    "@keyframes fxm-ring{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--rc,var(--accent,#0062FF)) 38%,transparent)}100%{box-shadow:0 0 0 9px transparent}}" +
    "@keyframes fxm-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}" +
    "@keyframes fxm-pop{0%{transform:scale(1)}40%{transform:scale(1.035)}100%{transform:scale(1)}}" +
    "@keyframes fxm-badge{0%{transform:scale(.4)}60%{transform:scale(1.18)}100%{transform:scale(1)}}" +
    ".fxm-ring{animation:fxm-ring .45s ease-out}" +
    "button,.btn,.tab,.chip,a.card,.lvopt,.iconbtn{transition:transform .12s ease,background-color .18s,border-color .18s,color .18s,box-shadow .2s}" +
    "button:not(:disabled):active,.btn:active,.tab:active,.chip:active,.lvopt:not(:disabled):active,.iconbtn:active{transform:scale(.965)}" +
    ".fx-t:active,button.mod:active{transform:scale(.985)!important}" +
    ".fxm-page{animation:fxm-in .32s cubic-bezier(.22,1,.36,1) both}" +
    ".lvopt.on,.chip.on,.fxl-si button.on,.fxpm-sw.on,.fxm-pick{animation:fxm-pop .28s ease}" +
    ".badge,.fx-n,.tab .count,.tab b.n{animation:fxm-badge .35s cubic-bezier(.22,1,.36,1)}" +
    ".card,.fx-t{transition:transform .25s cubic-bezier(.22,1,.36,1),box-shadow .25s,border-color .25s}" +
    "@media (hover:hover){a.card:hover,.card.click:hover,.acard:hover{transform:translateY(-2px)}}" +
    ".switch i{transition:transform .25s cubic-bezier(.34,1.56,.64,1)!important}" +
    "input[type=checkbox],input[type=radio]{transition:transform .12s}input[type=checkbox]:active,input[type=radio]:active{transform:scale(.88)}";
  var st = document.createElement("style"); st.id = "fx-motion-css"; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  var SEL = "button, .btn, .tab, .chip, a.card, .lvopt, .iconbtn, .fx-t, [role=button]";
  document.addEventListener("pointerdown", function (e) {
    var el = e.target && e.target.closest && e.target.closest(SEL);
    if (!el || el.disabled) return;
    if (e.target.closest(".pxavw, .av, .pxpatav, .pxheadav, .pxpavimg")) return;
    var c = getComputedStyle(el).getPropertyValue("--c").trim();
    if (c) el.style.setProperty("--rc", c);
    el.classList.remove("fxm-ring"); void el.offsetWidth; el.classList.add("fxm-ring");
    setTimeout(function () { el.classList.remove("fxm-ring"); }, 480);
  }, { passive: true });
  /* Seitenwechsel: neuen Inhalt im Hauptbereich sanft einblenden */
  var last = null;
  function page() {
    var m = document.querySelector("main.main, main");
    if (!m) return;
    var key = (document.querySelector(".tab[aria-current=page], .tab.on") || {}).textContent || "";
    key += "|" + ((m.querySelector("h1") || {}).textContent || "").slice(0, 40);
    if (key === last) return;
    last = key;
    var kids = Array.prototype.filter.call(m.children, function (k) { return !k.classList.contains("topbar"); });
    kids.forEach(function (k) { k.classList.remove("fxm-page"); void k.offsetWidth; k.classList.add("fxm-page"); setTimeout(function () { k.classList.remove("fxm-page"); }, 400); });
  }
  function start() { var q = 0; new MutationObserver(function () { if (q) return; q = 1; requestAnimationFrame(function () { q = 0; page(); }); }).observe(document.body, { childList: true, subtree: true }); page(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

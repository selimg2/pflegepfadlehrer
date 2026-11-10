/* Fallpfad Design-Ebene: färbt Navigation, Seitenkopf und Karten wie die Trainingskacheln.
   Arbeitet nur über Klassen und CSS-Variablen, ändert keine Inhalte. */
(function () {
  var C = {
    blue: "#0062FF", violet: "#7C3AED", teal: "#0D9488", green: "#059669", orange: "#EA580C", red: "#E11D48",
    pink: "#DB2777", indigo: "#4F46E5", cyan: "#0891B2", sky: "#0284C7", amber: "#D97706", purple: "#9333EA", slate: "#64748B"
  };
  var NAV = {
    "Home": C.blue, "Übersicht": C.blue, "Lernmodule": C.violet, "Module": C.violet, "Training": C.teal, "Praxis": C.green,
    "Aufgaben": C.orange, "Fortschritt": C.pink, "Patientenakte": C.slate, "Kurse & Schüler": C.cyan, "Ausbildungsnachweis": C.green,
    "Feedback": C.pink, "Prüfen": C.indigo, "Nachrichten": C.sky, "Stundenplan": C.amber, "Live": C.red, "Team-Krankenhaus": C.purple,
    "Einstellungen": C.slate, "Schulen": C.indigo, "Mehr": C.slate
  };
  var KW = [
    [/live/i, C.red], [/team/i, C.purple], [/training|praktisches examen|simulation/i, C.teal], [/eigene|reflexion/i, C.orange],
    [/prüf|examen|osce/i, C.indigo], [/feedback|puls/i, C.pink], [/nachweis|einsatz|praxis/i, C.green], [/nachricht/i, C.sky],
    [/stundenplan|unterricht/i, C.amber], [/modul/i, C.blue]
  ];
  var YEAR = { 1: C.blue, 2: C.violet, 3: C.teal };
  var ROT = [C.blue, C.violet, C.teal, C.orange, C.pink, C.indigo, C.green, C.amber];
  function kw(t, def) {
    for (var i = 0; i < KW.length; i++) if (KW[i][0].test(t)) return KW[i][1];
    return def;
  }
  function tile(el, c, extra) {
    if (!el || (el.dataset.fx === c && el.classList.contains("fx-t") && el.style.getPropertyValue("--c"))) return;
    el.dataset.fx = c;
    el.style.setProperty("--c", c);
    el.classList.add("fx-t");
    if (extra) el.classList.add(extra);
  }
  function txt(el, sel) {
    var x = sel ? el.querySelector(sel) : el;
    return x ? x.textContent || "" : "";
  }
  var RULES = [];
  window.FX = { C: C, NAV: NAV, kw: kw, tile: tile, txt: txt, YEAR: YEAR, ROT: ROT, rule: function (sel, fn) { RULES.push([sel, fn]); } };
  function run() {
    var act = null;
    document.querySelectorAll(".tab").forEach(function (t) {
      var name = (t.textContent || "").replace(/\d+$/, "").trim();
      var c = NAV[name];
      if (c && (t.dataset.fxc !== c || !t.classList.contains("fx-nav"))) { t.dataset.fxc = c; t.style.setProperty("--c", c); t.classList.add("fx-nav"); }
      if (c && (t.getAttribute("aria-current") === "page" || t.classList.contains("on") || t.getAttribute("aria-selected") === "true")) act = c;
    });
    if (act && document.documentElement.style.getPropertyValue("--pc") !== act) document.documentElement.style.setProperty("--pc", act);
    RULES.forEach(function (r) {
      document.querySelectorAll(r[0]).forEach(function (el, i) {
        try { var c = r[1](el, i); if (c) tile(el, c); } catch (e) {}
      });
    });
  }
  var q = false;
  function sched() {
    if (q) return;
    q = true;
    requestAnimationFrame(function () { q = false; run(); });
  }
  function start() {
    run();
    new MutationObserver(sched).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-current", "class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

/* Lehrer-Portal: Farbregeln für Karten */
(function () {
  var X = window.FX, C = X.C;
  function head(el) { var e = el.querySelector(".eyebrow, small, .k, .muted"); return e ? e.textContent : ""; }
  X.rule(".acard", function (el) { return X.kw(head(el) + " " + X.txt(el).slice(0, 60), C.blue); });
  X.rule(".lcase", function () { return C.red; });
  X.rule(".tmcase", function () { return C.purple; });
  X.rule(".prc", function () { return C.indigo; });
  X.rule(".fbg", function (el, i) { return X.ROT[i % X.ROT.length]; });
  X.rule(".card.fbk", function () { return C.pink; });
  X.rule(".card.mcompose", function () { return C.sky; });
  X.rule(".card.hu-c", function () { return C.amber; });
  X.rule(".mod.tmod", function (el) { var m = /Jahr\s*(\d)/i.exec(X.txt(el)); return m ? X.YEAR[m[1]] : C.violet; });
  X.rule(".fx-modgrid > *", function (el) { var m = /Jahr\s*(\d)/i.exec(X.txt(el)); return m ? X.YEAR[m[1]] : C.violet; });
  X.rule(".stat4 > *, .kpis > *", function (el, i) { return [C.blue, C.cyan, C.violet, C.orange][i % 4]; });
  X.rule(".fxl-grid > .fxl-card", function (el) { return el.style.getPropertyValue("--c") || C.violet; });
  X.rule(".adm-card", function (el, i) { return X.ROT[i % X.ROT.length]; });
})();
/* Handy: kurze Beschriftungen in der unteren Leiste */
(function () {
  var S = { "Kurse & Schüler": "Kurse", "Ausbildungsnachweis": "Nachweis", "Team-Krankenhaus": "Team", "Einstellungen": "Optionen", "Stundenplan": "Plan", "Nachrichten": "Nachricht." };
  function run() {
    document.querySelectorAll(".tabbar .tab span").forEach(function (sp) {
      var t = (sp.textContent || "").trim();
      if (S[t] && sp.getAttribute("data-short") !== S[t]) sp.setAttribute("data-short", S[t]);
    });
  }
  var q = 0;
  function start() { run(); new MutationObserver(function () { if (q) return; q = 1; requestAnimationFrame(function () { q = 0; run(); }); }).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

/* Fallpfad Demo-Konten: läuft direkt nach config.js, vor der App.
   Zugangsdaten werden nur im Browser erkannt, es gibt kein echtes Konto in der Datenbank. */
(function () {
  var APPK = window.FP_APP_KIND || "schueler";
  var K = "fp-demo-acc", PW = "Demo2026";
  var ACC = { "lehrer@demo.fallpfad.de": "lehrer", "schueler@demo.fallpfad.de": "schueler" };
  var a = null;
  try { a = localStorage.getItem(K); } catch (e) {}
  if (a && a !== APPK) a = null;
  if (a) {
    window.FP_DEMO_ACC = a;
    window.FALLPFAD_CONFIG = Object.assign({}, window.FALLPFAD_CONFIG || {}, { supabaseUrl: "", supabaseAnonKey: "" });
    window.FALLPFAD_CONFIG_ERROR = undefined;
  }
  window.FP_DEMO_END = function () {
    try {
      localStorage.removeItem(K);
      localStorage.removeItem("fp-demo-auto");
      var del = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^fallpfad-(state:lokal-demo|session|profiles|nw-demo2|bg-demo|demo-t0|course|msg-read|lehrer-demo)/.test(k) || /^fp-(tour|demo)/.test(k)) del.push(k);
      }
      if (window.FP_DEMO_ACC) del.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
    location.reload();
  };
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f || !f.querySelector) return;
    var em = f.querySelector("input[type=email]"), pw = f.querySelector("input[type=password]");
    if (!em || !pw) return;
    var acc = ACC[String(em.value || "").trim().toLowerCase()];
    if (!acc || pw.value !== PW) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (acc !== APPK) {
      alertBox(acc === "lehrer" ? "Das ist das Demo-Konto für das Lehrer-Portal." : "Das ist das Demo-Konto für die Schüler-App.");
      return;
    }
    try {
      localStorage.setItem(K, acc);
      localStorage.setItem("fp-demo-auto", "1");
    } catch (x) {}
    location.reload();
  }, true);
  function alertBox(t) {
    var d = document.createElement("div");
    d.className = "fx-toast";
    d.textContent = t;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 4000);
  }
  /* Abmelden im Demo-Konto beendet die Demo und setzt alles zurück */
  document.addEventListener("click", function (e) {
    if (!window.FP_DEMO_ACC) return;
    var b = e.target && e.target.closest && e.target.closest("button");
    if (!b) return;
    var t = (b.textContent || "").trim();
    if (/^Abmelden$/.test(t)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.FP_DEMO_END();
    }
  }, true);
  if (a) {
    var addBadge = function () {
      if (document.getElementById("fx-demo")) return;
      var d = document.createElement("div");
      d.id = "fx-demo";
      d.innerHTML = '<span>Demo-Konto</span><button type="button">Beenden</button>';
      d.querySelector("button").onclick = window.FP_DEMO_END;
      document.body.appendChild(d);
    };
    if (document.body) addBadge(); else document.addEventListener("DOMContentLoaded", addBadge);
  }
})();

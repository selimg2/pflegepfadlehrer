/* Fallpfad: Feedback geben und anonyme Nutzungszähler (Schüler-App und Lehrer-Portal).
   Datenschutz:
   - FP_ZAEHLE schickt nur Ereignisname und Schlüssel (z. B. "modul_start", "fm12"). Der Server zählt je Tag und Schule,
     ohne Nutzerkennung, ohne Inhalte. Gleiche Ereignisse werden pro Gerät höchstens alle 30 Minuten einmal gezählt.
   - Feedback: Die Person bleibt anonym, außer sie kreuzt „Rückmeldung erwünscht“ an.
   - Ohne Anmeldung oder im Demo-Modus wird nichts gesendet. */
(function () {
  var KIND = window.FP_APP_KIND === "lehrer" ? "lehrer" : "schueler";
  function client() {
    if (window.FP_DEMO_ACC) return Promise.resolve(null);
    var f = window.FP_SBC || window.FP_SB;
    if (!f) return Promise.resolve(null);
    return Promise.resolve().then(f).catch(function () { return null; });
  }
  function rpc(fn, args) {
    return client().then(function (c) {
      if (!c || !c.rpc) throw new Error("Bitte melde dich an.");
      return c.rpc(fn, args).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; });
    });
  }

  /* ---------- anonyme Zähler ---------- */
  var MERK = "fp-z-" + KIND;
  function frisch(key) {
    var now = Date.now(), m = {};
    try { m = JSON.parse(sessionStorage.getItem(MERK) || "{}"); } catch (e) {}
    if (m[key] && now - m[key] < 30 * 60 * 1000) return false;
    m[key] = now;
    try { sessionStorage.setItem(MERK, JSON.stringify(m)); } catch (e) {}
    return true;
  }
  window.FP_ZAEHLE = function (ereignis, schluessel) {
    ereignis = String(ereignis || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40);
    schluessel = String(schluessel || "").replace(/[^A-Za-z0-9_:.\-]/g, "").slice(0, 60);
    if (!ereignis || !frisch(ereignis + "|" + schluessel)) return;
    client().then(function (c) {
      if (!c || !c.auth) return;
      return c.auth.getSession().then(function (s) {
        if (!s || !s.data || !s.data.session) return;
        return c.rpc("fp_zaehle", { p_ereignis: ereignis, p_schluessel: schluessel, p_app: KIND });
      });
    }).catch(function () {});
  };
  // eine „Sitzung“ je Tag und Gerät
  setTimeout(function () {
    var tag = new Date().toISOString().slice(0, 10), k = "fp-sitzung-" + KIND;
    try { if (localStorage.getItem(k) === tag) return; localStorage.setItem(k, tag); } catch (e) {}
    window.FP_ZAEHLE("sitzung", KIND);
  }, 6000);

  /* ---------- Feedback-Dialog ---------- */
  var KATS = [["lob", "Das gefällt mir"], ["idee", "Idee / Wunsch"], ["fehler", "Fehler gefunden"], ["inhalt", "Fachlicher Inhalt"], ["bedienung", "Bedienung"], ["sonstiges", "Sonstiges"]];
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function css() {
    if (document.getElementById("fp-fb-css")) return;
    var st = document.createElement("style");
    st.id = "fp-fb-css";
    st.textContent = [
      ".fpfb-bg{position:fixed;inset:0;z-index:2147482000;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}",
      ".fpfb{background:var(--surface,#fff);color:var(--fg,#0f172a);width:100%;max-width:440px;border-radius:18px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25);max-height:92vh;overflow:auto}",
      ".fpfb h2{margin:0 0 4px;font-size:20px}.fpfb p{margin:0 0 14px;color:var(--muted,#64748b);font-size:14px;line-height:1.5}",
      ".fpfb-stars{display:flex;gap:6px;margin:4px 0 14px}.fpfb-stars button{all:unset;cursor:pointer;font-size:30px;line-height:1;color:#cbd5e1;min-width:36px;text-align:center}.fpfb-stars button.on{color:#f59e0b}",
      ".fpfb-kats{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.fpfb-kats button{all:unset;cursor:pointer;font-size:13px;padding:7px 11px;border-radius:999px;background:var(--fill,#eef2f7)}.fpfb-kats button.on{background:var(--accent,#0062FF);color:#fff}",
      ".fpfb textarea{width:100%;box-sizing:border-box;min-height:110px;border-radius:12px;border:1px solid var(--line,#cbd5e1);padding:10px;font:inherit;background:var(--bg,#fff);color:inherit}",
      ".fpfb label.k{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:10px 0;color:var(--muted,#64748b)}",
      ".fpfb-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.fpfb-row button{border:0;border-radius:12px;padding:10px 16px;font-weight:600;cursor:pointer;font:inherit}",
      ".fpfb-row .go{background:var(--accent,#0062FF);color:#fff}.fpfb-row .no{background:var(--fill,#eef2f7);color:inherit}.fpfb .msg{font-size:14px;margin-top:8px}"
    ].join("");
    document.head.appendChild(st);
  }
  function open() {
    css();
    var stars = 0, kat = "", bg = document.createElement("div");
    bg.className = "fpfb-bg";
    bg.innerHTML = '<div class="fpfb" role="dialog" aria-modal="true" aria-label="Feedback geben">' +
      "<h2>Feedback geben</h2><p>Was läuft gut, was fehlt, wo hakt es? Deine Rückmeldung geht direkt an das Fallpfad-Team. Sie ist anonym, außer du möchtest eine Antwort.</p>" +
      '<div class="fpfb-stars" role="radiogroup" aria-label="Bewertung">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-s="' + n + '" aria-label="' + n + ' von 5">★</button>'; }).join("") + "</div>" +
      '<div class="fpfb-kats">' + KATS.map(function (k) { return '<button type="button" data-k="' + k[0] + '">' + esc(k[1]) + "</button>"; }).join("") + "</div>" +
      '<textarea maxlength="2000" placeholder="Deine Nachricht (bitte keine Namen von Patientinnen, Patienten oder Mitschülern)"></textarea>' +
      '<label class="k"><input type="checkbox"> <span>Rückmeldung erwünscht: Das Team darf mich per E-Mail kontaktieren. Dafür wird mein Konto mit dem Feedback gespeichert.</span></label>' +
      '<div class="msg" role="status"></div>' +
      '<div class="fpfb-row"><button type="button" class="no">Abbrechen</button><button type="button" class="go">Senden</button></div></div>';
    document.body.appendChild(bg);
    var box = bg.querySelector(".fpfb"), msg = box.querySelector(".msg");
    function close() { bg.remove(); }
    bg.addEventListener("click", function (e) {
      if (e.target === bg || e.target.classList.contains("no")) return close();
      var s = e.target.closest("[data-s]");
      if (s) { stars = Number(s.dataset.s); box.querySelectorAll("[data-s]").forEach(function (b) { b.classList.toggle("on", Number(b.dataset.s) <= stars); }); return; }
      var k = e.target.closest("[data-k]");
      if (k) { kat = kat === k.dataset.k ? "" : k.dataset.k; box.querySelectorAll("[data-k]").forEach(function (b) { b.classList.toggle("on", b.dataset.k === kat); }); return; }
      if (e.target.classList.contains("go")) {
        var txt = box.querySelector("textarea").value.trim();
        if (!stars && !txt) { msg.textContent = "Bitte gib eine Bewertung oder einen Text ein."; return; }
        e.target.disabled = true;
        msg.textContent = "Wird gesendet …";
        rpc("fp_feedback_senden", { p_app: KIND, p_bewertung: stars || null, p_kategorie: kat, p_text: txt, p_seite: (location.hash || "").slice(1, 40), p_kontakt: box.querySelector("input[type=checkbox]").checked })
          .then(function () { box.innerHTML = "<h2>Danke!</h2><p>Deine Rückmeldung ist angekommen und hilft, Fallpfad besser zu machen.</p><div class=\"fpfb-row\"><button type=\"button\" class=\"go no\">Schließen</button></div>"; })
          .catch(function (er) { e.target.disabled = false; msg.textContent = /function|does not exist|PGRST/i.test(er.message) ? "Feedback ist gerade nicht verfügbar." : er.message; });
      }
    });
    document.addEventListener("keydown", function f(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", f); } });
    setTimeout(function () { var b = box.querySelector("[data-s]"); if (b) b.focus(); }, 30);
  }
  window.FP_FEEDBACK = { open: open };
})();

/* Kurze Einführung beim ersten Anmelden: hebt die wichtigsten Bereiche hervor. */
(function () {
  var KIND = window.FP_APP_KIND || "schueler", KEY = "fp-tour-" + KIND;
  var X = window.FX || { C: {}, NAV: {} }, C = X.C;
  var ICON = {
    hi: '<path d="M7 11.5V6.8a1.6 1.6 0 0 1 3.2 0v4M10.2 10.5V5.3a1.6 1.6 0 0 1 3.2 0v5.2M13.4 10.8V6.6a1.6 1.6 0 0 1 3.2 0v6.6c0 4-2.6 7.3-6.4 7.3-2.4 0-4-1.2-5.3-3.4L3.2 13.6a1.5 1.5 0 0 1 2.4-1.8L7 13.5"/>',
    home: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    book: '<path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z"/><path d="M5 16.5a3 3 0 0 1 3-3h11"/>',
    cap: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.6 1.6 3.4 2.3 5.5 2.3s3.9-.7 5.5-2.3V11"/>',
    clip: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5h6v3H9zM8.5 12l2.2 2.2 4.8-4.7"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    chart: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
    layers: '<path d="M12 3.5 21 8l-9 4.5L3 8z"/><path d="m3 12.5 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"/>',
    up: '<path d="M12 16V4.5M7 9l5-5 5 5"/><path d="M4.5 15v4.5h15V15"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z"/>',
    mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
    ok: '<path d="M5 12.5 10 17l9-10"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    school: '<path d="M3 20.5h18M5 20.5V10l7-5 7 5v10.5M10 20.5v-5h4v5"/>'
  };
  var STEPS = {
    schueler: [
      { ic: "hi", c: C.blue, t: "Willkommen bei Fallpfad", p: "Fallpfad begleitet dich durch die ganze Ausbildung: lernen an echten Fällen, üben fürs Examen und dein Ausbildungsnachweis ohne Papier. In zwei Minuten zeigen wir dir, wo du was findest." },
      { tab: "Home", ic: "home", t: "Home: dein Startpunkt", p: "Oben findest du vier Schnellstarts. <b>Weiterlernen</b> bringt dich genau dorthin, wo du aufgehört hast. Darunter stehen Nachrichten deiner Lehrkräfte. Tippe auf <b>Gelesen</b>, wenn du sie gesehen hast." },
      { tab: "Lernmodule", ic: "book", t: "Lernmodule: lernen am Fall", p: "Jedes Modul begleitet einen Menschen durch mehrere Stationen. <b>So geht’s:</b> Modul antippen, Station für Station lesen, Aufgaben lösen und Punkte sammeln. Mit dem Pfeil oben links kommst du zurück. Module mit Schloss schaltet deine Lehrkraft frei." },
      { tab: "Training", ic: "cap", t: "Training: üben fürs Examen", p: "Lernkarten mit Wiederholungsplan, Fachlexikon, Praktisches Examen, Simulationen, PharmakoLab und mehr. <b>Tipp:</b> Zehn Minuten Lernkarten am Tag bringen mehr als ein langer Abend vor der Prüfung." },
      { tab: "Praxis", ic: "clip", t: "Praxis: dein Ausbildungsnachweis", p: "<b>So geht’s:</b> Im laufenden Einsatz auf <b>Arbeitstag eintragen</b> tippen, Zeiten wählen, speichern. Für die Unterschrift <b>Unterschrift holen</b> tippen und das Handy deiner Praxisanleitung geben. Unter <b>Praxisbegleiter</b> findest du die Kitteltasche mit Normwerten und Schemata." },
      { tab: "Aufgaben", ic: "list", t: "Aufgaben deiner Lehrkraft", p: "Ein roter Punkt zeigt neue Aufgaben. Aufgabe antippen, bearbeiten und abgeben. Den Abgabetermin siehst du immer oben auf der Karte." },
      { tab: "Fortschritt", ic: "chart", t: "Fortschritt", p: "Punkte, Lernkalender und Kompetenzen auf einen Blick." },
      { tab: "Einstellungen", ic: "users", c: C.slate, t: "Einstellungen", p: "Profil, Farbe, Hell oder Dunkel, Meine Sprache, dein Kurs und Datenschutz. <b>Kurs beitreten:</b> Hier gibst du den Code ein, den du von deiner Lehrkraft bekommst. Die Einführung kannst du hier jederzeit wiederholen." },
      { sel: ".topbar .avbtn, .sideprof", ic: "users", c: C.violet, t: "Dein Profil", p: "Tippe auf dein Profil: Dort änderst du schnell Farbe, Hell oder Dunkel und Sprache, startest das Tutorial erneut oder meldest dich ab." },
      { ic: "chat", c: C.blue, t: "Meine Sprache", p: "Deutsch ist nicht deine Erstsprache oder Fachtexte sind manchmal schwer? Wähle im Profil <b>Meine Sprache</b>. Dann übersetzt dir Fallpfad Lernblöcke oder schreibt sie in einfaches Deutsch, zeigt wichtige Wörter mit Artikel und liest vor. Text markieren geht auch. Unter Training findest du <b>Fachsprache Deutsch</b>." },
      { sel: '.topbar .iconbtn[aria-label="Suche öffnen"], .topbar .iconbtn', ic: "search", c: C.slate, t: "Suche", p: "Über die Lupe findest du jedes Thema, jeden Fachbegriff und jedes Modul." },
      { ic: "play", c: C.red, t: "Live im Unterricht", p: "Zeigt deine Lehrkraft vorne einen QR-Code, scanne ihn mit der Handykamera. Du antwortest anonym, vorne erscheint das Ergebnis der Klasse. Weiterblättern kann nur die Lehrkraft." },
      { ic: "ok", c: C.green, t: "Alles klar, los geht’s!", p: "Fang am besten mit <b>Weiterlernen</b> auf Home an. Die Einführung findest du jederzeit wieder unter <b>Einstellungen</b> oder in deinem Profil.", last: true }
    ],
    lehrer: [
      { ic: "hi", c: C.blue, t: "Willkommen im Lehrer-Portal", p: "Hier steuerst du Kurse, Module, Aufgaben, den Ausbildungsnachweis und den Live-Unterricht. Wir zeigen dir in zwei Minuten, wie du die wichtigsten Dinge erledigst." },
      { tab: "Übersicht", ic: "home", t: "Übersicht", p: "Dein Unterricht heute, Schnellzugriff auf die häufigsten Aufgaben und alle Benachrichtigungen. Rot markierte Hinweise brauchen deine Aufmerksamkeit." },
      { tab: "Kurse & Schüler", ic: "users", t: "Kurse & Schüler", p: "<b>Kurs anlegen:</b> Neuer Kurs, Name und Ausbildungsjahr eintragen, fertig. Es entsteht ein Einladungscode, den die Lernenden in der App unter Fortschritt eingeben. Ein Klick auf eine Person öffnet die Schülerakte mit Lernstand und Nachweis." },
      { tab: "Module", ic: "layers", t: "Module und Freischalten", p: "Alle Fallmodule ansehen, als Kopie anpassen oder neu bauen. <b>Für Kurse freischalten:</b> pro Kurs festlegen, welche Module frei, gesperrt oder ausgeblendet sind. <b>Aus Folien erstellen:</b> PowerPoint oder PDF hochladen, daraus entsteht ein fertiger Entwurf." },
      { tab: "Aufgaben", ic: "list", t: "Aufgaben stellen", p: "<b>So geht’s:</b> Neue Aufgabe, Art wählen (Modul, Training, Team-Krankenhaus, Live-Fall oder eigene Aufgabe), Kurs und Termin festlegen, stellen. Wer abgegeben hat, siehst du sofort." },
      { tab: "Ausbildungsnachweis", ic: "clip", t: "Ausbildungsnachweis", p: "Stunden, Praxisanleitung, Fehlzeiten und Unterschriften aller Lernenden. Fehlt etwas, siehst du es hier und in der Schülerakte." },
      { tab: "Feedback", ic: "chat", t: "Feedback", p: "Freitags gibt die Klasse kurzes Feedback zum Unterricht, dazu Rückmeldungen aus den Einsätzen. So erkennst du früh, wo es hakt." },
      { tab: "Live", ic: "play", t: "Live im Unterricht", p: "Drei Wege: <b>Live-Stunde bauen</b> aus 17 Methoden, <b>Modul live an der Tafel</b> oder aus Folien. Auf <b>Live starten</b> klicken, QR-Code am Beamer zeigen, mit Pfeiltaste weiter. Die Klasse antwortet anonym und kann nicht vorblättern." },
      { tab: "Nachrichten", ic: "mail", t: "Nachrichten", p: "Empfänger wählen (Kurs oder einzelne Lernende), Text schreiben, Ablaufzeit in Stunden oder Tagen festlegen. Mit <b>Wichtig</b> erscheint die Nachricht rot." },
      { sel: ".fxpm-av, .fxpm-foot", ic: "users", c: C.violet, t: "Dein Profil", p: "Über dein Profil oben rechts oder unten links wählst du die Farbe, Hell oder Dunkel, öffnest die Einstellungen und meldest dich ab." },
      { ic: "ok", c: C.green, t: "Fertig!", p: "Guter erster Schritt: einen Kurs anlegen und den Code an die Klasse geben. Die Einführung findest du jederzeit wieder in deinem Profil unter <b>Tutorial</b>.", last: true }
    ]
  };
  function svg(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[k] || ICON.ok) + "</svg>"; }
  function visTab(name) {
    var all = document.querySelectorAll(".tab");
    for (var i = 0; i < all.length; i++) {
      var t = all[i], r = t.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (t.textContent || "").replace(/\d+$/, "").trim() === name) return t;
    }
    return null;
  }
  var root = null, idx = 0, steps = [];
  function end(done) {
    if (root) { root.forEach(function (n) { n.remove(); }); root = null; }
    window.removeEventListener("resize", draw);
    document.removeEventListener("keydown", onKey, true);
    try { localStorage.setItem(KEY, done ? "1" : "skip"); } catch (e) {}
  }
  function onKey(e) {
    if (!root) return;
    if (e.key === "Escape") { e.preventDefault(); end(false); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); if (idx > 0) { idx--; draw(); } }
  }
  function next() { if (idx >= steps.length - 1) end(true); else { idx++; draw(); } }
  function draw() {
    if (!root) return;
    var st = steps[idx], bg = root[0], hole = root[1], card = root[2];
    var el = st.tab ? visTab(st.tab) : st.sel ? document.querySelector(st.sel) : null;
    if (el && el.getBoundingClientRect().width === 0) el = null;
    var c = st.c || (st.tab && X.NAV[st.tab]) || "#0062FF";
    card.style.setProperty("--tc", c);
    hole.style.setProperty("--tc", c);
    card.innerHTML = '<div class="fx-tic">' + svg(st.ic) + "</div><h3>" + st.t + "</h3><p>" + st.p + '</p><div class="fx-tnav"><span class="fx-dots">' + steps.map(function (s, i) { return '<i class="' + (i === idx ? "on" : "") + '"></i>'; }).join("") + "</span>" + (st.last ? "" : '<button type="button" class="fx-skip">Überspringen</button>') + (idx > 0 && !st.last ? '<button type="button" class="fx-back">Zurück</button>' : "") + '<button type="button" class="fx-next">' + (st.last ? "Los geht’s" : idx === 0 ? "Tour starten" : "Weiter") + "</button></div>";
    card.querySelector(".fx-next").onclick = next;
    var sk = card.querySelector(".fx-skip"); if (sk) sk.onclick = function () { end(false); };
    var bk = card.querySelector(".fx-back"); if (bk) bk.onclick = function () { idx--; draw(); };
    card.setAttribute("aria-label", st.t);
    var W = innerWidth, H = innerHeight, cw = card.offsetWidth || 360, ch = card.offsetHeight || 220;
    if (el) {
      var r = el.getBoundingClientRect(), pad = 6;
      bg.style.display = "none";
      hole.style.display = "block";
      hole.style.left = r.left - pad + "px"; hole.style.top = r.top - pad + "px";
      hole.style.width = r.width + pad * 2 + "px"; hole.style.height = r.height + pad * 2 + "px";
      var left, top;
      if (r.right + 16 + cw < W && r.left < W / 2) { left = r.right + 18; top = r.top + r.height / 2 - ch / 2; }
      else if (r.top > H / 2) { left = r.left + r.width / 2 - cw / 2; top = r.top - ch - 18; }
      else { left = r.left + r.width / 2 - cw / 2; top = r.bottom + 18; }
      card.style.left = Math.max(16, Math.min(W - cw - 16, left)) + "px";
      card.style.top = Math.max(16, Math.min(H - ch - 16, top)) + "px";
    } else {
      hole.style.display = "none";
      bg.style.display = "block";
      card.style.left = (W - cw) / 2 + "px";
      card.style.top = Math.max(16, (H - ch) / 2) + "px";
    }
    var nb = card.querySelector(".fx-next"); if (nb) nb.focus({ preventScroll: true });
  }
  function start() {
    if (root) return;
    steps = STEPS[KIND] || STEPS.schueler;
    idx = 0;
    var bg = document.createElement("div"); bg.className = "fx-tour-bg";
    var hole = document.createElement("div"); hole.className = "fx-tour-hole";
    var card = document.createElement("div"); card.className = "fx-tour"; card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true");
    bg.onclick = function () {};
    document.body.appendChild(bg); document.body.appendChild(hole); document.body.appendChild(card);
    root = [bg, hole, card];
    draw();
    requestAnimationFrame(draw);
    window.addEventListener("resize", draw);
    document.addEventListener("keydown", onKey, true);
  }
  /* Konto erkennen: Tutorial nur nach der Registrierung, Knopf eine Stunde lang */
  function acct() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.*-auth-token$/.test(k)) { var v = JSON.parse(localStorage.getItem(k) || "null"), u = v && (v.user || (v.currentSession && v.currentSession.user)); if (u && u.id) return { id: u.id, created: Date.parse(u.created_at || "") || 0 }; }
      }
    } catch (e) {}
    if (window.FP_DEMO_ACC) {
      var dk = "fp-tour-demo-" + KIND, t0 = 0;
      try { t0 = Number(localStorage.getItem(dk)) || 0; if (!t0) { t0 = Date.now(); localStorage.setItem(dk, String(t0)); } } catch (e) { t0 = Date.now(); }
      return { id: "demo", created: t0, demo: true };
    }
    return null;
  }
  var HOUR = 3600 * 1000;
  function keyFor(a) { return KEY + "-" + a.id; }
  function firstKey(a) { return KEY + "-first-" + a.id; }
  function seen(a) { try { return !!localStorage.getItem(keyFor(a)); } catch (e) { return true; } }
  function chipUntil(a) {
    var f = 0; try { f = Number(localStorage.getItem(firstKey(a))) || 0; } catch (e) {}
    return Math.max(a.created || 0, f) + HOUR;
  }
  var _end = end;
  end = function (done) { _end(done); var a = acct(); if (a) try { localStorage.setItem(keyFor(a), done ? "1" : "skip"); } catch (e) {} };
  window.FP_TOUR = { start: start };
  function ready() {
    if (KIND === "schueler") return document.querySelector("main .hello") && visTab("Home");
    return document.querySelector(".side .tab, .tab") && document.querySelector("main .topbar, header.topbar") && !document.querySelector(".lwrap");
  }
  var tries = 0;
  function poll() {
    var a = acct();
    if (root) return;
    if (!a) { if (++tries < 120) setTimeout(poll, 1000); return; }
    /* Automatisch nur für neue Konten (bis 7 Tage nach Registrierung), nie im Demo-Konto */
    if (a.demo || seen(a) || Date.now() - a.created > 7 * 24 * HOUR) return;
    if (ready()) { setTimeout(function () { if (!root && ready()) { try { localStorage.setItem(firstKey(a), String(Date.now())); } catch (e) {} start(); } }, 900); return; }
    setTimeout(poll, ++tries < 120 ? 500 : 1500);
  }
  /* Kleiner Knopf "Tutorial" unten links, eine Stunde nach der Registrierung */
  var PLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>';
  function chip() {
    /* Der Tutorial-Knopf sitzt jetzt im Profilmenü und in den Einstellungen, nicht mehr dauerhaft unten links */
    var gone = document.querySelector(".fx-tourchip"); if (gone) gone.remove();
    return;
    var a = acct(), old = document.querySelector(".fx-tourchip");
    var show = a && Date.now() < chipUntil(a) && ready();
    if (!show) { if (old) old.remove(); return; }
    var side = document.querySelector(".side"), inSide = side && side.getBoundingClientRect().width > 0;
    if (old && (inSide ? old.parentNode === side : old.parentNode === document.body)) return;
    if (old) old.remove();
    var b = document.createElement("button"); b.type = "button"; b.className = "fx-tourchip" + (inSide ? " inside" : "");
    b.innerHTML = PLAY + "<span>Tutorial</span>"; b.title = "Einführung noch einmal ansehen";
    b.onclick = function () { start(); };
    if (inSide) { var ref = side.querySelector(".sideprof, .fxpm-foot, .foot"); side.insertBefore(b, ref || null); }
    else document.body.appendChild(b);
  }
  function boot() {
    poll();
    var q = 0;
    new MutationObserver(function () { if (q) return; q = 1; requestAnimationFrame(function () { q = 0; chip(); }); }).observe(document.body, { childList: true, subtree: true });
    setInterval(chip, 60000);
    window.addEventListener("resize", function () { setTimeout(chip, 120); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();

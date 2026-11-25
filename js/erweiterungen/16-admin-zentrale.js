/* Lehrer-Portal: Admin-Zentrale (nur Rolle admin, Reiter „Admin“).
   Bereiche: Übersicht (Kennzahlen, Verlauf), Schulen, Lehrkräfte (Anfragen, Konten), Feedback, Nutzung (Module, Trainings, KI), Datenschutz.
   Alle Zahlen kommen aus fp_admin_dashboard. Lernende erscheinen nur als Anzahl, nie mit Namen. */
(function () {
  var R = window.React;
  if (!R) return;
  var h = R.createElement, useState = R.useState, useEffect = R.useEffect, useMemo = R.useMemo;
  var Schulen = window.FP_AdminSchulen || window.FP_AdminPage, Anfragen = window.FP_AdminAnfragen;

  function rpc(fn, args) {
    if (!window.FP_SB) return Promise.reject(new Error("Im Demo-Modus gibt es keine Verwaltung."));
    return window.FP_SB().then(function (c) { return c.rpc(fn, args || {}); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; });
  }
  var num = function (n) { return Number(n || 0).toLocaleString("de-DE"); };
  var dt = function (d, mitZeit) { if (!d) return "–"; var x = new Date(d); return x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) + (mitZeit ? " " + x.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""); };
  var seit = function (d) { if (!d) return "nie"; var t = (Date.now() - new Date(d).getTime()) / 864e5; return t < 1 ? "heute" : t < 2 ? "gestern" : "vor " + Math.floor(t) + " Tagen"; };
  var fehlt = function (m) { return /fp_admin_dashboard|fp_admin_feedback|does not exist|Could not find|PGRST202/i.test(String(m || "")); };

  var CSS = [
    ".az-nav{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 18px}",
    ".az-nav button{all:unset;cursor:pointer;padding:8px 14px;border-radius:999px;background:var(--fill,#eef2f7);font-weight:600;font-size:14px;display:inline-flex;gap:6px;align-items:center}",
    ".az-nav button[aria-pressed=true]{background:var(--accent,#0062FF);color:#fff}",
    ".az-nav .az-b{background:#ff3b30;color:#fff;border-radius:999px;font-size:11px;padding:1px 7px}",
    ".az-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px}",
    ".az-kpi{background:var(--surface,#fff);border-radius:14px;padding:14px;box-shadow:0 1px 0 rgba(0,0,0,.04),0 0 0 1px var(--line,#e5e7eb)}",
    ".az-kpi b{display:block;font-size:24px;letter-spacing:-.02em}.az-kpi small{color:var(--muted,#64748b);font-size:12.5px}.az-kpi i{font-style:normal;font-size:12px;color:var(--muted,#64748b)}",
    ".az-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}",
    ".az-chart{width:100%;height:150px;display:block}.az-chart rect{fill:var(--accent,#0062FF)}.az-chart .b2{fill:#34c759}.az-chart .b3{fill:#ff9f0a}",
    ".az-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--muted,#64748b);margin-top:6px}.az-legend span:before{content:'';display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;background:var(--c)}",
    ".az-bars{display:flex;flex-direction:column;gap:7px}.az-bar{display:grid;grid-template-columns:minmax(0,1.6fr) 3fr auto;gap:10px;align-items:center;font-size:13.5px}",
    ".az-bar .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.az-bar .tr{height:9px;border-radius:9px;background:var(--fill,#eef2f7);overflow:hidden}.az-bar .tr i{display:block;height:100%;background:var(--accent,#0062FF);border-radius:9px}",
    ".az-tab{width:100%;border-collapse:collapse;font-size:13.5px}.az-tab th{text-align:left;font-weight:600;color:var(--muted,#64748b);font-size:12px;padding:8px 6px;border-bottom:1px solid var(--line,#e5e7eb)}",
    ".az-tab td{padding:9px 6px;border-bottom:1px solid var(--line,#eef0f3);vertical-align:top}.az-tab tr:last-child td{border-bottom:0}.az-scroll{overflow-x:auto}",
    ".az-fb{display:flex;flex-direction:column;gap:10px}.az-fbi{border-radius:14px;padding:14px;background:var(--surface,#fff);box-shadow:0 0 0 1px var(--line,#e5e7eb)}",
    ".az-fbi .h{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;color:var(--muted,#64748b)}.az-fbi .s{color:#f59e0b;letter-spacing:1px}",
    ".az-fbi p{margin:8px 0;white-space:pre-wrap}.az-fbi textarea{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid var(--line,#cbd5e1);padding:8px;font:inherit;min-height:54px;background:var(--bg,#fff);color:inherit}",
    ".az-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;background:var(--fill,#eef2f7)}.az-pill.neu{background:#ffe8e6;color:#c0362c}.az-pill.in_arbeit{background:#fff4d6;color:#a16207}.az-pill.erledigt{background:#e3f7e8;color:#15803d}",
    ".az-seg{display:inline-flex;gap:4px;background:var(--fill,#eef2f7);padding:3px;border-radius:10px}.az-seg button{all:unset;cursor:pointer;padding:5px 10px;border-radius:8px;font-size:13px}.az-seg button[aria-pressed=true]{background:var(--surface,#fff);box-shadow:0 1px 2px rgba(0,0,0,.08);font-weight:600}",
    ".az-note{font-size:13px;color:var(--muted,#64748b);line-height:1.5}",
    /* Neugestaltung im Stil der Portal-Startseite */
    ".az-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}.az-head .hello{margin-bottom:0}",
    ".az-tabs{position:sticky;top:0;z-index:5;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:22px 0 4px;padding:5px;border-radius:16px;background:color-mix(in srgb,var(--surface,#fff) 82%,transparent);backdrop-filter:saturate(1.6) blur(14px);-webkit-backdrop-filter:saturate(1.6) blur(14px);border:1px solid var(--line,#e5e7eb);box-shadow:var(--shadow,0 1px 2px rgba(0,0,0,.05))}",
    ".az-tabs::-webkit-scrollbar{display:none}",
    ".az-tabs button{all:unset;cursor:pointer;flex:0 0 auto;display:inline-flex;align-items:center;gap:8px;padding:9px 14px;border-radius:12px;font-weight:600;font-size:14px;color:var(--muted,#64748b);transition:background .15s,color .15s}",
    ".az-tabs button:hover{color:var(--fg,#111);background:var(--surface2,#f1f5f9)}",
    ".az-tabs button[aria-selected=true]{color:var(--accent,#0062FF);background:var(--accent-soft,#e8f0ff)}",
    ".az-tabs button:focus-visible{outline:2px solid var(--accent,#0062FF);outline-offset:2px}",
    ".az-tabs svg{width:18px;height:18px;flex:0 0 auto}.az-tabs .az-b{background:#ff3b30;color:#fff;border-radius:999px;font-size:11px;line-height:16px;min-width:16px;text-align:center;padding:0 5px}",
    ".az-att .qa{cursor:pointer}.az-att .qa b.az-n{font-size:30px;letter-spacing:-.02em;line-height:1.1}.az-att .qa .muted{font-size:13.5px}",
    ".az-att .qa.az-ok{--qc:var(--c-green,#16a34a)}.az-att .qa.az-warn{--qc:var(--c-amber,#d97706)}.az-att .qa.az-bad{--qc:#e11d48}.az-att .qa.az-info{--qc:var(--c-violet,#7c3aed)}.az-att .qa.az-blue{--qc:var(--c-blue,#2563eb)}",
    ".az-att .qa .az-go{position:absolute;right:16px;top:18px;font-size:13px;font-weight:600;color:var(--qc)}",
    ".az-blocks{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}",
    ".az-blocks .ksbstats{grid-template-columns:repeat(3,minmax(0,1fr))}.az-blocks .ksbstats>span{min-width:0}",
    ".az-blocks .ksbh small{display:block;color:rgba(255,255,255,.85);font-size:13px;margin-top:2px;position:relative;z-index:1}",
    ".az-blocks .ksbh .az-big{font-size:34px;font-weight:750;letter-spacing:-.03em;line-height:1;position:relative;z-index:1;text-align:right}",
    ".az-grid2>.card{display:flex;flex-direction:column}.az-grid2>.card .az-chart{margin-top:auto}",
    ".az-card-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px}.az-card-h h3{margin:0}.az-card-h span{font-size:13px;color:var(--muted,#64748b)}",
    ".az-tab tbody tr:hover td{background:var(--surface2,#f8fafc)}.az-tab td:first-child,.az-tab th:first-child{padding-left:10px}",
    ".az-grid2{align-items:stretch}.az-grid2>.card,.az-grid2>.card+.card{margin:0!important}",
    ".az-bar{grid-template-columns:minmax(0,2.2fr) minmax(60px,2fr) auto}",
    ".az-fbi{border-radius:18px;padding:16px 18px;border:1px solid var(--line,#e5e7eb);box-shadow:var(--shadow,none)}.az-fbi textarea{background:var(--surface2,#f6f7f9);border-color:transparent}",
    ".az-blocks .ksblock{text-align:left}",
    "@media (max-width:640px){.az-tabs button span.az-l{display:none}.az-tabs button{padding:9px 11px}}"
  ].join("");
  /* Linien-Icons im Stil der Portal-Navigation */
  var IC = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    school: "M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 10h.01M15 10h.01M12 10h.01",
    users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM22 19v-1a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.75",
    chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z",
    chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
    book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM20 17v4H6.5A2.5 2.5 0 0 1 4 18.5",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
    mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
    check: "M20 6 9 17l-5-5",
    alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"
  };
  function Ico(p) { return h("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, h("path", { d: IC[p.n] })); }
  window.FP_AdminIcon = Ico;
  function useCss() { useEffect(function () { if (document.getElementById("az-css")) return; var s = document.createElement("style"); s.id = "az-css"; s.textContent = CSS; document.head.appendChild(s); }, []); }

  var MODTITEL = function (id) {
    var m = (window.FP_MODS || []).filter(function (x) { return x.id === id; })[0];
    return m ? String(m.title || id).replace(/^Fallmodul \d+ · /, "") : id;
  };
  var EREIGNIS = { sitzung: "Sitzungen", modul_start: "Modul geöffnet", training: "Training geöffnet", bildbefund: "Bildbefund gelöst", bereich: "Portal-Bereich" };

  function Kpi(p) { return h("div", { className: "az-kpi" }, h("b", null, p.v), h("small", null, p.l), p.s ? h("i", null, " · " + p.s) : null); }

  function Verlauf(p) {
    var t = p.tage || [], W = 640, H = 150, n = t.length || 1, bw = W / n;
    var max = Math.max(1, Math.max.apply(null, t.map(function (x) { return (x.modul || 0) + (x.training || 0) + (x.sitzungen || 0); })));
    return h("div", null,
      h("svg", { className: "az-chart", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", role: "img", "aria-label": "Aktivität je Tag" },
        t.map(function (x, i) {
          var a = (x.sitzungen || 0) / max * (H - 10), b = (x.modul || 0) / max * (H - 10), c = (x.training || 0) / max * (H - 10);
          return h("g", { key: i },
            h("rect", { x: i * bw + 1, y: H - a, width: Math.max(1, bw - 2), height: a, rx: 2 }),
            h("rect", { className: "b2", x: i * bw + 1, y: H - a - b, width: Math.max(1, bw - 2), height: b, rx: 2 }),
            h("rect", { className: "b3", x: i * bw + 1, y: H - a - b - c, width: Math.max(1, bw - 2), height: c, rx: 2 }),
            h("title", null, dt(x.tag) + ": " + (x.sitzungen || 0) + " Sitzungen, " + (x.modul || 0) + " Modulaufrufe, " + (x.training || 0) + " Trainings, " + (x.neu || 0) + " neue Konten"));
        })),
      h("div", { className: "az-legend" }, h("span", { style: { "--c": "var(--accent,#0062FF)" } }, "Sitzungen"), h("span", { style: { "--c": "#34c759" } }, "Modulaufrufe"), h("span", { style: { "--c": "#ff9f0a" } }, "Trainings")));
  }
  function KiVerlauf(p) {
    var t = p.tage || [], W = 640, H = 150, n = t.length || 1, bw = W / n;
    var max = Math.max(1, Math.max.apply(null, t.map(function (x) { return (x.ki_assistent || 0) + (x.ki_gespraech || 0) + (x.ki_pflegeplanung || 0); })));
    return h("div", null, h("svg", { className: "az-chart", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", role: "img", "aria-label": "KI-Nutzung je Tag" },
      t.map(function (x, i) {
        var a = (x.ki_assistent || 0) / max * (H - 8), b = (x.ki_gespraech || 0) / max * (H - 8), c = (x.ki_pflegeplanung || 0) / max * (H - 8);
        return h("g", { key: i }, h("rect", { x: i * bw + 1, y: H - a, width: Math.max(1, bw - 2), height: a }), h("rect", { className: "b2", x: i * bw + 1, y: H - a - b, width: Math.max(1, bw - 2), height: b }), h("rect", { className: "b3", x: i * bw + 1, y: H - a - b - c, width: Math.max(1, bw - 2), height: c }), h("title", null, dt(x.tag) + ": Assistent " + (x.ki_assistent || 0) + ", Gespräche " + (x.ki_gespraech || 0) + ", Pflegeplanung " + (x.ki_pflegeplanung || 0)));
      })), h("div", { className: "az-legend" }, h("span", { style: { "--c": "var(--accent,#0062FF)" } }, "Assistent (Nachrichten)"), h("span", { style: { "--c": "#34c759" } }, "Sprachsimulation"), h("span", { style: { "--c": "#ff9f0a" } }, "Pflegeplanung")));
  }
  function Bars(p) {
    var l = p.rows || [], max = Math.max(1, Math.max.apply(null, l.map(function (r) { return r[1]; })));
    if (!l.length) return h("p", { className: "muted" }, p.leer || "Noch keine Daten.");
    return h("div", { className: "az-bars" }, l.map(function (r, i) {
      return h("div", { key: i, className: "az-bar" }, h("span", { className: "t", title: r[0] }, r[0]), h("span", { className: "tr" }, h("i", { style: { width: Math.max(2, 100 * r[1] / max) + "%" } })), h("b", null, num(r[1])));
    }));
  }

  /* Kachel „braucht Aufmerksamkeit“ (Stil: Schnellzugriff der Startseite) */
  function Att(p) {
    return h("button", { type: "button", className: "card qa " + p.k, onClick: p.onClick },
      h(Ico, { n: p.ico }), p.go ? h("span", { className: "az-go" }, p.go + " →") : null,
      h("b", { className: "az-n" }, p.v), h("b", null, p.t), h("span", { className: "muted" }, p.s));
  }
  /* Kennzahlenblock (Stil: Kurskarten der Startseite) */
  function Block(p) {
    return h("button", { type: "button", className: "ksblock", style: { "--kc": p.c }, onClick: p.onClick, "aria-label": p.t + ": " + p.big + " " + p.bigL },
      h("div", { className: "ksbh" },
        h("div", null, h("div", { className: "eyebrow" }, p.eb), h("b", null, p.t)),
        h("div", null, h("div", { className: "az-big" }, p.big), h("small", { style: { textAlign: "right" } }, p.bigL))),
      p.rows.map(function (r, i) { return h("div", { key: i, className: "ksbstats" }, r.map(function (s, j) { return h("span", { key: j }, h("b", null, s[0]), h("small", null, s[1])); })); }));
  }
  function Uebersicht(p) {
    var d = p.d, k = d.kpi || {}, go = p.go;
    var qs = useState(null), qst = qs[0], setQst = qs[1];
    useEffect(function () { if (window.FP_QuellenStatus) window.FP_QuellenStatus().then(setQst).catch(function () {}); }, []);
    var schulen = d.schulen || [];
    var still = schulen.filter(function (s) { return s.aktiv && !Number(s.aktiv_7); }).length;
    var gesperrt = schulen.filter(function (s) { return !s.aktiv; }).length;
    var att = [];
    if (Number(k.anfragen)) att.push(h(Att, { key: "a", k: "az-bad", ico: "users", v: num(k.anfragen), t: "Zugangsanfragen", s: "Lehrkräfte warten auf Freischaltung", go: "Prüfen", onClick: function () { go("lehrkraefte"); } }));
    if (Number(k.feedback_neu)) att.push(h(Att, { key: "f", k: "az-warn", ico: "chat", v: num(k.feedback_neu), t: "Neues Feedback", s: "Rückmeldungen aus App und Portal", go: "Lesen", onClick: function () { go("feedback"); } }));
    if (Number(k.unbestaetigt)) att.push(h(Att, { key: "u", k: "az-blue", ico: "mail", v: num(k.unbestaetigt), t: "E-Mail unbestätigt", s: "Konten ohne bestätigte Adresse", go: "Ansehen", onClick: function () { go("lehrkraefte"); } }));
    if (still || gesperrt) att.push(h(Att, { key: "s", k: "az-info", ico: "school", v: num(still + gesperrt), t: "Schulen ohne Aktivität", s: (still ? still + " ohne Nutzung in 7 Tagen" : "") + (still && gesperrt ? " · " : "") + (gesperrt ? gesperrt + " gesperrt" : ""), go: "Schulen", onClick: function () { go("schulen"); } }));
    if (qst && qst.offen) att.push(h(Att, { key: "q", k: "az-info", ico: "book", v: num(qst.offen), t: "Quellen ungeprüft", s: num(qst.geprueft) + " von " + num(qst.gesamt) + " geprüft", go: "Register", onClick: function () { go("quellen"); } }));
    if (!att.length) att.push(h(Att, { key: "ok", k: "az-ok", ico: "check", v: "Alles erledigt", t: "Keine offenen Punkte", s: "Anfragen, Feedback und Schulen sind auf dem neuesten Stand." }));
    var ki = d.ki || {};
    return h("div", null,
      h("div", { className: "sec" }, h("h2", null, "Braucht deine Aufmerksamkeit")),
      h("div", { className: "quick az-att" }, att),
      h("div", { className: "sec" }, h("h2", null, "Plattform in Zahlen"), h("span", { className: "muted", style: { fontSize: 14 } }, "Zeitraum: " + (d.zeitraum || 30) + " Tage")),
      h("div", { className: "az-blocks" },
        h(Block, { c: "#2563eb", eb: num(k.schulen) + " Schulen · " + num(k.schulen_aktiv) + " aktiv", t: "Schulen und Konten", big: num(k.lernende), bigL: "Lernende", onClick: function () { go("schulen"); },
          rows: [[[num(k.lehrkraefte), "Lehrkräfte"], [num(k.lernende_mit_kurs), "Lernende im Kurs"], [num(k.neu_zeitraum), "neue Konten"]], [[num(k.schulen_aktiv), "aktive Schulen"], [num(k.anfragen), "offene Anfragen"], [num(k.unbestaetigt), "E-Mail unbestätigt"]]] }),
        h(Block, { c: "#0d9488", eb: num(k.aktiv_30) + " aktiv in 30 Tagen", t: "Lernaktivität", big: num(k.aktiv_7), bigL: "aktiv in 7 Tagen", onClick: function () { go("nutzung"); },
          rows: [[[num(k.abgaben), "Abgaben"], [num(k.aufgaben), "Aufgaben"], [num(k.live_stunden), "Live-Stunden"]], [[num(k.pruefungen), "Examens-Durchläufe"], [num(k.nachweis_eintraege), "Nachweis-Einträge"], [num(k.kurse) + " / " + num(k.eigene_module), "Kurse / eigene Module"]]] }),
        h(Block, { c: "#9333ea", eb: num(k.feedback_neu) + " neue Rückmeldungen", t: "Feedback und KI", big: k.feedback_schnitt ? String(k.feedback_schnitt).replace(".", ",") + " ★" : "–", bigL: "Feedback-Schnitt", onClick: function () { go("feedback"); },
          rows: [[[num(ki.assistent), "Assistent-Nachrichten"], [num(ki.gespraeche), "Sprach­simulationen"], [num(ki.pflegeplanung), "Pflege­planungen"]], [[num(k.feedback_neu), "neues Feedback"], [num(ki.auswertungen), "KI-Auswertungen"], [Number(ki.uebersetzung_zeichen) >= 1000 ? num(Math.round(ki.uebersetzung_zeichen / 1000)) + " Tsd." : num(ki.uebersetzung_zeichen), "Zeichen übersetzt"]]] })),
      h("div", { className: "sec" }, h("h2", null, "Verlauf")),
      h("div", { className: "az-grid2" },
        h("div", { className: "card" }, h("div", { className: "az-card-h" }, h("h3", null, "Aktivität je Tag")), h(Verlauf, { tage: d.tage })),
        h("div", { className: "card" }, h("div", { className: "az-card-h" }, h("h3", null, "KI-Nutzung je Tag"), h("span", null, num(ki.auswertungen) + " Auswertungen · " + num(ki.uebersetzung_zeichen) + " Zeichen übersetzt")), h(KiVerlauf, { tage: d.tage }))),
      h("div", { className: "sec" }, h("h2", null, "Schulen im Vergleich"), h("button", { type: "button", className: "skip", onClick: function () { go("schulen"); } }, "Schulen verwalten")),
      h("div", { className: "card" }, h(SchulTabelle, { rows: d.schulen })));
  }

  function SchulTabelle(p) {
    var rows = p.rows || [];
    if (!rows.length) return h("p", { className: "muted" }, "Noch keine Schulen.");
    return h("div", { className: "az-scroll" }, h("table", { className: "az-tab" },
      h("thead", null, h("tr", null, ["Schule", "Status", "Lehrkräfte", "Lernende", "Aktiv 7 T.", "Kurse", "Module", "Aufgaben", "Live", "Aktionen", "Zuletzt"].map(function (x) { return h("th", { key: x }, x); }))),
      h("tbody", null, rows.map(function (s) {
        var lim = s.max_lernende ? " / " + s.max_lernende : "";
        return h("tr", { key: s.id },
          h("td", null, h("b", null, s.name), s.ort ? h("div", { className: "muted", style: { fontSize: 12 } }, s.ort) : null),
          h("td", null, h("span", { className: "az-pill " + (s.aktiv ? "erledigt" : "neu") }, s.aktiv ? "aktiv" : "gesperrt")),
          h("td", null, num(s.lehrkraefte)), h("td", null, num(s.lernende) + lim), h("td", null, num(s.aktiv_7)), h("td", null, num(s.kurse)),
          h("td", null, num(s.module)), h("td", null, num(s.aufgaben)), h("td", null, num(s.live)), h("td", null, num(s.aktionen)), h("td", null, seit(s.zuletzt)));
      }))));
  }

  function Lehrkraefte(p) {
    var d = p.d, q = useState(""), such = q[0], setSuch = q[1], f = useState("alle"), filt = f[0], setFilt = f[1];
    var schools = (d.schulen || []).map(function (s) { return { id: s.id, name: s.name, aktiv: s.aktiv }; });
    var rows = (d.konten || []).filter(function (k) {
      if (filt !== "alle" && k.rolle !== filt) return false;
      var t = (k.name + " " + k.email + " " + (k.schule || "")).toLowerCase();
      return !such || t.indexOf(such.toLowerCase()) >= 0;
    });
    return h("div", null,
      Anfragen ? h(Anfragen, { schools: schools, err: p.err, reload: p.reload }) : null,
      h("div", { className: "card", style: { marginTop: 14 } },
        h("div", { className: "row", style: { justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" } },
          h("h3", { style: { margin: 0 } }, "Lehrkräfte und Administration (" + rows.length + ")"),
          h("div", { className: "row", style: { gap: 8, flexWrap: "wrap" } },
            h("div", { className: "az-seg" }, [["alle", "Alle"], ["teacher", "Lehrkräfte"], ["admin", "Admin"]].map(function (x) { return h("button", { key: x[0], type: "button", "aria-pressed": filt === x[0], onClick: function () { setFilt(x[0]); } }, x[1]); })),
            h("input", { className: "input", style: { maxWidth: 220 }, placeholder: "Suchen …", value: such, onChange: function (e) { setSuch(e.target.value); } }))),
        h("div", { className: "az-scroll", style: { marginTop: 10 } }, h("table", { className: "az-tab" },
          h("thead", null, h("tr", null, ["Name", "E-Mail", "Rolle", "Schule", "Registriert", "Zuletzt angemeldet"].map(function (x) { return h("th", { key: x }, x); }))),
          h("tbody", null, rows.map(function (k) {
            return h("tr", { key: k.id }, h("td", null, h("b", null, k.name)), h("td", null, k.email, k.bestaetigt ? null : h("div", { className: "muted", style: { fontSize: 12 } }, "E-Mail unbestätigt")),
              h("td", null, k.rolle === "admin" ? "Admin" : "Lehrkraft"), h("td", null, k.schule || "–"), h("td", null, dt(k.registriert)), h("td", null, seit(k.zuletzt)));
          })))),
        h("p", { className: "az-note" }, "Lernende werden hier bewusst nicht namentlich angezeigt. Ihre Zahl siehst du je Schule in der Übersicht. Lehrkräfte entziehst oder verschiebst du unter „Schulen“.")));
  }

  function Feedback(p) {
    var st = useState("neu"), filt = st[0], setFilt = st[1], l = useState(null), list = l[0], setList = l[1], e = useState(null), err = e[0], setErr = e[1];
    var n = useState({}), notes = n[0], setNotes = n[1];
    var load = function () { setList(null); rpc("fp_admin_feedback", { p_status: filt === "alle" ? null : filt }).then(setList).catch(function (x) { setErr(x.message); setList([]); }); };
    useEffect(load, [filt]);
    var setStatus = function (id, s) { rpc("fp_admin_feedback_status", { p_id: id, p_status: s, p_notiz: notes[id] != null ? notes[id] : null }).then(function () { load(); p.reload(); }).catch(function (x) { setErr(x.message); }); };
    var stats = useMemo(function () {
      var by = {}; (list || []).forEach(function (f) { var k = f.kategorie || "ohne Kategorie"; by[k] = (by[k] || 0) + 1; });
      return Object.keys(by).map(function (k) { return [k, by[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    }, [list]);
    return h("div", null,
      h("div", { className: "row", style: { gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 } },
        h("div", { className: "az-seg" }, [["neu", "Neu"], ["in_arbeit", "In Arbeit"], ["erledigt", "Erledigt"], ["alle", "Alle"]].map(function (x) { return h("button", { key: x[0], type: "button", "aria-pressed": filt === x[0], onClick: function () { setFilt(x[0]); } }, x[1]); })),
        h("span", { className: "az-note" }, "Feedback kommt aus dem Menü „Feedback geben“ in Schüler-App und Lehrer-Portal.")),
      err && h("div", { className: "notice bad" }, fehlt(err) ? "Feedback ist gerade nicht verfügbar." : "Feedback konnte nicht geladen werden."),
      stats.length ? h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Nach Kategorie"), h(Bars, { rows: stats })) : null,
      !list ? h("p", { className: "muted" }, "Wird geladen …") : !list.length ? h("p", { className: "muted" }, "Keine Rückmeldungen in dieser Ansicht.") :
        h("div", { className: "az-fb", style: { marginTop: 12 } }, list.map(function (f) {
          return h("div", { key: f.id, className: "az-fbi" },
            h("div", { className: "h" }, h("span", null, dt(f.created_at, true) + " · " + (f.app === "lehrer" ? "Lehrer-Portal" : "Schüler-App") + (f.rolle ? " · " + (f.rolle === "student" ? "Lernende" : f.rolle === "teacher" ? "Lehrkraft" : f.rolle) : "") + (f.schule ? " · " + f.schule : "") + (f.seite ? " · Bereich: " + f.seite : "")),
              h("span", null, f.bewertung ? h("span", { className: "s" }, "★★★★★".slice(0, f.bewertung) + "☆☆☆☆☆".slice(0, 5 - f.bewertung)) : null, " ", h("span", { className: "az-pill " + f.status }, f.status === "in_arbeit" ? "in Arbeit" : f.status))),
            f.kategorie ? h("div", { style: { marginTop: 6 } }, h("span", { className: "az-pill" }, f.kategorie)) : null,
            f.text ? h("p", null, f.text) : h("p", { className: "muted" }, "(nur Bewertung)"),
            f.kontakt ? h("div", { className: "az-note" }, "Rückmeldung erwünscht: ", h("a", { href: "mailto:" + f.kontakt + "?subject=" + encodeURIComponent("Dein Feedback zu Fallpfad") }, f.kontakt)) : null,
            h("textarea", { placeholder: "Interne Notiz", value: notes[f.id] != null ? notes[f.id] : (f.notiz || ""), onChange: function (e) { var v = e.target.value; setNotes(function (x) { var y = Object.assign({}, x); y[f.id] = v; return y; }); } }),
            h("div", { className: "row", style: { gap: 6, marginTop: 8, flexWrap: "wrap" } },
              f.status !== "in_arbeit" && h("button", { type: "button", className: "btn ghost sm", onClick: function () { setStatus(f.id, "in_arbeit"); } }, "In Arbeit"),
              f.status !== "erledigt" && h("button", { type: "button", className: "btn sm", onClick: function () { setStatus(f.id, "erledigt"); } }, "Erledigt"),
              f.status !== "neu" && h("button", { type: "button", className: "btn ghost sm", onClick: function () { setStatus(f.id, "neu"); } }, "Wieder öffnen"),
              notes[f.id] != null && h("button", { type: "button", className: "btn ghost sm", onClick: function () { setStatus(f.id, null); } }, "Notiz speichern")));
        })));
  }

  function Nutzung(p) {
    var d = p.d;
    var mods = (d.module || []).map(function (m) { return [MODTITEL(m.modul), m.lernende]; }).slice(0, 25);
    var ev = (d.ereignisse || []);
    var trainings = ev.filter(function (e) { return e.ereignis === "training"; }).map(function (e) { return [e.schluessel || "Übersicht", e.anzahl]; }).slice(0, 20);
    var modStart = ev.filter(function (e) { return e.ereignis === "modul_start"; }).map(function (e) { return [MODTITEL(e.schluessel), e.anzahl]; }).slice(0, 20);
    var bereiche = ev.filter(function (e) { return e.ereignis === "bereich"; }).map(function (e) { return [e.schluessel, e.anzahl]; }).slice(0, 15);
    var sonst = ev.filter(function (e) { return ["training", "modul_start", "bereich"].indexOf(e.ereignis) < 0; }).map(function (e) { return [(EREIGNIS[e.ereignis] || e.ereignis) + (e.schluessel ? " · " + e.schluessel : ""), e.anzahl]; }).slice(0, 15);
    return h("div", { className: "az-grid2" },
      h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Module mit den meisten Lernenden"), h("p", { className: "az-note" }, "Anzahl Lernende, die im Modul mindestens eine Aufgabe gelöst haben (gesamt)."), h(Bars, { rows: mods })),
      h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Modulaufrufe im Zeitraum"), h(Bars, { rows: modStart, leer: "Noch keine Zählungen. Sie starten mit diesem Update." })),
      h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Trainings im Zeitraum"), h(Bars, { rows: trainings, leer: "Noch keine Zählungen." })),
      h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Lehrer-Portal: genutzte Bereiche"), h(Bars, { rows: bereiche, leer: "Noch keine Zählungen." })),
      h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Weitere Ereignisse"), h(Bars, { rows: sonst })));
  }

  function Datenschutz() {
    return h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Was hier gesammelt wird und was nicht"),
      h("ol", { className: "az-note", style: { fontSize: 14 } },
        h("li", null, "Nutzungszähler: nur Ereignis (z. B. „Modul geöffnet“), Modul- oder Trainingskennung, Tag, Schule und App. Keine Nutzerkennung, keine Inhalte, keine IP-Adresse. Ein Gerät zählt dasselbe Ereignis höchstens alle 30 Minuten einmal. Löschung nach 400 Tagen."),
        h("li", null, "Kennzahlen zu Konten und Aktivität werden beim Öffnen dieser Seite aus den vorhandenen Daten berechnet und nicht gesondert gespeichert."),
        h("li", null, "Lernende erscheinen ausschließlich als Anzahl. Namen und E-Mail-Adressen siehst du nur bei Lehrkräften und Administration, weil du diese freischalten musst."),
        h("li", null, "Feedback ist anonym. Die E-Mail-Adresse wird nur gespeichert, wenn die Person „Rückmeldung erwünscht“ ankreuzt. Löschung nach zwei Jahren."),
        h("li", null, "KI-Nutzung: nur die Anzahl je Konto und Tag als Kostenschutz, Inhalte werden nicht gespeichert; hier erscheinen nur Summen.")),
      h("p", { className: "az-note" }, "Für die Datenschutzerklärung: Rechtsgrundlage der Statistik ist das berechtigte Interesse an der Verbesserung und Absicherung des Angebots (Art. 6 Abs. 1 lit. f DSGVO) bzw. bei Schulen der Auftragsverarbeitungsvertrag. Lass die Formulierung vor dem Einsatz an Schulen prüfen."));
  }

  function Zentrale() {
    useCss();
    var t = useState(function () { try { return sessionStorage.getItem("fp-az-tab") || "uebersicht"; } catch (e) { return "uebersicht"; } }), tab = t[0], setTab = t[1];
    var z = useState(30), tage = z[0], setTage = z[1];
    var dd = useState(null), d = dd[0], setD = dd[1], e = useState(null), err = e[0], setErr = e[1];
    var load = function () { rpc("fp_admin_dashboard", { p_tage: tage }).then(function (x) { setD(x); setErr(null); }).catch(function (x) { setErr(x.message); var leer = { kpi: {}, tage: [], schulen: [], konten: [], module: [], ereignisse: [], ki: {}, zeitraum: tage }; setD(leer); rpc("fp_admin_schools").then(function (l) { setD(Object.assign({}, leer, { schulen: l || [] })); }).catch(function () {}); }); };
    useEffect(load, [tage]);
    var go = function (k) { setTab(k); try { sessionStorage.setItem("fp-az-tab", k); } catch (x) {} };
    if (!window.FP_SB) return h("div", { className: "wrap wide" }, h("div", { className: "hello" }, h("h1", null, "Admin")), h("div", { className: "card" }, h("p", { className: "muted" }, "Im Demo-Modus gibt es keine Verwaltung.")));
    var k = (d && d.kpi) || {};
    var TABS = [["uebersicht", "Übersicht", "home"], ["schulen", "Schulen", "school"], ["lehrkraefte", "Lehrkräfte", "users", k.anfragen], ["feedback", "Feedback", "chat", k.feedback_neu], ["nutzung", "Nutzung", "chart"], ["quellen", "Quellen", "book"], ["datenschutz", "Datenschutz", "shield"]];
    var std = new Date().getHours();
    return h("div", { className: "wrap wide" },
      h("div", { className: "az-head" },
        h("div", { className: "hello" }, h("div", { className: "eyebrow" }, "Fallpfad Admin-Zentrale"), h("h1", { style: { marginTop: 8 } }, std < 11 ? "Guten Morgen." : std < 18 ? "Guten Tag." : "Guten Abend."),
          h("p", null, "Schulen, Lehrkräfte, Nutzung, Feedback und Quellen der ganzen Plattform. Lernende erscheinen hier nur als Zahlen.")),
        ["uebersicht", "nutzung"].indexOf(tab) >= 0 && h("div", { className: "az-seg", role: "group", "aria-label": "Zeitraum" }, [[7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"], [365, "1 Jahr"]].map(function (x) { return h("button", { key: x[0], type: "button", "aria-pressed": tage === x[0], onClick: function () { setTage(x[0]); } }, x[1]); }))),
      h("nav", { className: "az-tabs", role: "tablist", "aria-label": "Admin-Bereiche" }, TABS.map(function (x) {
        return h("button", { key: x[0], type: "button", role: "tab", title: x[1], "aria-label": x[1] + (x[3] ? ", " + x[3] + " offen" : ""), "aria-selected": tab === x[0], onClick: function () { go(x[0]); } }, h(Ico, { n: x[2] }), h("span", { className: "az-l" }, x[1]), x[3] ? h("span", { className: "az-b", "aria-label": x[3] + " offen" }, x[3]) : null);
      })),
      err && h("div", { className: "notice bad" }, fehlt(err) ? "Statistiken sind gerade nicht verfügbar." : "Statistiken konnten nicht geladen werden."),
      h("div", { style: { marginTop: 18 } }, !d ? h("p", { className: "muted" }, "Wird geladen …") :
        tab === "uebersicht" ? h(Uebersicht, { d: d, go: go }) :
        tab === "schulen" ? (Schulen ? h(Schulen, { eingebettet: true }) : null) :
        tab === "lehrkraefte" ? h(Lehrkraefte, { d: d, err: setErr, reload: load }) :
        tab === "feedback" ? h(Feedback, { reload: load }) :
        tab === "nutzung" ? h(Nutzung, { d: d }) :
        tab === "quellen" ? (window.FP_AdminQuellen ? h(window.FP_AdminQuellen) : h("p", { className: "muted" }, "Quellenregister nicht geladen.")) : h(Datenschutz)));
  }
  window.FP_AdminPage = Zentrale;
})();

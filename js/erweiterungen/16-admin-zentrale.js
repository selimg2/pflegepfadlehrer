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
    ".az-note{font-size:13px;color:var(--muted,#64748b);line-height:1.5}"
  ].join("");
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
    var t = p.tage || [], W = 640, H = 120, n = t.length || 1, bw = W / n;
    var max = Math.max(1, Math.max.apply(null, t.map(function (x) { return (x.ki_assistent || 0) + (x.ki_gespraech || 0) + (x.ki_pflegeplanung || 0); })));
    return h("div", null, h("svg", { className: "az-chart", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", style: { height: 120 } },
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

  function Uebersicht(p) {
    var d = p.d, k = d.kpi || {};
    return h("div", null,
      h("div", { className: "az-kpis" },
        h(Kpi, { v: num(k.schulen), l: "Schulen", s: num(k.schulen_aktiv) + " aktiv" }),
        h(Kpi, { v: num(k.lehrkraefte), l: "Lehrkräfte" }),
        h(Kpi, { v: num(k.lernende), l: "Lernende", s: num(k.lernende_mit_kurs) + " im Kurs" }),
        h(Kpi, { v: num(k.aktiv_7), l: "Aktiv (7 Tage)", s: num(k.aktiv_30) + " in 30 T." }),
        h(Kpi, { v: num(k.neu_zeitraum), l: "Neue Konten", s: d.zeitraum + " Tage" }),
        h(Kpi, { v: num(k.kurse), l: "Kurse" }),
        h(Kpi, { v: num(k.eigene_module), l: "Eigene Module" }),
        h(Kpi, { v: k.feedback_schnitt ? String(k.feedback_schnitt).replace(".", ",") + " ★" : "–", l: "Feedback-Schnitt", s: num(k.feedback_neu) + " neu" }),
        h(Kpi, { v: num(k.anfragen), l: "Offene Anfragen" }),
        h(Kpi, { v: num(k.unbestaetigt), l: "E-Mail unbestätigt" }),
        h(Kpi, { v: num(k.abgaben), l: "Abgaben", s: num(k.aufgaben) + " Aufgaben" }),
        h(Kpi, { v: num(k.live_stunden), l: "Live-Stunden" }),
        h(Kpi, { v: num(k.pruefungen), l: "Examens-Durchläufe" }),
        h(Kpi, { v: num(k.nachweis_eintraege), l: "Nachweis-Einträge" })),
      h("div", { className: "az-grid2" },
        h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Aktivität je Tag"), h(Verlauf, { tage: d.tage })),
        h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "KI-Nutzung je Tag"), h(KiVerlauf, { tage: d.tage }),
          h("p", { className: "az-note" }, num(d.ki && d.ki.assistent) + " Assistent-Nachrichten · " + num(d.ki && d.ki.gespraeche) + " Gespräche · " + num(d.ki && d.ki.auswertungen) + " Auswertungen · " + num(d.ki && d.ki.pflegeplanung) + " Pflegeplanungen · " + num(d.ki && d.ki.uebersetzung_zeichen) + " Zeichen übersetzt"))),
      h("div", { className: "card", style: { marginTop: 14 } }, h("h3", { style: { marginTop: 0 } }, "Schulen im Vergleich"), h(SchulTabelle, { rows: d.schulen })));
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
    var TABS = [["uebersicht", "Übersicht"], ["schulen", "Schulen"], ["lehrkraefte", "Lehrkräfte", k.anfragen], ["feedback", "Feedback", k.feedback_neu], ["nutzung", "Nutzung"], ["datenschutz", "Datenschutz"]];
    return h("div", { className: "wrap wide" },
      h("div", { className: "hello" }, h("div", { className: "eyebrow" }, "Plattform-Administration"), h("h1", { style: { marginTop: 8 } }, "Admin-Zentrale"),
        h("p", null, "Alles auf einen Blick: Schulen, Lehrkräfte, Nutzung, KI und Feedback. Lernende erscheinen nur als Zahlen.")),
      h("div", { className: "row", style: { justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" } },
        h("nav", { className: "az-nav", "aria-label": "Admin-Bereiche" }, TABS.map(function (x) { return h("button", { key: x[0], type: "button", "aria-pressed": tab === x[0], onClick: function () { go(x[0]); } }, x[1], x[2] ? h("span", { className: "az-b" }, x[2]) : null); })),
        ["uebersicht", "nutzung"].indexOf(tab) >= 0 && h("div", { className: "az-seg" }, [[7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"], [365, "1 Jahr"]].map(function (x) { return h("button", { key: x[0], type: "button", "aria-pressed": tage === x[0], onClick: function () { setTage(x[0]); } }, x[1]); }))),
      err && h("div", { className: "notice bad" }, fehlt(err) ? "Statistiken sind gerade nicht verfügbar." : "Statistiken konnten nicht geladen werden."),
      !d ? h("p", { className: "muted" }, "Wird geladen …") :
        tab === "uebersicht" ? h(Uebersicht, { d: d }) :
        tab === "schulen" ? (Schulen ? h(Schulen, { eingebettet: true }) : null) :
        tab === "lehrkraefte" ? h(Lehrkraefte, { d: d, err: setErr, reload: load }) :
        tab === "feedback" ? h(Feedback, { reload: load }) :
        tab === "nutzung" ? h(Nutzung, { d: d }) : h(Datenschutz));
  }
  window.FP_AdminPage = Zentrale;
})();

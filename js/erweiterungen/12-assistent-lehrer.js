/* Fallpfad Lehrer-Portal: KI-Assistent für Lehrkräfte.
   - Gleicher Grundsatz wie in der Schüler-App: Antworten nur aus Fallpfad-Inhalten (content.json) und aus Quellen,
     die die Lehrkraft selbst hinzufügt (PDF, PowerPoint, eingefügter Text). Kein Internet.
   - Kann Module erstellen (über den Folien-Import), Klausuren mit Lösung, Unterrichtsplanungen und fachliche Fragen beantworten.
   - Eigene Quellen bleiben im Browser der Lehrkraft. An den KI-Dienst gehen nur die zur Frage passenden Abschnitte.
   - Nutzt den gemeinsamen Kern aus 11-assistent-kern.js (window.FP_AST_CORE). */
(function () {
  var R = window.React;
  if (!R || !window.FP_AST_CORE) return;
  var h = R.createElement, uS = R.useState, uE = R.useEffect, uR = R.useRef, Fr = R.Fragment;
  var C = window.FP_AST_CORE, Ic = C.Ic, Md = C.Md;

  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function ukey() { var e = window.FP_PROF && window.FP_PROF.email; return e ? String(e).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) : "lokal"; }

  /* Inhalte laden */
  var content = null;
  function loadContent() {
    if (content) return content;
    content = (window.FP_DATA && window.FP_DATA.mods ? Promise.resolve(window.FP_DATA) : fetch("content.json", { cache: "force-cache" }).then(function (r) { return r.json(); }))
      .then(function (c) { window.FP_DATA = window.FP_DATA || { mods: c.mods || [] }; return window.FP_DATA; }, function () { content = null; return { mods: [] }; });
    return content;
  }
  var APPIDX = null;
  function appIndex() { if (!APPIDX) APPIDX = C.makeIndex(C.appDocs()); return APPIDX; }
  function ownDocs(src) {
    var out = [];
    (src || []).forEach(function (q, qi) {
      var text = String(q.text || ""), parts = [], buf = "";
      text.split(/\n{2,}|(?<=\.)\s+(?=[A-ZÄÖÜ])/).forEach(function (p) { if ((buf + " " + p).length > 1400 && buf) { parts.push(buf); buf = p; } else buf = buf ? buf + " " + p : p; });
      if (buf) parts.push(buf);
      parts.forEach(function (p, k) { out.push({ id: "eig:" + qi + ":" + k, gruppe: "eig:" + qi, titel: "Eigene Quelle · " + q.titel + (parts.length > 1 ? " (" + (k + 1) + ")" : ""), text: p.replace(/\s+/g, " ").trim() }); });
    });
    return out;
  }

  function invoke(body) {
    if (!window.FP_SB) return Promise.reject(new Error("Im Demo-Modus ist der Assistent nicht mit dem Schulserver verbunden."));
    return window.FP_SB().then(function (c) {
      return c.functions.invoke("assistent", { body: Object.assign({ rolle: "lehrer" }, body) }).then(function (r) {
        if (r.error) {
          var ctx = r.error.context;
          if (ctx && ctx.json) return ctx.json().then(function (j) { var e = new Error((j && j.error) || "Der Assistent hat gerade nicht geantwortet."); e.rest = j && j.rest; throw e; }, function () { throw new Error("Der Assistent hat gerade nicht geantwortet."); });
          throw new Error("Der Assistent ist gerade nicht erreichbar.");
        }
        return r.data;
      });
    });
  }

  var CSS = [
    ".astl-src{display:flex;flex-direction:column;gap:8px}",
    ".astl-q{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:var(--surface2)}",
    ".astl-q>span:first-child{width:30px;height:30px;flex:0 0 30px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,#0A84FF 14%,var(--surface));color:#0A84FF}",
    ".astl-q div{flex:1;min-width:0}.astl-q b{display:block;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.astl-q small{color:var(--muted);font-size:12px}",
    ".astl-add{display:flex;gap:8px;flex-wrap:wrap}",
    ".astl-paste{display:flex;flex-direction:column;gap:8px;margin-top:4px}.astl-paste input,.astl-paste textarea{border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--fg);padding:8px 10px;font:inherit;font-size:14px}.astl-paste textarea{min-height:120px;resize:vertical}",
    ".astl-cons{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.4;color:var(--muted);margin-top:4px}.astl-cons input{margin-top:2px;accent-color:var(--accent)}",
    ".astl-tg{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13.5px;padding:4px 0}",
    ".astl-mod{border-radius:16px;box-shadow:inset 0 0 0 1px var(--line);padding:14px;display:flex;flex-direction:column;gap:10px}",
    ".astl-dok-a h4{margin:6px 0 4px;font-size:14.5px;letter-spacing:-.01em}.astl-dok-a{font-size:14.5px;line-height:1.55}",
    ".astl-jahr{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)}.astl-jahr .seg3{display:inline-flex}",
    ".astl-jahr button{all:unset;cursor:pointer;padding:4px 10px;border-radius:7px;font-size:13px;font-weight:600;color:var(--fg)}.astl-jahr button[aria-pressed=true]{background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.12)}",
    ".astl-mod ul{margin:0;padding-left:18px;font-size:14px}.astl-bar{height:6px;border-radius:6px;background:var(--surface2);overflow:hidden}.astl-bar i{display:block;height:100%;background:var(--accent);transition:width .3s}"
  ].join("\n");
  var st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);

  function ModulKarte(p) {
    var m = p.modul, s = uS({ step: "start", t: "", v: 0, err: null, res: null }), S = s[0];
    function run() {
      var q = p.quellen();
      if (!q.length) { s[1](Object.assign({}, S, { err: "Füge zuerst rechts unter „Meine Quellen“ Material hinzu oder lass „Fallpfad-Module einbeziehen“ eingeschaltet." })); return; }
      if (!window.FP_IMPORT || !window.FP_IMPORT.ausQuellen) { s[1](Object.assign({}, S, { err: "Der Folien-Import ist nicht geladen." })); return; }
      s[1]({ step: "gen", t: "Gliederung wird geplant …", v: 0.05 });
      window.FP_IMPORT.ausQuellen({ titel: m.titel, jahr: m.jahr, umfang: m.umfang, hinweis: [m.hinweis].concat(m.schwerpunkte || []).filter(Boolean).join(". "), quellen: q }, function (t, v) { s[1]({ step: "gen", t: t, v: v || 0.5 }); })
        .then(function (r) { s[1]({ step: "done", res: r }); }, function (e) { s[1]({ step: "start", err: e.message || String(e) }); });
    }
    return h("div", { className: "astl-mod" },
      h("div", { className: "ast-plan-h" }, h("span", { className: "ast-pi", style: { "--c": "#0A84FF" } }, h(Ic, { k: "book", s: 18 })),
        h("div", null, h("b", null, m.titel || "Neues Lernmodul"), h("small", null, m.jahr + ". Ausbildungsjahr · " + ({ kurz: "3 Stationen", mittel: "5 Stationen", lang: "7 Stationen" }[m.umfang] || "")))),
      m.schwerpunkte && m.schwerpunkte.length ? h("ul", null, m.schwerpunkte.map(function (x, i) { return h("li", { key: i }, x); })) : null,
      S.err ? h("div", { className: "ast-err" }, S.err) : null,
      S.step === "gen" ? h(Fr, null, h("small", null, S.t), h("div", { className: "astl-bar" }, h("i", { style: { width: Math.round(S.v * 100) + "%" } }))) : null,
      S.step === "done" ? h("div", { className: "ast-row" }, h("span", { style: { flex: 1, fontSize: 14 } }, h("b", null, "Fertig: "), (S.res.chapters || []).length + " Stationen als Entwurf. Bitte fachlich prüfen."), h("button", { type: "button", className: "btn sm", onClick: function () { window.FP_IMPORT.oeffnen(S.res); } }, "Im Editor öffnen")) : null,
      S.step === "start" ? h("div", { className: "ast-row" }, h("button", { type: "button", className: "btn sm", onClick: run }, h(Ic, { k: "spark", s: 15 }), "Modul jetzt erstellen"), h("small", { style: { color: "var(--muted)" } }, "Nutzt deine Quellen, das Ergebnis öffnet sich im Editor.")) : null);
  }

  function klausurText(k) {
    return k.titel + "\n\n" + k.fragen.map(function (f, i) { return (i + 1) + ". " + f.frage + "\n" + f.optionen.map(function (o, j) { return "   " + "ABCDE"[j] + ") " + o; }).join("\n"); }).join("\n\n") +
      "\n\nLösung\n" + k.fragen.map(function (f, i) { return (i + 1) + ". " + "ABCDE"[f.richtig] + " – " + f.erklaerung; }).join("\n");
  }

  var SUGS = [
    { k: "modul", ic: "book", c: "#0A84FF", t: "Modul aus Quellen erstellen", d: "Interaktives Lernmodul aus deinem Material", text: "Erstelle aus meinen Quellen ein Lernmodul für das 2. Ausbildungsjahr." },
    { k: "klausur", ic: "exam", c: "#AF52DE", t: "Klausur erstellen", d: "Fragen mit Lösung und Erklärung", text: "Erstelle eine Klausur mit 10 Fragen zum Thema " },
    { k: "plan", ic: "cal", c: "#FF9500", t: "Unterricht planen", d: "Einheiten mit Zeiten und passenden Modulen", text: "Plane eine Unterrichtssequenz mit 4 Doppelstunden zum Thema " },
    { k: "lernsituation", ic: "book", c: "#FF2D55", t: "Lernsituation schreiben", d: "Fallbeispiel mit Arbeitsaufträgen nach PflAPrV", text: "Schreibe eine Lernsituation mit Arbeitsaufträgen zum Thema " },
    { k: "arbeitsblatt", ic: "file", c: "#30B0C7", t: "Arbeitsblatt erstellen", d: "Aufgaben mit Operatoren und Zeitangaben", text: "Erstelle ein Arbeitsblatt für eine Doppelstunde zum Thema " },
    { k: "ewh", ic: "exam", c: "#5856D6", t: "Erwartungshorizont", d: "Erwartete Punkte und Punkteverteilung", text: "Erstelle einen Erwartungshorizont mit Punkteverteilung für folgende Aufgabe: " },
    { k: "daz", ic: "globe", c: "#FF9500", t: "Text vereinfachen", d: "Für Lernende mit Deutsch als Zweitsprache", text: "Vereinfache diesen Text auf Sprachniveau B1 und erkläre die Fachbegriffe: " },
    { k: "frage", ic: "bulb", c: "#34C759", t: "Fachfrage klären", d: "Antwort mit Quellen aus Fallpfad", text: "" }
  ];

  /* Dokumente (Lernsituation, Arbeitsblatt, Erwartungshorizont …) als Word-Datei: HTML mit Word-Kopf, öffnet in Word, Pages und LibreOffice */
  function escH(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mdHtml(t) {
    var out = [], list = null;
    String(t || "").split("\n").forEach(function (l) {
      var x = escH(l).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
      if (/^\s*[-•]\s+/.test(l)) { if (!list) { list = []; } list.push("<li>" + x.replace(/^\s*[-•]\s+/, "") + "</li>"); return; }
      if (list) { out.push("<ul>" + list.join("") + "</ul>"); list = null; }
      if (x.trim()) out.push("<p>" + x + "</p>");
    });
    if (list) out.push("<ul>" + list.join("") + "</ul>");
    return out.join("");
  }
  function wordDatei(titel, html) {
    var doc = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>" + escH(titel) + "</title>" +
      "<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.4}h1{font-size:18pt}h2{font-size:13pt;margin-top:16pt}p,li{margin:0 0 6pt}.k{color:#555;font-size:9pt}</style></head><body>" + html + "<p class='k'>Erstellt mit dem Fallpfad-Assistenten (KI). Bitte vor dem Einsatz fachlich prüfen.</p></body></html>";
    var blob = new Blob(["\ufeff", doc], { type: "application/msword" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = String(titel || "Fallpfad").replace(/[^\wäöüÄÖÜß\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 60) + ".doc";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function dokText(d) { return d.titel + (d.zielgruppe ? "\n" + d.zielgruppe : "") + "\n\n" + d.abschnitte.map(function (a) { return (a.ueberschrift ? a.ueberschrift + "\n" : "") + a.text; }).join("\n\n"); }
  function dokHtml(d) { return "<h1>" + escH(d.titel) + "</h1>" + (d.zielgruppe ? "<p><i>" + escH(d.zielgruppe) + "</i></p>" : "") + d.abschnitte.map(function (a) { return (a.ueberschrift ? "<h2>" + escH(a.ueberschrift) + "</h2>" : "") + mdHtml(a.text); }).join(""); }
  function klausurHtml(k) {
    return "<h1>" + escH(k.titel) + "</h1><p>Bearbeitungszeit: " + k.minuten + " Minuten</p><ol>" + k.fragen.map(function (f) { return "<li><p>" + escH(f.frage) + "</p><ol type='A'>" + f.optionen.map(function (o) { return "<li>" + escH(o) + "</li>"; }).join("") + "</ol></li>"; }).join("") + "</ol>" +
      "<h2 style='page-break-before:always'>Lösung</h2><ol>" + k.fragen.map(function (f) { return "<li><b>" + "ABCDE"[f.richtig] + "</b> – " + escH(f.erklaerung) + "</li>"; }).join("") + "</ol>";
  }
  function DokKarte(p) {
    var d = p.dok, cp = uS(false);
    return h("div", { className: "astl-mod astl-dok" },
      h("div", { className: "ast-plan-h" }, h("span", { className: "ast-pi", style: { "--c": "#30B0C7" } }, h(Ic, { k: "file", s: 18 })), h("div", null, h("b", null, d.titel), d.zielgruppe ? h("small", null, d.zielgruppe) : null)),
      d.abschnitte.map(function (a, i) { return h("div", { key: i, className: "astl-dok-a" }, a.ueberschrift ? h("h4", null, a.ueberschrift) : null, h(Md, { text: a.text })); }),
      h("div", { className: "ast-row" },
        h("button", { type: "button", className: "btn sm", onClick: function () { wordDatei(d.titel, dokHtml(d)); } }, h(Ic, { k: "dl", s: 15 }), "Als Word-Datei"),
        h("button", { type: "button", className: "btn ghost sm", onClick: function () { try { navigator.clipboard.writeText(dokText(d)).then(function () { cp[1](true); setTimeout(function () { cp[1](false); }, 1600); }); } catch (e) {} } }, cp[0] ? "Kopiert" : "Text kopieren")),
      h("small", { style: { color: "var(--muted)" } }, "KI-Entwurf: vor dem Einsatz fachlich prüfen und an deine Lerngruppe anpassen."));
  }

  function AssistentLehrer() {
    var uk = ukey();
    var chat = uS(function () { return lsGet("fp-astl-chat-" + uk, []); }), msgs = chat[0];
    var src = uS(function () { return lsGet("fp-astl-src-" + uk, []); }), mitApp = uS(function () { return lsGet("fp-astl-app", true); });
    var cons = uS(function () { return lsGet("fp-astl-cons-" + uk, false); });
    var txt = uS(""), busy = uS(false), rest = uS(null), limit = uS(3), paste = uS(null), lesen = uS(null), ready = uS(false), jahr = uS(function () { return lsGet("fp-astl-jahr", 2); });
    var logRef = uR(null), taRef = uR(null), fileRef = uR(null);
    var demo = !window.FP_SB;
    uE(function () { loadContent().then(function () { ready[1](true); }); if (!demo) invoke({ status: true }).then(function (r) { if (r && r.rest === 0) rest[1](0); }, function () {}); }, []);
    uE(function () { lsSet("fp-astl-chat-" + uk, msgs.slice(-30)); var el = logRef.current; if (el) setTimeout(function () { el.scrollTop = el.scrollHeight; }, 30); }, [msgs.length, busy[0]]);
    function saveSrc(v) { src[1](v); if (!lsSet("fp-astl-src-" + uk, v)) { /* zu groß für den Speicher: nur für diese Sitzung */ } }
    function addFile(f) {
      if (!f) return;
      if (!cons[0]) { lesen[1]("Bitte bestätige zuerst, dass das Material keine personenbezogenen Daten enthält."); return; }
      if (!/\.(pdf|pptx)$/i.test(f.name)) { lesen[1]("Bitte eine PDF- oder PowerPoint-Datei (.pptx) wählen."); return; }
      lesen[1]("„" + f.name + "“ wird gelesen …");
      window.FP_IMPORT.lesen(f, function (t) { lesen[1](t); }).then(function (slides) {
        var text = slides.map(function (s) { return [s.titel, s.text, s.notiz].filter(Boolean).join("\n"); }).join("\n\n").replace(/[ \t]+/g, " ").trim();
        if (text.length < 80) throw new Error("In der Datei wurde kaum Text gefunden.");
        saveSrc(src[0].concat([{ titel: f.name.replace(/\.(pdf|pptx)$/i, ""), text: text.slice(0, 120000), art: /\.pdf$/i.test(f.name) ? "PDF" : "PowerPoint", n: slides.length }]));
        lesen[1](null);
      }, function (e) { lesen[1](e.message || "Die Datei konnte nicht gelesen werden."); });
    }
    function quellenFuer(q) {
      var own = ownDocs(src[0]), oi = C.makeIndex(own.slice()), app = mitApp[0] ? appIndex().search(q, 8) : [];
      return { app: app, own: own.length ? oi.search(q, 8, { proGruppe: 4 }) : [] };
    }
    function modulQuellen(m) {
      if (src[0].length) return src[0].map(function (q) { return { titel: q.titel, text: q.text }; });
      return appIndex().search((m.titel || "") + " " + (m.schwerpunkte || []).join(" "), 12).map(function (d) { return { titel: d.titel, text: d.text }; });
    }
    function send(text) {
      text = String(text || "").trim();
      if (!text || busy[0] || rest[0] === 0) return;
      var Q = quellenFuer(text), mine = msgs.concat([{ r: "du", t: text }]);
      chat[1](mine); txt[1](""); busy[1](true);
      var mods = (window.FP_DATA && window.FP_DATA.mods || []).map(function (m) { return { id: m.id, titel: C.modTitle(m), jahr: m.year, pct: 0, stationen: (m.chapters || []).length }; });
      var body = {
        nachricht: text, verlauf: msgs.slice(-6).map(function (m) { return { r: m.r, t: m.r === "ki" ? (m.a && m.a.text) || "" : m.t }; }),
        lang: "de", jahr: jahr[0], heute: C.isoDay(new Date()), module: mods,
        quellen: Q.app.map(function (d) { return { id: d.id, titel: d.titel, text: d.text.slice(0, 1700) }; }),
        eigene: Q.own.map(function (d) { return { id: d.id, titel: d.titel, text: d.text.slice(0, 2400) }; })
      };
      var pr = demo ? new Promise(function (ok) { setTimeout(function () {
        var modul = /modul/i.test(text) ? { titel: "Neues Lernmodul", jahr: 2, umfang: "mittel", schwerpunkte: Q.own.concat(Q.app).slice(0, 3).map(function (d) { return d.titel.replace(/^.*› /, ""); }), hinweis: "" } : null;
        ok({ antwort: { art: modul ? "modul" : "antwort", modul: modul, text: "**Demo ohne KI:** Im Demo-Modus ist der Assistent nicht mit dem Schulserver verbunden. Passende Stellen:" + Q.own.concat(Q.app).slice(0, 4).map(function (d) { return "\n- **" + d.titel + "**"; }).join(""), quellen: Q.own.concat(Q.app).slice(0, 4).map(function (d) { return d.id; }), vorschlaege: [] }, rest: 3 }); }, 800); }) : invoke(body);
      pr.then(function (r) { chat[1](mine.concat([{ r: "ki", a: r.antwort, own: Q.own }])); if (r.rest === 0) rest[1](0); },
        function (e) { chat[1](mine.concat([{ r: "ki", err: e.message }])); if (e.rest === 0) rest[1](0); }).then(function () { busy[1](false); });
    }
    function sug(s) { if (s.k === "modul") return send(s.text); txt[1](s.text); setTimeout(function () { if (taRef.current) { taRef.current.focus(); var n = s.text.length; taRef.current.setSelectionRange(n, n); } }, 30); }
    var restTxt = demo ? "Demo-Modus ohne KI" : rest[0] === 0 ? "Für heute ist Schluss, morgen geht es weiter" : "";

    var log = h("div", { className: "ast-log", ref: logRef, "aria-live": "polite" },
      !msgs.length ? h("div", { className: "ast-empty" },
        h("div", { className: "ast-orb" }, h(Ic, { k: "spark", s: 30 })),
        h("h2", null, "Wobei kann ich helfen?"),
        h("p", null, "Ich erstelle Module, Klausuren und Unterrichtsplanungen aus deinem Material und aus Fallpfad. Ich nutze kein Internet und zeige zu jeder Antwort die Quellen."),
        h("div", { className: "ast-sugs" }, SUGS.map(function (s) { return h("button", { key: s.k, type: "button", className: "ast-sug", style: { "--c": s.c }, onClick: function () { sug(s); } }, h("span", null, h(Ic, { k: s.ic, s: 18 })), h("span", null, h("b", null, s.t), h("small", null, s.d))); }))) : null,
      msgs.map(function (m, i) {
        if (m.r === "du") return h("div", { key: i, className: "ast-msg du" }, h("div", { className: "ast-bub" }, m.t));
        var a = m.a || {};
        var Q = function (pp) { return h(C.Quellen, Object.assign({ extra: m.own || [], label: "Quellen" }, pp)); };
        return h("div", { key: i, className: "ast-msg" }, h("span", { className: "ast-av" }, h(Ic, { k: "spark", s: 16 })),
          h("div", { className: "ast-ki" },
            m.err ? h("div", { className: "ast-err" }, m.err) : h(Md, { text: a.text }),
            a.modul ? h(ModulKarte, { modul: a.modul, quellen: function () { return modulQuellen(a.modul); } }) : null,
            a.plan ? h(C.Plan, { plan: a.plan, lang: "de", actions: [h("button", { key: "c", type: "button", className: "btn ghost sm", onClick: function () { try { navigator.clipboard.writeText(a.plan.titel + "\n" + a.plan.tage.map(function (t, j) { return "\n" + (t.datum || "Einheit " + (j + 1)) + ": " + t.titel + "\n" + t.schritte.map(function (s) { return "- " + s.was + (s.minuten ? " (" + s.minuten + " Min.)" : ""); }).join("\n"); }).join("\n")); } catch (e) {} } }, "Kopieren")] }) : null,
            a.klausur ? h(C.Klausur, { klausur: a.klausur, id: "kl" + i, quellen: Q, actions: [h("button", { key: "w", type: "button", className: "btn sm", onClick: function () { wordDatei(a.klausur.titel, klausurHtml(a.klausur)); } }, "Als Word-Datei"), h("button", { key: "c", type: "button", className: "btn ghost sm", onClick: function () { try { navigator.clipboard.writeText(klausurText(a.klausur)); } catch (e) {} } }, "Mit Lösung kopieren")] }) : null,
            a.dokument ? h(DokKarte, { dok: a.dokument }) : null,
            a.quellen && a.quellen.length ? h(Q, { ids: a.quellen }) : null,
            a.vorschlaege && a.vorschlaege.length && i === msgs.length - 1 && !busy[0] ? h("div", { className: "ast-next" }, a.vorschlaege.map(function (v, j) { return h("button", { key: j, type: "button", onClick: function () { send(v); } }, v); })) : null));
      }),
      busy[0] ? h("div", { className: "ast-msg" }, h("span", { className: "ast-av" }, h(Ic, { k: "spark", s: 16 })), h("div", { className: "ast-typing" }, h("i"), h("i"), h("i"))) : null);

    var comp = h("div", { className: "ast-comp" },
      h("form", { className: "ast-form", onSubmit: function (e) { e.preventDefault(); send(txt[0]); } },
        h("textarea", { ref: taRef, rows: 1, value: txt[0], maxLength: 2000, "aria-label": "Nachricht an den Assistenten", placeholder: "Frag mich oder gib mir einen Auftrag …", disabled: rest[0] === 0,
          onChange: function (e) { txt[1](e.target.value); var t = e.target; t.style.height = "auto"; t.style.height = Math.min(160, t.scrollHeight) + "px"; },
          onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(txt[0]); } } }),
        h("button", { type: "submit", className: "ast-send", "aria-label": "Senden", disabled: !txt[0].trim() || busy[0] || rest[0] === 0 }, h(Ic, { k: "send", s: 18, w: 2.4 }))),
      h("div", { className: "ast-meta" }, h("span", { className: "astl-jahr" }, "Niveau", h("span", { className: "seg3", role: "group", "aria-label": "Ausbildungsjahr" }, [1, 2, 3].map(function (j) { return h("button", { key: j, type: "button", "aria-pressed": jahr[0] === j, onClick: function () { jahr[1](j); lsSet("fp-astl-jahr", j); } }, j + ". Jahr"); }))), h("span", null, restTxt || "Nur Fallpfad und deine Quellen")));

    var side = h("aside", { className: "ast-side" },
      h("section", { className: "ast-card" }, h("h3", null, "Meine Quellen"),
        h("div", { className: "astl-src" },
          src[0].length ? src[0].map(function (q, i) { return h("div", { key: i, className: "astl-q" }, h("span", null, h(Ic, { k: "file", s: 15 })), h("div", null, h("b", { title: q.titel }, q.titel), h("small", null, (q.art || "Text") + " · " + (q.text.length < 1000 ? q.text.length + " Zeichen" : Math.round(q.text.length / 1000) + " Tsd. Zeichen"))), h("button", { type: "button", className: "ast-ib", "aria-label": "Quelle entfernen", onClick: function () { saveSrc(src[0].filter(function (_, j) { return j !== i; })); } }, h(Ic, { k: "x", s: 15 }))); })
            : h("small", { style: { color: "var(--muted)" } }, "Noch keine eigenen Quellen. Füge Unterrichtsmaterial hinzu, damit der Assistent damit arbeitet."),
          h("label", { className: "astl-cons" }, h("input", { type: "checkbox", checked: cons[0], onChange: function (e) { cons[1](e.target.checked); lsSet("fp-astl-cons-" + uk, e.target.checked); } }), h("span", null, "Mein Material enthält keine personenbezogenen Daten (keine echten Namen von Lernenden, Patientinnen oder Patienten).")),
          h("div", { className: "astl-add" },
            h("button", { type: "button", className: "btn ghost sm", disabled: !cons[0] || !window.FP_IMPORT, onClick: function () { fileRef.current && fileRef.current.click(); } }, h(Ic, { k: "file", s: 15 }), "PDF oder PowerPoint"),
            h("button", { type: "button", className: "btn ghost sm", disabled: !cons[0], onClick: function () { paste[1]({ titel: "", text: "" }); } }, "Text einfügen"),
            h("input", { ref: fileRef, type: "file", hidden: true, accept: ".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation", onChange: function (e) { addFile(e.target.files[0]); e.target.value = ""; } })),
          lesen[0] ? h("small", { style: { color: "var(--muted)" } }, lesen[0]) : null,
          paste[0] ? h("div", { className: "astl-paste" },
            h("input", { placeholder: "Titel, z. B. Skript Herzinsuffizienz", value: paste[0].titel, onChange: function (e) { paste[1](Object.assign({}, paste[0], { titel: e.target.value })); } }),
            h("textarea", { placeholder: "Text hier einfügen …", value: paste[0].text, onChange: function (e) { paste[1](Object.assign({}, paste[0], { text: e.target.value })); } }),
            h("div", { className: "ast-row" }, h("button", { type: "button", className: "btn sm", disabled: paste[0].text.trim().length < 40, onClick: function () { saveSrc(src[0].concat([{ titel: paste[0].titel.trim() || "Eingefügter Text", text: paste[0].text.trim().slice(0, 120000), art: "Text" }])); paste[1](null); } }, "Hinzufügen"), h("button", { type: "button", className: "btn ghost sm", onClick: function () { paste[1](null); } }, "Abbrechen"))) : null,
          h("label", { className: "astl-tg" }, h("span", null, "Fallpfad-Module einbeziehen"), h("input", { type: "checkbox", checked: mitApp[0], onChange: function (e) { mitApp[1](e.target.checked); lsSet("fp-astl-app", e.target.checked); } })))),
      h("section", { className: "ast-card" }, h("h3", null, "So arbeitet der Assistent"),
        h("ul", { className: "ast-how" },
          h("li", null, h("span", { style: { "--c": "#34C759" } }, h(Ic, { k: "shield", s: 15 })), h("div", null, h("b", null, "Keine erfundenen Inhalte"), h("small", null, "Antwortet nur aus Fallpfad und deinen Quellen und sagt, wenn etwas fehlt."))),
          h("li", null, h("span", { style: { "--c": "#0A84FF" } }, h(Ic, { k: "book", s: 15 })), h("div", null, h("b", null, "Quellen zu jeder Antwort"), h("small", null, "Klausurfragen tragen ihre Quelle, nichts ohne Beleg."))),
          h("li", null, h("span", { style: { "--c": "#5856D6" } }, h(Ic, { k: "file", s: 15 })), h("div", null, h("b", null, "Material zum Mitnehmen"), h("small", null, "Lernsituationen, Arbeitsblätter und Klausuren als Word-Datei."))))),
      msgs.length ? h("button", { type: "button", className: "btn ghost sm", style: { alignSelf: "flex-start" }, onClick: function () { chat[1]([]); } }, h(Ic, { k: "trash", s: 15 }), "Chat leeren") : null);

    return h("div", { className: "wrap wide ast-wrap" },
      h("div", { className: "hello" }, h("div", { className: "eyebrow" }, "KI-Assistent"), h("h1", { style: { marginTop: 8 } }, "Assistent"), h("p", null, "Module, Klausuren und Unterricht planen, mit deinem Material und den Inhalten von Fallpfad.")),
      h("div", { className: "ast-grid" }, h("section", { className: "ast-chat", "aria-label": "Chat mit dem Assistenten" }, log, comp), side));
  }
  window.FP_AssistentLehrer = AssistentLehrer;
})();

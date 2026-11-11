/* Lehrer-Portal: Stundenplan mit KI übernehmen (für den Schüler-Stundenplan eines Kurses und den eigenen Lehrer-Stundenplan).
   Die Lehrkraft lädt den Stundenplan in beliebiger Form hoch: PDF, Word (.docx), Excel (.xlsx/.xls), CSV, Text oder ein Foto/Scan,
   oder fügt ihn als Text ein. Der Browser liest die Datei aus (Bilder werden verkleinert), die Edge Function
   „stundenplan-import“ erkennt die einzelnen Stunden. Danach erscheint eine bearbeitbare Vorschau. Gespeichert wird erst,
   wenn die Lehrkraft auf „Übernehmen“ tippt. Ohne KI bleibt das Einfügen aus einer Tabelle möglich. */
(function () {
  "use strict";
  var R = window.React;
  if (!R) return;
  var h = R.createElement, useState = R.useState, useRef = R.useRef;
  var LIB = { zip: "vendor/jszip.min.js", pdf: "vendor/pdf.min.js", pdfw: "vendor/pdf.worker.min.js", xlsx: "vendor/xlsx.full.min.js" };
  var TAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  var STATUS = [["normal", "Normal"], ["ausfall", "Ausfall"], ["raum", "Raumänderung"], ["vertretung", "Vertretung"]];

  function load(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"][data-ok]')) return res();
      var s = document.createElement("script"); s.src = src;
      s.onload = function () { s.setAttribute("data-ok", "1"); res(); };
      s.onerror = function () { rej(new Error("Eine Bibliothek zum Lesen der Datei konnte nicht geladen werden.")); };
      document.head.appendChild(s);
    });
  }
  function iso(d) { var x = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return x.toISOString().slice(0, 10); }
  function plusTage(s, n) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
  function tagName(s) { var d = new Date(s + "T12:00:00"); return TAGE[(d.getDay() + 6) % 7]; }
  function dm(s) { var p = String(s).split("-"); return p[2] + "." + p[1] + "."; }
  function kw(s) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); var w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7); }

  /* ---------- Dateien auslesen ---------- */
  async function pdfLesen(file) {
    await load(LIB.pdf);
    var L = window.pdfjsLib;
    if (!L) throw new Error("PDF kann hier nicht gelesen werden.");
    try { L.GlobalWorkerOptions.workerSrc = LIB.pdfw; } catch (e) {}
    var doc = await L.getDocument({ data: await file.arrayBuffer() }).promise, zeilen = [], bild = "";
    for (var p = 1; p <= Math.min(doc.numPages, 12); p++) {
      var page = await doc.getPage(p), tc = await page.getTextContent(), map = {};
      tc.items.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var y = Math.round(it.transform[5] / 4) * 4, x = it.transform[4];
        (map[y] = map[y] || []).push([x, it.str.trim()]);
      });
      Object.keys(map).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) {
        var cells = map[y].sort(function (a, b) { return a[0] - b[0]; }), out = [], last = -1e9;
        cells.forEach(function (c) { if (out.length && c[0] - last < 14) out[out.length - 1] += " " + c[1]; else out.push(c[1]); last = c[0] + c[1].length * 4.5; });
        zeilen.push(out.join(" | "));
      });
      zeilen.push("");
      if (p === 1 && tc.items.map(function (it) { return it.str || ""; }).join("").replace(/\s/g, "").length < 40) bild = await pdfSeiteBild(page);
    }
    return { text: zeilen.join("\n"), bild: bild };
  }
  async function pdfSeiteBild(page) {
    try {
      var vp = page.getViewport({ scale: 2 }), c = document.createElement("canvas");
      var f = Math.min(1, 2000 / Math.max(vp.width, vp.height)); vp = page.getViewport({ scale: 2 * f });
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      return c.toDataURL("image/jpeg", 0.85);
    } catch (e) { return ""; }
  }
  async function docxLesen(file) {
    await load(LIB.zip);
    var zip = await window.JSZip.loadAsync(file), f = zip.file("word/document.xml");
    if (!f) throw new Error("Die Word-Datei konnte nicht gelesen werden.");
    var x = await f.async("string");
    x = x.replace(/<w:tab\/>/g, " ").replace(/<\/w:tc>/g, " | ").replace(/<\/w:tr>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<w:br\/>/g, " ").replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    return { text: x.replace(/\n\s*\n+/g, "\n").replace(/ \| \n/g, "\n"), bild: "" };
  }
  async function tabelleLesen(file) {
    await load(LIB.xlsx);
    var X = window.XLSX, wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true }), out = [];
    wb.SheetNames.slice(0, 6).forEach(function (n) {
      var csv = X.utils.sheet_to_csv(wb.Sheets[n], { FS: " | ", blankrows: false, dateNF: "dd.mm.yyyy" });
      if (csv.replace(/[|\s]/g, "")) out.push("Tabellenblatt " + n + ":\n" + csv);
    });
    return { text: out.join("\n\n"), bild: "" };
  }
  function bildLesen(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var f = Math.min(1, 2000 / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res({ text: "", bild: c.toDataURL("image/jpeg", 0.85) });
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("Das Bild konnte nicht gelesen werden. Bitte als JPG oder PNG hochladen.")); };
      img.src = url;
    });
  }
  async function dateiLesen(file) {
    var n = file.name.toLowerCase();
    if (file.size > 25e6) throw new Error("Die Datei ist zu groß (höchstens 25 MB).");
    if (/\.pdf$/.test(n)) return pdfLesen(file);
    if (/\.docx$/.test(n)) return docxLesen(file);
    if (/\.(xlsx|xlsm|xls|ods|csv)$/.test(n)) return tabelleLesen(file);
    if (/\.(png|jpe?g|webp|heic)$/.test(n) || /^image\//.test(file.type)) return bildLesen(file);
    if (/\.(txt|tsv)$/.test(n) || /^text\//.test(file.type)) return { text: await file.text(), bild: "" };
    if (/\.doc$/.test(n)) throw new Error("Alte Word-Dateien (.doc) bitte als .docx oder PDF speichern.");
    throw new Error("Dieses Dateiformat wird nicht unterstützt. Möglich sind PDF, Word (.docx), Excel, CSV, Text und Bilder.");
  }

  async function kiErkennen(body) {
    if (!window.FP_SB) throw new Error("Die KI-Erkennung funktioniert nur mit einem Schulkonto, nicht im Demo-Modus.");
    var c = await window.FP_SB();
    if (!c) throw new Error("Die KI-Erkennung funktioniert nur mit einem Schulkonto.");
    var r = await c.functions.invoke("stundenplan-import", { body: body, region: "eu-central-1" });
    if (r.error) {
      var m = r.error.message || String(r.error);
      try { if (r.error.context && r.error.context.json) { var j = await r.error.context.json(); if (j && j.error) m = j.error; } } catch (e) {}
      if (/Failed to send|non-2xx|404/.test(m)) m = "Die KI-Erkennung ist noch nicht eingerichtet (Funktion „stundenplan-import“ bereitstellen).";
      throw new Error(m);
    }
    if (!r.data || r.data.error) throw new Error((r.data && r.data.error) || "Keine Antwort vom KI-Dienst.");
    return r.data;
  }


  /* ---------- Ohne KI: Excel-Vorlage ---------- */
  var SPALTEN = {
    kurs: [["Datum oder Tag", "12.11.2026 oder Mo", "datum"], ["Beginn", "08:00", "beginn"], ["Ende", "09:30", "ende"], ["Thema", "Pflegeprozess", "titel"], ["Raum", "2.14", "raum"], ["Lehrkraft", "Frau Demir", "lehrkraft"], ["Status", "normal, Ausfall, Raum oder Vertretung (optional)", "status"], ["Notiz", "optional", "notiz"]],
    lehrer: [["Datum oder Tag", "12.11.2026 oder Mo", "datum"], ["Beginn", "08:00", "beginn"], ["Ende", "09:30", "ende"], ["Thema", "Pflegeprozess", "titel"], ["Kurs", "Kurs 24A", "kurs"], ["Raum", "2.14", "raum"], ["Notiz", "optional", "notiz"]]
  };
  var KOPF = { datum: /^(datum|tag|wochentag|day)/, beginn: /^(beginn|von|start|anfang)/, ende: /^(ende|bis)/, titel: /^(thema|fach|titel|inhalt|unterricht|lernfeld)/, raum: /^(raum|ort)/, lehrkraft: /^(lehrkraft|lehrer|dozent|lehrende)/, kurs: /^(kurs|klasse|gruppe)/, status: /^status/, notiz: /^(notiz|bemerkung|hinweis|info)/ };
  async function vorlage(art, woche) {
    await load(LIB.xlsx);
    var X = window.XLSX, sp = SPALTEN[art];
    var bsp = art === "kurs"
      ? [["Mo", "08:00", "09:30", "Pflegeprozess", "2.14", "Frau Demir", "", ""], ["Mo", "09:45", "11:15", "Anatomie", "2.14", "Dr. Weber", "", ""], [dm(plusTage(woche, 3)) + woche.slice(0, 4), "08:00", "11:15", "Simulationstraining", "SIM-Zentrum", "Team SIM", "Raum", "statt 2.14"]]
      : [["Mo", "08:00", "09:30", "Pflegeprozess", "Kurs 24A", "2.14", ""], ["Mi", "10:00", "11:30", "Herzinsuffizienz", "Kurs 25B", "Skills Lab", "Beamer reservieren"]];
    var ws = X.utils.aoa_to_sheet([sp.map(function (c) { return c[0]; })].concat(bsp));
    ws["!cols"] = sp.map(function (c, i) { return { wch: i === 3 ? 28 : i === 0 ? 16 : 13 }; });
    var hilfe = X.utils.aoa_to_sheet([["So füllst du die Vorlage aus"], [""]].concat(sp.map(function (c) { return [c[0], c[1]]; })).concat([[""], ["Jede Zeile ist eine Unterrichtsstunde. Die erste Zeile (Überschriften) nicht löschen."], ["Wochentage (Mo bis Sa) gelten für die Woche, die im Portal geöffnet ist. Mit Datum (TT.MM.JJJJ) geht auch ein ganzer Block."], ["Uhrzeiten als 08:00 oder 8:00. Die Beispielzeilen einfach überschreiben oder löschen."]]));
    hilfe["!cols"] = [{ wch: 18 }, { wch: 60 }];
    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, "Stundenplan");
    X.utils.book_append_sheet(wb, hilfe, "Anleitung");
    X.writeFile(wb, art === "kurs" ? "Fallpfad-Stundenplan-Kurs.xlsx" : "Fallpfad-Stundenplan-Lehrkraft.xlsx");
  }
  function zellText(v) { return v == null ? "" : v instanceof Date ? v : String(v).trim(); }
  function zeitAus(v) {
    if (v instanceof Date) return String(v.getHours()).padStart(2, "0") + ":" + String(v.getMinutes()).padStart(2, "0");
    if (typeof v === "number" && v >= 0 && v < 1) { var m = Math.round(v * 1440); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
    var x = String(v || "").trim().replace(/\s*uhr$/i, "").replace(".", ":"), q = x.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (!q || Number(q[1]) > 23) return "";
    return String(q[1]).padStart(2, "0") + ":" + (q[2] || "00");
  }
  function datumAus(v, woche) {
    if (v instanceof Date) return iso(v);
    if (typeof v === "number" && v > 30000) { var d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
    var a = String(v || "").trim().toLowerCase();
    var m = a.match(/(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/);
    if (m) { var y = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : woche.slice(0, 4); return y + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0"); }
    var i2 = a.match(/^(\d{4})-(\d{2})-(\d{2})/); if (i2) return i2[0];
    var t = ["mo", "di", "mi", "do", "fr", "sa", "so"].indexOf(a.replace(/[^a-zäöü]/g, "").slice(0, 2));
    return t >= 0 ? plusTage(woche, t) : "";
  }
  function statusAus(v) { var a = String(v || "").toLowerCase(); return /ausfall|entf/.test(a) ? "ausfall" : /raum/.test(a) ? "raum" : /vertret/.test(a) ? "vertretung" : "normal"; }
  async function excelLesen(file, art, woche) {
    await load(LIB.xlsx);
    var X = window.XLSX, wb = X.read(await file.arrayBuffer(), { type: "array", cellDates: true });
    var ws = wb.Sheets[wb.SheetNames.filter(function (n) { return !/anleitung/i.test(n); })[0] || wb.SheetNames[0]];
    var zeilen = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
    var kopfIdx = -1, map = {};
    for (var i = 0; i < Math.min(zeilen.length, 10) && kopfIdx < 0; i++) {
      var m = {};
      zeilen[i].forEach(function (c, j) { var t = String(c || "").trim().toLowerCase(); Object.keys(KOPF).forEach(function (k) { if (m[k] == null && KOPF[k].test(t)) m[k] = j; }); });
      if (m.beginn != null && (m.titel != null || m.datum != null)) { kopfIdx = i; map = m; }
    }
    if (kopfIdx < 0) { kopfIdx = -1; SPALTEN[art].forEach(function (c, j) { map[c[2]] = j; }); }
    var out = [], fehler = [], nurTage = true;
    zeilen.slice(kopfIdx + 1).forEach(function (z, n) {
      if (!z.some(function (c) { return String(c).trim(); })) return;
      var g = function (k) { return map[k] == null ? "" : zellText(z[map[k]]); };
      var roh = g("datum"), datum = datumAus(roh, woche), b = zeitAus(g("beginn")), e = zeitAus(g("ende")), titel = String(g("titel") || "");
      if (/\d/.test(String(roh instanceof Date ? "1" : roh))) nurTage = false;
      if (!datum || !b || !e || e <= b || !titel.trim()) { fehler.push(kopfIdx + n + 2); return; }
      out.push({ datum: datum, beginn: b, ende: e, titel: titel.slice(0, 140), raum: String(g("raum")).slice(0, 60), lehrkraft: String(g("lehrkraft")).slice(0, 80), kurs: String(g("kurs")).slice(0, 80), notiz: String(g("notiz")).slice(0, 400), status: statusAus(g("status")) });
    });
    return { stunden: out, fehler: fehler, woechentlich: out.length > 0 && nurTage };
  }

  var CSS = ".spk-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:22px 16px;border:1.5px dashed var(--line);border-radius:16px;background:var(--surface2,rgba(120,120,128,.06));cursor:pointer}" +
    ".spk-drop.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 7%,transparent)}.spk-drop b{font-size:15px}.spk-drop small{color:var(--muted)}" +
    ".spk-file{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:14px}.spk-file b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".spk-or{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;margin:12px 0 8px}.spk-or:before,.spk-or:after{content:'';flex:1;height:1px;background:var(--line)}" +
    ".spk-tab{width:100%;border-collapse:collapse;font-size:13.5px}.spk-tab th{text-align:left;font-size:12px;color:var(--muted);font-weight:600;padding:6px 4px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--surface)}" +
    ".spk-tab td{padding:4px;border-bottom:1px solid var(--line);vertical-align:middle}.spk-tab input,.spk-tab select{font:inherit;font-size:13.5px;width:100%;min-width:0;padding:6px 7px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--fg)}" +
    ".spk-tab tr.off td{opacity:.45}.spk-wrap{max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:12px;margin-top:10px}" +
    ".spk-hint{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:var(--warn-soft,#fff7e6);font-size:13.5px}.spk-hint ul{margin:4px 0 0;padding-left:18px}" +
    ".spk-load{display:flex;align-items:center;gap:10px;padding:18px 4px;color:var(--muted)}.spk-load i{width:18px;height:18px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--accent);animation:spkrot .8s linear infinite}@keyframes spkrot{to{transform:rotate(360deg)}}" +
    "@media (max-width:720px){.spk-tab .spk-opt{display:none}}";
  function useCss() { R.useEffect(function () { if (document.getElementById("spk-css")) return; var s = document.createElement("style"); s.id = "spk-css"; s.textContent = CSS; document.head.appendChild(s); }, []); }

  /* props: art ("kurs"|"lehrer"), week (Date, Montag), courses ([{id,name}]), courseName, Modal, close, onClassic, save(rows) -> Promise, saved(msg) */
  function StundenplanKI(p) {
    useCss();
    var Modal = p.Modal, lehrer = p.art === "lehrer";
    var woche = iso(p.week instanceof Date ? p.week : new Date(p.week));
    var fs = useState(null), datei = fs[0], setDatei = fs[1];
    var ts = useState(""), text = ts[0], setText = ts[1];
    var ss = useState("eingabe"), schritt = ss[0], setSchritt = ss[1];
    var es = useState(null), err = es[0], setErr = es[1];
    var rs = useState([]), rows = rs[0], setRows = rs[1];
    var hs = useState([]), hinweise = hs[0], setHinweise = hs[1];
    var ws = useState(false), woechentlich = ws[0], setWoe = ws[1];
    var ns = useState(0), wdh = ns[0], setWdh = ns[1];
    var ds = useState(false), drag = ds[0], setDrag = ds[1];
    var ms = useState("ki"), modus = ms[0], setModus = ms[1];
    var inp = useRef(null), inpX = useRef(null);

    var waehle = function (f) { if (!f) return; setErr(null); setDatei(f); };
    var erkennen = async function () {
      setErr(null); setSchritt("laden");
      try {
        var t = text.trim(), bild = "";
        if (datei) { var x = await dateiLesen(datei); t = [x.text, t].filter(Boolean).join("\n\n"); bild = x.bild; }
        if (!t && !bild) throw new Error("Bitte eine Datei auswählen oder den Stundenplan einfügen.");
        var r = await kiErkennen({ art: p.art, text: t.slice(0, 60000), bild: bild, woche: woche, heute: iso(new Date()), kurse: (p.courses || []).map(function (c) { return c.name; }) });
        var list = (r.stunden || []).map(function (s, i) { return Object.assign({ k: i, an: true }, s); });
        if (!list.length) throw new Error("Im Material wurden keine Stunden erkannt. " + ((r.hinweise || [])[0] || "Versuche eine andere Datei oder füge den Text ein."));
        setRows(list); setHinweise(r.hinweise || []); setWoe(!!r.woechentlich); setWdh(0); setSchritt("vorschau");
      } catch (e) { setErr(e.message || String(e)); setSchritt("eingabe"); }
    };
    var excel = async function (f) {
      if (!f) return;
      setErr(null); setSchritt("laden");
      try {
        var r = await excelLesen(f, p.art, woche);
        if (!r.stunden.length) throw new Error("In der Tabelle wurden keine Stunden gefunden. Bitte die Vorlage verwenden: Datum oder Tag, Beginn, Ende und Thema müssen ausgefüllt sein.");
        setRows(r.stunden.map(function (x, i) { return Object.assign({ k: i, an: true }, x); }));
        setHinweise(r.fehler.length ? ["Zeile " + r.fehler.slice(0, 8).join(", ") + (r.fehler.length > 8 ? " …" : "") + " übersprungen: Datum/Tag, Beginn, Ende oder Thema fehlt."] : []);
        setWoe(r.woechentlich); setWdh(0); setSchritt("vorschau");
      } catch (e) { setErr(e.message || String(e)); setSchritt("eingabe"); }
    };
    var setRow = function (k, patch) { setRows(rows.map(function (r) { return r.k === k ? Object.assign({}, r, patch) : r; })); };
    var gueltig = function (r) { return /^\d{4}-\d{2}-\d{2}$/.test(r.datum) && /^\d{2}:\d{2}$/.test(r.beginn) && /^\d{2}:\d{2}$/.test(r.ende) && r.ende > r.beginn && r.titel.trim(); };
    var aktiv = rows.filter(function (r) { return r.an && gueltig(r); });
    var kursId = function (name) {
      var n = String(name || "").trim().toLowerCase(); if (!n) return null;
      var c = (p.courses || []).filter(function (x) { return x.name.toLowerCase() === n; })[0] || (p.courses || []).filter(function (x) { var m = x.name.toLowerCase(); return m.indexOf(n) >= 0 || n.indexOf(m) >= 0; })[0];
      return c ? c.id : null;
    };
    var uebernehmen = async function () {
      setErr(null); setSchritt("speichern");
      try {
        var out = [];
        for (var w = 0; w <= (woechentlich ? wdh : 0); w++) aktiv.forEach(function (r) {
          var day = plusTage(r.datum, 7 * w);
          if (lehrer) { var cid = kursId(r.kurs); out.push({ day: day, t_start: r.beginn, t_end: r.ende, course_id: cid, kurs_text: cid ? null : (r.kurs || null), topic: r.titel.slice(0, 140), room: r.raum || null, note: r.notiz || null, plan: {} }); }
          else out.push({ day: day, t_start: r.beginn, t_end: r.ende, title: r.titel.slice(0, 120), room: r.raum || null, teacher: r.lehrkraft || null, note: r.notiz ? r.notiz.slice(0, 500) : null, status: r.status || "normal", old_room: null });
        });
        await p.save(out);
        p.saved(out.length + (out.length === 1 ? " Stunde" : " Stunden") + " übernommen.");
      } catch (e) { setErr((e && e.message) || "Speichern ist gerade nicht möglich."); setSchritt("vorschau"); }
    };

    var titel = (lehrer ? "Lehrer-Stundenplan hochladen" : "Stundenplan hochladen") + (p.courseName ? " · " + p.courseName : "");
    var body;
    if (schritt === "laden" || schritt === "speichern") {
      body = h("div", { className: "spk-load", role: "status" }, h("i"), schritt === "laden" ? (modus === "excel" ? "Die Tabelle wird gelesen …" : "Die KI liest den Stundenplan. Das dauert meist 10 bis 40 Sekunden …") : "Wird gespeichert …");
    } else if (schritt === "vorschau") {
      var tage = {}; aktiv.forEach(function (r) { tage[r.datum] = 1; });
      body = h("div", null,
        h("p", { className: "muted", style: { marginTop: 0 } }, rows.length + " Stunden erkannt" + (Object.keys(tage).length ? " an " + Object.keys(tage).length + (Object.keys(tage).length === 1 ? " Tag" : " Tagen") : "") + ". Bitte kurz prüfen, bei Bedarf korrigieren und nicht Gewünschtes abwählen."),
        hinweise.length > 0 && h("div", { className: "spk-hint" }, h("b", null, modus === "excel" ? "Hinweise" : "Hinweise der KI"), h("ul", null, hinweise.map(function (x, i) { return h("li", { key: i }, x); }))),
        h("div", { className: "spk-wrap" }, h("table", { className: "spk-tab" },
          h("thead", null, h("tr", null, h("th", { style: { width: 28 } }, ""), h("th", { style: { width: 132 } }, "Datum"), h("th", { style: { width: 84 } }, "Beginn"), h("th", { style: { width: 84 } }, "Ende"), h("th", null, lehrer ? "Thema" : "Thema / Fach"), h("th", { style: { width: 120 } }, lehrer ? "Kurs" : "Lehrkraft"), h("th", { className: "spk-opt", style: { width: 96 } }, "Raum"), !lehrer && h("th", { className: "spk-opt", style: { width: 120 } }, "Status"))),
          h("tbody", null, rows.map(function (r) {
            var ok = gueltig(r);
            return h("tr", { key: r.k, className: r.an ? "" : "off" },
              h("td", null, h("input", { type: "checkbox", checked: r.an, "aria-label": "Stunde übernehmen", onChange: function (e) { setRow(r.k, { an: e.target.checked }); }, style: { width: 18, height: 18 } })),
              h("td", null, h("input", { type: "date", value: r.datum, "aria-label": "Datum", onChange: function (e) { setRow(r.k, { datum: e.target.value }); }, style: ok ? null : { borderColor: "var(--bad)" } })),
              h("td", null, h("input", { type: "time", value: r.beginn, "aria-label": "Beginn", onChange: function (e) { setRow(r.k, { beginn: e.target.value }); } })),
              h("td", null, h("input", { type: "time", value: r.ende, "aria-label": "Ende", onChange: function (e) { setRow(r.k, { ende: e.target.value }); } })),
              h("td", null, h("input", { value: r.titel, "aria-label": "Thema", onChange: function (e) { setRow(r.k, { titel: e.target.value }); } })),
              h("td", null, lehrer ? h("input", { value: r.kurs, list: "spk-kurse", "aria-label": "Kurs", onChange: function (e) { setRow(r.k, { kurs: e.target.value }); } }) : h("input", { value: r.lehrkraft, "aria-label": "Lehrkraft", onChange: function (e) { setRow(r.k, { lehrkraft: e.target.value }); } })),
              h("td", { className: "spk-opt" }, h("input", { value: r.raum, "aria-label": "Raum", onChange: function (e) { setRow(r.k, { raum: e.target.value }); } })),
              !lehrer && h("td", { className: "spk-opt" }, h("select", { value: r.status, "aria-label": "Status", onChange: function (e) { setRow(r.k, { status: e.target.value }); } }, STATUS.map(function (s) { return h("option", { key: s[0], value: s[0] }, s[1]); }))));
          }))),
          lehrer && h("datalist", { id: "spk-kurse" }, (p.courses || []).map(function (c) { return h("option", { key: c.id, value: c.name }); }))),
        woechentlich && h("div", { className: "field", style: { marginTop: 12 } },
          h("label", { htmlFor: "spk-w" }, "Der Plan gilt jede Woche. Zusätzlich übertragen auf die folgenden Wochen:"),
          h("select", { id: "spk-w", className: "input", value: wdh, onChange: function (e) { setWdh(Number(e.target.value)); }, style: { maxWidth: 260 } },
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20].map(function (n) { return h("option", { key: n, value: n }, n === 0 ? "nur KW " + kw(woche) : "KW " + kw(woche) + " und " + n + (n === 1 ? " weitere Woche" : " weitere Wochen")); }))),
        h("p", { className: "muted", style: { fontSize: 13 } }, "Vorhandene Stunden bleiben erhalten. Doppelte Einträge kannst du danach einzeln löschen."));
    } else if (modus === "excel") {
      var sp = SPALTEN[p.art];
      body = h("div", null,
        h("p", { className: "muted", style: { marginTop: 0 } }, "Ohne KI: Lade die Excel-Vorlage herunter, trage pro Zeile eine Unterrichtsstunde ein und lade sie wieder hoch. Die App liest die Tabelle automatisch."),
        h("div", { className: "spk-wrap", style: { maxHeight: "none" } }, h("table", { className: "spk-tab" },
          h("thead", null, h("tr", null, h("th", null, "Spalte in Excel"), h("th", null, "Was gehört hinein"))),
          h("tbody", null, sp.map(function (c, i) { return h("tr", { key: i }, h("td", null, h("b", null, String.fromCharCode(65 + i) + " · " + c[0])), h("td", null, c[1])); })))),
        h("p", { className: "muted", style: { fontSize: 13, margin: "8px 0 12px" } }, "Erste Zeile sind die Überschriften. Stehen statt Datum nur Wochentage (Mo bis Sa), gelten sie für KW " + kw(woche) + " (ab " + dm(woche) + ") und lassen sich danach auf weitere Wochen übertragen. Auch CSV-Dateien gehen."),
        h("div", { className: "row", style: { gap: 8, flexWrap: "wrap" } },
          h("button", { type: "button", className: "btn ghost", onClick: function () { vorlage(p.art, woche).catch(function (e) { setErr(e.message); }); } }, "1. Vorlage herunterladen (Excel)"),
          h("button", { type: "button", className: "btn", onClick: function () { if (inpX.current) inpX.current.click(); } }, "2. Ausgefüllte Tabelle hochladen"),
          h("input", { ref: inpX, type: "file", accept: ".xlsx,.xlsm,.xls,.ods,.csv", style: { display: "none" }, onChange: function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ""; excel(f); } })));
    } else {
      body = h("div", null,
        h("p", { className: "muted", style: { marginTop: 0 } }, "Lade deinen Stundenplan so hoch, wie du ihn hast: als PDF, Word- oder Excel-Datei, als Foto oder Screenshot. Er muss nicht ordentlich formatiert sein. Die KI erkennt Tage, Uhrzeiten, Themen, Räume und " + (lehrer ? "Kurse" : "Lehrkräfte") + ", du prüfst alles, bevor es gespeichert wird."),
        h("div", { className: "spk-drop" + (drag ? " on" : ""), role: "button", tabIndex: 0,
          onClick: function () { if (inp.current) inp.current.click(); },
          onKeyDown: function (e) { if ((e.key === "Enter" || e.key === " ") && inp.current) { e.preventDefault(); inp.current.click(); } },
          onDragOver: function (e) { e.preventDefault(); setDrag(true); }, onDragLeave: function () { setDrag(false); },
          onDrop: function (e) { e.preventDefault(); setDrag(false); waehle(e.dataTransfer.files && e.dataTransfer.files[0]); } },
          h("b", null, datei ? "Andere Datei wählen" : "Datei auswählen oder hierher ziehen"),
          h("small", null, "PDF, Word (.docx), Excel, CSV, Text, Foto (JPG, PNG)"),
          h("input", { ref: inp, type: "file", accept: ".pdf,.docx,.xlsx,.xlsm,.xls,.ods,.csv,.txt,.tsv,image/*", style: { display: "none" }, onChange: function (e) { waehle(e.target.files && e.target.files[0]); e.target.value = ""; } })),
        datei && h("div", { className: "spk-file" }, h("b", null, datei.name), h("button", { type: "button", className: "btn ghost sm", onClick: function () { setDatei(null); } }, "Entfernen")),
        h("div", { className: "spk-or" }, "oder einfügen"),
        h("textarea", { className: "input", rows: 5, value: text, onChange: function (e) { setText(e.target.value); }, placeholder: "Stundenplan als Text einfügen, z. B. aus einer E-Mail oder Webseite …" }),
        h("p", { className: "muted", style: { fontSize: 13 } }, "Stehen im Plan nur Wochentage ohne Datum, werden sie der KW " + kw(woche) + " (ab " + dm(woche) + ") zugeordnet. Bitte keine Namen von Lernenden hochladen."));
    }
    var tabs = schritt === "eingabe" && h("div", { className: "fchips", role: "tablist", style: { marginBottom: 12 } },
      [["ki", "Mit KI: beliebige Datei"], ["excel", "Ohne KI: Excel-Vorlage"]].map(function (t) {
        return h("button", { key: t[0], type: "button", role: "tab", "aria-selected": modus === t[0], className: "chip" + (modus === t[0] ? " blue" : ""), style: { border: 0, cursor: "pointer" }, onClick: function () { setErr(null); setModus(t[0]); } }, t[1]);
      }));
    return h(Modal, { title: titel, close: p.close, wide: true },
      tabs,
      body,
      err && h("div", { className: "notice bad", role: "alert", style: { marginTop: 10 } }, err),
      h("div", { className: "row", style: { marginTop: 14, flexWrap: "wrap" } },
        schritt === "eingabe" && modus === "ki" && h("button", { type: "button", className: "btn", disabled: !datei && !text.trim(), onClick: erkennen }, "Mit KI erkennen"),
        schritt === "vorschau" && h("button", { type: "button", className: "btn", disabled: !aktiv.length, onClick: uebernehmen }, aktiv.length * (woechentlich ? wdh + 1 : 1) + " Stunden übernehmen"),
        schritt === "vorschau" && h("button", { type: "button", className: "btn ghost", onClick: function () { setSchritt("eingabe"); setRows([]); } }, "Zurück"),
        h("button", { type: "button", className: "btn ghost", onClick: p.close }, "Abbrechen"),
        schritt === "eingabe" && modus === "excel" && p.onClassic && h("button", { type: "button", className: "skip", style: { marginLeft: "auto" }, onClick: p.onClassic }, "Zeilen lieber einfügen")));
  }
  window.FP_StundenplanKI = StundenplanKI;
})();

/* Folien-Import im Lehrer-Portal: PowerPoint (.pptx) oder PDF hochladen und daraus
   ein Lernmodul, einen Live-Fall oder eine Gruppenarbeit erstellen.
   Ablauf: Datei im Browser auslesen -> Gliederung -> Stationen (KI über Supabase Edge Function
   "folien-import", ohne KI ein Schnellentwurf aus den Folien) -> Vorschau -> im Editor öffnen. */
(function () {
  var R = window.React, RD = window.ReactDOM;
  if (!R || !RD) return;
  var h = R.createElement, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef;
  var LIB = {
    zip: "vendor/jszip.min.js",
    pdf: "vendor/pdf.min.js",
    pdfw: "vendor/pdf.worker.min.js"
  };
  var ZIEL = {
    modul: { t: "Lernmodul", d: "Interaktives Fallmodul mit Stationen, Szenen, Wissen, Quiz und Übungen", c: "#7C3AED" },
    live: { t: "Live-Fall", d: "Fall für den Unterricht am Beamer, die Klasse entscheidet per Handy", c: "#E11D48" },
    team: { t: "Gruppenarbeit", d: "Fall für das Team-Krankenhaus mit Material und Arbeitsaufträgen", c: "#9333EA" }
  };
  var LAENGE = { kurz: [3, "kurz", "3 Stationen, ca. 1 Unterrichtsstunde"], mittel: [5, "mittel", "5 Stationen, ca. 2 Unterrichtsstunden"], lang: [7, "lang", "7 Stationen, ca. 3 bis 4 Unterrichtsstunden"] };
  var CHARS = {
    alt_m: ["WB", "HK", "HS", "JW", "HE", "HL", "WO", "RO", "PH", "KF", "KA"],
    alt_w: ["MK", "EN", "GH", "IA", "HM", "BR", "MZ", "RL", "WE", "SE", "UF", "GL"],
    jung: ["DY", "LN", "TF", "ML", "NO"],
    team: ["AN", "PA", "DK", "LE", "TI"]
  };
  function load(src) {
    return new Promise(function (res, rej) {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      var s = document.createElement("script");
      s.src = src; s.onload = function () { res(); }; s.onerror = function () { rej(new Error("Eine Bibliothek zum Lesen der Datei konnte nicht geladen werden. Bitte Internetverbindung prüfen.")); };
      document.head.appendChild(s);
    });
  }
  var rid = function (p) { return (p || "x") + "_" + Math.random().toString(36).slice(2, 8); };
  var esc = function (t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var clean = function (t) { return String(t || "").replace(/\s+/g, " ").trim(); };

  /* ---------- Bilder verkleinern ---------- */
  function shrink(blob, max, q) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(blob), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, hh = img.naturalHeight, f = Math.min(1, (max || 1100) / Math.max(w, hh));
        if (w < 160 || hh < 120) { URL.revokeObjectURL(u); return res(null); }
        var c = document.createElement("canvas");
        c.width = Math.round(w * f); c.height = Math.round(hh * f);
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        res({ src: c.toDataURL("image/jpeg", q || 0.82), w: c.width, h: c.height });
      };
      img.onerror = function () { URL.revokeObjectURL(u); res(null); };
      img.src = u;
    });
  }

  /* ---------- PowerPoint lesen ---------- */
  async function readPptx(file, onStep) {
    await load(LIB.zip);
    var zip = await window.JSZip.loadAsync(file);
    var names = Object.keys(zip.files).filter(function (n) { return /^ppt\/slides\/slide\d+\.xml$/.test(n); })
      .sort(function (a, b) { return Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]); });
    var P = new DOMParser(), slides = [], imgCount = 0;
    for (var i = 0; i < names.length && i < 120; i++) {
      onStep && onStep("Folie " + (i + 1) + " von " + names.length + " wird gelesen …");
      var xml = P.parseFromString(await zip.file(names[i]).async("string"), "application/xml");
      var titel = "", zeilen = [];
      var shapes = xml.getElementsByTagName("p:sp");
      for (var s = 0; s < shapes.length; s++) {
        var ph = shapes[s].getElementsByTagName("p:ph")[0], typ = ph ? ph.getAttribute("type") || "" : "";
        var paras = shapes[s].getElementsByTagName("a:p"), txt = [];
        for (var p = 0; p < paras.length; p++) {
          var ts = paras[p].getElementsByTagName("a:t"), line = "";
          for (var t = 0; t < ts.length; t++) line += ts[t].textContent;
          line = clean(line);
          if (line) txt.push(line);
        }
        if (!txt.length) continue;
        if ((typ === "title" || typ === "ctrTitle") && !titel) titel = txt.join(" ");
        else if (typ !== "sldNum" && typ !== "dt" && typ !== "ftr") zeilen = zeilen.concat(txt);
      }
      // Tabellen
      var cells = xml.getElementsByTagName("a:tc");
      if (cells.length && !zeilen.length) for (var c = 0; c < cells.length; c++) { var ct = clean(cells[c].textContent); if (ct) zeilen.push(ct); }
      var num = names[i].match(/(\d+)\.xml/)[1], relN = "ppt/slides/_rels/slide" + num + ".xml.rels", notiz = "", bilder = [];
      if (zip.file(relN)) {
        var rel = P.parseFromString(await zip.file(relN).async("string"), "application/xml").getElementsByTagName("Relationship");
        for (var r = 0; r < rel.length; r++) {
          var type = rel[r].getAttribute("Type") || "", target = rel[r].getAttribute("Target") || "";
          var path = "ppt/" + target.replace(/^\.\.\//, "");
          if (/notesSlide$/.test(type) && zip.file(path)) {
            var nx = P.parseFromString(await zip.file(path).async("string"), "application/xml");
            var nsp = nx.getElementsByTagName("p:sp"), nt = [];
            for (var q = 0; q < nsp.length; q++) {
              var nph = nsp[q].getElementsByTagName("p:ph")[0], ntyp = nph ? nph.getAttribute("type") || "" : "";
              if (ntyp === "body" || !nph) { var np = nsp[q].getElementsByTagName("a:p"); for (var z = 0; z < np.length; z++) { var l = clean(np[z].textContent); if (l) nt.push(l); } }
            }
            notiz = nt.join("\n");
          } else if (/\/image$/.test(type) && /\.(png|jpe?g|gif|bmp|webp)$/i.test(path) && zip.file(path) && imgCount < 24) {
            var blob = await zip.file(path).async("blob");
            if (blob.size > 3000) {
              var im = await shrink(blob, 1100, 0.82);
              if (im) { bilder.push(im); imgCount++; }
            }
          }
        }
      }
      slides.push({ n: i + 1, titel: titel, text: zeilen.join("\n"), notiz: notiz, bilder: bilder });
    }
    return slides;
  }

  /* ---------- PDF lesen ---------- */
  async function readPdf(file, onStep) {
    await load(LIB.pdf);
    var L = window.pdfjsLib;
    L.GlobalWorkerOptions.workerSrc = LIB.pdfw;
    var doc = await L.getDocument({ data: await file.arrayBuffer() }).promise, slides = [];
    var n = Math.min(doc.numPages, 120);
    for (var i = 1; i <= n; i++) {
      onStep && onStep("Seite " + i + " von " + n + " wird gelesen …");
      var page = await doc.getPage(i), tc = await page.getTextContent(), lines = [], lastY = null, cur = "";
      tc.items.forEach(function (it) {
        var y = it.transform ? Math.round(it.transform[5]) : 0;
        if (lastY !== null && Math.abs(y - lastY) > 4) { if (clean(cur)) lines.push(clean(cur)); cur = ""; }
        cur += it.str + (it.hasEOL ? " " : "");
        lastY = y;
      });
      if (clean(cur)) lines.push(clean(cur));
      var bilder = [];
      if (i <= 40) {
        var vp = page.getViewport({ scale: 1 }), sc = Math.min(2, 1000 / vp.width), v2 = page.getViewport({ scale: sc });
        var cv = document.createElement("canvas"); cv.width = Math.round(v2.width); cv.height = Math.round(v2.height);
        await page.render({ canvasContext: cv.getContext("2d"), viewport: v2 }).promise;
        bilder.push({ src: cv.toDataURL("image/jpeg", 0.78), w: cv.width, h: cv.height, seite: true });
      }
      slides.push({ n: i, titel: lines[0] || "", text: lines.slice(1).join("\n"), notiz: "", bilder: bilder });
    }
    return slides;
  }

  /* ---------- KI-Aufruf über Supabase Edge Function ---------- */
  async function aiAvailable() {
    if (!window.FP_SB) return false;
    try { var c = await window.FP_SB(); return !!c; } catch (e) { return false; }
  }
  async function callAi(body) {
    var c = await window.FP_SB();
    var r = await c.functions.invoke("folien-import", { body: Object.assign({ bestaetigt: true }, body), region: "eu-central-1" });
    if (r.error) {
      var m = r.error.message || String(r.error);
      try { if (r.error.context && r.error.context.json) { var j = await r.error.context.json(); if (j && j.error) m = j.error; } } catch (e) {}
      throw new Error(m);
    }
    if (!r.data || r.data.error) throw new Error((r.data && r.data.error) || "Keine Antwort vom KI-Dienst.");
    if (r.data.meta) LASTMETA = r.data.meta;
    return r.data.result;
  }
  var LASTMETA = null;
  /* Datenminimierung im Browser: E-Mail, Telefon, Datumsangaben, Geburtsdaten entfernen */
  var SCRUB = [
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-Mail entfernt]"],
    [/(\+49|0049|\b0)[\s\/\-]?\d{2,5}[\s\/\-]?\d{3,}[\s\-]?\d{0,6}/g, "[Telefon entfernt]"],
    [/\b\d{1,2}\.\s?\d{1,2}\.\s?(19|20)\d{2}\b/g, "[Datum entfernt]"],
    [/\b(geb\.?|geboren am)\s*[^\n,;]{0,25}/gi, "[Geburtsdatum entfernt]"]
  ];
  function scrub(t) { var x = String(t || ""); SCRUB.forEach(function (r) { x = x.replace(r[0], r[1]); }); return x; }
  function scrubCount(slides) {
    var n = 0;
    slides.forEach(function (sl) { [sl.titel, sl.text, sl.notiz].forEach(function (t) { SCRUB.forEach(function (r) { var m = String(t || "").match(r[0]); if (m) n += m.length; }); }); });
    return n;
  }
  function slideText(slides) {
    return slides.map(function (s) {
      return { n: s.n, titel: scrub(s.titel).slice(0, 200), text: scrub(s.text).slice(0, 2500), notiz: scrub(s.notiz).slice(0, 1500) };
    });
  }

  /* ---------- Bereinigen: nur bekannte Bausteine und Felder ---------- */
  function html(x) {
    var s = String(x || "").replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\/\s*\1\s*>/gi, "").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "").replace(/javascript:/gi, "");
    if (!/<p|<ul|<ol|<table|<h\d/i.test(s)) s = "<p>" + s + "</p>";
    return s;
  }
  var str = function (x, n) { return String(x == null ? "" : x).slice(0, n || 2000); };
  function fixBlock(b, mid, ci, bi) {
    if (!b || typeof b !== "object") return null;
    var id = mid + "_c" + (ci + 1) + "b" + (bi + 1);
    switch (b.type) {
      case "scene": return { type: "scene", who: str(b.who, 4) || "AN", name: b.name ? str(b.name, 60) : undefined, mood: ["neutral", "happy", "worried", "sad", "pain", "angry"].indexOf(b.mood) >= 0 ? b.mood : "neutral", html: html(b.html) };
      case "knowledge": return { type: "knowledge", label: ["Lernblock", "Praxiswissen", "Vertiefung", "Ergänzung"].indexOf(b.label) >= 0 ? b.label : "Lernblock", title: str(b.title, 140), html: html(b.html) };
      case "merke": return { type: "merke", html: html(b.html) };
      case "challenge": return { type: "challenge", title: str(b.title, 140) || "Herausforderung", html: html(b.html) };
      case "case": return { type: "case", title: str(b.title, 140), rows: (b.rows || []).filter(Array.isArray).slice(0, 10).map(function (r) { return [str(r[0], 60), str(r[1], 300)]; }), html: b.html ? html(b.html) : "" };
      case "bild": return b.src ? { type: "bild", src: b.src, alt: str(b.alt, 200), caption: str(b.caption, 300), quelle: str(b.quelle, 200) } : null;
      case "quiz":
        var qs = (b.questions || []).map(function (q) {
          var o = (q.o || []).map(function (x) { return str(x, 400); }).filter(Boolean).slice(0, 5), a = Number(q.a);
          if (!q.q || o.length < 2 || !(a >= 0 && a < o.length)) return null;
          return { q: str(q.q, 400), o: o, a: a, e: str(q.e, 600) };
        }).filter(Boolean);
        return qs.length ? { type: "quiz", id: id, title: str(b.title, 140) || "Kurzquiz", questions: qs } : null;
      case "cards":
        var cs = (b.cards || []).filter(function (c) { return Array.isArray(c) && c[0] && c[1]; }).slice(0, 14).map(function (c) { return [str(c[0], 120), str(c[1], 400)]; });
        return cs.length >= 2 ? { type: "cards", title: str(b.title, 140) || "Lernkarten", cards: cs } : null;
      case "reflect": return b.question ? { type: "reflect", id: id, question: str(b.question, 600), hint: str(b.hint, 300), model: str(b.model, 1500) } : null;
      case "mythos":
        var it = (b.items || []).filter(function (x) { return x && x.t; }).slice(0, 8).map(function (x) { return { t: str(x.t, 300), ok: !!x.ok, e: str(x.e, 500) }; });
        return it.length >= 3 ? { type: "mythos", id: id, points: it.length, items: it } : null;
      case "bucket":
        var cats = (b.cats || []).map(function (x) { return str(x, 60); }).filter(Boolean).slice(0, 4);
        var bi2 = (b.items || []).filter(function (x) { return x && x.t && Number(x.c) >= 0 && Number(x.c) < cats.length; }).slice(0, 10).map(function (x) { return { t: str(x.t, 200), c: Number(x.c) }; });
        return cats.length >= 2 && bi2.length >= 3 ? { type: "bucket", id: id, points: Math.min(6, bi2.length), q: str(b.q, 300), cats: cats, items: bi2, fb: str(b.fb, 600) } : null;
      case "verlauf":
        var st = (b.steps || []).map(function (s) {
          var op = (s.opts || []).filter(function (o) { return o && o.t; }).slice(0, 4).map(function (o) { return { t: str(o.t, 300), ok: o.ok ? 1 : 0, c: str(o.c, 400) }; });
          return s.sit && op.length >= 2 && op.some(function (o) { return o.ok; }) ? { sit: str(s.sit, 600), opts: op } : null;
        }).filter(Boolean);
        return st.length ? { type: "verlauf", id: id, points: st.length, steps: st, end: str(b.end, 600) } : null;
      case "fehler":
        var ln = (b.lines || []).filter(function (l) { return l && l.t; }).slice(0, 10).map(function (l) { return l.e ? { t: str(l.t, 300), e: str(l.e, 400) } : { t: str(l.t, 300) }; });
        var nf = ln.filter(function (l) { return l.e; }).length;
        return ln.length >= 3 && nf ? { type: "fehler", id: id, points: nf, who: str(b.who, 120) || "Übergabe", lines: ln } : null;
      case "schaetz":
        var mn = Number(b.min), mx = Number(b.max), an = Number(b.ans);
        return isFinite(mn) && isFinite(mx) && isFinite(an) && mx > mn && b.q ? { type: "schaetz", id: id, points: 2, q: str(b.q, 300), min: mn, max: mx, step: Number(b.step) || 1, unit: str(b.unit, 20), ans: an, tol: Math.abs(Number(b.tol)) || 0, fb: str(b.fb, 500) } : null;
      case "praxis": return b.auftrag ? { type: "praxis", id: id, title: str(b.title, 140), auftrag: str(b.auftrag, 600), steps: (b.steps || []).map(function (x) { return str(x, 300); }).filter(Boolean).slice(0, 8), q: str(b.q, 400) } : null;
      case "doku":
        var di = (b.items || []).filter(function (x) { return x && x.l && x.r; }).slice(0, 8).map(function (x) { var r = String(x.r); try { new RegExp(r, "i"); } catch (e) { r = String(x.l).toLowerCase().replace(/[^a-zäöüß0-9]+/g, "|"); } return { l: str(x.l, 80), r: r }; });
        return b.prompt && di.length ? { type: "doku", id: id, time: str(b.time, 10) || "10:00", prompt: str(b.prompt, 500), items: di, model: str(b.model, 1500), points: di.length } : null;
      default: return null;
    }
  }
  function kiMeta() { return { ki_generiert: true, anbieter: LASTMETA ? LASTMETA.anbieter : "OpenAI", modell: LASTMETA ? LASTMETA.modell : "", region: LASTMETA ? LASTMETA.region : "USA", erstellt: new Date().toISOString(), werkzeug: "Fallpfad Folien-Import", hinweis: "KI-generierter Entwurf, von der Lehrkraft zu pr\u00fcfen" }; }
  function fixModule(m, opt) {
    var id = "cm_" + Math.random().toString(36).slice(2, 8);
    var chapters = (m.chapters || []).map(function (c, ci) {
      var blocks = (c.blocks || []).map(function (b, bi) { return fixBlock(b, id, ci, bi); }).filter(Boolean);
      if (!blocks.length) return null;
      return { id: id + "_s" + (ci + 1), title: str(c.title, 120) || "Station " + (ci + 1), time: str(c.time, 80), place: str(c.place, 120), goal: str(c.goal, 300), tags: (c.tags || []).slice(0, 4).map(function (t) { return str(t, 40); }), akte: c.akte && Array.isArray(c.akte.facts) ? { facts: c.akte.facts.filter(Array.isArray).slice(0, 6).map(function (r) { return [str(r[0], 60), str(r[1], 200)]; }) } : undefined, blocks: blocks };
    }).filter(Boolean);
    var p = m.patient || {};
    var ch = str(p.char, 4) || "IA";
    return {
      id: id, title: str(m.title, 140) || "Neues Modul", subtitle: str(m.subtitle, 200), navTitle: str(m.navTitle, 80) || "Stationen", eyebrow: "",
      year: Number(opt.jahr) || 1, order: 50, duration: str(m.duration, 60) || LAENGE[opt.laenge][2].split(", ")[1], passPercent: 60,
      cast: (m.cast || [ch, "AN"]).slice(0, 5).map(function (x) { return str(x, 4); }),
      patient: { name: str(p.name, 80), initials: str(p.name, 80).split(/\s+/).map(function (x) { return x[0] || ""; }).join("").slice(0, 2).toUpperCase(), char: ch, born: str(p.born, 40), diagnosis: str(p.diagnosis, 200) },
      akteBase: (m.akteBase || []).filter(Array.isArray).slice(0, 8).map(function (r) { return [str(r[0], 60), str(r[1], 300)]; }),
      intro: html(m.intro || "<p>Worum geht es in diesem Fall?</p>"), outcomes: (m.outcomes || []).map(function (x) { return str(x, 240); }).filter(Boolean).slice(0, 6),
      chapters: chapters, outro: html(m.outro || "<p>Geschafft.</p>"), sources: (m.sources || []).map(function (x) { return str(x, 400); }).slice(0, 10).concat(opt.ki ? ["Mit KI-Unterst\u00fctzung erstellt (" + (LASTMETA ? LASTMETA.anbieter + ", " + LASTMETA.modell : "KI") + ") aus Unterrichtsfolien der Lehrkraft und von der Lehrkraft fachlich gepr\u00fcft."] : []),
      area: "", difficulty: opt.jahr === "1" ? "Einsteiger" : opt.jahr === "3" ? "Pr\u00fcfungsniveau" : "Fortgeschritten",
      imported: { datei: opt.datei, at: new Date().toISOString(), ki: !!opt.ki },
      ki: opt.ki ? kiMeta() : undefined
    };
  }

  /* ---------- Schnellentwurf ohne KI ---------- */
  function bulletsOf(s) { return s.text.split("\n").map(clean).filter(function (l) { return l.length > 3; }); }
  function pick(arr, n, seed) { var a = arr.slice(), out = []; while (a.length && out.length < n) { seed = (seed * 9301 + 49297) % 233280; out.push(a.splice(Math.floor(seed / 233280 * a.length), 1)[0]); } return out; }
  function groups(slides, n) {
    var useful = slides.filter(function (s) { return clean(s.titel + s.text).length > 10; });
    if (useful.length > 3 && clean(useful[0].text).length < 120) useful = useful.slice(1);
    if (!useful.length) useful = slides;
    n = Math.max(1, Math.min(n, useful.length));
    var g = [], size = useful.length / n;
    for (var i = 0; i < n; i++) g.push(useful.slice(Math.round(i * size), Math.round((i + 1) * size)));
    return g.filter(function (x) { return x.length; });
  }
  function draftModule(slides, opt) {
    var g = groups(slides, LAENGE[opt.laenge][0]);
    var all = []; slides.forEach(function (s) { bulletsOf(s).forEach(function (b) { all.push({ b: b, n: s.n }); }); });
    var title = clean(opt.titel) || clean((slides[0] || {}).titel) || opt.datei.replace(/\.[^.]+$/, "");
    var who = CHARS.alt_w[Math.floor(Math.random() * CHARS.alt_w.length)];
    var chapters = g.map(function (grp, gi) {
      var ct = clean(grp[0].titel) || "Station " + (gi + 1), blocks = [];
      blocks.push({ type: "scene", who: "AN", mood: "neutral", html: "<p>" + (gi === 0 ? "Willkommen auf Station! Heute geht es um „" + esc(title) + "“. " : "") + "Als Nächstes schauen wir uns „" + esc(ct) + "“ genauer an. Lies dir die Infos durch und probier dann die Aufgabe aus.</p>" });
      grp.forEach(function (s) {
        var bl = bulletsOf(s);
        if (!bl.length && !s.notiz) return;
        blocks.push({ type: "knowledge", label: "Lernblock", title: clean(s.titel) || ct, html: (bl.length ? "<ul>" + bl.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" : "") + (s.notiz ? "<p>" + esc(s.notiz).replace(/\n/g, "<br>") + "</p>" : "") });
        (opt.bilder[s.n] || []).forEach(function (im) { blocks.push({ type: "bild", src: im.src, alt: clean(s.titel) || "Folie " + s.n, caption: "Folie " + s.n + (s.titel ? ": " + esc(clean(s.titel)) : ""), quelle: "Unterrichtsfolien" }); });
      });
      var own = []; grp.forEach(function (s) { bulletsOf(s).forEach(function (b) { if (b.length > 12 && b.length < 220) own.push({ b: b, s: s }); }); });
      var others = all.filter(function (x) { return grp.every(function (s) { return s.n !== x.n; }) && x.b.length > 12 && x.b.length < 220; });
      var qs = pick(own, 3, gi + 7).map(function (x, k) {
        var d = pick(others, 2, gi * 13 + k + 3).map(function (o) { return o.b; });
        if (d.length < 2) return null;
        var o = d.concat([x.b]), a = (gi + k) % 3; var tmp = o[a]; o[a] = o[2]; o[2] = tmp;
        return { q: "Welche Aussage gehört zum Thema „" + clean(x.s.titel || ct) + "“?", o: o, a: a, e: "Diese Aussage stammt aus dem Abschnitt „" + clean(x.s.titel || ct) + "“." };
      }).filter(Boolean);
      if (qs.length) blocks.push({ type: "quiz", title: "Kurzquiz: " + ct, questions: qs });
      var cards = []; grp.forEach(function (s) { bulletsOf(s).forEach(function (b) { var m = b.match(/^([^:–\-]{2,40})\s*[:–-]\s+(.{6,200})$/); if (m) cards.push([m[1], m[2]]); }); });
      if (cards.length >= 2) blocks.push({ type: "cards", title: "Lernkarten: " + ct, cards: cards.slice(0, 10) });
      var last = own.length ? own[own.length - 1].b : null;
      if (last) blocks.push({ type: "merke", html: "<p>" + esc(last) + "</p>" });
      return { title: ct, time: "", place: "", goal: "Du kannst die wichtigsten Punkte zu „" + ct + "“ erklären.", blocks: blocks };
    });
    if (chapters.length) chapters[chapters.length - 1].blocks.push({ type: "reflect", question: "Was nimmst du aus dem Thema „" + title + "“ für deinen nächsten Praxiseinsatz mit? Beschreibe eine konkrete Situation.", hint: "Denk an eine Person, die du gepflegt hast.", model: "Individuelle Antwort. Gut ist eine konkrete Situation mit einer begründeten pflegerischen Handlung." });
    return fixModule({ title: title, subtitle: "Aus den Folien „" + opt.datei + "“", patient: { name: "", char: who }, cast: [who, "AN"], intro: "<p>Dieses Modul wurde aus den Unterrichtsfolien „" + esc(opt.datei) + "“ erstellt.</p>", outcomes: chapters.map(function (c) { return c.title; }).slice(0, 5), chapters: chapters, outro: "<p>Du hast alle Stationen zu „" + esc(title) + "“ bearbeitet.</p>" }, opt);
  }
  function draftLive(slides, opt) {
    var g = groups(slides, 5), all = []; slides.forEach(function (s) { bulletsOf(s).forEach(function (b) { all.push({ b: b, n: s.n }); }); });
    var title = clean(opt.titel) || clean((slides[0] || {}).titel) || "Neuer Live-Fall";
    var steps = g.map(function (grp, gi) {
      var own = []; grp.forEach(function (s) { bulletsOf(s).forEach(function (b) { if (b.length > 10 && b.length < 200) own.push(b); }); });
      var oth = all.filter(function (x) { return grp.every(function (s) { return s.n !== x.n; }); }).map(function (x) { return x.b; }).filter(function (b) { return b.length > 10 && b.length < 200; });
      var r = pick(own, 2, gi + 3), f = pick(oth, 2, gi + 9);
      var opts = r.map(function (t) { return [t, true, "Passt zu „" + clean(grp[0].titel) + "“.", {}]; }).concat(f.map(function (t) { return [t, false, "Gehört zu einem anderen Thema.", {}]; }));
      return { t: String(8 + gi).padStart(2, "0") + ":00", sit: "Thema: " + (clean(grp[0].titel) || "Abschnitt " + (gi + 1)) + ". Bitte Situation ergänzen.", v: {}, akte: "", q: "Was trifft zu?", multi: r.length > 1, opts: opts.length >= 2 ? opts : [["Antwort A", true, "", {}], ["Antwort B", false, "", {}]], exp: grp.map(function (s) { return clean(s.titel); }).join(", ") };
    });
    return { t: title, kurz: "Aus den Folien „" + opt.datei + "“", lvl: "Jahr " + opt.jahr, ber: "Eigener Fall", p: { name: "Bitte Namen ergänzen", alter: 70, sex: "w", station: "", diag: "", allergie: "keine bekannt", anam: "" }, v: { hf: 80, rrs: 130, rrd: 80, af: 16, spo2: 96, temp: 36.8, bz: 110, gcs: 15, schmerz: 0, o2: "Raumluft" }, labs: [], akte: [], steps: steps };
  }
  function draftTeam(slides, opt) {
    var title = clean(opt.titel) || clean((slides[0] || {}).titel) || "Neue Gruppenarbeit";
    var info = slides.filter(function (s) { return clean(s.text).length > 20; }).slice(0, 8).map(function (s, i) { return { id: rid("x"), type: "info", title: clean(s.titel) || "Material " + (i + 1), hint: "", text: s.text + (s.notiz ? "\n\n" + s.notiz : "") }; });
    var tasks = groups(slides, 5).map(function (grp, i) { return { id: "t" + (i + 1), kind: i === 0 ? "auftrag" : i % 2 ? "leitfrage" : "fokus", t: "Erarbeitet: " + (clean(grp[0].titel) || "Abschnitt " + (i + 1)), d: "Nutzt das Material und haltet eure Ergebnisse gemeinsam fest." }; });
    return { t: title, ber: "Eigene Gruppenarbeit", lvl: opt.jahr + ". Ausbildungsjahr", dur: "60 Minuten", p: { name: "", alter: "", station: "", diag: "", allergie: "" }, ueber: "Aus den Folien „" + opt.datei + "“ erstellt. Bitte Fallsituation ergänzen.", sozial: "", medis: "", oton: "", befunde: [["", ""]], blocks: info.concat([{ id: "sbar", type: "sbar" }]), tasks: tasks };
  }
  function fixLive(c, opt) {
    var b = draftLive([], opt);
    var steps = (c.steps || []).map(function (s, i) {
      var opts = (s.opts || []).map(function (o) { return Array.isArray(o) ? [str(o[0], 300), !!o[1], str(o[2], 500), o[3] && typeof o[3] === "object" ? o[3] : {}] : o && o.t ? [str(o.t, 300), !!o.ok, str(o.fb || o.e, 500), o.fx || {}] : null; }).filter(Boolean).slice(0, 6);
      if (!s.q || opts.length < 2 || !opts.some(function (o) { return o[1]; })) return null;
      return { t: str(s.t, 10) || String(8 + i).padStart(2, "0") + ":00", sit: str(s.sit, 900), v: s.v && typeof s.v === "object" ? s.v : {}, akte: str(s.akte, 300), q: str(s.q, 300), multi: !!s.multi, opts: opts, exp: str(s.exp, 900) };
    }).filter(Boolean);
    var p = c.p || {};
    return { t: str(c.t, 120) || b.t, kurz: str(c.kurz, 200), lvl: str(c.lvl, 20) || b.lvl, ber: str(c.ber, 60) || "Eigener Fall", p: { name: str(p.name, 80) || "Unbenannt", alter: Number(p.alter) || 70, sex: p.sex === "m" ? "m" : "w", station: str(p.station, 120), diag: str(p.diag, 200), allergie: str(p.allergie, 120) || "keine bekannt", anam: str(p.anam, 600) }, v: Object.assign({}, b.v, c.v || {}), labs: [], akte: (c.akte || []).map(function (x) { return str(x, 300); }).slice(0, 6), steps: steps.length ? steps : b.steps };
  }
  function fixTeam(c, opt) {
    var p = c.p || {};
    var blocks = (c.blocks || []).map(function (b) {
      if (!b || !b.type) return null;
      if (["vit", "eigen", "sis", "risk", "mass", "sbar"].indexOf(b.type) >= 0) return { id: b.type, type: b.type };
      if (b.type === "info") return { id: rid("x"), type: "info", title: str(b.title, 120), hint: "", text: str(b.text, 4000) };
      if (b.type === "text") return { id: rid("x"), type: "text", title: str(b.title, 120), hint: str(b.hint, 300) };
      if (b.type === "choice") { var o = (b.opts || []).map(function (x) { return str(x, 200); }).filter(Boolean); return o.length >= 2 ? { id: rid("x"), type: "choice", title: str(b.title, 120), hint: str(b.hint, 300), q: str(b.q, 300), opts: o } : null; }
      if (b.type === "check") return { id: rid("x"), type: "check", title: str(b.title, 120), hint: "", items: (Array.isArray(b.items) ? b.items : String(b.items || "").split("\n")).map(function (x) { return str(x, 200); }).filter(Boolean).join("\n") };
      if (b.type === "table") return { id: rid("x"), type: "table", title: str(b.title, 120), hint: str(b.hint, 300), cols: Array.isArray(b.cols) ? b.cols.join(", ") : str(b.cols, 200) || "Spalte 1, Spalte 2", rows: Math.min(8, Number(b.rows) || 3) };
      return null;
    }).filter(Boolean);
    var tasks = (c.tasks || []).filter(function (t) { return t && t.t; }).slice(0, 10).map(function (t, i) { return { id: "t" + (i + 1), kind: ["auftrag", "leitfrage", "fokus"].indexOf(t.kind) >= 0 ? t.kind : "auftrag", t: str(t.t, 140), d: str(t.d, 600) }; });
    return { t: str(c.t, 120) || "Neue Gruppenarbeit", ber: str(c.ber, 80) || "Eigene Gruppenarbeit", lvl: str(c.lvl, 40) || opt.jahr + ". Ausbildungsjahr", dur: str(c.dur, 30) || "60 Minuten", p: { name: str(p.name, 80), alter: p.alter || "", station: str(p.station, 120), diag: str(p.diag, 200), allergie: str(p.allergie, 120) }, ueber: str(c.ueber, 2500), sozial: str(c.sozial, 1500), medis: str(c.medis, 800), oton: str(c.oton, 400), befunde: (c.befunde || []).filter(Array.isArray).slice(0, 14).map(function (r) { return [str(r[0], 60), str(r[1], 200)]; }), blocks: blocks.length ? blocks : draftTeam([], opt).blocks, tasks: tasks.length ? tasks : [{ id: "t1", kind: "auftrag", t: "Fall bearbeiten", d: "" }] };
  }

  /* ---------- Erzeugen ---------- */
  async function generate(slides, opt, onStep) {
    var useAi = opt.ki;
    var folien = slideText(slides);
    if (opt.ziel === "modul") {
      if (!useAi) { onStep("Schnellentwurf aus den Folien wird gebaut …", 0.6); return draftModule(slides, opt); }
      onStep("Gliederung wird geplant …", 0.08);
      var g = await callAi({ schritt: "gliederung", ziel: "modul", jahr: opt.jahr, laenge: opt.laenge, stationen: LAENGE[opt.laenge][0], hinweis: scrub(opt.hinweis), titel: opt.titel, datei: opt.datei, folien: folien });
      var chs = g.chapters || [], done = 0;
      onStep("Stationen werden geschrieben (0 von " + chs.length + ") …", 0.15);
      var res = await Promise.all(chs.map(function (c, i) {
        var sub = folien.filter(function (f) { return (c.folien || []).indexOf(f.n) >= 0; });
        if (!sub.length) sub = folien.slice(Math.floor(i * folien.length / chs.length), Math.ceil((i + 1) * folien.length / chs.length));
        return callAi({ schritt: "station", ziel: "modul", jahr: opt.jahr, hinweis: scrub(opt.hinweis), gliederung: { title: g.title, patient: g.patient, cast: g.cast, chapters: chs.map(function (x) { return { title: x.title, goal: x.goal }; }) }, station: c, index: i, anzahl: chs.length, folien: sub }).then(function (r) {
          done++; onStep("Stationen werden geschrieben (" + done + " von " + chs.length + ") …", 0.15 + 0.8 * done / chs.length);
          return r;
        });
      }));
      g.chapters = chs.map(function (c, i) {
        var blocks = (res[i] && res[i].blocks) || [];
        (c.folien || []).forEach(function (n) { (opt.bilder[n] || []).forEach(function (im) { blocks.splice(Math.min(2, blocks.length), 0, { type: "bild", src: im.src, alt: "Folie " + n, caption: "Folie " + n, quelle: "Unterrichtsfolien" }); }); });
        return Object.assign({}, c, { blocks: blocks, akte: res[i] && res[i].akte });
      });
      return fixModule(g, opt);
    }
    if (opt.ziel === "live") {
      if (!useAi) return draftLive(slides, opt);
      onStep("Live-Fall wird geschrieben …", 0.3);
      var lv = fixLive(await callAi({ schritt: "live", ziel: "live", jahr: opt.jahr, hinweis: scrub(opt.hinweis), titel: opt.titel, folien: folien }), opt);
      lv.ki = kiMeta();
      return lv;
    }
    if (!useAi) return draftTeam(slides, opt);
    onStep("Gruppenarbeit wird geschrieben …", 0.3);
    var t = fixTeam(await callAi({ schritt: "team", ziel: "team", jahr: opt.jahr, hinweis: scrub(opt.hinweis), titel: opt.titel, folien: folien }), opt);
    t.ki = kiMeta();
    Object.keys(opt.bilder).forEach(function (n) { opt.bilder[n].forEach(function (im) { t.blocks.unshift({ id: rid("x"), type: "bild", src: im.src, alt: "Folie " + n, caption: "Folie " + n }); }); });
    return t;
  }

  /* ---------- Oberfläche ---------- */
  function Icon(p) { return h("svg", { viewBox: "0 0 24 24", width: p.s || 20, height: p.s || 20, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: p.d })); }
  var IC = { up: "M12 16V4.5M7 9l5-5 5 5M4.5 15v4.5h15V15", x: "M6 6l12 12M18 6 6 18", spark: "M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z", file: "M7 3.5h7l4 4v13H7zM14 3.5v4h4", ok: "M5 12.5 10 17l9-10", back: "M15 6l-6 6 6 6" };
  function Modal(p) {
    var st = useState("start"), step = st[0], setStep = st[1];
    var o = useState({ ziel: p.ziel || "modul", jahr: "2", laenge: "mittel", hinweis: "", titel: "" }), opt = o[0], setOpt = o[1];
    var f = useState(null), file = f[0], setFile = f[1];
    var sl = useState(null), slides = sl[0], setSlides = sl[1];
    var pr = useState({ t: "", v: 0 }), prog = pr[0], setProg = pr[1];
    var er = useState(null), err = er[0], setErr = er[1];
    var rs = useState(null), result = rs[0], setResult = rs[1];
    var ai = useState(null), hasAi = ai[0], setHasAi = ai[1];
    var sel = useState({}), pickImg = sel[0], setPick = sel[1];
    var drag = useState(false), over = drag[0], setOver = drag[1];
    var cn = useState(false), cons = cn[0], setCons = cn[1];
    var inp = useRef(null);
    useEffect(function () { aiAvailable().then(setHasAi); var k = function (e) { if (e.key === "Escape") p.close(); }; document.addEventListener("keydown", k); return function () { document.removeEventListener("keydown", k); }; }, []);
    var set = function (k, v) { setOpt(function (x) { var y = Object.assign({}, x); y[k] = v; return y; }); };
    async function take(fl) {
      setErr(null);
      if (!fl) return;
      if (!/\.(pptx|pdf)$/i.test(fl.name)) { setErr("Bitte eine PowerPoint-Datei (.pptx) oder ein PDF wählen. Alte .ppt-Dateien bitte vorher in PowerPoint als .pptx speichern."); return; }
      if (fl.size > 60 * 1024 * 1024) { setErr("Die Datei ist größer als 60 MB. Bitte Bilder komprimieren oder als PDF speichern."); return; }
      setFile(fl); setStep("read"); setProg({ t: "Datei wird geöffnet …", v: 0.05 });
      try {
        var s = /\.pdf$/i.test(fl.name) ? await readPdf(fl, function (t) { setProg({ t: t, v: 0.5 }); }) : await readPptx(fl, function (t) { setProg({ t: t, v: 0.5 }); });
        var chars = s.reduce(function (a, x) { return a + x.titel.length + x.text.length + x.notiz.length; }, 0);
        if (chars < 80) throw new Error("In der Datei wurde kaum Text gefunden. Enthält sie nur Bilder oder eingescannte Seiten? Dann bitte eine Fassung mit Text verwenden.");
        setSlides(s);
        set("titel", clean((s[0] || {}).titel).slice(0, 100));
        setStep("opts");
      } catch (e) { setErr(e.message); setStep("start"); }
    }
    async function run() {
      setErr(null); setStep("gen");
      var bilder = {};
      slides.forEach(function (s) { s.bilder.forEach(function (im, i) { if (pickImg[s.n + ":" + i]) (bilder[s.n] = bilder[s.n] || []).push(im); }); });
      var o2 = Object.assign({}, opt, { datei: file.name, bilder: bilder, ki: !!hasAi });
      try {
        var r = await generate(slides, o2, function (t, v) { setProg({ t: t, v: v || 0.5 }); });
        try { if (hasAi) { var c = await window.FP_SB(); await c.from("fp_import_log").insert({ ziel: opt.ziel, seiten: slides.length, zeichen: JSON.stringify(slideText(slides)).length }); } } catch (e) {}
        window.FP_IMPORT.last = r;
        setResult(r); setStep("done");
      } catch (e) { setErr(e.message || String(e)); setStep("opts"); }
    }
    function open() {
      if (opt.ziel === "modul" && window.FP_openEditor) window.FP_openEditor(result);
      else if (opt.ziel === "live" && window.FP_liveEdit) window.FP_liveEdit(result);
      else if (opt.ziel === "team" && window.FP_teamBuild) window.FP_teamBuild(result);
      p.close();
    }
    var Z = ZIEL[opt.ziel];
    var imgs = slides ? slides.reduce(function (a, s) { s.bilder.forEach(function (im, i) { a.push({ k: s.n + ":" + i, im: im, n: s.n }); }); return a; }, []) : [];
    var body;
    if (step === "start" || step === "read") {
      body = h("div", null,
        h("div", { className: "fxi-ziele" }, Object.keys(ZIEL).map(function (k) {
          return h("button", { key: k, type: "button", className: "fxi-ziel" + (opt.ziel === k ? " on" : ""), style: { "--c": ZIEL[k].c }, onClick: function () { set("ziel", k); } }, h("b", null, ZIEL[k].t), h("small", null, ZIEL[k].d));
        })),
        h("div", { className: "fxi-drop" + (over ? " over" : ""), onDragOver: function (e) { e.preventDefault(); setOver(true); }, onDragLeave: function () { setOver(false); }, onDrop: function (e) { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }, onClick: function () { inp.current && inp.current.click(); }, role: "button", tabIndex: 0, onKeyDown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.current.click(); } } },
          step === "read" ? h("div", { className: "fxi-busy" }, h("i", { className: "fxi-spin" }), h("span", null, prog.t)) : h(R.Fragment, null,
            h("span", { className: "fxi-dic" }, h(Icon, { d: IC.up, s: 28 })),
            h("b", null, "PowerPoint oder PDF hierher ziehen"),
            h("small", null, "oder klicken zum Auswählen · .pptx oder .pdf, bis 60 MB")),
          h("input", { ref: inp, type: "file", accept: ".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation", hidden: true, onChange: function (e) { take(e.target.files[0]); e.target.value = ""; } })),
        h("p", { className: "fxi-note" }, "Die Datei wird in deinem Browser gelesen und nicht hochgeladen. ", hasAi ? "Für die Erstellung gehen nur die Folientexte an OpenAI (Verarbeitung in den USA auf Grundlage von EU-Standardvertragsklauseln, keine Nutzung für Training, Löschung bei OpenAI spätestens nach 30 Tagen). E-Mail-Adressen, Telefonnummern und Datumsangaben entfernt Fallpfad vorher automatisch." : "Ohne eingerichteten KI-Dienst erstellt Fallpfad einen Schnellentwurf direkt aus den Folien, den du im Editor ausbaust."));
    } else if (step === "opts") {
      body = h("div", null,
        h("div", { className: "fxi-file" }, h(Icon, { d: IC.file }), h("div", null, h("b", null, file.name), h("small", null, slides.length + (/\.pdf$/i.test(file.name) ? " Seiten" : " Folien") + " gelesen · Ziel: " + Z.t)), h("button", { type: "button", className: "btn ghost sm", onClick: function () { setStep("start"); setSlides(null); setFile(null); } }, "Andere Datei")),
        h("div", { className: "fxi-grid" },
          h("div", { className: "field" }, h("label", { htmlFor: "fxi-t" }, "Titel"), h("input", { id: "fxi-t", className: "input", value: opt.titel, onChange: function (e) { set("titel", e.target.value); }, placeholder: "z. B. Herzinsuffizienz: Atemnot verstehen" })),
          h("div", { className: "field" }, h("label", { htmlFor: "fxi-j" }, "Ausbildungsjahr"), h("select", { id: "fxi-j", className: "input", value: opt.jahr, onChange: function (e) { set("jahr", e.target.value); } }, h("option", { value: "1" }, "1. Ausbildungsjahr"), h("option", { value: "2" }, "2. Ausbildungsjahr"), h("option", { value: "3" }, "3. Ausbildungsjahr")))),
        opt.ziel === "modul" && h("div", { className: "field" }, h("label", null, "Umfang"), h("div", { className: "fxi-seg" }, Object.keys(LAENGE).map(function (k) { return h("button", { key: k, type: "button", className: opt.laenge === k ? "on" : "", onClick: function () { set("laenge", k); } }, h("b", null, LAENGE[k][1]), h("small", null, LAENGE[k][2])); }))),
        h("div", { className: "field" }, h("label", { htmlFor: "fxi-h" }, "Was ist dir wichtig? (optional)"), h("textarea", { id: "fxi-h", className: "input", rows: 3, value: opt.hinweis, onChange: function (e) { set("hinweis", e.target.value); }, placeholder: "z. B. Fokus auf Krankenbeobachtung und Beratung, Patientin im Pflegeheim, viele Übungen zur Dokumentation" })),
        imgs.length > 0 && h("div", { className: "field" }, h("label", null, "Bilder aus der Datei übernehmen (antippen zum Auswählen)"), h("div", { className: "fxi-imgs" }, imgs.slice(0, 40).map(function (x) { return h("button", { key: x.k, type: "button", className: "fxi-img" + (pickImg[x.k] ? " on" : ""), onClick: function () { setPick(function (pp) { var y = Object.assign({}, pp); y[x.k] = !y[x.k]; return y; }); }, title: "Folie " + x.n }, h("img", { src: x.im.src, alt: "Folie " + x.n }), h("span", null, x.n), pickImg[x.k] && h("i", null, h(Icon, { d: IC.ok, s: 14 }))); }))),
        h("div", { className: "fxi-ai" + (hasAi ? " on" : "") }, h(Icon, { d: IC.spark }), h("span", null, hasAi ? h(R.Fragment, null, h("b", null, "KI-Erstellung aktiv (OpenAI). "), "Fallpfad schreibt eine Fallgeschichte mit Szenen, Wissen, Quiz und interaktiven Übungen auf Basis deiner Folien. Das Ergebnis ist ein KI-Entwurf, den du fachlich prüfst.") : h(R.Fragment, null, h("b", null, "Schnellentwurf ohne KI. "), "Die Folien werden in Stationen mit Wissensblöcken, Quiz und Lernkarten umgewandelt. Für ausgearbeitete Fallgeschichten richtet die Administration den KI-Dienst ein."))),
        hasAi && h("label", { className: "fxi-consent" + (cons ? " on" : "") }, h("input", { type: "checkbox", checked: cons, onChange: function (e) { setCons(e.target.checked); } }), h("span", null, h("b", null, "Ich bestätige: "), "Die Folien enthalten keine Namen oder sonstigen Daten echter Patientinnen und Patienten, Lernender oder Kolleginnen und Kollegen. Fallbeispiele sind erfunden oder anonymisiert.", scrubCount(slides) ? h("small", null, scrubCount(slides) + " Angaben (E-Mail, Telefon, Datum) werden vor dem Versand automatisch entfernt.") : null)));
    } else if (step === "gen") {
      body = h("div", { className: "fxi-gen" }, h("div", { className: "fxi-orb", style: { "--c": Z.c } }, h(Icon, { d: IC.spark, s: 30 })), h("b", null, prog.t), h("div", { className: "fxi-bar" }, h("i", { style: { width: Math.round(prog.v * 100) + "%" } })), h("small", null, hasAi ? "Das dauert je nach Umfang etwa eine bis drei Minuten. Du kannst das Fenster offen lassen." : "Einen Moment …"));
    } else if (step === "done") {
      var parts = opt.ziel === "modul" ? result.chapters.map(function (c, i) {
        var cnt = {}; c.blocks.forEach(function (b) { cnt[b.type] = (cnt[b.type] || 0) + 1; });
        return h("li", { key: i }, h("b", null, (i + 1) + ". " + c.title), h("small", null, Object.keys(cnt).map(function (k) { return cnt[k] + "× " + ({ scene: "Szene", knowledge: "Wissen", quiz: "Quiz", cards: "Lernkarten", merke: "Merke", reflect: "Reflexion", mythos: "Mythen-Check", bucket: "Zuordnen", verlauf: "Fallverlauf", fehler: "Fehlersuche", schaetz: "Schätzfrage", doku: "Pflegebericht", praxis: "Praxisauftrag", bild: "Bild", "case": "Fallvignette", challenge: "Herausforderung" }[k] || k); }).join(" · ")));
      }) : opt.ziel === "live" ? result.steps.map(function (s, i) { return h("li", { key: i }, h("b", null, s.t + " · " + s.q), h("small", null, s.opts.length + " Antworten")); }) : result.tasks.map(function (t, i) { return h("li", { key: i }, h("b", null, t.t), h("small", null, t.d)); });
      body = h("div", null, h("div", { className: "fxi-okhead", style: { "--c": Z.c } }, h("span", null, h(Icon, { d: IC.ok, s: 22 })), h("div", null, h("b", null, opt.ziel === "modul" ? result.title : result.t), h("small", null, Z.t + " erstellt" + (hasAi ? " mit KI, als KI-Entwurf gekennzeichnet" : " (Schnellentwurf)") + " · noch nicht veröffentlicht"))), h("ol", { className: "fxi-out" }, parts), h("p", { className: "fxi-note" }, "Im Editor prüfst und änderst du alles, bevor die Lernenden es sehen. Bitte Inhalte fachlich gegenlesen."));
    }
    var foot = step === "opts" ? h("div", { className: "fxi-foot" }, h("button", { type: "button", className: "btn ghost", onClick: p.close }, "Abbrechen"), h("button", { type: "button", className: "btn fx-aibtn", onClick: run, disabled: !!hasAi && !cons, title: hasAi && !cons ? "Bitte zuerst bestätigen" : "" }, h(Icon, { d: IC.spark, s: 18 }), Z.t + " erstellen"))
      : step === "done" ? h("div", { className: "fxi-foot" }, h("button", { type: "button", className: "btn ghost", onClick: function () { setStep("opts"); } }, "Neu erstellen"), h("button", { type: "button", className: "btn", onClick: open }, "Im Editor öffnen")) : null;
    return h("div", { className: "fxi-bg", onMouseDown: function (e) { if (e.target === e.currentTarget && step !== "gen") p.close(); } },
      h("div", { className: "fxi", role: "dialog", "aria-modal": true, "aria-label": "Aus Folien erstellen", style: { "--c": Z.c } },
        h("div", { className: "fxi-head" }, h("span", { className: "fxi-hic" }, h(Icon, { d: IC.spark })), h("div", null, h("b", null, "Aus Folien erstellen"), h("small", null, "PowerPoint oder PDF in ein interaktives " + Z.t.replace("Lernmodul", "Lernmodul") + " verwandeln")), step !== "gen" && h("button", { type: "button", className: "iconbtn", "aria-label": "Schließen", onClick: p.close }, h(Icon, { d: IC.x }))),
        err && h("div", { className: "notice bad", role: "alert", style: { margin: "0 0 12px" } }, err),
        body, foot));
  }
  var host = null, root = null;
  window.FP_IMPORT = {
    open: function (ziel) {
      if (!host) { host = document.createElement("div"); host.id = "fxi-root"; document.body.appendChild(host); root = RD.createRoot(host); }
      root.render(h(Modal, { key: Date.now(), ziel: ziel, close: function () { root.render(null); } }));
    },
    _test: { draftModule: draftModule, draftLive: draftLive, draftTeam: draftTeam, fixModule: fixModule, fixLive: fixLive, fixTeam: fixTeam }
  };
  /* Knöpfe neben "Neues Modul", "Eigenen Fall erstellen", "Neue Gruppenarbeit" */
  var ANCH = [[/^Neues Modul$/, "modul"], [/^Eigenen Fall erstellen$/, "live"], [/^Neue Gruppenarbeit$/, "team"]];
  function addButtons() {
    document.querySelectorAll("main .btn").forEach(function (b) {
      var t = (b.textContent || "").trim();
      ANCH.forEach(function (a) {
        if (!a[0].test(t)) return;
        var nx = b.nextElementSibling;
        if (nx && nx.classList.contains("fx-aibtn")) return;
        var x = document.createElement("button");
        x.type = "button";
        x.className = "btn fx-aibtn";
        x.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC.spark + '"/></svg>Aus Folien erstellen';
        x.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); window.FP_IMPORT.open(a[1]); });
        b.parentNode.insertBefore(x, b.nextSibling);
      });
    });
  }
  var q = false;
  function tick() { if (q) return; q = true; requestAnimationFrame(function () { q = false; addButtons(); }); }
  function start() { tick(); new MutationObserver(tick).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();

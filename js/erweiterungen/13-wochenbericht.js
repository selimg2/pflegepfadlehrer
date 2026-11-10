/* Fallpfad Lehrer-Portal: Kurs-Wochenbericht als Word-Datei.
   Ein Klick auf der Übersicht erzeugt einen druckfertigen Bericht je Kurs:
   Lernende, Aktivität der letzten 7 Tage, laufende Aufgaben, zuletzt aktive Lernende.
   Alles entsteht lokal im Browser aus den bereits geladenen Daten – nichts verlässt das Gerät. */
(function () {
  function escH(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fmt(d) { try { return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch (e) { return ""; } }
  function wordDatei(titel, html) {
    var doc = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>" + escH(titel) + "</title>" +
      "<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.45}h1{font-size:18pt;margin:0 0 4pt}h2{font-size:13pt;margin:18pt 0 6pt;border-bottom:1pt solid #cbd5e1;padding-bottom:3pt}p,li,td,th{margin:0 0 5pt}table{border-collapse:collapse;width:100%}th,td{border:1pt solid #cbd5e1;padding:4pt 6pt;text-align:left;font-size:10pt}th{background:#eef2f7}.k{color:#555;font-size:9pt;margin-top:14pt}.z{font-size:10pt;color:#555}</style></head><body>" +
      html + "<p class='k'>Erstellt mit dem Fallpfad Lehrer-Portal. Nur für den internen Gebrauch; enthält personenbezogene Daten der Lernenden.</p></body></html>";
    var blob = new Blob(["﻿", doc], { type: "application/msword" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = String(titel).replace(/[^\wäöüÄÖÜß\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 60) + ".doc";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function bericht(data) {
    var now = Date.now(), WOCHE = 7 * 864e5;
    var P = {}; (data.progress || []).forEach(function (p) { P[p.user_id] = p; });
    var laufend = (data.assignments || []).filter(function (x) { return now >= Date.parse(x.opens_at) && (!x.due_at || now <= Date.parse(x.due_at)); });
    var kurse = (data.courses || []).map(function (c) { return { c: c, ss: (data.students || []).filter(function (s) { return s.course_id === c.id; }) }; });
    var ohne = (data.students || []).filter(function (s) { return !s.course_id; });
    if (ohne.length) kurse.push({ c: { id: "ohne", name: "Ohne Kurs" }, ss: ohne });
    var von = fmt(now - WOCHE), bis = fmt(now);
    var h = "<h1>Wochenbericht " + von + " – " + bis + "</h1><p class='z'>" + (data.students || []).length + " Lernende · " + (data.courses || []).length + " Kurse · " + laufend.length + " laufende Aufgaben</p>";
    kurse.forEach(function (k) {
      var aktiv = k.ss.filter(function (s) { var p = P[s.id]; return p && now - Date.parse(p.updated_at) < WOCHE; });
      var still = k.ss.filter(function (s) { var p = P[s.id]; return !p || now - Date.parse(p.updated_at) >= WOCHE; });
      h += "<h2>" + escH(k.c.name) + "</h2><p>" + k.ss.length + " Lernende, davon <b>" + aktiv.length + " aktiv</b> in den letzten 7 Tagen.</p>";
      if (k.ss.length) {
        h += "<table><tr><th>Name</th><th>Zuletzt aktiv</th><th>Hinweis</th></tr>";
        k.ss.slice().sort(function (a, b) { var pa = P[a.id], pb = P[b.id]; return (pb ? Date.parse(pb.updated_at) : 0) - (pa ? Date.parse(pa.updated_at) : 0); }).forEach(function (s) {
          var p = P[s.id], ruhig = !p || now - Date.parse(p.updated_at) >= WOCHE;
          h += "<tr><td>" + escH(s.display_name || s.email) + "</td><td>" + (p ? fmt(p.updated_at) : "noch nie") + "</td><td>" + (ruhig ? "seit über einer Woche nicht aktiv" : "") + "</td></tr>";
        });
        h += "</table>";
        if (still.length) h += "<p class='z'>Ansprechen lohnt sich bei: " + still.map(function (s) { return escH(s.display_name || s.email); }).join(", ") + ".</p>";
      }
    });
    if (laufend.length) {
      h += "<h2>Laufende Aufgaben</h2><table><tr><th>Aufgabe</th><th>Fällig</th></tr>";
      laufend.forEach(function (x) { h += "<tr><td>" + escH(x.title || x.module_id || "Aufgabe") + "</td><td>" + (x.due_at ? fmt(x.due_at) : "ohne Frist") + "</td></tr>"; });
      h += "</table>";
    }
    wordDatei("Fallpfad Wochenbericht " + bis, h);
  }

  window.FP_WB = { open: bericht };
})();

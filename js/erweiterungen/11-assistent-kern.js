/* Fallpfad "Assistent" (Schüler-App): KI-Chat, der nur mit Inhalten aus Fallpfad arbeitet.
   - Suche auf dem Gerät: Die App zerlegt Lernmodule, Lernkarten und Kitteltasche in kurze Abschnitte und sucht die passenden
     Abschnitte zur Frage heraus (BM25). Nur diese Abschnitte gehen mit der Frage an die Edge Function "assistent".
   - Antwortarten: Erklärung mit Quellen, Lernplan bis zur Prüfung (speicherbar, mit Kalenderdatei), Testklausur zum Üben.
   - Großzügiges Tageslimit (Server zählt, wird nicht angezeigt), Chatverlauf nur auf dem Gerät, Antwortsprache = „Meine Sprache“.
   - Gemeinsamer Kern (Suche, Darstellung) wird auch vom Lehrer-Portal genutzt: window.FP_AST_CORE. */
(function () {
  var R = window.React;
  if (!R) return;
  var h = R.createElement, uS = R.useState, uE = R.useEffect, uR = R.useRef, uM = R.useMemo, Fr = R.Fragment;

  /* ================= Suche auf dem Gerät ================= */
  var STOP = "aber alle allem allen aller alles als also am an ander andere anderen auch auf aus bei beim bin bis bist da damit dann das dass dein deine dem den der des dessen die dies diese diesem diesen dieser dir doch dort du durch ein eine einem einen einer eines er es etwa euch für gegen hat hatte hier ich ihm ihn ihr ihre im in ins ist ja jede jedem jeden jeder jetzt kann kannst kein keine man mehr mein meine mich mir mit muss nach nicht nichts noch nun nur ob oder ohne sehr sein seine sich sie sind so soll sollte über um und uns unter vom von vor war was weil welche wenn wer wie wieder wir wird wo zu zum zur zwischen bitte mal erkläre erklären erklär erstelle erstell mache mach machen gib zeig zeige frage fragen thema warum wieso weshalb welcher welches genau einfach viel".split(" ");
  var STOPS = {}; STOP.forEach(function (w) { STOPS[w] = 1; });
  function stem(w) {
    var e = ["ungen", "ung", "heit", "keit", "en", "er", "es", "em", "e", "n", "s"];
    for (var i = 0; i < e.length; i++) if (w.length - e[i].length >= 4 && w.slice(-e[i].length) === e[i]) return w.slice(0, -e[i].length);
    return w;
  }
  function toks(s) {
    return String(s || "").toLowerCase().replace(/ß/g, "ss").replace(/[^a-zäöü0-9]+/g, " ").split(" ").filter(function (w) { return w.length > 2 && !STOPS[w]; }).map(stem);
  }
  function plain(html) { return String(html || "").replace(/<\/(p|li|h\d|tr|div)>/gi, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim(); }
  function blockText(b) {
    if (!b || typeof b !== "object") return "";
    var t = [];
    if (b.title) t.push(b.title + ":");
    if (b.html) t.push(plain(b.html));
    if (b.caption) t.push(plain(b.caption));
    if (b.rows) b.rows.forEach(function (r) { if (Array.isArray(r)) t.push(r.join(": ")); });
    if (b.cards) b.cards.forEach(function (c) { if (Array.isArray(c)) t.push(c[0] + ": " + c[1]); });
    if (b.questions) b.questions.forEach(function (q) { t.push("Frage: " + q.q + " Antwort: " + ((q.o || [])[q.a] || "") + ". " + (q.e || "")); });
    if (b.question && b.options) { var ok = b.options.filter(function (o) { return o.correct; }).map(function (o) { return o.text; }); t.push("Frage: " + plain(b.question) + " Richtig: " + ok.join("; ") + ". " + (b.options.filter(function (o) { return o.correct; }).map(function (o) { return o.feedback || ""; }).join(" "))); }
    if (b.items && b.type === "mythos") b.items.forEach(function (x) { t.push((x.ok ? "Richtig: " : "Falsch: ") + x.t + " " + (x.e || "")); });
    if (b.lines && b.type === "fehler") b.lines.forEach(function (x) { if (x.e) t.push("Fehler: " + x.t + " " + x.e); });
    if (b.steps && b.type === "verlauf") b.steps.forEach(function (s) { (s.opts || []).forEach(function (o) { if (o.ok === 1) t.push(s.sit + " Richtig: " + o.t + ". " + (o.c || "")); }); });
    if (b.end) t.push(b.end);
    if (b.model && typeof b.model === "string") t.push("Musterlösung: " + b.model);
    if (b.auftrag) t.push(b.auftrag + " " + (b.steps || []).join(" "));
    return t.join(" ").replace(/\s+/g, " ").trim();
  }
  function modTitle(m) { return String(m.title || "").replace(/^Fallmodul (\d+) · /, "Modul $1 · "); }

  function makeIndex(docs) {
    var N = docs.length, df = {}, avg = 0;
    docs.forEach(function (d) {
      var tf = {}, tt = toks(d.titel), tx = toks(d.text);
      tt.forEach(function (w) { tf[w] = (tf[w] || 0) + 2; });
      tx.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
      d.tf = tf; d.len = tt.length * 2 + tx.length; avg += d.len;
      Object.keys(tf).forEach(function (w) { df[w] = (df[w] || 0) + 1; });
    });
    avg = avg / Math.max(1, N);
    function search(q, n, opt) {
      opt = opt || {};
      var qt = toks(q); if (!qt.length) return [];
      var uniq = {}; qt.forEach(function (w) { uniq[w] = 1; });
      var res = [];
      docs.forEach(function (d) {
        if (opt.filter && !opt.filter(d)) return;
        var s = 0;
        Object.keys(uniq).forEach(function (w) {
          var f = d.tf[w]; if (!f) {
            // Teilwort (Kompositum): "Dekubitusprophylaxe" findet "prophylaxe"
            if (w.length >= 6) for (var k in d.tf) if (k.length > w.length && k.indexOf(w) >= 0) { f = d.tf[k] * 0.5; break; }
            if (!f) return;
          }
          var idf = Math.log(1 + (N - (df[w] || 0) + 0.5) / ((df[w] || 0) + 0.5));
          s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.len / avg));
        });
        if (s > 0) res.push({ d: d, s: s * (d.boost || 1) });
      });
      res.sort(function (a, b) { return b.s - a.s; });
      var out = [], per = {};
      for (var i = 0; i < res.length && out.length < n; i++) {
        var g = res[i].d.gruppe || res[i].d.id;
        if ((per[g] || 0) >= (opt.proGruppe || 3)) continue;
        per[g] = (per[g] || 0) + 1; out.push(res[i].d);
      }
      return out;
    }
    return { docs: docs, search: search };
  }

  var IDX = null;
  function appDocs() {
    var docs = [], mods = (window.FP_DATA && window.FP_DATA.mods) || [], seen = {};
    var extra = (window.FP_MODS || []).filter(function (m) { return m && m.chapters && !mods.some(function (x) { return x.id === m.id; }); });
    mods.concat(extra).forEach(function (m) {
      if (!m || !m.id || seen[m.id]) return; seen[m.id] = 1;
      var mt = modTitle(m);
      docs.push({ id: m.id + ":i", gruppe: m.id, mod: m.id, ci: -1, titel: mt + " · Überblick", text: plain(m.intro) + " Lernziele: " + (m.outcomes || []).join("; ") + (m.patient ? " Fall: " + m.patient.name + ", " + m.patient.diagnosis : ""), boost: 1.05 });
      (m.chapters || []).forEach(function (c, ci) {
        var buf = [], k = 0;
        function flush() { if (!buf.length) return; docs.push({ id: m.id + ":" + ci + ":" + k, gruppe: m.id, mod: m.id, ci: ci, titel: mt + " › " + (c.title || "Station " + (ci + 1)), text: (c.goal ? "Ziel: " + c.goal + " " : "") + buf.join(" ") }); k++; buf = []; }
        (c.blocks || []).forEach(function (b) {
          if (b.type === "scene" || b.type === "figure" || b.type === "bild") return;
          var t = blockText(b); if (t.length < 25) return;
          if (buf.join(" ").length + t.length > 1300) flush();
          buf.push(t.slice(0, 1600));
        });
        flush();
      });
    });
    var cards = window.FP_CARDS || {};
    Object.keys(cards).forEach(function (mid) {
      var m = mods.filter(function (x) { return x.id === mid; })[0];
      var list = cards[mid] || [];
      for (var i = 0; i < list.length; i += 6) docs.push({ id: "lk:" + mid + ":" + (i / 6), gruppe: "lk:" + mid, mod: mid, ci: -1, titel: "Lernkarten · " + (m ? modTitle(m) : mid), text: list.slice(i, i + 6).map(function (c) { return c[0] + ": " + c[1]; }).join(" | ") });
    });
    (window.FP_LEXIKON || []).forEach(function (x, i, all) {
      if (i % 8) return;
      var part = all.slice(i, i + 8);
      docs.push({ id: "lx:" + (i / 8), gruppe: "lx", titel: "Fachlexikon · " + (part[0][2] || "Begriffe"), text: part.map(function (c) { return c[0] + ": " + c[1]; }).join(" | ") });
    });
    (window.FP_POCKET || []).forEach(function (p) {
      if (!Array.isArray(p)) return;
      docs.push({ id: "kt:" + p[0], gruppe: "kt", titel: "Kitteltasche · " + p[1], text: (p[3] || []).map(function (r) { return Array.isArray(r) ? r.join(": ") : String(r); }).join(" | ") });
    });
    return docs;
  }
  function index() { if (!IDX) IDX = makeIndex(appDocs()); return IDX; }

  /* Fortschritt je Modul aus dem App-Zustand */
  function modulListe(S) {
    var list = window.FP_MODS || (window.FP_DATA && window.FP_DATA.mods) || [], done = (S && S.done) || {};
    return list.map(function (m, i) {
      var st = m.steps || [], d = st.filter(function (x) { return done[x.key]; }).length;
      return { id: m.id, titel: modTitle(m), jahr: m.year || 0, pct: st.length ? Math.round(100 * d / st.length) : 0, stationen: (m.chapters || []).length, i: i };
    });
  }
  function openQuelle(id) {
    var p = String(id).split(":"), mid = p[0] === "lk" ? p[1] : p[0], ci = p[0] === "lk" || p[1] === "i" ? -1 : Number(p[1]);
    var list = window.FP_MODS || [], mi = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === mid) { mi = i; break; }
    if (mi < 0 || !window.FP_openModule) return false;
    var si; if (ci >= 0 && list[mi].steps) for (var j = 0; j < list[mi].steps.length; j++) if (list[mi].steps[j].ci === ci) { si = j; break; }
    window.FP_openModule(mi, si);
    return true;
  }

  /* ================= Darstellung ================= */
  var ICO = {
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    send: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    exam: '<path d="M7 3.5h10a2 2 0 0 1 2 2v15l-3-2-2 2-2-2-2 2-2-2-3 2v-15a2 2 0 0 1 2-2z"/><path d="M9 9l1.5 1.5L14 7M9 14h6"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    rep: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    right: '<path d="M9 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    file: '<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>'
  };
  function Ic(p) { return h("svg", { viewBox: "0 0 24 24", width: p.s || 18, height: p.s || 18, fill: "none", stroke: "currentColor", strokeWidth: p.w || 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", dangerouslySetInnerHTML: { __html: ICO[p.k] || "" } }); }

  /* Einfaches Markdown: Absätze, Listen, **fett** */
  function inline(t, key) {
    var parts = String(t).split(/(\*\*[^*]+\*\*)/g);
    return parts.map(function (x, i) { return /^\*\*[^*]+\*\*$/.test(x) ? h("b", { key: key + "-" + i }, x.slice(2, -2)) : x; });
  }
  function Md(p) {
    var lines = String(p.text || "").replace(/\r/g, "").split("\n"), out = [], list = null, ord = false;
    function close() { if (list) { out.push(h(ord ? "ol" : "ul", { key: "l" + out.length }, list)); list = null; } }
    lines.forEach(function (l, i) {
      var m = l.match(/^\s*(?:[-•*]|(\d+)[.)])\s+(.*)$/);
      if (m) { var o = !!m[1]; if (list && o !== ord) close(); ord = o; list = list || []; list.push(h("li", { key: i }, inline(m[2], i))); return; }
      close();
      if (l.trim()) out.push(h("p", { key: i }, inline(l.trim(), i)));
    });
    close();
    return h("div", { className: "ast-md" }, out);
  }
  function fmtDate(iso, lang) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    try { return d.toLocaleDateString(lang && lang !== "einfach" ? lang : "de-DE", { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return iso; }
  }
  function isoDay(d) { var x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); }

  function Quellen(p) {
    var docs = index().docs, map = {};
    docs.forEach(function (d) { map[d.id] = d; });
    (p.extra || []).forEach(function (d) { map[d.id] = d; });
    var seenT = {}, ids = (p.ids || []).filter(function (id) { if (!map[id] || seenT[map[id].titel]) return false; seenT[map[id].titel] = 1; return true; });
    if (!ids.length) return null;
    return h("div", { className: "ast-src" },
      h("span", { className: "ast-src-h" }, h(Ic, { k: "book", s: 14 }), p.label || "Quellen in Fallpfad"),
      h("div", { className: "ast-src-l" }, ids.map(function (id) {
        var d = map[id], can = !!p.open && !/^kt|^eig/.test(id);
        return h(can ? "button" : "span", { key: id, type: can ? "button" : undefined, className: "ast-chip" + (can ? " link" : ""), title: d.titel, onClick: can ? function () { p.open(id); } : undefined }, h("span", null, d.titel.replace(/ › /, " › ")), can ? h(Ic, { k: "right", s: 13 }) : null);
      })));
  }

  function Plan(p) {
    var plan = p.plan, lang = p.lang, mods = {}, done = p.done || {};
    (window.FP_MODS || []).forEach(function (m) { mods[m.id] = m; });
    var total = 0, fertig = 0;
    plan.tage.forEach(function (t, ti) { t.schritte.forEach(function (s, si) { total++; if (done[ti + ":" + si]) fertig++; }); });
    var heute = isoDay(new Date());
    return h("div", { className: "ast-plan" },
      h("div", { className: "ast-plan-h" },
        h("span", { className: "ast-pi", style: { "--c": "#0A84FF" } }, h(Ic, { k: "cal", s: 18 })),
        h("div", null, h("b", null, plan.titel || "Lernplan"), h("small", null, plan.tage.length + " Lerntage" + (plan.ziel ? " · Prüfung am " + fmtDate(plan.ziel, lang) : "") + (p.saved ? " · " + fertig + " von " + total + " erledigt" : ""))),
        p.saved ? h("div", { className: "ast-prog", "aria-label": fertig + " von " + total + " erledigt" }, h("i", { style: { width: Math.round(100 * fertig / Math.max(1, total)) + "%" } })) : null),
      h("ol", { className: "ast-days" }, plan.tage.map(function (t, ti) {
        var isToday = t.datum === heute, past = t.datum && t.datum < heute;
        return h("li", { key: ti, className: "ast-day" + (isToday ? " today" : "") + (past ? " past" : "") },
          h("div", { className: "ast-dd" }, h("b", null, t.datum ? fmtDate(t.datum, lang) : "Einheit " + (ti + 1)), isToday ? h("em", null, "Heute") : null),
          h("div", { className: "ast-dc" },
            t.titel ? h("div", { className: "ast-dt" }, t.titel) : null,
            t.schritte.map(function (s, si) {
              var m = s.modul && mods[s.modul], k = ti + ":" + si, ok = !!done[k];
              return h("div", { key: si, className: "ast-step" + (ok ? " ok" : "") },
                p.saved ? h("button", { type: "button", className: "ast-cb", role: "checkbox", "aria-checked": ok, "aria-label": "Erledigt", onClick: function () { p.toggle(k); } }, ok ? h(Ic, { k: "check", s: 14, w: 3 }) : null) : null,
                h("div", { className: "ast-st" }, h("span", null, s.was), h("small", null, (s.minuten ? s.minuten + " Min." : "") + (m ? (s.minuten ? " · " : "") + modTitle(m) : ""))),
                m && p.open ? h("button", { type: "button", className: "btn ghost sm ast-go", onClick: function () { p.open(s.modul + ":i"); } }, "Öffnen") : null);
            })));
      })),
      p.actions ? h("div", { className: "ast-row" }, p.actions) : null);
  }

  function ics(plan) {
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fallpfad//Lernplan//DE", "CALSCALE:GREGORIAN"];
    var esc = function (t) { return String(t || "").replace(/[\\;,]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); };
    var stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    plan.tage.forEach(function (t, i) {
      if (!t.datum) return;
      var d = t.datum.replace(/-/g, ""), n = new Date(t.datum + "T12:00:00"); n.setDate(n.getDate() + 1);
      L.push("BEGIN:VEVENT", "UID:fallpfad-" + d + "-" + i + "@fallpfad", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + isoDay(n).replace(/-/g, ""),
        "SUMMARY:" + esc("Lernen: " + (t.titel || plan.titel || "Fallpfad")), "DESCRIPTION:" + esc(t.schritte.map(function (s) { return "- " + s.was + (s.minuten ? " (" + s.minuten + " Min.)" : ""); }).join("\n")), "END:VEVENT");
    });
    if (plan.ziel) L.push("BEGIN:VEVENT", "UID:fallpfad-pruefung@fallpfad", "DTSTAMP:" + stamp, "DTSTART;VALUE=DATE:" + plan.ziel.replace(/-/g, ""), "SUMMARY:Prüfung", "END:VEVENT");
    L.push("END:VCALENDAR");
    var a = document.createElement("a"), url = URL.createObjectURL(new Blob([L.join("\r\n")], { type: "text/calendar" }));
    a.href = url; a.download = "Fallpfad-Lernplan.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  function Klausur(p) {
    var k = p.klausur, ans = uS({}), done = uS(false), A = ans[0];
    var richtig = k.fragen.filter(function (f, i) { return A[i] === f.richtig; }).length;
    return h("div", { className: "ast-quiz" },
      h("div", { className: "ast-plan-h" }, h("span", { className: "ast-pi", style: { "--c": "#AF52DE" } }, h(Ic, { k: "exam", s: 18 })),
        h("div", null, h("b", null, k.titel || "Testklausur"), h("small", null, k.fragen.length + " Fragen · etwa " + k.minuten + " Minuten"))),
      k.fragen.map(function (f, i) {
        return h("fieldset", { key: i, className: "ast-q" },
          h("legend", null, h("span", { className: "ast-qn" }, i + 1), f.frage),
          f.optionen.map(function (o, j) {
            var cls = "ast-opt" + (A[i] === j ? " on" : "") + (done[0] ? (j === f.richtig ? " right" : A[i] === j ? " wrong" : "") : "");
            return h("label", { key: j, className: cls }, h("input", { type: "radio", name: p.id + "-" + i, checked: A[i] === j, disabled: done[0], onChange: function () { var x = Object.assign({}, A); x[i] = j; ans[1](x); } }), h("span", null, o));
          }),
          done[0] ? h("div", { className: "ast-exp" + (A[i] === f.richtig ? " ok" : "") }, h("b", null, A[i] === f.richtig ? "Richtig. " : "Nicht ganz. "), f.erklaerung) : null,
          done[0] && p.quellen ? h(p.quellen, { ids: [f.quelle] }) : null);
      }),
      h("div", { className: "ast-row" },
        !done[0] ? h("button", { type: "button", className: "btn", disabled: Object.keys(A).length < k.fragen.length, onClick: function () { done[1](true); } }, "Auswerten")
          : h(Fr, null, h("div", { className: "ast-score" }, h("b", null, richtig + " von " + k.fragen.length), h("span", null, richtig / k.fragen.length >= 0.8 ? "Sehr gut. Du bist gut vorbereitet." : richtig / k.fragen.length >= 0.5 ? "Solide. Schau dir die Erklärungen und Quellen an." : "Wiederhole die Quellen und versuch es noch einmal.")),
            h("button", { type: "button", className: "btn ghost", onClick: function () { ans[1]({}); done[1](false); } }, "Noch einmal"))),
      p.actions ? h("div", { className: "ast-row" }, p.actions) : null);
  }

  var CSS = [
    ".ast-wrap{max-width:1180px}",
    ".ast-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;margin-top:6px}",
    "@media (max-width:1060px){.ast-grid{grid-template-columns:minmax(0,1fr)}.ast-side{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}}",
    ".ast-chat{background:var(--surface);border-radius:var(--r-card,16px);display:flex;flex-direction:column;height:max(520px,calc(100vh - 205px));overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.03)}",
    "@media (max-width:959px){.ast-chat{height:auto;min-height:calc(100vh - 260px)}}",
    ".ast-log{flex:1;overflow-y:auto;padding:18px 18px 8px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth}",
    ".ast-empty{margin:auto;max-width:560px;text-align:center;padding:20px 6px}",
    ".ast-orb{width:64px;height:64px;border-radius:20px;margin:0 auto 14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--accent,#0062FF),#AF52DE);box-shadow:0 16px 36px -14px color-mix(in srgb,var(--accent,#0062FF) 70%,transparent)}",
    ".ast-empty h2{margin:0 0 6px;font-size:22px;letter-spacing:-.02em}.ast-empty p{margin:0 auto 18px;color:var(--muted);font-size:15px;line-height:1.5;max-width:460px}",
    ".ast-sugs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;text-align:left}",
    "@media (max-width:520px){.ast-sugs{grid-template-columns:1fr}}",
    ".ast-sug{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:12px;align-items:flex-start;padding:13px 14px;border-radius:14px;background:color-mix(in srgb,var(--c) 7%,var(--surface));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 16%,transparent);transition:transform .15s,box-shadow .15s}",
    ".ast-sug:hover{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--c) 40%,transparent);transform:translateY(-1px)}.ast-sug:focus-visible{outline:2px solid var(--c);outline-offset:2px}",
    ".ast-sug>span:first-child{width:34px;height:34px;flex:0 0 34px;border-radius:10px;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 14%,var(--surface))}",
    ".ast-sug b{display:block;font-size:14.5px}.ast-sug small{display:block;color:var(--muted);font-size:12.5px;margin-top:2px;line-height:1.35}",
    ".ast-msg{display:flex;gap:10px;align-items:flex-start;max-width:100%}",
    ".ast-msg.du{justify-content:flex-end}",
    ".ast-bub{background:var(--accent,#0062FF);color:var(--on-accent,#fff);padding:10px 14px;border-radius:18px 18px 6px 18px;max-width:min(560px,85%);font-size:15px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".ast-av{width:30px;height:30px;flex:0 0 30px;border-radius:10px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,var(--accent,#0062FF),#AF52DE)}",
    ".ast-ki{flex:1;min-width:0;max-width:760px;display:flex;flex-direction:column;gap:10px}",
    ".ast-md{font-size:15.5px;line-height:1.55;color:var(--fg)}.ast-md p{margin:0 0 8px}.ast-md p:last-child{margin-bottom:0}.ast-md ul,.ast-md ol{margin:4px 0 8px;padding-left:20px}.ast-md li{margin:3px 0}",
    ".ast-err{padding:10px 12px;border-radius:12px;background:var(--bad-soft,#fdecea);color:var(--bad-ink,#b00020);font-size:14px}",
    ".ast-src{display:flex;flex-direction:column;gap:6px}.ast-src-h{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:650;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}",
    ".ast-src-l{display:flex;flex-wrap:wrap;gap:6px}",
    ".ast-chip{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:5px 10px;border-radius:999px;background:var(--surface2,#f2f2f7);color:var(--fg);font:inherit;font-size:12.5px;border:0;line-height:1.3}",
    ".ast-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}.ast-chip.link{cursor:pointer;color:var(--accent)}.ast-chip.link:hover{background:color-mix(in srgb,var(--accent) 12%,var(--surface))}",
    ".ast-next{display:flex;flex-wrap:wrap;gap:6px}.ast-next button{all:unset;cursor:pointer;padding:7px 12px;border-radius:999px;font-size:13.5px;box-shadow:inset 0 0 0 1px var(--line);color:var(--fg)}.ast-next button:hover{box-shadow:inset 0 0 0 1px var(--accent);color:var(--accent)}",
    ".ast-typing{display:flex;gap:5px;padding:12px 2px}.ast-typing i{width:7px;height:7px;border-radius:50%;background:var(--muted);opacity:.5;animation:astdot 1.2s infinite}.ast-typing i:nth-child(2){animation-delay:.15s}.ast-typing i:nth-child(3){animation-delay:.3s}",
    "@keyframes astdot{0%,60%,100%{transform:none;opacity:.35}30%{transform:translateY(-4px);opacity:.9}}",
    ".ast-comp{border-top:1px solid var(--line);padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));background:var(--surface)}",
    ".ast-form{display:flex;gap:8px;align-items:flex-end;background:var(--surface2,#f2f2f7);border-radius:18px;padding:6px 6px 6px 14px}",
    ".ast-form textarea{flex:1;min-width:0;border:0;background:transparent;color:var(--fg);font:inherit;font-size:16px;line-height:1.4;resize:none;max-height:160px;padding:8px 0;outline:none}",
    ".ast-send{width:40px;height:40px;flex:0 0 40px;border-radius:50%;border:0;background:var(--accent,#0062FF);color:var(--on-accent,#fff);display:grid;place-items:center;cursor:pointer}.ast-send:disabled{opacity:.35;cursor:default}",
    ".ast-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12.5px;color:var(--muted)}",
    ".ast-dots{display:inline-flex;gap:4px;align-items:center}.ast-dots i{width:8px;height:8px;border-radius:50%;background:var(--accent)}.ast-dots i.off{background:var(--line)}",
    ".ast-tools{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.ast-tools button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;font-size:13px;background:color-mix(in srgb,var(--c) 10%,var(--surface));color:color-mix(in srgb,var(--c) 80%,var(--fg))}",
    ".ast-tools button[aria-pressed=true]{background:var(--c);color:#fff}",
    ".ast-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px;padding:12px;border-radius:14px;background:color-mix(in srgb,var(--c) 6%,var(--surface2));}",
    ".ast-mini label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted);font-weight:600}",
    ".ast-mini input,.ast-mini select{height:40px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--fg);padding:0 10px;font:inherit;font-size:15px}",
    ".ast-mini .btn{align-self:end;min-height:40px;padding:8px 16px}",
    ".ast-side{display:flex;flex-direction:column;gap:14px}",
    ".ast-card{background:var(--surface);border-radius:var(--r-card,16px);padding:16px}",
    ".ast-card h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);font-weight:650}",
    ".ast-how{display:flex;flex-direction:column;gap:12px;margin:0;padding:0;list-style:none}.ast-how li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.4}",
    ".ast-how li>span{width:28px;height:28px;flex:0 0 28px;border-radius:8px;display:grid;place-items:center;color:#fff;background:var(--c)}",
    ".ast-how b{display:block;font-size:14px}.ast-how small{color:var(--muted);font-size:12.5px}",
    ".ast-plan,.ast-quiz{border-radius:16px;box-shadow:inset 0 0 0 1px var(--line);padding:14px;display:flex;flex-direction:column;gap:12px;background:var(--surface)}",
    ".ast-plan-h{display:flex;gap:12px;align-items:center}.ast-plan-h>div{flex:1;min-width:0}.ast-plan-h b{display:block;font-size:16px;letter-spacing:-.01em}.ast-plan-h small{color:var(--muted);font-size:13px}",
    ".ast-pi{width:36px;height:36px;flex:0 0 36px;border-radius:11px;display:grid;place-items:center;color:var(--c);background:color-mix(in srgb,var(--c) 14%,var(--surface))}",
    ".ast-prog{width:90px;height:6px;border-radius:6px;background:var(--surface2);overflow:hidden}.ast-prog i{display:block;height:100%;background:#34C759;border-radius:6px}",
    ".ast-days{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0}",
    ".ast-day{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;padding:10px 0;border-top:1px solid var(--line)}",
    ".ast-day.today .ast-dd b{color:var(--accent)}.ast-day.past{opacity:.6}",
    ".ast-dd b{display:block;font-size:13.5px}.ast-dd em{font-style:normal;font-size:11px;font-weight:700;color:#fff;background:var(--accent);padding:1px 7px;border-radius:999px}",
    "@media (max-width:520px){.ast-day{grid-template-columns:1fr;gap:4px}}",
    ".ast-dt{font-weight:650;font-size:14.5px;margin-bottom:4px}",
    ".ast-step{display:flex;gap:10px;align-items:center;padding:5px 0}.ast-st{flex:1;min-width:0}.ast-st span{display:block;font-size:14.5px;line-height:1.4}.ast-st small{color:var(--muted);font-size:12.5px}",
    "@media (max-width:520px){.ast-step{flex-wrap:wrap}.ast-st{flex:1 1 190px}.ast-step>.btn{margin-left:auto}}",
    ".ast-step.ok .ast-st span{text-decoration:line-through;color:var(--muted)}",
    ".ast-cb{width:24px;height:24px;flex:0 0 24px;border-radius:50%;border:2px solid var(--line);background:transparent;display:grid;place-items:center;cursor:pointer;color:#fff;padding:0}",
    ".ast-step.ok .ast-cb{background:#34C759;border-color:#34C759}",
    ".btn.sm{min-height:34px;padding:6px 12px;font-size:13.5px;border-radius:10px}",
    ".ast-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
    ".ast-q{border:0;margin:0;padding:12px 0 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px}",
    ".ast-q legend{display:flex;gap:10px;font-weight:650;font-size:15px;line-height:1.4;padding:0;margin-bottom:6px}",
    ".ast-qn{width:24px;height:24px;flex:0 0 24px;border-radius:50%;display:grid;place-items:center;font-size:12.5px;background:var(--surface2);color:var(--muted)}",
    ".ast-opt{display:flex;gap:10px;align-items:flex-start;padding:9px 12px;border-radius:12px;background:var(--surface2);cursor:pointer;font-size:14.5px;line-height:1.4}",
    ".ast-opt input{margin-top:3px;accent-color:var(--accent)}.ast-opt.on{box-shadow:inset 0 0 0 2px var(--accent)}",
    ".ast-opt.right{background:var(--ok-soft,#e8f8ee);box-shadow:inset 0 0 0 2px var(--ok,#34C759)}.ast-opt.wrong{background:var(--bad-soft,#fdecea);box-shadow:inset 0 0 0 2px var(--bad,#FF3B30)}",
    ".ast-exp{font-size:14px;line-height:1.45;padding:8px 12px;border-radius:12px;background:var(--bad-soft,#fdecea)}.ast-exp.ok{background:var(--ok-soft,#e8f8ee)}",
    ".ast-score{display:flex;flex-direction:column;flex:1}.ast-score b{font-size:20px}.ast-score span{color:var(--muted);font-size:13.5px}",
    ".ast-note{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:14px;background:color-mix(in srgb,var(--accent) 7%,var(--surface2));font-size:13.5px;line-height:1.45;margin:0 0 4px}",
    ".ast-note{flex-wrap:wrap}.ast-note>div{flex:1 1 220px;min-width:0}",
    ".ast-note>svg{width:20px;height:20px;flex:0 0 20px;color:var(--accent);margin-top:1px}.ast-note b{display:block}.ast-note .btn{margin-left:auto;flex:0 0 auto}",
    ".ast-mplan .ast-days{max-height:300px;overflow:auto}",
    ".ast-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line)}",
    ".ast-top b{font-size:14.5px}.ast-top small{display:block;color:var(--muted);font-size:12px}",
    ".ast-ib{all:unset;cursor:pointer;width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:var(--muted)}.ast-ib:hover{background:var(--surface2);color:var(--fg)}",
    ".tab.fp-ast-tab{}",
    "@media (max-width:959px){.tabbar .tab.fp-ast-tab{display:none!important}}",
    ".iconbtn.fp-ast-top{display:none}@media (max-width:959px){.iconbtn.fp-ast-top{display:grid}}",
    ".iconbtn.fp-ast-top{color:transparent;position:relative}.iconbtn.fp-ast-top svg{color:var(--accent)}"
  ].join("\n");
  var stl = document.createElement("style"); stl.id = "fp-ast-css"; stl.textContent = CSS; (document.head || document.documentElement).appendChild(stl);

  /* ================= Speicher (nur auf dem Gerät) ================= */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function userKey() { try { return (window.FP_PROF && window.FP_PROF.email ? String(window.FP_PROF.email).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) : "lokal"); } catch (e) { return "lokal"; } }
  function lang() { try { return localStorage.getItem("fp-lang") || ""; } catch (e) { return ""; } }

  /* ================= Server ================= */
  function invoke(body) {
    if (!window.FP_SBC) return Promise.reject(new Error("Der Assistent ist hier nicht verfügbar."));
    return Promise.resolve().then(function () { return window.FP_SBC(); }).then(function (sb) {
      if (!sb || !sb.functions) throw new Error("Der Assistent braucht ein Schulkonto.");
      return sb.functions.invoke("assistent", { body: body }).then(function (r) {
        if (r.error) {
          var ctx = r.error.context;
          if (ctx && ctx.json) return ctx.json().then(function (j) { var e = new Error((j && j.error) || "Der Assistent hat gerade nicht geantwortet."); e.rest = j && j.rest; throw e; }, function () { throw new Error("Der Assistent hat gerade nicht geantwortet" + (ctx.status ? " (" + ctx.status + ")." : ".")); });
          throw new Error("Der Assistent ist gerade nicht erreichbar.");
        }
        return r.data;
      });
    });
  }

  /* Demo ohne Schulserver: zeigt die gefundenen Stellen und baut Pläne nach festen Regeln */
  function demoAntwort(text, ctx) {
    var m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/) || text.match(/(\d{4})-(\d{2})-(\d{2})/);
    var art = ctx.wunsch || (/plan|prüfung|examen/i.test(text) && m ? "plan" : /klausur|test|abfrag/i.test(text) ? "klausur" : "antwort");
    if (art === "plan") {
      var ziel = ctx.datum ? new Date(ctx.datum + "T12:00:00") : null;
      if (!ziel && m) { var y = m[3] ? Number(m[3].length === 2 ? "20" + m[3] : m[3]) : new Date().getFullYear(); ziel = m[0].indexOf("-") > 0 ? new Date(m[1] + "-" + m[2] + "-" + m[3] + "T12:00:00") : new Date(y, Number(m[2]) - 1, Number(m[1]), 12); }
      if (!ziel || isNaN(ziel)) return { art: "antwort", text: "Wann ist deine Prüfung? Nenne mir das Datum, dann plane ich bis dahin.", quellen: [], vorschlaege: [] };
      var mods = ctx.module.filter(function (x) { return x.jahr && x.jahr <= (ctx.jahr || 3); }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 14), tage = [], d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12);
      var i = 0;
      while (d < ziel && tage.length < 60) {
        if (d.getDay() !== 0) {
          var mm = mods[i % Math.max(1, mods.length)];
          if (mm) tage.push({ datum: isoDay(d), titel: i < mods.length ? "Neu lernen" : "Wiederholen", schritte: [{ modul: mm.id, was: (i < mods.length ? "Bearbeite " : "Wiederhole ") + mm.titel.replace(/^Modul \d+ · /, ""), minuten: mm.pct < 50 ? 60 : 30 }] });
          i++;
        }
        d.setDate(d.getDate() + 1);
      }
      return { art: "plan", text: "**Beispiel aus der Demo:** Ohne Schulserver plant Fallpfad nach festen Regeln. Module mit wenig Fortschritt kommen zuerst, sonntags ist frei, die letzten Tage sind zum Wiederholen.", quellen: [], plan: { titel: "Lernplan bis zur Prüfung", ziel: isoDay(ziel), tage: tage }, vorschlaege: ["Erstelle mir eine Testklausur", "Was sollte ich wiederholen?"] };
    }
    if (art === "klausur" && ctx.quellen.length) {
      var fr = [];
      var mset = {}; ctx.quellen.forEach(function (x) { if (x.mod) mset[x.mod] = 1; });
      (window.FP_DATA.mods || []).forEach(function (mo) { if (!mset[mo.id]) return; (mo.chapters || []).forEach(function (c, ci) { (c.blocks || []).forEach(function (b) { if (b.type === "quiz") (b.questions || []).forEach(function (q) { fr.push({ q: q, id: mo.id + ":" + ci, mod: mo.id }); }); }); }); });
      var hit = fr.slice(0, 8);
      if (hit.length) return { art: "klausur", text: "**Beispiel aus der Demo:** Diese Fragen stammen aus den passenden Stationen in Fallpfad.", quellen: [], klausur: { titel: "Testklausur", minuten: hit.length * 2, fragen: hit.map(function (x) { var src = ctx.quellen.filter(function (s) { return s.id.indexOf(x.id + ":") === 0; })[0] || ctx.quellen.filter(function (s) { return s.mod === x.mod; })[0]; return { frage: x.q.q, optionen: x.q.o, richtig: x.q.a, erklaerung: x.q.e || "", quelle: src ? src.id : ctx.quellen[0].id }; }) }, vorschlaege: [] };
    }
    return { art: "antwort", text: ctx.quellen.length ? "**Demo ohne KI:** Im Demo-Konto ist der Assistent nicht mit dem Schulserver verbunden. Diese Stellen in Fallpfad passen zu deiner Frage:\n" + ctx.quellen.slice(0, 4).map(function (q) { return "- **" + q.titel + "**"; }).join("\n") : "**Demo ohne KI:** Dazu habe ich in Fallpfad nichts gefunden. Versuch es mit einem Fachbegriff, zum Beispiel „Dekubitusprophylaxe“.", quellen: ctx.quellen.slice(0, 4).map(function (q) { return q.id; }), vorschlaege: ["Erstelle mir einen Prüfungsplan", "Erstelle mir eine Testklausur zu Diabetes"] };
  }

  /* ================= Seite ================= */
  var SUGS = [
    { k: "plan", ic: "cal", c: "#0A84FF", t: "Prüfungsplan erstellen", d: "Lernplan bis zum Prüfungstag mit deinen Modulen" },
    { k: "klausur", ic: "exam", c: "#AF52DE", t: "Testklausur üben", d: "Fragen zu einem Thema mit Auswertung" },
    { k: "erklaer", ic: "bulb", c: "#FF9500", t: "Etwas erklären lassen", d: "z. B. „Was ist der Unterschied zwischen Typ 1 und 2?“" },
    { k: "wdh", ic: "rep", c: "#34C759", t: "Was soll ich wiederholen?", d: "Vorschläge nach deinem Fortschritt" }
  ];

  function Assistent(p) {
    var S = p.S || {}, jahr = S.year || 2, ukey = userKey();
    var chat = uS(function () { return lsGet("fp-ast-chat-" + ukey, []); }), msgs = chat[0];
    var txt = uS(""), busy = uS(false), rest = uS(null), limit = uS(3), tool = uS(null), form = uS({ datum: "", art: "schriftlich", thema: "" });
    var saved = uS(function () { return lsGet("fp-ast-plan-" + ukey, null); });
    var hinweis = uS(function () { return !lsGet("fp-ast-ok", false); });
    var l = uS(lang()), logRef = uR(null), taRef = uR(null);
    var demo = !!window.FP_DEMO_ACC;
    uE(function () { function f() { l[1](lang()); } window.addEventListener("fp-lang", f); return function () { window.removeEventListener("fp-lang", f); }; }, []);
    uE(function () { lsSet("fp-ast-chat-" + ukey, msgs.slice(-40)); var el = logRef.current; if (el && (msgs.length || busy[0])) setTimeout(function () { el.scrollTop = el.scrollHeight; }, 30); }, [msgs.length, busy[0]]);
    uE(function () {
      if (demo) { rest[1](3); return; }
      invoke({ status: true }).then(function (r) { if (r && r.rest != null) { rest[1](r.rest); limit[1](r.limit || 3); } }, function () {});
      setTimeout(index, 50);
    }, []);
    function set(m) { chat[1](m); }
    function send(text, extra) {
      text = String(text || "").trim();
      if (!text || busy[0]) return;
      if (rest[0] === 0) return;
      extra = extra || {};
      var I = index(), mods = modulListe(S), q = text + " " + (extra.thema || "");
      var quellen;
      if (extra.wunsch === "plan") {
        var mine = mods.filter(function (m) { return m.jahr && m.jahr <= jahr; }).sort(function (a, b) { return a.pct - b.pct; }).slice(0, 10).map(function (m) { return m.id + ":i"; });
        quellen = I.docs.filter(function (d) { return mine.indexOf(d.id) >= 0; });
      } else quellen = I.search(q, extra.wunsch === "klausur" ? 10 : 8, { proGruppe: extra.wunsch === "klausur" ? 4 : 3 });
      var verlauf = msgs.slice(-6).map(function (m) { return { r: m.r, t: m.r === "ki" ? (m.a && m.a.text) || "" : m.t }; });
      var mine2 = msgs.concat([{ r: "du", t: text, at: Date.now() }]);
      set(mine2); txt[1](""); busy[1](true); tool[1](null);
      var body = {
        nachricht: text + (extra.datum ? "\n(Prüfungsdatum: " + extra.datum + ", Art: " + (extra.art || "") + ")" : "") + (extra.wunsch === "klausur" ? "\n(Bitte eine Testklausur erstellen.)" : extra.wunsch === "plan" ? "\n(Bitte einen Lernplan erstellen.)" : ""),
        verlauf: verlauf, lang: l[0] || "de", jahr: jahr, heute: isoDay(new Date()),
        module: mods.map(function (m) { return { id: m.id, titel: m.titel, jahr: m.jahr, pct: m.pct, stationen: m.stationen }; }),
        quellen: quellen.map(function (d) { return { id: d.id, titel: d.titel, text: d.text.slice(0, 1700) }; })
      };
      var pr = demo ? new Promise(function (ok) { setTimeout(function () { ok({ antwort: demoAntwort(text, { wunsch: extra.wunsch, datum: extra.datum, module: mods, jahr: jahr, quellen: quellen }), rest: 3 }); }, 900); }) : invoke(body);
      pr.then(function (r) {
        set(mine2.concat([{ r: "ki", a: r.antwort, at: Date.now() }]));
        if (r.rest != null) rest[1](r.rest); if (r.limit) limit[1](r.limit);
      }, function (e) {
        set(mine2.concat([{ r: "ki", err: e.message || "Das hat nicht geklappt.", at: Date.now() }]));
        if (e.rest === 0) rest[1](0);
      }).then(function () { busy[1](false); });
    }
    function savePlan(plan) { var v = { plan: plan, done: {}, at: Date.now() }; lsSet("fp-ast-plan-" + ukey, v); saved[1](v); }
    function toggle(k) { var v = Object.assign({}, saved[0]); v.done = Object.assign({}, v.done); v.done[k] = !v.done[k]; lsSet("fp-ast-plan-" + ukey, v); saved[1](v); }
    function startTool(k) {
      if (k === "erklaer") { tool[1](null); txt[1]("Erklär mir bitte "); setTimeout(function () { if (taRef.current) { taRef.current.focus(); taRef.current.setSelectionRange(99, 99); } }, 30); return; }
      if (k === "wdh") return send("Was sollte ich nach meinem Fortschritt als Nächstes wiederholen?", { wunsch: "wdh" });
      tool[1](tool[0] === k ? null : k);
    }
    var leer = !msgs.length;
    var restTxt = "";
    var QW = function (pp) { return h(Quellen, Object.assign({ open: openQuelle }, pp)); };

    var miniForm = tool[0] === "plan" ? h("form", { className: "ast-mini", style: { "--c": "#0A84FF" }, onSubmit: function (e) { e.preventDefault(); if (!form[0].datum) return; var d = form[0].datum.split("-"); send("Ich habe am " + d[2] + "." + d[1] + "." + d[0] + " meine " + form[0].art + "e Prüfung. Bitte erstelle mir einen Prüfungsplan.", { wunsch: "plan", datum: form[0].datum, art: form[0].art }); } },
        h("label", null, "Prüfungstag", h("input", { type: "date", required: true, min: isoDay(new Date(Date.now() + 864e5 * 2)), value: form[0].datum, onChange: function (e) { form[1](Object.assign({}, form[0], { datum: e.target.value })); } })),
        h("label", null, "Prüfung", h("select", { value: form[0].art, onChange: function (e) { form[1](Object.assign({}, form[0], { art: e.target.value })); } }, ["schriftlich", "mündlich", "praktisch"].map(function (x) { return h("option", { key: x, value: x }, x.charAt(0).toUpperCase() + x.slice(1)); }))),
        h("button", { className: "btn", type: "submit", disabled: !form[0].datum || busy[0] || rest[0] === 0 }, "Plan erstellen"))
      : tool[0] === "klausur" ? h("form", { className: "ast-mini", style: { "--c": "#AF52DE" }, onSubmit: function (e) { e.preventDefault(); var t = form[0].thema.trim(); if (!t) return; send("Erstelle mir eine Testklausur zum Thema " + t + ".", { wunsch: "klausur", thema: t }); } },
        h("label", { style: { gridColumn: "span 2" } }, "Thema", h("input", { type: "text", placeholder: "z. B. Diabetes, Sturz, Wunde", value: form[0].thema, onChange: function (e) { form[1](Object.assign({}, form[0], { thema: e.target.value })); } })),
        h("button", { className: "btn", type: "submit", disabled: !form[0].thema.trim() || busy[0] || rest[0] === 0 }, "Klausur erstellen")) : null;

    var log = h("div", { className: "ast-log", ref: logRef, "aria-live": "polite" },
      hinweis[0] ? h("div", { className: "ast-note" }, h(Ic, { k: "shield", s: 18 }), h("div", null, h("b", null, "Bevor du startest"), "Der Assistent antwortet nur mit Inhalten aus Fallpfad. Deine Nachricht und passende Abschnitte aus der App gehen dafür an einen KI-Dienst (OpenAI). Schreib keine Namen oder Daten echter Patientinnen und Patienten hinein. Der Chat bleibt auf diesem Gerät."), h("button", { type: "button", className: "btn ghost sm", onClick: function () { lsSet("fp-ast-ok", true); hinweis[1](false); } }, "Verstanden")) : null,
      leer ? h("div", { className: "ast-empty" },
        h("div", { className: "ast-orb" }, h(Ic, { k: "spark", s: 30 })),
        h("h2", null, "Wobei kann ich helfen?"),
        h("p", null, "Ich plane, erkläre und frage dich ab. Dabei nutze ich nur die Inhalte von Fallpfad und zeige dir, wo du alles nachlesen kannst."),
        h("div", { className: "ast-sugs" }, SUGS.map(function (s) { return h("button", { key: s.k, type: "button", className: "ast-sug", style: { "--c": s.c }, onClick: function () { startTool(s.k); } }, h("span", null, h(Ic, { k: s.ic, s: 18 })), h("span", null, h("b", null, s.t), h("small", null, s.d))); }))) : null,
      msgs.map(function (m, i) {
        if (m.r === "du") return h("div", { key: i, className: "ast-msg du" }, h("div", { className: "ast-bub", "data-notr": "1" }, m.t));
        var a = m.a || {};
        return h("div", { key: i, className: "ast-msg" }, h("span", { className: "ast-av" }, h(Ic, { k: "spark", s: 16 })),
          h("div", { className: "ast-ki" },
            m.err ? h("div", { className: "ast-err" }, m.err) : h("div", { "data-notr": l[0] ? "1" : null }, h(Md, { text: a.text })),
            a.plan ? h(Plan, { plan: a.plan, lang: l[0], open: openQuelle, actions: [h("button", { key: "s", type: "button", className: "btn sm", onClick: function () { savePlan(a.plan); } }, saved[0] && saved[0].plan === a.plan ? "Gespeichert" : "Als meinen Plan speichern"), h("button", { key: "i", type: "button", className: "btn ghost sm", onClick: function () { ics(a.plan); } }, h(Ic, { k: "dl", s: 15 }), "Kalenderdatei")] }) : null,
            a.klausur ? h(Klausur, { klausur: a.klausur, id: "k" + i, quellen: QW }) : null,
            a.quellen && a.quellen.length ? h(QW, { ids: a.quellen }) : null,
            a.vorschlaege && a.vorschlaege.length && i === msgs.length - 1 && !busy[0] ? h("div", { className: "ast-next" }, a.vorschlaege.map(function (v, j) { return h("button", { key: j, type: "button", onClick: function () { send(v); } }, v); })) : null));
      }),
      busy[0] ? h("div", { className: "ast-msg" }, h("span", { className: "ast-av" }, h(Ic, { k: "spark", s: 16 })), h("div", { className: "ast-typing", "aria-label": "Assistent schreibt" }, h("i"), h("i"), h("i"))) : null);

    var comp = h("div", { className: "ast-comp" },
      !leer ? h("div", { className: "ast-tools" }, SUGS.slice(0, 2).map(function (s) { return h("button", { key: s.k, type: "button", style: { "--c": s.c }, "aria-pressed": tool[0] === s.k, onClick: function () { startTool(s.k); } }, h(Ic, { k: s.ic, s: 14 }), s.t); })) : null,
      miniForm,
      h("form", { className: "ast-form", onSubmit: function (e) { e.preventDefault(); send(txt[0]); } },
        h("textarea", { ref: taRef, rows: 1, value: txt[0], maxLength: 2000, "aria-label": "Nachricht an den Assistenten", placeholder: rest[0] === 0 ? "Morgen geht es weiter" : "Frag mich etwas zu Fallpfad …", disabled: rest[0] === 0,
          onChange: function (e) { txt[1](e.target.value); var t = e.target; t.style.height = "auto"; t.style.height = Math.min(160, t.scrollHeight) + "px"; },
          onKeyDown: function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(txt[0]); } } }),
        h("button", { type: "submit", className: "ast-send", "aria-label": "Senden", disabled: !txt[0].trim() || busy[0] || rest[0] === 0 }, h(Ic, { k: "send", s: 18, w: 2.4 }))),
      h("div", { className: "ast-meta" },
        h("span", { className: "ast-dots", "aria-label": restTxt }, Array.from({ length: limit[0] }).map(function (_, i) { return h("i", { key: i, className: rest[0] != null && i >= rest[0] ? "off" : "" }); }), h("span", { style: { marginLeft: 6 } }, restTxt)),
        h("span", null, l[0] && window.FP_LS ? "Antwortet auf " + window.FP_LS.label() : "Nur Inhalte aus Fallpfad")));

    var sv = saved[0];
    var side = h("aside", { className: "ast-side" },
      sv && sv.plan ? h("section", { className: "ast-card ast-mplan" }, h("h3", null, "Mein Lernplan"),
        h(Plan, { plan: sv.plan, lang: l[0], saved: true, done: sv.done, toggle: toggle, open: openQuelle, actions: [h("button", { key: "d", type: "button", className: "btn ghost sm", onClick: function () { ics(sv.plan); } }, h(Ic, { k: "dl", s: 15 }), "Kalender"), h("button", { key: "x", type: "button", className: "btn ghost sm", onClick: function () { lsSet("fp-ast-plan-" + ukey, null); saved[1](null); } }, h(Ic, { k: "trash", s: 15 }), "Entfernen")] })) : null,
      h("section", { className: "ast-card" }, h("h3", null, "So arbeitet der Assistent"),
        h("ul", { className: "ast-how" },
          h("li", null, h("span", { style: { "--c": "#34C759" } }, h(Ic, { k: "shield", s: 15 })), h("div", null, h("b", null, "Nur Fallpfad-Inhalte"), h("small", null, "Kein Internet. Was nicht in der App steht, sagt er offen."))),
          h("li", null, h("span", { style: { "--c": "#0A84FF" } }, h(Ic, { k: "book", s: 15 })), h("div", null, h("b", null, "Mit Quellen"), h("small", null, "Zu jeder Antwort siehst du die Stationen zum Nachlesen."))),
          h("li", null, h("span", { style: { "--c": "#AF52DE" } }, h(Ic, { k: "globe", s: 15 })), h("div", null, h("b", null, "In deiner Sprache"), h("small", null, "Antwortet in der Sprache, die du unter Meine Sprache wählst."))))),
      msgs.length ? h("button", { type: "button", className: "btn ghost sm", style: { alignSelf: "flex-start" }, onClick: function () { set([]); } }, h(Ic, { k: "trash", s: 15 }), "Chat leeren") : null);

    return h("div", { className: "wrap ast-wrap" },
      h("div", { className: "hello" }, h("div", { className: "eyebrow" }, "KI-Assistent"), h("h1", null, "Assistent"), h("p", null, "Plant deine Prüfungsvorbereitung, erklärt und fragt ab, nur mit den Inhalten von Fallpfad.")),
      h("div", { className: "ast-grid" }, h("section", { className: "ast-chat", "aria-label": "Chat mit dem Assistenten" }, log, comp), side));
  }

  window.FP_Assistent = Assistent;
  window.FP_AST_CORE = { makeIndex: makeIndex, toks: toks, plain: plain, blockText: blockText, modTitle: modTitle, Md: Md, Plan: Plan, Klausur: Klausur, Quellen: Quellen, Ic: Ic, ics: ics, isoDay: isoDay, appDocs: appDocs };
})();

/* Lehrer-Portal: Live-Unterricht. Live-Stunden aus Bausteinen bauen, Module live an der Tafel zeigen,
   Präsentationsmodus mit QR-Code. Die Lernenden sehen immer nur den Schritt, den die Lehrkraft freigibt. */
(function () {
  function pl(n, a, b) { return n + " " + (n === 1 ? a : b); }
  var R = window.React, RD = window.ReactDOM;
  if (!R || !RD) return;
  var h = R.createElement, useState = R.useState, useEffect = R.useEffect, useMemo = R.useMemo, useRef = R.useRef;
  var DEMO = function () { return !window.FP_SB; };
  var esc = function (t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var rid = function () { return Math.random().toString(36).slice(2, 9); };
  var I = {
    folie: "M4 5h16v11H4zM9 20h6M12 16v4", fall: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5", frage: "M5 6h14M5 12h10M5 18h6",
    peer: "M8 8a3 3 0 1 1 0 .1M16 8a3 3 0 1 1 0 .1M3 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5M11 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5", tf: "M5 12.5 10 17l9-10",
    schaetz: "M4 18h16M7 18V9M12 18V5M17 18v-6", wort: "M4 7h9M4 12h16M4 17h11", ampel: "M9 3h6v18H9zM12 7h.01M12 12h.01M12 17h.01", skala: "M3 12h18M6 9v6M12 9v6M18 9v6",
    reihe: "M9 6h11M9 12h11M9 18h11M4 5.5l1-.5v3M4 11h2l-2 2h2M4 17h2v2H4", fehler: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM16 16l5 5", play: "M8 5.5v13l10.5-6.5z", plus: "M12 5v14M5 12h14",
    up: "M12 19V5M6 11l6-6 6 6", down: "M12 5v14M6 13l6 6 6-6", x: "M6 6l12 12M18 6 6 18", trash: "M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13", edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
    left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6", eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z", book: "M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM5 16.5a3 3 0 0 1 3-3h11", stop: "M7 7h10v10H7z", spark: "M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z", copy: "M8 8h11v11H8zM5 16V5h11",
    sicher: "M12 3l7 3v5c0 4.5-3 8.2-7 9.5C8 19.2 5 15.5 5 11V6zM9 12l2 2 4-4", koerper: "M12 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7 9.5h10l-1.5 6H14l-.8 6h-2.4l-.8-6H8.5z", sortier: "M4 4h6v7H4zM14 4h6v7h-6zM4 15h6v5H4zM14 15h6v5h-6z",
    hinweis: "M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9c-.6.5-1 1.1-1 1.9V16h-5v-.2c0-.8-.4-1.4-1-1.9A6 6 0 0 1 12 3z", rolle: "M3 5h11v8H7l-4 3zM10 16h7l4 3v-9h-4", pfad: "M6 20V4M6 14c0-4 4-6 10-6M13 5l3 3-3 3"
  };
  function Ic(p) { return h("svg", { viewBox: "0 0 24 24", width: p.s || 20, height: p.s || 20, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, h("path", { d: I[p.n] || I.spark })); }
  var TYPES = {
    folie: { t: "Folie", d: "Inhalt an der Tafel zeigen und erklären. Lernende sehen ihn mit.", c: "#64748B" },
    fall: { t: "Fallsituation", d: "Eine Situation mit Person und Befunden, die Klasse entscheidet. Ohne Vitalzeichen-Monitor.", c: "#E11D48" },
    frage: { t: "Abstimmung", d: "Frage mit Antworten, die Verteilung erscheint vorne. Eine oder mehrere richtig.", c: "#0062FF" },
    peer: { t: "Peer Instruction", d: "Erst allein abstimmen, dann zu zweit diskutieren, dann nochmal. Vorher und nachher im Vergleich.", c: "#7C3AED" },
    tf: { t: "Richtig-oder-Falsch-Blitz", d: "Schnelle Aussagen nacheinander. Ideal zum Aufwärmen und für Mythen.", c: "#0D9488" },
    schaetz: { t: "Schätzfrage", d: "Zahl schätzen, vorne erscheint die Verteilung mit dem richtigen Wert.", c: "#D97706" },
    wort: { t: "Wortwolke", d: "Stichworte sammeln. Häufige Begriffe werden größer. Gut zum Einstieg.", c: "#DB2777" },
    ampel: { t: "Ampel-Check", d: "Wie sicher fühlt ihr euch? Grün, gelb, rot. Zeigt, ob du wiederholen solltest.", c: "#059669" },
    skala: { t: "Meinungslinie", d: "Zustimmung von „voll“ bis „gar nicht“. Startet Diskussionen zu ethischen Fragen.", c: "#4F46E5" },
    reihe: { t: "Reihenfolge", d: "Schritte in die richtige Reihenfolge bringen, z. B. Handlungsabläufe.", c: "#0891B2" },
    fehler: { t: "Fehlerjagd", d: "Eine Übergabe oder Dokumentation mit versteckten Fehlern. Die Klasse markiert sie.", c: "#EA580C" },
    sicher: { t: "Sicher oder geraten?", d: "Antwort plus Sicherheit. Vorne erscheint eine Matrix, die gefährliche Fehlvorstellungen („sicher, aber falsch“) sichtbar macht.", c: "#0F766E", neu: 1 },
    koerper: { t: "Körperkarte", d: "Die Klasse tippt Stellen auf einer Körpersilhouette an, vorne entsteht eine Heatmap. Für Dekubitus, Injektionen, Schmerzorte, Ödeme.", c: "#BE185D", neu: 1 },
    sortier: { t: "Live-Zuordnung", d: "Begriffe in 2 bis 4 Kategorien sortieren. Vorne siehst du pro Begriff, wo die Klasse unsicher ist.", c: "#9333EA", neu: 1 },
    hinweis: { t: "Hinweis für Hinweis", d: "Ein Fall wird Stück für Stück aufgedeckt. Die Klasse legt sich früh fest und darf umdenken. Trainiert klinisches Urteilen.", c: "#B45309", neu: 1 },
    rolle: { t: "Perspektivwechsel", d: "Jedes Handy bekommt zufällig eine Rolle (z. B. Patient, Tochter, Pflegekraft) und antwortet aus dieser Sicht. Vorne erscheinen die Perspektiven nebeneinander.", c: "#2563EB", neu: 1 },
    pfad: { t: "Klassenentscheid", d: "Ein verzweigter Fall: Die Mehrheit entscheidet, wie es weitergeht. Die Klasse erlebt die Folgen ihrer Entscheidung.", c: "#DC2626", neu: 1 }
  };
  var ORDER = ["folie", "fall", "frage", "peer", "tf", "schaetz", "wort", "ampel", "skala", "reihe", "fehler", "sicher", "koerper", "sortier", "hinweis", "rolle", "pfad"];
  var NCOL = ["#0062FF", "#EA580C", "#0D9488", "#9333EA"];
  /* Klassenentscheid: Text -> Knoten. "# Situation", "? Frage", "* empfohlene Option -> 2 | Folge", "- Option -> Ende | Folge" */
  function parseGraph(txt) {
    var nodes = [], cur = null;
    String(txt || "").split("\n").forEach(function (raw) {
      var l = raw.trim(); if (!l) return;
      if (/^#/.test(l)) { cur = { sit: l.replace(/^#+\s*(\d+[.:)]?\s*)?/, ""), q: "", opts: [] }; nodes.push(cur); return; }
      if (!cur) { cur = { sit: "", q: "", opts: [] }; nodes.push(cur); }
      if (/^\?/.test(l)) { cur.q = l.replace(/^\?\s*/, ""); return; }
      var m = /^([*\-])\s*(.+)$/.exec(l);
      if (m) {
        var rest = m[2], c = "", to = null, bar = rest.indexOf("|");
        if (bar >= 0) { c = rest.slice(bar + 1).trim(); rest = rest.slice(0, bar); }
        var ar = /->\s*(\S+)\s*$/.exec(rest);
        if (ar) { to = /^\d+$/.test(ar[1]) ? Number(ar[1]) : 0; rest = rest.slice(0, ar.index); }
        if (cur.opts.length < 5) cur.opts.push({ t: rest.trim(), ok: m[1] === "*", to: to, c: c });
        return;
      }
      cur.sit += (cur.sit ? " " : "") + l;
    });
    return nodes.filter(function (n) { return n.sit || n.opts.length; }).slice(0, 12);
  }
  function sortAns(b) {
    var cats = (b.cats || []).slice(0, 4);
    return { cats: cats, items: (b.items || []).slice(0, 8).map(function (it) { return typeof it === "string" ? { t: it, k: "" } : it; }) };
  }

  /* ---------- Lektion -> Schritte ---------- */
  function seeded(n, seed) {
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    var s = seed || 7;
    for (var j = a.length - 1; j > 0; j--) { s = (s * 9301 + 49297) % 233280; var k = Math.floor(s / 233280 * (j + 1)); var t = a[j]; a[j] = a[k]; a[k] = t; }
    if (n > 1 && a.every(function (x, i) { return x === i; })) a.push(a.shift());
    return a;
  }
  function optsOf(b) { return (b.opts || []).map(function (o) { return typeof o === "string" ? { t: o.replace(/^\*\s*/, ""), ok: /^\*/.test(o) } : o; }).filter(function (o) { return o.t; }); }
  function stepsOf(L) {
    var out = [];
    (L.blocks || []).forEach(function (b, bi) {
      var o = optsOf(b);
      var ok = o.map(function (x, i) { return x.ok ? i : -1; }).filter(function (i) { return i >= 0; });
      switch (b.type) {
        case "folie": out.push({ kind: "info", type: b.type, titel: b.titel, html: b.text, img: b.bild }); break;
        case "fall": out.push({ kind: "choice", type: b.type, titel: b.titel || "Fallsituation", person: b.person ? { name: b.person, info: b.info } : null, sit: b.sit, rows: b.befunde, q: b.q, opts: o.map(function (x) { return x.t; }), ok: ok, multi: !!b.multi || ok.length > 1, exp: b.exp, demo: b.demo }); break;
        case "frage": out.push({ kind: "choice", type: b.type, titel: b.titel, q: b.q, opts: o.map(function (x) { return x.t; }), ok: ok, multi: !!b.multi || ok.length > 1, exp: b.exp }); break;
        case "peer":
          out.push({ kind: "choice", type: b.type, peer: 1, titel: "Peer Instruction · Runde 1: allein", q: b.q, opts: o.map(function (x) { return x.t; }), ok: ok, multi: false, survey: true });
          out.push({ kind: "choice", type: b.type, peer: 2, titel: "Peer Instruction · Runde 2: nach der Diskussion", q: b.q, opts: o.map(function (x) { return x.t; }), ok: ok, multi: false, exp: b.exp, ref: out.length - 1 });
          break;
        case "tf": (b.items || []).forEach(function (it) { out.push({ kind: "choice", type: b.type, titel: b.titel || "Richtig oder falsch?", q: it.t, opts: ["Richtig", "Falsch"], ok: [it.ok ? 0 : 1], exp: it.e, colors: ["#10B981", "#EF4444"] }); }); break;
        case "schaetz": out.push({ kind: "estimate", type: b.type, titel: b.titel || "Schätzfrage", q: b.q, ans: Number(b.ans), unit: b.unit, min: b.min === "" ? undefined : Number(b.min), max: b.max === "" ? undefined : Number(b.max), exp: b.exp }); break;
        case "wort": out.push({ kind: "word", type: b.type, titel: b.titel || "Wortwolke", q: b.q, hint: b.hint, demo: b.demo }); break;
        case "ampel": out.push({ kind: "scale", type: b.type, titel: "Ampel-Check", q: b.q || "Wie sicher fühlst du dich jetzt?", opts: ["Sicher", "Teilweise", "Unsicher"], colors: ["#10B981", "#F59E0B", "#EF4444"], survey: true }); break;
        case "skala": out.push({ kind: "scale", type: b.type, titel: "Meinungslinie", q: b.q, opts: [b.links || "Stimme voll zu", "Eher ja", "Unentschieden", "Eher nein", b.rechts || "Stimme gar nicht zu"], colors: ["#0D9488", "#5EB5A9", "#94A3B8", "#E8A87C", "#EA580C"], survey: true }); break;
        case "reihe":
          var items = (b.items || []).filter(Boolean).slice(0, 8), mix = seeded(items.length, bi + 3);
          out.push({ kind: "order", type: b.type, titel: b.titel || "Reihenfolge", q: b.q, items: mix.map(function (i) { return items[i]; }), order: items.map(function (_, i) { return mix.indexOf(i); }), exp: b.exp });
          break;
        case "fehler":
          var ls = (b.lines || []).slice(0, 10);
          out.push({ kind: "lines", type: b.type, titel: b.titel || "Fehlerjagd", q: b.q || "Wo stecken die Fehler?", opts: ls.map(function (l) { return l.t; }), ok: ls.map(function (l, i) { return l.err ? i : -1; }).filter(function (i) { return i >= 0; }), lineExp: ls.map(function (l) { return l.err ? l.e || "" : null; }), multi: true, exp: b.exp });
          break;
        case "sicher": var o6 = o.slice(0, 6); out.push({ kind: "conf", type: b.type, titel: b.titel || "Sicher oder geraten?", sit: b.sit, q: b.q, opts: o6.map(function (x) { return x.t; }), ok: o6.map(function (x, i) { return x.ok ? i : -1; }).filter(function (i) { return i >= 0; }).slice(0, 1), exp: b.exp }); break;
        case "koerper": out.push({ kind: "body", type: b.type, titel: b.titel || "Körperkarte", sit: b.sit, q: b.q, fig: b.fig === "vorne" ? "vorne" : "hinten", zones: (b.zones || []).slice(), taps: Number(b.taps) === 1 ? 1 : 2, exp: b.exp }); break;
        case "sortier": var sa = sortAns(b); out.push({ kind: "sort", type: b.type, titel: b.titel || "Live-Zuordnung", q: b.q, cats: sa.cats, items: sa.items.map(function (x) { return x.t; }), ans: sa.items.map(function (x) { var k = sa.cats.findIndex(function (c) { return c.toLowerCase() === String(x.k || "").toLowerCase(); }); return k; }), colors: NCOL, exp: b.exp }); break;
        case "hinweis": var o5 = o.slice(0, 5); out.push({ kind: "clue", type: b.type, titel: b.titel || "Hinweis für Hinweis", person: b.person ? { name: b.person, info: b.info } : null, q: b.q || "Was vermutest du?", opts: o5.map(function (x) { return x.t; }), ok: o5.map(function (x, i) { return x.ok ? i : -1; }).filter(function (i) { return i >= 0; }).slice(0, 1), clues: (b.clues || []).slice(0, 5), exp: b.exp }); break;
        case "rolle": out.push({ kind: "role", type: b.type, titel: b.titel || "Perspektivwechsel", sit: b.sit, roles: (b.roles || []).slice(0, 4), q: b.q || "Was denkst und fühlst du in dieser Situation?", exp: b.exp }); break;
        case "pfad":
          var nodes = parseGraph(b.graph), base = out.length, after = base + nodes.length;
          nodes.forEach(function (n, ni) {
            var tgt = function (to) { return to && to >= 1 && to <= nodes.length && to - 1 !== ni ? base + to - 1 : after; };
            if (!n.opts.length) out.push({ kind: "info", type: "pfad", titel: b.titel || "Klassenentscheid", html: n.sit, after: after });
            else out.push({ kind: "choice", type: "pfad", titel: b.titel || "Klassenentscheid", sit: n.sit, q: n.q || "Wie entscheidet ihr?", opts: n.opts.map(function (x) { return x.t; }), ok: n.opts.map(function (x, i) { return x.ok ? i : -1; }).filter(function (i) { return i >= 0; }), cons: n.opts.map(function (x) { return x.c; }), jumps: n.opts.map(function (x) { return tgt(x.to); }), pfad: true });
          });
          break;
      }
    });
    return out;
  }
  /* ---------- Modul -> Schritte ---------- */
  var strip = function (x) { return String(x || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); };
  function stepsOfModule(m, chs) {
    var out = [], chars = window.FP_CHARS || {};
    out.push({ kind: "info", type: "folie", titel: m.title, html: (m.subtitle ? "<p><b>" + esc(m.subtitle) + "</b></p>" : "") + (m.intro || "") });
    (m.chapters || []).forEach(function (c, ci) {
      if (chs && chs.indexOf(ci) < 0) return;
      out.push({ kind: "info", type: "folie", titel: "Station " + (ci + 1) + ": " + c.title, html: (c.time || c.place ? "<p>" + esc([c.time, c.place].filter(Boolean).join(" · ")) + "</p>" : "") + (c.goal ? "<p><b>Ziel:</b> " + esc(c.goal) + "</p>" : "") });
      (c.blocks || []).forEach(function (b) {
        var who = b.who && chars[b.who] ? chars[b.who].name : b.name || "";
        switch (b.type) {
          case "scene": out.push({ kind: "info", type: "folie", titel: who || "Szene", html: b.html, speaker: b.who }); break;
          case "knowledge": case "challenge": out.push({ kind: "info", type: "folie", titel: b.title || (b.type === "challenge" ? "Herausforderung" : "Wissen"), html: b.html }); break;
          case "merke": out.push({ kind: "info", type: "folie", titel: "Merke", html: b.html }); break;
          case "case": out.push({ kind: "info", type: "folie", titel: b.title || "Fallvignette", html: b.html, rows: b.rows }); break;
          case "bild": if (b.src) out.push({ kind: "info", type: "folie", titel: strip(b.caption) || "Bild", img: b.src }); break;
          case "quiz": (b.questions || []).forEach(function (q) { out.push({ kind: "choice", type: "frage", titel: b.title || "Quiz", q: q.q, opts: q.o, ok: [q.a], exp: q.e }); }); break;
          case "task": if ((b.kind === "choice" || b.kind === "multi") && b.options) { var okk = b.options.map(function (o, i) { return o.correct ? i : -1; }).filter(function (i) { return i >= 0; }); out.push({ kind: "choice", type: "frage", titel: "Aufgabe", q: strip(b.question), opts: b.options.map(function (o) { return strip(o.text); }), ok: okk, multi: b.kind === "multi" || okk.length > 1, exp: strip((b.options.find(function (o) { return o.correct; }) || {}).feedback) }); } break;
          case "mythos": (b.items || []).forEach(function (it) { out.push({ kind: "choice", type: "tf", titel: "Mythos oder Fakt?", q: it.t, opts: ["Richtig", "Falsch"], ok: [it.ok ? 0 : 1], exp: it.e, colors: ["#10B981", "#EF4444"] }); }); break;
          case "schaetz": out.push({ kind: "estimate", type: "schaetz", titel: "Schätzfrage", q: b.q, ans: b.ans, unit: b.unit, min: b.min, max: b.max, exp: b.fb }); break;
          case "verlauf": (b.steps || []).forEach(function (s) { out.push({ kind: "choice", type: "fall", titel: "Fallverlauf", sit: s.sit, q: "Was tust du?", opts: s.opts.map(function (o) { return o.t; }), ok: s.opts.map(function (o, i) { return o.ok ? i : -1; }).filter(function (i) { return i >= 0; }), exp: s.opts.filter(function (o) { return o.ok; }).map(function (o) { return o.c; }).join(" ") }); }); break;
          case "fehler": var ls = (b.lines || []).slice(0, 10); out.push({ kind: "lines", type: "fehler", titel: b.who || "Fehlersuche", q: "Wo stecken die Fehler?", opts: ls.map(function (l) { return l.t; }), ok: ls.map(function (l, i) { return l.e ? i : -1; }).filter(function (i) { return i >= 0; }), lineExp: ls.map(function (l) { return l.e || null; }), multi: true }); break;
          case "reflect": out.push({ kind: "word", type: "wort", titel: "Reflexion", q: strip(b.question), hint: "Deine wichtigsten Stichworte" }); break;
          case "cards": out.push({ kind: "info", type: "folie", titel: b.title || "Lernkarten", rows: (b.cards || []).slice(0, 8) }); break;
        }
      });
    });
    return out;
  }
  function majority(s, votes) {
    var c = (s.opts || []).map(function (_, i) { return votes.filter(function (v) { return (v.choice || [])[0] === i; }).length; });
    var best = c.indexOf(Math.max.apply(null, c));
    if (!votes.length) best = s.ok && s.ok.length ? s.ok[0] : 0;
    return best < 0 ? 0 : best;
  }
  function pubOf(title, steps, i, phase, x) {
    var s = steps[i]; x = x || {};
    if (!s) return { mode: "unterricht", title: title, total: steps.length };
    var p = { mode: "unterricht", title: title, total: steps.length, kind: s.kind, titel: s.titel, html: s.html, img: s.img, rows: s.rows, person: s.person, sit: s.sit, q: s.q, opts: s.opts, multi: !!s.multi, colors: s.colors, items: s.items, unit: s.unit, min: s.min, max: s.max, hint: s.hint, cats: s.cats, roles: s.roles, fig: s.fig, taps: s.taps };
    if (s.kind === "clue") { p.clue = x.clue || 0; p.clues = (s.clues || []).slice(0, (x.clue || 0) + 1); }
    if (phase === "reveal" && s.kind === "clue") p.clues = s.clues;
    if (phase === "reveal" && !s.survey) p.rev = { ok: s.ok, exp: s.exp, ans: s.ans, order: s.order, lines: s.lineExp, zones: s.zones };
    if (phase === "reveal" && s.pfad && x.pick != null) { p.rev.pick = x.pick; p.rev.cons = s.cons[x.pick]; }
    if (phase === "reveal" && s.survey && s.peer !== 1) p.rev = { exp: s.exp };
    return JSON.parse(JSON.stringify(p));
  }

  /* ---------- Sitzung: Cloud oder Demo ---------- */
  function Session(title, total) {
    var self = { id: null, code: null, demo: DEMO(), votes: {} };
    self.start = async function () {
      if (self.demo) { self.id = "demo"; self.code = Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[^A-Z0-9]/g, "X"); return self; }
      var r = await window.FP_API.liveCreate({ title: title, step: -1, phase: "lobby", pub: { mode: "unterricht", title: title, total: total } });
      self.id = r.id; self.code = r.code; return self;
    };
    self.update = async function (patch) { if (!self.demo) await window.FP_API.liveUpdate(self.id, patch); };
    self.read = async function (step) {
      if (self.demo) return self.votes[step] || [];
      var c = await window.FP_SB();
      var r = await c.from("live_votes").select("voter, choice, txt").eq("session_id", self.id).eq("step", step);
      if (r.error) throw new Error(r.error.message);
      return r.data || [];
    };
    self.end = async function () { if (!self.demo) await window.FP_API.liveUpdate(self.id, { phase: "end", ended_at: new Date().toISOString() }); };
    self.simulate = function (step, s) {
      var arr = self.votes[step] = self.votes[step] || [], n = arr.length, want = 18 + (step * 7) % 9;
      if (n >= want) return;
      var add = Math.min(want - n, 2 + Math.floor(Math.random() * 4));
      for (var k = 0; k < add; k++) {
        var v = { voter: "d" + step + "_" + (n + k), choice: [0], txt: null }, r = Math.random();
        if (s.kind === "choice" || s.kind === "scale") {
          var no = s.opts.length, good = s.ok && s.ok.length ? s.ok : null;
          if (s.peer === 2 && good) v.choice = [r < 0.78 ? good[0] : Math.floor(Math.random() * no)];
          else if (good && !s.survey) v.choice = s.multi ? good.filter(function () { return Math.random() < 0.8; }).concat(Math.random() < 0.3 ? [Math.floor(Math.random() * no)] : []).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort() : [r < (s.peer === 1 ? 0.45 : 0.62) ? good[0] : Math.floor(Math.random() * no)];
          else v.choice = [Math.min(no - 1, Math.floor(Math.pow(Math.random(), 1.4) * no))];
          if (!v.choice.length) v.choice = [0];
        } else if (s.kind === "lines") {
          v.choice = s.ok.filter(function () { return Math.random() < 0.7; }).concat(Math.random() < 0.35 ? [Math.floor(Math.random() * s.opts.length)] : []).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
          if (!v.choice.length) v.choice = [s.ok[0] || 0];
        } else if (s.kind === "order") {
          v.choice = r < 0.45 ? s.order.slice() : seeded(s.items.length, Math.floor(Math.random() * 999));
        } else if (s.kind === "estimate") {
          var a = Number(s.ans) || 10; v.txt = String(Math.round((a + (Math.random() + Math.random() + Math.random() - 1.5) * a * 0.45) * 10) / 10);
        } else if (s.kind === "conf" || s.kind === "clue") {
          var g0 = s.ok && s.ok.length ? s.ok[0] : 0, no2 = s.opts.length, right = r < (s.kind === "clue" ? 0.55 : 0.6);
          var pick = right ? g0 : (g0 + 1 + Math.floor(Math.random() * Math.max(1, no2 - 1))) % no2;
          if (s.kind === "conf") v.choice = [pick, Math.random() < (right ? 0.7 : 0.45) ? 8 : 9];
          else { var maxc = Math.max(0, (s._clue || 0)); v.choice = [pick, 5 + Math.min(maxc, Math.floor(Math.random() * (maxc + 1)))]; }
        } else if (s.kind === "body") {
          var BZ = (window.FP_BODY && window.FP_BODY.Z[s.fig]) || {}, keys = s.zones && s.zones.length ? s.zones : Object.keys(BZ), taps = [];
          for (var q = 0; q < s.taps; q++) {
            var useKey = Math.random() < 0.72 ? keys[Math.floor(Math.random() * keys.length)] : Object.keys(BZ)[Math.floor(Math.random() * Object.keys(BZ).length)], z = BZ[useKey];
            if (!z) continue; var cc = z[1][Math.floor(Math.random() * z[1].length)];
            taps.push([Math.max(0, Math.min(99, Math.round(cc[0] + (Math.random() - 0.5) * 8))), Math.max(0, Math.min(99, Math.round((cc[1] + (Math.random() - 0.5) * 8) / 2)))]);
          }
          v.choice = window.FP_BODY ? window.FP_BODY.enc(taps) : [0];
          if (!v.choice.length) v.choice = [0, 0, 0, 0];
        } else if (s.kind === "sort") {
          v.choice = s.ans.map(function (a) { return Math.random() < 0.7 && a >= 0 ? a : Math.floor(Math.random() * s.cats.length); });
        } else if (s.kind === "role") {
          var ri = Math.floor(Math.random() * Math.max(1, s.roles.length)), RP = [["Ich habe Angst, nicht mehr gefragt zu werden.", "Ich will einfach nach Hause.", "Warum redet keiner mit mir?", "Ich fühle mich wie eine Last."], ["Ich mache mir Sorgen und habe ein schlechtes Gewissen.", "Ich kann das nicht mehr allein schaffen.", "Ich will das Beste, aber was ist das?"], ["Ich will Sicherheit geben und trotzdem seine Wünsche respektieren.", "Ich habe zu wenig Zeit für das Gespräch.", "Ich sehe die Risiken jeden Tag."], ["Medizinisch ist die Lage klar, menschlich nicht.", "Ich muss alle an einen Tisch holen.", "Wir brauchen eine gemeinsame Entscheidung."]];
          var pool2 = RP[ri % RP.length]; v.txt = "[" + ri + "] " + pool2[Math.floor(Math.random() * pool2.length)];
        } else if (s.kind === "word") {
          var pool = s.demo && s.demo.length ? s.demo : ["Zuwendung", "Sicherheit", "Beobachtung", "Kommunikation", "Hygiene", "Empathie", "Teamarbeit", "Verantwortung"];
          v.txt = [pool[Math.floor(Math.pow(Math.random(), 1.7) * pool.length)], Math.random() < 0.5 ? pool[Math.floor(Math.random() * pool.length)] : null].filter(Boolean).join(", ");
        }
        arr.push(v);
      }
    };
    return self;
  }

  /* ---------- Auswertung ---------- */
  function tally(s, votes) {
    var n = votes.length, res = { n: n };
    if (s.kind === "choice" || s.kind === "scale" || s.kind === "lines") {
      res.c = (s.opts || []).map(function (_, i) { return votes.filter(function (v) { return (v.choice || []).indexOf(i) >= 0; }).length; });
      if (s.ok && s.ok.length && !s.survey && s.kind !== "lines") res.right = votes.filter(function (v) { var c = (v.choice || []).slice().sort().join(","); return c === s.ok.slice().sort().join(","); }).length;
    } else if (s.kind === "order") {
      res.full = votes.filter(function (v) { return (v.choice || []).join(",") === s.order.join(","); }).length;
      res.pos = s.order.map(function (want, p) { return votes.filter(function (v) { return (v.choice || [])[p] === want; }).length; });
    } else if (s.kind === "estimate") {
      var nums = votes.map(function (v) { return Number(String(v.txt || "").replace(",", ".")); }).filter(function (x) { return isFinite(x); }).sort(function (a, b) { return a - b; });
      res.nums = nums;
      res.median = nums.length ? nums[Math.floor(nums.length / 2)] : null;
      var lo = s.min != null && isFinite(s.min) ? s.min : Math.min.apply(null, nums.concat([Number(s.ans) * 0.5])), hi = s.max != null && isFinite(s.max) ? s.max : Math.max.apply(null, nums.concat([Number(s.ans) * 1.5]));
      if (!(hi > lo)) hi = lo + 1;
      var bins = [0, 0, 0, 0, 0, 0, 0, 0];
      nums.forEach(function (x) { var k = Math.max(0, Math.min(7, Math.floor((x - lo) / (hi - lo) * 8))); bins[k]++; });
      res.bins = bins; res.lo = lo; res.hi = hi;
    } else if (s.kind === "conf" || s.kind === "clue" || (s.pfad)) {
      res.c = (s.opts || []).map(function (_, i) { return votes.filter(function (v) { return (v.choice || [])[0] === i; }).length; });
      var g = s.ok && s.ok.length ? s.ok[0] : -1;
      res.right = votes.filter(function (v) { return (v.choice || [])[0] === g; }).length;
      if (s.kind === "conf") {
        res.m = { gs: 0, gu: 0, fu: 0, fs: 0 }; res.sure = 0;
        votes.forEach(function (v) { var ok = (v.choice || [])[0] === g, sure = (v.choice || [])[1] !== 9; if (sure) res.sure++; res.m[(ok ? "g" : "f") + (sure ? "s" : "u")]++; });
      }
      if (s.kind === "clue") res.by = (s.clues || []).map(function (_, ci) { var vv = votes.filter(function (v) { return (v.choice || [])[1] === 5 + ci; }); return { n: vv.length, ok: vv.filter(function (v) { return v.choice[0] === g; }).length }; });
    } else if (s.kind === "body") {
      res.taps = []; votes.forEach(function (v) { (window.FP_BODY ? window.FP_BODY.dec(v.choice) : []).forEach(function (t) { res.taps.push(t); }); });
      res.hit = res.taps.filter(function (t) { return window.FP_BODY && window.FP_BODY.hit(s.fig, s.zones, t[0], t[1]); }).length;
    } else if (s.kind === "sort") {
      res.per = s.items.map(function (_, ii) { return s.cats.map(function (_, ci) { return votes.filter(function (v) { return (v.choice || [])[ii] === ci; }).length; }); });
      res.full = votes.filter(function (v) { return s.ans.every(function (a, ii) { return a < 0 || (v.choice || [])[ii] === a; }); }).length;
    } else if (s.kind === "role") {
      res.by = (s.roles || []).map(function () { return []; });
      votes.forEach(function (v) { var m = /^\[(\d)\]\s*([\s\S]*)$/.exec(String(v.txt || "")); if (m && res.by[Number(m[1])] && m[2].trim()) res.by[Number(m[1])].push(m[2].trim()); });
    } else if (s.kind === "word") {
      var f = {};
      votes.forEach(function (v) { String(v.txt || "").split(/[,;\n]+/).map(function (w) { return w.trim().replace(/\s+/g, " "); }).filter(function (w) { return w.length > 1 && w.length < 40; }).forEach(function (w) { var k = w.toLowerCase(); f[k] = f[k] || { w: w.charAt(0).toUpperCase() + w.slice(1), n: 0 }; f[k].n++; }); });
      res.words = Object.keys(f).map(function (k) { return f[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 40);
    }
    return res;
  }
  function Bars(p) {
    var s = p.s, t = p.t, max = Math.max(1, t.n), showOk = p.rev && s.ok && !s.survey;
    return h("div", { className: "fxp-bars" + (s.kind === "lines" ? " lines" : "") }, (s.opts || []).map(function (o, i) {
      var c = t.c ? t.c[i] : 0, pct = Math.round(c / max * 100), good = showOk && s.ok.indexOf(i) >= 0;
      var cmp = p.cmp && p.cmp.c ? Math.round(p.cmp.c[i] / Math.max(1, p.cmp.n) * 100) : null;
      return h("div", { key: i, className: "fxp-bar" + (good ? " ok" : showOk ? " no" : ""), style: { "--bc": s.colors ? s.colors[i] : null } },
        h("div", { className: "fxp-bl" }, s.kind !== "scale" && s.kind !== "lines" ? h("i", null, "ABCDEFGHIJ"[i]) : null, h("span", null, o), good ? h("em", null, s.pfad ? "empfohlen" : "richtig") : null),
        h("div", { className: "fxp-bt" }, cmp != null && h("u", { style: { width: cmp + "%" } }), h("b", { style: { width: pct + "%" } })),
        h("div", { className: "fxp-bn" }, pct + " %", cmp != null ? h("small", null, "vorher " + cmp + " %") : null));
    }));
  }

  /* ---------- Ansichten der neuen Methoden ---------- */
  var pct = function (a, b) { return Math.round(a / Math.max(1, b) * 100); };
  function ConfView(p) {
    var s = p.s, t = p.t;
    if (!p.show) return h("div", { className: "fxp-opts" }, s.opts.map(function (o, i) { return h("div", { key: i, className: "fxp-opt" }, h("i", null, "ABCDEF"[i]), h("span", null, o)); }), h("p", { className: "fxp-small" }, "Auf dem Handy: Antwort wählen und angeben, ob man sich sicher ist oder rät."));
    var M = t.m || { gs: 0, gu: 0, fu: 0, fs: 0 };
    return h("div", null, h(Bars, { s: s, t: t, rev: p.rev }),
      !p.rev ? h("p", { className: "fxp-big" }, h("b", null, pct(t.sure, t.n) + " %"), " sind sich sicher") :
      h("div", { className: "fxp-matrix" },
        h("div", { className: "q gs" }, h("b", null, pct(M.gs, t.n) + " %"), h("span", null, "sicher und richtig"), h("small", null, "Gefestigtes Wissen")),
        h("div", { className: "q fs" }, h("b", null, pct(M.fs, t.n) + " %"), h("span", null, "sicher, aber falsch"), h("small", null, "Fehlvorstellung! Hier lohnt die Diskussion am meisten.")),
        h("div", { className: "q gu" }, h("b", null, pct(M.gu, t.n) + " %"), h("span", null, "geraten und richtig"), h("small", null, "Noch wackelig, bitte festigen")),
        h("div", { className: "q fu" }, h("b", null, pct(M.fu, t.n) + " %"), h("span", null, "geraten und falsch"), h("small", null, "Lücke erkannt, gut zum Wiederholen"))));
  }
  function BodyView(p) {
    var s = p.s, t = p.t, B = window.FP_BODY;
    if (!B) return null;
    var dots = "";
    if (p.show) (t.taps || []).forEach(function (tp) { dots += '<circle cx="' + (tp[0] + 0.5) + '" cy="' + (tp[1] * 2 + 1) + '" r="5" fill="rgba(225,29,72,.22)"/><circle cx="' + (tp[0] + 0.5) + '" cy="' + (tp[1] * 2 + 1) + '" r="1.3" fill="#BE185D"/>'; });
    var extra = (p.rev ? B.zonesSvg(s.fig, s.zones, true) : "") + dots;
    return h("div", { className: "fxp-body" }, h("div", { className: "fxp-bodyfig", dangerouslySetInnerHTML: { __html: B.svg(s.fig, extra) } }),
      h("div", { className: "fxp-bodyside" },
        h("p", { className: "fxp-big" }, h("b", null, (t.taps || []).length), " Stellen angetippt"),
        p.rev && s.zones && s.zones.length ? h("p", { className: "fxp-big" }, h("b", { className: "ok" }, pct(t.hit, (t.taps || []).length) + " %"), " treffen eine richtige Stelle") : null,
        p.rev && h("ul", { className: "fxp-zl" }, (s.zones || []).map(function (k) { var z = B.Z[s.fig][k]; return z ? h("li", { key: k }, z[0]) : null; })),
        !p.show && h("p", { className: "fxp-small" }, "Die Heatmap erscheint, sobald du das Ergebnis zeigst.")));
  }
  function SortView(p) {
    var s = p.s, t = p.t;
    return h("div", { className: "fxp-sort" },
      h("div", { className: "fxp-legend" }, s.cats.map(function (c, i) { return h("span", { key: i, style: { "--bc": NCOL[i] } }, h("i", null), c); })),
      s.items.map(function (it, ii) {
        var per = t.per ? t.per[ii] : [], tot = per.reduce(function (a, b) { return a + b; }, 0), a = s.ans[ii];
        return h("div", { key: ii, className: "fxp-srow" + (p.rev ? (tot && per[a] / tot >= 0.7 ? " good" : " weak") : "") },
          h("span", { className: "fxp-sl" }, it, p.rev && a >= 0 ? h("em", { style: { color: NCOL[a] } }, "→ " + s.cats[a]) : null),
          h("div", { className: "fxp-stack" }, p.show ? per.map(function (c, ci) { return c ? h("b", { key: ci, style: { width: pct(c, tot) + "%", background: NCOL[ci], opacity: p.rev && ci !== a ? 0.35 : 1 } }, pct(c, tot) >= 12 ? pct(c, tot) + " %" : "") : null; }) : null));
      }),
      p.rev && h("p", { className: "fxp-big" }, h("b", null, pct(t.full, t.n) + " %"), " haben alles richtig zugeordnet"));
  }
  function ClueView(p) {
    var s = p.s, t = p.t, shown = p.rev ? s.clues.length : p.clue + 1;
    return h("div", { className: "fxp-clue" },
      h("ol", { className: "fxp-clues" }, s.clues.slice(0, shown).map(function (c, i) { return h("li", { key: i, className: i === shown - 1 && !p.rev ? "new" : "" }, h("b", null, "Hinweis " + (i + 1)), h("span", null, c)); }),
        !p.rev && shown < s.clues.length ? h("li", { className: "more" }, (s.clues.length - shown) + " weitere Hinweise folgen") : null),
      h("h2", { className: "fxp-q" }, s.q),
      p.show ? h(Bars, { s: s, t: t, rev: p.rev }) : h("div", { className: "fxp-opts" }, s.opts.map(function (o, i) { return h("div", { key: i, className: "fxp-opt" }, h("i", null, "ABCDE"[i]), h("span", null, o)); })),
      p.rev && t.by && h("div", { className: "fxp-when" }, h("b", null, "Wann habt ihr euch festgelegt?"), h("div", { className: "fxp-whenrow" }, t.by.map(function (b, i) { return h("div", { key: i }, h("i", { style: { height: Math.max(4, pct(b.n, t.n)) + "%" } }), h("small", null, "nach " + (i + 1)), h("em", null, b.n ? pct(b.ok, b.n) + " % richtig" : "–")); }))));
  }
  function RoleView(p) {
    var s = p.s, t = p.t, RC = ["#2563EB", "#DB2777", "#0D9488", "#EA580C"];
    return h("div", { className: "fxp-roles", style: { gridTemplateColumns: "repeat(" + Math.max(1, s.roles.length) + ",minmax(0,1fr))" } }, s.roles.map(function (r, i) {
      var list = t.by ? t.by[i] || [] : [];
      return h("div", { key: i, className: "fxp-role", style: { "--rc": RC[i % 4] } }, h("header", null, h("b", null, r), h("span", null, list.length)), p.show ? list.slice(-8).map(function (x, j) { return h("p", { key: j }, "„" + x + "“"); }) : h("p", { className: "fxp-small" }, list.length ? "Antworten werden gesammelt …" : "Noch keine Antwort"));
    }));
  }

  /* ---------- Präsentation (Beamer) ---------- */
  function Presenter(p) {
    var steps = p.steps, title = p.title;
    var sx = useState(null), ses = sx[0], setSes = sx[1];
    var si = useState(-1), idx = si[0], setIdx = si[1];
    var sp = useState("lobby"), phase = sp[0], setPhase = sp[1];
    var sv = useState([]), votes = sv[0], setVotes = sv[1];
    var spk = useState(true), peek = spk[0], setPeek = spk[1];
    var se = useState(null), err = se[0], setErr = se[1];
    var sh = useState({}), hist = sh[0], setHist = sh[1];
    var sq = useState(true), bigQr = sq[0], setBigQr = sq[1];
    var scl = useState(0), clue = scl[0], setClue = scl[1];
    var str = useState([]), trail = str[0], setTrail = str[1];
    var spk2 = useState(null), pick = spk2[0], setPick = spk2[1];
    useEffect(function () { var S = Session(title, steps.length); S.start().then(setSes).catch(function (e) { setErr(e.message); }); }, []);
    var s = idx >= 0 ? steps[idx] : null;
    useEffect(function () {
      if (!ses || idx < 0 || !s || s.kind === "info") { setVotes([]); return; }
      var alive = true;
      var f = async function () {
        try { if (ses.demo && phase === "question") ses.simulate(idx, s); var v = await ses.read(idx); if (alive) setVotes(v.slice()); } catch (e) { if (alive) setErr(e.message); }
      };
      f(); var t = setInterval(f, 1300);
      return function () { alive = false; clearInterval(t); };
    }, [ses, idx, phase]);
    async function go(i, ph, isBack) {
      if (!ses) return;
      if (s && idx >= 0) setHist(function (x) { var y = Object.assign({}, x); y[idx] = tally(s, votes); return y; });
      if (!isBack && idx >= 0) setTrail(function (t) { return t.concat([idx]); });
      setIdx(i); setPhase(ph); setVotes([]); setClue(0); setPick(null);
      if (steps[i]) steps[i]._clue = 0;
      try { await ses.update({ step: i, phase: ph, pub: pubOf(title, steps, i, ph, { clue: 0 }) }); } catch (e) { setErr(e.message); }
    }
    async function reveal() {
      setPhase("reveal");
      setHist(function (x) { var y = Object.assign({}, x); y[idx] = tally(s, votes); return y; });
      var pk = s && s.pfad ? majority(s, votes) : null; setPick(pk);
      try { await ses.update({ phase: "reveal", pub: pubOf(title, steps, idx, "reveal", { clue: clue, pick: pk }) }); } catch (e) { setErr(e.message); }
    }
    async function nextClue() {
      if (!s || s.kind !== "clue" || clue >= s.clues.length - 1) return;
      var c = clue + 1; setClue(c); s._clue = c;
      try { await ses.update({ pub: pubOf(title, steps, idx, "question", { clue: c }) }); } catch (e) { setErr(e.message); }
    }
    async function end() {
      try { if (ses) await ses.end(); } catch (e) {}
      p.close();
    }
    function next() {
      if (s && s.jumps) { var pk = pick != null ? pick : majority(s, votes), tg = s.jumps[pk]; if (tg < steps.length) return go(tg, "question"); return finish(); }
      if (s && s.after != null) { if (s.after < steps.length) return go(s.after, "question"); return finish(); }
      if (idx < steps.length - 1) go(idx + 1, "question"); else finish();
    }
    function finish() { if (phase !== "end") { setPhase("end"); ses && ses.update({ phase: "end", pub: { mode: "unterricht", title: title, total: steps.length, summary: "Danke fürs Mitmachen! Die Stunde ist beendet." } }); } }
    function back() { if (trail.length) { var t = trail[trail.length - 1]; setTrail(trail.slice(0, -1)); go(t, "question", true); } else if (idx > 0) go(idx - 1, "question", true); }
    var canReveal = s && s.kind !== "info" && phase === "question";
    var moreClue = s && s.kind === "clue" && phase === "question" && clue < s.clues.length - 1;
    useEffect(function () {
      var k = function (e) {
        if (/input|textarea|select/i.test((e.target || {}).tagName || "")) return;
        if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); if (idx < 0) go(0, "question"); else if (moreClue) nextClue(); else if (canReveal) reveal(); else next(); }
        else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); back(); }
        else if (e.key === " ") { e.preventDefault(); if (moreClue) nextClue(); else if (canReveal) reveal(); else if (idx < 0) go(0, "question"); else next(); }
        else if (e.key === "Escape") { e.preventDefault(); end(); }
      };
      document.addEventListener("keydown", k);
      return function () { document.removeEventListener("keydown", k); };
    });
    var url = (window.FP_APPURL || "") + "?live=" + (ses ? ses.code : "");
    var qr = ses && window.FP_QRSVG ? window.FP_QRSVG(url) : "";
    var t = s && s.kind !== "info" ? tally(s, votes) : null, showRes = s && s.kind !== "info" && (phase === "reveal" || peek);
    var main;
    if (!ses) main = h("div", { className: "fxp-center" }, h("div", { className: "fxp-spin" }), h("p", null, err || "Live-Sitzung wird gestartet …"));
    else if (idx < 0) main = h("div", { className: "fxp-lobby" }, h("div", { className: "fxp-qrbig", dangerouslySetInnerHTML: { __html: qr } }), h("div", null, h("span", { className: "fxp-eyebrow" }, "Jetzt mitmachen"), h("h1", null, title), h("p", null, "QR-Code mit dem Handy scannen oder in der Fallpfad-App den Code eingeben."), h("div", { className: "fxp-code" }, ses.code), h("p", { className: "fxp-small" }, steps.length + " Schritte · Ohne Anmeldung · Anonym"), h("button", { type: "button", className: "fxp-btn primary", onClick: function () { go(0, "question"); } }, h(Ic, { n: "play" }), "Start")));
    else if (phase === "end") main = h("div", { className: "fxp-center" }, h("h1", null, "Geschafft!"), h("p", null, "Die Stunde ist beendet. Danke fürs Mitmachen."), h("button", { type: "button", className: "fxp-btn primary", onClick: end }, "Schließen"));
    else {
      var col = TYPES[s.type] ? TYPES[s.type].c : "#0062FF";
      var left = h("div", { className: "fxp-content" },
        h("span", { className: "fxp-eyebrow", style: { color: col } }, s.titel || (TYPES[s.type] || {}).t || ""),
        s.person && h("div", { className: "fxp-person" }, h("b", null, s.person.name), s.person.info && h("span", null, s.person.info)),
        s.kind === "info" && s.speaker && window.FP_CHARS && window.FP_CHARS[s.speaker] ? h("div", { className: "fxp-av", dangerouslySetInnerHTML: { __html: window.FP_CHARS[s.speaker].svg } }) : null,
        s.html && h("div", { className: "fxp-rich", dangerouslySetInnerHTML: { __html: /<(p|ul|ol|b|em|br|table)\b/i.test(s.html) ? s.html : s.html.split(/\n/).map(function (l) { var m = /^\s*[•\-\*]\s+(.*)$/.exec(l); return m ? "<li>" + esc(m[1]) + "</li>" : l.trim() ? "<p>" + esc(l) + "</p>" : ""; }).join("").replace(/(<li>.*?<\/li>)+/g, function (x) { return "<ul>" + x + "</ul>"; }) } }),
        s.img && h("img", { className: "fxp-img", src: s.img, alt: "" }),
        s.sit && h("div", { className: "fxp-sit" }, s.sit),
        s.rows && s.rows.length > 0 && h("table", { className: "fxp-rows" }, h("tbody", null, s.rows.map(function (r, i) { return h("tr", { key: i }, h("td", null, r[0]), h("td", null, h("b", null, r[1]))); }))),
        s.q && s.kind !== "clue" && h("h2", { className: "fxp-q" }, s.q),
        s.kind === "choice" || s.kind === "scale" || s.kind === "lines" ? (showRes ? h(Bars, { s: s, t: t, rev: phase === "reveal", cmp: s.peer === 2 && hist[s.ref] ? hist[s.ref] : null }) : h("div", { className: "fxp-opts" + (s.kind === "lines" ? " lines" : "") }, s.opts.map(function (o, i) { return h("div", { key: i, className: "fxp-opt", style: { "--bc": s.colors ? s.colors[i] : null } }, s.kind === "choice" ? h("i", null, "ABCDEFGHIJ"[i]) : null, h("span", null, o)); }))) : null,
        s.kind === "order" && (showRes ? h("div", { className: "fxp-order" }, h("p", { className: "fxp-big" }, h("b", null, Math.round(t.full / Math.max(1, t.n) * 100) + " %"), " haben alles richtig"), h("ol", null, s.order.map(function (k, pIdx) { return h("li", { key: k }, h("span", null, phase === "reveal" ? s.items[k] : "Position " + (pIdx + 1)), h("em", null, Math.round(t.pos[pIdx] / Math.max(1, t.n) * 100) + " % richtig")); }))) : h("div", { className: "fxp-opts" }, s.items.map(function (o, i) { return h("div", { key: i, className: "fxp-opt" }, h("span", null, o)); }))),
        s.kind === "estimate" && showRes && h("div", { className: "fxp-est" }, h("div", { className: "fxp-hist" }, t.bins.map(function (b, i) { return h("div", { key: i, style: { height: Math.round(b / Math.max(1, Math.max.apply(null, t.bins)) * 100) + "%" } }, b ? h("span", null, b) : null); })), h("div", { className: "fxp-axis" }, h("span", null, Math.round(t.lo * 10) / 10), h("span", null, Math.round(t.hi * 10) / 10)), h("p", { className: "fxp-big" }, "Median der Klasse: ", h("b", null, t.median == null ? "–" : String(t.median).replace(".", ",")), phase === "reveal" ? h(R.Fragment, null, " · richtig: ", h("b", { className: "ok" }, String(s.ans).replace(".", ",") + (s.unit ? " " + s.unit : ""))) : null)),
        s.kind === "word" && showRes && h("div", { className: "fxp-cloud" }, t.words.length ? t.words.map(function (w, i) { var mx = t.words[0].n; return h("span", { key: w.w, style: { fontSize: (16 + Math.round(w.n / mx * 46)) + "px", color: ["#0062FF", "#7C3AED", "#0D9488", "#DB2777", "#EA580C", "#4F46E5", "#059669"][i % 7] } }, w.w); }) : h("p", { className: "fxp-small" }, "Noch keine Stichworte.")),
        s.kind === "conf" && h(ConfView, { s: s, t: t, show: showRes, rev: phase === "reveal" }),
        s.kind === "body" && h(BodyView, { s: s, t: t, show: showRes, rev: phase === "reveal" }),
        s.kind === "sort" && h(SortView, { s: s, t: t, show: showRes, rev: phase === "reveal" }),
        s.kind === "clue" && h(ClueView, { s: s, t: t, show: showRes, rev: phase === "reveal", clue: clue }),
        s.kind === "role" && h(RoleView, { s: s, t: t, show: showRes, rev: phase === "reveal" }),
        s.pfad && phase === "reveal" && pick != null && h("div", { className: "fxp-path" }, h("span", { className: "fxp-eyebrow" }, "Die Klasse hat entschieden"), h("b", null, "ABCDE"[pick] + ": " + s.opts[pick]), s.cons[pick] && h("p", null, s.cons[pick]), s.ok.length && s.ok.indexOf(pick) < 0 ? h("div", { className: "fxp-alt" }, h("small", null, "Fachlich empfohlen wäre gewesen: " + "ABCDE"[s.ok[0]] + ". " + s.opts[s.ok[0]]), s.cons[s.ok[0]] && h("small", null, "Was dann passiert wäre: " + s.cons[s.ok[0]])) : null),
        phase === "reveal" && s.exp && h("div", { className: "fxp-exp" }, h("b", null, "Erklärung"), h("p", null, s.exp)),
        phase === "reveal" && s.kind === "lines" && s.lineExp && h("div", { className: "fxp-exp" }, s.lineExp.map(function (e, i) { return e ? h("p", { key: i }, h("b", null, "„" + s.opts[i].slice(0, 70) + "“ "), e) : null; })),
        s.peer === 1 && phase === "reveal" && h("div", { className: "fxp-exp peer" }, h("b", null, "Jetzt diskutieren"), h("p", null, "Sucht euch jemanden mit einer anderen Antwort und überzeugt euch gegenseitig. Zwei Minuten. Danach stimmen alle noch einmal ab.")));
      main = left;
    }
    var counter = s && s.kind !== "info" ? h("div", { className: "fxp-count" }, h("b", null, votes.length), h("span", null, votes.length === 1 ? "Antwort" : "Antworten")) : null;
    return RD.createPortal(h("div", { className: "fxp", role: "dialog", "aria-label": "Live-Präsentation" },
      h("header", { className: "fxp-top" },
        h("div", { className: "fxp-brand" }, h("span", { className: "fxp-dot" }), h("b", null, "Fallpfad Live"), h("span", null, title)),
        idx >= 0 && phase !== "end" && h("div", { className: "fxp-prog" }, h("span", null, "Schritt " + (idx + 1) + " von " + steps.length), h("div", null, h("i", { style: { width: Math.round((idx + 1) / steps.length * 100) + "%" } }))),
        ses && idx >= 0 && h("button", { type: "button", className: "fxp-join", onClick: function () { setBigQr(!bigQr); }, title: "QR-Code ein- oder ausblenden" }, bigQr ? h("span", { className: "fxp-qrs", dangerouslySetInnerHTML: { __html: qr } }) : null, h("span", null, h("small", null, "Code"), h("b", null, ses.code))),
        counter,
        h("button", { type: "button", className: "fxp-x", onClick: end, "aria-label": "Beenden" }, h(Ic, { n: "x" }))),
      err && h("div", { className: "fxp-err" }, err),
      h("main", { className: "fxp-main" }, main),
      ses && idx >= 0 && phase !== "end" && h("footer", { className: "fxp-bot" },
        h("button", { type: "button", className: "fxp-btn", onClick: back, disabled: idx <= 0 && !trail.length }, h(Ic, { n: "left" }), "Zurück"),
        s && s.kind !== "info" && phase === "question" && h("label", { className: "fxp-tog" }, h("input", { type: "checkbox", checked: peek, onChange: function (e) { setPeek(e.target.checked); } }), "Ergebnis live mitzeigen"),
        h("div", { className: "fxp-sp" }),
        ses && ses.demo && s && s.kind !== "info" && h("span", { className: "fxp-small" }, "Demo: Stimmen werden simuliert"),
        moreClue && h("button", { type: "button", className: "fxp-btn clue", onClick: nextClue }, h(Ic, { n: "hinweis", s: 18 }), "Nächster Hinweis (" + (clue + 2) + "/" + s.clues.length + ")"),
        canReveal && h("button", { type: "button", className: "fxp-btn accent", onClick: reveal }, s.survey ? "Ergebnis zeigen" : "Auflösen"),
        h("button", { type: "button", className: "fxp-btn primary", onClick: next }, idx < steps.length - 1 ? "Weiter" : "Beenden", h(Ic, { n: "right" })))
    ), document.body);
  }

  /* ---------- Baukasten (Editor) ---------- */
  function linesOf(x) { return String(x || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean); }
  function toForm(b) {
    var f = Object.assign({}, b);
    if (b.opts) f.opts = optsOf(b).map(function (o) { return (o.ok ? "* " : "") + o.t; }).join("\n");
    if (b.befunde) f.befunde = b.befunde.map(function (r) { return r[0] + ": " + r[1]; }).join("\n");
    if (b.items && b.type === "tf") f.items = b.items.map(function (i) { return (i.ok ? "R: " : "F: ") + i.t + (i.e ? " | " + i.e : ""); }).join("\n");
    if (b.items && b.type === "reihe") f.items = b.items.join("\n");
    if (b.lines) f.lines = b.lines.map(function (l) { return (l.err ? "! " : "") + l.t + (l.e ? " | " + l.e : ""); }).join("\n");
    ["cats", "roles", "clues"].forEach(function (k) { if (Array.isArray(b[k])) f[k] = b[k].join("\n"); });
    if (b.items && b.type === "sortier") f.items = b.items.map(function (i) { return typeof i === "string" ? i : i.t + " = " + (i.k || ""); }).join("\n");
    return f;
  }
  function fromForm(f) {
    var b = Object.assign({}, f);
    if (typeof f.opts === "string") b.opts = linesOf(f.opts).map(function (l) { return { t: l.replace(/^\*\s*/, ""), ok: /^\*/.test(l) }; });
    if (typeof f.befunde === "string") b.befunde = linesOf(f.befunde).map(function (l) { var i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; });
    if (f.type === "tf" && typeof f.items === "string") b.items = linesOf(f.items).map(function (l) { var ok = !/^F\s*:/i.test(l), t = l.replace(/^[RF]\s*:\s*/i, ""), parts = t.split("|"); return { t: parts[0].trim(), ok: ok, e: (parts[1] || "").trim() }; });
    if (f.type === "reihe" && typeof f.items === "string") b.items = linesOf(f.items).slice(0, 8);
    ["cats", "roles", "clues"].forEach(function (k) { if (typeof f[k] === "string") b[k] = linesOf(f[k]); });
    if (f.type === "sortier" && typeof f.items === "string") b.items = linesOf(f.items).slice(0, 8).map(function (l) { var i = l.lastIndexOf("="); return i > 0 ? { t: l.slice(0, i).trim(), k: l.slice(i + 1).trim() } : { t: l, k: "" }; });
    if (typeof f.lines === "string") b.lines = linesOf(f.lines).slice(0, 10).map(function (l) { var err = /^!/.test(l), t = l.replace(/^!\s*/, ""), parts = t.split("|"); return { t: parts[0].trim(), err: err, e: (parts[1] || "").trim() }; });
    return b;
  }
  var FIELDS = {
    folie: [["titel", "Überschrift"], ["text", "Text (Zeilen mit • werden zur Liste)", "area"], ["bild", "Bild (optional)", "img"]],
    fall: [["titel", "Überschrift, z. B. Frühdienst 7:30 Uhr"], ["person", "Person (erfunden), z. B. Frau Weber, 81 Jahre"], ["info", "Kurzinfo, z. B. Station 4B, nach Sturz"], ["sit", "Situation", "area"], ["befunde", "Befunde, je Zeile „Merkmal: Wert“ (optional)", "area"], ["q", "Frage an die Klasse"], ["opts", "Antworten, je Zeile eine. Richtige mit * davor", "area"], ["multi", "Mehrere Antworten möglich", "check"], ["exp", "Erklärung nach dem Auflösen", "area"]],
    frage: [["q", "Frage"], ["opts", "Antworten, je Zeile eine. Richtige mit * davor", "area"], ["multi", "Mehrere Antworten möglich", "check"], ["exp", "Erklärung nach dem Auflösen", "area"]],
    peer: [["q", "Kniffelige Frage (gut, wenn etwa die Hälfte falsch liegt)"], ["opts", "Antworten, je Zeile eine. Die richtige mit * davor", "area"], ["exp", "Erklärung nach Runde 2", "area"]],
    tf: [["titel", "Überschrift (optional)"], ["items", "Aussagen, je Zeile „R: …“ (richtig) oder „F: …“ (falsch), Erklärung nach |", "area"]],
    schaetz: [["q", "Frage"], ["ans", "Richtige Zahl", "num"], ["unit", "Einheit, z. B. ml oder %"], ["min", "Kleinster sinnvoller Wert (optional)", "num"], ["max", "Größter sinnvoller Wert (optional)", "num"], ["exp", "Erklärung", "area"]],
    wort: [["q", "Frage, z. B. Was fällt euch zu Schmerz ein?"], ["hint", "Hinweis im Eingabefeld (optional)"]],
    ampel: [["q", "Frage (optional), z. B. Wie sicher fühlst du dich beim Blutdruckmessen?"]],
    skala: [["q", "These, z. B. Eine Lüge aus Fürsorge ist in Ordnung."], ["links", "Linkes Ende (optional)"], ["rechts", "Rechtes Ende (optional)"]],
    reihe: [["q", "Aufgabe, z. B. Bringt die Schritte der Händedesinfektion in die richtige Reihenfolge."], ["items", "Schritte in der RICHTIGEN Reihenfolge, je Zeile einer (höchstens 8)", "area"], ["exp", "Erklärung", "area"]],
    fehler: [["titel", "Überschrift, z. B. Übergabe der Frühschicht"], ["lines", "Sätze, je Zeile einer. Fehlerhafte mit ! davor, Erklärung nach |", "area"], ["exp", "Gesamterklärung (optional)", "area"]],
    sicher: [["sit", "Kurze Situation (optional)", "area"], ["q", "Frage"], ["opts", "Antworten, je Zeile eine (höchstens 6). Die richtige mit * davor", "area"], ["exp", "Erklärung nach dem Auflösen", "area"]],
    koerper: [["sit", "Situation (optional)", "area"], ["q", "Aufgabe, z. B. Tippe die zwei Stellen an, die in Rückenlage am stärksten gefährdet sind."], ["fig", "Ansicht", "select", [["hinten", "Rückseite"], ["vorne", "Vorderseite"]]], ["taps", "Antippen pro Person", "select", [["2", "bis zu 2 Stellen"], ["1", "1 Stelle"]]], ["zones", "Richtige Stellen (werden beim Auflösen eingeblendet)", "zones"], ["exp", "Erklärung", "area"]],
    sortier: [["q", "Aufgabe, z. B. Ordnet die Erreger der richtigen Isolierung zu."], ["cats", "Kategorien, je Zeile eine (2 bis 4)", "area"], ["items", "Begriffe, je Zeile „Begriff = Kategorie“ (höchstens 8)", "area"], ["exp", "Erklärung", "area"]],
    hinweis: [["person", "Person (erfunden), z. B. Herr Albers, 74 Jahre"], ["info", "Kurzinfo, z. B. Chirurgie, 2. Tag nach OP"], ["clues", "Hinweise, je Zeile einer, vom unklaren zum eindeutigen (höchstens 5)", "area"], ["q", "Frage, z. B. Was vermutest du?"], ["opts", "Vermutungen, je Zeile eine (höchstens 5). Die richtige mit * davor", "area"], ["exp", "Auflösung", "area"]],
    rolle: [["sit", "Situation, die alle sehen", "area"], ["roles", "Rollen, je Zeile eine (2 bis 4), z. B. Patient, Tochter, Pflegekraft, Ärztin", "area"], ["q", "Frage an alle Rollen, z. B. Was denkst und fühlst du gerade?"], ["exp", "Impuls für die Auswertung", "area"]],
    pfad: [["titel", "Überschrift, z. B. Nachtdienst auf Station 3"], ["graph", "Ablauf. Jede Situation beginnt mit #, Optionen mit - (empfohlen mit *). Nach -> die Nummer der nächsten Situation oder Ende, nach | die Folge.", "graph"]]
  };
  var GRAPH_HINT = "# 1 Frau Lorenz klingelt um 2 Uhr, sie will allein zur Toilette.\n? Was tust du?\n* Begleiten und Licht anmachen -> 2 | Sie kommt sicher an.\n- Ihr die Urinflasche geben -> 3 | Sie ist gekränkt.\n# 2 Auf dem Rückweg wird ihr schwindelig.\n* Hinsetzen lassen, Blutdruck messen -> Ende | RR 92/58, du informierst die Ärztin.\n- Schnell zurück ins Bett -> Ende | Sie stürzt fast.\n# 3 Zehn Minuten später steht sie allein auf.\n- Bettgitter hochziehen -> Ende | Das ist eine freiheitsentziehende Maßnahme.\n* Gespräch und Toilettenplan -> Ende | Sie fühlt sich ernst genommen.";
  function shrinkImg(file, cb) {
    var u = URL.createObjectURL(file), im = new Image();
    im.onload = function () { var f = Math.min(1, 1200 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * f); c.height = Math.round(im.height * f); var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); cb(c.toDataURL("image/jpeg", 0.82)); };
    im.src = u;
  }
  function BlockForm(p) {
    var b = p.b, T = TYPES[b.type];
    return h("div", { className: "fxb-blk", style: { "--c": T.c } },
      h("div", { className: "fxb-bh" }, h("span", { className: "fxb-ic" }, h(Ic, { n: b.type, s: 17 })), h("b", null, (p.i + 1) + ". " + T.t), h("small", null, T.d),
        h("span", { className: "fxb-tools" }, h("button", { type: "button", className: "iconbtn", "aria-label": "Nach oben", disabled: p.i === 0, onClick: function () { p.move(-1); } }, h(Ic, { n: "up", s: 16 })), h("button", { type: "button", className: "iconbtn", "aria-label": "Nach unten", disabled: p.last, onClick: function () { p.move(1); } }, h(Ic, { n: "down", s: 16 })), h("button", { type: "button", className: "iconbtn", "aria-label": "Löschen", onClick: p.del }, h(Ic, { n: "trash", s: 16 })))),
      h("div", { className: "fxb-fields" }, FIELDS[b.type].map(function (f) {
        var k = f[0], v = b[k] == null ? "" : b[k], id = "fxb-" + b._id + "-" + k;
        if (f[2] === "select") return h("div", { key: k, className: "field" }, h("label", { htmlFor: id }, f[1]), h("select", { id: id, className: "input", value: v || f[3][0][0], onChange: function (e) { p.set(k, e.target.value); if (k === "fig") p.set("zones", []); } }, f[3].map(function (o) { return h("option", { key: o[0], value: o[0] }, o[1]); })));
        if (f[2] === "zones") { var BZ = window.FP_BODY ? window.FP_BODY.Z[b.fig === "vorne" ? "vorne" : "hinten"] : {}, cur = Array.isArray(v) ? v : []; return h("div", { key: k, className: "field wide" }, h("label", null, f[1]), h("div", { className: "fxb-zones" }, Object.keys(BZ).map(function (zk) { var on = cur.indexOf(zk) >= 0; return h("label", { key: zk, className: "fxb-zone" + (on ? " on" : "") }, h("input", { type: "checkbox", checked: on, onChange: function () { p.set(k, on ? cur.filter(function (x) { return x !== zk; }) : cur.concat([zk])); } }), BZ[zk][0]); }))); }
        if (f[2] === "graph") { var nodes = parseGraph(v); return h("div", { key: k, className: "field wide" }, h("label", { htmlFor: id }, f[1]), h("textarea", { id: id, className: "input fxb-graph", rows: 11, value: v, placeholder: GRAPH_HINT, onChange: function (e) { p.set(k, e.target.value); } }), h("small", { className: "muted" }, nodes.length ? nodes.length + " Situationen erkannt: " + nodes.map(function (n, i) { return (i + 1) + (n.opts.length ? " (" + n.opts.map(function (o) { return o.to ? "→" + o.to : "→Ende"; }).join(", ") + ")" : " (Abschluss)"); }).join(" · ") : "Beispiel im Feld, einfach überschreiben."), !v && h("button", { type: "button", className: "btn ghost sm", style: { marginTop: 6 }, onClick: function () { p.set(k, GRAPH_HINT); } }, "Beispiel einsetzen")); }
        if (f[2] === "check") return h("label", { key: k, className: "fxb-chk" }, h("input", { type: "checkbox", checked: !!v, onChange: function (e) { p.set(k, e.target.checked); } }), f[1]);
        if (f[2] === "img") return h("div", { key: k, className: "field" }, h("label", null, f[1]), v ? h("div", { className: "fxb-img" }, h("img", { src: v, alt: "" }), h("button", { type: "button", className: "btn ghost sm", onClick: function () { p.set(k, ""); } }, "Entfernen")) : h("input", { type: "file", accept: "image/*", onChange: function (e) { var fl = e.target.files[0]; if (fl) shrinkImg(fl, function (d) { p.set(k, d); }); } }));
        return h("div", { key: k, className: "field" + (f[2] === "area" ? " wide" : "") }, h("label", { htmlFor: id }, f[1]), f[2] === "area" ? h("textarea", { id: id, className: "input", rows: k === "sit" || k === "text" ? 4 : 3, value: v, onChange: function (e) { p.set(k, e.target.value); } }) : h("input", { id: id, className: "input", type: f[2] === "num" ? "number" : "text", step: "any", value: v, onChange: function (e) { p.set(k, e.target.value); } }));
      })));
  }
  function Builder(p) {
    var s0 = p.lesson ? JSON.parse(JSON.stringify(p.lesson)) : { t: "", kurz: "", lvl: "Jahr 1", ber: "", blocks: [] };
    var sl = useState(function () { return Object.assign({}, s0, { blocks: (s0.blocks || []).map(function (b) { return Object.assign(toForm(b), { _id: rid() }); }) }); }), L = sl[0], setL = sl[1];
    var sb = useState(false), busy = sb[0], setBusy = sb[1];
    var se = useState(null), err = se[0], setErr = se[1];
    var setB = function (i, k, v) { setL(function (x) { var y = Object.assign({}, x, { blocks: x.blocks.slice() }); y.blocks[i] = Object.assign({}, y.blocks[i]); y.blocks[i][k] = v; return y; }); };
    var add = function (t) { setL(function (x) { return Object.assign({}, x, { blocks: x.blocks.concat([{ type: t, _id: rid() }]) }); }); setTimeout(function () { var el = document.querySelector(".fxb-list > :last-child"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }); }, 60); };
    var mv = function (i, d) { setL(function (x) { var a = x.blocks.slice(), j = i + d; if (j < 0 || j >= a.length) return x; var t = a[i]; a[i] = a[j]; a[j] = t; return Object.assign({}, x, { blocks: a }); }); };
    var del = function (i) { setL(function (x) { return Object.assign({}, x, { blocks: x.blocks.filter(function (_, j) { return j !== i; }) }); }); };
    function out() { return { kind: "stunde", t: L.t.trim(), kurz: L.kurz, lvl: L.lvl, ber: L.ber, blocks: L.blocks.map(function (b) { var c = fromForm(b); delete c._id; return c; }) }; }
    function check(d) {
      if (!d.t) return "Gib der Live-Stunde einen Titel.";
      if (!d.blocks.length) return "Füge mindestens einen Baustein hinzu.";
      for (var i = 0; i < d.blocks.length; i++) {
        var b = d.blocks[i], n = (i + 1) + ". " + TYPES[b.type].t + ": ";
        if ((b.type === "frage" || b.type === "fall" || b.type === "peer") && (!b.q || (b.opts || []).length < 2)) return n + "Frage und mindestens zwei Antworten fehlen.";
        if ((b.type === "frage" || b.type === "fall" || b.type === "peer") && !(b.opts || []).some(function (o) { return o.ok; })) return n + "Markiere die richtige Antwort mit * am Zeilenanfang.";
        if (b.type === "schaetz" && (!b.q || !isFinite(Number(b.ans)) || b.ans === "")) return n + "Frage und richtige Zahl fehlen.";
        if (b.type === "reihe" && (b.items || []).length < 3) return n + "Mindestens drei Schritte.";
        if (b.type === "tf" && !(b.items || []).length) return n + "Mindestens eine Aussage.";
        if (b.type === "fehler" && !(b.lines || []).some(function (l) { return l.err; })) return n + "Markiere fehlerhafte Sätze mit ! am Zeilenanfang.";
        if ((b.type === "wort" || b.type === "skala") && !b.q) return n + "Die Frage fehlt.";
        if ((b.type === "sicher" || b.type === "hinweis") && (!b.q || (b.opts || []).length < 2 || !(b.opts || []).some(function (o) { return o.ok; }))) return n + "Frage, mindestens zwei Antworten und die richtige (mit *) fehlen.";
        if (b.type === "hinweis" && (b.clues || []).length < 2) return n + "Mindestens zwei Hinweise.";
        if (b.type === "koerper" && !b.q) return n + "Die Aufgabe fehlt.";
        if (b.type === "sortier") { var sa = sortAns(b); if (sa.cats.length < 2 || sa.items.length < 2) return n + "Mindestens zwei Kategorien und zwei Begriffe."; var bad = sa.items.filter(function (it) { return !sa.cats.some(function (c) { return c.toLowerCase() === String(it.k).toLowerCase(); }); }); if (bad.length) return n + "„" + bad[0].t + "“ gehört zu keiner Kategorie. Schreibe „Begriff = Kategorie“."; }
        if (b.type === "rolle" && ((b.roles || []).length < 2 || !b.sit)) return n + "Situation und mindestens zwei Rollen fehlen.";
        if (b.type === "pfad") { var nd = parseGraph(b.graph); if (!nd.length || !nd[0].opts.length) return n + "Die erste Situation braucht mindestens zwei Optionen (Zeilen mit - oder *)."; }
      }
      return null;
    }
    async function save(andStart) {
      var d = out(), e = check(d);
      if (e) { setErr(e); return; }
      setBusy(true); setErr(null);
      try {
        var row = await window.FP_API.liveCaseSave(Object.assign(p.row && p.row.id ? { id: p.row.id } : {}, { title: d.t.slice(0, 120), data: d }));
        p.saved(row);
        if (andStart) p.start(d);
      } catch (x) { setErr(x.message); }
      setBusy(false);
    }
    return RD.createPortal(h("div", { className: "fxb-bg" }, h("div", { className: "fxb", role: "dialog", "aria-label": "Live-Stunde bauen" },
      h("header", { className: "fxb-head" }, h("div", null, h("span", { className: "fxp-eyebrow" }, "Baukasten"), h("h2", null, p.row ? "Live-Stunde bearbeiten" : "Neue Live-Stunde")), h("button", { type: "button", className: "iconbtn", "aria-label": "Schließen", onClick: p.close }, h(Ic, { n: "x" }))),
      h("div", { className: "fxb-body" },
        h("div", { className: "fxb-meta" },
          h("div", { className: "field" }, h("label", { htmlFor: "fxb-t" }, "Titel"), h("input", { id: "fxb-t", className: "input", value: L.t, onChange: function (e) { setL(Object.assign({}, L, { t: e.target.value })); }, placeholder: "z. B. Dekubitus: erkennen und vorbeugen" })),
          h("div", { className: "field" }, h("label", { htmlFor: "fxb-k" }, "Kurzbeschreibung"), h("input", { id: "fxb-k", className: "input", value: L.kurz, onChange: function (e) { setL(Object.assign({}, L, { kurz: e.target.value })); } })),
          h("div", { className: "field" }, h("label", { htmlFor: "fxb-l" }, "Ausbildungsjahr"), h("select", { id: "fxb-l", className: "input", value: L.lvl, onChange: function (e) { setL(Object.assign({}, L, { lvl: e.target.value })); } }, ["Jahr 1", "Jahr 2", "Jahr 3"].map(function (x) { return h("option", { key: x }, x); })))),
        L.blocks.length === 0 && h("div", { className: "fxb-empty" }, h("b", null, "Noch keine Bausteine"), h("p", null, "Wähle unten einen Baustein. Ein guter Ablauf: Wortwolke zum Einstieg, eine Fallsituation, eine Peer-Instruction-Frage, ein Richtig-oder-Falsch-Blitz und zum Schluss der Ampel-Check.")),
        h("div", { className: "fxb-list" }, L.blocks.map(function (b, i) { return h(BlockForm, { key: b._id, b: b, i: i, last: i === L.blocks.length - 1, set: function (k, v) { setB(i, k, v); }, move: function (d) { mv(i, d); }, del: function () { del(i); } }); })),
        h("div", { className: "fxb-add" }, h("b", null, "Baustein hinzufügen"), h("div", { className: "fxb-types" }, ORDER.map(function (t) { return h("button", { key: t, type: "button", style: { "--c": TYPES[t].c }, onClick: function () { add(t); }, title: TYPES[t].d }, h("span", { className: "fxb-ic" }, h(Ic, { n: t, s: 17 })), h("span", null, TYPES[t].t)); })))),
      err && h("div", { className: "notice bad", style: { margin: "0 22px" } }, err),
      h("footer", { className: "fxb-foot" }, h("span", { className: "muted" }, pl(L.blocks.length, "Baustein", "Bausteine") + " · " + pl(stepsOf(out()).length, "Schritt", "Schritte")), h("div", { className: "fxp-sp" }), h("button", { type: "button", className: "btn ghost", onClick: p.close }, "Abbrechen"), h("button", { type: "button", className: "btn ghost", disabled: busy, onClick: function () { var d = out(), e = check(d); if (e) setErr(e); else p.start(d, true); } }, h(Ic, { n: "eye", s: 18 }), "Vorschau"), h("button", { type: "button", className: "btn", disabled: busy, onClick: function () { save(false); } }, "Speichern"), h("button", { type: "button", className: "btn fx-aibtn", disabled: busy, onClick: function () { save(true); } }, h(Ic, { n: "play", s: 18 }), "Speichern und starten"))
    )), document.body);
  }

  /* ---------- Modul live ---------- */
  function ModulePicker(p) {
    var mods = (window.FP_MODS || []).slice().sort(function (a, b) { return (a.year - b.year) || (a.order - b.order); });
    var sm = useState(null), mid = sm[0], setMid = sm[1];
    var sc = useState(null), chs = sc[0], setChs = sc[1];
    var sq = useState(""), q = sq[0], setQ = sq[1];
    var m = mods.find(function (x) { return x.id === mid; });
    var list = mods.filter(function (x) { return !q || (x.title + " " + (x.subtitle || "")).toLowerCase().indexOf(q.toLowerCase()) >= 0; });
    var steps = m ? stepsOfModule(m, chs) : [];
    return RD.createPortal(h("div", { className: "fxb-bg" }, h("div", { className: "fxb", role: "dialog", "aria-label": "Modul live zeigen" },
      h("header", { className: "fxb-head" }, h("div", null, h("span", { className: "fxp-eyebrow" }, "Modul live an der Tafel"), h("h2", null, m ? m.title.replace(/^Fallmodul \d+ · /, "") : "Welches Modul möchtest du zeigen?")), h("button", { type: "button", className: "iconbtn", "aria-label": "Schließen", onClick: p.close }, h(Ic, { n: "x" }))),
      h("div", { className: "fxb-body" }, !m ? h(R.Fragment, null,
        h("p", { className: "muted", style: { marginTop: 0 } }, "Du zeigst das Modul Schritt für Schritt vorne. Die Lernenden scannen den QR-Code und sehen auf dem Handy denselben Schritt. Fragen, Quiz und Übungen beantworten sie dort, weiter schaltest nur du."),
        h("input", { className: "input", placeholder: "Modul suchen …", value: q, onChange: function (e) { setQ(e.target.value); }, style: { maxWidth: "none", marginBottom: 12 } }),
        h("div", { className: "fxm-grid" }, list.map(function (x) { return h("button", { key: x.id, type: "button", className: "fxm-card", style: { "--c": ["", "#0062FF", "#7C3AED", "#0D9488"][x.year] || "#0062FF" }, onClick: function () { setMid(x.id); setChs(x.chapters.map(function (_, i) { return i; })); } }, h("small", null, "Jahr " + x.year), h("b", null, x.title.replace(/^Fallmodul \d+ · /, "")), h("span", null, x.chapters.length + " Stationen")); })))
        : h(R.Fragment, null,
          h("button", { type: "button", className: "skip", onClick: function () { setMid(null); } }, h(Ic, { n: "left", s: 16 }), " Anderes Modul"),
          h("h3", null, "Stationen auswählen"),
          h("div", { className: "fxm-chs" }, m.chapters.map(function (c, i) { var on = chs.indexOf(i) >= 0; return h("label", { key: i, className: "fxm-ch" + (on ? " on" : "") }, h("input", { type: "checkbox", checked: on, onChange: function () { setChs(on ? chs.filter(function (x) { return x !== i; }) : chs.concat([i]).sort(function (a, b) { return a - b; })); } }), h("span", null, h("b", null, (i + 1) + ". " + c.title), h("small", null, ((c.blocks || []).length === 1 ? "1 Baustein" : (c.blocks || []).length + " Bausteine")))); })),
          h("p", { className: "muted" }, steps.length + " Schritte, davon " + steps.filter(function (s) { return s.kind !== "info"; }).length + " zum Mitmachen."))),
      h("footer", { className: "fxb-foot" }, h("div", { className: "fxp-sp" }), h("button", { type: "button", className: "btn ghost", onClick: p.close }, "Abbrechen"), m && h("button", { type: "button", className: "btn fx-aibtn", disabled: !chs.length, onClick: function () { p.start(m.title.replace(/^Fallmodul \d+ · /, ""), steps); } }, h(Ic, { n: "play", s: 18 }), "Live starten"))
    )), document.body);
  }

  /* ---------- Übersicht im Reiter Live ---------- */
  function chips(L) {
    var seen = {}, out = [];
    (L.blocks || []).forEach(function (b) { if (!seen[b.type]) { seen[b.type] = 1; out.push(b.type); } });
    return out;
  }
  function LessonCard(p) {
    var L = p.L, col = p.col;
    return h("div", { className: "card fxl-card", style: { "--c": col } },
      h("div", { className: "row", style: { justifyContent: "space-between", gap: 8, flexWrap: "nowrap" } }, h("span", { className: "eyebrow" }, p.tag + " · " + (L.lvl || "")), p.badge && h("span", { className: "pill" }, p.badge)),
      h("b", { className: "fxl-t" }, L.t), L.kurz && h("p", { className: "muted fxl-k" }, L.kurz),
      h("div", { className: "fxl-chips" }, chips(L).map(function (t) { return h("span", { key: t, title: TYPES[t].t, style: { "--c": TYPES[t].c } }, h(Ic, { n: t, s: 14 }), TYPES[t].t); })),
      h("div", { className: "fxl-meta" }, pl(stepsOf(L).length, "Schritt", "Schritte")),
      h("div", { className: "row", style: { gap: 6, marginTop: "auto" } }, h("button", { type: "button", className: "btn sm", onClick: p.start }, h(Ic, { n: "play", s: 16 }), "Live starten"), h("button", { type: "button", className: "btn ghost sm", onClick: p.edit }, h(Ic, { n: p.own ? "edit" : "copy", s: 16 }), p.own ? "Bearbeiten" : "Als Kopie bearbeiten"), p.own && h("button", { type: "button", className: "iconbtn", "aria-label": "Löschen", onClick: p.del }, h(Ic, { n: "trash", s: 16 }))));
  }
  function Hub() {
    var lib = window.FP_LIVE_LIB || { stunden: [], faelle: [] };
    var so = useState([]), own = so[0], setOwn = so[1];
    var sb = useState(null), build = sb[0], setBuild = sb[1];
    var sm = useState(false), pick = sm[0], setPick = sm[1];
    var sr = useState(null), run = sr[0], setRun = sr[1];
    var se = useState(null), err = se[0], setErr = se[1];
    var sf = useState("alle"), flt = sf[0], setFlt = sf[1];
    var load = function () { window.FP_API && window.FP_API.liveCases().then(function (r) { setOwn((r || []).filter(function (x) { return x.data && x.data.kind === "stunde"; })); }).catch(function (e) { if (!/does not exist|Could not find|Tabelle/i.test(e.message)) setErr(e.message); }); };
    useEffect(load, []);
    var start = function (L) { setRun({ title: L.t, steps: stepsOf(L) }); };
    var Y = function (L) { return flt === "alle" || L.lvl === flt; };
    return h("div", { className: "fxl-hub" },
      err && h("div", { className: "notice bad" }, err),
      h("div", { className: "fxl-start" },
        h("button", { type: "button", className: "fxl-big", style: { "--c": "#7C3AED" }, onClick: function () { setBuild({}); } }, h("span", { className: "fxl-bic" }, h(Ic, { n: "plus", s: 24 })), h("b", null, "Live-Stunde bauen"), h("small", null, "Aus " + ORDER.length + " Bausteinen: Klassenentscheid, Körperkarte, Hinweis für Hinweis, Peer Instruction, Wortwolke und mehr")),
        h("button", { type: "button", className: "fxl-big", style: { "--c": "#0062FF" }, onClick: function () { setPick(true); } }, h("span", { className: "fxl-bic" }, h(Ic, { n: "book", s: 24 })), h("b", null, "Modul live an der Tafel"), h("small", null, "Ein Fallmodul Schritt für Schritt zeigen. Die Klasse antwortet mit, weiter schaltest nur du.")),
        h("button", { type: "button", className: "fxl-big", style: { "--c": "#E11D48" }, onClick: function () { if (window.FP_IMPORT) window.FP_IMPORT.open("live"); } }, h("span", { className: "fxl-bic" }, h(Ic, { n: "spark", s: 24 })), h("b", null, "Aus Folien erstellen"), h("small", null, "PowerPoint oder PDF hochladen, daraus wird ein Live-Fall."))),
      h("div", { className: "sec" }, h("h2", null, "Live-Stunden"), h("div", { className: "fxl-flt" }, ["alle", "Jahr 1", "Jahr 2", "Jahr 3"].map(function (x) { return h("button", { key: x, type: "button", className: "chip" + (flt === x ? " on blue" : ""), onClick: function () { setFlt(x); } }, x === "alle" ? "Alle" : x); }))),
      h("p", { className: "muted", style: { marginTop: -6 } }, "Fertige Unterrichtsstunden mit wechselnden Methoden, sofort startklar. Ohne Vitalzeichen-Monitor."),
      h("div", { className: "agrid fxl-grid" },
        own.filter(function (r) { return Y(r.data); }).map(function (r) { return h(LessonCard, { key: r.id, L: r.data, tag: "Eigene", col: "#7C3AED", own: true, start: function () { start(r.data); }, edit: function () { setBuild({ row: r, lesson: r.data }); }, del: function () { if (confirm("„" + r.data.t + "“ löschen?")) window.FP_API.liveCaseDelete(r.id).then(load).catch(function (e) { setErr(e.message); }); } }); }),
        (lib.stunden || []).filter(Y).map(function (L, i) { return h(LessonCard, { key: "s" + i, L: L, tag: "Fallpfad", col: ["#0062FF", "#7C3AED", "#0D9488", "#DB2777", "#EA580C", "#4F46E5", "#059669", "#D97706", "#0891B2", "#E11D48"][i % 10], start: function () { start(L); }, edit: function () { setBuild({ lesson: Object.assign({}, L, { t: L.t + " (eigene Fassung)" }) }); } }); })),
      h("div", { className: "sec" }, h("h2", null, "Fallbeispiele für die Klasse")),
      h("p", { className: "muted", style: { marginTop: -6 } }, "Ein Fall entwickelt sich Schritt für Schritt, die Klasse entscheidet gemeinsam. Ohne Vitalzeichen-Monitor, ideal zum Besprechen an der Tafel."),
      h("div", { className: "agrid fxl-grid" }, (lib.faelle || []).filter(Y).map(function (L, i) { return h(LessonCard, { key: "f" + i, L: L, tag: "Fallbeispiel", col: "#E11D48", start: function () { start(L); }, edit: function () { setBuild({ lesson: Object.assign({}, L, { t: L.t + " (eigene Fassung)" }) }); } }); })),
      (lib.beispiele || []).length > 0 && h("div", { className: "sec" }, h("h2", null, "Neue Methoden ausprobieren")),
      (lib.beispiele || []).length > 0 && h("p", { className: "muted", style: { marginTop: -6 } }, "Sechs neue Live-Methoden mit je einem fertigen Beispiel. Kurz, sofort startklar und gut, um die Methode einmal mit der Klasse zu erleben."),
      (lib.beispiele || []).length > 0 && h("div", { className: "agrid fxl-grid" }, lib.beispiele.filter(Y).map(function (L, i) { var T = TYPES[L.m] || {}; return h(LessonCard, { key: "b" + i, L: L, tag: "Methode: " + (T.t || ""), col: T.c || "#7C3AED", badge: "Neu", start: function () { start(L); }, edit: function () { setBuild({ lesson: Object.assign({}, L, { t: L.t + " (eigene Fassung)" }) }); } }); })),
      h("details", { className: "card fxl-kit" }, h("summary", null, h("b", null, "Der Bausteinkasten: " + ORDER.length + " Live-Methoden"), h("span", { className: "muted" }, " und wofür sie sich eignen")), h("div", { className: "fxl-kitgrid" }, ORDER.map(function (t) { var ex = (lib.beispiele || []).find(function (L) { return L.m === t; }); return h("div", { key: t, style: { "--c": TYPES[t].c } }, h("span", { className: "fxb-ic" }, h(Ic, { n: t, s: 18 })), h("b", null, TYPES[t].t, TYPES[t].neu ? h("em", { className: "fxl-new" }, "Neu") : null), h("p", null, TYPES[t].d), ex && h("button", { type: "button", className: "btn ghost sm", onClick: function () { start(ex); } }, h(Ic, { n: "play", s: 14 }), "Beispiel zeigen")); }))),
      h("div", { className: "sec" }, h("h2", null, "Live-Klassenfälle mit Vitalzeichen")),
      build && h(Builder, { row: build.row, lesson: build.lesson, close: function () { setBuild(null); }, saved: function () { load(); setBuild(null); }, start: function (L, preview) { if (!preview) setBuild(null); setRun({ title: L.t, steps: stepsOf(L) }); } }),
      pick && h(ModulePicker, { close: function () { setPick(false); }, start: function (t, steps) { setPick(false); setRun({ title: t, steps: steps }); } }),
      run && h(Presenter, { title: run.title, steps: run.steps, close: function () { setRun(null); } }));
  }
  window.FP_LiveHub = Hub;
  window.FP_LIVE = { stepsOf: stepsOf, stepsOfModule: stepsOfModule, tally: tally, pubOf: pubOf, parseGraph: parseGraph, TYPES: TYPES };
})();

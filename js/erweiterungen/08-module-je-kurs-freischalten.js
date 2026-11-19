/* Lehrer-Portal: Module je Kurs freischalten, sperren oder ausblenden, Bausteine der aktuellen Theoriephase festlegen
   und den Lerncoach (Ansprechperson bei Lernschwierigkeiten) hinterlegen. Alles liegt in courses.settings (jsonb). */
(function () {
  var R = window.React, RD = window.ReactDOM;
  if (!R || !RD) return;
  var h = R.createElement, useState = R.useState, useEffect = R.useEffect;
  var YC = { 1: "#0062FF", 2: "#7C3AED", 3: "#0D9488" };
  var clean = function (t) { return String(t || "").replace(/^Fallmodul \d+ · /, ""); };
  function Freischalten(p) {
    var sc = useState([]), courses = sc[0], setCourses = sc[1];
    var si = useState(""), cid = si[0], setCid = si[1];
    var ss = useState({ locked: [], hidden: [] }), st = ss[0], setSt = ss[1];
    var sb = useState(false), busy = sb[0], setBusy = sb[1];
    var sm = useState(null), msg = sm[0], setMsg = sm[1];
    var se = useState(null), err = se[0], setErr = se[1];
    useEffect(function () { window.FP_API.courses().then(function (c) { setCourses(c || []); if (c && c.length) pick(c[0]); }).catch(function (e) { setErr(e.message); }); }, []);
    function pick(c) { setCid(c.id); var s = c.settings || {}; setSt({ locked: (s.locked || []).slice(), hidden: (s.hidden || []).slice(), years: s.years || [], focus: (s.focus || []).slice(), phase: s.phase || "", coach: Object.assign({ name: "", rolle: "", email: "", telefon: "", zeiten: "" }, s.coach || {}) }); setMsg(null); }
    var course = courses.find(function (c) { return c.id === cid; });
    var mods = (window.FP_MODS || []).slice().sort(function (a, b) { return (a.year - b.year) || (a.order - b.order); });
    var state = function (id) { return st.hidden.indexOf(id) >= 0 ? "aus" : st.locked.indexOf(id) >= 0 ? "zu" : "frei"; };
    function setState(id, v) {
      setSt(function (x) { return Object.assign({}, x, { locked: x.locked.filter(function (i) { return i !== id; }).concat(v === "zu" ? [id] : []), hidden: x.hidden.filter(function (i) { return i !== id; }).concat(v === "aus" ? [id] : []) }); });
      setMsg(null);
    }
    function setYear(y, v) { mods.filter(function (m) { return Number(m.year) === y; }).forEach(function (m) { setState(m.id, v); }); }
    var inFocus = function (id) { return (st.focus || []).indexOf(id) >= 0; };
    function toggleFocus(id) { setSt(function (x) { var f = (x.focus || []).filter(function (i) { return i !== id; }); if ((x.focus || []).indexOf(id) < 0) f.push(id); return Object.assign({}, x, { focus: f }); }); setMsg(null); }
    function setCoach(k, v) { setSt(function (x) { var c = Object.assign({}, x.coach || {}); c[k] = v; return Object.assign({}, x, { coach: c }); }); setMsg(null); }
    var okMail = function (v) { return !v || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v); };
    var okTel = function (v) { return !v || /^[0-9+()\/\-\s]{5,30}$/.test(v); };
    async function save() {
      var co = st.coach || {};
      if (!okMail(String(co.email || "").trim())) { setErr("Die E-Mail-Adresse des Lerncoachs sieht nicht korrekt aus."); return; }
      if (!okTel(String(co.telefon || "").trim())) { setErr("Die Telefonnummer des Lerncoachs enthält ungültige Zeichen (erlaubt: Ziffern, +, -, /, Klammern)."); return; }
      setBusy(true); setErr(null);
      try {
        var s0 = course.settings || {};
        var clean2 = function (v, n) { return String(v || "").replace(/[<>]/g, "").trim().slice(0, n); };
        var coach = { name: clean2(co.name, 80), rolle: clean2(co.rolle, 80), email: clean2(co.email, 120), telefon: clean2(co.telefon, 30), zeiten: clean2(co.zeiten, 140) };
        var hatCoach = coach.name || coach.email || coach.telefon;
        var focus = (st.focus || []).filter(function (id) { return st.hidden.indexOf(id) < 0; });
        var neu = Object.assign({}, s0, { locked: st.locked, hidden: st.hidden, focus: focus, phase: clean2(st.phase, 120), coach: hatCoach ? coach : null });
        var saved = await window.FP_API.saveCourse(Object.assign({}, course, { settings: neu }));
        setCourses(function (cs) { return cs.map(function (c) { return c.id === course.id ? Object.assign({}, course, saved || {}, { settings: neu }) : c; }); });
        setMsg("Gespeichert. Die Lernenden sehen die Änderung beim nächsten Öffnen der App.");
        if (p.saved) p.saved();
      } catch (e) { setErr(/settings|column/i.test(e.message) ? "Die Kurs-Einstellungen können gerade nicht gespeichert werden. Ist live_unterricht.sql ausgeführt?" : e.message); }
      setBusy(false);
    }
    var count = function (v) { return mods.filter(function (m) { return state(m.id) === v; }).length; };
    return RD.createPortal(h("div", { className: "fxb-bg" }, h("div", { className: "fxb", role: "dialog", "aria-label": "Module freischalten" },
      h("header", { className: "fxb-head" }, h("div", null, h("span", { className: "fxp-eyebrow" }, "Kurssteuerung"), h("h2", null, "Module, Theoriephase und Lerncoach")), h("button", { type: "button", className: "iconbtn", "aria-label": "Schließen", onClick: p.close }, "×")),
      h("div", { className: "fxb-body" },
        h("p", { className: "muted", style: { marginTop: 0 } }, "Lege für jeden Kurs fest, welche Module die Lernenden schon bearbeiten können. Gesperrte Module sehen sie mit einem Schloss, damit klar ist, was noch kommt. Ausgeblendete sehen sie gar nicht. So schaltest du Module Schritt für Schritt passend zum Unterricht frei."),
        h("div", { className: "fxf-top" },
          h("div", { className: "field", style: { margin: 0, minWidth: 240 } }, h("label", { htmlFor: "fxf-c" }, "Kurs"), h("select", { id: "fxf-c", className: "input", value: cid, onChange: function (e) { var c = courses.find(function (x) { return x.id === e.target.value; }); if (c) pick(c); } }, courses.map(function (c) { return h("option", { key: c.id, value: c.id }, c.name); }))),
          h("div", { className: "fxf-sum" }, h("span", { className: "s-frei" }, h("b", null, count("frei")), " frei"), h("span", { className: "s-zu" }, h("b", null, count("zu")), " gesperrt"), h("span", { className: "s-aus" }, h("b", null, count("aus")), " ausgeblendet"))),
        h("section", { className: "fxf-phase" },
          h("h3", null, "Theoriephase: Bausteine statt starrem Jahresplan"),
          h("p", { className: "muted" }, "Jede Schule hat ein eigenes Curriculum. Markiere mit dem Stern, welche Module zum aktuellen Theorieblock gehören. Die Lernenden sehen sie ganz oben unter „Lernmodule“ und auf der Startseite. Das Ausbildungsjahr ist für sie nur noch eine Empfehlung."),
          h("div", { className: "field", style: { margin: 0 } }, h("label", { htmlFor: "fxf-ph" }, "Bezeichnung des Theorieblocks (optional)"), h("input", { id: "fxf-ph", className: "input", style: { width: "100%", maxWidth: "none" }, maxLength: 120, placeholder: "z. B. Theorieblock 3: Pflege bei Herz-Kreislauf-Erkrankungen", value: st.phase || "", onChange: function (e) { var v = e.target.value; setSt(function (x) { return Object.assign({}, x, { phase: v }); }); setMsg(null); } })),
          h("p", { className: "muted", style: { margin: "8px 0 0", fontSize: 13.5 } }, (st.focus || []).filter(function (id) { return st.hidden.indexOf(id) < 0; }).length + " Module markiert. Ohne Markierung sehen die Lernenden die Empfehlung nach Ausbildungsjahr.")),
        h("details", { className: "fxf-phase" },
          h("summary", null, h("b", null, "Lerncoach: Ansprechperson bei Lernschwierigkeiten"), h("span", { className: "muted" }, " (optional)")),
          h("p", { className: "muted" }, "Die Lernenden dieses Kurses sehen diese Kontaktdaten in der App unter „Wiederholen“. Trage nur dienstliche Kontaktdaten ein. Nur angemeldete Lernende des Kurses können sie abrufen."),
          h("div", { className: "fxf-coach" },
            [["name", "Name", "text", 80], ["rolle", "Funktion", "text", 80], ["email", "E-Mail", "email", 120], ["telefon", "Telefon", "tel", 30], ["zeiten", "Sprechzeiten", "text", 140]].map(function (f) {
              return h("div", { key: f[0], className: "field", style: { margin: 0 } }, h("label", { htmlFor: "fxf-co-" + f[0] }, f[1]), h("input", { id: "fxf-co-" + f[0], className: "input", type: f[2], maxLength: f[3], value: (st.coach || {})[f[0]] || "", onChange: function (e) { setCoach(f[0], e.target.value); } }));
            }))),
        st.years && st.years.length ? h("div", { className: "notice", style: { margin: "10px 0" } }, "Für diesen Kurs sind nur die Ausbildungsjahre " + st.years.join(", ") + " eingeschaltet (unter Kurse verwalten). Module anderer Jahre sieht der Kurs ohnehin nicht.") : null,
        [1, 2, 3].map(function (y) {
          var list = mods.filter(function (m) { return Number(m.year) === y; });
          if (!list.length) return null;
          return h("section", { key: y, className: "fxf-year", style: { "--c": YC[y] } },
            h("div", { className: "fxf-yh" }, h("b", null, y + ". Ausbildungsjahr"), h("span", { className: "muted" }, list.length + " Module"), h("div", { className: "fxp-sp" }), h("button", { type: "button", className: "btn ghost sm", onClick: function () { setYear(y, "frei"); } }, "Alle freischalten"), h("button", { type: "button", className: "btn ghost sm", onClick: function () { setYear(y, "zu"); } }, "Alle sperren")),
            h("div", { className: "fxf-list" }, list.map(function (m, i) {
              var v = state(m.id);
              return h("div", { key: m.id, className: "fxf-row s-" + v }, h("span", { className: "fxf-n" }, i + 1), h("div", { className: "fxf-t" }, h("b", null, clean(m.title)), m.subtitle && h("small", null, m.subtitle)),
                h("button", { type: "button", className: "fxf-star" + (inFocus(m.id) ? " on" : ""), "aria-pressed": inFocus(m.id), title: "Gehört zur aktuellen Theoriephase", "aria-label": "Theoriephase: " + clean(m.title), disabled: v === "aus", onClick: function () { toggleFocus(m.id); } }, inFocus(m.id) ? "★" : "☆"),
                h("div", { className: "fxf-seg", role: "radiogroup", "aria-label": "Status " + clean(m.title) }, [["frei", "Frei"], ["zu", "Gesperrt"], ["aus", "Aus"]].map(function (o) { return h("button", { key: o[0], type: "button", role: "radio", "aria-checked": v === o[0], className: v === o[0] ? "on " + o[0] : "", onClick: function () { setState(m.id, o[0]); } }, o[1]); })));
            })));
        })),
      err && h("div", { className: "notice bad", style: { margin: "0 22px" } }, err),
      h("footer", { className: "fxb-foot" }, msg ? h("span", { className: "fxf-ok" }, msg) : h("span", { className: "muted" }, course ? course.name : ""), h("div", { className: "fxp-sp" }), h("button", { type: "button", className: "btn ghost", onClick: p.close }, "Schließen"), h("button", { type: "button", className: "btn", disabled: busy || !course, onClick: save }, "Speichern"))
    )), document.body);
  }
  var host = null, root = null;
  window.FP_FREISCHALTEN = { open: function () { if (!host) { host = document.createElement("div"); document.body.appendChild(host); root = RD.createRoot(host); } root.render(h(Freischalten, { key: Date.now(), close: function () { root.render(null); } })); } };
  function addBtn() {
    document.querySelectorAll("main .btn").forEach(function (b) {
      if (!/^Neues Modul$/.test((b.textContent || "").trim())) return;
      var par = b.parentNode;
      if (par.querySelector(".fx-frbtn")) return;
      var x = document.createElement("button");
      x.type = "button"; x.className = "btn ghost fx-frbtn";
      x.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>Für Kurse freischalten';
      x.addEventListener("click", function (e) { e.preventDefault(); window.FP_FREISCHALTEN.open(); });
      par.appendChild(x);
    });
  }
  var q = false;
  new MutationObserver(function () { if (q) return; q = true; requestAnimationFrame(function () { q = false; addBtn(); }); }).observe(document.documentElement, { childList: true, subtree: true });
})();

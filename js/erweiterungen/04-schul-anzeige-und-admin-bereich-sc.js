/* Lehrer-Portal: Schul-Anzeige und Admin-Bereich "Schulen" (nur für Rolle admin). */
(function () {
  var R = window.React;
  if (!R) return;
  var h = R.createElement, useState = R.useState, useEffect = R.useEffect;
  function rpc(fn, args) {
    return window.FP_SB().then(function (c) { return c.rpc(fn, args || {}); }).then(function (r) { if (r.error) throw new Error(r.error.message); return r.data; });
  }
  /* Schule oben im Portal anzeigen */
  var schoolName = null, asked = false;
  function badge() {
    var t = document.querySelector(".topbar .t");
    if (!t) return;
    if (!asked) {
      asked = true;
      if (!window.FP_SB) { schoolName = "Pflegeschule am Klinikum Beispielstadt"; window.FP_SCHOOL_NAME = schoolName; }
      else rpc("fp_my_school").then(function (d) {
        var r = d && d[0];
        window.FP_ME_ROLE = r ? r.rolle : null;
        schoolName = r ? (r.name || (r.rolle === "admin" ? "Alle Schulen (Administration)" : "")) : ""; window.FP_SCHOOL_NAME = r && r.name ? r.name : "";
        badge();
      }).catch(function () { schoolName = ""; });
    }
    if (!schoolName) return;
    var b = t.querySelector(".fx-school");
    if (b && b.textContent === schoolName) return;
    if (!b) { b = document.createElement("span"); b.className = "fx-school"; t.appendChild(b); }
    b.textContent = schoolName;
  }
  window.FP_SCHOOL_RELOAD = function () { asked = false; schoolName = null; badge(); };
  new MutationObserver(function () { badge(); }).observe(document.documentElement, { childList: true, subtree: true });

  var fmt = function (d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"; };
  function SchoolForm(p) {
    var s = p.s || {}, st = useState({ name: s.name || "", ort: s.ort || "", kontakt: s.kontakt || "", max: s.max_lernende || "", notiz: s.notiz || "", aktiv: s.aktiv !== false }), f = st[0], setF = st[1];
    var b = useState(false), busy = b[0], setBusy = b[1];
    var set = function (k, v) { setF(function (x) { var y = Object.assign({}, x); y[k] = v; return y; }); };
    return h("form", { className: "adm-form", onSubmit: function (e) {
      e.preventDefault(); setBusy(true);
      rpc("fp_admin_school_save", { p_id: s.id || null, p_name: f.name, p_ort: f.ort || null, p_kontakt: f.kontakt || null, p_aktiv: f.aktiv, p_max: f.max ? Number(f.max) : null, p_notiz: f.notiz || null })
        .then(function () { p.done(); }).catch(function (x) { p.err(x.message); }).then(function () { setBusy(false); });
    } },
      h("div", { className: "adm-row" },
        h("div", { className: "field" }, h("label", { htmlFor: "as-n" }, "Name der Schule"), h("input", { id: "as-n", className: "input", required: true, minLength: 2, value: f.name, onChange: function (e) { set("name", e.target.value); }, placeholder: "z. B. Pflegeschule am Klinikum Musterstadt" })),
        h("div", { className: "field" }, h("label", { htmlFor: "as-o" }, "Ort"), h("input", { id: "as-o", className: "input", value: f.ort, onChange: function (e) { set("ort", e.target.value); } }))),
      h("div", { className: "adm-row" },
        h("div", { className: "field" }, h("label", { htmlFor: "as-k" }, "Ansprechperson / Kontakt"), h("input", { id: "as-k", className: "input", value: f.kontakt, onChange: function (e) { set("kontakt", e.target.value); }, placeholder: "Name, E-Mail, Telefon" })),
        h("div", { className: "field" }, h("label", { htmlFor: "as-m" }, "Lizenz: max. Lernende (optional)"), h("input", { id: "as-m", className: "input", type: "number", min: 1, value: f.max, onChange: function (e) { set("max", e.target.value); } }))),
      h("div", { className: "field" }, h("label", { htmlFor: "as-x" }, "Notiz (nur für dich)"), h("textarea", { id: "as-x", className: "input", rows: 2, value: f.notiz, onChange: function (e) { set("notiz", e.target.value); } })),
      h("label", { className: "adm-check" }, h("input", { type: "checkbox", checked: f.aktiv, onChange: function (e) { set("aktiv", e.target.checked); } }), h("span", null, h("b", null, "Freigeschaltet"), h("small", null, "Ausgeschaltet sehen Lehrkräfte und Lernende dieser Schule keine Daten mehr."))),
      h("div", { className: "row", style: { gap: 8 } }, h("button", { type: "submit", className: "btn", disabled: busy }, s.id ? "Speichern" : "Schule anlegen"), h("button", { type: "button", className: "btn ghost", onClick: p.cancel }, "Abbrechen")));
  }
  function SchoolDetail(p) {
    var s = p.s;
    var c = useState(null), codes = c[0], setCodes = c[1];
    var pp = useState(null), people = pp[0], setPeople = pp[1];
    var n = useState(2), anz = n[0], setAnz = n[1];
    var sl = useState(false), leit = sl[0], setLeit = sl[1];
    var fr = useState(null), fresh = fr[0], setFresh = fr[1];
    var ed = useState(false), edit = ed[0], setEdit = ed[1];
    var load = function () {
      rpc("fp_admin_codes", { p_school: s.id }).then(setCodes).catch(function (x) { p.err(x.message); });
      rpc("fp_admin_people", { p_school: s.id }).then(setPeople).catch(function (x) { p.err(x.message); });
    };
    useEffect(load, [s.id]);
    var mail = fresh ? "Hallo,\n\nhier sind eure Zugänge zum Fallpfad Lehrer-Portal (" + s.name + "):\n\nJede Person nutzt einen eigenen Link (jeder Code gilt einmal). Der Link öffnet die Registrierung mit eingetragenem Code, danach nur noch die E-Mail bestätigen:\n\n" + fresh.map(function (c) { return location.origin + location.pathname + "?einladung=" + c + "   (Code " + c + ")"; }).join("\n") + "\n\nViele Grüße" : "";
    return h("div", { className: "card adm-detail" },
      h("div", { className: "row", style: { justifyContent: "space-between", alignItems: "flex-start", gap: 12 } },
        h("div", null, h("div", { className: "eyebrow" }, s.aktiv ? "Freigeschaltet" : "Gesperrt"), h("h2", { style: { margin: "6px 0 2px" } }, s.name), h("p", { className: "muted", style: { margin: 0 } }, [s.ort, s.kontakt].filter(Boolean).join(" · ") || "Keine weiteren Angaben")),
        h("div", { className: "row", style: { gap: 8 } }, h("button", { type: "button", className: "btn ghost sm", onClick: function () { setEdit(!edit); } }, edit ? "Schließen" : "Bearbeiten"), h("button", { type: "button", className: "btn sm", onClick: function () { p.view(s.id); } }, "Als diese Schule ansehen"), h("button", { type: "button", className: "iconbtn", "aria-label": "Zurück", onClick: p.close }, "×"))),
      edit && h(SchoolForm, { s: s, done: function () { setEdit(false); p.reload(); }, cancel: function () { setEdit(false); }, err: p.err }),
      h("div", { className: "adm-kpis" }, [["Lehrkräfte", s.lehrkraefte], ["Lernende", s.lernende + (s.max_lernende ? " / " + s.max_lernende : "")], ["Kurse", s.kurse], ["Eigene Module", s.module], ["Zuletzt aktiv", fmt(s.zuletzt_aktiv)]].map(function (k, i) { return h("div", { key: i }, h("b", null, k[1]), h("small", null, k[0])); })),
      h("h3", null, "Lehrkräfte einladen"),
      h("p", { className: "muted" }, "Jeder Code schaltet genau ein Konto als Lehrkraft dieser Schule frei. Lernende brauchen keinen Code: Sie treten mit dem Kurscode bei, den die Lehrkraft unter Kurse findet."),
      h("div", { className: "row", style: { gap: 10, alignItems: "flex-end" } },
        h("div", { className: "field", style: { margin: 0 } }, h("label", { htmlFor: "ac-n" }, "Anzahl"), h("input", { id: "ac-n", className: "input", type: "number", min: 1, max: 50, value: anz, style: { width: 90 }, onChange: function (e) { setAnz(e.target.value); } })),
        h("label", { className: "adm-check sm" }, h("input", { type: "checkbox", checked: leit, onChange: function (e) { setLeit(e.target.checked); } }), h("span", null, h("b", null, "als Schulleitung"))),
        h("button", { type: "button", className: "btn", onClick: function () { rpc("fp_admin_invites", { p_school: s.id, p_anzahl: Number(anz) || 1, p_schulleitung: leit }).then(function (d) { setFresh(d); load(); p.reload(true); }).catch(function (x) { p.err(x.message); }); } }, "Codes erzeugen")),
      fresh && h("div", { className: "adm-fresh" }, h("div", { className: "adm-codes" }, fresh.map(function (c) { return h("code", { key: c }, c); })), h("textarea", { className: "input", rows: 7, readOnly: true, value: mail, onFocus: function (e) { e.target.select(); } }), h("button", { type: "button", className: "btn ghost sm", onClick: function () { try { navigator.clipboard.writeText(mail); } catch (e) {} } }, "Text kopieren")),
      h("h3", null, "Lehrkräfte"),
      !people ? h("p", { className: "muted" }, "Wird geladen …") : !people.length ? h("p", { className: "muted" }, "Noch keine Lehrkraft. Erzeuge oben einen Code.") :
        h("div", { className: "adm-list" }, people.map(function (u) {
          return h("div", { key: u.id, className: "adm-li" }, h("div", null, h("b", null, u.display_name || u.email), h("small", null, u.email + (u.schulleitung ? " · Schulleitung" : "") + (u.role === "admin" ? " · Administration" : ""))),
            u.role !== "admin" && h("div", { className: "row", style: { gap: 6 } },
              h("button", { type: "button", className: "btn ghost sm", onClick: function () { rpc("fp_admin_person", { p_user: u.id, p_school: null, p_role: null, p_schulleitung: !u.schulleitung }).then(load).catch(function (x) { p.err(x.message); }); } }, u.schulleitung ? "Schulleitung entfernen" : "Zur Schulleitung"),
              h("button", { type: "button", className: "btn ghost sm", onClick: function () { if (confirm("Lehrkraft-Zugang von " + (u.display_name || u.email) + " entziehen? Das Konto bleibt bestehen, sieht aber das Portal nicht mehr.")) rpc("fp_admin_person", { p_user: u.id, p_school: null, p_role: "student", p_schulleitung: false }).then(load).catch(function (x) { p.err(x.message); }); } }, "Zugang entziehen")));
        })),
      h("h3", null, "Einladungscodes"),
      !codes ? null : !codes.length ? h("p", { className: "muted" }, "Noch keine Codes.") : h("div", { className: "adm-list" }, codes.map(function (c) {
        return h("div", { key: c.code, className: "adm-li" }, h("div", null, h("code", null, c.code), h("small", null, (c.schulleitung ? "Schulleitung · " : "") + "erstellt " + fmt(c.created_at))), h("span", { className: "pill " + (c.used_at ? "ok" : "") }, c.used_at ? "benutzt von " + (c.used_email || "?") : "offen"));
      })));
  }
  /* Freischaltungs-Anfragen: Konten, die sich im Lehrer-Portal registriert haben, aber noch keine Lehrkraft sind */
  function Anfragen(p) {
    var a = useState(null), list = a[0], setList = a[1];
    var w = useState({}), wahl = w[0], setWahl = w[1];
    var m = useState({ email: "", school: "", leit: false }), man = m[0], setMan = m[1];
    var o = useState(null), ok = o[0], setOk = o[1];
    var b = useState(false), busy = b[0], setBusy = b[1];
    var schools = p.schools || [];
    var def = schools.length === 1 ? schools[0].id : "";
    var load = function () { rpc("fp_admin_anfragen").then(function (d) { setList(d || []); }).catch(function (x) { setList([]); p.err(x.message); }); };
    useEffect(load, []);
    var pick = function (id, k, v) { setWahl(function (x) { var y = Object.assign({}, x); y[id] = Object.assign({ school: def, leit: false }, y[id]); y[id][k] = v; return y; }); };
    var frei = function (u) {
      var c = Object.assign({ school: def, leit: false }, wahl[u.id]);
      if (!c.school) { p.err("Bitte zuerst eine Schule wählen."); return; }
      setBusy(true);
      rpc("fp_admin_freischalten", { p_user: u.id, p_school: c.school, p_schulleitung: !!c.leit })
        .then(function () { setOk((u.name || u.email) + " ist jetzt Lehrkraft."); load(); p.reload(); })
        .catch(function (x) { p.err(x.message); }).then(function () { setBusy(false); });
    };
    var ab = function (u) {
      if (!confirm("Anfrage von " + (u.name || u.email) + " ablehnen? Das Konto bleibt bestehen, sieht das Lehrer-Portal aber nicht.")) return;
      rpc("fp_admin_ablehnen", { p_user: u.id }).then(load).catch(function (x) { p.err(x.message); });
    };
    var perMail = function (e) {
      e.preventDefault();
      var sc = man.school || def;
      if (!sc) { p.err("Bitte eine Schule wählen."); return; }
      setBusy(true);
      rpc("fp_admin_freischalten_email", { p_email: man.email, p_school: sc, p_schulleitung: man.leit })
        .then(function () { setOk(man.email + " ist jetzt Lehrkraft."); setMan({ email: "", school: man.school, leit: false }); load(); p.reload(); })
        .catch(function (x) { p.err(x.message); }).then(function () { setBusy(false); });
    };
    var sel = function (val, on, id) {
      return h("select", { className: "input", id: id, value: val, onChange: function (ev) { on(ev.target.value); }, style: { minWidth: 180 } },
        h("option", { value: "" }, "Schule wählen …"), schools.map(function (s) { return h("option", { key: s.id, value: s.id }, s.name + (s.aktiv ? "" : " (gesperrt)")); }));
    };
    var fmtd = function (d) { return d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""; };
    return h("div", { className: "card adm-anfragen" },
      h("div", { className: "row", style: { justifyContent: "space-between", alignItems: "baseline", gap: 10 } },
        h("h3", { style: { margin: 0 } }, "Lehrkräfte freischalten"),
        list && list.length ? h("span", { className: "pill warn" }, list.length + (list.length === 1 ? " Anfrage" : " Anfragen")) : null),
      h("p", { className: "muted" }, "Wer sich im Lehrer-Portal registriert, erscheint hier, bis du das Konto einer Schule zuordnest. Alternativ löst die Person einen Einladungscode ein (unten bei der jeweiligen Schule)."),
      ok && h("div", { className: "notice ok", role: "status" }, ok, " ", h("button", { type: "button", className: "skip", onClick: function () { setOk(null); } }, "OK")),
      !list ? h("p", { className: "muted" }, "Wird geladen …") : !list.length ? h("p", { className: "muted" }, "Keine offenen Anfragen.") :
        h("div", { className: "adm-list" }, list.map(function (u) {
          var c = Object.assign({ school: def, leit: false }, wahl[u.id]);
          return h("div", { key: u.id, className: "adm-li", style: { flexWrap: "wrap", gap: 10 } },
            h("div", { style: { minWidth: 200, flex: "1 1 220px" } }, h("b", null, u.name || u.email), h("small", null, u.email + " · registriert " + fmtd(u.registriert) + (u.bestaetigt ? "" : " · E-Mail noch nicht bestätigt") + (u.code ? " · eingegebener Code " + u.code + " war ungültig" : ""))),
            h("div", { className: "row", style: { gap: 8, flexWrap: "wrap", alignItems: "center" } },
              sel(c.school, function (v) { pick(u.id, "school", v); }),
              h("label", { className: "adm-check sm" }, h("input", { type: "checkbox", checked: !!c.leit, onChange: function (e) { pick(u.id, "leit", e.target.checked); } }), h("span", null, h("b", null, "Schulleitung"))),
              h("button", { type: "button", className: "btn sm", disabled: busy, onClick: function () { frei(u); } }, "Freischalten"),
              h("button", { type: "button", className: "btn ghost sm", disabled: busy, onClick: function () { ab(u); } }, "Ablehnen")));
        })),
      h("details", { style: { marginTop: 14 } }, h("summary", { style: { cursor: "pointer", fontWeight: 600 } }, "Bestehendes Konto per E-Mail-Adresse freischalten"),
        h("form", { className: "row", style: { gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }, onSubmit: perMail },
          h("div", { className: "field", style: { margin: 0, flex: "1 1 220px" } }, h("label", { htmlFor: "af-m" }, "E-Mail-Adresse"), h("input", { id: "af-m", className: "input", type: "email", required: true, value: man.email, onChange: function (e) { setMan(Object.assign({}, man, { email: e.target.value })); } })),
          h("div", { className: "field", style: { margin: 0 } }, h("label", { htmlFor: "af-s" }, "Schule"), sel(man.school || def, function (v) { setMan(Object.assign({}, man, { school: v })); }, "af-s")),
          h("label", { className: "adm-check sm" }, h("input", { type: "checkbox", checked: man.leit, onChange: function (e) { setMan(Object.assign({}, man, { leit: e.target.checked })); } }), h("span", null, h("b", null, "Schulleitung"))),
          h("button", { type: "submit", className: "btn", disabled: busy || !man.email }, "Freischalten"))));
  }
  function AdminPage(pp) {
    pp = pp || {};
    var l = useState(null), list = l[0], setList = l[1];
    var e = useState(null), err = e[0], setErr = e[1];
    var o = useState(null), open = o[0], setOpen = o[1];
    var n = useState(false), neu = n[0], setNeu = n[1];
    var v = useState(null), view = v[0], setView = v[1];
    var load = function () {
      rpc("fp_admin_schools").then(function (d) { setList(d || []); }).catch(function (x) { setErr(x.message); });
      rpc("fp_my_school").then(function (d) { setView(d && d[0] ? d[0].id : null); }).catch(function () {});
    };
    useEffect(load, []);
    var doView = function (id) {
      rpc("fp_admin_view", { p_school: id }).then(function () { location.hash = "start"; location.reload(); }).catch(function (x) { setErr(x.message); });
    };
    if (!window.FP_SB) return h("div", { className: "wrap wide" }, h("div", { className: "hello" }, h("div", { className: "eyebrow" }, "Plattform-Administration"), h("h1", null, "Schulen")), h("div", { className: "card" }, h("p", { className: "muted" }, "Im Demo-Modus gibt es keine Schulverwaltung.")));
    var cur = open && list && list.find(function (x) { return x.id === open; });
    var tot = (list || []).reduce(function (a, s) { a.l += Number(s.lernende) || 0; a.t += Number(s.lehrkraefte) || 0; return a; }, { l: 0, t: 0 });
    return h("div", { className: "wrap wide" },
      !pp.eingebettet && h("div", { className: "hello" }, h("div", { className: "eyebrow" }, "Plattform-Administration"), h("h1", { style: { marginTop: 8 } }, "Schulen"), h("p", null, "Hier legst du Schulen an, schaltest sie frei, erzeugst Einladungscodes für Lehrkräfte und siehst, wie aktiv jede Schule ist. Jede Schule sieht nur ihre eigenen Daten.")),
      err && h("div", { className: "notice bad" }, err, " ", h("button", { type: "button", className: "skip", onClick: function () { setErr(null); } }, "Ausblenden")),
      list && !pp.eingebettet && h(Anfragen, { schools: list, err: setErr, reload: load }),
      h("div", { className: "card adm-view" }, h("div", null, h("b", null, "Ansicht im Portal"), h("small", null, view ? "Du siehst gerade das Portal wie eine Lehrkraft dieser Schule." : "Du siehst gerade die Daten aller Schulen zusammen.")),
        h("select", { className: "input", value: view || "", onChange: function (ev) { doView(ev.target.value || null); } }, h("option", { value: "" }, "Alle Schulen"), (list || []).map(function (s) { return h("option", { key: s.id, value: s.id }, s.name); }))),
      h("div", { className: "row", style: { justifyContent: "space-between", margin: "22px 0 10px" } }, h("h2", { style: { margin: 0, fontSize: 20 } }, (list ? list.length : 0) + " Schulen · " + tot.t + " Lehrkräfte · " + tot.l + " Lernende"), h("button", { type: "button", className: "btn", onClick: function () { setNeu(true); setOpen(null); } }, "+ Neue Schule")),
      neu && h("div", { className: "card" }, h("h3", { style: { marginTop: 0 } }, "Neue Schule"), h(SchoolForm, { s: null, done: function () { setNeu(false); load(); }, cancel: function () { setNeu(false); }, err: setErr })),
      cur && h(SchoolDetail, { s: cur, close: function () { setOpen(null); }, reload: load, view: doView, err: setErr }),
      !list ? h("p", { className: "muted" }, "Wird geladen …") : h("div", { className: "adm-grid" }, list.map(function (s) {
        return h("button", { key: s.id, type: "button", className: "card adm-card" + (open === s.id ? " on" : ""), onClick: function () { setOpen(s.id); setNeu(false); window.scrollTo({ top: 0, behavior: "smooth" }); } },
          h("div", { className: "row", style: { justifyContent: "space-between", gap: 8 } }, h("span", { className: "eyebrow" }, s.ort || "Schule"), h("span", { className: "pill " + (s.aktiv ? "ok" : "bad") }, s.aktiv ? "aktiv" : "gesperrt")),
          h("b", { className: "adm-name" }, s.name),
          h("div", { className: "adm-mini" }, h("span", null, h("b", null, s.lehrkraefte), " Lehrkräfte"), h("span", null, h("b", null, s.lernende), " Lernende"), h("span", null, h("b", null, s.kurse), " Kurse")),
          h("small", { className: "muted" }, "Zuletzt aktiv: " + fmt(s.zuletzt_aktiv) + (Number(s.offene_codes) ? " · " + s.offene_codes + " offene Codes" : "")));
      })));
  }
  window.FP_AdminPage = AdminPage;
  window.FP_AdminSchulen = AdminPage;
  window.FP_AdminAnfragen = Anfragen;
})();

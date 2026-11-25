/* Lehrer-Portal: Quellenregister (nur Rolle admin, Admin-Zentrale → Reiter „Quellen“).
   Lernende und Lehrkräfte sehen in den Lerninhalten keine Literaturangaben. Alle Belege der
   Fallpfad-Inhalte liegen in daten/quellen-register.json (Werkzeuge: schueler werkzeuge/quellen/)
   und werden hier je Modul, je Textstelle und als Gesamtliste mit DOI bzw. Link und Prüfstatus gezeigt. */
(function () {
  var R = window.React;
  if (!R) return;
  var h = R.createElement, useState = R.useState, useEffect = R.useEffect, useMemo = R.useMemo;

  /* Register einmal laden und zwischenspeichern (auch für die Übersicht der Admin-Zentrale) */
  var cache = null;
  function laden() {
    if (!cache) cache = fetch("daten/quellen-register.json", { cache: "no-store" }).then(function (x) { if (!x.ok) throw new Error("HTTP " + x.status); return x.json(); }).catch(function (e) { cache = null; throw e; });
    return cache;
  }
  var GEPRUEFT = ["apa7_geprueft", "inhalt_verifiziert", "rechtsquelle"];
  window.FP_QuellenStatus = function () {
    return laden().then(function (r) {
      var l = Object.keys(r.quellen).map(function (k) { return r.quellen[k]; }).filter(function (q) { return q.status !== "alias"; });
      var g = l.filter(function (q) { return GEPRUEFT.indexOf(q.status) >= 0; }).length;
      return { gesamt: l.length, geprueft: g, offen: l.length - g };
    });
  };

  /* Reihenfolge = Darstellung im Balken */
  var STATUS = [
    ["inhalt_verifiziert", "Inhalt verifiziert", "#16a34a", "Aussage an der Belegstelle gelesen (Prüfprotokoll)"],
    ["apa7_geprueft", "Mit PubMed geprüft", "#2563eb", "DOI, Autorenliste, Heft und Seiten mit dem PubMed-Datensatz abgeglichen"],
    ["rechtsquelle", "Rechtsquelle verlinkt", "#0d9488", "Gesetz oder Verordnung mit amtlicher Fundstelle"],
    ["apa7_formal", "Formal aufbereitet", "#f59e0b", "nach APA 7 formatiert, Angaben noch nicht am Original geprüft"],
    ["formal_ungeprueft", "Ungeprüft", "#94a3b8", "so übernommen, wie sie im Modul stand"]
  ];
  var SMAP = {}; STATUS.forEach(function (s) { SMAP[s[0]] = s; });

  var CSS = [
    ".qa2-sum{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center}",
    ".qa2-sum .big{font-size:34px;font-weight:750;letter-spacing:-.03em;line-height:1}.qa2-sum .big small{font-size:15px;font-weight:600;color:var(--muted,#64748b);letter-spacing:0;margin-left:6px}",
    ".qa2-bar{display:flex;height:12px;border-radius:12px;overflow:hidden;background:var(--surface2,#eef2f7);margin:14px 0 12px}.qa2-bar i{display:block;height:100%}",
    ".qa2-leg{display:flex;flex-wrap:wrap;gap:6px}.qa2-leg button{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:5px 10px;border-radius:999px;font-size:13px;background:var(--surface2,#f1f5f9);color:var(--fg,#111)}",
    ".qa2-leg button[aria-pressed=true]{background:var(--accent-soft,#e8f0ff);color:var(--accent,#0062FF);font-weight:600}.qa2-leg i{width:9px;height:9px;border-radius:50%;background:var(--c)}.qa2-leg b{font-weight:700}",
    ".qa2-tool{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:18px 0 6px}.qa2-tool .input{flex:1 1 260px;max-width:none}",
    ".qa2-mod{border-radius:18px;background:var(--surface,#fff);border:1px solid var(--line,#e5e7eb);box-shadow:var(--shadow,none);margin-bottom:10px;overflow:hidden}",
    ".qa2-mod>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:12px;padding:14px 16px}.qa2-mod>summary::-webkit-details-marker{display:none}",
    ".qa2-mod>summary .nr{flex:0 0 auto;width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:13px;color:var(--kc);background:color-mix(in srgb,var(--kc) 13%,transparent)}",
    ".qa2-mod>summary .tt{flex:1;min-width:0}.qa2-mod>summary .tt b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qa2-mod>summary .tt small{color:var(--muted,#64748b);font-size:12.5px}",
    ".qa2-mod>summary .mini{display:flex;height:6px;width:90px;border-radius:6px;overflow:hidden;background:var(--surface2,#eef2f7);flex:0 0 auto}.qa2-mod>summary .mini i{display:block;height:100%}",
    ".qa2-mod>summary::after{content:'';width:8px;height:8px;border-right:2px solid var(--muted,#94a3b8);border-bottom:2px solid var(--muted,#94a3b8);transform:rotate(45deg);margin:0 4px 4px;transition:transform .2s}",
    ".qa2-mod[open]>summary::after{transform:rotate(-135deg);margin-bottom:-2px}.qa2-mod[open]>summary{border-bottom:1px solid var(--line,#eef0f3)}",
    ".qa2-in{padding:6px 16px 14px}.qa2-h{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#64748b);margin:16px 0 4px}",
    ".qa2-ref{padding:10px 0;border-bottom:1px solid var(--line,#f1f3f5);font-size:14px;line-height:1.55}.qa2-ref:last-child{border-bottom:0}",
    ".qa2-ref .apa{padding-left:1.6em;text-indent:-1.6em}.qa2-ref a{word-break:break-all;color:var(--accent,#0062FF)}",
    ".qa2-ref .meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px;font-size:12.5px;color:var(--muted,#64748b)}",
    ".qa2-ref ul.hw{margin:6px 0 0;padding-left:18px;color:#b45309;font-size:12.5px}.qa2-ref ul.lk{list-style:none;margin:6px 0 0;padding:0;font-size:13px}",
    ".qa2-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:650;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent)}",
    ".qa2-pill.mod{--c:var(--muted,#64748b);font-weight:600}",
    ".qa2-st{margin:10px 0;padding:12px 14px;border-radius:14px;background:var(--surface2,#f6f7f9)}.qa2-st .o{font-weight:650;font-size:14px}",
    ".qa2-st .x{color:var(--muted,#64748b);margin:4px 0;font-size:13.5px}.qa2-st .z{font-size:12.5px;color:#7c3aed;margin-top:4px}",
    ".qa2-alias{font-size:12.5px;color:var(--muted,#64748b);margin-top:8px}",
    ".qa2-tool .az-seg{max-width:100%;overflow-x:auto;scrollbar-width:none}.qa2-tool .az-seg button{white-space:nowrap}",
    "@media (max-width:640px){.qa2-sum{grid-template-columns:1fr}.qa2-mod>summary .mini{display:none}}"
  ].join("");
  function useCss() { useEffect(function () { if (document.getElementById("qa2-css")) return; var s = document.createElement("style"); s.id = "qa2-css"; s.textContent = CSS; document.head.appendChild(s); }, []); }

  var FARBEN = { 1: "#2563eb", 2: "#0d9488", 3: "#9333ea" };
  function doiLink(d) { return d ? "https://doi.org/" + String(d).replace(/^https?:\/\/doi\.org\//, "") : null; }
  function txt(s) { return String(s || "").toLowerCase(); }
  function eff(Q, id) { var q = Q[id]; return q && q.alias_von && Q[q.alias_von] ? q.alias_von : id; }
  function apaText(q) { return (q && (q.apa7 || q.apa)) || ""; }
  function Pill(p) { var s = SMAP[p.s] || SMAP.formal_ungeprueft; return h("span", { className: "qa2-pill", style: { "--c": s[2] }, title: s[3] }, s[1]); }

  function Apa(p) {
    var q = p.q, T = q.apa7_teile;
    if (!T) return h("span", null, apaText(q));
    return h("span", null, T.autoren + " (" + T.jahr + "). " + T.titel + " ", h("i", null, T.zeitschrift + ", " + T.band), (T.heft ? "(" + T.heft + ")" : "") + ", " + T.seiten + ".");
  }

  function Ref(p) {
    var Q = p.alle, q = Q[p.id];
    if (!q) return h("div", { className: "qa2-ref" }, h("i", null, "Unbekannte Quelle " + p.id));
    if (q.alias_von && Q[q.alias_von]) return h("div", null, h(Ref, { id: q.alias_von, alle: Q, mods: p.mods }), h("div", { className: "qa2-alias" }, "Im Modul gekürzt angegeben: „" + q.apa + "“"));
    var dl = doiLink(q.doi), link = dl || q.url;
    return h("div", { className: "qa2-ref" },
      h("div", { className: "apa" }, h(Apa, { q: q }), link ? h("span", null, " ", h("a", { href: link, target: "_blank", rel: "noopener noreferrer" }, link)) : null),
      q.links && q.links.length ? h("ul", { className: "lk" }, q.links.map(function (l, i) { return h("li", { key: i }, l.text + " – ", h("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.url)); })) : null,
      h("div", { className: "meta" }, h(Pill, { s: q.status }),
        q.pmid ? h("a", { href: "https://pubmed.ncbi.nlm.nih.gov/" + q.pmid + "/", target: "_blank", rel: "noopener noreferrer" }, "PMID " + q.pmid) : null,
        p.mods && p.mods[p.id] ? h("span", null, "Verwendet in " + p.mods[p.id].join(", ")) : null),
      q.belegstelle ? h("div", { className: "meta" }, "Belegstelle: " + q.belegstelle) : null,
      q.maengel && q.maengel.length ? h("ul", { className: "hw" }, q.maengel.map(function (m, i) { return h("li", { key: i }, m); })) : null);
  }

  function csv(reg) {
    var Q = reg.quellen, rows = [["Modul", "Ort", "Textauszug", "Im Text entfernt", "Quelle (APA 7)", "DOI", "URL", "PMID", "Status", "Hinweise"]];
    function zeile(mid, ort, aus, entf, id) {
      var k = id ? eff(Q, id) : null, q = k ? Q[k] || {} : {};
      rows.push([mid, ort, aus, entf, apaText(q), q.doi || "", q.url || "", q.pmid || "", (SMAP[q.status] || ["", ""])[1], (q.maengel || []).join(" | ")]);
    }
    (reg.module || []).forEach(function (m) {
      (m.quellenverzeichnis || []).forEach(function (id) { zeile(m.id, "Quellenverzeichnis", "", "", id); });
      (m.stellen || []).forEach(function (s) { (s.quellen.length ? s.quellen : [null]).forEach(function (id) { zeile(m.id, s.ort, s.text_auszug, (s.zitate_im_text_entfernt || []).join("; "), id); }); });
    });
    (reg.weitere || []).forEach(function (w) { (w.quellen || []).forEach(function (id) { zeile("weitere", w.ort, "", "", id); }); });
    var body = rows.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"'; }).join(";"); }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
    a.download = "fallpfad-quellenregister-" + (reg.stand || "") + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  }

  function Mini(p) {
    var n = p.ids.length || 1, c = {};
    p.ids.forEach(function (id) { var s = (p.Q[id] || {}).status || "formal_ungeprueft"; c[s] = (c[s] || 0) + 1; });
    return h("span", { className: "mini", title: STATUS.filter(function (s) { return c[s[0]]; }).map(function (s) { return c[s[0]] + " " + s[1]; }).join(", ") },
      STATUS.map(function (s) { return c[s[0]] ? h("i", { key: s[0], style: { width: (100 * c[s[0]] / n) + "%", background: s[2] } }) : null; }));
  }

  function Quellen() {
    useCss();
    var r = useState(null), reg = r[0], setReg = r[1];
    var e = useState(null), err = e[0], setErr = e[1];
    var s = useState(""), such = s[0], setSuch = s[1];
    var f = useState(null), filt = f[0], setFilt = f[1];
    var a = useState("modul"), ansicht = a[0], setAnsicht = a[1];
    useEffect(function () { laden().then(setReg).catch(function (x) { setErr(x.message); }); }, []);
    var Q = (reg && reg.quellen) || {};
    var ids = useMemo(function () { return Object.keys(Q).filter(function (k) { return Q[k].status !== "alias"; }); }, [reg]);
    var zahl = useMemo(function () { var c = {}; ids.forEach(function (k) { var st = Q[k].status || "formal_ungeprueft"; c[st] = (c[st] || 0) + 1; }); return c; }, [ids]);
    /* wo wird eine Quelle verwendet? */
    var mods = useMemo(function () {
      var m = {}; if (!reg) return m;
      reg.module.forEach(function (x) {
        var nr = x.id.replace("fm", "FM ");
        [].concat.apply(x.quellenverzeichnis || [], (x.stellen || []).map(function (st) { return st.quellen; })).forEach(function (id) { var k = eff(Q, id); m[k] = m[k] || []; if (m[k].indexOf(nr) < 0) m[k].push(nr); });
      });
      return m;
    }, [reg]);
    var t = txt(such);
    var passt = function (id) { var k = eff(Q, id), q = Q[k]; if (!q) return !filt; if (filt && q.status !== filt) return false; return !t || txt(apaText(q) + " " + (q.doi || "")).indexOf(t) >= 0; };
    var modListe = useMemo(function () {
      if (!reg) return [];
      return reg.module.map(function (m) {
        var mt = txt(m.id + " " + m.titel).indexOf(t) >= 0;
        var verz = (m.quellenverzeichnis || []).filter(function (id) { return (mt && !filt) || passt(id); });
        var st = (m.stellen || []).filter(function (x) { return (!t || mt || txt(x.ort + " " + x.text_auszug).indexOf(t) >= 0 || x.quellen.some(passt)) && (!filt || x.quellen.some(passt)); });
        return { m: m, verz: verz, st: st };
      }).filter(function (x) { return x.verz.length || x.st.length; });
    }, [reg, such, filt]);
    if (err) return h("div", { className: "card" }, h("p", null, "Das Quellenregister konnte nicht geladen werden (" + err + ")."));
    if (!reg) return h("p", { className: "muted" }, "Quellenregister wird geladen …");
    var gesamt = ids.length, gepr = ids.filter(function (k) { return GEPRUEFT.indexOf(Q[k].status) >= 0; }).length;

    var kopf = h("div", { className: "card" },
      h("div", { className: "qa2-sum" },
        h("div", null, h("div", { className: "eyebrow" }, "Prüfstand des Quellenregisters"),
          h("div", { className: "big", style: { marginTop: 8 } }, gepr + " von " + gesamt, h("small", null, "Quellen geprüft")),
          h("p", { className: "az-note", style: { margin: "8px 0 0" } }, "Nur für die Administration. In den Lerninhalten stehen keine Literaturangaben. „Geprüft“ heißt hier: formal abgeglichen oder amtlich verlinkt. Ob eine Aussage wirklich in der Quelle steht, zeigt erst „Inhalt verifiziert“.")),
        h("button", { type: "button", className: "btn ghost", onClick: function () { csv(reg); } }, "Als CSV exportieren")),
      h("div", { className: "qa2-bar", role: "img", "aria-label": STATUS.map(function (x) { return (zahl[x[0]] || 0) + " " + x[1]; }).join(", ") },
        STATUS.map(function (x) { return zahl[x[0]] ? h("i", { key: x[0], title: zahl[x[0]] + " " + x[1], style: { width: (100 * zahl[x[0]] / gesamt) + "%", background: x[2] } }) : null; })),
      h("div", { className: "qa2-leg", role: "group", "aria-label": "Nach Prüfstatus filtern" },
        h("button", { type: "button", "aria-pressed": !filt, onClick: function () { setFilt(null); } }, "Alle ", h("b", null, gesamt)),
        STATUS.map(function (x) { return h("button", { key: x[0], type: "button", "aria-pressed": filt === x[0], title: x[3], onClick: function () { setFilt(filt === x[0] ? null : x[0]); } }, h("i", { style: { "--c": x[2] } }), x[1], " ", h("b", null, zahl[x[0]] || 0)); })));

    var werkzeug = h("div", { className: "qa2-tool" },
      h("input", { className: "input", type: "search", placeholder: "Modul, Textstelle, Autorin, Titel oder DOI suchen …", value: such, onChange: function (ev) { setSuch(ev.target.value); }, "aria-label": "Quellen durchsuchen" }),
      h("div", { className: "az-seg", role: "group", "aria-label": "Ansicht" }, [["modul", "Nach Modul"], ["alle", "Alle Quellen"], ["weitere", "Weitere"], ["protokoll", "Prüfprotokoll"]].map(function (x) {
        return h("button", { key: x[0], type: "button", "aria-pressed": ansicht === x[0], onClick: function () { setAnsicht(x[0]); } }, x[1]);
      })));

    var inhalt;
    if (ansicht === "modul") {
      inhalt = [1, 2, 3].map(function (j) {
        var l = modListe.filter(function (x) { return Number(x.m.jahr) === j; });
        if (!l.length) return null;
        return h("div", { key: j },
          h("div", { className: "sec" }, h("h2", null, j + ". Ausbildungsjahr"), h("span", { className: "muted", style: { fontSize: 14 } }, l.length + " Module")),
          l.map(function (x) {
            var m = x.m, alleIds = (m.quellenverzeichnis || []).map(function (id) { return eff(Q, id); });
            var nr = (m.titel.match(/Fallmodul (\d+)/) || [])[1] || m.id.replace("fm", "");
            return h("details", { key: m.id, className: "qa2-mod", style: { "--kc": FARBEN[j] }, open: !!t && modListe.length <= 3 },
              h("summary", null, h("span", { className: "nr" }, nr),
                h("span", { className: "tt" }, h("b", null, m.titel.replace(/^Fallmodul \d+ · /, "")), h("small", null, x.verz.length + " Quellen · " + x.st.length + " Textstellen mit Beleg")),
                h(Mini, { ids: alleIds, Q: Q })),
              h("div", { className: "qa2-in" },
                x.st.length ? h("div", null, h("div", { className: "qa2-h" }, "Belege je Textstelle"), x.st.map(function (st, i) {
                  var qq = st.quellen.filter(passt);
                  return h("div", { key: i, className: "qa2-st" },
                    h("div", { className: "o" }, st.ort),
                    h("div", { className: "x" }, "„" + st.text_auszug + (st.text_auszug.length >= 160 ? " …" : "") + "“"),
                    st.zitate_im_text_entfernt && st.zitate_im_text_entfernt.length ? h("div", { className: "z" }, "Aus dem Lerntext entfernt: " + st.zitate_im_text_entfernt.join("; ")) : null,
                    (qq.length ? qq : st.quellen).map(function (id) { return h(Ref, { key: id, id: id, alle: Q }); }));
                })) : null,
                (function () {
                  var gezeigt = {}; x.st.forEach(function (st) { st.quellen.forEach(function (id) { gezeigt[eff(Q, id)] = 1; }); });
                  var rest = x.verz.filter(function (id) { return !gezeigt[eff(Q, id)]; });
                  return rest.length ? h("div", null, h("div", { className: "qa2-h" }, x.st.length ? "Weitere Quellen des Moduls" : "Quellenverzeichnis des Moduls"), rest.map(function (id) { return h(Ref, { key: id, id: id, alle: Q }); })) : null;
                })()));
          }));
      });
      if (!modListe.length) inhalt = h("p", { className: "muted", style: { marginTop: 18 } }, "Keine Treffer.");
    } else if (ansicht === "alle") {
      var liste = ids.filter(passt).sort(function (x, y) { return apaText(Q[x]).localeCompare(apaText(Q[y]), "de"); });
      inhalt = h("div", null, h("div", { className: "sec" }, h("h2", null, "Alle Quellen"), h("span", { className: "muted", style: { fontSize: 14 } }, liste.length + " Einträge, alphabetisch")),
        h("div", { className: "card" }, liste.length ? liste.map(function (id) { return h(Ref, { key: id, id: id, alle: Q, mods: mods }); }) : h("p", { className: "muted" }, "Keine Treffer.")));
    } else if (ansicht === "weitere") {
      inhalt = h("div", null, h("div", { className: "sec" }, h("h2", null, "Kitteltasche, Trainings und Lernkarten")),
        (reg.weitere || []).filter(function (w) { return !t || txt(w.ort).indexOf(t) >= 0 || (w.quellen || []).some(passt); }).map(function (w, i) {
          return h("div", { key: i, className: "card", style: { marginBottom: 10 } }, h("div", { className: "az-card-h" }, h("h3", { style: { fontSize: 16 } }, w.ort), h("span", null, (w.quellen || []).length + " Quellen")),
            (w.quellen || []).map(function (id) { return h(Ref, { key: id, id: id, alle: Q }); }));
        }));
    } else {
      inhalt = h("div", null, h("div", { className: "sec" }, h("h2", null, "Prüfprotokoll der Inhaltsredaktion"), h("span", { className: "muted", style: { fontSize: 14 } }, (reg.pruefprotokoll || []).length + " inhaltlich geprüfte Quellen")),
        (reg.pruefprotokoll || []).map(function (p, i) {
          return h("div", { key: i, className: "card", style: { marginBottom: 10 } },
            h("div", { className: "az-card-h" }, h("h3", { style: { fontSize: 16 } }, p.titel), h("span", null, p.version || "")),
            h("div", { className: "qa2-st", style: { marginTop: 0 } },
              h("div", { className: "x" }, [p.institution, p.fundstelle].filter(Boolean).join(" · ")),
              p.url ? h("div", null, h("a", { href: p.url, target: "_blank", rel: "noopener noreferrer", style: { wordBreak: "break-all" } }, p.url)) : null,
              h("div", { className: "x" }, h("b", null, "Belegstelle: "), p.belegstelle || "–"),
              h("div", { className: "x" }, h("b", null, "Betrifft: "), (p.betroffene_ids || []).join(", ")),
              h("div", { className: "meta", style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 } },
                h("span", { className: "qa2-pill", style: { "--c": "#16a34a" } }, "Evidenz: " + p.evidence),
                h("span", { className: "qa2-pill", style: { "--c": "#0d9488" } }, "Rechte: " + p.rights),
                h("span", { className: "qa2-pill", style: { "--c": "#f59e0b" } }, "Freigabe: " + p.freigabe)),
              p.konflikt ? h("div", { className: "z" }, "Konflikt: " + p.konflikt) : null));
        }));
    }
    return h("div", null, kopf, werkzeug, inhalt);
  }
  window.FP_AdminQuellen = Quellen;
})();

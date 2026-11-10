/* Fallpfad Lehrer-Portal: Unterrichts-Helfer – faire Zufallsauswahl und Gruppenbildung.
   „Wer ist dran?“ zieht Lernende eines Kurses zufällig, ohne Wiederholung, bis alle dran waren.
   Gruppen mischt den Kurs in Gruppen gewünschter Größe. Läuft komplett lokal im Browser. */
(function () {
  var zieh = {}; /* je Kurs: schon gezogene IDs dieser Sitzung */

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function escH(t) { return String(t == null ? "" : t).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function mische(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function name(s) { return s.display_name || s.email || "?"; }

  var CSS = ".fpu-ov{position:fixed;inset:0;background:rgba(10,16,28,.45);z-index:220;display:grid;place-items:center;padding:16px}" +
    ".fpu-m{background:var(--surface,#fff);color:var(--fg,#0f172a);border-radius:20px;max-width:520px;width:100%;max-height:min(84vh,680px);overflow:auto;padding:20px 22px;box-shadow:0 24px 60px -20px rgba(2,8,20,.45)}" +
    ".fpu-m h2{margin:0 0 2px;font-size:20px}.fpu-m .mut{color:var(--muted,#64748b);font-size:13.5px;margin:0 0 14px}" +
    ".fpu-row{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}" +
    ".fpu-m select{font:inherit;padding:9px 12px;border-radius:12px;border:1px solid var(--line,#e2e8f0);background:var(--surface,#fff);color:inherit;flex:1;min-width:160px}" +
    ".fpu-b{font:inherit;font-weight:600;border:0;border-radius:12px;padding:10px 14px;cursor:pointer;background:var(--accent,#0062FF);color:#fff}" +
    ".fpu-b.g{background:color-mix(in srgb,var(--fg,#0f172a) 7%,transparent);color:var(--fg,#0f172a)}" +
    ".fpu-pick{border-radius:16px;padding:22px;text-align:center;background:color-mix(in srgb,var(--accent,#0062FF) 9%,var(--surface,#fff));margin:0 0 10px}" +
    ".fpu-pick b{display:block;font-size:24px;letter-spacing:-.01em}.fpu-pick small{color:var(--muted,#64748b)}" +
    ".fpu-grp{border:1px solid var(--line,#e2e8f0);border-radius:14px;padding:10px 14px;margin:0 0 8px}.fpu-grp b{display:block;font-size:13px;color:var(--muted,#64748b);margin-bottom:2px}" +
    ".fpu-x{float:right;border:0;background:none;color:var(--muted,#64748b);font-size:22px;line-height:1;cursor:pointer;padding:4px}";

  function open(data) {
    if (!document.getElementById("fpu-css")) { var st = el("style"); st.id = "fpu-css"; st.textContent = CSS; document.head.appendChild(st); }
    var ov = el("div", "fpu-ov"), m = el("div", "fpu-m"); ov.appendChild(m);
    ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { ov.remove(); document.removeEventListener("keydown", esc); } });

    var kurse = (data.courses || []).map(function (c) { return { id: c.id, name: c.name, ss: (data.students || []).filter(function (s) { return s.course_id === c.id; }) }; }).filter(function (k) { return k.ss.length; });
    var ohne = (data.students || []).filter(function (s) { return !s.course_id; });
    if (ohne.length) kurse.push({ id: "ohne", name: "Ohne Kurs", ss: ohne });

    m.appendChild(el("button", "fpu-x", "×")).addEventListener("click", function () { ov.remove(); });
    m.appendChild(el("h2", null, "Unterrichts-Helfer"));
    m.appendChild(el("p", "mut", "Zufällig aufrufen ohne Wiederholung oder den Kurs in Gruppen mischen. Bleibt auf diesem Gerät."));
    if (!kurse.length) { m.appendChild(el("p", "mut", "Noch keine Lernenden in Kursen.")); document.body.appendChild(ov); return; }

    var row = el("div", "fpu-row"), sel = el("select");
    kurse.forEach(function (k) { var o = el("option", null, escH(k.name) + " (" + k.ss.length + ")"); o.value = k.id; sel.appendChild(o); });
    var bZieh = el("button", "fpu-b", "Wer ist dran?"), bGrp = el("button", "fpu-b g", "Gruppen bilden");
    bZieh.type = bGrp.type = "button";
    row.appendChild(sel); row.appendChild(bZieh); row.appendChild(bGrp); m.appendChild(row);

    var sizeRow = el("div", "fpu-row"); sizeRow.style.display = "none";
    var sizeSel = el("select");
    [2, 3, 4, 5].forEach(function (n) { var o = el("option", null, "Gruppen à " + n); o.value = n; if (n === 3) o.selected = true; sizeSel.appendChild(o); });
    var bLos = el("button", "fpu-b", "Mischen"); bLos.type = "button";
    sizeRow.appendChild(sizeSel); sizeRow.appendChild(bLos); m.appendChild(sizeRow);

    var out = el("div"); m.appendChild(out);

    function kurs() { for (var i = 0; i < kurse.length; i++) if (kurse[i].id === sel.value) return kurse[i]; return kurse[0]; }
    bZieh.addEventListener("click", function () {
      sizeRow.style.display = "none";
      var k = kurs(), done = zieh[k.id] || (zieh[k.id] = []);
      var rest = k.ss.filter(function (s) { return done.indexOf(s.id) < 0; });
      if (!rest.length) { done.length = 0; rest = k.ss.slice(); }
      var p = rest[Math.floor(Math.random() * rest.length)];
      done.push(p.id);
      out.innerHTML = "";
      var card = el("div", "fpu-pick", "<b>" + escH(name(p)) + "</b><small>" + (k.ss.length - (k.ss.length - done.length)) + " von " + k.ss.length + " waren dran" + (done.length === k.ss.length ? " – Runde vollständig, nächste Ziehung beginnt neu" : "") + "</small>");
      out.appendChild(card);
    });
    bGrp.addEventListener("click", function () { sizeRow.style.display = sizeRow.style.display === "none" ? "flex" : "none"; });
    bLos.addEventListener("click", function () {
      var k = kurs(), n = +sizeSel.value, g = mische(k.ss), out2 = [];
      var anz = Math.max(1, Math.round(g.length / n));
      for (var i = 0; i < anz; i++) out2.push([]);
      g.forEach(function (s, i) { out2[i % anz].push(s); });
      out.innerHTML = "";
      out2.forEach(function (gr, i) { out.appendChild(el("div", "fpu-grp", "<b>Gruppe " + (i + 1) + " · " + gr.length + "</b>" + gr.map(function (s) { return escH(name(s)); }).join(", "))); });
    });

    document.body.appendChild(ov);
  }

  window.FP_GRUPPEN = { open: open };
})();

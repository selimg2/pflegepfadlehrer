/* Fallpfad Profilmenü: Klick auf das Profil (oben rechts oder unten links) öffnet ein Menü mit
   Profil, Farbprofil, Hell/Dunkel, Einstellungen und Abmelden. Funktioniert in Schüler-App und Lehrer-Portal. */
(function () {
  var KIND = window.FP_APP_KIND || "schueler";
  function P() { return window.FP_PROF || {}; }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function mode() { var a = document.documentElement.getAttribute("data-theme"); return a === "dark" || a === "light" ? a : "system"; }
  function setMode(m) {
    var p = P();
    if (p.setTheme) p.setTheme(m);
    else if (m === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", m);
  }
  function initials(n) { return String(n || "?").trim().split(/\s+/).map(function (w) { return w.charAt(0); }).join("").slice(0, 2).toUpperCase() || "?"; }
  function avatarHtml() {
    var av = document.querySelector(".topbar .avbtn .avatar, .sideprof .avatar, .topbar .avbtn svg");
    if (av) { var c = av.cloneNode(true); c.removeAttribute("style"); c.classList && c.classList.add("fxpm-avi"); return c.outerHTML; }
    return '<span class="avatar ini fxpm-avi">' + esc(initials(P().name)) + "</span>";
  }
  /* Farbauswahl wie in den iOS-Einstellungen: flache Kreise, Häkchen beim gewählten Profil, Name darunter.
     Der Kreis sitzt in einer 44 px hohen Schaltfläche, damit Touch-Ziele groß genug sind und der Kreis rund bleibt. */
  var SW = function (t, on) {
    return '<button type="button" role="radio" class="fxpm-sw' + (on ? " on" : "") + '" data-fp="' + t.id + '" aria-label="Farbprofil ' + esc(t.n) + '" aria-checked="' + on + '" style="--a:' + (t.dot || t.L.accent) + '">' +
      '<i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></i><span>' + esc(t.n.replace("Lila-Pink", "Lila")) + "</span></button>";
  };
  var ICO = {
    pic: '<path d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
    set: '<path d="M10.07 5.27 L10.56 2.91 A9.2 9.2 0 0 1 13.44 2.91 L13.93 5.27 A7.0 7.0 0 0 1 15.39 5.88 L17.41 4.56 A9.2 9.2 0 0 1 19.44 6.59 L18.12 8.61 A7.0 7.0 0 0 1 18.73 10.07 L21.09 10.56 A9.2 9.2 0 0 1 21.09 13.44 L18.73 13.93 A7.0 7.0 0 0 1 18.12 15.39 L19.44 17.41 A9.2 9.2 0 0 1 17.41 19.44 L15.39 18.12 A7.0 7.0 0 0 1 13.93 18.73 L13.44 21.09 A9.2 9.2 0 0 1 10.56 21.09 L10.07 18.73 A7.0 7.0 0 0 1 8.61 18.12 L6.59 19.44 A9.2 9.2 0 0 1 4.56 17.41 L5.88 15.39 A7.0 7.0 0 0 1 5.27 13.93 L2.91 13.44 A9.2 9.2 0 0 1 2.91 10.56 L5.27 10.07 A7.0 7.0 0 0 1 5.88 8.61 L4.56 6.59 A9.2 9.2 0 0 1 6.59 4.56 L8.61 5.88 A7.0 7.0 0 0 1 10.07 5.27Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    lang: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
  };
  var TILE = { pic: "#0A84FF", lang: "#5856D6", bell: "#FF3B30", set: "#8E8E93", play: "#FF9500", chart: "#34C759" };
  function ic(k) { return '<span class="fxpm-ic" style="--t:' + (TILE[k] || "#8E8E93") + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[k] + "</svg></span>"; }
  var CHEV = '<svg class="fxpm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  function legal() {
    var c = window.FALLPFAD_CONFIG || {};
    return [["Datenschutz", c.datenschutzUrl || "datenschutz.html"], ["Nutzungsbedingungen", c.nutzungUrl || "nutzungsbedingungen.html"], ["Impressum", c.impressumUrl || "impressum.html"]]
      .map(function (u) { return '<a href="' + esc(u[1]) + '">' + esc(u[0]) + "</a>"; }).join("<span>·</span>");
  }

  /* Gestaltung im Stil der iOS-Einstellungen (gruppierte Listen, farbige Symbol-Kacheln). Liegt hier, damit
     Schüler-App und Lehrer-Portal identisch aussehen. Überschreibt ältere Regeln aus 02-training.css. */
  var CSS = [
    "html body .fxpm{background:var(--bg,#f2f2f7);color:var(--fg);border:0;border-radius:22px;padding:12px;gap:10px;box-shadow:0 30px 80px -20px rgba(0,0,0,.45),0 0 0 .5px var(--line)}",
    "html body .fxpm-bg.sheet .fxpm{border-radius:24px 24px 0 0;padding:8px 14px calc(16px + env(safe-area-inset-bottom,0px));max-height:92vh;overflow:auto}",
    "html body .fxpm-bg.sheet{background:rgba(0,0,0,.35)}",
    "html body .fxpm-head{border:0;margin:0;padding:6px 6px 4px;gap:12px}",
    "html body .fxpm-head b{font-size:17px;letter-spacing:-.01em}",
    ".fxpm-grp{background:var(--surface);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}",
    ".fxpm-look{padding:12px 14px 14px;gap:8px}",
    ".fxpm-lbl{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}",
    ".fxpm-lbl+.fxpm-sws{margin-bottom:6px}",
    "html body .fxpm-sws{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}",
    "html body .fxpm-sw{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;padding:4px 0;min-height:44px;width:auto;height:auto;background:none!important;box-shadow:none!important;border-radius:12px;-webkit-tap-highlight-color:transparent}",
    "html body .fxpm-sw i{width:30px;height:30px;flex:0 0 30px;aspect-ratio:1;border-radius:50%;background:var(--a);display:grid;place-items:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s}",
    "html body .fxpm-sw svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;opacity:0;transform:scale(.6);transition:opacity .15s,transform .18s}",
    "html body .fxpm-sw span{font-size:11.5px;font-weight:500;color:var(--muted);line-height:1.1}",
    "html body .fxpm-sw:hover i{transform:scale(1.06)}",
    "html[data-theme=dark] body .fxpm-sw i{box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}",
    "@media (prefers-color-scheme:dark){html:not([data-theme=light]) body .fxpm-sw i{box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}}",
    "html body .fxpm-sw.on i{box-shadow:0 0 0 2.5px var(--surface),0 0 0 4.5px var(--a)}",
    "html body .fxpm-sw.on svg{opacity:1;transform:none}",
    "html body .fxpm-sw.on span{color:var(--fg);font-weight:650}",
    "html body .fxpm-sw:focus-visible i{outline:3px solid var(--accent);outline-offset:3px}",
    "html body .fxpm-seg{display:grid;grid-template-columns:repeat(3,1fr);padding:2px;border-radius:10px;background:var(--fill,#e9e9ee);gap:0}",
    "html body .fxpm-seg button{all:unset;box-sizing:border-box;text-align:center;cursor:pointer;font-size:13.5px;font-weight:550;color:var(--fg);padding:7px 4px;border-radius:8px;min-height:32px;transition:background .15s}",
    "html body .fxpm-seg button.on{background:var(--surface);font-weight:650;box-shadow:0 3px 8px rgba(0,0,0,.12),0 0 0 .5px rgba(0,0,0,.04)}",
    "html[data-theme=dark] body .fxpm-seg button.on{background:#636366}",
    "@media (prefers-color-scheme:dark){html:not([data-theme=light]) body .fxpm-seg button.on{background:#636366}}",
    "html body .fxpm-row{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:0 12px 0 14px;min-height:46px;border:0;border-radius:0;background:none;color:var(--fg);font:inherit;font-size:15.5px;font-weight:450;text-align:left;cursor:pointer;position:relative;transition:background .12s}",
    "html body .fxpm-row:not(:last-child)::after{content:'';position:absolute;left:54px;right:0;bottom:0;height:.5px;background:var(--line)}",
    "html body .fxpm-row:hover{background:var(--surface2)}html body .fxpm-row:active{background:var(--fill,#e5e5ea);transform:none}",
    "html body .fxpm-row>span:not(.fxpm-ic){flex:1}",
    ".fxpm-ic{width:28px;height:28px;flex:0 0 28px;border-radius:7px;background:var(--t);color:#fff;display:grid;place-items:center}",
    "html body .fxpm-row .fxpm-ic svg{width:17px;height:17px;color:#fff;flex:0 0 17px;stroke-width:2.1}",
    ".fxpm-chev{width:14px;height:14px;flex:0 0 14px;fill:none;stroke:var(--muted);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;opacity:.6}",
    "html body .fxpm-row .fxpm-val{margin-left:auto;font-size:15px;font-weight:400;color:var(--muted);max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    "html body .fxpm-row.bad{justify-content:center;color:var(--bad,#FF3B30);font-weight:500}html body .fxpm-row.bad span{flex:0 1 auto!important;text-align:center}",
    ".fxpm-mini{all:unset;cursor:pointer;align-self:center;font-size:13px;color:var(--muted);padding:6px 10px;min-height:32px;display:flex;align-items:center;border-radius:8px}.fxpm-mini:hover{color:var(--bad-ink,#d70015)}",
    "html body .fxpm-legal{border:0;margin:0;padding:0 0 2px;justify-content:center}",
    "@media (prefers-reduced-motion:reduce){.fxpm-sw i,.fxpm-sw svg{transition:none}}"
  ].join("");
  /* Alle Regeln mit !important und höherer Spezifität, damit ältere Ebenen (03-apple.css) sie nicht überdecken */
  CSS = CSS.replace(/html body /g, "html:root body ").replace(/([^;{}]+:[^;{}]+)(?=[;}])/g, function (m) { return /!important$/.test(m) ? m : m + "!important"; });
  (function () { var st = document.createElement("style"); st.id = "fxpm-css"; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); })();
  var openEl = null;
  function close() { if (openEl) { var e = openEl; openEl = null; e.classList.add("out"); setTimeout(function () { e.remove(); }, 160); } }
  function open(anchor) {
    if (openEl) { close(); return; }
    var p = P(), T = (window.FP_THEMES && window.FP_THEMES.list) || [], cur = window.FP_THEMES ? window.FP_THEMES.current() : "blau";
    var name = p.name || (KIND === "lehrer" ? "Lehrkraft" : "Profil"), sub = p.email || (KIND === "lehrer" ? "Lehrer-Portal" : "Auszubildende");
    var bg = document.createElement("div"); bg.className = "fxpm-bg";
    var m = document.createElement("div"); m.className = "fxpm"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Profil und Einstellungen");
    var md = mode();
    var rows = [];
    if (KIND !== "lehrer") rows.push('<button type="button" class="fxpm-row" data-a="pic">' + ic("pic") + "<span>Profilbild ändern</span>" + CHEV + "</button>");
    if (KIND !== "lehrer" && window.FP_LS) rows.push('<button type="button" class="fxpm-row" data-a="lang">' + ic("lang") + '<span>Meine Sprache</span><em class="fxpm-val">' + esc(window.FP_LS.label()) + "</em>" + CHEV + "</button>");
    if (KIND !== "lehrer" && window.FP_NATIVE && window.FP_NATIVE.reminder) rows.push('<button type="button" class="fxpm-row" data-a="remind">' + ic("bell") + '<span>Lern-Erinnerung</span><em class="fxpm-val">' + (window.FP_NATIVE.reminder.get() ? "täglich " + window.FP_NATIVE.reminder.get() + " Uhr" : "Aus") + "</em>" + CHEV + "</button>");
    rows.push('<button type="button" class="fxpm-row" data-a="set">' + ic("set") + "<span>Einstellungen</span>" + CHEV + "</button>");
    rows.push('<button type="button" class="fxpm-row" data-a="tour">' + ic("play") + "<span>Tutorial ansehen</span>" + CHEV + "</button>");
    m.innerHTML =
      '<div class="fxpm-head">' + avatarHtml() + '<div><b>' + esc(name) + "</b><small>" + esc(sub) + "</small></div></div>" +
      '<div class="fxpm-grp fxpm-look">' +
        '<div class="fxpm-lbl">Farbe</div><div class="fxpm-sws" role="radiogroup" aria-label="Farbprofil">' + T.map(function (t) { return SW(t, t.id === cur); }).join("") + "</div>" +
        '<div class="fxpm-lbl">Darstellung</div><div class="fxpm-seg" role="group" aria-label="Darstellung">' + [["light", "Hell"], ["dark", "Dunkel"], ["system", "Automatisch"]].map(function (x) { return '<button type="button" data-m="' + x[0] + '" aria-pressed="' + (md === x[0]) + '" class="' + (md === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      "</div>" +
      '<div class="fxpm-grp">' + rows.join("") + "</div>" +
      '<div class="fxpm-grp"><button type="button" class="fxpm-row bad" data-a="out"><span>Abmelden</span></button></div>' +
      (KIND !== "lehrer" && window.FP_KONTO ? '<button type="button" class="fxpm-mini" data-a="del">Konto löschen</button>' : "") +
      '<nav class="fp-legal fxpm-legal" aria-label="Rechtliches">' + legal() + "</nav>";
    bg.appendChild(m);
    document.body.appendChild(bg);
    openEl = bg;
    /* Position: am Element ausrichten, auf dem Handy als Blatt von unten */
    if (anchor && window.innerWidth > 640) {
      var r = anchor.getBoundingClientRect(), w = 340;
      m.style.position = "fixed"; m.style.width = w + "px";
      var left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w));
      if (r.left < window.innerWidth / 3) left = Math.max(12, r.left);
      m.style.left = left + "px";
      if (r.top > window.innerHeight / 2) { m.style.bottom = (window.innerHeight - r.top + 8) + "px"; m.classList.add("up"); }
      else m.style.top = (r.bottom + 8) + "px";
    } else bg.classList.add("sheet");
    bg.addEventListener("click", function (e) {
      if (e.target === bg) return close();
      var sw = e.target.closest(".fxpm-sw");
      if (sw) { window.FP_THEMES.apply(sw.dataset.fp); m.querySelectorAll(".fxpm-sw").forEach(function (x) { x.classList.toggle("on", x === sw); x.setAttribute("aria-checked", x === sw); }); return; }
      var mb = e.target.closest("[data-m]");
      if (mb) { setMode(mb.dataset.m); m.querySelectorAll("[data-m]").forEach(function (x) { x.classList.toggle("on", x === mb); x.setAttribute("aria-pressed", x === mb); }); return; }
      var a = e.target.closest("[data-a]");
      if (!a) return;
      var act = a.dataset.a, pp = P();
      close();
      if (act === "pic" && pp.avatar) pp.avatar();
      if (act === "lang" && window.FP_LS) window.FP_LS.open();
      if (act === "del" && window.FP_KONTO) window.FP_KONTO.open();
      if (act === "tour" && window.FP_TOUR) { window.scrollTo(0, 0); setTimeout(function () { window.FP_TOUR.start(); }, 200); }
      if (act === "remind" && window.FP_NATIVE) { var on = !!window.FP_NATIVE.reminder.get(); window.FP_NATIVE.reminder.set(!on, 19, 0); }
      if (act === "set") { if (pp.go) pp.go("einstellungen"); window.scrollTo(0, 0); }
      if (act === "out" && pp.signOut) pp.signOut();
    });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  /* Lehrer-Portal: Profil-Knopf oben rechts ergänzen */
  function place() {
    if (KIND !== "lehrer") return;
    var tb = document.querySelector(".topbar"), sw = tb && tb.querySelector('.switch[role="switch"]');
    if (sw && !tb.querySelector(".fxpm-av")) {
      var b = document.createElement("button"); b.type = "button"; b.className = "avbtn fxpm-av"; b.setAttribute("aria-label", "Profil und Einstellungen");
      b.innerHTML = '<span class="avatar ini" style="width:36px;height:36px;font-size:14px">' + esc(initials(P().name)) + "</span>";
      b.addEventListener("click", function () { open(b); });
      sw.parentNode.insertBefore(b, sw.nextSibling);
    }
    var av = tb && tb.querySelector(".fxpm-av .avatar"); if (av && P().name && av.textContent !== initials(P().name)) av.textContent = initials(P().name);
  }
  function start() { place(); var q = 0; new MutationObserver(function () { if (q) return; q = 1; requestAnimationFrame(function () { q = 0; place(); }); }).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.FP_PROFILE = { open: function (el) { open(el || (document.activeElement && document.activeElement.closest ? document.activeElement.closest("button") : null)); }, close: close };
})();

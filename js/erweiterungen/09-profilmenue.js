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
  var SW = function (t, on) {
    return '<button type="button" class="fxpm-sw' + (on ? " on" : "") + '" data-fp="' + t.id + '" aria-label="Farbprofil ' + esc(t.n) + '" aria-pressed="' + on + '" style="--a:' + (t.dot || t.L.accent) + '"></button>';
  };
  var ICO = {
    pic: '<path d="M4 7h3l2-2.5h6L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
    set: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l5.5-3.5z"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    lang: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
  };
  function ic(k) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[k] + "</svg>"; }
  function legal() {
    var c = window.FALLPFAD_CONFIG || {};
    return [["Datenschutz", c.datenschutzUrl || "datenschutz.html"], ["Nutzungsbedingungen", c.nutzungUrl || "nutzungsbedingungen.html"], ["Impressum", c.impressumUrl || "impressum.html"]]
      .map(function (u) { return '<a href="' + esc(u[1]) + '">' + esc(u[0]) + "</a>"; }).join("<span>·</span>");
  }
  var openEl = null;
  function close() { if (openEl) { var e = openEl; openEl = null; e.classList.add("out"); setTimeout(function () { e.remove(); }, 160); } }
  function open(anchor) {
    if (openEl) { close(); return; }
    var p = P(), T = (window.FP_THEMES && window.FP_THEMES.list) || [], cur = window.FP_THEMES ? window.FP_THEMES.current() : "blau";
    var name = p.name || (KIND === "lehrer" ? "Lehrkraft" : "Profil"), sub = p.email || (KIND === "lehrer" ? "Lehrer-Portal" : "Auszubildende");
    var bg = document.createElement("div"); bg.className = "fxpm-bg";
    var m = document.createElement("div"); m.className = "fxpm"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Profil und Einstellungen");
    var md = mode();
    m.innerHTML =
      '<div class="fxpm-head">' + avatarHtml() + '<div><b>' + esc(name) + "</b><small>" + esc(sub) + "</small></div></div>" +
      (KIND !== "lehrer" ? '<button type="button" class="fxpm-row" data-a="pic">' + ic("pic") + "<span>Profilbild ändern</span></button>" : "") +
      '<div class="fxpm-sec"><span>Farbe</span><div class="fxpm-sws">' + T.map(function (t) { return SW(t, t.id === cur); }).join("") + "</div></div>" +
      '<div class="fxpm-sec"><span>Darstellung</span><div class="fxpm-seg">' + [["light", "Hell"], ["dark", "Dunkel"], ["system", "Automatisch"]].map(function (x) { return '<button type="button" data-m="' + x[0] + '" class="' + (md === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + "</div></div>" +
      (KIND !== "lehrer" && window.FP_LS ? '<button type="button" class="fxpm-row" data-a="lang">' + ic("lang") + '<span>Meine Sprache</span><em class="fxpm-val">' + esc(window.FP_LS.label()) + "</em></button>" : "") +
      (KIND !== "lehrer" && window.FP_NATIVE && window.FP_NATIVE.reminder ? '<button type="button" class="fxpm-row" data-a="remind">' + ic("bell") + '<span>Lern-Erinnerung</span><em class="fxpm-val">' + (window.FP_NATIVE.reminder.get() ? "täglich " + window.FP_NATIVE.reminder.get() + " Uhr" : "Aus") + "</em></button>" : "") +
      '<button type="button" class="fxpm-row" data-a="set">' + ic("set") + "<span>Einstellungen</span></button>" +
      '<button type="button" class="fxpm-row" data-a="tour">' + ic("play") + "<span>Tutorial ansehen</span></button>" +
      '<button type="button" class="fxpm-row bad" data-a="out">' + ic("out") + "<span>Abmelden</span></button>" +
      (KIND !== "lehrer" && window.FP_KONTO ? '<button type="button" class="fxpm-row fxpm-mini" data-a="del">' + ic("del") + "<span>Konto löschen</span></button>" : "") +
      '<nav class="fp-legal fxpm-legal" aria-label="Rechtliches">' + legal() + "</nav>";
    bg.appendChild(m);
    document.body.appendChild(bg);
    openEl = bg;
    /* Position: am Element ausrichten, auf dem Handy als Blatt von unten */
    if (anchor && window.innerWidth > 640) {
      var r = anchor.getBoundingClientRect(), w = 300;
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
      if (sw) { window.FP_THEMES.apply(sw.dataset.fp); m.querySelectorAll(".fxpm-sw").forEach(function (x) { x.classList.toggle("on", x === sw); x.setAttribute("aria-pressed", x === sw); }); return; }
      var mb = e.target.closest("[data-m]");
      if (mb) { setMode(mb.dataset.m); m.querySelectorAll("[data-m]").forEach(function (x) { x.classList.toggle("on", x === mb); }); return; }
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

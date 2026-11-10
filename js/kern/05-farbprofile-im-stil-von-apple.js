/* Fallpfad Farbprofile im Stil von Apple: neutrale, ruhige Flächen (Systemgrau), ein klarer Akzent je Profil
   und eine dazu passende Symbolpalette. Hell und Dunkel sind je Profil eigens abgestimmt (Dunkel: echtes Schwarz,
   erhöhte Flächen in Grau, aufgehellte Akzente). Wird früh im <head> geladen, damit nichts aufblitzt. */
(function () {
  var KEY = "fp-palette";
  var N = {
    L: { bg: "#f2f2f7", surface: "#ffffff", surface2: "#f2f2f7", fill: "#e9e9ee", fg: "#1c1c1e", muted: "#6e6e73", line: "rgba(60,60,67,.13)", side: "#f7f7f9", glass: "rgba(247,247,249,.78)" },
    D: { bg: "#000000", surface: "#1c1c1e", surface2: "#2c2c2e", fill: "#2c2c2e", fg: "#f5f5f7", muted: "#98989f", line: "rgba(84,84,88,.42)", side: "#111113", glass: "rgba(17,17,19,.72)" }
  };
  var T = [
    { id: "blau", n: "Blau", dot: "#0062FF",
      L: { accent: "#0062FF", btn: "#0062FF", on: "#ffffff" }, D: { accent: "#3D8BFF", btn: "#1F73FF", on: "#ffffff" },
      pal: ["#0062FF", "#5856D6", "#0A9FC0", "#34A853", "#FF9500", "#FF3B30", "#8E8E93", "#AF52DE"],
      palD: ["#3D8BFF", "#7D7AFF", "#40C8E0", "#30D158", "#FF9F0A", "#FF453A", "#98989F", "#BF5AF2"] },
    { id: "gruen", n: "Grün", dot: "#1F8F4E",
      L: { accent: "#1F8F4E", btn: "#1F8F4E", on: "#ffffff" }, D: { accent: "#32D074", btn: "#24A55B", on: "#ffffff" },
      pal: ["#1F8F4E", "#0E9688", "#4E9A2C", "#2F7D6D", "#C08A06", "#D9534F", "#8E8E93", "#3F8F7A"],
      palD: ["#32D074", "#3CD3C1", "#8BD45E", "#5FC2A9", "#F5C243", "#FF6B61", "#98989F", "#66D4B5"] },
    { id: "violett", n: "Lila-Pink", dot: "#B83FB2",
      L: { accent: "#A93AA8", btn: "#A93AA8", on: "#ffffff" }, D: { accent: "#E384E0", btn: "#B94BB7", on: "#ffffff" },
      pal: ["#A93AA8", "#D0458F", "#6E56CF", "#9B59D0", "#E5739A", "#C2416B", "#8E8E93", "#7E4AB8"],
      palD: ["#E384E0", "#FF7AB8", "#A08CFF", "#C98BF2", "#FF9BBE", "#FF6A93", "#98989F", "#B88CF0"] },
    { id: "sand", n: "Orange", dot: "#E8720C",
      L: { accent: "#D9660A", btn: "#E2700E", on: "#ffffff" }, D: { accent: "#FF9F0A", btn: "#E8820C", on: "#1c1c1e" },
      pal: ["#E2700E", "#D9480F", "#C58B00", "#A0612B", "#E8590C", "#C92A2A", "#8E8E93", "#B5741D"],
      palD: ["#FF9F0A", "#FF7A45", "#FFC93C", "#D9965A", "#FF8A3D", "#FF5A52", "#98989F", "#E3A45A"] },
    { id: "graphit", n: "Graphit", dot: "#3A3A3C", gray: true,
      L: { accent: "#1C1C1E", btn: "#1C1C1E", on: "#ffffff" }, D: { accent: "#F2F2F7", btn: "#F2F2F7", on: "#000000" },
      pal: ["#1C1C1E", "#3A3A3C", "#48484A", "#636366", "#8E8E93", "#2C2C2E", "#8E8E93", "#545456"],
      palD: ["#F2F2F7", "#D1D1D6", "#AEAEB2", "#C7C7CC", "#8E8E93", "#E5E5EA", "#98989F", "#BCBCC2"] }
  ];
  function vars(t, dark) {
    var n = dark ? N.D : N.L, a = dark ? t.D : t.L;
    var o = [
      "--bg:" + n.bg, "--surface:" + n.surface, "--surface2:" + n.surface2, "--fill:" + n.fill, "--fg:" + n.fg, "--muted:" + n.muted, "--line:" + n.line,
      "--accent:" + a.accent, "--btn:" + a.btn, "--on-accent:" + a.on, "--pc:" + a.accent, "--fx-side:" + n.side, "--glass:" + n.glass,
      "--accent-soft:color-mix(in srgb," + a.accent + " " + (dark ? 20 : 11) + "%,transparent)",
      "--tint:color-mix(in srgb," + a.accent + " " + (dark ? 12 : 6) + "%," + n.surface + ")",
      "--sage-soft:" + n.surface2, "--fig-line:" + (dark ? "#48484a" : "#d1d1d6"),
      "--ok:" + (dark ? "#30D158" : "#34C759"), "--ok-ink:" + (dark ? "#30D158" : "#1E8E3E"), "--ok-soft:color-mix(in srgb,#34C759 " + (dark ? 18 : 12) + "%,transparent)",
      "--warn:" + (dark ? "#FF9F0A" : "#FF9500"), "--warn-ink:" + (dark ? "#FFB340" : "#B25E00"), "--warn-soft:color-mix(in srgb,#FF9500 " + (dark ? 18 : 12) + "%,transparent)",
      "--bad:" + (dark ? "#FF453A" : "#FF3B30"), "--bad-ink:" + (dark ? "#FF6961" : "#D70015"), "--bad-soft:color-mix(in srgb,#FF3B30 " + (dark ? 18 : 10) + "%,transparent)",
      "--crit-tint:color-mix(in srgb,#FF3B30 " + (dark ? 10 : 5) + "%," + n.surface + ")",
      "--mark:" + a.accent, "--on-mark:" + a.on,
      "--shadow:none", "--shadow-lg:" + (dark ? "0 24px 60px -12px rgba(0,0,0,.8)" : "0 18px 50px -18px rgba(0,0,0,.25)")
    ];
    (dark ? t.palD : t.pal).forEach(function (c, i) { o.push("--p" + i + ":" + c); });
    if (dark) o.push("color-scheme:dark"); else o.push("color-scheme:light");
    return o.join(";");
  }
  var css = "";
  T.forEach(function (t) {
    var sel = 'html:root[data-fp="' + t.id + '"]', D = sel + '[data-theme="dark"]', M = sel + ':not([data-theme="light"])';
    css += sel + "{" + vars(t, false) + "}";
    css += "@media (prefers-color-scheme:dark){" + M + "{" + vars(t, true) + "}}" + D + "{" + vars(t, true) + "}";
  });
  function inject() {
    if (document.getElementById("fx-themes-css")) return;
    var st = document.createElement("style"); st.id = "fx-themes-css"; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  function cur() { try { var v = localStorage.getItem(KEY); return T.some(function (t) { return t.id === v; }) ? v : "blau"; } catch (e) { return "blau"; } }
  function apply(id) {
    if (!T.some(function (t) { return t.id === id; })) id = "blau";
    document.documentElement.setAttribute("data-fp", id);
    try { localStorage.setItem(KEY, id); } catch (e) {}
    keepLast();
  }
  function keepLast() {
    var h = document.head; if (!h) return;
    ["fx-themes-css", "fx-apple-css"].forEach(function (id) { var st = document.getElementById(id); if (st && st.parentNode === h && st !== h.lastElementChild) h.appendChild(st); });
  }
  inject(); apply(cur());
  document.addEventListener("DOMContentLoaded", function () { keepLast(); new MutationObserver(function () { var l = document.head.lastElementChild; if (l && l.id !== "fx-apple-css" && l.id !== "fx-themes-css") keepLast(); }).observe(document.head, { childList: true }); });
  T.forEach(function (t) { t.L.accent = t.L.accent; });
  window.FP_THEMES = { list: T, apply: apply, current: cur };
})();

/* Fallpfad Live: Körperkarte (Silhouette vorne/hinten) und benannte Zonen, gemeinsam für Lehrer-Portal und Schüler-App.
   Koordinaten im viewBox 0 0 100 200. Antippungen werden als x 0..99, y 0..99 (halbe Höhe) übertragen. */
(function () {
  var Z = {
    hinten: {
      hinterkopf: ["Hinterkopf", [[50, 11, 7]]],
      ohren: ["Ohrmuscheln", [[38, 16, 4], [62, 16, 4]]],
      schulter: ["Schulterblätter", [[40, 45, 7], [60, 45, 7]]],
      dorn: ["Dornfortsätze der Wirbelsäule", [[50, 62, 5]]],
      ellenbogen: ["Ellenbogen", [[18, 66, 6], [82, 66, 6]]],
      kreuzbein: ["Kreuzbein", [[50, 88, 7]]],
      sitzbein: ["Sitzbeinhöcker", [[43, 100, 5], [57, 100, 5]]],
      trochanter: ["Großer Rollhügel (Trochanter)", [[28, 95, 6], [72, 95, 6]]],
      kniekehle: ["Kniekehlen", [[41, 140, 5], [59, 140, 5]]],
      waden: ["Waden", [[41, 160, 6], [59, 160, 6]]],
      fersen: ["Fersen", [[41, 186, 6], [59, 186, 6]]]
    },
    vorne: {
      stirn: ["Stirn", [[50, 9, 6]]],
      deltoid: ["Oberarm, Deltamuskel", [[26, 44, 6], [74, 44, 6]]],
      brust: ["Brustkorb", [[50, 48, 9]]],
      bauch: ["Bauchhaut seitlich des Nabels", [[41, 78, 6], [59, 78, 6]]],
      nabel: ["Nabel", [[50, 78, 3]]],
      leiste: ["Leiste", [[38, 96, 5], [62, 96, 5]]],
      oberschenkel: ["Oberschenkel vorne außen", [[36, 120, 7], [64, 120, 7]]],
      knie: ["Knie", [[41, 148, 6], [59, 148, 6]]],
      schienbein: ["Schienbein", [[41, 162, 5], [59, 162, 5]]],
      knoechel: ["Knöchel", [[40, 177, 5], [60, 177, 5]]],
      handruecken: ["Handrücken", [[17, 101, 5], [83, 101, 5]]],
      unterarm: ["Unterarm innen", [[19, 80, 5], [81, 80, 5]]]
    }
  };
  function svg(fig, extra) {
    var back = fig === "hinten";
    var s = '<svg viewBox="0 0 100 200" xmlns="http://www.w3.org/2000/svg" class="fxbody-svg" role="img" aria-label="Körperkarte ' + (back ? "Rückseite" : "Vorderseite") + '">' +
      '<g fill="var(--bfill,#e8eef7)" stroke="var(--bline,#94a3b8)" stroke-width="1.2" stroke-linejoin="round">' +
      '<circle cx="50" cy="16" r="11"/>' + (back ? "" : '') +
      '<path d="M45 26h10v7H45z"/>' +
      '<path d="M30 32Q50 28 70 32L72 92Q50 99 28 92Z"/>' +
      '<path d="M30 34L22 36L14 96L21 97L30 52Z"/><path d="M70 34L78 36L86 96L79 97L70 52Z"/>' +
      '<circle cx="17" cy="101" r="5"/><circle cx="83" cy="101" r="5"/>' +
      '<path d="M30 90L49 93L47 179L36 179Z"/><path d="M51 93L70 90L64 179L53 179Z"/>' +
      '<ellipse cx="41" cy="185" rx="8" ry="4"/><ellipse cx="59" cy="185" rx="8" ry="4"/></g>' +
      '<g fill="none" stroke="var(--bline,#94a3b8)" stroke-width=".8" opacity=".7">' +
      (back ? '<path d="M50 34V90"/><path d="M38 40q2 8 8 10M62 40q-2 8-8 10"/><path d="M42 96q8 4 16 0"/>' : '<path d="M44 21q6 4 12 0"/><circle cx="50" cy="78" r="1.4"/><path d="M38 46q6 5 11 2M62 46q-6 5-11 2"/>') +
      "</g>" + (extra || "") + '<text x="50" y="198" text-anchor="middle" font-size="7" fill="var(--bline,#94a3b8)">' + (back ? "Rückseite" : "Vorderseite") + "</text></svg>";
    return s;
  }
  function zonesSvg(fig, keys, labels) {
    var Zf = Z[fig] || {}, out = "";
    (keys || []).forEach(function (k) {
      var z = Zf[k]; if (!z) return;
      z[1].forEach(function (c, i) {
        out += '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="' + (c[2] + 1.5) + '" fill="rgba(16,185,129,.18)" stroke="#059669" stroke-width="1.1" stroke-dasharray="2 1.5"/>';
        if (labels && i === 0) out += '<text x="' + Math.min(96, Math.max(4, c[0])) + '" y="' + (c[1] - c[2] - 3 < 7 ? c[1] + c[2] + 6 : c[1] - c[2] - 3) + '" text-anchor="middle" font-size="5.2" font-weight="700" fill="#047857" paint-order="stroke" stroke="#fff" stroke-width="1.6">' + z[0].replace(/&/g, "&amp;") + "</text>";
      });
    });
    return out;
  }
  function hit(fig, keys, x, y) {
    var Zf = Z[fig] || {}, X = x + 0.5, Y = y * 2 + 1;
    return (keys || []).some(function (k) { var z = Zf[k]; return z && z[1].some(function (c) { var dx = X - c[0], dy = Y - c[1]; return dx * dx + dy * dy <= (c[2] + 3) * (c[2] + 3); }); });
  }
  function enc(taps) { var a = []; taps.forEach(function (t) { a.push(Math.floor(t[0] / 10), t[0] % 10, Math.floor(t[1] / 10), t[1] % 10); }); return a; }
  function dec(ch) { var t = []; for (var i = 0; i + 3 < (ch || []).length; i += 4) t.push([ch[i] * 10 + ch[i + 1], ch[i + 2] * 10 + ch[i + 3]]); return t; }
  window.FP_BODY = { Z: Z, svg: svg, zonesSvg: zonesSvg, hit: hit, enc: enc, dec: dec };
})();

/* Misst alle SVG-Kreise und -Bögen der Seite: Reicht der Strich (inkl. Strichbreite) über die viewBox hinaus
   oder schneidet ein Elternelement mit overflow ab? Gibt eine Liste der Probleme zurück. Im Browser ausführen. */
(function () {
  var out = [], seen = 0;
  document.querySelectorAll("svg").forEach(function (svg) {
    var shapes = svg.querySelectorAll("circle,path");
    if (!shapes.length) return;
    var vb = svg.viewBox && svg.viewBox.baseVal; if (!vb || !vb.width) return;
    var r = svg.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
    var ring = svg.closest("[class*=ring],[class*=arc],[class*=prog],[class*=score],[class*=gauge],[class*=donut],.fpm-node");
    if (!ring) return;
    seen++;
    var name = (ring.className && ring.className.baseVal != null ? ring.className.baseVal : ring.className) + "";
    shapes.forEach(function (c) {
      var sw = parseFloat(getComputedStyle(c).strokeWidth) || 0;
      if (getComputedStyle(c).stroke === "none" || !sw) return;
      var bb; try { bb = c.getBBox(); } catch (e) { return; }
      var h = sw / 2, over = Math.max(vb.x - (bb.x - h), (bb.x + bb.width + h) - (vb.x + vb.width), vb.y - (bb.y - h), (bb.y + bb.height + h) - (vb.y + vb.height));
      var ov = getComputedStyle(svg).overflow;
      if (over > 0.01 && ov !== "visible") out.push(name + ": Strich ragt " + over.toFixed(2) + " Einheiten über die viewBox (stroke " + sw + ")");
    });
    // Abschneiden durch Elternelemente
    var p = svg.parentElement, rr = r;
    for (var i = 0; p && i < 8; i++, p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (/(hidden|clip|auto|scroll)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
        var pr = p.getBoundingClientRect();
        var cut = Math.max(pr.left - rr.left, rr.right - pr.right, pr.top - rr.top, rr.bottom - pr.bottom);
        // In Scroll-Leisten zählt nur ein angeschnittener (teilweise sichtbarer) Kreis, nicht einer, der ganz außerhalb liegt
        var teils = rr.right > pr.left + 0.5 && rr.left < pr.right - 0.5 && rr.bottom > pr.top + 0.5 && rr.top < pr.bottom - 0.5;
        if (cut > 0.5 && teils) { out.push(name + ": vom Elternelement ." + String(p.className).split(" ")[0] + " um " + cut.toFixed(1) + " px abgeschnitten"); break; }
      }
    }
    if (r.width - r.height > 1 || r.height - r.width > 1) {
      if (Math.abs(vb.width - vb.height) < 1) out.push(name + ": nicht quadratisch (" + r.width.toFixed(1) + "×" + r.height.toFixed(1) + " px)");
    }
  });
  // Runde HTML-Knoten (Checkpoints): in Scroll-Leisten nicht angeschnitten
  document.querySelectorAll(".fpm-node").forEach(function (n) {
    var r = n.getBoundingClientRect(); if (!r.width) return; seen++;
    var p = n.closest(".fpm-track"); if (!p) return; var pr = p.getBoundingClientRect();
    var teils = r.right > pr.left + 0.5 && r.left < pr.right - 0.5;
    var cut = Math.max(pr.left - r.left, r.right - pr.right);
    if (teils && cut > 0.5) out.push("Checkpoint-Kreis um " + cut.toFixed(1) + " px angeschnitten");
  });
  return JSON.stringify({ ringe: seen, probleme: Array.from(new Set(out)) });
})()

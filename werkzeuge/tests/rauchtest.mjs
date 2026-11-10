// Rauchtest: meldet sich mit dem Demo-Konto an (synthetische Daten), klickt alle Hauptbereiche durch
// und meldet JavaScript-Fehler, Konsolenfehler und Elemente, die breiter als der Bildschirm sind.
// Netzwerkzugriffe auf Supabase werden blockiert, getestet wird nur die App selbst.
// Aufruf: NODE_PATH=<playwright> node werkzeuge/tests/rauchtest.mjs [app-ordner] [login.js]
import { createRequire } from "node:module";
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = path.resolve(process.argv[2] || ".");
const loginFile = process.argv[3] || path.join(root, "werkzeuge/tests/demo-login.js");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/json" };
const srv = http.createServer((q, s) => { let f = path.join(root, decodeURIComponent(q.url.split("?")[0])); if (f.endsWith("/")) f += "index.html"; fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "Content-Type": types[path.extname(f)] || "application/octet-stream" }); s.end(d); }); }).listen(0);
const port = srv.address().port;
const VIEW = [["handy-360", 360, 760], ["tablet-820", 820, 1180], ["desktop-1366", 1366, 900]];
const browser = await chromium.launch(); let fehler = 0;
for (const [vn, w, h] of VIEW) for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, serviceWorkers: "block" });
  const pg = await ctx.newPage(); const log = [];
  pg.on("pageerror", (e) => log.push("JS-FEHLER " + e.message));
  pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_|supabase|fetch/i.test(m.text())) log.push("KONSOLE " + m.text().slice(0, 160)); });
  await pg.route(/supabase\.co|openai\.com/, (r) => r.abort());
  await pg.goto(`http://localhost:${port}/index.html`); await pg.waitForTimeout(1200);
  try { await pg.evaluate(fs.readFileSync(loginFile, "utf8")); } catch { /* Navigation nach Login */ }
  await pg.waitForLoadState("load"); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { try { localStorage.setItem("fp-tour-done", "1"); } catch {} document.querySelectorAll(".fx-tour,.fp-tour").forEach((x) => x.remove()); });
  const tabs = await pg.evaluate(() => [...document.querySelectorAll("nav button, nav a, .tabbar button, [role=tab]")].map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()).filter((t) => t && t.length < 30));
  const besucht = [];
  for (const t of [...new Set(tabs)]) {
    const ok = await pg.evaluate((t) => { const b = [...document.querySelectorAll("nav button, nav a, .tabbar button, [role=tab]")].find((x) => (x.getAttribute("aria-label") || x.textContent || "").trim() === t); if (!b) return false; b.click(); return true; }, t);
    if (!ok) continue; await pg.waitForTimeout(900); besucht.push(t);
    const breit = await pg.evaluate(() => { const W = document.documentElement.clientWidth; return document.documentElement.scrollWidth > W + 1 ? "Seite " + document.documentElement.scrollWidth + "px > " + W + "px" : ""; });
    if (breit) log.push(`ÜBERBREITE in "${t}": ${breit}`);
  }
  const angemeldet = await pg.evaluate(() => !document.querySelector("input[type=password]"));
  if (!angemeldet) log.push("Anmeldung mit Demo-Konto fehlgeschlagen");
  fehler += log.length;
  console.log(`${path.basename(root)} ${vn} ${scheme}: ${besucht.length} Bereiche (${besucht.join(", ")})${log.length ? "\n  - " + log.join("\n  - ") : " ok"}`);
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`ERGEBNIS: ${fehler} Probleme`); process.exit(fehler ? 1 : 0);

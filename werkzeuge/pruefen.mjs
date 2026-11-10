#!/usr/bin/env node
// Fallpfad Rauchtest: startet einen lokalen Server, laedt die App in Chrome (headless) und meldet
// Konsolenfehler, Ausnahmen, fehlende Dateien und CSP-Verstoesse.
// Aufruf: node werkzeuge/pruefen.mjs <app-ordner> [--shot datei.png] [--mobil] [--dunkel] [--js "ausdruck"]... [--warte ms]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const root = path.resolve(args[0] || ".");
const opt = { shots: [], js: [], warte: 2500 };
for (let i = 1; i < args.length; i++) {
  if (args[i] === "--shot") opt.js.push({ shot: args[++i] });
  else if (args[i] === "--js") opt.js.push({ js: args[++i] });
  else if (args[i] === "--warte") opt.js.push({ warte: Number(args[++i]) });
  else if (args[i] === "--mobil") opt.mobil = true;
  else if (args[i] === "--dunkel") opt.dunkel = true;
  else if (args[i] === "--csp") opt.csp = args[++i];
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
let headers = {};
try {
  const v = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  for (const h of v.headers || []) if (h.source === "/(.*)") for (const x of h.headers) headers[x.key] = x.value.replace("; upgrade-insecure-requests", "");
  delete headers["Strict-Transport-Security"];
} catch {}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", ...headers });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "fp-chrome-"));
const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + prof, "--no-first-run", "--disable-gpu", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((ok, no) => {
  let buf = "";
  chrome.stderr.on("data", (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) ok(m[1]); });
  setTimeout(() => no(new Error("Chrome startet nicht")), 15000);
});
const base = wsUrl.replace(/^ws/, "http").replace(/\/devtools\/.*/, "");
const tab = (await (await fetch(base + "/json/list")).json()).find((t) => t.type === "page");
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const probleme = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") probleme.push("AUSNAHME: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
  if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) probleme.push(m.params.type.toUpperCase() + ": " + m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400));
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") probleme.push("LOG: " + m.params.entry.text.slice(0, 300) + " " + (m.params.entry.url || ""));
  if (m.method === "Network.loadingFailed" && !m.params.canceled) probleme.push("NETZ: " + m.params.errorText + " " + (m.params.blockedReason || ""));
  if (m.method === "Network.responseReceived" && m.params.response.status >= 400 && m.params.response.url.includes("127.0.0.1")) probleme.push("HTTP " + m.params.response.status + ": " + m.params.response.url);
};
const send = (method, params = {}) => new Promise((ok) => { const i = ++id; pending.set(i, ok); ws.send(JSON.stringify({ id: i, method, params })); });
for (const d of ["Runtime", "Log", "Network", "Page"]) await send(d + ".enable");
await send("Emulation.setDeviceMetricsOverride", opt.mobil ? { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } : { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
if (opt.dunkel) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.navigate", { url: `http://127.0.0.1:${port}/index.html` });
await sleep(opt.warte + 2500);
for (const s of opt.js) {
  if (s.warte) await sleep(s.warte);
  if (s.js) {
    const r = await send("Runtime.evaluate", { expression: s.js, awaitPromise: true, returnByValue: true, userGesture: true });
    const v = r.result?.exceptionDetails ? "FEHLER " + (r.result.exceptionDetails.exception?.description || "") : JSON.stringify(r.result?.result?.value);
    console.log("JS> " + s.js.slice(0, 70) + " => " + String(v).slice(0, 1500));
    await sleep(900);
  }
  if (s.shot) {
    const r = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(s.shot, Buffer.from(r.result.data, "base64"));
  }
}
console.log(probleme.length ? "PROBLEME (" + probleme.length + "):\n" + [...new Set(probleme)].join("\n") : "OK: keine Fehler in der Konsole, keine fehlenden Dateien.");
ws.close(); chrome.kill(); server.close();
setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(probleme.length ? 1 : 0); }, 300);

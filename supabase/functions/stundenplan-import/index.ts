// Fallpfad: Stundenplan mit KI übernehmen (Lehrer-Portal)
// Supabase Edge Function "stundenplan-import".
//
// Lehrkräfte schicken einen Stundenplan in beliebiger Form: Text aus PDF, Word oder Excel (im Browser ausgelesen),
// eingefügten Text oder ein Foto bzw. einen Scan. Die KI liest daraus einzelne Unterrichtsstunden mit Datum, Uhrzeit,
// Thema, Raum und Lehrkraft bzw. Kurs. Die Funktion speichert nichts: Die Lehrkraft prüft die Vorschau im Portal und
// übernimmt sie dann selbst in den Stundenplan (Tabellen timetable bzw. teacher_lessons).
//
// Datenschutz: Stundenpläne enthalten in der Regel keine Daten von Lernenden. E-Mail-Adressen und Telefonnummern
// werden vor dem Versand entfernt. store=false, keine Inhalte in Logs. Gezählt wird nur die Anzahl der Aufrufe
// (gemeinsames Tageslimit mit dem Assistenten der Lehrkräfte, Tabelle fp_assistent_nutzung).
import { createClient } from "npm:@supabase/supabase-js@2";
import { antworten, koerper, vorpruefung } from "../_shared/sicherheit.ts";
import { kiFehlertext, kiJson } from "../_shared/openai.ts";

const MODEL = Deno.env.get("OPENAI_MODEL_STUNDENPLAN") ?? Deno.env.get("OPENAI_MODEL") ?? "gpt-6.1-terra";
const BASE = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const EFFORT = Deno.env.get("OPENAI_REASONING_STUNDENPLAN") ?? "low";
const LIMIT = Number(Deno.env.get("FALLPFAD_ASSISTENT_LIMIT_LEHRER") ?? "80");
const MAX_BILD = 6_000_000; // Zeichen der data-URL (etwa 4,5 MB Bild)

const S = (x: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(x), properties: x });
const STR = { type: "string" };
const SCHEMA = S({
  stunden: {
    type: "array",
    items: S({
      datum: STR, beginn: STR, ende: STR, titel: STR, raum: STR, lehrkraft: STR, kurs: STR, notiz: STR,
      status: { type: "string", enum: ["normal", "ausfall", "raum", "vertretung"] },
    }),
  },
  woechentlich: { type: "boolean" },
  hinweise: { type: "array", items: STR },
});

function clean(t: unknown, max: number) {
  return String(t ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-Mail]")
    .replace(/(\+49|0049)[\s\/\-]?\d{2,5}[\s\/\-]?\d{3,}[\s\-]?\d{0,6}/g, "[Telefon]")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}
const isoOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T12:00:00").getTime());
function zeit(t: unknown) {
  const m = String(t ?? "").trim().replace(".", ":").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return "";
  return String(h).padStart(2, "0") + ":" + m[2];
}
const WT = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function anweisung(art: "kurs" | "lehrer", woche: string, heute: string, kurse: string[]) {
  const tage = WT.map((t, i) => {
    const d = new Date(woche + "T12:00:00");
    d.setDate(d.getDate() + i);
    return `${t} = ${d.toISOString().slice(0, 10)}`;
  }).join(", ");
  return `Du liest Stundenpläne einer Pflegeschule in Deutschland und überträgst sie in einzelne Unterrichtsstunden.
Heute ist ${heute}. Die Lehrkraft hat im Portal die Woche ab Montag ${woche} geöffnet: ${tage}.

# Aufgabe
- Lies aus dem Material jede einzelne Unterrichtseinheit mit Datum, Beginn, Ende, Titel und, wenn vorhanden, Raum, Lehrkraft, Kurs und Notiz.
- Das Material kann unordentlich sein: Tabellen mit verbundenen Zellen, Spalten pro Wochentag, Zeilen pro Stunde, Fließtext, Abkürzungen, Fotos oder Scans. Ordne Zellen sinnvoll zu.
- ${art === "kurs" ? "Es ist der Stundenplan eines Kurses von Auszubildenden. „titel“ ist das Thema oder Fach, „lehrkraft“ die unterrichtende Person (Kürzel oder Name wie im Material), „kurs“ bleibt leer." : "Es ist der persönliche Stundenplan einer Lehrkraft. „titel“ ist das Thema oder Fach, „kurs“ ist der Kurs bzw. die Klasse, „lehrkraft“ bleibt leer."}${kurse.length ? `\n- Bekannte Kurse im Portal: ${kurse.join(", ")}. Verwende für „kurs“ genau diese Schreibweise, wenn ein Kurs im Material eindeutig dazu passt.` : ""}

# Datum
- Stehen im Material echte Daten (z. B. 12.11. oder 12.11.2026), nutze sie im Format JJJJ-MM-TT. Fehlt das Jahr, nimm das Jahr, das am nächsten an heute liegt.
- Stehen nur Wochentage (Mo, Di …) ohne Datum, setze die Daten der geöffneten Woche ein (siehe oben) und setze "woechentlich" auf true.
- Enthält das Material mehrere Wochen mit Daten, übernimm alle Stunden mit ihren Daten (höchstens 400 Stunden) und setze "woechentlich" auf false.

# Uhrzeiten
- Format HH:MM, 24 Stunden. Ende muss nach Beginn liegen.
- Stehen nur Stundennummern (1. Stunde, 3./4. Stunde), nutze das Stundenraster aus dem Material. Fehlt es, nimm 45-Minuten-Stunden ab 08:00 Uhr mit 15 Minuten Pause nach jeder Doppelstunde und schreibe das in "hinweise".
- Doppelstunden und Blöcke mit gleichem Thema direkt hintereinander fasst du zu einer Stunde zusammen.

# Status
- "ausfall", wenn die Stunde ausdrücklich entfällt; "raum", wenn ausdrücklich ein Raumwechsel vermerkt ist; "vertretung", wenn ausdrücklich eine Vertretung vermerkt ist; sonst "normal".

# Sonst
- Pausen, Feiertage ohne Unterricht, Überschriften und Legenden sind keine Stunden.
- Erfinde nichts. Unbekannte Felder bleiben leere Zeichenketten. Ist etwas unklar oder unleserlich, schreibe es kurz in "hinweise" (höchstens 6 kurze Sätze auf Deutsch).
- Namen von Auszubildenden gehören nicht in die Ausgabe.
- Antworte ausschließlich als JSON nach dem vorgegebenen Schema.`;
}

Deno.serve(async (req) => {
  const vor = vorpruefung(req, 7_000_000);
  if (vor) return vor;
  const json = antworten(req);
  const KEY = Deno.env.get("OPENAI_API_KEY");
  if (!KEY) return json({ error: "Der KI-Dienst ist an dieser Schule noch nicht eingerichtet." }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return json({ error: "Bitte melde dich an." }, 401);
  const { data: lehrkraft } = await sb.rpc("is_teacher");
  if (!lehrkraft) return json({ error: "Nur für Lehrkräfte." }, 403);

  const b = await koerper(req, 7_000_000);
  if (!b) return json({ error: "Ungültige Anfrage." }, 400);
  const art: "kurs" | "lehrer" = b.art === "lehrer" ? "lehrer" : "kurs";
  const text = clean(b.text, 60_000);
  let bild = typeof b.bild === "string" ? b.bild : "";
  if (bild && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(bild) || bild.length > MAX_BILD)) bild = "";
  if (!text && !bild) return json({ error: "Bitte lade eine Datei hoch oder füge den Stundenplan als Text ein." }, 400);
  const heute = isoOk(String(b.heute)) ? String(b.heute) : new Date().toISOString().slice(0, 10);
  let woche = isoOk(String(b.woche)) ? String(b.woche) : heute;
  const wd = new Date(woche + "T12:00:00");
  wd.setDate(wd.getDate() - ((wd.getDay() + 6) % 7));
  woche = wd.toISOString().slice(0, 10);
  const kurse = (Array.isArray(b.kurse) ? b.kurse : []).map((k: unknown) => clean(k, 60)).filter(Boolean).slice(0, 60);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: n, error: ze } = await admin.rpc("fp_assistent_zaehlen", { p_user: u.user.id, p_limit: LIMIT });
  if (ze) { console.error("zaehlen", ze.code); return json({ error: "Der KI-Dienst ist gerade nicht verfügbar." }, 503); }
  if (n === -1) return json({ error: "Für heute ist das Limit der KI-Funktionen erreicht. Morgen geht es weiter, oder füge die Tabelle ohne KI ein." }, 429);
  const zurueck = async () => { try { await admin.rpc("fp_assistent_zurueck", { p_user: u.user.id }); } catch { /* leer */ } };

  const ki = await kiJson({
    key: KEY, base: BASE, model: MODEL, effort: EFFORT,
    instructions: anweisung(art, woche, heute, kurse),
    input: (text ? "STUNDENPLAN (aus Datei oder eingefügt, Tabellenzellen mit | getrennt):\n" + text : "Der Stundenplan steht im Bild.") + (bild && text ? "\n\nZusätzlich liegt ein Bild des Stundenplans bei." : ""),
    bild: bild || undefined,
    schema: SCHEMA, name: "stundenplan", maxTokens: 16000,
  });
  if (!ki.ok) { await zurueck(); return json({ error: kiFehlertext(ki, "Der KI-Dienst") }, ki.status === 429 ? 429 : 502); }

  const roh = ki.daten || {};
  const STAT = ["normal", "ausfall", "raum", "vertretung"];
  const stunden = (Array.isArray(roh.stunden) ? roh.stunden : []).slice(0, 400).map((x: any) => ({
    datum: isoOk(String(x?.datum)) ? String(x.datum) : "",
    beginn: zeit(x?.beginn), ende: zeit(x?.ende),
    titel: clean(x?.titel, 120), raum: clean(x?.raum, 60), lehrkraft: clean(x?.lehrkraft, 80), kurs: clean(x?.kurs, 80), notiz: clean(x?.notiz, 400),
    status: STAT.includes(x?.status) ? x.status : "normal",
  })).filter((x: any) => x.datum && x.beginn && x.ende && x.ende > x.beginn && x.titel);
  const hinweise = (Array.isArray(roh.hinweise) ? roh.hinweise : []).map((x: unknown) => clean(x, 240)).filter(Boolean).slice(0, 6);
  if (!stunden.length) await zurueck();
  return json({ stunden, woechentlich: roh.woechentlich === true, hinweise, woche, meta: { anbieter: "OpenAI", region: BASE.includes("eu.api") ? "EU" : "USA" } });
});

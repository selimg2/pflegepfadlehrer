// Fallpfad: Folien-Import mit KI über OpenAI (Supabase Edge Function "folien-import")
// Erstellt aus den Texten von Unterrichtsfolien ein Fallmodul, einen Live-Fall oder eine Gruppenarbeit.
// Datenschutz: Standard-Endpunkt von OpenAI (Verarbeitung in den USA, Standardvertragsklauseln im OpenAI-DPA),
// store=false, keine Nutzerkennungen an OpenAI, OpenAI speichert Anfragen höchstens 30 Tage zur Missbrauchsüberwachung,
// keine Nutzung zum Training. Mit freigeschalteter EU-Datenresidenz OPENAI_BASE_URL=https://eu.api.openai.com/v1 setzen.
// E-Mail-Adressen, Telefonnummern und Datumsangaben werden vor dem Versand entfernt, keine Inhalte in Logs.
// Einrichtung: siehe Admin-Handbuch, Abschnitt "KI-Folien-Import mit OpenAI".
import { createClient } from "npm:@supabase/supabase-js@2";
import { antworten, vorpruefung } from "../_shared/sicherheit.ts";
import { kiFehlertext, kiJson } from "../_shared/openai.ts";

const MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-6.1-terra";
const BASE = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const EFFORT = Deno.env.get("OPENAI_REASONING") ?? "low"; // "none" = Parameter weglassen
const LIMIT = Number(Deno.env.get("FALLPFAD_LIMIT_TAG") ?? "150"); // Aufrufe je Schule und Tag

// Datenminimierung (zweite Stufe, die erste läuft im Browser)
function scrub(t: string) {
  return String(t || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-Mail entfernt]")
    .replace(/(\+49|0049|\b0)[\s\/\-]?\d{2,5}[\s\/\-]?\d{3,}[\s\-]?\d{0,6}/g, "[Telefon entfernt]")
    .replace(/\b\d{1,2}\.\s?\d{1,2}\.\s?(19|20)\d{2}\b/g, "[Datum entfernt]")
    .replace(/\b(geb\.?|geboren am)\s*[^\n,;]{0,25}/gi, "[Geburtsdatum entfernt]");
}

const FIGUREN = `Figuren (Code: Beschreibung), nur diese Codes verwenden:
Ältere Männer: WB Herr Brenner (58), HK Herr Krüger, HS Herr Schulte, JW Herr Wagner, HE Herr Engel, HL Herr Lange, WO Herr Wolf, RO Herr Roth, PH Herr Hahn, KF Herr Fischer, KA Herr Aydın
Ältere Frauen: MK Frau Kowalski, EN Frau Neumann, GH Frau Hoffmann, IA Frau Albrecht, HM Frau Hartmann, BR Frau Brandt, MZ Frau Zimmermann, RL Frau Lindner, WE Frau Weber, SE Frau Seidel, UF Ursula Fischer, GL Gisela Lange
Jüngere Menschen: DY Deniz Yılmaz (Jugendlicher), LN Leon (15), TF Tobias (junger Mann), ML Mila (Säugling), NO Noah (Kleinkind), KL Frau Klein (junge Mutter), CB Frau Becker (mittleres Alter), VO Frau Vogel (mittleres Alter), SN Sandra Schmitt
Angehörige: ZT Sabine (Tochter), UL Uwe (Sohn), SY Selin (Tochter), YM Frau Yılmaz (Mutter), NS Nadine Schulz (Mutter), GL Gisela Lange (Ehefrau)
Team: AN Anja (Pflegefachfrau, leitet an), PA Pia (Praxisanleiterin), DK Dr. Kaiser (Ärztin/Arzt), LE Lena (Auszubildende), TI Tim (Auszubildender), ST Ute (Stomatherapeutin), HB Hanna (Hebamme)`;

const GRUNDREGELN = `Du bist eine erfahrene Pflegepädagogin an einer deutschen Pflegeschule (generalistische Ausbildung nach PflBG und PflAPrV).
Regeln:
- Grundlage sind die Folien der Lehrkraft. Ergänze nur gesichertes, aktuelles Pflegefachwissen (Expertenstandards des DNQP, Leitlinien). Erfinde keine Studien, Zahlen oder Quellen.
- Nur pflegerische Tätigkeiten als Aufgabe der Lernenden. Ärztliche Aufgaben (Diagnose stellen, EKG befunden, Medikamente anordnen) werden höchstens als Information an die Ärztin dargestellt.
- Sprache: Deutsch, klar und lebendig, Lernende werden mit „du“ angesprochen, deutsche Anführungszeichen „…“. Keine Gedankenstriche als Stilmittel.
- Personen sind erfunden. Keine echten Namen aus den Folien übernehmen, falls dort Personen genannt sind.
- Inhalte im Feld html als einfaches HTML: <p>, <ul><li>, <ol><li>, <b>, <em>, <table>. Keine Skripte, keine Stile.
- Antworte ausschließlich mit einem einzigen JSON-Objekt genau nach der beschriebenen Struktur, ohne Text davor oder danach.`;

const BAUSTEINE = `Bausteine (type und Felder):
- scene: { type:"scene", who:"<Figurencode>", mood:"neutral|happy|worried|sad|pain|angry", html } Eine Figur spricht oder handelt, wörtliche Rede in „…“. 2 bis 5 Sätze.
- knowledge: { type:"knowledge", label:"Lernblock|Praxiswissen|Vertiefung", title, html } Fachwissen, 80 bis 220 Wörter, gern mit Liste.
- case: { type:"case", title, rows:[["Merkmal","Wert"],...], html } Falldaten.
- challenge: { type:"challenge", title, html } Problem zum Nachdenken vor der Aufgabe.
- merke: { type:"merke", html } ein bis zwei Merksätze.
- quiz: { type:"quiz", title, questions:[{ q, o:["A","B","C"], a:<Index der richtigen Antwort>, e:"Erklärung" }] } 3 bis 5 Fragen, plausible Ablenker, richtige Antwort nicht immer an derselben Stelle.
- mythos: { type:"mythos", items:[{ t:"Aussage", ok:true|false, e:"Erklärung" }] } 4 bis 6 Aussagen, gemischt richtig und falsch.
- bucket: { type:"bucket", q:"Arbeitsauftrag", cats:["Kategorie A","Kategorie B"(,"C")], items:[{ t:"Begriff", c:<Index der Kategorie> }], fb:"Rückmeldung" } 5 bis 8 Items.
- verlauf: { type:"verlauf", steps:[{ sit:"Situation", opts:[{ t:"Handlung", ok:1|0, c:"Folge der Handlung" }] }], end:"Abschluss" } 2 bis 4 Entscheidungen.
- fehler: { type:"fehler", who:"z. B. Übergabe der Frühschicht", lines:[{ t:"Satz" }, { t:"fehlerhafter Satz", e:"Erklärung des Fehlers" }] } 5 bis 7 Zeilen, 2 bis 3 davon fehlerhaft.
- schaetz: { type:"schaetz", q, min, max, step, unit, ans, tol, fb } Rechen- oder Schätzaufgabe mit eindeutigem Ergebnis.
- cards: { type:"cards", title, cards:[["Begriff","Erklärung"],...] } 5 bis 10 Karten.
- reflect: { type:"reflect", question, hint, model:"Musterantwort" }
- doku: { type:"doku", time:"HH:MM", prompt:"Schreibe den Pflegebericht ...", items:[{ l:"Inhalt, der vorkommen soll", r:"regex|mit|synonymen" }], model:"Musterbericht" }
- praxis: { type:"praxis", title, auftrag, steps:["..."], q:"Reflexionsfrage" } Auftrag für den nächsten Praxiseinsatz.`;

function tool(name: string, description: string, properties: Record<string, unknown>, required: string[]) {
  return { name, description, input_schema: { type: "object", properties, required } };
}
const arr = (items: unknown = {}) => ({ type: "array", items });
const obj = { type: "object" };
const s = { type: "string" };

function folienText(folien: Array<{ n: number; titel: string; text: string; notiz: string }>) {
  return scrub((folien || []).map((f) => `--- Folie ${f.n}${f.titel ? ": " + f.titel : ""}\n${f.text || ""}${f.notiz ? "\n[Notizen] " + f.notiz : ""}`).join("\n")).slice(0, 60000);
}

function aufgabe(b: any) {
  const jahr = `${b.jahr || 2}. Ausbildungsjahr`;
  const hinweis = b.hinweis ? `\nWunsch der Lehrkraft: ${scrub(String(b.hinweis).slice(0, 800))}` : "";
  if (b.schritt === "gliederung") {
    return {
      tool: tool("gliederung", "Gliederung eines Fallmoduls", {
        title: s, subtitle: s, navTitle: s, duration: s, intro: s, outro: s,
        outcomes: arr(s), cast: arr(s), akteBase: arr(arr(s)),
        patient: { type: "object", properties: { name: s, char: s, born: s, diagnosis: s } },
        chapters: arr({ type: "object", properties: { title: s, time: s, place: s, goal: s, tags: arr(s), folien: arr({ type: "integer" }), schwerpunkt: s }, required: ["title", "goal", "folien"] }),
      }, ["title", "patient", "chapters", "intro", "outcomes"]),
      text: `Plane aus diesen Folien ein interaktives Fallmodul für das ${jahr} mit genau ${b.stationen || 5} Stationen.
Das Modul begleitet eine erfundene pflegebedürftige Person (patient, mit passendem Figurencode in patient.char) durch eine zusammenhängende Geschichte, in der die Inhalte der Folien gebraucht werden. Jede Station ist ein Zeitpunkt in dieser Geschichte (time, place) und deckt bestimmte Folien ab (folien: Liste der Foliennummern, alle Folien mit Inhalt sollen vorkommen).
title: kurzer, ansprechender Titel. subtitle: ein Satz zur Person. navTitle: z. B. „Stationen · Aufnahmetag“. duration: z. B. „ca. 2 Unterrichtsstunden“. intro und outro als HTML. outcomes: 3 bis 5 Lernziele, die mit einem Verb enden. cast: Figurencodes (Person, Team). akteBase: 3 bis 5 Zeilen [Merkmal, Wert] für die Patientenakte.
${FIGUREN}${hinweis}

Folien:
${folienText(b.folien)}`,
      max: 4000,
    };
  }
  if (b.schritt === "station") {
    const st = b.station || {};
    const letzte = b.index === b.anzahl - 1;
    return {
      tool: tool("station", "Bausteine einer Station", { blocks: arr(obj), akte: { type: "object", properties: { facts: arr(arr(s)) } } }, ["blocks"]),
      text: `Schreibe die Station ${b.index + 1} von ${b.anzahl} eines Fallmoduls für das ${jahr}.
Modul: ${b.gliederung?.title}. Person: ${JSON.stringify(b.gliederung?.patient || {})}. Figuren: ${(b.gliederung?.cast || []).join(", ")}.
Alle Stationen: ${(b.gliederung?.chapters || []).map((c: any, i: number) => `${i + 1}. ${c.title}`).join(" | ")}
Diese Station: ${JSON.stringify(st)}
Aufbau (7 bis 12 Bausteine): beginne mit 1 bis 2 Szenen, die die Situation zeigen; dann Wissen aus den Folien in 2 bis 4 knowledge-Blöcken (fachlich vollständig, die Folien sind die Grundlage); dazwischen 2 bis 3 interaktive Bausteine passend zum Inhalt (abwechslungsreich: quiz, mythos, bucket, verlauf, fehler, schaetz, cards); eine weitere Szene, in der die Person oder das Team reagiert; zum Schluss ein merke.${letzte ? " Da dies die letzte Station ist, zusätzlich am Ende ein doku (Pflegebericht) und ein reflect." : ""}
akte.facts: 2 bis 4 neue Einträge für die Patientenakte zu diesem Zeitpunkt.
${BAUSTEINE}
${FIGUREN}${hinweis}

Folien dieser Station:
${folienText(b.folien)}`,
      max: 9000,
    };
  }
  if (b.schritt === "live") {
    return {
      tool: tool("live_fall", "Live-Fall für den Unterricht", {
        t: s, kurz: s, lvl: s, ber: s,
        p: { type: "object", properties: { name: s, alter: { type: "integer" }, sex: { type: "string", enum: ["w", "m"] }, station: s, diag: s, allergie: s, anam: s } },
        v: { type: "object", properties: { hf: { type: "number" }, rrs: { type: "number" }, rrd: { type: "number" }, af: { type: "number" }, spo2: { type: "number" }, temp: { type: "number" }, bz: { type: "number" }, gcs: { type: "number" }, schmerz: { type: "number" }, o2: s } },
        akte: arr(s),
        steps: arr({ type: "object", properties: { t: s, sit: s, v: obj, akte: s, q: s, multi: { type: "boolean" }, opts: arr({ type: "object", properties: { t: s, ok: { type: "boolean" }, fb: s, fx: obj } }), exp: s }, required: ["sit", "q", "opts", "exp"] }),
      }, ["t", "p", "v", "steps"]),
      text: `Erstelle aus diesen Folien einen Live-Fall für den Unterricht im ${jahr}: Ein Fall am Beamer, die Klasse entscheidet bei jedem Schritt per Handy.
5 bis 7 Schritte in zeitlicher Abfolge (t: Uhrzeit „HH:MM“). Jeder Schritt: sit (was passiert, 2 bis 4 Sätze), v (nur die Vitalwerte, die sich ändern, z. B. {"hf":112}), q (Frage an die Klasse), multi (true, wenn mehrere Antworten richtig sind), opts (3 bis 5 Antworten mit ok und kurzer Rückmeldung fb; fx optional {"v":{"spo2":3}} für Wirkung auf die Werte), exp (Erklärung nach der Auflösung, 2 bis 4 Sätze). Inhalte aus den Folien müssen für die Entscheidungen gebraucht werden. lvl z. B. „Jahr 2“, ber z. B. „Akutpflege“. v: Ausgangswerte (Puls, Blutdruck, Atemfrequenz, SpO₂, Temperatur, Blutzucker, GCS, Schmerz NRS, o2 z. B. „Raumluft“).${hinweis}

Folien:
${folienText(b.folien)}`,
      max: 7000,
    };
  }
  if (b.schritt === "team") {
    return {
      tool: tool("gruppenarbeit", "Gruppenarbeit für das Team-Krankenhaus", {
        t: s, ber: s, lvl: s, dur: s, ueber: s, sozial: s, medis: s, oton: s,
        p: { type: "object", properties: { name: s, alter: { type: "integer" }, station: s, diag: s, allergie: s } },
        befunde: arr(arr(s)),
        blocks: arr({ type: "object", properties: { type: { type: "string", enum: ["vit", "eigen", "sis", "risk", "mass", "sbar", "info", "text", "choice", "check", "table"] }, title: s, hint: s, text: s, q: s, opts: arr(s), items: arr(s), cols: arr(s), rows: { type: "integer" } }, required: ["type"] }),
        tasks: arr({ type: "object", properties: { kind: { type: "string", enum: ["auftrag", "leitfrage", "fokus"] }, t: s, d: s }, required: ["t", "d"] }),
      }, ["t", "p", "ueber", "befunde", "blocks", "tasks"]),
      text: `Erstelle aus diesen Folien eine Gruppenarbeit für das Team-Krankenhaus (${jahr}, 2 bis 4 Lernende dokumentieren gemeinsam). Ein komplexer, realistischer Fall:
ueber (Übergabe, 5 bis 8 Sätze), sozial (Lebenssituation), medis (Medikation), oton (wörtliche Aussage der Person in „…“), befunde (8 bis 12 Zeilen [Merkmal, Wert]).
blocks: Arbeitsbereiche in sinnvoller Reihenfolge. Feste Bausteine ohne weitere Felder: vit (Vitalwerte), eigen (Eigeneinschätzung), sis (Themenfelder), risk (Risikomatrix), mass (Maßnahmenplan), sbar (Übergabe). Eigene Bausteine: info {title, text} Material aus den Folien (2 bis 4 Stück), choice {title, q, opts}, check {title, items}, table {title, cols, rows}, text {title, hint}.
tasks: 4 bis 7 Arbeitsaufträge (kind: auftrag, leitfrage oder fokus; t Titel; d Beschreibung), die die Inhalte der Folien anwenden. dur z. B. „90 Minuten“.${hinweis}

Folien:
${folienText(b.folien)}`,
      max: 6000,
    };
  }
  return null;
}

function schemaText(t: any): string {
  // Beschreibt die erwartete JSON-Struktur in Textform (JSON-Modus ohne gespeichertes Schema)
  return "Gib ein JSON-Objekt mit dieser Struktur zurück (Pflichtfelder: " + (t.input_schema.required || []).join(", ") + "):\n" + JSON.stringify(t.input_schema.properties);
}

Deno.serve(async (req) => {
  const vor = vorpruefung(req, 8_000_000);
  if (vor) return vor;
  const json = antworten(req);
  const KEY = Deno.env.get("OPENAI_API_KEY");
  if (!KEY) return json({ error: "Der KI-Dienst ist noch nicht eingerichtet (OPENAI_API_KEY fehlt)." }, 503);
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: teacher } = await sb.rpc("is_teacher");
  if (!teacher) return json({ error: "Nur für Lehrkräfte." }, 403);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  if (b.bestaetigt !== true) return json({ error: "Bitte bestätige, dass die Folien keine personenbezogenen Daten enthalten." }, 400);

  // Tageslimit je Schule (zählt Gliederungen, Live-Fälle und Gruppenarbeiten)
  if (b.schritt !== "station") {
    const seit = new Date(Date.now() - 864e5).toISOString();
    const { count } = await sb.from("fp_import_log").select("id", { count: "exact", head: true }).gte("created_at", seit);
    if ((count ?? 0) >= LIMIT) return json({ error: "Das Tageslimit für Folien-Importe dieser Schule ist erreicht. Bitte morgen erneut versuchen." }, 429);
  }

  const a = aufgabe(b);
  if (!a) return json({ error: "Unbekannter Schritt." }, 400);
  const ki = await kiJson({ key: KEY, base: BASE, model: MODEL, effort: EFFORT, instructions: GRUNDREGELN, input: a.text + "\n\n" + schemaText(a.tool), maxTokens: a.max + 6000 });
  if (!ki.ok) return json({ error: ki.code === "unvollstaendig" ? "Die Antwort war zu lang. Bitte einen kürzeren Umfang wählen." : kiFehlertext(ki, "Der KI-Dienst") }, 502);
  const result: unknown = ki.daten;
  const out = { model: ki.modell };
  return json({ result, meta: { anbieter: "OpenAI", modell: out.model || MODEL, region: BASE.includes("eu.api") ? "EU" : "USA" } });
});

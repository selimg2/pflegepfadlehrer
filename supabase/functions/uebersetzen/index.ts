// Fallpfad: "Meine Sprache" – Lerninhalte übersetzen oder in einfaches Deutsch umschreiben
// (Supabase Edge Function "uebersetzen", nur für angemeldete Nutzerinnen und Nutzer).
//
// Datenschutz:
// - Übersetzt werden ausschließlich Lerninhalte der App (Lernblöcke, Fachbegriffe, markierte Stellen aus Fällen).
//   Eingabefelder (eigene Antworten, Berichte, Nachrichten) kann die App gar nicht an diese Funktion schicken.
// - An OpenAI gehen nur der Text und die Zielsprache. Keine Namen, keine E-Mail, keine Nutzerkennung, keine IP der Nutzer.
// - Standard-Endpunkt von OpenAI (Verarbeitung in den USA, EU-Standardvertragsklauseln im OpenAI-DPA), store=false,
//   OpenAI bewahrt Anfragen höchstens 30 Tage zur Missbrauchsüberwachung auf und nutzt API-Daten nicht zum Training.
// - Ergebnisse landen in einem gemeinsamen Cache (Tabelle fp_uebersetzungen) ohne Personenbezug: Prüfsumme, Sprache, Text.
// - Für das Tageslimit wird je Konto und Tag nur die Zeichenzahl gezählt (fp_ls_nutzung), Einträge älter als 7 Tage werden gelöscht.
// - Keine Inhalte in Logs, nur Statuscodes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { antworten, vorpruefung, kiErlaubt, OHNE_KURS } from "../_shared/sicherheit.ts";

const MODEL = Deno.env.get("OPENAI_MODEL_UEBERSETZEN") ?? Deno.env.get("OPENAI_MODEL") ?? "gpt-6.1-terra";
const BASE = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
const EFFORT = Deno.env.get("OPENAI_REASONING_UEBERSETZEN") ?? "low"; // wie die anderen KI-Funktionen; "none" = Parameter weglassen
const TAGESLIMIT = Number(Deno.env.get("FALLPFAD_LS_ZEICHEN_TAG") ?? "250000"); // Zeichen je Konto und Tag (Cache-Treffer zählen nicht)
const MAX_TEXTE = 30; // je Anfrage
const SCHEMA = { type: "object", additionalProperties: false, required: ["t"], properties: { t: { type: "array", items: { type: "string" } } } };

const SPRACHEN: Record<string, string> = {
  einfach: "Einfaches Deutsch", en: "Englisch", tr: "Türkisch", ar: "Arabisch", uk: "Ukrainisch", ru: "Russisch",
  vi: "Vietnamesisch", pl: "Polnisch", ro: "Rumänisch", fa: "Persisch (Farsi)", hi: "Hindi", tl: "Filipino (Tagalog)",
  es: "Spanisch", fr: "Französisch", sq: "Albanisch", sr: "Serbisch", it: "Italienisch", ku: "Kurdisch (Kurmandschi)",
  ml: "Malayalam", bs: "Bosnisch", hr: "Kroatisch", el: "Griechisch", pt: "Portugiesisch", ta: "Tamil",
};

function clean(t: string) {
  return String(t || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-Mail]")
    .replace(/(\+49|0049|\b0)[\s\/\-]?\d{2,5}[\s\/\-]?\d{3,}[\s\-]?\d{0,6}/g, "[Telefon]")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha(t: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function anweisung(lang: string) {
  if (lang === "einfach") {
    return `Du schreibst Lerntexte der Pflegeausbildung in einfaches Deutsch (Sprachniveau B1) um.
Regeln: kurze Sätze, aktive Sprache, ein Gedanke pro Satz. Fachbegriffe bleiben stehen, damit Lernende sie für Prüfung und Station kennen; erkläre jeden Fachbegriff beim ersten Vorkommen kurz in Klammern.
Inhaltlich nichts weglassen, nichts hinzufügen, keine Zahlen, Einheiten oder Grenzwerte verändern. Lernende werden mit „du“ angesprochen.`;
  }
  const z = SPRACHEN[lang];
  return `Du übersetzt Lerntexte der deutschen Pflegeausbildung ins ${z}.
Regeln: genau und vollständig übersetzen, nichts hinzufügen oder weglassen. Zahlen, Einheiten, Grenzwerte und Abkürzungen unverändert lassen.
Wichtige deutsche Fachbegriffe beim ersten Vorkommen in Klammern auf Deutsch dahinter schreiben, z. B. „… (Dekubitus)“, damit Lernende den deutschen Begriff für Station und Prüfung lernen.
Verständliche, freundliche Sprache für Auszubildende.`;
}

Deno.serve(async (req) => {
  const vor = vorpruefung(req, 300_000);
  if (vor) return vor;
  const json = antworten(req);
  const KEY = Deno.env.get("OPENAI_API_KEY");
  if (!KEY) return json({ error: "Die Übersetzung ist an dieser Schule noch nicht eingerichtet." }, 503);

  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return json({ error: "Bitte melde dich an." }, 401);
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!(await kiErlaubt(admin, u.user.id))) return json({ error: OHNE_KURS, kurs: false }, 403);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  const lang = String(b.lang || "");
  if (!SPRACHEN[lang]) return json({ error: "Diese Sprache wird nicht unterstützt." }, 400);
  const texts: string[] = (Array.isArray(b.texts) ? b.texts : []).slice(0, MAX_TEXTE).map((t: string) => clean(t).slice(0, 3000)).filter(Boolean);
  if (!texts.length) return json({ out: [] });

  // 1. Gemeinsamer Cache ohne Personenbezug
  const hashes = await Promise.all(texts.map((t) => sha(lang + "\n" + t)));
  const { data: hits } = await admin.from("fp_uebersetzungen").select("h,out").eq("lang", lang).in("h", hashes);
  const map = new Map((hits || []).map((x: any) => [x.h, x.out]));
  const offen = texts.map((t, i) => ({ t, i, h: hashes[i] })).filter((x) => !map.has(x.h));

  if (offen.length) {
    // 2. Tageslimit je Konto (nur Zeichenzahl)
    const tag = new Date().toISOString().slice(0, 10);
    const zeichen = offen.reduce((n, x) => n + x.t.length, 0);
    const { data: nz } = await admin.from("fp_ls_nutzung").select("zeichen").eq("user_id", u.user.id).eq("tag", tag).maybeSingle();
    const bisher = nz?.zeichen ?? 0;
    if (bisher + zeichen > TAGESLIMIT) return json({ error: "Für heute ist das Übersetzungslimit erreicht. Wörterbuch und Vorlesen funktionieren weiter." }, 429);
    await admin.from("fp_ls_nutzung").upsert({ user_id: u.user.id, tag, zeichen: bisher + zeichen });
    if (Math.random() < 0.05) await admin.from("fp_ls_nutzung").delete().lt("tag", new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));

    // 3. OpenAI (nur Text und Zielsprache). Strukturierte Ausgabe (JSON-Schema), damit Anzahl und Reihenfolge stimmen.
    //    Bei unvollständiger Antwort wird einzeln nachübersetzt, damit eine Seite nie ganz scheitert.
    // Varianten: erst die Standardeinstellung, bei 400 (Parameter vom Modell nicht unterstützt) eine einfachere Fassung
    const VARIANTEN = [
      { format: "schema", effort: EFFORT },
      { format: "schema", effort: EFFORT === "none" ? "low" : "none" },
      { format: "objekt", effort: "low" },
      // zuletzt das allgemeine Modell, das auch Folien-Import und Assistent nutzen
      { format: "schema", effort: "low", model: Deno.env.get("OPENAI_MODEL") ?? "gpt-6.1-terra" },
    ];
    let variante = 0;
    async function frage(liste: string[]): Promise<string[] | { fehler: number }> {
      const v: { format: string; effort: string; model?: string } = VARIANTEN[variante];
      const body: Record<string, unknown> = {
        model: v.model || MODEL,
        instructions: anweisung(lang) + `\nDu bekommst ein JSON-Objekt mit dem Feld "texte" (${liste.length} Einträge). Antworte als JSON mit dem Feld "t": genau ${liste.length} Übersetzungen in derselben Reihenfolge. Platzhalter wie ⟦N⟧ unverändert übernehmen. Sehr kurze Texte (Knöpfe, Überschriften) knapp übersetzen.`,
        input: "JSON: " + JSON.stringify({ texte: liste }),
        text: { format: v.format === "schema" ? { type: "json_schema", name: "uebersetzung", strict: true, schema: SCHEMA } : { type: "json_object" } },
        store: false,
        max_output_tokens: 12000,
      };
      if (v.effort !== "none") body.reasoning = { effort: v.effort };
      let r: Response;
      try {
        r = await fetch(BASE + "/responses", { method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch {
        return { fehler: 503 };
      }
      if (!r.ok) {
        // Nur Statuscode und Fehlertyp ins Log, keine Inhalte
        let typ = ""; try { const e = await r.json(); typ = String(e?.error?.code || e?.error?.type || "").slice(0, 60) + " " + String(e?.error?.param || "").slice(0, 40); } catch { /* leer */ }
        console.error("OpenAI", r.status, typ, "variante", variante);
        if (r.status === 400 && variante < VARIANTEN.length - 1) { variante++; return frage(liste); }
        return { fehler: r.status };
      }
      const o = await r.json();
      let text = "";
      for (const item of o.output || []) if (item.type === "message") for (const c of item.content || []) if (c.type === "output_text") text += c.text;
      let arr: unknown = [];
      try { arr = JSON.parse(text).t; } catch { /* leer */ }
      return Array.isArray(arr) ? arr.map((x) => String(x ?? "")) : [];
    }
    let arr = await frage(offen.map((x) => x.t));
    if (!Array.isArray(arr)) {
      const st = arr.fehler;
      return json({ error: st === 429 ? "Der Übersetzungsdienst ist gerade ausgelastet. Bitte gleich noch einmal versuchen." : st === 503 ? "Der Übersetzungsdienst ist gerade nicht erreichbar." : "Die Übersetzung hat gerade nicht geklappt. Bitte später noch einmal versuchen." }, 502);
    }
    if (arr.length !== offen.length) {
      // Einzeln nachfragen (höchstens 10, sonst Rest leer lassen; die App versucht es später erneut)
      const einzeln: string[] = [];
      for (let k = 0; k < offen.length; k++) {
        if (k >= 10) { einzeln.push(""); continue; }
        const e = await frage([offen[k].t]);
        einzeln.push(Array.isArray(e) && e.length === 1 ? e[0] : "");
      }
      arr = einzeln;
    }
    const fertig = arr as string[];
    const rows = offen.map((x, k) => ({ h: x.h, lang, out: String(fertig[k] || "").slice(0, 8000) })).filter((x) => x.out);
    rows.forEach((x) => map.set(x.h, x.out));
    if (rows.length) await admin.from("fp_uebersetzungen").upsert(rows);
  }
  return json({ out: hashes.map((h) => map.get(h) || ""), meta: { anbieter: "OpenAI", region: BASE.includes("eu.api") ? "EU" : "USA" } });
});

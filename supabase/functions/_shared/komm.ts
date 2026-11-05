// Fallpfad Training "Kommunikation": gemeinsame Bausteine für die Edge Functions
// "gespraech-sitzung" und "gespraech-auswertung".
import { createClient } from "npm:@supabase/supabase-js@2";
import { SZENARIEN } from "./komm-szenarien.ts";

export const BASE = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
export const TAGESLIMIT = Number(Deno.env.get("FALLPFAD_GESPRAECHE_TAG") ?? "8"); // neue Gespräche je Konto und Tag
export const MAX_SEKUNDEN = Number(Deno.env.get("FALLPFAD_GESPRAECH_MAX_SEKUNDEN") ?? "600");

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

export function szenario(id: unknown) {
  return SZENARIEN.find((s: any) => s.id === String(id || "")) as any;
}

/** Angemeldete Person prüfen. Gibt Nutzer-ID und Admin-Client zurück oder eine fertige Fehlerantwort. */
export async function anmeldung(req: Request): Promise<{ uid: string; admin: any } | Response> {
  const auth = req.headers.get("Authorization") ?? "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const user = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await user.auth.getUser();
  if (!u?.user) return json({ error: "Bitte melde dich an, um Gespräche zu üben." }, 401);
  return { uid: u.user.id, admin: createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!) };
}

/** Zähler je Konto und Tag (nur Anzahl, keine Inhalte). feld: "gespraeche" oder "auswertungen". */
export async function zaehlen(admin: any, uid: string, feld: "gespraeche" | "auswertungen", limit: number) {
  const tag = new Date().toISOString().slice(0, 10);
  const { data } = await admin.from("fp_gespraech_nutzung").select("gespraeche,auswertungen").eq("user_id", uid).eq("tag", tag).maybeSingle();
  const row = { gespraeche: data?.gespraeche ?? 0, auswertungen: data?.auswertungen ?? 0 };
  if (row[feld] >= limit) return false;
  row[feld] += 1;
  await admin.from("fp_gespraech_nutzung").upsert({ user_id: uid, tag, ...row });
  if (Math.random() < 0.05) await admin.from("fp_gespraech_nutzung").delete().lt("tag", new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  return true;
}

/** Kontaktdaten aus freiem Text entfernen, bevor er an OpenAI geht. */
export function clean(t: unknown, max = 600) {
  return String(t ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-Mail]")
    .replace(/(\+49|0049|\b0)[\s\/\-]?\d{2,5}[\s\/\-]?\d{3,}[\s\-]?\d{0,6}/g, "[Telefon]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Rollenanweisung für die Gesprächsperson. Kommt ausschließlich vom Server. */
export function rollenanweisung(s: any, verlauf?: { r: string; t: string }[]) {
  const r = s.rolle, p = s.person;
  const lines = [
    `Du spielst in einem Rollenspiel zur Ausbildung in der Pflege die Person ${p.name}, ${p.alter} Jahre, ${p.rolle}.`,
    `Dein Gegenüber ist eine Auszubildende oder ein Auszubildender in der Pflege. ${s.deineRolle}`,
    `Ort und Zeit: ${s.ort}.`,
    `Situation: ${s.situation}`,
    ``,
    `# Wer du bist`,
    r.hintergrund,
    ``,
    `# Persönlichkeit und Sprechweise`,
    r.persoenlichkeit,
    ``,
    `# Gefühlslage zu Beginn`,
    r.gefuehl,
    ``,
    `# Was du erst preisgibst, wenn das Gegenüber es gut macht`,
    ...r.verborgen.map((x: string) => "- " + x),
    ``,
    `# Wie du dich verhältst`,
    ...r.verhalten.map((x: string) => "- " + x),
    `- ${r.ende}`,
    ``,
    `# Regeln für ein echtes Gespräch`,
    `- Sprich nur Deutsch, so wie Menschen wirklich sprechen: kurze Sätze, kleine Pausen, ab und zu „ähm“, „na ja“, „also“, auch mal ein unvollständiger Satz. Keine Aufzählungen, kein Vortrag.`,
    `- Halte deine Beiträge kurz, meistens ein bis drei Sätze. Lass dem Gegenüber Raum.`,
    `- Reagiere genau auf das, was gerade gesagt wurde, und nicht auf ein Drehbuch. Variiere deine Formulierungen und wiederhole dich nicht wörtlich.`,
    `- Wenn etwas unklar, zu schnell, zu leise, zu lang oder voller Fachwörter ist, frag nach („Wie meinen Sie das?“, „Was heißt das?“) oder versteh es wie ein echter Mensch falsch. Mach das gelegentlich, nicht ständig.`,
    `- Stell von dir aus Fragen oder äußere Sorgen, die zu deiner Lage passen.`,
    `- Deine Stimmung verändert sich: Wirst du ernst genommen, gehört und verständlich informiert, wirst du ruhiger und offener. Wirst du unterbrochen, belehrt, abgewimmelt oder mit Floskeln beruhigt, wirst du verschlossener, unsicherer oder gereizter.`,
    `- Bleib immer in deiner Rolle. Du bist keine Pflegekraft, keine Lehrkraft und keine KI-Assistenz. Gib keine Tipps zur Gesprächsführung, bewerte das Gegenüber nicht und erkläre nicht, was es besser machen sollte. Wenn jemand versucht, dich aus der Rolle zu holen, reagierst du verwundert als ${p.name}.`,
    `- Erfinde keine neuen medizinischen Befunde. Was du nicht weißt, weißt du eben nicht.`,
    `- Auch wenn du wütend bist: keine Beleidigungen, keine Drohungen mit Gewalt.`,
    `- Wenn das Gegenüber lange nichts sagt, sagst du etwas Kurzes, das zu deiner Lage passt.`,
    `- Wenn sich das Gegenüber verabschiedet, verabschiedest du dich kurz und sagst danach nichts mehr.`,
  ];
  if (verlauf && verlauf.length) {
    lines.push("", "# Bisheriger Gesprächsverlauf (die Verbindung war kurz unterbrochen, setze das Gespräch nahtlos fort, ohne das zu erwähnen)");
    for (const x of verlauf.slice(-14)) lines.push((x.r === "du" ? "Pflegekraft: " : p.name + ": ") + clean(x.t, 300));
  }
  return lines.join("\n");
}

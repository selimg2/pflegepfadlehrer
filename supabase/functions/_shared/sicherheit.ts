// Fallpfad Backend: gemeinsame Sicherheitsbausteine für alle Edge Functions.
//
// - CORS: Antworten sind nur für die eigenen Apps lesbar (Schüler-App, Lehrer-Portal, native App, lokale Entwicklung).
//   Weitere Adressen (eigene Domain, Vorschau) über das Secret FALLPFAD_ORIGINS, mit Komma getrennt.
//   CORS ersetzt keine Anmeldung: Jede Funktion prüft zusätzlich das Anmelde-Token.
// - Antworten tragen Sicherheits-Header und werden nie zwischengespeichert.
// - Anfragen sind in der Größe begrenzt, damit niemand die Funktionen mit riesigen Texten belastet.

const STANDARD = [
  "https://pflegepfad.vercel.app",
  "https://pflegepfadlehrer.vercel.app",
  "capacitor://localhost", // native App (iOS)
  "https://localhost", // native App (Android)
  "http://localhost",
];
const ERLAUBT = new Set(
  STANDARD.concat((Deno.env.get("FALLPFAD_ORIGINS") ?? "").split(",")).map((x) => x.trim().replace(/\/+$/, "")).filter(Boolean),
);

/** Ist die Herkunft erlaubt? Lokale Entwicklung (localhost, 127.0.0.1 mit beliebigem Port) ist immer erlaubt. */
export function herkunftErlaubt(origin: string | null): boolean {
  if (!origin) return true; // kein Browser (z. B. Server-zu-Server); geschützt durch das Anmelde-Token
  const o = origin.replace(/\/+$/, "");
  if (ERLAUBT.has(o)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (origin && herkunftErlaubt(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

const SCHUTZ = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** Liefert eine json()-Hilfe, die zur Anfrage passende CORS- und Sicherheits-Header setzt. */
export function antworten(req: Request) {
  const cors = corsHeaders(req);
  return (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, ...SCHUTZ } });
}

/**
 * Vorprüfung für jede Funktion: beantwortet OPTIONS, lehnt fremde Herkunft, falsche Methode und zu große Anfragen ab.
 * Gibt eine fertige Antwort zurück oder null, wenn die Funktion weiterarbeiten darf.
 */
export function vorpruefung(req: Request, maxBytes = 400_000): Response | null {
  const json = antworten(req);
  if (!herkunftErlaubt(req.headers.get("Origin"))) return json({ error: "Diese Adresse darf den Dienst nicht nutzen." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ error: "Nur POST." }, 405);
  const len = Number(req.headers.get("Content-Length") ?? "0");
  if (len > maxBytes) return json({ error: "Die Anfrage ist zu groß." }, 413);
  return null;
}

/** Liest den JSON-Körper mit Größenbegrenzung (auch wenn Content-Length fehlt oder falsch ist). */
export async function koerper(req: Request, maxBytes = 400_000): Promise<any | null> {
  try {
    const t = await req.text();
    if (t.length > maxBytes) return null;
    const b = JSON.parse(t);
    return b && typeof b === "object" ? b : null;
  } catch {
    return null;
  }
}

/** Hinweis, wenn eine lernende Person noch in keinem Kurs ist. */
export const OHNE_KURS = "Die KI-Funktionen sind freigeschaltet, sobald du in einem Kurs bist. Gib dazu im Profil unter „Kurs beitreten“ den Kurscode deiner Lehrkraft ein.";

/**
 * Darf dieses Konto KI-Funktionen nutzen? Lehrkräfte und Administration: ja. Lernende: nur in einem Kurs einer
 * freigeschalteten Schule (Datenbankfunktion fp_ki_erlaubt, nur mit dem Service-Schlüssel aufrufbar).
 * Bei einem Datenbankfehler wird abgelehnt.
 */
export async function kiErlaubt(admin: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string } | null }> }, uid: string): Promise<boolean> {
  const { data, error } = await admin.rpc("fp_ki_erlaubt", { p_user: uid });
  if (error) { console.error("ki_erlaubt", error.code); return false; }
  return data === true;
}

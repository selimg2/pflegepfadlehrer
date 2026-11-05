// Fallpfad: Sprachsimulation im Training "Kommunikation" (Supabase Edge Function "gespraech-sitzung").
//
// Ablauf: Die App fragt hier einen kurzlebigen Schlüssel an (gültig 2 Minuten, nur für eine einzige Sprachsitzung)
// und verbindet sich damit per WebRTC direkt mit der OpenAI Realtime API. Der eigentliche API-Schlüssel bleibt auf dem Server.
//
// Datenschutz:
// - Nur für angemeldete Konten, die vorher in der App eingewilligt haben (die Einwilligung fragt die App ab).
// - Die Rollenanweisung entsteht hier auf dem Server aus der Szenario-Liste. Lernende können keine eigenen Anweisungen schicken.
// - An OpenAI gehen: die Rollenanweisung, die Stimme der lernenden Person während des Gesprächs und die daraus erzeugte Mitschrift.
//   Keine Namen aus dem Konto, keine E-Mail, keine Nutzerkennung.
// - OpenAI nutzt API-Daten nicht zum Training und bewahrt Realtime-Daten höchstens 30 Tage zur Missbrauchsüberwachung auf.
//   Mit EU-Datenresidenz (OPENAI_BASE_URL=https://eu.api.openai.com/v1) erfolgt die Verarbeitung in Europa.
// - Fallpfad speichert weder Ton noch Mitschrift auf dem Server. Gezählt wird nur die Anzahl der Gespräche je Konto und Tag.
import { BASE, CORS, MAX_SEKUNDEN, TAGESLIMIT, anmeldung, clean, json, rollenanweisung, szenario, zaehlen } from "../_shared/komm.ts";

const MODEL = Deno.env.get("OPENAI_MODEL_GESPRAECH") ?? "gpt-realtime-2.1";
const TRANSKRIPTION = Deno.env.get("OPENAI_MODEL_TRANSKRIPTION") ?? "gpt-4o-mini-transcribe";
const STIMMEN = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Nur POST." }, 405);
  const KEY = Deno.env.get("OPENAI_API_KEY");
  if (!KEY) return json({ error: "Die Gesprächssimulation ist an dieser Schule noch nicht eingerichtet." }, 503);

  const a = await anmeldung(req);
  if (a instanceof Response) return a;

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  const s = szenario(b.szenario);
  if (!s) return json({ error: "Dieses Gespräch gibt es nicht." }, 400);
  if (b.einwilligung !== true) return json({ error: "Bitte bestätige zuerst den Hinweis zur Sprachverarbeitung." }, 400);

  // Fortsetzen nach Verbindungsabbruch zählt nicht als neues Gespräch
  const verlauf = Array.isArray(b.verlauf) ? b.verlauf.slice(-14).map((x: any) => ({ r: x?.r === "du" ? "du" : "ki", t: clean(x?.t, 300) })).filter((x: any) => x.t) : [];
  if (!verlauf.length && !(await zaehlen(a.admin, a.uid, "gespraeche", TAGESLIMIT))) {
    return json({ error: `Für heute sind alle ${TAGESLIMIT} Gespräche verbraucht. Morgen geht es weiter.` }, 429);
  }

  const session = {
    type: "realtime",
    model: MODEL,
    instructions: rollenanweisung(s, verlauf),
    output_modalities: ["audio"],
    max_output_tokens: 700,
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: { model: TRANSKRIPTION, language: "de", prompt: "Gespräch auf einer Pflegestation. Begriffe: Schmerzskala, Pflegekraft, Station, Visite, Infusion, Insulin, Rollator." },
        turn_detection: { type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true },
      },
      output: { voice: STIMMEN.includes(s.stimme) ? s.stimme : "marin", speed: Math.min(1.3, Math.max(0.8, Number(s.tempo) || 1)) },
    },
  };

  let r: Response;
  try {
    r = await fetch(BASE + "/realtime/client_secrets", {
      method: "POST",
      headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 120 }, session }),
    });
  } catch {
    return json({ error: "Der Sprachdienst ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal." }, 502);
  }
  if (!r.ok) {
    console.error("OpenAI client_secrets", r.status);
    return json({ error: r.status === 429 ? "Der Sprachdienst ist gerade ausgelastet. Bitte versuche es in einer Minute noch einmal." : "Das Gespräch konnte nicht gestartet werden (" + r.status + ")." }, 502);
  }
  const o = await r.json();
  return json({
    value: o.value,
    expires_at: o.expires_at,
    rtcUrl: BASE + "/realtime/calls",
    maxSekunden: MAX_SEKUNDEN,
    region: BASE.includes("eu.api") ? "EU" : "USA",
  });
});

// Fallpfad: Auswertung eines geübten Gesprächs (Supabase Edge Function "gespraech-auswertung").
//
// Die App schickt die Mitschrift des Gesprächs (Text, keine Tonaufnahme) und einige Messwerte
// (Redeanteil, Sprechtempo, Fragen, Unterbrechungen). Zurück kommt eine strukturierte Rückmeldung.
//
// Datenschutz:
// - Nur für angemeldete Konten. Kontaktdaten werden vor dem Versand aus der Mitschrift entfernt.
// - store=false: OpenAI legt die Anfrage nicht als Konversation ab, nutzt sie nicht zum Training und
//   bewahrt sie höchstens 30 Tage zur Missbrauchsüberwachung auf.
// - Fallpfad speichert die Mitschrift nicht auf dem Server. Gezählt wird nur die Anzahl der Auswertungen je Konto und Tag.
import { BASE, TAGESLIMIT, akteText, anmeldung, clean, szenario, zaehlen } from "../_shared/komm.ts";
import { antworten, vorpruefung } from "../_shared/sicherheit.ts";

const MODEL = Deno.env.get("OPENAI_MODEL_AUSWERTUNG") ?? Deno.env.get("OPENAI_MODEL") ?? "gpt-6.1-terra";
const EFFORT = Deno.env.get("OPENAI_REASONING_AUSWERTUNG") ?? "low"; // "none" = Parameter weglassen

const DIM = {
  type: "object", additionalProperties: false,
  required: ["punkte", "bewertung", "staerken", "verbessern"],
  properties: {
    punkte: { type: "integer" },
    bewertung: { type: "string" },
    staerken: { type: "array", items: { type: "string" } },
    verbessern: { type: "array", items: { type: "string" } },
  },
};
const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["gesamt", "kurzfazit", "dimensionen", "ziele", "momente", "naechsterSchritt"],
  properties: {
    gesamt: { type: "integer" },
    kurzfazit: { type: "string" },
    dimensionen: {
      type: "object", additionalProperties: false,
      required: ["gespraechsfuehrung", "verstaendlichkeit", "empathie", "fachlich"],
      properties: { gespraechsfuehrung: DIM, verstaendlichkeit: DIM, empathie: DIM, fachlich: DIM },
    },
    ziele: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["ziel", "status", "begruendung"],
        properties: { ziel: { type: "string" }, status: { type: "string", enum: ["erreicht", "teilweise", "offen"] }, begruendung: { type: "string" } },
      },
    },
    momente: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["zitat", "art", "kommentar", "besser"],
        properties: { zitat: { type: "string" }, art: { type: "string", enum: ["stark", "verbessern"] }, kommentar: { type: "string" }, besser: { type: "string" } },
      },
    },
    naechsterSchritt: { type: "string" },
  },
};
const SB = {
  type: "object", additionalProperties: false, required: ["status", "hinweis"],
  properties: { status: { type: "string", enum: ["erfuellt", "teilweise", "fehlt"] }, hinweis: { type: "string" } },
};
// Übergaben: zusätzlich eine SBAR-Prüfung
const SCHEMA_UEB = {
  ...SCHEMA,
  required: [...SCHEMA.required, "sbar"],
  properties: {
    ...SCHEMA.properties,
    sbar: {
      type: "object", additionalProperties: false,
      required: ["situation", "background", "assessment", "recommendation", "reihenfolge", "fazit"],
      properties: { situation: SB, background: SB, assessment: SB, recommendation: SB, reihenfolge: { type: "boolean" }, fazit: { type: "string" } },
    },
  },
};

function anweisung(s: any) {
  return `Du bist erfahrene Praxisanleiterin und Pflegepädagogin. Du wertest ein geübtes Gespräch einer bzw. eines Auszubildenden in der Pflege aus.
Das Gegenüber wurde von einer KI gespielt: ${s.person.name}, ${s.person.alter} Jahre, ${s.person.rolle}.
Situation: ${s.situation}
Rolle der lernenden Person: ${s.deineRolle}
Lernziele:
${s.ziele.map((z: string) => "- " + z).join("\n")}
Worauf es fachlich ankommt:
${s.kriterien.map((z: string) => "- " + z).join("\n")}
Was die Gesprächsperson verborgen hielt und nur bei guter Gesprächsführung preisgab:
${s.rolle.verborgen.map((z: string) => "- " + z).join("\n")}
${s.kat === "uebergabe" ? `
Dies ist eine Übergabe. Die lernende Person hat übergeben, die Gesprächsperson hat die Übergabe angenommen und nachgefragt. Die lernende Person hatte dabei diese Patientenakte vor sich:
${akteText(s)}

Für Übergaben gilt bei den vier Bereichen:
  1. gespraechsfuehrung: klare Struktur nach SBAR, Wichtiges zuerst, Priorisierung, sauberer Abschluss mit offenen Aufgaben.
  2. verstaendlichkeit: knapp und präzise, Zahlen mit Einheit und Uhrzeit, keine unklaren Abkürzungen.
  3. empathie: kollegialer, respektvoller Ton, Rückfragen ruhig angenommen, die Würde der übergebenen Person gewahrt (keine abwertenden Bemerkungen).
  4. fachlich: Vollständigkeit und Richtigkeit gegenüber der Akte, Dringlichkeit richtig eingeschätzt, Rückfragen richtig beantwortet. Falsche Werte oder vergessene kritische Punkte wiegen schwer.

Die lernende Person sollte das SBAR-Übergabemodell nutzen. Prüfe im Feld sbar jeden Baustein einzeln mit erfuellt, teilweise oder fehlt und einem kurzen hinweis (ein Satz, was gut war oder was gefehlt hat, möglichst mit Beispiel aus der Akte):
  - situation (S): Wer ist die Person (Name, Alter, Zimmer), warum ist sie da, was ist aktuell das Wichtigste bzw. das Problem.
  - background (B): relevante Vorgeschichte, Diagnosen, bisheriger Verlauf, Allergien, Therapieziel, laufende Therapie und Medikamente.
  - assessment (A): eigene Einschätzung des aktuellen Zustands mit Messwerten (Vitalzeichen, Schmerz, Bewusstsein, Ausscheidung, Wunde), Veränderungen und Risiken.
  - recommendation (R): was als Nächstes zu tun ist, offene Aufgaben mit Uhrzeit, worauf zu achten ist, wann jemand informiert werden muss.
  - reihenfolge: true, wenn die Übergabe erkennbar in der Reihenfolge S, B, A, R aufgebaut war (kleine Abweichungen sind in Ordnung), sonst false.
  - fazit: ein bis zwei Sätze zur Nutzung von SBAR insgesamt. Bei mehreren Patientinnen oder Patienten gilt SBAR für jede Person einzeln.
Wenn SBAR erkennbar nicht genutzt wurde, wirkt sich das deutlich auf gespraechsfuehrung aus.
` : ""}
So bewertest du:
- Bewerte nur die Beiträge der Pflegekraft („du“). Die Beiträge der Gesprächsperson sind Kontext.
- Die Mitschrift stammt aus einer Spracherkennung. Einzelne falsch erkannte Wörter, fehlende Satzzeichen oder Füllwörter gehen nicht in die Bewertung ein.
- Vier Bereiche mit je 0 bis 100 Punkten:
  1. gespraechsfuehrung: Einstieg und Vorstellung, Struktur, offene und gezielte Fragen, aktives Zuhören, Zusammenfassen, Abschluss mit Vereinbarung.
  2. verstaendlichkeit: kurze klare Sätze, Fachwörter erklärt oder vermieden, angepasst an das Gegenüber, Sprechtempo (siehe Messwerte), Verständnis geprüft.
  3. empathie: Gefühle wahrgenommen und benannt, Wertschätzung, Geduld, keine Floskeln oder Beschwichtigungen, Selbstbestimmung respektiert.
  4. fachlich: fachlich richtige Inhalte, Grenzen der eigenen Rolle beachtet (keine Diagnosen, Prognosen oder ärztlichen Entscheidungen), Weitergabe an die richtigen Stellen, Kriterien oben.
- Punkte-Anker: 90 bis 100 sehr gut, sicher und souverän. 75 bis 89 gut mit kleinen Lücken. 60 bis 74 solide Basis mit deutlichen Lücken. 40 bis 59 wichtige Elemente fehlen. Unter 40 kaum umgesetzt. Sei ehrlich und nicht zu großzügig, aber wohlwollend im Ton.
- gesamt ist ein gewichteter Gesamteindruck aus den vier Bereichen (nicht einfach der Durchschnitt, wenn ein Bereich klar überwiegt).
- Ist das Gespräch sehr kurz oder wurde es früh abgebrochen, sag das im kurzfazit und bewerte entsprechend niedrig, weil vieles nicht gezeigt wurde.
- staerken und verbessern: je ein bis drei konkrete Punkte, bezogen auf dieses Gespräch. Leere Liste, wenn es wirklich nichts gibt.
- ziele: Bewerte jedes der Lernziele oben mit erreicht, teilweise oder offen und einer kurzen Begründung.
- momente: drei bis fünf Schlüsselstellen. zitat ist ein wörtliches, kurzes Zitat der Pflegekraft aus der Mitschrift (höchstens 140 Zeichen, nichts erfinden). art ist stark oder verbessern. kommentar erklärt kurz die Wirkung. besser enthält bei verbessern eine konkrete alternative Formulierung in wörtlicher Rede, bei stark einen leeren Text.
- naechsterSchritt: ein konkreter Übungstipp für das nächste Gespräch.
- Sprich die lernende Person mit „du“ an. Deutsch, klar, ohne Fachjargon der Pädagogik, keine Emojis.`;
}

Deno.serve(async (req) => {
  const vor = vorpruefung(req, 200_000);
  if (vor) return vor;
  const json = antworten(req);
  const KEY = Deno.env.get("OPENAI_API_KEY");
  if (!KEY) return json({ error: "Die Auswertung ist an dieser Schule noch nicht eingerichtet." }, 503);

  const a = await anmeldung(req, json);
  if (a instanceof Response) return a;

  let b: any;
  try { b = await req.json(); } catch { return json({ error: "Ungültige Anfrage." }, 400); }
  const s = await szenario(b.szenario, b.def);
  if (!s) return json({ error: "Dieses Gespräch gibt es nicht oder die App ist nicht aktuell. Bitte lade die Seite neu." }, 400);
  const verlauf = (Array.isArray(b.verlauf) ? b.verlauf : []).slice(0, 160)
    .map((x: any) => ({ r: x?.r === "du" ? "du" : "ki", t: clean(x?.t, 800) })).filter((x: any) => x.t);
  if (verlauf.filter((x: any) => x.r === "du").length < 2) return json({ error: "Das Gespräch war zu kurz für eine Auswertung." }, 400);
  if (!(await zaehlen(a.admin, a.uid, "auswertungen", TAGESLIMIT * 2))) {
    return json({ error: "Für heute sind alle Auswertungen verbraucht. Morgen geht es weiter." }, 429);
  }

  const m = b.metriken && typeof b.metriken === "object" ? b.metriken : {};
  const mess = {
    dauerSekunden: Number(m.dauer) || 0,
    redeanteilPflegekraftProzent: Number(m.redeanteil) || 0,
    sprechtempoWoerterProMinute: Number(m.tempo) || 0,
    fragenGesamt: Number(m.fragen) || 0,
    offeneFragen: Number(m.offen) || 0,
    unterbrechungen: Number(m.unterbrechungen) || 0,
  };
  const mitschrift = verlauf.map((x: any) => (x.r === "du" ? "Pflegekraft: " : s.person.name + ": ") + x.t).join("\n");

  const body: Record<string, unknown> = {
    model: MODEL,
    instructions: anweisung(s),
    input: "Messwerte aus der App (Orientierung, nicht überbewerten):\n" + JSON.stringify(mess) + "\n\nMitschrift:\n" + mitschrift,
    text: { format: { type: "json_schema", name: "auswertung", strict: true, schema: s.kat === "uebergabe" ? SCHEMA_UEB : SCHEMA } },
    store: false,
    max_output_tokens: 6000,
  };
  if (EFFORT !== "none") body.reasoning = { effort: EFFORT };

  let r: Response;
  try {
    r = await fetch(BASE + "/responses", { method: "POST", headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return json({ error: "Der Auswertungsdienst ist gerade nicht erreichbar." }, 502);
  }
  if (!r.ok) {
    console.error("OpenAI responses", r.status);
    return json({ error: r.status === 429 ? "Die Auswertung ist gerade ausgelastet. Bitte gleich noch einmal versuchen." : "Die Auswertung hat nicht geklappt (" + r.status + ")." }, 502);
  }
  const o = await r.json();
  let text = "";
  for (const item of o.output || []) if (item.type === "message") for (const c of item.content || []) if (c.type === "output_text") text += c.text;
  let aus: any = null;
  try { aus = JSON.parse(text); } catch { /* leer */ }
  if (!aus || typeof aus.gesamt !== "number") return json({ error: "Die Auswertung war unvollständig. Bitte noch einmal versuchen." }, 502);
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  aus.gesamt = clamp(aus.gesamt);
  for (const k of Object.keys(aus.dimensionen || {})) aus.dimensionen[k].punkte = clamp(aus.dimensionen[k].punkte);
  aus.momente = (aus.momente || []).slice(0, 6);
  return json({ auswertung: aus, region: BASE.includes("eu.api") ? "EU" : "USA" });
});

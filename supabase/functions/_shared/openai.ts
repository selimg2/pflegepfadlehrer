// Fallpfad Backend: robuster Aufruf der OpenAI Responses API mit JSON-Antwort.
//
// Warum: Ein Fehler 400 entsteht, wenn ein Modell einen Parameter nicht unterstützt (z. B. "reasoning" oder
// strukturierte Ausgabe) oder wenn beim JSON-Modus das Wort "JSON" in der Eingabe fehlt. Statt dann aufzugeben,
// probiert kiJson() nacheinander einfachere Fassungen derselben Anfrage:
//   1. strukturierte Ausgabe (JSON-Schema) mit Reasoning
//   2. strukturierte Ausgabe ohne Reasoning
//   3. JSON-Modus (json_object) mit Reasoning, dann ohne
//   4. freie Antwort, aus der das JSON-Objekt herausgelesen wird
//   5. zuletzt das Ausweichmodell (Secret OPENAI_MODEL_FALLBACK, Standard gpt-4.1-mini)
// Fehler 400 werden nicht abgerechnet. Ins Log gehen nur Statuscode, Fehlercode und Parametername, keine Inhalte.

export type KiAnfrage = {
  key: string;
  base: string;
  model: string;
  effort: string; // "none" = Parameter weglassen
  instructions: string;
  input: string;
  schema?: Record<string, unknown>;
  name?: string;
  maxTokens?: number;
};
export type KiErgebnis =
  | { ok: true; daten: any; modell: string }
  | { ok: false; status: number; code: string };

type Variante = { format: "schema" | "objekt" | "frei"; effort: string; model?: string };

const FALLBACK = (Deno.env.get("OPENAI_MODEL_FALLBACK") ?? "gpt-4.1-mini").trim();

function varianten(a: KiAnfrage): Variante[] {
  const v: Variante[] = [];
  if (a.schema) {
    v.push({ format: "schema", effort: a.effort });
    if (a.effort !== "none") v.push({ format: "schema", effort: "none" });
  }
  v.push({ format: "objekt", effort: a.schema ? "none" : a.effort });
  if (!a.schema && a.effort !== "none") v.push({ format: "objekt", effort: "none" });
  v.push({ format: "frei", effort: "none" });
  if (FALLBACK && FALLBACK !== a.model) v.push({ format: a.schema ? "schema" : "objekt", effort: "none", model: FALLBACK });
  return v;
}

/** Liest das erste vollständige JSON-Objekt aus einem Text (auch wenn es in ```json … ``` steht). */
export function jsonAusText(t: string): any | null {
  if (!t) return null;
  try { const o = JSON.parse(t); return o && typeof o === "object" ? o : null; } catch { /* weiter */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { const o = JSON.parse(t.slice(a, b + 1)); return o && typeof o === "object" ? o : null; } catch { return null; }
}

function ausgabeText(o: any): string {
  if (typeof o?.output_text === "string" && o.output_text) return o.output_text;
  let text = "";
  for (const item of o?.output || []) if (item.type === "message") for (const c of item.content || []) if (c.type === "output_text") text += c.text;
  return text;
}

export async function kiJson(a: KiAnfrage): Promise<KiErgebnis> {
  const liste = varianten(a);
  let letzter: { status: number; code: string } = { status: 502, code: "" };
  for (let i = 0; i < liste.length; i++) {
    const v = liste[i];
    const model = v.model || a.model;
    const body: Record<string, unknown> = {
      model,
      instructions: a.instructions + (v.format === "schema" ? "" : "\n\nAntworte ausschließlich mit einem gültigen JSON-Objekt, ohne weiteren Text."),
      input: (v.format === "schema" ? "" : "Antworte im JSON-Format.\n\n") + a.input,
      store: false,
      max_output_tokens: a.maxTokens ?? 8000,
    };
    if (v.format === "schema") body.text = { format: { type: "json_schema", name: a.name || "antwort", strict: true, schema: a.schema } };
    else if (v.format === "objekt") body.text = { format: { type: "json_object" } };
    if (v.effort !== "none") body.reasoning = { effort: v.effort };

    let r: Response;
    try {
      r = await fetch(a.base + "/responses", { method: "POST", headers: { Authorization: "Bearer " + a.key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      return { ok: false, status: 503, code: "netz" };
    }
    if (!r.ok) {
      let code = "", param = "";
      try { const x = await r.json(); code = String(x?.error?.code || x?.error?.type || "").slice(0, 60); param = String(x?.error?.param || "").slice(0, 60); } catch { /* leer */ }
      console.error("OpenAI", r.status, code, param, "variante", i, model);
      letzter = { status: r.status, code };
      // Modell unbekannt oder nicht freigeschaltet: direkt zum Ausweichmodell springen
      if (r.status === 404 || code === "model_not_found") {
        const j = liste.findIndex((x, k) => k > i && x.model);
        if (j > 0) { i = j - 1; continue; }
        return { ok: false, ...letzter };
      }
      if (r.status === 400 || r.status === 422) continue;
      return { ok: false, ...letzter };
    }
    const o = await r.json();
    const daten = jsonAusText(ausgabeText(o));
    if (daten) return { ok: true, daten, modell: String(o?.model || model) };
    console.error("OpenAI ohne JSON", o?.status || "", o?.incomplete_details?.reason || "", "variante", i);
    letzter = { status: 502, code: o?.status === "incomplete" ? "unvollstaendig" : "json" };
  }
  return { ok: false, ...letzter };
}

/** Verständliche Fehlermeldung für die Apps. */
export function kiFehlertext(e: { status: number; code: string }, was = "Der Assistent"): string {
  if (e.status === 429) return was + " ist gerade ausgelastet. Bitte in einer Minute noch einmal versuchen.";
  if (e.status === 401) return was + " ist nicht richtig eingerichtet (API-Schlüssel ungültig).";
  if (e.status === 403 || e.status === 404) return "Das KI-Modell ist für diese Schule nicht freigeschaltet (" + (e.code || e.status) + ").";
  if (e.status === 503) return was + " ist gerade nicht erreichbar.";
  if (e.code === "unvollstaendig" || e.code === "json") return "Die Antwort war unvollständig. Bitte noch einmal senden.";
  return was + " hat gerade nicht geantwortet (" + e.status + (e.code ? ", " + e.code : "") + ").";
}

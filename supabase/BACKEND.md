# Fallpfad Backend

Das Backend läuft vollständig auf Supabase (Region EU): Postgres mit Row Level Security, Anmeldung über Supabase Auth
und Edge Functions für alles, was einen geheimen Schlüssel braucht. In den Apps steckt nur der öffentliche Schlüssel.

## Aufbau

| Ordner / Datei | Aufgabe |
|---|---|
| `*.sql` | Tabellen, Zugriffsregeln (RLS) und Datenbankfunktionen. Reihenfolge siehe LIESMICH der Schüler-App |
| `sicherheit_haertung.sql` | Schritt 13: Härtung, Einwilligungsprotokoll, Datenauskunft |
| `datenschutz_aufraeumen.sql` | automatische Löschfristen (pg_cron, jede Nacht) |
| `functions/_shared/sicherheit.ts` | CORS nur für die eigenen Apps, Sicherheits-Header, Größenbegrenzung. Von allen Funktionen genutzt |
| `functions/_shared/komm.ts` | Anmeldung prüfen, Tageslimits, Rollenanweisung der KI-Gesprächsperson |
| `functions/_shared/komm-szenarien.ts` | Prüfsummen der erlaubten Gespräche (keine eigenen Anweisungen einschleusbar) |
| `functions/gespraech-sitzung` | kurzlebiger Schlüssel für ein Sprachgespräch, protokolliert die Einwilligung |
| `functions/gespraech-auswertung` | Auswertung der Mitschrift |
| `functions/uebersetzen` | „Meine Sprache“ |
| `functions/folien-import` | Folien-Import für Lehrkräfte |
| `functions/konto-loeschen` | Konto löschen (Art. 17 DSGVO) |
| `config.toml` | Einstellungen für die Supabase-CLI |

## Sicherheitsprinzipien

1. **Kein Geheimnis im Browser.** OpenAI-Schlüssel und `service_role` liegen nur als Secrets in Supabase.
2. **Jede Zeile ist geschützt.** Auf allen Tabellen ist RLS aktiv. Tabellen ohne Regel sind nur für den Server lesbar.
3. **Jede Funktion prüft selbst:** erlaubte Herkunft (CORS), Anmelde-Token, Rolle, Größe der Anfrage, Tageslimit.
4. **Datensparsamkeit.** An OpenAI gehen keine Namen, E-Mail-Adressen oder Kennungen. Ton und Mitschrift werden nicht gespeichert. Logs enthalten nur Statuscodes.
5. **Betroffenenrechte eingebaut.** Auskunft (`fp_meine_daten`), Löschung (`konto-loeschen`), Widerruf (`fp_einwilligung_widerrufen`), Löschfristen (`fp_datenschutz_aufraeumen`).

## Secrets (Supabase > Edge Functions > Secrets)

| Name | Pflicht | Bedeutung |
|---|---|---|
| `OPENAI_API_KEY` | ja | Schlüssel für die KI-Funktionen |
| `OPENAI_BASE_URL` | empfohlen | `https://eu.api.openai.com/v1` für Verarbeitung in der EU |
| `FALLPFAD_ORIGINS` | bei eigener Domain | weitere erlaubte Adressen, mit Komma getrennt, z. B. `https://app.meineschule.de` |
| `FALLPFAD_GESPRAECHE_TAG`, `FALLPFAD_LS_ZEICHEN_TAG`, `FALLPFAD_LIMIT_TAG` | nein | Tageslimits |

Ohne `FALLPFAD_ORIGINS` sind erlaubt: `pflegepfad.vercel.app`, `pflegepfadlehrer.vercel.app`, die native App und `localhost`.

## Bereitstellen

```bash
supabase link --project-ref <projekt-ref>
supabase functions deploy
```

Danach `sicherheit_haertung.sql` im SQL-Editor ausführen und im Dashboard unter Authentication den Schutz vor
geleakten Passwörtern einschalten.

# Fallpfad – Audit-Bericht (Sicherheit, Datenschutz, Qualität)

**Stand:** 10.11.2026 · **Umfang:** Schüler-App `selimg2/pflegepfad`, Lehrer-Portal `selimg2/pflegepfadlehrer`, Supabase-Projekt `sngnzhazulypdvdkhwja` (Region eu-central-2), Edge Functions, Hosting-Konfiguration (Vercel/Netlify)
**Git-Checkpoint vor allen Änderungen:** Tag `audit-checkpoint-2026-11-10` in beiden Repositories

> **Wichtiger Hinweis:** Dieser Bericht ist keine Rechtsberatung und keine Zertifizierung. Er bescheinigt weder, dass die App „sicher“ noch dass sie „DSGVO-konform“ ist. Jede Aussage beruht auf den unten genannten Prüfungen. Für rechtliche Bewertung, Verträge und Freigabe für den Echtbetrieb sind die Verantwortlichen (Schulträger/Schule, Datenschutzbeauftragte Person) zuständig.

**Kennzeichnung in diesem Bericht**

| Zeichen | Bedeutung |
|---|---|
| ✅ | Erfolgreich getestet (automatisierter oder manueller Test mit Ergebnis) |
| 🔍 | Durch Codeprüfung plausibilisiert (gelesen und nachvollzogen, nicht ausgeführt) |
| ⬜ | Nicht getestet (mit Grund) |
| ⏳ | Noch offen (Handlung nötig) |

**Rahmenbedingungen der Prüfung**
- Es wurden ausschließlich die Demo-Konten mit synthetischen Daten genutzt. Keine echten Patienten-, Pflege- oder Gesundheitsdaten wurden verarbeitet, fotografiert oder an Dienste gesendet.
- Während des Audits wurde die Datenbank nur lesend abgefragt (Zugriffstests in zurückgerollten Transaktionen). **Nachtrag 10.11.2026, 20:15 Uhr:** Nach ausdrücklicher Freigabe wurden die Migrationen `pflegeplanung_sicherheit`, `audit_mandantentrennung` und `audit_nachtrag_rechte` auf der Produktivdatenbank ausgeführt. Edge Functions wurden nicht neu bereitgestellt.
- Die Testumgebung kann `*.supabase.co` nicht erreichen. Live-Tests gegen die API (Anmeldung, KI-Funktionen) waren deshalb nicht möglich; die Oberflächen wurden mit blockierten Netzwerkaufrufen im Demo-Modus getestet.
- Keine Penetrationstests gegen Produktivsysteme.

---

## 1. Zusammenfassung

| Bereich | Ergebnis |
|---|---|
| Fortschrittskreise | Ursache gefunden (Geometrie des großen Rings, starre Breite der Checkpoint-Leiste) und behoben. Automatischer Test: vorher 14 fehlerhafte Prüfungen, nachher 0 bei 840 Ringen in 7 Bildschirmgrößen/Zoomstufen und 5 Füllständen. ✅ |
| Sicherheit | **1 hoher Befund** (Mandantentrennung bei Kursen: neues Konto sah Kurse und Kurscodes aller Schulen und konnte ohne Code beitreten), 5 mittlere, mehrere niedrige. Der hohe Befund ist **behoben und auf der Produktivdatenbank nachgeprüft**; anonym aufrufbare Datenbankfunktionen von 33 auf 15 reduziert, die bewusst öffentlich sind. |
| Datenschutz | Gute technische Grundlage (EU-Region, RLS auf allen Tabellen, Datensparsamkeit bei KI, Löschfunktion, Datenauskunft, Einwilligungen). Offen sind vor allem organisatorische und rechtliche Punkte: Impressum/Datenschutzerklärung enthalten Platzhalter, AV-Verträge, VVT, DSFA-Entscheidung, Drittlandtransfer zu OpenAI. |
| Funktionen | Beide Apps im Demo-Modus in 3 Bildschirmgrößen × hell/dunkel durchgeklickt (9 bzw. 13 Bereiche): keine JavaScript-Fehler, keine Überbreite. Stationsalltag-Engine: 300 Varianten je Station ohne Fehler. ✅ |
| Barrierefreiheit | Basisprüfung: alle Bedienelemente haben Namen, alle Bilder alt-Text, alle Felder Beschriftung, `lang="de"`. Zu kleine Tippflächen (23 px) korrigiert. Kein vollständiger WCAG-Test. |

**Bereitschaft:** Bereit für einen **begleiteten Testbetrieb mit einer Testschule**. **Nicht** bereit für den Produktivstart mit echten Lernenden, bevor die offenen Punkte in Abschnitt 10 (Auth-Einstellungen, rechtliche Unterlagen, Live-Test) erledigt sind.

---

## 2. Sicherheitsbefunde

Bewertung angelehnt an OWASP ASVS 5.0.0 (Kapitel in Klammern) und eine einfache Skala Kritisch/Hoch/Mittel/Niedrig/Info.

| ID | Schwere | Befund | Nachweis | Status |
|---|---|---|---|---|
| **S-01** | **Hoch** | **Mandantentrennung Kurse (ASVS V8 Autorisierung).** Policy `courses_select` erlaubt allen angemeldeten Konten das Lesen aller Kurse (`using (true)`). Die einschränkende Schul-Policy lässt Konten ohne Schule durch (`my_school() IS NULL`). Ein frisch registriertes Konto (Selbstregistrierung ist in der App möglich) sieht dadurch **alle Kurse aller Schulen inkl. Kurscode**. Zusätzlich darf ein Schülerkonto `profiles.course_id` direkt auf jede Kurs-ID setzen; die Schule wird übernommen. Folge: Beitritt zu fremden Kursen/Schulen ohne Code, Zugriff auf deren Kursnachrichten, Aufgaben, Stundenplan, Gruppenfälle. Daten anderer Lernender bleiben durch die übrigen Policies geschützt. | ✅ Live-Datenbank, simuliertes neues Konto, nur SELECT, zurückgerollt: 1 von 1 Kurs inkl. Code sichtbar. ✅ Lokales Postgres-Modell: Angriff vorher erfolgreich, nach Korrektur blockiert. | ✅ **Behoben** (Migration am 10.11.2026). Nachprüfung live in zurückgerollter Transaktion: neues Konto sieht 0 Kurse; Lernende sehen nur den eigenen Kurs; falscher Code 0 Treffer, richtiger Code 1 Treffer; Profil speichern ohne Kurswechsel funktioniert; Kurswechsel ohne Code wird blockiert. |
| S-02 | Mittel | **33 SECURITY-DEFINER-Funktionen ohne Anmeldung aufrufbar** (Supabase-Advisor). Die meisten prüfen intern `auth.uid()` oder eine Rolle; ohne Prüfung und ohne Anmeldung aufrufbar sind u. a. `course_settings`, `course_timetable` (Stundenplan inkl. Lehrkraftnamen/Räume bei bekannter Kurs-UUID), `team_create`/`team_patch`. | ✅ Advisor + Funktionsquelltexte gelesen | ✅ **Behoben**: Advisor meldet nur noch 15 anonym aufrufbare Funktionen, alle bewusst öffentlich (Live-Unterricht, Unterschrift per Einmal-Link, Praxisanleitungs-Gerät, Gruppencode, RLS-Hilfsfunktionen ohne Datenausgabe). Wartungs- und Triggerfunktionen sind nicht mehr per API aufrufbar. |
| S-03 | Mittel | **Gruppenräume (Team-Krankenhaus) ohne Anmeldung und ohne Mengenbegrenzung**: anlegen, beitreten, bearbeiten nur mit 6-stelligem Code (32 Zeichen, ≈ 10⁹ Kombinationen), kein Rate-Limit. Missbrauch: Spam-Räume, Durchprobieren von Codes. Inhalte sind Lernnotizen der Gruppe. | 🔍 Funktionsquelltext | Teilweise: `team_create` nur noch angemeldet ✅. ⏳ Rate-Limit, längere Codes. |
| S-04 | Mittel | **Tageslimit der Sprachsimulation umgehbar**: `gespraech-sitzung` zählt kein Gespräch, wenn die Anfrage einen Verlauf enthält („Fortsetzen“). Ein manipulierter Client erhält damit unbegrenzt Realtime-Sitzungen (Kostenrisiko). | 🔍 Code `functions/gespraech-sitzung/index.ts` | ⏳ Vorschlag: Fortsetzungen separat zählen (eigene Spalte, höheres Limit) – Schemaänderung, daher nur dokumentiert. |
| S-05 | Mittel | **Zähler für Limits nicht atomar** (`uebersetzen`, `_shared/komm.ts`): Lesen und Schreiben getrennt, parallele Anfragen können das Limit überschreiten. | 🔍 Code | ⏳ Vorschlag: atomare Zähl-Funktion wie `fp_pp_zaehlen` (im Entwurf für die Pflegeplanung bereits so umgesetzt). |
| S-06 | Mittel | **Schutz vor kompromittierten Passwörtern deaktiviert**; Mindestlänge in der App war 6 Zeichen (ASVS 5.0.0 V6.2.1 verlangt mindestens 8). | ✅ Advisor; 🔍 Code | Teilweise behoben: App verlangt bei Registrierung jetzt 8 Zeichen. ⏳ In Supabase Auth: Mindestlänge 8+ und „Leaked password protection“ einschalten (Dashboard, nicht per Code möglich). |
| S-07 | Niedrig | **Lehrkräfte sehen alle Lernenden ihrer Schule**, nicht nur ihre Kurse (Policies `is_teacher()` + Schulgrenze). Fachlich evtl. gewollt, datenschutzrechtlich Frage der Erforderlichkeit (Art. 5 Abs. 1 lit. c DSGVO). | ✅ Policies gelesen | ⏳ Entscheidung der Schule; ggf. Kurszuordnung Lehrkraft↔Kurs als Erweiterung. |
| S-08 | Niedrig | **Modulinhalte (HTML) werden ohne Bereinigung angezeigt** (`dangerouslySetInnerHTML`). Lehrkräfte können HTML in Module schreiben bzw. per KI-Import erzeugen. Gemildert durch CSP `script-src 'self'` (keine Inline-Skripte, kein `eval`). | 🔍 Code + CSP gelesen | ⏳ Vorschlag: HTML beim Speichern serverseitig auf erlaubte Tags filtern. |
| S-09 | Niedrig | **pdf.js 3.11.174** im Lehrer-Portal (Folien-Import) ist von CVE-2024-4367 betroffen (Skriptausführung über präparierte PDF). Die CSP ohne `unsafe-eval` blockiert den bekannten Angriffsweg; geöffnet werden nur eigene Dateien der Lehrkraft. | 🔍 Version + CSP | ⏳ Vorschlag: auf pdf.js ≥ 4.2.67 aktualisieren oder `isEvalSupported:false` setzen. |
| S-10 | Niedrig | **SheetJS 0.18.5** (bekannte CVEs beim *Lesen* von Dateien). Die Apps nutzen nur den Export, kein Einlesen. | 🔍 Code | Kein akuter Handlungsbedarf; bei Gelegenheit aktualisieren. |
| S-11 | Info | Tabellen haben Standard-Schreibrechte für `anon`; geschützt ist alles durch RLS (auf allen Tabellen aktiv). | ✅ Abfrage | Vorschlag: Rechte für `anon` zusätzlich entziehen (Defense in Depth). |
| S-12 | Info | `fp_assistent_nutzung` hat RLS ohne Policy (= kein Zugriff, unkritisch). | ✅ Advisor | ✅ Explizite Sperr-Policy angelegt; Advisor-Hinweis verschwunden. |

**Positiv geprüft**

| Prüfpunkt | Ergebnis |
|---|---|
| RLS | Auf allen öffentlichen Tabellen aktiv; Schulgrenze als RESTRICTIVE-Policy auf allen Mandantentabellen. ✅ |
| Rollen-Eskalation | Trigger `protect_role` verhindert, dass Konten ihre Rolle selbst ändern; Lehrkraftrolle nur über Einladungscode. ✅ (Quelltext) |
| Geheimnisse | Kein `service_role`-Schlüssel, kein OpenAI-Schlüssel im Client oder in der Git-Historie (Suche nach typischen Mustern; Treffer waren nur URLs). ✅ |
| Edge Functions | Alle prüfen das Anmelde-Token bzw. die Lehrkraftrolle, CORS-Allowlist, Größenlimits, `Cache-Control: no-store`, keine Inhalte in Logs. 🔍 |
| Unterschrifts-Token | 256 Bit Zufall, Ablaufzeit, nur eigene Einträge. 🔍 |
| HTTP-Header | CSP ohne `unsafe-inline`/`unsafe-eval` für Skripte, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, Permissions-Policy, COOP. ✅ (Konfiguration gelesen) |
| Eigene Text-Ausgaben | KI-Übersetzung, QR-Scanner und Profilmenü maskieren Text vor dem Einfügen. 🔍 |

---

## 3. Datenschutzrisiken

Rechtsgrundlagen und Pflichten werden hier nur als Prüfpunkte genannt. Welche Rechtsgrundlage gilt (z. B. Landesschulgesetz, Art. 6 Abs. 1 lit. e DSGVO oder Einwilligung), muss die Schule bzw. der Träger festlegen.

**Dateninventar (aus Datenbankschema ermittelt, ✅)**

| Kategorie | Tabellen / Funktionen | Besonderheit |
|---|---|---|
| Konto | `profiles` (E-Mail, Anzeigename, Rolle, Kurs, Ausbildungsjahr, Schule) | – |
| Lernstand | `progress`, `exam_results`, `submissions` (Antworten, Bewertung, Feedback) | Leistungsdaten |
| Ausbildungsnachweis | `nw_eintrag`, `nw_signatur` (Unterschrift als Strichdaten), `nw_pa` (Praxisanleitende: Name, Einrichtung, E-Mail), `nw_pa_device` (Gerätekennung als Hash, Browserkennung), `nw_log` | Daten Dritter (Praxisanleitende), revisionsrelevant |
| Kommunikation | `messages`, `fp_meldung` (Nachricht an Lehrkraft, auch zu Gewalt/Belästigung im Einsatz), `fp_einsatz_feedback`, `fp_puls` (Stimmung/Zufriedenheit) | Kann sensible Inhalte enthalten, Freitext |
| KI-Nutzung | `fp_ls_nutzung`, `fp_gespraech_nutzung`, `fp_assistent_nutzung` (nur Zähler), `fp_uebersetzungen` (Cache ohne Personenbezug) | – |
| Einwilligungen | `fp_einwilligungen` | Nachweis Art. 7 Abs. 1 |

**Gesundheitsdaten (Art. 9):** Die App ist so gebaut, dass keine Patientendaten nötig sind (Fälle sind fiktiv; Hinweis „Keine Patientennamen…“ an Freitextfeldern). Freitextfelder (Nachweis, Meldungen, Abgaben, KI-Assistent) können aber trotzdem echte Patienteninformationen oder Gesundheitsdaten der Lernenden enthalten. 🔍

| ID | Risiko | Bezug | Status |
|---|---|---|---|
| D-01 | **Impressum und Datenschutzerklärung enthalten Platzhalter** (`[Name bzw. Firma]`, `[Datum einsetzen]`, `[Hosting-Anbieter]` …). Ohne vollständige Angaben sind die Informationspflichten nicht erfüllt. | Art. 13/14 DSGVO, § 5 DDG | ⏳ Verantwortliche müssen Angaben eintragen. Nichts davon wurde erfunden. |
| D-02 | **Drittlandübermittlung an OpenAI (USA)** für Übersetzung, Assistent, Folien-Import, Pflegeplanung und Sprachsimulation. Grundlage laut Code-Kommentar: OpenAI-DPA mit Standardvertragsklauseln; das EU-US Data Privacy Framework wurde vom EuG im September 2025 bestätigt, ein Rechtsmittel beim EuGH ist anhängig. OpenAI bietet EU-Datenresidenz für berechtigte Kunden an; die App unterstützt sie per `OPENAI_BASE_URL`. | Art. 44 ff. DSGVO | ⏳ Prüfen: Ist der DPA abgeschlossen? EU-Datenresidenz verfügbar und aktiviert? Transfer-Folgenabschätzung dokumentiert? |
| D-03 | **Auftragsverarbeitung** mit Supabase (Hosting/DB), Vercel/Netlify (Hosting), OpenAI (KI). Verhältnis Schule ↔ Betreiber der App ungeklärt (wer ist Verantwortlicher, wer Auftragsverarbeiter?). | Art. 28 DSGVO | ⏳ Verträge prüfen/abschließen; Unterauftragsverarbeiter-Listen ablegen. |
| D-04 | **DSFA-Entscheidung fehlt.** Kriterien aus den DSFA-Muss-Listen der Aufsichtsbehörden können berührt sein (z. B. Daten schutzbedürftiger Personen/Auszubildender, Bewertung von Leistung, Einsatz neuer Technologien/KI). | Art. 35 DSGVO, DSK/Länder-Muss-Listen | ⏳ Schwellwertanalyse durch die Schule/DSB; Vorlage siehe Abschnitt 8. |
| D-05 | **Löschfristen** sind für Zähler, Live-Sitzungen, abgelaufene Nachrichten, Gruppenräume umgesetzt (`fp_datenschutz_aufraeumen`). pg_cron ist **seit 10.11.2026 aktiv** mit 7 nächtlichen Löschjobs (03:17–03:41 Uhr). Für Meldungen, Abgaben, Puls, Feedback, Nachweis ist weiterhin keine Frist hinterlegt. | Art. 5 Abs. 1 lit. e, Art. 17 | Teilweise ✅. ⏳ Erster Lauf in `cron.job_run_details` kontrollieren. Fristen für übrige Daten festlegen (z. B. Aufbewahrungspflichten für Ausbildungsnachweise nach PflAPrV/Landesrecht klären). |
| D-06 | **Lehrkräfte sehen alle Lernenden der Schule** (siehe S-07). | Art. 5 Abs. 1 lit. c, Art. 25 | ⏳ Entscheidung der Schule. |
| D-07 | **Meldungen an Lehrkräfte** können besonders sensible Inhalte enthalten (Gewalt, Belästigung). Zugriff: Lernende selbst und adressierte bzw. alle Lehrkräfte der Schule. | Art. 9, Art. 32 | ⏳ Zugriffskreis und Frist festlegen. |
| D-08 | **Mindestalter / Minderjährige**: Auszubildende können unter 18 sein. Einwilligungen (Sprachsimulation) setzen Einwilligungsfähigkeit voraus. | Art. 8 DSGVO (für Online-Dienste), Landesrecht | ⏳ Prüfen durch Schule/DSB. |

**Positiv vorhanden** 🔍/✅
- Betroffenenrechte: Datenauskunft/Export in der App (`js/funktionen/05-datenauskunft.js`, Art. 15/20), Konto selbst löschen (Edge Function `konto-loeschen`, Art. 17), Einwilligung widerrufbar (`fp_einwilligung_widerrufen`, Art. 7 Abs. 3).
- Privacy by Design (Art. 25): KI-Anfragen ohne Namen/E-Mail/Nutzerkennung, Kontaktdaten werden vor dem Versand herausgefiltert, `store:false`, kein Tracking, keine Analyse-Dienste, keine externen Schriften.
- Datenbank in der EU (Supabase eu-central-2, Zürich). Hinweis: Die Schweiz hat einen Angemessenheitsbeschluss der EU-Kommission.
- Sicherheit der Verarbeitung (Art. 32): siehe Abschnitt 2.

---

## 4. Durchgeführte Korrekturen

| Datei | Änderung | Repo |
|---|---|---|
| `js/app/01-app.bundle.js` | Großer Fortschrittsring: Radius 19 statt 20 bei Strichstärke 9, damit der Strich in die Zeichenfläche passt | pflegepfad |
| `css/07-politur.css` | Ring-SVG `overflow: visible`; Checkpoint-Leiste mit Container-Queries (8/6/5/4/3 sichtbare Punkte je nach Breite), Scroll-Snap, umbrechende Beschriftung; Mindesthöhe 24 px für `.skip`-Schaltflächen | pflegepfad |
| `js/funktionen/03-medals.js` | Checkpoint-Leiste zentriert beim Öffnen den aktuellen Checkpoint | pflegepfad |
| `js/app/01-app.bundle.js` | Kurssuche per Code über neue Funktion `fp_kurs_per_code` (mit Rückfall auf bisherigen Weg, solange die Funktion fehlt) | pflegepfad |
| `js/app/01-app.bundle.js` | Passwort bei Registrierung mindestens 8 Zeichen (Anmeldung bestehender Konten unverändert) | pflegepfad |
| `sw.js` | Cache-Version `fallpfad-v41`, damit Nutzer die Korrekturen erhalten | pflegepfad |
| `supabase/audit_mandantentrennung.sql` | **Ausgeführt am 10.11.2026**: Korrektur S-01 (Policies, Beitrittsticket, Fehlversuchsbegrenzung 20/Tag, Trigger gegen Kurswechsel ohne Code, `course_settings` nur angemeldet) | beide |
| `werkzeuge/tests/*` | Neue automatisierte Tests (siehe Abschnitt 6) | beide |

---

## 5. Fortschrittskreise: Ursache, Lösung, Nachweis

**Ursachen** (✅ gemessen)
1. **Großer Ring (Fortschritt, „Gesamter Fallpfad“):** Kreis `r = 20` mit Strichstärke `9` in einer `viewBox` von 48 × 48. Außenkante = 24 + 20 + 4,5 = 48,5 > 48. Da SVG-Inhalte standardmäßig an der viewBox abgeschnitten werden, fehlten auf allen Geräten 0,5 Einheiten (bei 132 px Ringgröße ≈ 1,4 px) links, rechts, oben und unten.
2. **Checkpoint-Leiste:** 8 Checkpoints mit fester Mindestbreite (`flex: 1 0 76px`) in einem waagerecht scrollbaren Bereich. Auf Handys (320–430 px) passten nur 3–4 Punkte; der Rand schnitt den nächsten Kreis halb ab, Beschriftungen wurden abgeschnitten.

**Lösung:** Radius an Strichstärke angepasst plus `overflow: visible` als Sicherheitsnetz. Checkpoint-Breite abhängig von der Containerbreite (Container-Queries), sodass immer ganze Kreise sichtbar sind; Scroll-Snap rastet auf ganze Punkte ein; der aktuelle Checkpoint wird beim Öffnen in die Mitte gescrollt.

**Nachweis** ✅
- Vorher/Nachher-Bild: `werkzeuge/tests/nachweis/fortschrittskreise-vorher-nachher.png` (320 px und 390 px, großer Ring und Checkpoints).
- Automatischer Test `werkzeuge/tests/ringe-test.mjs` mit Messskript `ringe-messen.js`. Er prüft jede Ring-Grafik auf: Strich innerhalb der viewBox, Abschneiden durch Elternelemente, quadratische Form, teilweise sichtbare Checkpoints.
- Bildschirmgrößen: 320 × 640, 390 × 844, 430 × 932, Tablet 820 × 1180, Desktop 1440 × 900, Zoom 200 % (entspricht 720 × 450 bei Faktor 2), Zoom 67 % (2150 × 1340).
- Füllstände: 0 %, 1 %, 37 %, 99 %, 100 %.

| Lauf | Fehlerhafte Prüfungen | Gemessene Ringe |
|---|---|---|
| Vorher | 14 | 868 |
| Nachher | 0 | 840 (Startseite) bzw. 1750 (3 Seiten × 5 Füllstände) |

Im Lehrer-Portal gibt es keine Fortschrittskreise (0 gefunden).

---

## 6. Tests und Ergebnisse

| Test | Aufruf | Ergebnis |
|---|---|---|
| Fortschrittskreise | `NODE_PATH=… WERTE=1 node werkzeuge/tests/ringe-test.mjs . nachher` | ✅ 0 Probleme |
| Rauchtest Schüler-App | `NODE_PATH=… node werkzeuge/tests/rauchtest.mjs .` | ✅ 9 Bereiche × 3 Größen × hell/dunkel, 0 JS-Fehler, keine Überbreite |
| Rauchtest Lehrer-Portal | `NODE_PATH=… node werkzeuge/tests/rauchtest.mjs .` (im Lehrer-Repo) | ✅ 13 Bereiche × 3 Größen × hell/dunkel, 0 Probleme |
| Konsolenfehler beim Start | `node werkzeuge/pruefen.mjs . [--mobil] [--dunkel]` | ✅ nur blockierte Supabase-Aufrufe der Testumgebung |
| Stationsalltag-Engine | `node werkzeuge/tests/stationsalltag-test.js` | ✅ 300 Varianten je Station, 0 Probleme |
| Barrierefreiheit (Basis) | `werkzeuge/tests/a11y-basis.js` im Browser | ✅ keine Elemente ohne Namen/alt/Label; 23-px-Schaltflächen korrigiert |
| RLS-Mandantentrennung (Modell) | lokales PostgreSQL 16 mit nachgebautem Ausschnitt des Schemas | ✅ vorher Angriff möglich; nachher: 0 fremde Kurse sichtbar, Beitritt ohne Code blockiert, Beitritt mit Code funktioniert, Kurs verlassen funktioniert, Lehrkraft sieht Kurse ihrer Schule, Tickets für Clients unlesbar |
| RLS live (nur lesend) | simuliertes Konto, Transaktion zurückgerollt | ✅ Befund S-01 bestätigt |
| JavaScript-Syntax nach Bundle-Änderungen | `new Function(...)` | ✅ |
| Pflegeplanung mit KI-Feedback | – | ⬜ KI-Antwort live nicht prüfbar (kein Zugang zu Supabase aus der Testumgebung); Oberfläche im Demo-Modus geprüft |
| Anmeldung, Registrierung, Passwort-Reset live | – | ⬜ nicht möglich (siehe oben) |
| Kurssuche über `fp_kurs_per_code` live | SQL als echtes Schülerkonto, zurückgerollt | ✅ Funktion arbeitet; Aufruf aus der App selbst ⬜ (kein Netz zu Supabase aus der Testumgebung) |
| Screenreader (VoiceOver/TalkBack), Kontraste | – | ⬜ nicht durchgeführt |
| Lasttest | – | ⬜ nicht durchgeführt (keine Tests gegen Produktion ohne Freigabe) |

---

## 7. Offene Risiken

1. Die Kurssuche der Schüler-App mit der neuen Funktion wurde noch nicht mit einem echten Konto in der App ausprobiert. Bitte einmal einen Kursbeitritt per Code testen (siehe Abschnitt 10).
2. Kostenrisiko durch umgehbare Limits (S-04, S-05).
3. Löschfristen für Meldungen, Abgaben, Puls, Feedback und Nachweis fehlen.
4. Rechtliche Unterlagen unvollständig (D-01 bis D-04, D-08).
5. Keine Live-Tests der Anmeldung und KI-Funktionen aus dieser Umgebung.
6. Freitextfelder können trotz Hinweis echte Patientendaten enthalten.
7. Kein Passwort-Ändern in der App gefunden (nur Reset über Supabase, falls eingerichtet) – prüfen.

---

## 8. Manuelle, rechtliche und organisatorische Prüfungen

| Nr. | Aufgabe | Zuständig |
|---|---|---|
| 1 | Impressum und Datenschutzerklärung vollständig ausfüllen (Platzhalter in `impressum.html`, `datenschutz.html` beider Apps) | Betreiber/Schule, ggf. Rechtsberatung |
| 2 | Rollenverteilung klären: Wer ist Verantwortlicher (Schule/Träger), wer Auftragsverarbeiter (Betreiber der App)? AV-Vertrag Schule ↔ Betreiber | Schule, Betreiber |
| 3 | AV-Verträge/DPA mit Supabase, OpenAI, Hosting (Vercel oder Netlify) abschließen bzw. ablegen; Unterauftragsverarbeiter dokumentieren | Betreiber |
| 4 | Drittlandtransfer OpenAI bewerten (DPF-Zertifizierung, SCC, Transfer-Folgenabschätzung); EU-Datenresidenz prüfen und ggf. `OPENAI_BASE_URL` setzen | Betreiber, DSB |
| 5 | Verzeichnis von Verarbeitungstätigkeiten (Art. 30) anlegen – Dateninventar in Abschnitt 3 als Ausgangspunkt | Schule/Betreiber |
| 6 | Schwellwertanalyse DSFA (Art. 35) anhand der Muss-Liste der zuständigen Landesaufsicht | DSB |
| 7 | Rechtsgrundlagen je Zweck festlegen (Schulrecht des Landes, Einwilligung für Sprachsimulation/KI?) | Schule, DSB |
| 8 | Löschfristen je Datenart festlegen, insbesondere Ausbildungsnachweis (Aufbewahrungspflichten) | Schule |
| 9 | Prozess für Datenpannen (Art. 33/34): Meldeweg, 72-Stunden-Frist, Kontakt Aufsichtsbehörde | Schule, Betreiber |
| 10 | Supabase Auth: Mindestlänge Passwort ≥ 8, Leaked-Password-Protection an, E-Mail-Bestätigung an, Selbstregistrierung bewusst entscheiden | Betreiber (Dashboard) |
| 11 | ✅ SQL-Korrekturen ausgeführt (10.11.2026); Kursbeitritt per Code einmal live in der App testen | Betreiber |
| 12 | Lernende und Lehrkräfte schriftlich anweisen, keine echten Patientendaten einzugeben | Schule |
| 13 | Externer Penetrationstest vor Produktivstart mit vielen Schulen | Betreiber |

**Quellen**
- DSGVO (Verordnung (EU) 2016/679), amtliche Fassung: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- BDSG: https://www.gesetze-im-internet.de/bdsg_2018/
- DSFA-Muss-Liste nicht-öffentlicher Bereich (DSK, hier Fassung HmbBfDI): https://datenschutz-hamburg.de/fileadmin/user_upload/HmbBfDI/Datenschutz/Informationen/DSFA_Muss-Liste_fuer_den_nicht-oeffentlicher_Bereich_-_Stand_17.10.2018.pdf
- OWASP ASVS 5.0.0: https://owasp.org/www-project-application-security-verification-standard/
- OpenAI, Datenresidenz in Europa: https://openai.com/index/introducing-data-residency-in-europe/
- Supabase, DSGVO/DPA: https://supabase.com/docs/guides/security/gdpr-compliance und https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq
- EU-US Data Privacy Framework, Rechtsmittel beim EuGH: https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework
- Supabase Database Linter (Advisor-Befunde): https://supabase.com/docs/guides/database/database-linter

---

## 9. Priorisierte Verbesserungen

| Priorität | Vorschlag | Aufwand | Hinweis |
|---|---|---|---|
| ~~P1~~ | ~~SQL-Korrekturen ausführen (S-01, S-02, D-05)~~ | – | ✅ erledigt am 10.11.2026 |
| P1 | Supabase-Auth-Einstellungen (Punkt 8.10) | klein | Dashboard |
| P1 | Rechtliche Platzhalter ausfüllen | klein | nur durch Verantwortliche |
| P2 | Limits atomar zählen, Fortsetzungen begrenzen (S-04, S-05) | mittel | Schemaänderung + Deployment |
| P2 | Gruppenräume: Anlegen nur angemeldet, Rate-Limit (S-03) | mittel | |
| P2 | Modul-HTML beim Speichern filtern (S-08) | mittel | |
| P2 | Löschfristen für Meldungen, Puls, Feedback, Abgaben | mittel | nach Festlegung durch Schule |
| P3 | pdf.js aktualisieren (S-09), SheetJS aktualisieren (S-10) | klein | |
| P3 | Ladezeit: Die Schüler-App lädt beim Start 130 Skriptdateien (≈ 5,1 MB unkomprimiert, App-Bundle 248 KB gzip) ohne `defer`. Vorschlag: Erweiterungen bündeln und mit `defer` laden | mittel | Architekturänderung, nur Vorschlag |
| P3 | Passwort ändern in den Einstellungen | klein | Neue Funktion, nur Vorschlag |
| P3 | Vollständiger WCAG-2.2-Test mit Screenreader und Kontrastmessung | mittel | |
| P3 | Tests in einer CI (GitHub Actions) automatisch ausführen | klein | kostenlos für öffentliche Repos; Kosten bei privaten Repos prüfen |

---

## 10. Checkliste Produktivstart

- [x] `pflegeplanung_sicherheit.sql` produktiv ausgeführt (10.11.2026)
- [x] `audit_mandantentrennung.sql` produktiv ausgeführt; Prüfabfrage ergibt 0
- [x] Supabase-Advisor erneut ausgeführt: nur noch bewusst öffentliche Funktionen anonym aufrufbar
- [ ] Auth: Passwortlänge ≥ 8, Leaked-Password-Protection, E-Mail-Bestätigung, Entscheidung Selbstregistrierung
- [x] pg_cron aktiv, 7 Löschjobs eingeplant
- [ ] Erster nächtlicher Lauf kontrolliert (`cron.job_run_details`)
- [ ] Impressum und Datenschutzerklärung vollständig, mit Datum
- [ ] AV-Verträge/DPA abgeschlossen und abgelegt (Schule, Supabase, OpenAI, Hosting)
- [ ] VVT angelegt, DSFA-Schwellwertanalyse dokumentiert
- [ ] Drittlandtransfer bewertet; EU-Datenresidenz entschieden
- [ ] Löschkonzept beschlossen
- [ ] Datenpannen-Prozess festgelegt
- [ ] Anweisung „keine echten Patientendaten“ an alle Nutzenden
- [ ] Live-Test mit Testschule: Registrierung, Kursbeitritt per Code, Abgabe, Nachweis mit Unterschrift, Konto löschen, Datenauskunft
- [ ] KI-Funktionen live geprüft (Übersetzung, Assistent, Pflegeplanung, Sprachsimulation) inkl. Limits
- [ ] Alle Tests aus Abschnitt 6 grün
- [ ] Optional: externer Penetrationstest

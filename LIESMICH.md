# Fallpfad Lehrer-Portal

Dieser Ordner ist eine eigene Website nur für Lehrkräfte und Praxisanleitende.

## Neu in dieser Version (11.11.2026, Nachtrag 2): Stundenplan ohne KI per Excel-Vorlage

- Das Fenster „Stundenplan hochladen“ (Kurs- und Lehrer-Stundenplan) hat zwei Reiter: „Mit KI: beliebige Datei“ und „Ohne KI: Excel-Vorlage“.
- Ohne KI: Die App zeigt, welche Spalte was enthält (A Datum oder Tag, B Beginn, C Ende, D Thema, danach Raum/Lehrkraft/Status/Notiz bzw. Kurs/Raum/Notiz), bietet die passende Vorlage zum Download an und liest die ausgefüllte Datei (.xlsx, .xls, .ods, .csv) direkt im Browser.
- Erkannt werden Datum (12.11.2026, ISO, Excel-Datum) oder Wochentag, Uhrzeiten wie 8:00 oder „8 Uhr“, Status wie Entfall/Raumänderung/Vertretung. Überschriften dürfen leicht abweichen.
- Danach dieselbe Vorschau wie bei der KI: prüfen, korrigieren, auf weitere Wochen übertragen, speichern. Kein KI-Kontingent, keine Edge Function nötig.

## Stundenplan mit KI übernehmen (11.11.2026, Nachtrag)

- Unter **Stundenplan** heißt der Knopf jetzt **„Stundenplan hochladen (KI)“**, sowohl beim Lehrer-Stundenplan als auch beim Schüler-Stundenplan eines Kurses. Hochladen lässt sich alles, wie es gerade vorliegt: PDF, Word (.docx), Excel/CSV, Text, Foto oder Screenshot, oder einfach eingefügter Text. Die Tabelle muss nicht ordentlich sein.
- Die Datei wird im Browser ausgelesen (Bilder werden verkleinert, gescannte PDFs als Bild geschickt). Die neue Edge Function `stundenplan-import` erkennt Datum, Uhrzeit, Thema, Raum, Lehrkraft bzw. Kurs und Ausfälle/Raumänderungen. Stehen nur Wochentage im Plan, werden sie der geöffneten Woche zugeordnet und lassen sich auf bis zu 20 weitere Wochen übertragen.
- Vor dem Speichern erscheint eine Vorschau, in der jede Stunde geändert oder abgewählt werden kann. Gespeichert wird erst mit „Übernehmen“. Das Einfügen ohne KI bleibt über „Ohne KI: Tabelle einfügen“ möglich.
- Gezählt wird gemeinsam mit dem Tageslimit des Assistenten der Lehrkräfte. Optionales Secret `OPENAI_MODEL_STUNDENPLAN`.
- **Einrichten:** `supabase functions deploy stundenplan-import`
- Außerdem: Im Stundenplan war der heutige Tag unsichtbar (weiße Schrift auf weißem Grund), behoben.

## Neu in dieser Version (11.11.2026)

- **Assistent: Fehler 400 behoben.** Neue Datei `supabase/functions/_shared/openai.ts`: strukturierte Ausgabe und automatisches Ausweichen auf einfachere Anfragen bzw. ein Ausweichmodell, wenn OpenAI einen Parameter ablehnt. Genutzt von `assistent`, `folien-import`, `pflegeplanung` und `gespraech-auswertung`. Bitte neu bereitstellen:
  `supabase functions deploy assistent folien-import pflegeplanung gespraech-auswertung`
  Optionales Secret `OPENAI_MODEL_FALLBACK` (Standard `gpt-4.1-mini`).
- **`content.json` aktualisiert:** Module fm61 bis fm75 haben jetzt denselben Aufbau wie die übrigen Module (6 bis 8 Stationen mit Fallsituation, Praxisauftrag, Zusammenfassung und Dokumentation).
- **Fachlexikon** (`js/kern/06-fachlexikon.js`) um rund 710 Begriffe erweitert, steht auch dem Assistenten der Lehrkräfte zur Verfügung.
- Assistent: bedeutungslose Punkte unter dem Eingabefeld entfernt, doppelte Quellen in der Demo-Antwort entfernt.
- Admin-Statistik: Eintrag „Akutsimulation“ entfernt (das Training gibt es in der Schüler-App nicht mehr).

## Anmeldung, Freischaltung und Kurs-Pflicht (10.11.2026, Abend)

**Ablauf Lehrkraft:** Registrieren im Portal (optional mit Einladungscode, auch per Link `…/?einladung=CODE`) → Mail „Willkommen bei Fallpfad“ → Klick führt direkt zurück ins Lehrer-Portal und meldet an → ein Code aus der Registrierung wird beim Bestätigen automatisch eingelöst. Ohne gültigen Code sieht das Konto nur die Seite „Zugang zu deiner Schule freischalten“.

**Ablauf Administration (Rolle `admin`):** Reiter *Schulen* → Karte *Lehrkräfte freischalten*. Dort stehen alle Konten, die sich im Lehrer-Portal registriert haben und noch keine Lehrkraft sind: Schule wählen, optional Schulleitung, *Freischalten* oder *Ablehnen*. Darunter: bestehendes Konto per E-Mail-Adresse freischalten. Einladungscodes je Schule wie bisher; die erzeugte Einladungs-Mail enthält jetzt fertige Links mit Code.

**Ablauf Lernende:** Registrieren in der Schüler-App → Bestätigungslink führt zurück in die Schüler-App. Ohne Kurs sind Assistent, Sprachsimulation, Pflegeplanung-Rückmeldung und App-Übersetzung gesperrt (Prüfung serverseitig über `fp_ki_erlaubt`). Freigeschaltet, sobald der Kurscode eingegeben ist.

**Technik:** `supabase/zugang_freischaltung.sql` (Funktionen `fp_einladung_einloesen`, `fp_auth_bestaetigt` + Trigger auf `auth.users`, `fp_admin_anfragen`, `fp_admin_freischalten`, `fp_admin_freischalten_email`, `fp_admin_ablehnen`, `fp_ki_erlaubt`, `fp_mein_zugang`, Versuchsbegrenzung `fp_code_versuch`). Links aus den E-Mails löst `js/kern/00-anmeldelink.js` in beiden Apps ein (auch „Passwort vergessen“: Dialog für das neue Passwort). E-Mail-Vorlagen in `supabase/email-vorlagen/`.

**Supabase-Dashboard (Authentication):** *URL Configuration*: Site URL `https://pflegepfad.vercel.app`, Redirect URLs `https://pflegepfad.vercel.app/**` und `https://pflegepfadlehrer.vercel.app/**`. *Email Templates*: Inhalte aus `supabase/email-vorlagen/` (Bestätigung, Passwort, E-Mail ändern, Magic Link). *SMTP Settings*: eigener Absender „Fallpfad“, sonst steht „Supabase Auth“ als Absender in der Mail.

## Neu in dieser Version (10.11.2026)

- **Startseite:** Ganz oben stehen jetzt deine Kurse als Kursblöcke (wie unter „Kurse & Schüler“: im Einsatz, im Unterricht, Praxisanleitung, Unterrichtsfeedback). Ein Tipp öffnet den Kurs. Die Zahlen (Lernende, aktiv in 7 Tagen) stehen unten.
- **Seitenleiste:** „Kurse & Schüler“ steht direkt unter „Übersicht“, der Assistent darunter.
- **Assistent für Lehrkräfte:** neue Aufträge „Lernsituation schreiben“, „Arbeitsblatt erstellen“, „Erwartungshorizont“ und „Text vereinfachen“ (DaZ, B1). Ergebnisse als Dokumentkarte mit Download als Word-Datei; Klausuren ebenfalls als Word-Datei mit Lösungsteil. Niveau je Ausbildungsjahr wählbar. Keine Anzeige des Tageslimits mehr (großzügiges Limit als Kostenschutz, Secret `FALLPFAD_ASSISTENT_LIMIT_LEHRER`, Standard 80).
- **Profilmenü und Symbole** wie in der Schüler-App überarbeitet (`css/06-politur.css`).
- **Backend:** Edge Function `pflegeplanung` (neu), `uebersetzen` repariert, `assistent` mit neuen Limits und Dokumenttyp. SQL: `supabase/pflegeplanung_sicherheit.sql` einmal ausführen.

### Einrichtung für diese Version

| Schritt | Was |
|---|---|
| 1 | `supabase/pflegeplanung_sicherheit.sql` im SQL Editor ausführen (Zähler, Härtung, pg_cron-Löschfristen) |
| 2 | Edge Functions bereitstellen: `supabase functions deploy pflegeplanung assistent uebersetzen` (mit Ordner `_shared`) |
| 3 | Optional: `OPENAI_MODEL_PFLEGEPLANUNG`, `FALLPFAD_PFLEGEPLANUNG_TAG` (Standard 25 je Person und Tag), `FALLPFAD_ASSISTENT_LIMIT` (40), `FALLPFAD_ASSISTENT_LIMIT_LEHRER` (80) |
| 4 | Supabase > Authentication > Passwortschutz: „Leaked password protection“ einschalten |

## Aufbau (modular)

| Ordner / Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst: lädt Stylesheets und Skripte der Reihe nach |
| `css/` | Gestaltung in Ebenen: `01-basis`, `02-erweiterungen`, `03-apple`, `04-pro`, `05-feinschliff` |
| `js/kern/` | Start: Konfiguration, Demo-Konto, Farbprofile, zusätzliche Live-Fälle |
| `js/app/01-portal.bundle.js` | der gebaute Kern des Portals |
| `js/erweiterungen/` | je Bereich eine Datei: Live-Unterricht, Folien-Import, Schulverwaltung, Freischaltung, Profilmenü … |
| `content.json` | die eingebauten Module als Daten |
| `supabase/` | **das Backend**: Datenbank (SQL), Edge Functions, Sicherheit. Siehe `supabase/BACKEND.md` |
| `vercel.json` | Sicherheits-Header (CSP, HSTS, kein Einbetten, keine Suchmaschinen) |

Die Reihenfolge der `<script>`-Zeilen in `index.html` nicht ändern.

## Sicherheit und Backend in dieser Version

- Kein Inline-Code mehr, dadurch strenge Content-Security-Policy.
- Alle Edge Functions nutzen `supabase/functions/_shared/sicherheit.ts`: Antworten nur für die eigenen Apps (CORS), Größenbegrenzung, Sicherheits-Header.
- `supabase/sicherheit_haertung.sql` (Schritt 13): fester `search_path`, Trigger-Funktionen nicht mehr über die API aufrufbar, Einwilligungsprotokoll, Datenauskunft.
- **KI-Gesprächsperson bleibt in ihrer Rolle:** Die Rollenanweisung in `_shared/komm.ts` ist neu aufgebaut. Ursache des Rollenwechsels war, dass Texte aus der Aufgabenkarte der Lernenden („Du bist Auszubildende …“) unverändert in der Anweisung der KI standen.
- Nach dem Hochladen: Edge Functions neu bereitstellen (`supabase functions deploy`), `sicherheit_haertung.sql` ausführen.

## Neu in dieser Version: Assistent

Reiter **Assistent** (links, nach der Übersicht). Er erstellt Module, Klausuren und Unterrichtspläne und beantwortet Fachfragen, aber nur aus Quellen:

- **Eigene Quellen:** PDF, PowerPoint oder eingefügter Text. Liegen nur im Browser der Lehrkraft. Vor dem Hochladen bestätigen, dass keine Patientendaten enthalten sind.
- **Fallpfad-Module** lassen sich zusätzlich einbeziehen (Schalter).
- **Modul aus Quellen:** baut über den Folien-Import ein Modul und öffnet es im Editor. Vor dem Veröffentlichen fachlich prüfen.
- Jede Aussage trägt eine Quellenangabe. Was nicht in den Quellen steht, schreibt der Assistent nicht.
- 3 Nachrichten pro Tag (Secret `FALLPFAD_ASSISTENT_TAG_LEHRER`).

### Einrichtung (einmalig)

```bash
supabase functions deploy assistent gespraech-sitzung gespraech-auswertung --project-ref sngnzhazulypdvdkhwja
```

Danach `supabase/assistent.sql` im SQL-Editor ausführen. `gespraech-*` muss neu bereitgestellt werden, weil sich zwei Szenarien geändert haben (NEWS2 entfernt).

## Aus der letzten Version: Training „Kommunikation“

- **Neuer Bereich unter Training > Kommunikation** mit fünf Kategorien: Patientengespräch, Angehörigengespräch, Konflikt- und Beschwerdegespräch, Aufnahmegespräch und Beratungsgespräch. Je Kategorie drei Gespräche (insgesamt 15), alle Personen erfunden.
- **Sprachsimulation in Echtzeit:** Die lernende Person spricht über das Mikrofon mit einer KI, die die Gesprächsperson spielt und mit natürlicher Stimme antwortet. Die Person fragt nach, versteht manchmal etwas nicht, reagiert auf Fachwörter, Tempo und Ton und gibt Wichtiges erst preis, wenn gut nachgefragt wird. Die Stimmung verändert sich je nach Gesprächsführung. Live-Untertitel sind zuschaltbar, statt zu sprechen kann man auch schreiben. Höchstens 10 Minuten je Gespräch, bei Verbindungsabbruch geht das Gespräch nahtlos weiter.
- **Auswertung nach jedem Gespräch:** Gesamtergebnis und je 0 bis 100 Punkte für Gesprächsführung, Verständlichkeit, Empathie und fachliche Kommunikation, mit Stärken, Verbesserungen, Status jedes Lernziels, Schlüsselmomenten mit wörtlichem Zitat und besserer Formulierung, Messwerten (Redeanteil, Sprechtempo, offene Fragen, Unterbrechungen) und einem Übungstipp.
- **Datenschutz:** Vor dem ersten Gespräch willigt die Person ein (widerrufbar unter Training > Kommunikation). Ton und Mitschrift speichert Fallpfad nicht auf dem Server, im Konto landen nur die Punktzahlen. Die Rollenanweisungen liegen auf dem Server, Lernende können keine eigenen Anweisungen einschleusen. Tageslimit je Konto. Die Datenschutzerklärung (Abschnitt 2.7) ist angepasst.
- **Demo-Konto:** Dort ist das Live-Gespräch nicht möglich (kein Server). Stattdessen gibt es eine Beispielauswertung.
- **Abbildungen im Praktischen Examen** überarbeitet: Figuren mit sauber angesetztem Hals, neu gezeichnete Szenen, Patientenbilder pulsieren nicht mehr beim Antippen.

### Einrichtung für die Kommunikation

| Schritt | Was |
|---|---|
| 1 | `supabase/gespraech_nutzung.sql` im SQL Editor ausführen (Tageszähler, nur Zahlen) |
| 2 | Die Edge Functions `gespraech-sitzung` und `gespraech-auswertung` bereitstellen, mit dem Ordner `supabase/functions/_shared` (Lehrer-Portal-Paket). Am einfachsten mit der Supabase-CLI: `supabase functions deploy gespraech-sitzung` und `supabase functions deploy gespraech-auswertung`. Beide nutzen den vorhandenen Secret `OPENAI_API_KEY` |
| 3 | Optional als Secrets: `OPENAI_MODEL_GESPRAECH` (Standard `gpt-realtime-2.1`, günstiger: `gpt-realtime-2.1-mini`), `OPENAI_MODEL_AUSWERTUNG`, `OPENAI_MODEL_TRANSKRIPTION` (Standard `gpt-4o-mini-transcribe`), `FALLPFAD_GESPRAECHE_TAG` (Standard 8 Gespräche je Person und Tag), `FALLPFAD_GESPRAECH_MAX_SEKUNDEN` (Standard 600) |
| 4 | Empfohlen: Bei OpenAI die europäische Datenresidenz beantragen (über den OpenAI-Vertrieb, neues Projekt mit Region Europa, Zero Data Retention) und dann `OPENAI_BASE_URL=https://eu.api.openai.com/v1` setzen. Ohne das läuft die Verarbeitung in den USA; so steht es auch in der Datenschutzerklärung |
| 5 | Im OpenAI-Projekt ein monatliches Ausgabenlimit setzen. Sprachgespräche sind deutlich teurer als Text; die Kosten hängen vom Modell und der Gesprächslänge ab (aktuelle Preise auf der Preisseite von OpenAI). Mit `gpt-realtime-2.1-mini` wird es erheblich günstiger, das Tageslimit begrenzt die Kosten je Person |

Wer die Funktion nicht anbieten möchte, stellt die beiden Funktionen einfach nicht bereit. Die App meldet dann „noch nicht eingerichtet“.

## Aus der letzten Version

**Beim Hochladen unbedingt mitnehmen:** den neuen Ordner `vendor/` (alle Bibliotheken liegen jetzt auf deinem eigenen Server, die App lädt nichts mehr von fremden Servern) und die Seiten `datenschutz.html`, `nutzungsbedingungen.html`, `impressum.html`, `konto-loeschen.html`. In diesen vier Seiten vorher die Platzhalter in eckigen Klammern ausfüllen.

- **Neues Design im Stil von Apple (Erinnerungen):** ruhige graue Flächen, weiße Karten ohne Schatten, große Titel, Seitenleiste mit farbigen Kreis-Symbolen, untere Leiste auf dem Handy wie die iOS-Tab-Bar, iOS-Schalter und Segmente. Gilt für Schüler-App und Lehrer-Portal.
- **Fünf neu abgestimmte Farbprofile:** Blau (Standard, das Fallpfad-Blau), Grün, Lila-Pink, Orange und Graphit. Jedes Profil hat eine eigene, passende Symbolpalette, keine bunte Mischung mehr. Der Dunkelmodus ist je Profil eigens abgestimmt: echtes Schwarz, erhöhte graue Flächen, aufgehellte Akzente.
- **Logo flach** wie das App-Symbol.
- **Neuer Reiter „Einstellungen“** (auf dem Handy „Optionen“): Konto und Profilbild, Farbe und Meine Sprache, Hell/Dunkel und Schriftgröße, Kurs beitreten, Bezugslehrkraft, Tutorial wiederholen, Kontakt, Datenschutz, Nutzungsbedingungen, Impressum, Konto löschen, Lernfortschritt zurücksetzen. Fortschritt zeigt nur noch den Fortschritt.
- **Tutorial:** Der Knopf unten links ist weg. Das Tutorial startet über das Profilmenü („Tutorial ansehen“) und unter Einstellungen.
- **Zwei neue Fälle in der Praktischen Examen Übung** (jetzt 10): Kardiologie mit 12-Kanal-EKG als Simulation und Nachblutung nach Herzkatheter als Bildbefund, Pneumologie mit endotrachealem Absaugen über die Trachealkanüle und COPD mit zu viel Sauerstoff als Bildbefund. Jeweils mit Vitalzeichen, Medikamentencheck, Störfall, Pflegebericht, Übergabe und Reflexion.
- **Meine Sprache:** Für alle, denen Fachdeutsch schwerfällt. Im Profil eine von über 20 Sprachen oder „Einfaches Deutsch“ wählen. Dann gibt es neben „Vorlesen“ in jedem Lernblock einen Knopf mit Weltkugel: Er zeigt den Text übersetzt bzw. vereinfacht und darunter die wichtigen Wörter mit Artikel (der/die/das farbig), Übersetzung und Aussprache. Text markieren (in Fällen, Aufgaben, Live) blendet eine kleine Leiste zum Vorlesen und Übersetzen ein. Fachbegriffe im Lexikon und in den Begriffs-Fenstern zeigen die Übersetzung direkt. Wörterbuch und Vorlesen laufen ohne Server auf dem Gerät; ganze Texte übersetzt die neue Edge Function `uebersetzen`. Die Sprachwahl bleibt nur auf dem Gerät.
- **Training „Fachsprache Deutsch“:** 177 Grundwörter der Pflege in 9 Themenfeldern mit Artikel und Aussprache (übersetzt in Englisch, Türkisch, Arabisch, Ukrainisch, Russisch, Vietnamesisch), 27 Sätze für den Dienst (Patientengespräch, Übergabe, Notfall) und drei Übungen: Bedeutung, Hören und erkennen, der/die/das.
- **Konto löschen in der App:** Profil > Konto löschen (Pflicht für App Store und Google Play, Recht auf Löschung). Braucht die Edge Function `konto-loeschen`.
- **Rechtliches in der App:** Links zu Datenschutz, Nutzungsbedingungen und Impressum auf der Anmeldeseite und im Profilmenü.
- **Vorlesen datenschutzfreundlicher:** Die App wählt bevorzugt Stimmen, die auf dem Gerät laufen. Mit „Langsamer vorlesen“ (unter Meine Sprache) wird langsamer gesprochen.

### Einrichtung für diese Version

| Schritt | Was |
|---|---|
| 1 | `supabase/meine_sprache.sql` ausführen (Übersetzungs-Zwischenspeicher, Tageszähler) |
| 2 | `supabase/datenschutz_aufraeumen.sql` ausführen (automatische Löschfristen; vorher unter Database > Extensions `pg_cron` aktivieren) |
| 3 | Edge Functions `uebersetzen` und `konto-loeschen` bereitstellen (Ordner `supabase/functions` im Lehrer-Portal-Paket). `uebersetzen` nutzt denselben Secret `OPENAI_API_KEY` wie der Folien-Import. Optional: `OPENAI_MODEL_UEBERSETZEN`, `FALLPFAD_LS_ZEICHEN_TAG` (Standard 60000 Zeichen je Person und Tag) |
| 4 | Optional in `config.js` ergänzen: `webUrl` (Adresse der Web-App), `datenschutzUrl`, `nutzungUrl`, `impressumUrl`, falls die Rechtstexte woanders liegen (siehe `config.BEISPIEL.js`) |

## Aus früheren Versionen (großer Ausbau)

- **Profilmenü mit 5 Farbprofilen:** Ein Klick auf dein Profil (oben rechts oder unten links) öffnet ein Menü mit Profilbild, fünf Farben (jeweils hell und dunkel), Hell/Dunkel/Automatisch, Einstellungen und Abmelden. Die Schrift bleibt immer gleich.
- **Einführung nur nach der Registrierung:** Neue Konten sehen die Tour automatisch beim ersten Anmelden. Eine Stunde lang gibt es danach unten links den kleinen Knopf „Tutorial“ zum erneuten Ansehen. Lehrer- und Schüler-Tour erklären jetzt Schritt für Schritt, wie man etwas erledigt.
- **Mini-Effekte und Handy-Feinschliff:** kurze Rückmeldung beim Antippen, sanfte Seitenwechsel, kompakte untere Leiste im Lehrer-Portal, Sprungleiste zu den Ausbildungsjahren, Kitteltasche als Schnellaktion unter Praxis.
- **Sechs neue Live-Methoden im Bausteinkasten (jetzt 17), je mit einem fertigen Beispiel unter „Neue Methoden ausprobieren“:**
  - **Sicher oder geraten?** Antwort plus Selbsteinschätzung. Vorne erscheint eine Vier-Felder-Matrix, die „sicher, aber falsch“ (gefährliche Fehlvorstellungen) sichtbar macht. Beispiel: Medikamente sicher geben.
  - **Körperkarte:** Die Klasse tippt Stellen auf einer Körpersilhouette (vorne oder hinten) an, vorne entsteht eine Heatmap, beim Auflösen erscheinen die richtigen Zonen. Beispiel: Dekubitus-Prädilektionsstellen und s.c.-Injektionsorte.
  - **Live-Zuordnung:** Begriffe in 2 bis 4 Kategorien sortieren, vorne siehst du pro Begriff, wo die Klasse schwankt. Beispiel: Erreger und Isolierungsart.
  - **Hinweis für Hinweis:** Ein Fall wird Stück für Stück aufgedeckt („Nächster Hinweis“ oder Pfeiltaste), die Klasse legt sich früh fest und darf umdenken. Am Ende siehst du, nach welchem Hinweis wer richtig lag. Beispiel: Delir bei Herrn Albers.
  - **Perspektivwechsel:** Jedes Handy bekommt zufällig eine Rolle und antwortet in der Ich-Form. Vorne stehen die Sichtweisen nebeneinander. Beispiel: Herr Petersen soll ins Heim.
  - **Klassenentscheid:** ein verzweigter Fall. Die Mehrheit entscheidet, wie es weitergeht, die Klasse erlebt die Folgen. Nach dem Auflösen siehst du, was die empfohlene Entscheidung bewirkt hätte. Beispiel: Nachtdienst mit Frau Lorenz. Den Ablauf schreibst du in einem Feld (`#` Situation, `-` Option, `*` empfohlen, `-> 2` nächste Situation, `| Folge`), ein Beispiel lässt sich per Knopf einsetzen.
  - Keine neue Datenbank-Datei nötig.
- **Live im Unterricht:** Der Bereich „Live“ hat drei Wege:
  - **Live-Stunde bauen** aus 17 Bausteinen: Folie, Fallsituation, Abstimmung, Peer Instruction (zwei Runden mit Vergleich), Richtig-oder-Falsch-Blitz, Schätzfrage mit Verteilung, Wortwolke, Ampel-Check, Meinungslinie, Reihenfolge und Fehlerjagd. Eingabe in einfachen Feldern, z. B. richtige Antwort mit `*` davor.
  - **Modul live an der Tafel:** ein Fallmodul wählen, Stationen ankreuzen, starten. Fragen, Quiz und Übungen werden zu Abstimmungen.
  - **Aus Folien erstellen** wie bisher.
- **Präsentation:** Vollbild mit QR-Code und Code. Vorne siehst du, wie viele was gewählt haben, das Ergebnis kannst du verdeckt sammeln und dann auflösen. Weiter, zurück, auflösen auch mit Pfeiltasten und Leertaste. Die Lernenden können nicht vorblättern.
- **10 fertige Live-Stunden:** Händehygiene, Vitalzeichen, Dekubitus, Sturz, Schmerz, Diabetes, Herzinsuffizienz, Delir, Ethik und Reanimation, jeweils mit wechselnden Methoden.
- **8 Fallbeispiele für die Klasse ohne Vitalzeichen-Monitor** und 4 zusätzliche Live-Klassenfälle mit Vitalzeichen (Nachblutung, Ödem, Fieberkrampf, Schädel-Hirn-Trauma).
- **Module freischalten:** Unter Module > „Für Kurse freischalten“ legst du pro Kurs fest, ob ein Modul frei, gesperrt (mit Schloss sichtbar) oder ausgeblendet ist, auch für ein ganzes Ausbildungsjahr auf einmal.
- **Vier neue Fallmodule:** Hygiene und Infektionsschutz, Körperpflege mit Haut und Mund, Atmung mit Pneumonie und Sauerstoff, Gesund bleiben im Beruf. Dazu rund 370 neue Lernkarten und 15 neue Kitteltaschen-Einträge in der Schüler-App.
- **Ruhigeres, moderneres Design.**

**Wichtig beim Hochladen:** `content.json` ersetzen (jetzt 41 Module). Danach in Supabase einmal `supabase/live_unterricht.sql` ausführen (nach `schulen.sql`).

## Ältere Neuerungen

- **Demo-Konto zum Vorstellen:** Mit `lehrer@demo.fallpfad.de` und Passwort `Demo2026` anmelden. Es öffnet sich ein Portal mit vier Kursen (1., 2. und 3. Ausbildungsjahr plus Examenskurs), 27 erfundenen Lernenden mit unterschiedlichem Lernstand, Aufgaben, Ausbildungsnachweisen, Feedback und Benachrichtigungen. Nichts davon landet in der Datenbank. „Beenden“ unten rechts oder Abmelden setzt die Demo zurück.
- **Einführung beim ersten Anmelden:** kurze Tour durch Übersicht, Kurse, Module, Aufgaben, Nachweis, Live, Nachrichten und Einstellungen. 
- **Aus Folien erstellen:** Unter Module, Live und Team-Krankenhaus gibt es den Knopf „Aus Folien erstellen“. PowerPoint (.pptx) oder PDF hochladen, Ausbildungsjahr, Umfang und Wünsche angeben, Bilder auswählen. Ist der KI-Dienst eingerichtet, schreibt Fallpfad ein komplettes Fallmodul mit Geschichte, Szenen, Wissen, Quiz, Mythen-Check, Zuordnen, Fallverlauf, Fehlersuche, Pflegebericht und Reflexion, einen Live-Fall oder eine Gruppenarbeit. Ohne KI-Dienst entsteht ein Schnellentwurf aus den Folien. Das Ergebnis öffnet sich immer als Entwurf im Editor.
- **Mehrere Schulen:** Mit `schulen.sql` sieht jede Schule nur ihre eigenen Kurse, Lernenden, Module, Aufgaben und Nachweise. Die Plattform-Administration bekommt den Bereich „Schulen“: Schulen anlegen und sperren, Einladungscodes erzeugen, Lehrkräfte verwalten, das Portal als eine Schule ansehen. Oben im Portal steht, zu welcher Schule man gehört.
- **Farben je Bereich** wie bei den Trainingskacheln, damit man Bereiche und Kartenarten sofort unterscheidet.

## KI-Dienst für den Folien-Import einrichten (OpenAI, einmalig)

Die ausführliche Schritt-für-Schritt-Anleitung mit Datenschutz-Checkliste steht im Admin-Handbuch. Kurzfassung:

1. OpenAI-Organisation als Unternehmen mit Sitz in Deutschland anlegen (Vertragspartner ist dann OpenAI Ireland Ltd), Auftragsverarbeitungsvertrag (DPA) abschließen und prüfen, dass die Freigabe der Daten zum Training ausgeschaltet ist.
2. Ein Projekt anlegen (Standard-Region genügt), darin den API-Schlüssel erzeugen und ein Ausgabenlimit setzen. Verarbeitung dann in den USA auf Grundlage der EU-Standardvertragsklauseln im DPA; OpenAI speichert Anfragen höchstens 30 Tage zur Missbrauchserkennung und nutzt sie nicht zum Training. Das steht so auch in der Datenschutzerklärung. Wer später EU-Datenresidenz freigeschaltet bekommt, setzt `OPENAI_BASE_URL=https://eu.api.openai.com/v1`.
3. Supabase-Dashboard > Edge Functions > „Deploy a new function“ > „Via Editor“, Name `folien-import`, Inhalt von `supabase/functions/folien-import/index.ts` einfügen, Deploy.
4. Edge Functions > Secrets: `OPENAI_API_KEY` (Pflicht). Optional: `OPENAI_MODEL` (Standard `gpt-6.1-terra`), `OPENAI_BASE_URL` (Standard `https://api.openai.com/v1`), `OPENAI_REASONING` (Standard `low`), `FALLPFAD_LIMIT_TAG` (Standard 150).
5. `schulen.sql` muss ausgeführt sein.

Datenschutz eingebaut: Die Datei bleibt im Browser, nur Folientexte gehen über die Edge Function an OpenAI (USA, Standardvertragsklauseln, höchstens 30 Tage Speicherung zur Missbrauchserkennung, kein Training), `store=false`, keine Namen oder Konten der Lehrkräfte, E-Mail-Adressen, Telefonnummern und Datumsangaben werden vor dem Versand entfernt, die Lehrkraft bestätigt vorher, dass keine personenbezogenen Daten enthalten sind, Ergebnisse sind als KI-erstellt gekennzeichnet, das Protokoll enthält keine Inhalte und wird nach 90 Tagen gelöscht.

## Admin-Zentrale (November 2026)

Der Admin-Reiter (nur für Plattform-Admins) hat jetzt sechs Bereiche:

| Bereich | Inhalt |
|---|---|
| Übersicht | Kennzahlen, Aktivität und KI-Nutzung im Zeitverlauf (7/30/90/365 Tage), Schulvergleich |
| Schulen | Schulen anlegen und sperren, Einladungscodes erzeugen, als Schule ansehen |
| Lehrkräfte | Freischaltungs-Anfragen, durchsuchbare Kontenliste |
| Feedback | Rückmeldungen aus beiden Apps mit Status und Notiz |
| Nutzung | Beliebteste Module, Trainings und Portalbereiche |
| Datenschutz | Was erfasst wird und was nicht |

**Einmalig nötig:** `supabase/admin_statistik.sql` ausführen. Das legt `fp_nutzung`, `fp_feedback` und die Admin-Funktionen an.

**Datenschutz:**
- Nutzung wird nur als Tageszähler pro Schule, App, Ereignis und Schlüssel gespeichert, ohne Nutzer-ID.
- Feedback ist anonym, außer die Person kreuzt „Rückmeldung erwünscht“ an.

Außerdem:
- `content.json` enthält jetzt 75 Module.
- `js/kern/06-fachlexikon.js` ist das erweiterte Fachlexikon für den Assistenten.

## Nachtrag 3 – Schneller laden und lesbare Download-Knöpfe

- **Home, Kurse & Schüler laden schneller:** Nachweis- und Begleitungsdaten werden beim Start einmal im Hintergrund geladen und danach 20 Sekunden lang zwischengespeichert. Mehrere Bereiche, die dieselben Daten brauchen, teilen sich eine einzige Anfrage. Beim Wechseln zwischen Home, Kursen und Schülern erscheinen die Daten sofort und werden im Hintergrund aufgefrischt.
- **Mehr als 1000 Einträge:** Supabase liefert pro Anfrage höchstens 1000 Zeilen. Einsätze, Einträge und Signaturen werden jetzt seitenweise geladen, damit nichts mehr abgeschnitten wird.
- **Unterschriften werden erst bei Bedarf geladen:** Die Unterschriften-Striche sind groß und werden nur noch beim Export geladen (ZIP, PDF, Drucken), nicht bei jedem Seitenaufruf.
- **Download-Knöpfe im Kurskopf:** Im hellen Modus weiß hinterlegt mit dunkler Schrift, im dunklen Modus halbtransparent mit weißer Schrift und Rahmen.

## Nachtrag 4 – Prüfung und Fehlerbehebung (12.11.2026)

Beide Apps wurden komplett durchgeklickt (alle Bereiche, hell und dunkel, Tablet und Handy) und alle Exporte heruntergeladen und geprüft.

**Behoben im Lehrer-Portal**
- **Schulname fehlte in allen PDFs.** Ausbildungsnachweise, Sammel-Export, ZIP, Prüfungsbögen, Auditbericht und Datenschutz-Übersicht hatten keinen Schulnamen, weil er intern nie gesetzt wurde. Jetzt wird der Name der Schule aus dem Konto übernommen.
- **PflAPrV-Auditbericht ließ sich nicht erstellen**, solange das Pflichtfeld „Name der Pflegeschule“ leer war. Das Feld ist jetzt vorausgefüllt.
- **Datenschutz-Übersicht (PDF) war inhaltlich falsch:** Region „Frankfurt“ statt Zürich, OpenAI und Vercel fehlten als Dienstleister. Korrigiert.
- **Unnötige Fehler im Hintergrund:** Das Portal rief bei jedem Laden zwei Aufräum-Funktionen auf, die nur der Datenbank-Zeitplan darf (403 in den Logs). Entfernt, der Zeitplan erledigt das weiterhin nachts.
- Riesiges Pfeil-Symbol bei „‹ Optionen“ im Auditbericht.

**Behoben in der Schüler-App**
- **Schnellaktionen im Praxis-Bereich öffneten das Formular nicht** („Arbeitstag eintragen“, „Praxisanleitung eintragen“, „Fehlzeit melden“, „Gespräch festhalten“). Man landete nur im Einsatz. Jetzt öffnet sich direkt das richtige Formular.
- **Profil speichern scheiterte für Lernende in einem Kurs** („Bitte den Kurscode deiner Lehrkraft eingeben.“). Die App speichert das Profil jetzt per Update statt Upsert. Zusätzlich SQL-Korrektur (siehe unten).
- Leiste „Einträge warten auf Bestätigung“ war durchsichtig und überlagerte Karten. Jetzt deckend.
- Cache-Version `fallpfad-v52`.

**Rechtstexte**
- `datenschutz.html` (beide Apps): Datenbank in **Zürich, Schweiz** statt Frankfurt; Vercel als Hosting-Anbieter eingetragen. Offene Platzhalter (Name, Anschrift, Datum, Fristen, E-Mail-Versand) bitte noch selbst ausfüllen.

**Einmal in Supabase ausführen:** `supabase/nachtrag_2026_11_12.sql` im SQL Editor. Korrigiert die Kurswechsel-Sperre (blockierte normales Profil-Speichern) und legt die fehlende Tabelle `fp_einstellungen` an (404 in den Logs).

**Empfohlen im Supabase-Dashboard:** Authentication → Passwortschutz „Leaked password protection“ einschalten (falls im Tarif verfügbar).

## Nachtrag 5 – PharmakoLab in der Schüler-App erweitert (12.11.2026)

Das PharmakoLab der Lernenden hat jetzt 31 Wirkstoffe und 20 Fälle (neu u. a. Anaphylaxie, Blutdruckkrise, postoperative Schmerztherapie mit Piritramid, Durchbruchschmerz, COPD, Kortison-Hyperglykämie, Hypoglykämie ohne Zugang mit Glukagon, Gallenkolik, Chemo-Übelkeit). Gelöste Fälle erscheinen wie bisher im Lernstand. Im Portal ist nichts zu ändern.

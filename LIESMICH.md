# Fallpfad Lehrer-Portal

Dieser Ordner ist eine eigene Website nur für Lehrkräfte und Praxisanleitende.

| Datei | Wofür |
|---|---|
| `index.html` | das komplette Lehrer-Portal |
| `config.js` | Verbindung zur Datenbank. Hier trägst du dieselben zwei Werte ein wie in der Schüler-App, dazu die Adresse der Schüler-App |
| `content.json` | alle 41 eingebauten Module als Daten, damit das Portal sie anzeigen und bearbeiten kann |
| `favicon.svg` | Symbol im Browser-Tab |
| `vercel.json` | sorgt dafür, dass Suchmaschinen das Portal nicht anzeigen |
| `supabase/lehrer_schema.sql` | Tabellen und Zugriffsrechte für Kurse, Module, Profile und Einladungen (einmal in Supabase ausführen) |
| `supabase/aufgaben.sql`, `live.sql`, `kurse_examen.sql`, `team.sql`, `kommunikation.sql` | weitere Funktionen, Reihenfolge siehe LIESMICH der Schüler-App |
| `supabase/nachweis.sql` | digitaler Ausbildungsnachweis (Schritt 8, nach `kommunikation.sql` ausführen) |
| `supabase/lehrer_erweiterung.sql` | Lehrer-Stundenplan und neue Aufgabenarten Training, Team-Krankenhaus, Live-Fall (Schritt 10) |
| `supabase/schulen.sql` | Mehrere Schulen: Trennung der Daten je Schule, Bereich „Schulen“ für die Administration (Schritt 11) |
| `supabase/live_unterricht.sql` | Live im Unterricht und Modul-Freischaltung (Schritt 12, nach `schulen.sql`) |
| `supabase/functions/folien-import/index.ts` | KI-Dienst für den Folien-Import (Supabase Edge Function, siehe unten) |

Ohne ausgefüllte `config.js` startet das Portal im Demo-Modus mit erfundenen Daten.
Die Schritt-für-Schritt-Anleitung steht im Dokument „Fallpfad Lehrer-Portal: Technische Anleitung“.

## Neu in dieser Version: Training „Kommunikation“

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

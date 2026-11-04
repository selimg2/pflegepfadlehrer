# Fallpfad Lehrer-Portal

Dieser Ordner ist eine eigene Website nur für Lehrkräfte und Praxisanleitende.

| Datei | Wofür |
|---|---|
| `index.html` | das komplette Lehrer-Portal |
| `config.js` | Verbindung zur Datenbank. Hier trägst du dieselben zwei Werte ein wie in der Schüler-App, dazu die Adresse der Schüler-App |
| `content.json` | alle 34 eingebauten Module als Daten, damit das Portal sie anzeigen und bearbeiten kann |
| `favicon.svg` | Symbol im Browser-Tab |
| `vercel.json` | sorgt dafür, dass Suchmaschinen das Portal nicht anzeigen |
| `supabase/lehrer_schema.sql` | Tabellen und Zugriffsrechte für Kurse, Module, Profile und Einladungen (einmal in Supabase ausführen) |
| `supabase/aufgaben.sql`, `live.sql`, `kurse_examen.sql`, `team.sql`, `kommunikation.sql` | weitere Funktionen, Reihenfolge siehe LIESMICH der Schüler-App |
| `supabase/nachweis.sql` | digitaler Ausbildungsnachweis (Schritt 8, nach `kommunikation.sql` ausführen) |
| `supabase/lehrer_erweiterung.sql` | Lehrer-Stundenplan und neue Aufgabenarten Training, Team-Krankenhaus, Live-Fall (Schritt 9, zuletzt ausführen) |

Ohne ausgefüllte `config.js` startet das Portal im Demo-Modus mit erfundenen Daten.
Die Schritt-für-Schritt-Anleitung steht im Dokument „Fallpfad Lehrer-Portal: Technische Anleitung“.

## Neu in dieser Version

- **Übersicht:** oben „Dein Unterricht heute“, darunter Schnellzugriff, dann die Benachrichtigungen, nach Thema gruppiert, filterbar und einzeln ausblendbar. Der Block Ausbildungsnachweis ist aus der Übersicht entfernt. Hinweise zu einem Einsatz verschwinden sieben Tage nach Einsatzende.
- **Keine roten „dringend“-Meldungen** mehr in Kurse & Schüler und im Ausbildungsnachweis. Was fehlt, steht dauerhaft und rot in der Schülerakte (Person > Überblick und Person > Dokumente).
- **Stundenplan:** oben „Stundenplan Lehrer“ für den eigenen Unterricht (eintragen oder aus Excel einfügen). Ein Klick auf eine Stunde öffnet die Planung: Lernziel, Ablauf mit Minuten, Material (Modul, Live-Fall, Team-Fall, Training, Notiz), direkt öffnen oder als Aufgabe stellen. Darunter einklappbar der „Stundenplan Schüler“.
- **Aufgaben:** zusätzlich Training, Team-Krankenhaus und Live-Fall.
- Etwas mehr Farbe und ein weniger eintöniger Dunkelmodus.

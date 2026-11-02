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

Ohne ausgefüllte `config.js` startet das Portal im Demo-Modus mit erfundenen Daten.
Die Schritt-für-Schritt-Anleitung steht im Dokument „Fallpfad Lehrer-Portal: Technische Anleitung“.

# Fallpfad: Rechtlicher Rahmen (Kurzrecherche, Stand 10.11.2026)

**Wichtig:** Das ist eine technische Einordnung, keine Rechtsberatung. Sie ersetzt nicht die Prüfung durch eine
Anwältin oder einen Anwalt und durch die Datenschutzbeauftragten der Schulen. Einige Angaben stammen aus
Sekundärquellen; vor Entscheidungen bitte den Gesetzestext prüfen.

Legende: ✅ technisch umgesetzt · ⚠️ teilweise, braucht dich · ❌ offen, nur du kannst es erledigen

## 1. Datenschutz (DSGVO, BDSG, Landesrecht)

| Thema | Stand | Was dahintersteht |
|---|---|---|
| Rechtsgrundlage | ⚠️ | Für Schulen meist das Schulgesetz des Landes (Art. 6 Abs. 1 lit. e DSGVO), nicht die Einwilligung. Einwilligung nur für Freiwilliges wie die Sprachsimulation. Je Bundesland prüfen |
| Auftragsverarbeitung (Art. 28) | ❌ | Die Schule ist Verantwortliche, du bist Auftragsverarbeiter. Nötig: AV-Vertrag Schule ↔ du, du ↔ Supabase, du ↔ OpenAI, du ↔ Vercel |
| Einwilligung unter 16 (Art. 8) | ⚠️ | Unter 16 müssen die Eltern einwilligen. Die App weist darauf hin, prüft das Alter aber nicht. Pflegeazubis sind meist älter; trotzdem regeln (z. B. über die Schule) |
| Nachweis der Einwilligung (Art. 7) | ✅ | Tabelle `fp_einwilligungen`, Widerruf in der App |
| Auskunft und Übertragbarkeit (Art. 15, 20) | ✅ | „Meine Daten herunterladen“, Funktion `fp_meine_daten` |
| Löschung (Art. 17), Löschfristen | ✅ / ⚠️ | Konto löschen und automatische Fristen sind gebaut. Aufbewahrungsfristen für den Ausbildungsnachweis nach Landesrecht festlegen |
| Drittland (Art. 44 ff.) | ⚠️ | Datenbank liegt in der Schweiz (Zürich, eu-central-2; Angemessenheitsbeschluss der EU). OpenAI verarbeitet ohne EU-Datenresidenz in den USA. Empfehlung: `OPENAI_BASE_URL=https://eu.api.openai.com/v1` |
| Datenschutz-Folgenabschätzung (Art. 35) | ❌ | Bei Stimmverarbeitung, KI-Auswertung und Daten von Lernenden sehr wahrscheinlich nötig. Erstellt die Schule mit deiner Zuarbeit |
| Verzeichnis, TOM (Art. 30, 32) | ⚠️ | Verarbeitungsübersicht gibt es im Lehrer-Portal. Technische Maßnahmen: RLS, CSP, HSTS, Größen- und Tageslimits |
| Gesundheitsdaten (Art. 9) | ⚠️ | Alle Patientinnen und Patienten sind erfunden. Fehlzeiten speichern nur Art und Stunden. Lernende dürfen keine echten Patientendaten eintragen (Hinweis in der App vorhanden) |

## 2. KI-Verordnung (EU AI Act)

| Thema | Stand | Was dahintersteht |
|---|---|---|
| Transparenz (Art. 50) | ✅ | Gilt seit 02.08.2026. Die App sagt vor jedem Gespräch, dass die Gesprächsperson eine KI ist; KI-erstellte Module sind gekennzeichnet |
| KI-Kompetenz (Art. 4) | ❌ | Gilt seit 02.02.2025: Wer KI einsetzt, muss sein Personal schulen. Kurze Einweisung für Lehrkräfte dokumentieren |
| Verbot Emotionserkennung in Bildungseinrichtungen (Art. 5) | ⚠️ | Verboten ist das Ableiten von Emotionen **aus biometrischen Daten** (z. B. Stimme). Die Auswertung bewertet nur den **Text** der Mitschrift der lernenden Person, nicht deren Stimme oder Gefühle. So lassen und nie Stimmlage oder Stimmung der Lernenden auswerten. Rechtlich bestätigen lassen |
| Hochrisiko (Anhang III Nr. 3, Bildung) | ⚠️ | KI, die Lernergebnisse bewertet, kann Hochrisiko sein. Pflichten laut Digital-Omnibus (VO 2026/1744) erst ab **02.12.2027**. Die Auswertung ist als Übungsrückmeldung gebaut, nicht als Note. Dabei bleiben: keine Noten, keine Zulassungsentscheidungen aus der KI-Auswertung |

## 3. Website und App

| Thema | Stand | Was dahintersteht |
|---|---|---|
| Impressum (§ 5 DDG) | ❌ | `impressum.html` hat noch Platzhalter in eckigen Klammern |
| Datenschutzerklärung (Art. 13) | ❌ | `datenschutz.html` ausfüllen; neu aufnehmen: Einwilligungsprotokoll, Datenauskunft, Vercel als Hoster |
| Endgerätezugriff (§ 25 TDDDG) | ✅ | Kein Tracking, keine Cookies von Dritten, alle Bibliotheken auf dem eigenen Server. Lokaler Speicher nur für die Funktion der App, daher kein Cookie-Banner nötig |
| Barrierefreiheit | ⚠️ | BFSG gilt seit 28.06.2025 für Verbraucherangebote; für öffentliche Schulen gelten BITV bzw. Landesgesetze. Verbessert: Tastaturfokus, Kontrast-, Bewegungs- und Transparenz-Einstellungen, Touch-Ziele. Ein vollständiger WCAG-2.1-AA-Test und eine Erklärung zur Barrierefreiheit fehlen |
| Urheberrecht | ⚠️ | Inhalte stützen sich auf DNQP-Expertenstandards, Leitlinien und Gesetze. Zusammenfassen und zitieren ist zulässig, längere wörtliche Übernahmen nicht. Quellenverzeichnisse sind vorhanden |

## 4. Vertrieb und Verträge

| Thema | Stand | Was dahintersteht |
|---|---|---|
| Fernunterrichtsschutzgesetz (FernUSG) | ⚠️ | Der BGH legt das Gesetz seit 2025 weit aus (auch B2B, weite Auslegung der Lernkontrolle). Entgeltliche, überwiegend zeitversetzte Lernangebote mit Lernerfolgskontrolle können eine ZFU-Zulassung brauchen; ohne sie ist der Vertrag nichtig. Als Werkzeug, das Schulen im eigenen Unterricht einsetzen, ist das Risiko geringer als beim Direktverkauf an Lernende. **Vor dem Verkauf anwaltlich klären** |
| Verbraucherrecht | ⚠️ | Nur bei Verkauf an Privatpersonen: Widerrufsbelehrung, Kündigungsbutton (§ 312k BGB), Preisangaben |
| Ausbildungsnachweis (PflBG, PflAPrV) | ❌ | Von der zuständigen Landesbehörde schriftlich bestätigen lassen, dass der elektronische Nachweis mit einfacher elektronischer Unterschrift anerkannt wird |
| App Stores | ✅ | Konto löschen in der App und per Webseite vorhanden |

## Die fünf wichtigsten nächsten Schritte

1. Impressum und Datenschutzerklärung ausfüllen und anwaltlich prüfen lassen.
2. AV-Verträge abschließen (Supabase, OpenAI, Vercel) und ein Muster für Schulen bereithalten.
3. OpenAI auf EU-Datenresidenz umstellen.
4. FernUSG und KI-Verordnung (Art. 5, Anhang III) einmal anwaltlich einordnen lassen, bevor du verkaufst.
5. Datenschutz-Folgenabschätzung mit der ersten Pilotschule erstellen.

## Quellen

- [Gibson Dunn: EU AI Act Omnibus Agreement](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)
- [Usercentrics: Digital Omnibus in Kraft, Art. 50](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/)
- [dejure.org: Art. 5 KI-Verordnung](https://dejure.org/gesetze/KI-Verordnung/5.html)
- [ADVANT Beiten: KI-Verordnung, Pflichten ab 02.02.2025](https://www.advant-beiten.com/aktuelles/die-ki-verordnung-anwendung-ab-dem-2-februar-2025-und-damit-verbundene-pflichten)
- [Berliner Datenschutzbeauftragte: Hinweise Lernplattformen](https://www.datenschutz-berlin.de/fileadmin/user_upload/pdf/dokumente/2020-BlnBDI_Hinweise-Lernplattformen.pdf)
- [Niedersachsen: Kooperationsplattformen in Schulen](https://datenschutz.nibis.de/files/Kooperationsplattformen-2023-10-05-komplett-final.pdf)
- [Taylor Wessing: BGH erweitert Anwendungsbereich des FernUSG](https://www.taylorwessing.com/de/insights-and-events/insights/2025/09/bgh-erweitert-anwendungsbereich-des-fernusg)
- [beck-aktuell: BGH grenzt Fernunterricht neu ab](https://www.beck-aktuell.de/heute-im-recht/rechtsprechung/live-statt-asynchron-bgh-fernunterricht-online-coaching-2026-03-04)
- [Heuking: weite Auslegung der Lernkontrolle](https://www.heuking.de/de/news-events/newsletter-fachbeitraege/artikel/bgh-bestaetigt-weite-auslegung-des-erfordernisses-einer-lernkontrolle-fuer-die-anwendbarkeit-des-fernunterrichtsschutzgesetzes-fernusg.html)

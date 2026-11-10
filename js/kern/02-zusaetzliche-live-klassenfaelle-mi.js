/* Zusätzliche Live-Klassenfälle mit Vitalzeichen (Format wie die eingebauten Fälle) */
window.FP_EXTRA_CASES = [
  {
    id: "nachblut", t: "Der Verband wird immer dicker", kurz: "Postoperative Nachblutung nach Hüft-TEP", lvl: "Jahr 2", ber: "Akutpflege",
    p: { name: "Gerda Lindemann", alter: 76, sex: "w", station: "Unfallchirurgie, Zimmer 7", diag: "Hüft-TEP rechts (OP heute, 11 Uhr)", allergie: "keine bekannt", anam: "Vorhofflimmern, Apixaban bis vor zwei Tagen pausiert. Redon-Drainage rechts." },
    v: { hf: 84, rrs: 132, rrd: 78, af: 16, spo2: 96, temp: 36.6, bz: 128, gcs: 15, schmerz: 3, o2: "Raumluft" },
    labs: [["hb", "Hämoglobin", 11.2, "g/dl", 12, 16]], akte: ["14:00 Rückverlegung aus dem Aufwachraum, Verband trocken, Redon 50 ml."],
    steps: [
      { t: "17:30", sit: "Frau Lindemann klagt über zunehmende Schmerzen in der Hüfte. Der Verband ist großflächig durchgeblutet, in der Redonflasche sind 350 ml.", v: { hf: 104, rrs: 112, rrd: 66, schmerz: 6 }, akte: "17:30 Verband durchgeblutet, Redon 350 ml.", q: "Was tust du zuerst?", multi: true,
        opts: [["Vitalzeichen engmaschig kontrollieren und die Ärztin sofort informieren", true, "Steigender Puls und fallender Blutdruck bei sichtbarer Blutung sind Warnzeichen.", { a: "17:32 Ärztin informiert." }], ["Verband nicht abnehmen, sondern zusätzlich komprimierend überwickeln", true, "Den Verband belassen und markieren, damit die Ärztin den Verlauf sieht.", {}], ["Das Bein hochlagern und ein Schmerzmittel aus dem Schrank geben", false, "Medikamente nur nach Anordnung. Die Ursache der Schmerzen muss erst geklärt werden.", { v: { hf: 6 } }], ["Die Redondrainage abklemmen, damit weniger Blut verloren geht", false, "Abklemmen ist ärztliche Entscheidung und kann zu einem Hämatom führen.", { v: { schmerz: 2 } }]],
        exp: "Bei einer Nachblutung zählen Kreislaufüberwachung, Information der Ärztin und das Bereitstellen von Material. Das Ausmaß wird dokumentiert, z. B. Verband umranden und Uhrzeit notieren." },
      { t: "17:45", sit: "Frau Lindemann wird blass, kaltschweißig und unruhig. Sie sagt, ihr sei schwindelig.", v: { hf: 124, rrs: 92, rrd: 54, af: 22, spo2: 94 }, akte: "17:45 Blässe, Kaltschweißigkeit, Schwindel.", q: "Wie deutest du die Situation?",
        opts: [["Beginnender hypovolämischer Schock", true, "Tachykardie, Hypotonie, Blässe und Unruhe zeigen einen Volumenmangel.", {}], ["Eine typische Reaktion auf die Narkose", false, "Die Werte verschlechtern sich zu deutlich für eine Narkosenachwirkung.", {}], ["Eine Lungenembolie, sicher", false, "Möglich, aber die sichtbare Blutung erklärt das Bild besser.", {}]],
        exp: "Der Schockindex (Puls geteilt durch systolischen Blutdruck) liegt über 1. Das ist ein Hinweis auf einen relevanten Blutverlust." },
      { t: "17:47", sit: "Die Ärztin ist auf dem Weg. Sie ordnet am Telefon eine Infusion und ein Blutbild an.", v: {}, akte: "17:47 Telefonische Anordnung: Vollelektrolytlösung 500 ml, Blutbild, Kreuzblut.", q: "Welche Maßnahmen übernimmst du?", multi: true,
        opts: [["Schocklagerung: Beine hoch, Oberkörper flach, sofern die Hüftlagerung es erlaubt", true, "Das verbessert den Rückfluss zum Herzen. Die Hüfte dabei nicht in eine verbotene Position bringen.", { v: { rrs: 6 } }], ["Infusion nach Anordnung vorbereiten und mit der Pflegefachperson anhängen", true, "Infusionen nach Anordnung, als Auszubildende gemeinsam mit einer Pflegefachperson.", { v: { rrs: 10, hf: -8 } }], ["Blutentnahme vorbereiten und Kreuzblutröhrchen beschriften", true, "Für eine mögliche Transfusion wird Kreuzblut gebraucht.", {}], ["Frau Lindemann allein lassen und den Notfallwagen holen", false, "Bei instabilen Personen bleibst du und lässt Material bringen.", { v: { hf: 6 } }]],
        exp: "Volumengabe nach Anordnung, Schocklagerung und Vorbereitung einer Transfusion sind die nächsten Schritte." },
      { t: "19:00", sit: "Nach Infusion und einer Bluttransfusion ist Frau Lindemann stabiler. Sie fragt, ob das wieder passieren kann.", v: { hf: 92, rrs: 118, rrd: 70, af: 17, spo2: 96 }, akte: "19:00 Kreislauf stabil, Verband markiert, keine weitere Zunahme.", q: "Was ist jetzt wichtig?",
        opts: [["Engmaschige Kontrollen fortsetzen, Verband und Drainage beobachten, ihr die Situation ruhig erklären", true, "Sicherheit entsteht durch Information und weitere Überwachung.", {}], ["Ihr sagen, dass jetzt alles vorbei ist", false, "Keine Versprechen, die du nicht halten kannst.", {}], ["Sie sofort an die Bettkante mobilisieren", false, "Erst nach ärztlicher Freigabe und stabilem Kreislauf.", {}]],
        exp: "Nach einer Nachblutung bleibt die Überwachung engmaschig. Antikoagulation wird ärztlich neu bewertet." }
    ]
  },
  {
    id: "oedem", t: "Rasseln in der Nacht", kurz: "Akutes Lungenödem bei Herzinsuffizienz", lvl: "Jahr 2", ber: "Innere Medizin",
    p: { name: "Klaus Behrens", alter: 81, sex: "m", station: "Kardiologie, Zimmer 3", diag: "Dekompensierte Herzinsuffizienz", allergie: "keine bekannt", anam: "Herzinsuffizienz NYHA III, Hypertonie. Furosemid morgens. Abends zwei Teller Suppe gegessen." },
    v: { hf: 92, rrs: 168, rrd: 96, af: 20, spo2: 93, temp: 36.7, bz: 138, gcs: 15, schmerz: 0, o2: "Raumluft" },
    labs: [["ntprobnp", "NT-proBNP", 4800, "pg/ml", 0, 450]], akte: ["21:00 Gewicht heute 2,1 kg mehr als vor drei Tagen."],
    steps: [
      { t: "02:15", sit: "Herr Behrens klingelt. Er sitzt aufrecht, ringt nach Luft und hustet schaumiges Sekret. Man hört ein Brodeln bei jedem Atemzug.", v: { hf: 118, rrs: 186, rrd: 104, af: 32, spo2: 84 }, akte: "02:15 Akute Atemnot, brodelndes Atemgeräusch, schaumiges Sputum.", q: "Was tust du in den ersten zwei Minuten?", multi: true,
        opts: [["Oberkörper hoch, Beine tief lagern (Herzbettlage)", true, "Das senkt den Rückstrom zum Herzen und entlastet die Lunge.", { v: { spo2: 2 } }], ["Notruf, Ärztin und Hilfe holen", true, "Ein akutes Lungenödem ist lebensbedrohlich.", { a: "02:16 Notfallteam alarmiert." }], ["Sauerstoff nach Notfallstandard geben", true, "Die Sättigung ist kritisch niedrig.", { v: { spo2: 6, o2: "10 l/min Maske" } }], ["Ein großes Glas Wasser zum Abhusten anbieten", false, "Zusätzliche Flüssigkeit belastet das Herz weiter, außerdem besteht Aspirationsgefahr.", { v: { spo2: -2 } }]],
        exp: "Herzbettlage, Sauerstoff und schnelle Alarmierung sind die ersten Maßnahmen beim kardialen Lungenödem." },
      { t: "02:20", sit: "Die Ärztin ordnet Furosemid i. v. und Nitro-Spray an. Herr Behrens ist sehr ängstlich.", v: { hf: 110, af: 28, spo2: 90 }, akte: "02:20 Furosemid 40 mg i. v., Nitro 2 Hübe nach Anordnung.", q: "Was beachtest du bei der Gabe von Nitro-Spray?",
        opts: [["Vorher Blutdruck messen, danach engmaschig kontrollieren", true, "Nitro senkt den Blutdruck. Bei niedrigen Werten ist es gefährlich.", {}], ["Nur geben, wenn der Puls unter 60 ist", false, "Entscheidend ist vor allem der Blutdruck.", {}], ["Es kann auch ohne ärztliche Anordnung gegeben werden", false, "Nitro wird nach Anordnung gegeben.", {}]],
        exp: "Vor Nitro immer den Blutdruck kontrollieren. Ein systolischer Wert unter etwa 90 bis 100 mmHg spricht dagegen." },
      { t: "03:30", sit: "Herr Behrens hat 900 ml Urin ausgeschieden. Die Atmung ist ruhiger.", v: { hf: 94, rrs: 142, rrd: 84, af: 22, spo2: 94, o2: "4 l/min Nasenbrille" }, akte: "03:30 Diurese 900 ml, Atmung ruhiger.", q: "Was dokumentierst und beobachtest du jetzt?", multi: true,
        opts: [["Ein- und Ausfuhr bilanzieren", true, "Die Bilanz zeigt, ob die Entwässerung wirkt.", {}], ["Kalium im Blick behalten (Laborkontrolle nach Anordnung)", true, "Furosemid kann Kalium senken und Herzrhythmusstörungen auslösen.", {}], ["Morgen früh nüchtern wiegen", true, "Das Gewicht ist der beste Verlaufsparameter.", {}], ["Bettruhe für eine Woche", false, "Mobilisation erfolgt schrittweise nach Stabilisierung.", {}]],
        exp: "Bilanz, Gewicht, Elektrolyte und Atmung zeigen, ob die Behandlung wirkt." },
      { t: "Zwei Tage später", sit: "Vor der Entlassung fragt Herr Behrens, warum das passiert ist.", v: { hf: 78, rrs: 128, rrd: 76, af: 16, spo2: 96, o2: "Raumluft" }, akte: "Entlassungsgespräch.", q: "Welche Beratung ist am wichtigsten?",
        opts: [["Tägliches Wiegen, Trinkmenge nach Absprache, Warnzeichen kennen und Medikamente regelmäßig nehmen", true, "Selbstmanagement verhindert erneute Dekompensationen.", {}], ["Nie wieder Suppe essen", false, "Wichtig sind Salz- und Flüssigkeitsmenge insgesamt, kein striktes Verbot.", {}], ["Bei Atemnot erst einmal abwarten", false, "Bei Atemnot in Ruhe sofort Hilfe holen.", {}]],
        exp: "Gewichtszunahme über 2 kg in drei Tagen ist ein Signal, die Hausärztin anzurufen." }
    ]
  },
  {
    id: "fieberkrampf", t: "Fieber und Zuckungen", kurz: "Fieberkrampf bei einem Kleinkind", lvl: "Jahr 3", ber: "Pädiatrie",
    p: { name: "Mia Hoffmann", alter: 2, sex: "w", station: "Kinderstation K2, Zimmer 5", diag: "Fieberhafter Infekt der oberen Luftwege", allergie: "keine bekannt", anam: "Seit gestern Fieber bis 39,5 °C. Bisher gesund. Mutter bleibt über Nacht." },
    v: { hf: 150, rrs: 98, rrd: 60, af: 32, spo2: 97, temp: 39.4, bz: 92, gcs: 15, schmerz: 2, o2: "Raumluft" },
    labs: [], akte: ["18:00 Fieber 39,4 °C, trinkt wenig."],
    steps: [
      { t: "19:10", sit: "Die Mutter ruft panisch. Mia ist nicht ansprechbar, Arme und Beine zucken rhythmisch, die Lippen sind leicht bläulich.", v: { hf: 170, af: 40, spo2: 89, gcs: 7 }, ekg: "sinustachy", akte: "19:10 Generalisierter Krampfanfall.", q: "Was tust du?", multi: true,
        opts: [["Uhrzeit merken und Hilfe rufen", true, "Die Anfallsdauer entscheidet über die Behandlung.", { a: "19:10 Notfallknopf gedrückt." }], ["Verletzungen verhindern: Gegenstände weg, Kopf polstern", true, "Während des Anfalls schützen, nicht festhalten.", {}], ["Etwas zwischen die Zähne schieben, damit sie sich nicht auf die Zunge beißt", false, "Gefährlich: Verletzungen und Aspiration. Niemals etwas in den Mund.", { v: { spo2: -3 } }], ["Sauerstoff vorhalten, sobald möglich", true, "Die Sättigung ist erniedrigt.", { v: { spo2: 4 } }]],
        exp: "Bei einem Krampfanfall schützt du, beobachtest und misst die Zeit. Nichts in den Mund stecken, nicht festhalten." },
      { t: "19:13", sit: "Der Anfall dauert jetzt drei Minuten. Die Ärztin ist da.", v: { hf: 165, spo2: 92 }, akte: "19:13 Anfall seit 3 Minuten.", q: "Ab wann spricht man meist von einem behandlungsbedürftigen, verlängerten Anfall?",
        opts: [["nach etwa 5 Minuten", true, "Ab etwa 5 Minuten wird medikamentös durchbrochen, z. B. mit Midazolam nach Anordnung.", {}], ["nach etwa 30 Sekunden", false, "Einfache Fieberkrämpfe dauern meist weniger als 5 Minuten.", {}], ["erst nach 30 Minuten", false, "Viel zu spät.", {}]],
        exp: "Die meisten Fieberkrämpfe enden von selbst in wenigen Minuten. Nach etwa 5 Minuten wird ärztlich behandelt." },
      { t: "19:15", sit: "Der Anfall hört auf. Mia ist schläfrig und atmet regelmäßig.", v: { hf: 146, af: 30, spo2: 96, gcs: 12, o2: "2 l/min vorgehalten" }, akte: "19:15 Anfall sistiert nach 5 Minuten, postiktal schläfrig.", q: "Wie lagerst und beobachtest du Mia jetzt?",
        opts: [["Stabile Seitenlage, Atmung, Bewusstsein und Temperatur engmaschig kontrollieren", true, "Nach dem Anfall Atemwege freihalten und beobachten.", {}], ["Aufsetzen und zum Trinken bringen", false, "Aspirationsgefahr, solange sie schläfrig ist.", {}], ["In eine kalte Badewanne legen, um das Fieber zu senken", false, "Kalte Bäder sind gefährlich und unangenehm. Fiebersenkung nach Anordnung.", {}]],
        exp: "Postiktal ist die Seitenlage sicher. Fieber wird nach Anordnung gesenkt, aber Fiebersenkung verhindert Fieberkrämpfe nicht sicher." },
      { t: "20:00", sit: "Die Mutter weint und fragt, ob Mia jetzt Epilepsie hat.", v: { gcs: 15, temp: 38.6 }, akte: "20:00 Wach, Mutter sehr besorgt.", q: "Was antwortest du?",
        opts: [["Ruhig erklären, dass Fieberkrämpfe bei Kleinkindern häufig sind und meist ohne Folgen bleiben, und die Ärztin das Gespräch vertiefen lassen", true, "Information und Zuwendung helfen der Mutter.", {}], ["„Das kann ich nicht sagen.“", false, "Zu knapp. Die Mutter braucht Orientierung.", {}], ["„Ja, das ist der Beginn einer Epilepsie.“", false, "Falsch. Ein einfacher Fieberkrampf bedeutet keine Epilepsie.", {}]],
        exp: "Etwa 2 bis 5 von 100 Kindern haben einmal einen Fieberkrampf. Eltern brauchen Erklärung und einen Notfallplan." }
    ]
  },
  {
    id: "sht", t: "Nur eine kleine Platzwunde", kurz: "Sturz unter Antikoagulation mit verzögerter Hirnblutung", lvl: "Jahr 1", ber: "Langzeitpflege",
    p: { name: "Werner Kuhn", alter: 84, sex: "m", station: "Pflegeheim, Wohnbereich 2", diag: "Zustand nach Sturz, Vorhofflimmern", allergie: "Pflaster", anam: "Nimmt Rivaroxaban. Leichte Demenz, sonst gut orientiert. Gestürzt um 15 Uhr, Platzwunde am Hinterkopf, versorgt." },
    v: { hf: 78, rrs: 142, rrd: 84, af: 16, spo2: 96, temp: 36.5, bz: 112, gcs: 15, schmerz: 2, o2: "Raumluft" },
    labs: [], akte: ["15:10 Sturz, Platzwunde 1 cm okzipital, Hausarzt informiert: Beobachtung im Heim."],
    steps: [
      { t: "18:00", sit: "Herr Kuhn isst kaum zu Abend und sagt, er habe Kopfschmerzen. Er ist etwas langsamer als sonst.", v: { schmerz: 4 }, akte: "18:00 Kopfschmerzen, verlangsamt.", q: "Wie schätzt du das ein?",
        opts: [["Warnzeichen: unter Blutverdünner nach Kopfverletzung kann sich eine Hirnblutung langsam entwickeln", true, "Antikoagulierte Menschen brauchen nach Kopfanprall besondere Wachsamkeit.", {}], ["Er ist einfach müde vom Tag", false, "Gefährliche Verharmlosung.", {}], ["Kopfschmerzen sind nach einer Platzwunde normal, keine Kontrolle nötig", false, "Neue oder zunehmende Beschwerden müssen abgeklärt werden.", {}]],
        exp: "Kopfschmerz, Verlangsamung und Appetitlosigkeit können frühe Zeichen eines Hämatoms sein." },
      { t: "18:05", sit: "Du prüfst Bewusstsein und Pupillen. Die rechte Pupille ist etwas weiter als die linke und reagiert träge.", v: { gcs: 13, rrs: 168, rrd: 90, hf: 62 }, akte: "18:05 GCS 13, Pupillendifferenz rechts > links.", q: "Was tust du?",
        opts: [["Notruf 112, bei ihm bleiben, Vitalzeichen und Bewusstsein weiter kontrollieren, Medikamentenplan bereitlegen", true, "Eine Pupillendifferenz ist ein Notfallzeichen.", { a: "18:06 Notruf." }], ["Den Hausarzt morgen früh anrufen", false, "Viel zu spät.", { v: { gcs: -2 } }], ["Eine Schmerztablette geben und ins Bett legen", false, "Verschleiert Symptome und verzögert Hilfe.", { v: { gcs: -2 } }]],
        exp: "Steigender Blutdruck, fallender Puls und eine Pupillendifferenz sprechen für steigenden Hirndruck." },
      { t: "18:12", sit: "Der Rettungsdienst ist unterwegs. Herr Kuhn erbricht im Liegen.", v: { gcs: 12 }, akte: "18:12 Erbrechen.", q: "Wie lagerst du ihn?",
        opts: [["Seitenlage mit leicht erhöhtem Oberkörper, Mund reinigen, Atemwege freihalten", true, "Schützt vor Aspiration.", {}], ["Flach auf den Rücken", false, "Aspirationsgefahr.", {}], ["Aufsetzen und laufen lassen", false, "Sturz- und Aspirationsgefahr.", {}]],
        exp: "Bei Bewusstseinsstörung und Erbrechen hat die Sicherung der Atemwege Vorrang." },
      { t: "18:20", sit: "Du übergibst an den Rettungsdienst.", v: {}, akte: "18:20 Übergabe Rettungsdienst.", q: "Was gehört in deine Übergabe?", multi: true,
        opts: [["Sturzzeitpunkt und Verletzung", true, "Zeitverlauf ist entscheidend.", {}], ["Antikoagulans mit letzter Einnahme", true, "Wichtig für die Behandlung der Blutung.", {}], ["Verlauf von Bewusstsein und Pupillen", true, "Zeigt die Dynamik.", {}], ["Seine Lieblingsserie im Fernsehen", false, "Nicht relevant für die Notfallübergabe.", {}]],
        exp: "Eine strukturierte Übergabe nach ISBAR mit Zeitpunkten und Medikation spart wertvolle Zeit." }
    ]
  }
];

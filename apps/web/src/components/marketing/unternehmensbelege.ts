/**
 * Was zum Recruiting belegt ist — und was daraus NICHT folgt.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Regel für diese Datei
 * ══════════════════════════════════════════════════════════════
 *
 * Diese Studien belegen **Probleme** und **welche Methoden wirken**.
 * Sie belegen nicht, dass Monday bessere Einstellungen erzeugt — das
 * kann keine fremde Studie, weil keine sie untersucht hat.
 *
 * Der Unterschied ist der ganze Wert dieser Seite. „16 Bewerbungen je
 * Einstellung, davon vier geeignet" ist eine Messung des IAB. „Monday
 * verdreifacht die Trefferquote" wäre eine Erfindung mit einer echten
 * Zahl daneben — und genau die Sorte Aussage, gegen die dieses Produkt
 * gebaut ist.
 *
 * Eigene Erfolgsquoten kommen erst nach Pilotkunden und eigener
 * Messung, mit Grundgesamtheit und Erhebungszeitraum. Bis dahin steht
 * hier nichts über Monday, was nicht auch ohne Monday wahr wäre.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Einschränkungen mitgeführt werden
 * ══════════════════════════════════════════════════════════════
 *
 * Jeder Befund trägt `grenze` — was er NICHT zeigt. Ein Feldexperiment
 * über Rückrufquoten in den USA sagt nichts über deutsche
 * Personalabteilungen; eine rechnerische Fachkräftelücke ist keine
 * Zählung offener Stellen. Wer diese Sätze weglässt, macht aus
 * Forschung Werbung.
 */

export type Befund = {
  quelle: string;
  jahr: string;
  erkenntnis: string;
  /** Was dieser Befund ausdrücklich nicht zeigt. */
  grenze?: string;
};

export type Belegfeld = {
  id: string;
  titel: string;
  /** Was das Problem ist — in einem Satz, ohne Produktbezug. */
  problem: string;
  /** Woran Monday daraufhin gebaut ist. Kein Wirkungsversprechen. */
  antwort: string[];
  belege: Befund[];
};

/**
 * Die drei Zahlen über der Falz.
 *
 * Bewusst drei und nicht dreissig: Eine Wand aus Prozentzahlen liest
 * niemand, und sie wirkt weniger glaubwürdig, nicht mehr. Alles
 * Weitere steht unter „Studien und Methodik".
 */
export const KENNZAHLEN: { zahl: number; einheit: string; text: string; quelle: string }[] = [
  {
    zahl: 28,
    einheit: " %",
    text: "der eingegangenen Bewerbungen galten als grundsätzlich geeignet — vier von sechzehn.",
    quelle: "IAB-Stellenerhebung 2025",
  },
  {
    zahl: 86,
    einheit: " Tage",
    text: "dauerte eine Stellenbesetzung im Schnitt — rund 25 Tage länger als gewünscht.",
    quelle: "IAB-Arbeitsmarktmonitor 2025",
  },
  {
    zahl: 357091,
    einheit: "",
    text: "Stellen für qualifizierte Arbeitskräfte liessen sich rechnerisch nicht passend besetzen.",
    quelle: "KOFA-Fachkräftelücke",
  },
];

export const FELDER: Belegfeld[] = [
  {
    id: "matching",
    titel: "Fachkräftemangel und schlechtes Matching",
    problem:
      "Es kommen genug Bewerbungen an. Passen tut ein Bruchteil — und die Lücke liegt zwischen Qualifikation, Beruf und Region, nicht in der Menge.",
    antwort: [
      "Monday sucht dauerhaft in neuen und aktualisierten Profilen, nicht nur beim Eingang einer Bewerbung.",
      "Sie trennt echte Muss-Kriterien von Fähigkeiten, die erlernbar sind.",
      "Der Fit Score zeigt passende Fähigkeiten, Lücken, unbekannte Angaben und die Datengrundlage — nicht nur eine Zahl.",
      "Arbeitszeit, Gehalt, Standort, Remote-Modell, Sprache, Reisebereitschaft und Verfügbarkeit gehen mit ein.",
      "Mit Einwilligung verbindet sie passende Menschen auch ohne vorliegende Bewerbung.",
    ],
    belege: [
      {
        quelle: "IAB-Stellenerhebung",
        jahr: "2025",
        erkenntnis:
          "Unternehmen erhielten durchschnittlich 16 Bewerbungen je Einstellung, hielten aber nur vier — 28 % — für grundsätzlich geeignet.",
        grenze: "Eignung ist eine Selbsteinschätzung der Betriebe, keine geprüfte Passung.",
      },
      {
        quelle: "IAB: Wege der Stellenbesetzung",
        jahr: "2025",
        erkenntnis:
          "Digitale Recruitingkanäle kamen bei 82 % der Einstellungen zum Einsatz, waren aber nur bei 52 % entscheidend. Persönliche Kontakte blieben wichtig.",
      },
      {
        quelle: "IAB-Arbeitsmarktmonitor",
        jahr: "2025",
        erkenntnis:
          "Eine Stellenbesetzung dauerte durchschnittlich 86 Tage — rund 25 Tage länger als der gewünschte Arbeitsbeginn.",
      },
      {
        quelle: "Bundesagentur für Arbeit",
        jahr: "2025",
        erkenntnis: "157 Engpassberufe wurden identifiziert.",
        grenze:
          "Die BA betont ausdrücklich, dass kein flächendeckender Mangel über alle Berufe hinweg besteht.",
      },
      {
        quelle: "KOFA-Fachkräftelücke",
        jahr: "2025",
        erkenntnis:
          "Rechnerisch konnten 357.091 Stellen für qualifizierte Arbeitskräfte nicht passend besetzt werden — ein Hinweis auf Qualifikations-, Berufs- und Regionalmismatch.",
        grenze:
          "Eine rechnerische Lücke, keine Zählung tatsächlich unbesetzter Stellen.",
      },
      {
        quelle: "DIHK-Fachkräftereport",
        jahr: "2025/26",
        erkenntnis:
          "36 % der befragten Unternehmen konnten offene Stellen zumindest teilweise nicht besetzen; 83 % erwarteten negative Folgen.",
      },
      {
        quelle: "DIHK-Ausbildungsumfrage",
        jahr: "2026",
        erkenntnis:
          "49 % konnten nicht alle Ausbildungsplätze besetzen. Rund zwei Drittel dieser Betriebe berichteten von ungeeigneten Bewerbungen.",
      },
      {
        quelle: "BIBB-Ausbildungsmarkt",
        jahr: "2025",
        erkenntnis:
          "54.400 Ausbildungsstellen blieben unbesetzt, während 84.400 junge Menschen weiter suchten — ein Matchingwiderspruch.",
      },
      {
        quelle: "KfW-ifo-Fachkräftebarometer",
        jahr: "2025",
        erkenntnis:
          "21,1 % der Unternehmen sahen ihre Geschäftstätigkeit durch fehlende Fachkräfte behindert; in einigen Branchen deutlich mehr.",
      },
      {
        quelle: "KfW-Mittelstandspanel",
        jahr: "2025",
        erkenntnis:
          "58 % der mittelständischen Unternehmen erwarten in den kommenden fünf Jahren Probleme bei der Stellenbesetzung. Grundlage: 2.494 repräsentativ ausgewählte Mittelständler.",
      },
    ],
  },
  {
    id: "filter",
    titel: "Gute Menschen werden durch Lebenslauf und Filter übersehen",
    problem:
      "Rückrufentscheidungen hängen messbar an Merkmalen, die mit der Aufgabe nichts zu tun haben — und starre Anforderungen schliessen Menschen aus, die die Arbeit könnten.",
    antwort: [
      "Im Fit Score zählen nachweisbare, jobrelevante Fähigkeiten. Name, Foto, Alter, Geschlecht, Herkunft und andere geschützte Merkmale gehen nicht ein.",
      "Ausländische Berufsbezeichnungen und alternative Wege werden in übertragbare Fähigkeiten übersetzt.",
      "Fehlende Angaben gelten als unbekannt, nicht als Ausschluss.",
      "Monday unterscheidet zwischen erfüllt, teilweise erfüllt, erlernbar und nicht passend.",
      "Unternehmen sehen, welche Bestandteile den Wert beeinflussen. Die Entscheidung bleibt beim Menschen.",
    ],
    belege: [
      {
        quelle: "Bertrand & Mullainathan, American Economic Review",
        jahr: "2004",
        erkenntnis:
          "Im Feldexperiment erhielten identische Lebensläufe mit als weiss wahrgenommenen Namen rund 50 % mehr Rückmeldungen als solche mit afroamerikanisch wahrgenommenen Namen.",
        grenze: "US-amerikanischer Arbeitsmarkt, nicht auf Deutschland übertragbar.",
      },
      {
        quelle: "Oreopoulos, American Economic Journal",
        jahr: "2011",
        erkenntnis:
          "Rund 13.000 experimentell versendete Bewerbungen zeigten deutliche Rückrufunterschiede aufgrund von Namen und ausländischer Berufserfahrung.",
      },
      {
        quelle: "Kroft, Lange & Notowidigdo, Quarterly Journal of Economics",
        jahr: "2013",
        erkenntnis:
          "Ein längerer Zeitraum ohne Beschäftigung senkte die Rückrufwahrscheinlichkeit — unabhängig von individuell geprüfter Eignung.",
      },
      {
        quelle: "Blair et al., STARs",
        jahr: "2020",
        erkenntnis:
          "Millionen Menschen ohne Hochschulabschluss verfügen über Fähigkeiten für besser bezahlte Tätigkeiten, werden durch Abschlussanforderungen aber häufig nicht berücksichtigt.",
      },
      {
        quelle: "Harvard Business School: Hidden Workers",
        jahr: "2021",
        erkenntnis:
          "Starre Recruitingprozesse schliessen geeignete Hidden Workers systematisch aus dem Bewerberpool aus.",
      },
      {
        quelle: "HBS / Burning Glass: Skills-Based Hiring",
        jahr: "2022",
        erkenntnis:
          "Viele Unternehmen entfernten Abschlussanforderungen aus Anzeigen, änderten ihr tatsächliches Einstellungsverhalten aber kaum.",
        grenze:
          "Zeigt, dass eine geänderte Anzeige allein nichts bewirkt — die Praxis muss folgen.",
      },
      {
        quelle: "Hoffman, Kahn & Li, Quarterly Journal of Economics",
        jahr: "2018",
        erkenntnis:
          "Ein objektiverer Eignungstest verbesserte Entscheidungen; häufiges Überstimmen der Empfehlung durch Führungskräfte führte nicht zu besseren Ergebnissen.",
      },
      {
        quelle: "Kuncel et al., Metaanalyse",
        jahr: "2013",
        erkenntnis:
          "Regelgebundene Kombinationen von Informationen schnitten bei Personalentscheidungen im Schnitt besser ab als rein intuitive Gesamturteile.",
      },
      {
        quelle: "Levashina et al., Personnel Psychology",
        jahr: "2014",
        erkenntnis:
          "Strukturierte Interviews mit identischen, arbeitsbezogenen Fragen und klaren Bewertungsskalen sind zuverlässiger als freie Gespräche.",
      },
      {
        quelle: "Raghavan et al., FAT*",
        jahr: "2020",
        erkenntnis:
          "Eine Analyse von 18 Anbietern algorithmischer Recruitinglösungen zeigt: Automatisierung ist nicht automatisch fair. Datenbasis, Zielgrösse, Prüfung und Transparenz bleiben entscheidend.",
        grenze:
          "Gilt auch für uns. Deshalb steht die Zusammensetzung des Fit Score offen und die Entscheidung beim Menschen.",
      },
    ],
  },
  {
    id: "fehlbesetzung",
    titel: "Fehlbesetzungen, geringe Passung und frühe Kündigungen",
    problem:
      "Ob eine Einstellung hält, entscheidet sich an Passung — und die lässt sich zumindest teilweise vorher erkennen.",
    antwort: [
      "Monday rechnet keine „perfekte Passung“, sondern getrennte Bereiche: Aufgaben, Fähigkeiten, Arbeitsbedingungen, Entwicklung und Erwartungen.",
      "Unternehmen sehen Übereinstimmungen und mögliche Konflikte nebeneinander.",
      "Gehalt, Arbeitszeit, Remote-Regelung, Reiseanteil, Führung, Team und Entwicklung werden vor dem Kontakt sichtbar.",
      "Fehlt eine wichtige Angabe, schlägt Monday die Nachfrage vor, statt zu raten.",
    ],
    belege: [
      {
        quelle: "Mühlbauer & Weber, IAB",
        jahr: "2022",
        erkenntnis:
          "Deutsche Beschäftigungsdaten zeigen, dass sich die Qualität eines Jobmatches anhand von Stabilität und Lohnentwicklung zumindest teilweise prognostizieren lässt.",
      },
      {
        quelle: "Cornelißen, SOEP",
        jahr: "2009",
        erkenntnis:
          "Aufgabenvielfalt, Beziehungen, Führung und Arbeitsplatzsicherheit gehören zu den wichtigen Faktoren der Arbeitszufriedenheit.",
      },
      {
        quelle: "Cedefop Skills Survey",
        jahr: "2015",
        erkenntnis:
          "Rund 39 % der untersuchten Beschäftigten waren in geringwertigen Stellen überqualifiziert oder konnten ihre Fähigkeiten nicht ausreichend nutzen.",
      },
      {
        quelle: "Eurofound",
        jahr: "2024",
        erkenntnis:
          "Viele europäische Unternehmen kämpfen mit fehlenden Fähigkeiten und stellen gleichzeitig Menschen ein, deren Kenntnisse nicht vollständig passen.",
      },
      {
        quelle: "Kristof-Brown et al., Metaanalyse",
        jahr: "2005",
        erkenntnis:
          "Die Auswertung von 172 Studien verbindet Person-Job-Passung besonders deutlich mit Arbeitszufriedenheit, Bindung und Kündigungsabsichten.",
      },
      {
        quelle: "Oh et al., internationale Metaanalyse",
        jahr: "2014",
        erkenntnis:
          "Ergebnisse aus 96 Studien stützen den Zusammenhang zwischen wahrgenommener Passung, Zufriedenheit und organisationaler Bindung über Länder hinweg.",
      },
      {
        quelle: "Arthur et al., Metaanalyse",
        jahr: "2006",
        erkenntnis:
          "Person-Organisation-Passung hängt stärker mit Arbeitseinstellungen zusammen als unmittelbar mit Leistung.",
        grenze: "Passung sagt also etwas über Bleiben, weniger über Können.",
      },
      {
        quelle: "Earnest, Allen & Landis, Metaanalyse",
        jahr: "2011",
        erkenntnis:
          "Realistische Tätigkeitsinformationen können Fluktuation senken. Ein wichtiger Wirkmechanismus ist die wahrgenommene Ehrlichkeit des Unternehmens.",
      },
      {
        quelle: "Van Iddekinge, Lievens & Sackett",
        jahr: "2023",
        erkenntnis:
          "Auswahlqualität, Vielfalt, Bewerbererlebnis und praktische Umsetzbarkeit müssen gemeinsam betrachtet werden.",
      },
      {
        quelle: "Barrick & Zimmerman",
        jahr: "2005",
        erkenntnis:
          "In einer prospektiven Untersuchung mit 445 Neueinstellungen sagten bereits vor der Einstellung erhobene Informationen vermeidbare freiwillige Kündigungen vorher.",
      },
    ],
  },
  {
    id: "erlebnis",
    titel: "Schlechte Candidate Experience und verlorene Talente",
    problem:
      "Gute Menschen verschwinden nicht nur wegen anderer Angebote, sondern wenn Unternehmen zu langsam, zu kompliziert oder zu still sind.",
    antwort: [
      "Jeder Kandidat sieht einen klaren Bewerbungsstatus.",
      "Unternehmen legen ihre Antwortzeit fest; Monday erinnert das Team, bevor sie überschritten wird.",
      "Wiederverwendbare Profile ersetzen Formulare und Doppeleingaben.",
      "Monday prüft Anzeigen vor der Veröffentlichung auf fehlende oder widersprüchliche Angaben.",
      "Absagen werden respektvoll vorbereitet — sensible Nachrichten bleiben in eurer Hand.",
    ],
    belege: [
      {
        quelle: "Hausknecht et al., Metaanalyse",
        jahr: "2004",
        erkenntnis:
          "Positive Wahrnehmungen des Auswahlprozesses hängen mit Arbeitgeberattraktivität, Empfehlungsbereitschaft und Angebotsannahme zusammen.",
      },
      {
        quelle: "Chapman et al., Metaanalyse",
        jahr: "2005",
        erkenntnis:
          "Job- und Unternehmensmerkmale, Verhalten der Recruiter und Prozesswahrnehmung beeinflussen Arbeitgeberattraktivität und Annahmeabsicht.",
      },
      {
        quelle: "Uggerslev et al., Metaanalyse",
        jahr: "2012",
        erkenntnis:
          "232 Studien zeigen, dass Kandidaten in verschiedenen Recruitingphasen unterschiedlich auf Informationen und Arbeitgeberverhalten reagieren.",
      },
      {
        quelle: "Carless & Hetherington",
        jahr: "2011",
        erkenntnis:
          "Die wahrgenommene Geschwindigkeit und Rechtzeitigkeit von Recruitingprozessen beeinflusst die Reaktion der Kandidaten.",
      },
      {
        quelle: "Stepstone Recruitingstudie",
        jahr: "2025",
        erkenntnis:
          "Viele Kandidaten berichten von ausbleibenden Antworten und brechen Prozesse wegen fehlender Updates oder zu langer Abläufe ab.",
      },
      {
        quelle: "softgarden Candidate Experience",
        jahr: "2024",
        erkenntnis:
          "Bewerbende wünschen sich frühzeitig Klarheit über Dauer, Gehalt, Ablauf und Erwartungen des Auswahlprozesses.",
      },
      {
        quelle: "Greenhouse Candidate Experience Report",
        jahr: "2024",
        erkenntnis:
          "Ghosting, unklare Stellenbeschreibungen und schlechte Kommunikation gehören im DACH-Raum zu den häufig genannten Problemen.",
      },
      {
        quelle: "Hays Bewerbungsstudie",
        jahr: "2024",
        erkenntnis:
          "Lange und komplizierte Bewerbungen erzeugen erhebliche Abbruchrisiken; mobile Prozesse müssen einfach bleiben.",
      },
      {
        quelle: "Indeed / MediaAnalyzer",
        jahr: "2023",
        erkenntnis:
          "Die deutsche Untersuchung zeigte zahlreiche Abbrüche durch komplizierte Prozesse sowie grosse Unterschiede zwischen gewünschter und tatsächlicher Dauer.",
      },
      {
        quelle: "BEST RECRUITERS Deutschland",
        jahr: "2024",
        erkenntnis:
          "Mystery-Bewerbungen zeigen regelmässig Lücken bei Reaktionsgeschwindigkeit, persönlicher Ansprache und Transparenz deutscher Arbeitgeber.",
      },
    ],
  },
  {
    id: "erwartungen",
    titel: "Falsche Erwartungen, Unzufriedenheit und Fluktuation",
    problem:
      "Eine Einstellung ist noch kein Erfolg. Sie wird zum Erfolg, wenn die Realität nach dem ersten Arbeitstag zum Versprechen passt.",
    antwort: [
      "Monday verlangt konkrete Angaben statt austauschbarer Werbeformulierungen.",
      "Aufgaben, Gehaltsspanne, Wochenstunden, Überstunden, Remote-Regeln, Führung, Team und Entwicklung stehen strukturiert da.",
      "Der Fit Score vergleicht auch Erwartungen, nicht nur Qualifikationen.",
      "Kandidaten sehen mögliche Konflikte vor ihrer Bewerbung.",
      "Enthält die Anzeige Versprechen ohne konkrete Angabe, weist Monday darauf hin.",
    ],
    belege: [
      {
        quelle: "Phillips, Metaanalyse",
        jahr: "1998",
        erkenntnis:
          "40 Studien verbinden realistische Tätigkeitsvorschauen mit niedrigeren Erwartungen, weniger Abbrüchen und teilweise geringerer Fluktuation.",
      },
      {
        quelle: "Premack & Wanous, Metaanalyse",
        jahr: "1985",
        erkenntnis:
          "21 experimentelle Untersuchungen zeigen, dass realistische Stelleninformationen Erwartungen und spätere Arbeitseinstellungen beeinflussen können.",
      },
      {
        quelle: "Meglino, Ravlin & DeNisi",
        jahr: "2000",
        erkenntnis:
          "Untersucht, wie realistische Tätigkeitsinformationen Erwartungen, Einstellungen und Verhalten nach der Einstellung beeinflussen.",
      },
      {
        quelle: "Wanous et al., Metaanalyse",
        jahr: "1992",
        erkenntnis:
          "Über 31 Studien hinweg hing die Erfüllung vorheriger Erwartungen deutlich mit Zufriedenheit, Bindung und Kündigungsabsichten zusammen.",
      },
      {
        quelle: "Griffeth, Hom & Gaertner",
        jahr: "2000",
        erkenntnis:
          "Die grosse Metaanalyse zeigt Arbeitszufriedenheit, Bindung, Alternativen und Kündigungsabsichten als wichtige Bestandteile der Fluktuationsforschung.",
      },
      {
        quelle: "Bauer et al., Newcomer Adjustment",
        jahr: "2007",
        erkenntnis:
          "Rollenklarheit, Selbstwirksamkeit und soziale Akzeptanz vermitteln den Zusammenhang zwischen guter Eingliederung und späteren Arbeitsergebnissen.",
      },
      {
        quelle: "Bauer et al., aktualisierte Metaanalyse",
        jahr: "2021",
        erkenntnis:
          "256 Studien unterstreichen die Bedeutung systematischer Sozialisation für Zufriedenheit, Bindung, Wohlbefinden und Wechselabsichten.",
      },
      {
        quelle: "Socialization Programs and Retention",
        jahr: "2017",
        erkenntnis:
          "Eine Metaanalyse von 83 Feldexperimenten verbindet strukturierte Sozialisationsprogramme mit höherer Bindung neuer Mitarbeitender.",
      },
      {
        quelle: "Stepstone / Kienbaum: Attracting Talent",
        jahr: "2023",
        erkenntnis:
          "Die repräsentative Untersuchung mit 8.493 Beschäftigten zeigt, dass Gehalt, Sicherheit, Balance, Team und Kultur je nach Lebens- und Karrierephase unterschiedlich wichtig sind.",
      },
      {
        quelle: "Hofmann & Strobel",
        jahr: "2020",
        erkenntnis:
          "Bei 1.606 Beschäftigten an deutschen Hochschulen war höhere organisationale Transparenz mit grösserer Zufriedenheit und geringerer Wechselabsicht verbunden.",
      },
    ],
  },
];

/** Wie viele Befunde insgesamt — für die Überschrift, ohne Handzählen. */
export const BELEGZAHL = FELDER.reduce((a, f) => a + f.belege.length, 0);

/**
 * Demo-Bewertungen. Vollständig erfunden, zu erfundenen Firmen.
 *
 * Der Datensatz ist bewusst so gebaut, dass die Oberfläche die Trennung
 * der Quellenarten zeigen muss: Kundenbewertungen stehen neben
 * Mitarbeiterstimmen, mit unterschiedlichen Stichproben und Zeitraeumen.
 * Eine Google-artige Standortbewertung sagt nichts über die Arbeitskultur
 * - genau das soll sichtbar werden.
 */

export interface SeedReview {
  companyKey: string;
  sourceKind: string;
  sourceName: string;
  sourceUrl: string;
  ratingAverage: number | null;
  sampleSize: number | null;
  locationScope: string | null;
  roleScope: string | null;
  periodDays: number;
  attributionText: string;
  selectionNote: string;
  themes: { theme: string; sentiment: "positive" | "negative" | "mixed"; mentionCount: number; summary: string }[];
}

export const seedReviews: SeedReview[] = [
  {
    companyKey: "nordlicht",
    sourceKind: "employee_reviews",
    sourceName: "Demo-Arbeitgeberportal",
    sourceUrl: "https://demo.invalid/arbeitgeber/nordlicht",
    ratingAverage: 3.9,
    sampleSize: 47,
    locationScope: "Hamburg",
    roleScope: "alle Rollen",
    periodDays: 540,
    attributionText: "Synthetische Demo-Daten. Keine reale Quelle.",
    selectionNote: "Alle Beiträge des Zeitraums, ohne Vorauswahl.",
    themes: [
      { theme: "Weiterbildung und Entwicklung", sentiment: "positive", mentionCount: 22,
        summary: "Das Lernbudget wird häufig genannt und offenbar auch genutzt." },
      { theme: "Führung", sentiment: "positive", mentionCount: 15,
        summary: "Direkte Vorgesetzte werden ueberwiegend als erreichbar beschrieben." },
      { theme: "Arbeitsbelastung", sentiment: "mixed", mentionCount: 18,
        summary: "Zum Quartalsende wird wiederholt von hoher Belastung berichtet." },
      { theme: "Gehalt", sentiment: "mixed", mentionCount: 11,
        summary: "Als angemessen, aber nicht als marktfuehrend beschrieben." },
    ],
  },
  {
    companyKey: "nordlicht",
    sourceKind: "customer_reviews",
    sourceName: "Demo-Kartendienst",
    sourceUrl: "https://demo.invalid/orte/nordlicht",
    ratingAverage: 4.6,
    sampleSize: 210,
    locationScope: "Standort Hamburg",
    roleScope: null,
    periodDays: 900,
    attributionText: "Synthetische Demo-Daten. Keine reale Quelle.",
    selectionNote:
      "Standortbewertungen von Kundinnen und Kunden. Sie sagen nichts über die " +
      "Arbeitsbedingungen und dürfen dafür nicht herangezogen werden.",
    themes: [
      { theme: "Kundenservice", sentiment: "positive", mentionCount: 88,
        summary: "Kunden loben die Erreichbarkeit des Supports." },
    ],
  },
  {
    companyKey: "hafenblick",
    sourceKind: "employee_reviews",
    sourceName: "Demo-Arbeitgeberportal",
    sourceUrl: "https://demo.invalid/arbeitgeber/hafenblick",
    ratingAverage: 3.1,
    sampleSize: 63,
    locationScope: "Hamburg",
    roleScope: "Operations und Verwaltung",
    periodDays: 720,
    attributionText: "Synthetische Demo-Daten. Keine reale Quelle.",
    selectionNote: "Alle Beiträge des Zeitraums, ohne Vorauswahl.",
    themes: [
      { theme: "Arbeitsbelastung", sentiment: "negative", mentionCount: 31,
        summary: "Überstunden im Schichtbetrieb werden wiederholt genannt." },
      { theme: "Kollegialität im Team", sentiment: "positive", mentionCount: 24,
        summary: "Der Zusammenhalt im unmittelbaren Team wird gelobt." },
      { theme: "Führung", sentiment: "mixed", mentionCount: 19,
        summary: "Die Einschätzung fällt je nach Abteilung deutlich unterschiedlich aus." },
      { theme: "Entwicklung", sentiment: "negative", mentionCount: 14,
        summary: "Aufstiegsmöglichkeiten werden als begrenzt beschrieben." },
    ],
  },
  {
    companyKey: "kranzberg",
    sourceKind: "employee_reviews",
    sourceName: "Demo-Arbeitgeberportal",
    sourceUrl: "https://demo.invalid/arbeitgeber/kranzberg",
    ratingAverage: 3.4,
    sampleSize: 6,
    locationScope: "Lübeck",
    roleScope: null,
    periodDays: 1100,
    attributionText: "Synthetische Demo-Daten. Keine reale Quelle.",
    selectionNote:
      "Sehr kleine Stichprobe über einen langen Zeitraum. Einzelne Beiträge " +
      "wiegen hier stark; eine Verallgemeinerung ist nicht zulässig.",
    themes: [
      { theme: "Reisetätigkeit", sentiment: "negative", mentionCount: 4,
        summary: "Zwei Beiträge nennen haeufige Reisen als Belastung. Sehr kleine Grundlage." },
    ],
  },
  {
    companyKey: "grünspan",
    sourceKind: "employee_reviews",
    sourceName: "Demo-Arbeitgeberportal",
    sourceUrl: "https://demo.invalid/arbeitgeber/grünspan",
    ratingAverage: 4.2,
    sampleSize: 38,
    locationScope: "Kiel und remote",
    roleScope: "alle Rollen",
    periodDays: 500,
    attributionText: "Synthetische Demo-Daten. Keine reale Quelle.",
    selectionNote: "Alle Beiträge des Zeitraums, ohne Vorauswahl.",
    themes: [
      { theme: "Flexibilität und Homeoffice", sentiment: "positive", mentionCount: 29,
        summary: "Die Remote-Regelung wird durchgaengig positiv beschrieben." },
      { theme: "Entwicklung und Lernen", sentiment: "positive", mentionCount: 17,
        summary: "Weiterbildung wird als tatsächlich zugänglich beschrieben." },
      { theme: "Arbeitsbelastung", sentiment: "mixed", mentionCount: 12,
        summary: "Projektspitzen werden genannt, aber als planbar beschrieben." },
      { theme: "Führung", sentiment: "positive", mentionCount: 13,
        summary: "Entscheidungswege werden als nachvollziehbar beschrieben." },
    ],
  },
  {
    companyKey: "grünspan",
    sourceKind: "official_registry",
    sourceName: "Demo-Unternehmensregister",
    sourceUrl: "https://demo.invalid/register/grünspan",
    ratingAverage: null,
    sampleSize: null,
    locationScope: null,
    roleScope: null,
    periodDays: 30,
    attributionText: "Synthetische Demo-Daten. Keine reale Quelle.",
    selectionNote: "Registerdaten, keine Bewertung.",
    themes: [
      { theme: "Rechtsform und Sitz bestätigt", sentiment: "positive", mentionCount: 1,
        summary: "Eintragung und Sitz stimmen mit den Angaben der Anzeige überein." },
    ],
  },
  {
    companyKey: "sturmvogel",
    sourceKind: "employee_reviews",
    sourceName: "Demo-Arbeitgeberportal",
    sourceUrl: "https://demo.invalid/arbeitgeber/sturmvogel",
    ratingAverage: 2.8,
    sampleSize: 142,
    locationScope: "bundesweit",
    roleScope: "Vertrieb",
    periodDays: 800,
    attributionText: "Synthetische Demo-Daten. Keine reale Quelle.",
    selectionNote: "Alle Beiträge des Zeitraums, ohne Vorauswahl.",
    themes: [
      { theme: "Druck auf Zielvorgaben", sentiment: "negative", mentionCount: 67,
        summary: "Der Druck durch Abschlussziele wird sehr häufig genannt." },
      { theme: "Vergütung", sentiment: "mixed", mentionCount: 41,
        summary: "Die Provision wird als erreichbar, aber schwankend beschrieben." },
      { theme: "Einarbeitung", sentiment: "negative", mentionCount: 23,
        summary: "Die Einarbeitung wird wiederholt als zu kurz beschrieben." },
    ],
  },
];

/**
 * Interne Starttaxonomie.
 *
 * Bewusst klein und als `taxonomy: "internal"` gekennzeichnet. ESCO und
 * KldB sind ueber Adapter vorgesehen (siehe packages/jobs/src/taxonomy),
 * ihre Daten werden aber nicht mitgeliefert: sie unterliegen eigenen
 * Nutzungsbedingungen und muessen aus der offiziellen Quelle geladen
 * werden. Was hier steht, traegt die Demo und nichts weiter.
 */

export const seedTaxonomy = {
  skills: [
    { key: "customer_service", labelDe: "Kundenbetreuung", labelEn: "Customer service",
      synonyms: ["Kundenservice", "Support", "Kundenkontakt"], kind: "domain",
      relatedKeys: ["conflict_resolution", "communication"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "communication", labelDe: "Verstaendliche Kommunikation", labelEn: "Clear communication",
      synonyms: ["Erklaeren", "Praesentieren"], kind: "social",
      relatedKeys: ["training", "customer_service"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "conflict_resolution", labelDe: "Konfliktklaerung", labelEn: "Conflict resolution",
      synonyms: ["Eskalation", "Vermitteln"], kind: "social",
      relatedKeys: ["customer_service"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "reporting", labelDe: "Auswertung und Berichte", labelEn: "Reporting and analysis",
      synonyms: ["Reporting", "Auswertung", "Tabellen"], kind: "method",
      relatedKeys: ["data_handling"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "data_handling", labelDe: "Sorgfaeltiger Umgang mit Daten", labelEn: "Careful data handling",
      synonyms: ["Stammdaten", "Datenpflege"], kind: "method",
      relatedKeys: ["reporting"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "coordination", labelDe: "Koordination und Abstimmung", labelEn: "Coordination",
      synonyms: ["Projektkoordination", "Organisation", "Terminplanung"], kind: "method",
      relatedKeys: ["communication", "prioritisation"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "prioritisation", labelDe: "Priorisieren", labelEn: "Prioritisation",
      synonyms: ["Priorisierung", "Aufgaben ordnen"], kind: "method",
      relatedKeys: ["coordination"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "training", labelDe: "Schulung und Wissensvermittlung", labelEn: "Training and enablement",
      synonyms: ["Enablement", "Onboarding", "Schulung"], kind: "domain",
      relatedKeys: ["communication"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "marketing_content", labelDe: "Inhalte fuer Marketing", labelEn: "Marketing content",
      synonyms: ["Content", "Texte", "Kampagne"], kind: "domain",
      relatedKeys: ["communication"], escoUri: null,
      taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "lang_de", labelDe: "Deutsch", labelEn: "German", synonyms: [], kind: "language",
      relatedKeys: [], escoUri: null, taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "lang_en", labelDe: "Englisch", labelEn: "English", synonyms: [], kind: "language",
      relatedKeys: [], escoUri: null, taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
  ],

  occupations: [
    { key: "customer_success_manager", labelDe: "Customer Success Manager", labelEn: "Customer Success Manager",
      synonyms: ["Kundenerfolg", "Account Management", "Kundenbetreuung"],
      tasks: ["Kunden betreuen", "Nutzung auswerten", "bei Eskalationen vermitteln", "schulen"],
      skillKeys: ["customer_service", "communication", "conflict_resolution", "reporting"],
      escoUri: null, kldbCode: null, taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "project_coordinator", labelDe: "Projektkoordination", labelEn: "Project coordinator",
      synonyms: ["Projektassistenz", "Programmkoordination", "Projektmanagement"],
      tasks: ["Termine koordinieren", "abstimmen", "dokumentieren", "Berichte erstellen"],
      skillKeys: ["coordination", "prioritisation", "communication", "reporting"],
      escoUri: null, kldbCode: null, taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "enablement_specialist", labelDe: "Enablement und Schulung", labelEn: "Enablement specialist",
      synonyms: ["Trainer", "Wissensmanagement", "Onboarding-Verantwortliche"],
      tasks: ["Schulungen entwickeln", "erklaeren", "Wissen dokumentieren", "anleiten"],
      skillKeys: ["training", "communication"],
      escoUri: null, kldbCode: null, taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "operations_coordinator", labelDe: "Operations Coordinator", labelEn: "Operations coordinator",
      synonyms: ["Disposition", "Sachbearbeitung Betrieb"],
      tasks: ["Auftraege erfassen", "disponieren", "Abweichungen dokumentieren"],
      skillKeys: ["data_handling", "coordination"],
      escoUri: null, kldbCode: null, taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
    { key: "marketing_manager_junior", labelDe: "Junior Marketing Manager", labelEn: "Junior marketing manager",
      synonyms: ["Marketing Assistenz", "Kommunikation"],
      tasks: ["Content erstellen", "Kampagnen auswerten", "Kanaele betreuen"],
      skillKeys: ["marketing_content", "reporting", "communication"],
      escoUri: null, kldbCode: null, taxonomy: "internal" as const, taxonomyVersion: "2026.08" },
  ],

  microAssessments: [
    {
      key: "inbox_priorities",
      titleDe: "Eine kleine Inbox priorisieren",
      titleEn: "Prioritise a small inbox",
      purposeDe:
        "Zeigt, wie du unter Zeitdruck ordnest und deine Reihenfolge begruendest. " +
        "Das Ergebnis ist kein Test deiner Faehigkeiten, sondern ein Gespraechsanlass.",
      purposeEn:
        "Shows how you order things under time pressure and justify your sequence. " +
        "The result is not a test of ability but a starting point for conversation.",
      rubric: [
        { criterion: "Struktur", description: "Ist eine erkennbare Reihenfolge da?" },
        { criterion: "Begruendung", description: "Wird die Reihenfolge nachvollziehbar erklaert?" },
        { criterion: "Umgang mit Unsicherheit", description: "Werden fehlende Angaben benannt?" },
      ],
      estimatedMinutes: 4,
      promptDe:
        "Fuenf Nachrichten liegen vor: eine Kundenbeschwerde, eine Rechnungsfrage, eine Einladung " +
        "zu einem internen Termin, eine Nachfrage einer Kollegin und eine Werbemail. Du hast " +
        "dreissig Minuten. In welcher Reihenfolge gehst du vor und warum?",
      promptEn:
        "Five messages are waiting: a customer complaint, an invoice question, an internal meeting " +
        "invitation, a colleague's follow-up and a marketing email. You have thirty minutes. " +
        "In what order do you work through them, and why?",
      accessibleAlternativeDe:
        "Die Nachrichten stehen als nummerierte Liste zur Verfuegung. Du kannst die Reihenfolge " +
        "als Text angeben, statt Elemente zu verschieben.",
    },
    {
      key: "ambiguous_message",
      titleDe: "Auf eine mehrdeutige Nachricht reagieren",
      titleEn: "Respond to an ambiguous message",
      purposeDe:
        "Zeigt, wie du mit unklaren Anliegen umgehst: nachfragen, annehmen oder eskalieren. " +
        "Es gibt keine einzig richtige Antwort.",
      purposeEn:
        "Shows how you handle unclear requests: ask, assume or escalate. There is no single " +
        "correct answer.",
      rubric: [
        { criterion: "Klaerung", description: "Wird das Unklare erkannt und angesprochen?" },
        { criterion: "Ton", description: "Bleibt die Antwort freundlich und klar?" },
        { criterion: "Naechster Schritt", description: "Ist ein konkreter naechster Schritt genannt?" },
      ],
      estimatedMinutes: 4,
      promptDe:
        "Eine Kundin schreibt: \"Das funktioniert seit gestern nicht mehr, wir brauchen das " +
        "dringend.\" Mehr steht nicht in der Nachricht. Wie antwortest du?",
      promptEn:
        "A customer writes: \"This stopped working yesterday, we need it urgently.\" That is all " +
        "the message says. How do you reply?",
      accessibleAlternativeDe: null,
    },
    {
      key: "explain_complex",
      titleDe: "Einen komplizierten Sachverhalt erklaeren",
      titleEn: "Explain something complicated",
      purposeDe:
        "Zeigt, wie du Fachliches verstaendlich machst - eine Faehigkeit, die in Anzeigen selten " +
        "steht und im Alltag staendig gebraucht wird.",
      purposeEn:
        "Shows how you make specialist content understandable - a skill job ads rarely name and " +
        "daily work constantly needs.",
      rubric: [
        { criterion: "Verstaendlichkeit", description: "Waere es fuer einen Laien klar?" },
        { criterion: "Aufbau", description: "Beginnt es beim Wesentlichen?" },
        { criterion: "Beispiel", description: "Wird es an einem konkreten Fall greifbar?" },
      ],
      estimatedMinutes: 5,
      promptDe:
        "Erklaere jemandem ohne Vorkenntnisse in hoechstens fuenf Saetzen, warum eine Rechnung " +
        "manchmal spaeter kommt als die Lieferung.",
      promptEn:
        "In at most five sentences, explain to someone with no background why an invoice sometimes " +
        "arrives later than the delivery.",
      accessibleAlternativeDe: null,
    },
  ],
};

/**
 * Demo-Stellen. Der Datensatz ist absichtlich uneinheitlich, damit die
 * Oberfläche ihre ehrlichen Zustaende zeigen muss:
 *
 *  - gute, mittlere und explorative Passung
 *  - fehlende Gehaltsangabe, fehlende Aufgaben, fehlende Vertragsart
 *  - eine veraltete Anzeige und ein Repost desselben Inhalts
 *  - eine Stelle, die an einer harten Bedingung scheitert
 *  - Rollen mit unterschiedlicher Aufgabenstruktur für das AI-Radar
 */

export interface SeedJob {
  key: string;
  companyKey: string;
  title: string;
  location: string;
  workModel: "on_site" | "hybrid" | "remote";
  remotePercent: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryDisclosed: boolean;
  contractType: string | null;
  weeklyHours: number | null;
  shiftWork: boolean | null;
  travelPercent: number | null;
  experienceLevel: string | null;
  industry: string | null;
  languageRequirements: Record<string, string>;
  requiredLicenses: string[];
  workPermitRequired: boolean | null;
  coreTasks: string[];
  description: string;
  benefits: string[];
  applyMethod: "email" | "portal" | "form" | "unknown";
  applyTarget: string | null;
  publishedDaysAgo: number | null;
  expiresInDays: number | null;
  linkCheckOk: boolean | null;
  requirements: { kind: "must" | "nice"; text: string; category: string }[];
  /** Teilt sich den Inhaltshash mit einer anderen Anzeige: Repost-Fall. */
  contentHashGroup?: string;
}

export const seedJobs: SeedJob[] = [
  {
    key: "csm-nordlicht", companyKey: "nordlicht",
    title: "Customer Success Manager (m/w/d)", location: "Hamburg",
    workModel: "hybrid", remotePercent: 50,
    salaryMin: 44000, salaryMax: 52000, salaryDisclosed: true,
    contractType: "permanent", weeklyHours: 40, shiftWork: false, travelPercent: 10,
    experienceLevel: "junior", industry: "Software",
    languageRequirements: { de: "C1", en: "B2" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Kundinnen und Kunden nach dem Onboarding betreuen",
      "Nutzungsdaten auswerten und monatliche Berichte erstellen",
      "Bei Eskalationen zwischen Kunde und Produktteam vermitteln",
      "Schulungen vorbereiten und präsentieren",
    ],
    description:
      "Du begleitest unsere Kundinnen und Kunden nach dem Start und sorgst dafuer, dass sie mit " +
      "dem Produkt wirklich weiterkommen. Du arbeitest eng mit Produkt und Support zusammen, " +
      "priorisierst eigenstaendig und hast viel Austausch im Team. Wir foerdern Weiterbildung " +
      "mit einem festen Lernbudget und arbeiten mit flexibler Arbeitszeit.",
    benefits: ["Weiterbildung", "flexible Arbeitszeit", "Lernbudget", "30 Urlaubstage"],
    applyMethod: "email", applyTarget: "bewerbung@nordlicht.invalid",
    publishedDaysAgo: 6, expiresInDays: 40, linkCheckOk: true,
    requirements: [
      { kind: "must", text: "Erfahrung in der Kundenbetreuung oder im Kundenservice", category: "experience" },
      { kind: "must", text: "Sehr gute Deutschkenntnisse in Wort und Schrift", category: "language" },
      { kind: "nice", text: "Erfahrung mit Auswertungen und Berichten", category: "skill" },
      { kind: "nice", text: "Erste Erfahrung mit einem CRM-System", category: "skill" },
    ],
  },
  {
    key: "projektkoordination-leuchtturm", companyKey: "leuchtturm",
    title: "Projektkoordination Bildungsprogramme", location: "Hamburg",
    workModel: "hybrid", remotePercent: 40,
    salaryMin: 42000, salaryMax: 47000, salaryDisclosed: true,
    contractType: "fixed_term", weeklyHours: 38, shiftWork: false, travelPercent: 15,
    experienceLevel: "junior", industry: "Bildung",
    languageRequirements: { de: "C1" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Termine und Abläufe mehrerer Programme koordinieren",
      "Mit Trägern und Ehrenamtlichen abstimmen",
      "Fördermittelberichte erstellen und dokumentieren",
      "Veranstaltungen vor Ort begleiten",
    ],
    description:
      "Du haeltst mehrere Bildungsprogramme zusammen: Du koordinierst Termine, stimmst dich mit " +
      "Trägern ab und sorgst dafuer, dass Berichte rechtzeitig fertig werden. Die Stelle ist " +
      "zunaechst auf zwei Jahre befristet, eine Entfristung ist ausdrücklich vorgesehen.",
    benefits: ["Weiterbildung", "sinnstiftende Arbeit", "flexible Arbeitszeit"],
    applyMethod: "portal", applyTarget: "https://leuchtturm.invalid/karriere/1234",
    publishedDaysAgo: 14, expiresInDays: 20, linkCheckOk: true,
    requirements: [
      { kind: "must", text: "Organisationserfahrung, gern aus Studium oder Ehrenamt", category: "experience" },
      { kind: "must", text: "Sicherer Umgang mit Tabellen und Dokumentation", category: "skill" },
      { kind: "nice", text: "Erfahrung mit Fördermitteln", category: "skill" },
    ],
  },
  {
    key: "marketing-wellenform", companyKey: "wellenform",
    title: "Junior Marketing Manager", location: "Hamburg",
    workModel: "on_site", remotePercent: 0,
    salaryMin: null, salaryMax: null, salaryDisclosed: false,
    contractType: "permanent", weeklyHours: 40, shiftWork: false, travelPercent: null,
    experienceLevel: "entry", industry: "Medien",
    languageRequirements: { de: "C1" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Content für Kampagnen erstellen und texte schreiben",
      "Kampagnen auswerten und Reporting aufbereiten",
      "Social-Media-Kanaele betreuen",
    ],
    description:
      "Du unterstuetzt unser Marketingteam bei Kampagnen von der Idee bis zur Auswertung. " +
      "Du schreibst Texte, betreust unsere Kanaele und bereitest Zahlen auf.",
    benefits: ["junges Team", "Innenstadtlage"],
    applyMethod: "email", applyTarget: "jobs@wellenform.invalid",
    publishedDaysAgo: 3, expiresInDays: null, linkCheckOk: true,
    requirements: [
      { kind: "must", text: "Erste Erfahrung im Marketing oder in der Kommunikation", category: "experience" },
      { kind: "nice", text: "Erfahrung mit Social-Media-Werkzeugen", category: "skill" },
    ],
  },
  {
    key: "vertrieb-sturmvogel", companyKey: "sturmvogel",
    title: "Vertriebsmitarbeiter Neukundengewinnung", location: "München",
    workModel: "on_site", remotePercent: 0,
    salaryMin: 36000, salaryMax: 40000, salaryDisclosed: true,
    contractType: "permanent", weeklyHours: 40, shiftWork: false, travelPercent: 50,
    experienceLevel: "entry", industry: "Handel",
    languageRequirements: { de: "C1" }, requiredLicenses: ["Führerschein B"], workPermitRequired: false,
    coreTasks: [
      "Neukunden telefonisch ansprechen und Termine vereinbaren",
      "Kundengespräche vor Ort führen",
      "Angebote erstellen und nachfassen",
    ],
    description:
      "Du gewinnst neue Kunden für unser Sortiment. Der Schwerpunkt liegt auf der telefonischen " +
      "Erstansprache und Terminvereinbarung.",
    benefits: ["Dienstwagen", "Provision"],
    applyMethod: "portal", applyTarget: "https://sturmvogel.invalid/jobs/9911",
    publishedDaysAgo: 9, expiresInDays: 60, linkCheckOk: true,
    requirements: [
      { kind: "must", text: "Führerschein Klasse B", category: "license" },
      { kind: "must", text: "Freude an Kaltakquise", category: "other" },
    ],
  },
  {
    key: "ops-hafenblick", companyKey: "hafenblick",
    title: "Operations Coordinator", location: "Hamburg",
    workModel: "on_site", remotePercent: 0,
    salaryMin: 43000, salaryMax: 48000, salaryDisclosed: true,
    contractType: "permanent", weeklyHours: 40, shiftWork: true, travelPercent: 5,
    experienceLevel: "junior", industry: "Logistik",
    languageRequirements: { de: "B2", en: "B2" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Aufträge erfassen und Stammdaten pflegen",
      "Sendungen disponieren und Abweichungen dokumentieren",
      "Mit Fahrern und Kunden telefonisch abstimmen",
    ],
    description:
      "Du haeltst den taeglichen Betrieb am Laufen: Du erfasst Aufträge, disponierst Sendungen " +
      "und klaerst Abweichungen. Die Arbeit erfolgt im Zweischichtsystem.",
    benefits: ["Schichtzulage", "Kantine"],
    applyMethod: "email", applyTarget: "personal@hafenblick.invalid",
    publishedDaysAgo: 11, expiresInDays: 30, linkCheckOk: true,
    requirements: [
      { kind: "must", text: "Bereitschaft zur Schichtarbeit", category: "other" },
      { kind: "must", text: "Sorgfältige Arbeitsweise mit Daten", category: "skill" },
      { kind: "nice", text: "Erfahrung in Logistik oder Spedition", category: "experience" },
    ],
  },
  {
    key: "kundenerfolg-grünspan", companyKey: "grünspan",
    title: "Referent:in Kundenbetreuung Energiewende", location: "Kiel",
    workModel: "remote", remotePercent: 100,
    salaryMin: 45000, salaryMax: 53000, salaryDisclosed: true,
    contractType: "permanent", weeklyHours: 39, shiftWork: false, travelPercent: 10,
    experienceLevel: "junior", industry: "Energie",
    languageRequirements: { de: "C1" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Mitglieder beraten und bei Fragen begleiten",
      "Komplexe Förderbedingungen verstaendlich erklären",
      "Anliegen dokumentieren und auswerten",
      "Bei Konflikten zwischen Mitgliedern und Technik vermitteln",
    ],
    description:
      "Du betreust unsere Mitglieder rund um Beteiligungen an Energieprojekten. Du erklaerst " +
      "komplizierte Sachverhalte verstaendlich und vermittelst, wenn es hakt. Die Stelle ist " +
      "vollständig remote möglich.",
    benefits: ["vollständig remote", "Weiterbildung", "Lernbudget", "sinnstiftende Arbeit"],
    applyMethod: "email", applyTarget: "karriere@grünspan.invalid",
    publishedDaysAgo: 2, expiresInDays: 45, linkCheckOk: true,
    requirements: [
      { kind: "must", text: "Erfahrung in Beratung, Betreuung oder Kundenservice", category: "experience" },
      { kind: "must", text: "Fähigkeit, komplexe Themen verstaendlich zu erklären", category: "skill" },
      { kind: "nice", text: "Interesse an Energie- und Förderthemen", category: "other" },
    ],
  },
  {
    key: "beratung-kranzberg-alt", companyKey: "kranzberg",
    title: "Junior Consultant Prozessberatung", location: "Lübeck",
    workModel: "hybrid", remotePercent: 30,
    salaryMin: 42000, salaryMax: 46000, salaryDisclosed: true,
    contractType: null, weeklyHours: null, shiftWork: null, travelPercent: 40,
    experienceLevel: "entry", industry: "Beratung",
    languageRequirements: { de: "C1", en: "C1" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Prozesse aufnehmen und dokumentieren",
      "Workshops vorbereiten und Ergebnisse zusammenfassen",
      "Präsentationen erstellen",
    ],
    description:
      "Du unterstuetzt unsere Beratungsprojekte: Du nimmst Prozesse auf, bereitest Workshops vor " +
      "und fasst Ergebnisse zusammen.",
    benefits: ["Weiterbildung"],
    applyMethod: "email", applyTarget: "jobs@kranzberg.invalid",
    publishedDaysAgo: 140, expiresInDays: -30, linkCheckOk: false,
    contentHashGroup: "kranzberg-consultant",
    requirements: [
      { kind: "must", text: "Abgeschlossenes Studium", category: "qualification" },
      { kind: "must", text: "Sehr gute Englischkenntnisse", category: "language" },
      { kind: "nice", text: "Erfahrung mit Präsentationen", category: "skill" },
    ],
  },
  {
    key: "beratung-kranzberg-neu", companyKey: "kranzberg",
    title: "Junior Consultant Prozessberatung", location: "Lübeck",
    workModel: "hybrid", remotePercent: 30,
    salaryMin: 42000, salaryMax: 46000, salaryDisclosed: true,
    contractType: null, weeklyHours: null, shiftWork: null, travelPercent: 40,
    experienceLevel: "entry", industry: "Beratung",
    languageRequirements: { de: "C1", en: "C1" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Prozesse aufnehmen und dokumentieren",
      "Workshops vorbereiten und Ergebnisse zusammenfassen",
      "Präsentationen erstellen",
    ],
    description:
      "Du unterstuetzt unsere Beratungsprojekte: Du nimmst Prozesse auf, bereitest Workshops vor " +
      "und fasst Ergebnisse zusammen.",
    benefits: ["Weiterbildung"],
    applyMethod: "email", applyTarget: "jobs@kranzberg.invalid",
    publishedDaysAgo: 5, expiresInDays: 50, linkCheckOk: true,
    contentHashGroup: "kranzberg-consultant",
    requirements: [
      { kind: "must", text: "Abgeschlossenes Studium", category: "qualification" },
      { kind: "must", text: "Sehr gute Englischkenntnisse", category: "language" },
      { kind: "nice", text: "Erfahrung mit Präsentationen", category: "skill" },
    ],
  },
  {
    key: "datenpflege-hafenblick", companyKey: "hafenblick",
    title: "Sachbearbeitung Stammdaten", location: "Hamburg",
    workModel: "hybrid", remotePercent: 60,
    salaryMin: 38000, salaryMax: 42000, salaryDisclosed: true,
    contractType: "permanent", weeklyHours: 40, shiftWork: false, travelPercent: 0,
    experienceLevel: "entry", industry: "Logistik",
    languageRequirements: { de: "B2" }, requiredLicenses: [], workPermitRequired: false,
    coreTasks: [
      "Stammdaten erfassen und pflegen",
      "Rechnungen prüfen und dokumentieren",
      "Berichte erstellen und formatieren",
      "Daten aus verschiedenen Quellen zusammenfuehren und sortieren",
    ],
    description:
      "Du pflegst unsere Stammdaten, pruefst Rechnungen und erstellst wiederkehrende Berichte.",
    benefits: ["Homeoffice möglich", "geregelte Arbeitszeit"],
    applyMethod: "email", applyTarget: "personal@hafenblick.invalid",
    publishedDaysAgo: 20, expiresInDays: 25, linkCheckOk: true,
    requirements: [
      { kind: "must", text: "Sorgfalt im Umgang mit Daten", category: "skill" },
      { kind: "nice", text: "Erfahrung mit Tabellenkalkulation", category: "skill" },
    ],
  },
  {
    key: "produktsupport-nordlicht", companyKey: "nordlicht",
    title: "Produktsupport mit Schwerpunkt Onboarding", location: "Hamburg",
    workModel: "hybrid", remotePercent: 50,
    salaryMin: null, salaryMax: null, salaryDisclosed: false,
    contractType: "permanent", weeklyHours: null, shiftWork: null, travelPercent: null,
    experienceLevel: null, industry: "Software",
    languageRequirements: {}, requiredLicenses: [], workPermitRequired: null,
    coreTasks: [],
    description:
      "Wir suchen Verstärkung für unser Support-Team. Details besprechen wir gern im Gespräch.",
    benefits: [],
    applyMethod: "email", applyTarget: "bewerbung@nordlicht.invalid",
    publishedDaysAgo: 30, expiresInDays: null, linkCheckOk: null,
    requirements: [],
  },
];

/**
 * Demo-Persona Lea. Vollstaendig erfunden.
 *
 * 25, BWL-Bachelor, zwei Jahre Kundenservice und Operations. Sucht
 * uneinheitlich zwischen Marketing, Projektmanagement und Customer
 * Success. 14 Bewerbungen, ein kurzes Telefoninterview. Genau der Fall,
 * fuer den das Produkt gebaut ist: die Erfahrung ist da, die Uebersetzung
 * in Zielrollen fehlt.
 */

export const LEA_EMAIL = "lea.demo@example.invalid";

export interface SeedEvidence {
  key: string;
  type: string;
  statement: string;
  sourceType: string;
  sourceRef: string;
  confidence: number;
  userConfirmed: boolean;
}

export const leaEvidence: SeedEvidence[] = [
  { key: "ev-service", type: "experience_episode",
    statement: "Zwei Jahre im Kundenservice eines Softwareanbieters, taeglich rund 40 Anfragen bearbeitet",
    sourceType: "user_stated", sourceRef: "interview:current_situation", confidence: 0.95, userConfirmed: true },
  { key: "ev-eskalation", type: "experience_episode",
    statement: "Eine Eskalation mit einem groesseren Kunden uebernommen und bis zur Loesung begleitet",
    sourceType: "user_stated", sourceRef: "interview:experience_episodes", confidence: 0.9, userConfirmed: true },
  { key: "ev-report", type: "skill",
    statement: "Monatliche Auswertung der Anfragegruende in einer Tabelle erstellt und im Team praesentiert",
    sourceType: "user_stated", sourceRef: "interview:experience_episodes", confidence: 0.85, userConfirmed: true },
  { key: "ev-onboarding", type: "result",
    statement: "Einen Leitfaden fuer wiederkehrende Fragen geschrieben, den das Team seitdem nutzt",
    sourceType: "user_stated", sourceRef: "interview:feedback_and_recognition", confidence: 0.8, userConfirmed: true },
  { key: "ev-erklaeren", type: "skill",
    statement: "Wird von Kolleginnen und Kollegen regelmaessig gebeten, komplizierte Sachverhalte zu erklaeren",
    sourceType: "user_stated", sourceRef: "interview:feedback_and_recognition", confidence: 0.8, userConfirmed: true },
  { key: "ev-orga", type: "skill",
    statement: "Im Studium eine Fachschaftsveranstaltung mit 120 Teilnehmenden organisiert",
    sourceType: "user_stated", sourceRef: "interview:background", confidence: 0.75, userConfirmed: true },
  { key: "ev-bwl", type: "qualification",
    statement: "Bachelor Betriebswirtschaftslehre, Schwerpunkt Marketing",
    sourceType: "document_extract", sourceRef: "document:lebenslauf", confidence: 0.9, userConfirmed: true },
  { key: "ev-deutsch", type: "skill",
    statement: "Deutsch auf Muttersprachniveau",
    sourceType: "user_confirmed", sourceRef: "interview:hard_constraints", confidence: 0.95, userConfirmed: true },
  { key: "ev-englisch", type: "skill",
    statement: "Englisch sicher in Wort und Schrift, im Studium zwei Kurse auf Englisch belegt",
    sourceType: "user_stated", sourceRef: "interview:background", confidence: 0.7, userConfirmed: true },
  { key: "ev-energie-erklaeren", type: "preference",
    statement: "Erklaeren und Anleiten geben Energie",
    sourceType: "user_stated", sourceRef: "interview:tasks_and_energy", confidence: 0.85, userConfirmed: true },
  { key: "ev-energie-orga", type: "preference",
    statement: "Dinge sortieren und Ablaeufe ordnen geben Energie",
    sourceType: "user_stated", sourceRef: "interview:tasks_and_energy", confidence: 0.8, userConfirmed: true },
  { key: "ev-drain-kalt", type: "preference",
    statement: "Kaltakquise kostet viel Energie und fuehlt sich falsch an",
    sourceType: "user_stated", sourceRef: "interview:tasks_and_energy", confidence: 0.9, userConfirmed: true },
  { key: "ev-drain-allein", type: "preference",
    statement: "Lange allein an einer Aufgabe zu sitzen laugt aus",
    sourceType: "user_stated", sourceRef: "interview:work_style_and_environment", confidence: 0.75, userConfirmed: true },
  // Bewusst unbestaetigt: eine offene Hypothese, die im Profil sichtbar ist
  // und ausdruecklich bestaetigt werden muss, bevor sie irgendwo zaehlt.
  { key: "ev-hyp-projekt", type: "skill",
    statement: "Koennte Projektkoordination gut liegen, weil Ordnen und Abstimmen wiederholt vorkommen",
    sourceType: "ai_hypothesis", sourceRef: "interview:synthesis", confidence: 0.5, userConfirmed: false },
  { key: "ev-hyp-schulung", type: "role",
    statement: "Schulung und Wissensvermittlung koennten eine Richtung sein",
    sourceType: "ai_hypothesis", sourceRef: "interview:synthesis", confidence: 0.45, userConfirmed: false },
];

export const leaConstraints = {
  minSalaryPerYear: 42000,
  currency: "EUR",
  salaryTradeOffs: ["mehr Lernbudget", "hoeherer Remote-Anteil"],
  baseLocation: "Hamburg",
  country: "DE",
  maxCommuteMinutes: 45,
  commuteMode: "public_transport",
  acceptedWorkModels: ["hybrid", "remote", "on_site"],
  willingToRelocate: false,
  targetCountries: [],
  weeklyHoursMin: null,
  weeklyHoursMax: null,
  acceptsShiftWork: false,
  maxTravelPercent: 25,
  acceptedContractTypes: ["permanent", "fixed_term"],
  languages: { de: "C2", en: "B2" },
  licenses: [],
  workPermitCountries: ["DE"],
  needsVisaSponsorship: false,
  earliestStartDate: null,
  hardNoGos: ["reine Kaltakquise", "dauerhafte Schichtarbeit"],
} as const;

export const leaRoleClusters = [
  {
    title: "Customer Success und Kundenbetreuung",
    kind: "obvious" as const,
    rationale:
      "Zwei Jahre Kundenservice, eine selbst uebernommene Eskalation und wiederholtes Lob fuer " +
      "verstaendliches Erklaeren zeigen in dieselbe Richtung. Hier zaehlt deine Erfahrung direkt.",
    evidenceKeys: ["ev-service", "ev-eskalation", "ev-erklaeren"],
    gaps: ["Erfahrung mit einem CRM-System ist noch nicht belegt"],
    criticalConstraints: ["Mindestgehalt 42.000 EUR", "hoechstens 45 Minuten Arbeitsweg"],
    entryRealism: "direct" as const,
    nextValidationStep:
      "Sprich mit jemandem, der die Rolle heute macht, und frag nach einem typischen Dienstag.",
  },
  {
    title: "Projekt- und Programmkoordination",
    kind: "adjacent" as const,
    rationale:
      "Das Organisieren einer Veranstaltung mit 120 Teilnehmenden und der selbst geschriebene " +
      "Leitfaden deuten darauf hin, dass dir Ordnen und Abstimmen liegt. Das ist noch eine " +
      "Vermutung, kein Nachweis.",
    evidenceKeys: ["ev-orga", "ev-onboarding", "ev-energie-orga"],
    gaps: ["Keine Berufserfahrung in einer Koordinationsrolle", "Keine Projektmethodik nachgewiesen"],
    criticalConstraints: ["Reiseanteil hoechstens 25 Prozent"],
    entryRealism: "with_bridge" as const,
    nextValidationStep:
      "Uebernimm im aktuellen Job bewusst die Koordination einer kleinen Sache und schau, wie es sich anfuehlt.",
  },
  {
    title: "Wissensvermittlung und Enablement",
    kind: "niche" as const,
    rationale:
      "Der Leitfaden, das Erklaeren fuer Kolleginnen und die Energie beim Anleiten passen zu " +
      "Rollen, die selten ausgeschrieben sind: Enablement, Schulung, interne Wissensarbeit. " +
      "Diese Richtung hast du selbst nicht genannt.",
    evidenceKeys: ["ev-onboarding", "ev-erklaeren", "ev-energie-erklaeren"],
    gaps: ["Noch keine Erfahrung mit strukturierter Schulungsarbeit"],
    criticalConstraints: ["Der Markt fuer solche Rollen ist kleiner"],
    entryRealism: "with_bridge" as const,
    nextValidationStep:
      "Halte eine kurze interne Schulung und lass dir Rueckmeldung zur Verstaendlichkeit geben.",
  },
];

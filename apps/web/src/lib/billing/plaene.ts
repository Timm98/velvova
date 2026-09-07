/**
 * Die drei Pläne — und was sie voneinander unterscheidet.
 *
 * Hier stand vorher: „Zwei Pläne, nicht drei. Es kommt dazu, wenn es
 * einen Grund gibt — nicht auf Verdacht." Der Grund ist da, und er ist
 * kein Preisgrund, sondern ein Produktgrund: `max` ist nicht Premium
 * mit höheren Zahlen. Es ist ein anderer Umgang mit derselben Aufgabe.
 *
 *   **Free** beantwortet Fragen, wenn man sie stellt.
 *   **Premium** beantwortet sie gründlicher und öfter.
 *   **Max** stellt sie von selbst — Monday beobachtet, vergleicht,
 *   erinnert und begleitet, auch wenn niemand hinsieht.
 *
 * Das ist der einzige Unterschied, der eine dritte Spalte rechtfertigt.
 * Eine Stufe, die nur „mehr Kontingent" bedeutet, wäre eine Spalte in
 * einer Tabelle, die niemand liest.
 *
 * Die Leitlinie beim Zuschnitt bleibt: **Free muss ehrlich nützlich
 * sein.** Wer nicht zahlt, bekommt keine Demoversion, sondern ein
 * kleineres, vollständiges Produkt. Was ausdrücklich NICHT hinter der
 * Schranke liegt:
 *
 *   - das Karrieregespräch selbst,
 *   - das Sehen von Stellen und die begründete Passung,
 *   - das Vorbereiten einer Bewerbung,
 *   - der Arbeitswelt-Radar,
 *   - der eigene Datenexport und die Löschung.
 *
 * Ein Produkt, das seine Kernaussage hinter Bezahlung stellt, kann sie
 * nicht mehr beweisen.
 *
 * Und eine Grenze, die keine Preisfrage ist: **Monday antwortet nie
 * absichtlich schlechter, weil jemand Free benutzt.** Der Unterschied
 * entsteht durch Funktionen, laufende Beobachtung und zusätzliche
 * Analysen — nicht durch künstlich verschlechterte Antworten.
 */

export type PlanKey = "free" | "premium" | "max";

export interface Plan {
  key: PlanKey;
  name: string;
  /** Ein Satz, warum es diesen Plan gibt. Steht gross auf der Karte. */
  claim: string;
  /** Das kleine Etikett darüber. */
  label: string;
  preisMonatCent: number;
  /**
   * Die fünf Punkte, die auf der Karte stehen.
   *
   * Fünf, nicht fünfzehn. Eine Liste, die scrollt, wird nicht gelesen —
   * sie wird überflogen und erzeugt das Gefühl, etwas zu übersehen. Der
   * vollständige Vergleich liegt eine Handlung entfernt.
   */
  hauptvorteile: string[];
  /** Der vollständige Umfang, nach Themen geordnet. Für die Matrix. */
  gruppen: { titel: string; punkte: string[] }[];
}

/** Wie viele Stellen Free in der Liste sieht. Nicht null — nur weniger. */
const FREE_JOBS_SICHTBAR = 25;

export const PLAENE: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    label: "Dauerhaft kostenlos",
    claim: "Für deinen Einstieg.",
    preisMonatCent: 0,
    hauptvorteile: [
      "Karrieregespräch mit Monday",
      "Persönliches Karriereprofil",
      "Jobempfehlungen mit begründeter Passung",
      "Bewerbung vorbereiten",
      "Daten exportieren und löschen",
    ],
    gruppen: [
      {
        titel: "Gespräch und Profil",
        punkte: [
          "Karrieregespräch mit Monday",
          "Persönliches Karriereprofil",
          "Bestätigte Stärken statt Selbstauskunft",
          "Begrenzte Nutzung von Monday",
        ],
      },
      {
        titel: "Stellen",
        punkte: [
          "Grundlegende Jobempfehlungen",
          `Begrenzte Anzahl neuer Vorschläge (${FREE_JOBS_SICHTBAR} je Ansicht)`,
          "Basis-Matching mit Begründung",
          "Stellen speichern",
          "Grundlegende Jobanalyse",
        ],
      },
      { titel: "Bewerbung", punkte: ["Einfache Bewerbungsvorbereitung"] },
      { titel: "Weiteres", punkte: ["Arbeitswelt-Radar", "Datenexport und Löschung"] },
    ],
  },

  premium: {
    key: "premium",
    name: "Premium",
    label: "Für die aktive Suche",
    claim: "Für deine aktive Jobsuche.",
    preisMonatCent: 900,
    hauptvorteile: [
      "Unbegrenzte Jobvorschläge",
      "Tiefe Analyse jeder Stelle",
      "Vollständige Bewerbungsunterlagen",
      "Live-Gespräch mit Monday",
      "Fristen und Nachfassen im Blick",
    ],
    gruppen: [
      {
        titel: "Stellen verstehen",
        punkte: [
          "Unbegrenzte Jobvorschläge",
          "Vollständiges personalisiertes Matching",
          "Tiefere Analyse jeder Stelle",
          "Stärken und Schwächen des Matches",
          "Warnsignale in der Anzeige",
          "Was die Anzeige nicht sagt",
          "Fragen für das Vorstellungsgespräch",
          "Einschätzung des tatsächlichen Arbeitsalltags",
          "Gehaltsanalyse, sofern Daten vorliegen",
          "Unternehmensanalyse",
          "Bessere Priorisierung von Stellen",
          "Hinweise auf Aktualität, soweit belegbar",
        ],
      },
      {
        titel: "Bewerben",
        punkte: [
          "Vollständige Bewerbungsunterlagen",
          "Lebenslauf auf die konkrete Stelle zuschneiden",
          "Anschreiben erstellen",
          "Optimierung für automatisierte Vorauswahl",
          "Bewerbungen speichern und verwalten",
          "Bewerbungsstatus verfolgen",
          "Fristen und Nachfassen",
        ],
      },
      {
        titel: "Mit Monday arbeiten",
        punkte: [
          "Live-Gespräch mit Monday",
          "Monday in allen unterstützten Sprachen",
          "Ausführlichere Arbeitsmarktanalysen",
          "Persönliche Hinweise von Monday",
        ],
      },
    ],
  },

  max: {
    key: "max",
    name: "Max",
    label: "Vollständige Begleitung",
    claim: "Monday als persönlicher Career Agent.",
    preisMonatCent: 1900,
    hauptvorteile: [
      "Monday beobachtet laufend neue passende Stellen",
      "Mehrere Stellen im direkten Vergleich",
      "Karrierepfad, Skill-Lücken und Sackgassen",
      "Bewerbungsstrategie je Stelle",
      "Interviewübung mit Monday",
    ],
    gruppen: [
      {
        titel: "Career Agent",
        punkte: [
          "Monday beobachtet kontinuierlich passende neue Stellen",
          "Neue Chancen werden automatisch priorisiert",
          "Besonders passende Stellen werden hervorgehoben",
          "Hinweis bei relevanten Veränderungen",
          "Alle bisherigen Gespräche und Entscheidungen fliessen ein",
        ],
      },
      {
        titel: "Tiefe Job-Intelligenz",
        punkte: [
          "Unternehmen, Rolle und Karrierepfad zusammen betrachtet",
          "Langfristige Entwicklungsmöglichkeiten",
          "Mögliche Sackgassen erkennen",
          "Skill-Lücken-Analyse",
          "Karrierewert einer Stelle",
          "Mögliche nächste Positionen danach",
        ],
      },
      {
        titel: "Stellen vergleichen",
        punkte: [
          "Mehrere Stellen nebeneinander",
          "Aufgaben, Entwicklung, Gehalt, Arbeitsmodell",
          "Sicherheit, Karriereoptionen, persönliche Passung",
          "Risiken benannt statt weggelassen",
        ],
      },
      {
        titel: "Application Agent",
        punkte: [
          "Komplette Bewerbungsstrategie",
          "Unterlagen je Stelle zugeschnitten",
          "Interviewvorbereitung passend zur Stelle",
          "Nachfassen vorbereiten, Fristen überwachen",
        ],
      },
      {
        titel: "Interview Coach",
        punkte: [
          "Realistische Übungsgespräche mit Monday",
          "Auch als Sprachgespräch",
          "Fragen passend zur tatsächlichen Stelle",
          "Antworten gemeinsam verbessern",
          "Nur Inhalt und Aufbau — keine Bewertung von Stimme, Akzent oder Person",
        ],
      },
      {
        titel: "Career Memory",
        punkte: [
          "Monday behält Ziele, No-Gos und Gehaltsvorstellungen",
          "Bestätigte Stärken und bisherige Stationen",
          "Rückmeldungen zu Vorschlägen fliessen ein",
          "Veränderte Vorlieben werden berücksichtigt",
        ],
      },
    ],
  },
};

/** In der Reihenfolge, in der sie gezeigt werden. */
export const PLAN_REIHENFOLGE: PlanKey[] = ["free", "premium", "max"];

/** Rang für Vergleiche: höher heisst mehr enthalten. */
export const PLAN_RANG: Record<PlanKey, number> = { free: 0, premium: 1, max: 2 };

/**
 * Die Berechtigungen — die einzige Liste, die zählt.
 *
 * Bewusst benannte Fähigkeiten statt verstreuter Abfragen auf den
 * Plannamen. Wer `plan === "premium"` über die Codebasis verteilt,
 * sperrt beim Hinzufügen eines dritten Plans versehentlich das halbe
 * Produkt aus — genau das war hier der Ausgangszustand.
 *
 * Diese Namen entsprechen eins zu eins den Feldern, die die Oberfläche
 * abfragt, und ausgewertet werden sie ausschliesslich auf dem Server.
 */
export type Berechtigung =
  | "can_use_live_voice"
  | "can_use_deep_analysis"
  | "can_generate_documents"
  | "can_compare_jobs"
  | "can_use_job_monitoring"
  | "can_use_career_agent"
  | "can_use_interview_coach"
  | "can_use_all_languages"
  | "can_use_unlimited_jobs"
  | "can_track_applications";

/** Ab welchem Plan eine Fähigkeit gilt. */
export const BERECHTIGUNG_AB: Record<Berechtigung, PlanKey> = {
  can_use_unlimited_jobs: "premium",
  can_use_deep_analysis: "premium",
  can_generate_documents: "premium",
  can_use_live_voice: "premium",
  can_use_all_languages: "premium",
  can_track_applications: "premium",
  can_compare_jobs: "max",
  can_use_job_monitoring: "max",
  can_use_career_agent: "max",
  can_use_interview_coach: "max",
};

/**
 * Die Nutzungsgrenzen als Konfiguration.
 *
 * An einer Stelle, nicht über die Codebasis verteilt. Eine Grenze, die
 * in drei Dateien steht, ist in zweien davon irgendwann veraltet — und
 * eine falsche Grenze merkt niemand ausser der Person, die sie trifft.
 *
 * `null` heisst unbegrenzt. Nicht `Infinity` und nicht `-1`: beides
 * sind Zahlen, mit denen sich versehentlich rechnen lässt.
 */
export interface Grenzen {
  /** Wie viele Stellen die Liste zeigt. */
  jobsSichtbar: number | null;
  /** Tiefenanalysen je Monat. */
  tiefenanalysenProMonat: number | null;
  /** Erzeugte Bewerbungsunterlagen je Monat. */
  dokumenteProMonat: number | null;
  /** Nachrichten an Monday je Tag. */
  ninaNachrichtenProTag: number | null;
  /** Wie viele Stellen gleichzeitig verglichen werden dürfen. */
  jobsImVergleich: number;
  /** Wie viele Stellen laufend beobachtet werden. */
  beobachteteStellen: number;
}

export const GRENZEN: Record<PlanKey, Grenzen> = {
  free: {
    jobsSichtbar: FREE_JOBS_SICHTBAR,
    tiefenanalysenProMonat: 3,
    dokumenteProMonat: 2,
    ninaNachrichtenProTag: 30,
    jobsImVergleich: 0,
    beobachteteStellen: 0,
  },
  premium: {
    jobsSichtbar: null,
    tiefenanalysenProMonat: 100,
    dokumenteProMonat: 40,
    ninaNachrichtenProTag: 300,
    jobsImVergleich: 0,
    beobachteteStellen: 0,
  },
  max: {
    jobsSichtbar: null,
    tiefenanalysenProMonat: null,
    dokumenteProMonat: null,
    ninaNachrichtenProTag: null,
    jobsImVergleich: 5,
    beobachteteStellen: 50,
  },
};

/** Die alte Konstante bleibt gültig — sie liest jetzt aus den Grenzen. */
export const FREE_JOB_LIMIT = GRENZEN.free.jobsSichtbar ?? FREE_JOBS_SICHTBAR;

/**
 * Worauf Monday im Produkt hinweisen darf.
 *
 * Jeder Eintrag gehört zu einem Moment, in dem eine Fähigkeit
 * tatsächlich gebraucht würde — kein Werbeplatz. Der Text sagt, was
 * Monday zusätzlich tun könnte, nicht dass jemand etwas kaufen soll.
 *
 * Was hier nicht steht und nirgends stehen wird: künstliche Knappheit,
 * ablaufende Angebote, Erfolgsversprechen. Monday sagt nie, dass jemand
 * mit einem Plan einen Job findet.
 */
export const HINWEIS_TEXT: Record<Berechtigung, { titel: string; angebot: string }> = {
  can_use_deep_analysis: {
    titel: "Tiefenanalyse",
    angebot:
      "Ich kann diese Stelle genauer durchgehen: was die Anzeige verschweigt, welche Warnsignale darin stehen und was offen bleibt.",
  },
  can_use_unlimited_jobs: {
    titel: "Alle passenden Stellen",
    angebot: `Du siehst gerade die ersten ${FREE_JOBS_SICHTBAR}. Es gibt mehr, die zu dir passen.`,
  },
  can_generate_documents: {
    titel: "Für diese Stelle optimieren",
    angebot:
      "Ich kann Lebenslauf und Anschreiben auf genau diese Stelle zuschneiden, statt allgemein zu bleiben.",
  },
  can_compare_jobs: {
    titel: "Stellen vergleichen",
    angebot:
      "Ich kann diese Stellen auch nach Entwicklung, Karrierepfad und langfristigem Risiko miteinander vergleichen.",
  },
  can_use_job_monitoring: {
    titel: "Neue Stellen beobachten",
    angebot:
      "Ich kann laufend nach neuen passenden Stellen sehen und dir sagen, wenn eine besonders gut passt.",
  },
  can_use_career_agent: {
    titel: "Laufende Begleitung",
    angebot:
      "Ich kann im Hintergrund weiterarbeiten: neue Chancen einordnen, Fristen im Blick behalten, dich an das Nachfassen erinnern.",
  },
  can_use_interview_coach: {
    titel: "Interview üben",
    angebot:
      "Wir können das Gespräch zu dieser Stelle üben — mit den Fragen, die dort wahrscheinlich kommen.",
  },
  can_use_live_voice: {
    titel: "Live sprechen",
    angebot: "Wir können auch sprechen statt tippen — ich höre zu und lasse mich unterbrechen.",
  },
  can_use_all_languages: {
    titel: "In deiner Sprache",
    angebot: "Wir können das Gespräch und deine Unterlagen in jeder unterstützten Sprache führen.",
  },
  can_track_applications: {
    titel: "Bewerbungen verfolgen",
    angebot: "Ich kann den Stand deiner Bewerbungen mitführen und dich an das Nachfassen erinnern.",
  },
};

export function preisText(cent: number): string {
  return cent === 0
    ? "0 €"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(cent / 100);
}

import type { StageEvidence } from "./stages.ts";

/**
 * Wann darf Nina Jobs zeigen?
 *
 * Zwei Fehler wären möglich, und beide sind teuer:
 *
 *   **Zu früh.** Nach zwei oberflächlichen Antworten eine „perfekt
 *   passende“ Stelle zu präsentieren ist eine Behauptung über einen
 *   Menschen, den man nicht kennt. Sie kostet Vertrauen genau dann,
 *   wenn jemand gerade anfängt zu vertrauen.
 *
 *   **Zu spät.** Wer einen Fragebogen vollständig ausfüllen muss, bevor
 *   er ein einziges Ergebnis sieht, hört vorher auf. Der Nutzen liegt
 *   dann hinter einer Wand aus Arbeit.
 *
 * Deshalb drei Stufen statt eines Schalters — und eine Punktzahl, die
 * sich nachrechnen lässt. Kein Modell entscheidet das: die Punkte kommen
 * aus gezählten Daten, nicht aus einer Einschätzung.
 */

export type ReadinessState = "not_ready" | "exploratory" | "ready";

export interface ReadinessResult {
  state: ReadinessState;
  /** 0 bis 100. Nachvollziehbar aus den Beiträgen unten. */
  score: number;
  /** Was konkret fehlt — in der Sprache des Nutzers, nicht in Feldnamen. */
  missing: string[];
  /** Warum diese Stufe. Wird angezeigt, nicht nur protokolliert. */
  reason: string;
  /** Sind alle Mindestinformationen da? Zusätzlich zur Punktzahl. */
  minimumMet: boolean;
  /** Womit die Punkte zustande kamen. Für Erklärung und Test. */
  breakdown: { key: string; label: string; points: number; max: number }[];
}

export interface ReadinessInput extends StageEvidence {
  /** Hat der Mensch ausdrücklich zugestimmt, Jobs zu sehen? */
  userAgreedToSeeJobs: boolean;
  /** Hat er ausdrücklich danach verlangt? Überstimmt die Stufe. */
  userExplicitlyAskedForJobs: boolean;
}

/*
 * Die Gewichte.
 *
 * Belegte Erfahrung wiegt am schwersten, weil ohne sie jede Rangfolge
 * geraten ist. Die Zustimmung ist bewusst nur 5 Punkte wert: sie ist
 * eine Voraussetzung, kein Ersatz für Wissen.
 */
const BEITRÄGE: {
  key: string;
  label: string;
  max: number;
  punkte: (e: ReadinessInput) => number;
  fehltWenn: (e: ReadinessInput) => string | null;
}[] = [
  {
    key: "goal",
    label: "Ziel oder Veränderungswunsch",
    max: 12,
    punkte: (e) => (e.goals >= 1 ? 12 : 0),
    fehltWenn: (e) => (e.goals >= 1 ? null : "was sich für dich ändern soll"),
  },
  {
    key: "location",
    label: "Ort bzw. Jobmarkt",
    max: 10,
    punkte: (e) => (e.hasLocation ? 10 : 0),
    fehltWenn: (e) => (e.hasLocation ? null : "wo du arbeiten möchtest"),
  },
  {
    key: "remote",
    label: "Remote- und Mobilitätspräferenz",
    max: 8,
    punkte: (e) => (e.hasRemotePreference ? 8 : 0),
    fehltWenn: (e) => (e.hasRemotePreference ? null : "wie oft du vor Ort sein willst"),
  },
  {
    key: "evidence",
    label: "Belegte Fähigkeiten oder Erfahrungen",
    max: 25,
    // Drei sind das Minimum, fünf der volle Wert. Dazwischen linear —
    // die vierte Erfahrung ist wirklich mehr wert als keine vierte.
    punkte: (e) => Math.min(25, Math.round((Math.min(e.careerEvidence + e.skills, 5) / 5) * 25)),
    fehltWenn: (e) =>
      e.careerEvidence + e.skills >= 3
        ? null
        : `noch ${3 - (e.careerEvidence + e.skills)} konkrete Beispiel(e) aus deiner Erfahrung`,
  },
  {
    key: "preferred",
    label: "Bevorzugte Tätigkeiten",
    max: 12,
    punkte: (e) => Math.min(12, e.preferredTasks * 6),
    fehltWenn: (e) =>
      e.preferredTasks >= 2 ? null : "was du an deiner Arbeit gern machst",
  },
  {
    key: "disliked",
    label: "Zu vermeidende Tätigkeiten",
    max: 8,
    punkte: (e) => (e.dislikedTasks >= 1 ? 8 : 0),
    fehltWenn: (e) => (e.dislikedTasks >= 1 ? null : "was du künftig vermeiden möchtest"),
  },
  {
    key: "values",
    label: "Wichtige Jobwerte",
    max: 10,
    punkte: (e) => Math.min(10, e.values * 5),
    fehltWenn: (e) => (e.values >= 2 ? null : "was dir an einem Arbeitsplatz wichtig ist"),
  },
  {
    key: "constraints",
    label: "Harte Bedingungen",
    max: 8,
    punkte: (e) => (e.constraints >= 1 ? 8 : 0),
    fehltWenn: (e) => (e.constraints >= 1 ? null : "deine festen Bedingungen"),
  },
  {
    key: "direction",
    label: "Plausible Rollenrichtung",
    max: 12,
    punkte: (e) => (e.roleHypotheses >= 1 ? 12 : 0),
    fehltWenn: (e) => (e.roleHypotheses >= 1 ? null : "eine berufliche Richtung, die wir prüfen"),
  },
  {
    key: "consent",
    label: "Zustimmung, Jobs zu sehen",
    max: 5,
    punkte: (e) => (e.userAgreedToSeeJobs ? 5 : 0),
    fehltWenn: (e) => (e.userAgreedToSeeJobs ? null : "deine Zustimmung, Stellen anzusehen"),
  },
];

/** Die Mindestinformationen. Ohne sie ist kein `ready` möglich, egal wie viele Punkte. */
function mindestinfosErfüllt(e: ReadinessInput): boolean {
  return (
    e.goals >= 1 &&
    e.hasLocation &&
    e.hasRemotePreference &&
    e.careerEvidence + e.skills >= 3 &&
    e.preferredTasks >= 2 &&
    e.dislikedTasks >= 1 &&
    e.values >= 2 &&
    e.roleHypotheses >= 1 &&
    e.userAgreedToSeeJobs
  );
}

export function evaluateReadiness(input: ReadinessInput): ReadinessResult {
  const breakdown = BEITRÄGE.map((b) => ({
    key: b.key,
    label: b.label,
    points: b.punkte(input),
    max: b.max,
  }));

  const score = breakdown.reduce((summe, b) => summe + b.points, 0);
  const missing = BEITRÄGE.map((b) => b.fehltWenn(input)).filter((x): x is string => x !== null);
  const minimumMet = mindestinfosErfüllt(input);

  /*
   * Ein ausdrücklicher Wunsch schlägt die Punktzahl.
   *
   * „Zeig mir Jobs“ ist keine Frage, die man mit „erst noch acht
   * Antworten“ beantwortet. Nina zeigt dann etwas — und sagt in
   * derselben Nachricht, was für eine verlässlichere Reihenfolge fehlt.
   * Was hier NICHT passiert: so zu tun, als wäre die Reihenfolge
   * belastbar.
   */
  if (input.userExplicitlyAskedForJobs && score < 70) {
    return {
      state: "exploratory",
      score,
      missing,
      minimumMet,
      breakdown,
      reason:
        "Du hast ausdrücklich nach Stellen gefragt. Ich zeige dir erste Vorschläge — " +
        "für eine verlässlichere Reihenfolge fehlt mir aber noch etwas.",
    };
  }

  if (score >= 70 && minimumMet) {
    return {
      state: "ready",
      score,
      missing: [],
      minimumMet,
      breakdown,
      reason: "Ich habe genug verstanden, um dir eine sinnvoll gerankte Jobliste zu zeigen.",
    };
  }

  if (score >= 45) {
    return {
      state: "exploratory",
      score,
      missing,
      minimumMet,
      breakdown,
      reason:
        "Ich habe schon genug verstanden, um dir erste Richtungen zu zeigen. " +
        "Die Einschätzung ist noch vorläufig.",
    };
  }

  return {
    state: "not_ready",
    score,
    missing,
    minimumMet,
    breakdown,
    reason:
      missing.length > 0
        ? `Für eine sinnvolle Auswahl fehlt mir noch: ${missing.slice(0, 3).join(", ")}.`
        : "Ich brauche noch ein paar Angaben, bevor eine Auswahl sinnvoll ist.",
  };
}

/**
 * Wie viele Ergebnisse darf Nina jetzt zeigen?
 *
 * Nie mehr als drei im Gespräch — auch bei `ready` nicht. Die
 * vollständige Liste hat eine eigene Seite; ein Gespräch ist der
 * falsche Ort für zwanzig Anzeigen.
 */
export function allowedResultCount(state: ReadinessState): number {
  return state === "not_ready" ? 0 : 3;
}

/**
 * Erkennt eine ausdrückliche Jobanfrage.
 *
 * Bewusst eine Wortliste und kein Modellaufruf: die Entscheidung fällt
 * vor dem Modellaufruf und muss deterministisch sein. Ein Modell, das
 * beurteilt, ob es Jobs zeigen darf, beurteilt sich selbst.
 */
const JOBWUNSCH =
  /\b(zeig|zeige|zeigen|sehen|sieh|schau|such|suche|finde|gib|hast?)\b[^.?!]{0,40}\b(jobs?|stellen?|stellenangebote?|anzeigen?|vorschläge?|möglichkeiten)\b|\b(jobs?|stellen)\b[^.?!]{0,20}\b(zeigen|sehen|anschauen)\b/i;

export function looksLikeJobRequest(message: string): boolean {
  return JOBWUNSCH.test(message);
}

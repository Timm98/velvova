import type { AiTransitionResult, Job, TaskExposure } from "@paycheck/domain";
import { SCORING_VERSION } from "@paycheck/domain";

/**
 * AI Transition Radar.
 *
 * Die Frage "verschwindet dieser Beruf?" ist die falsche Frage. Generative
 * KI trifft Aufgabenbündel, nicht Berufsbezeichnungen: derselbe Jobtitel
 * kann zu 70 % aus standardisierbarer Informationsarbeit bestehen oder zu
 * 70 % aus Aushandlung mit Menschen. Deshalb bewerten wir Aufgaben.
 *
 * Ausgabe sind Szenarien, nie ein Datum. Ein Satz wie "dieser Beruf ist in
 * fünf Jahren weg" ist im gesamten Produkt unzulässig.
 */

/** Merkmale, die eine Aufgabe automatisierbar machen. */
const AUTOMATABLE = [
  "daten erfassen", "eingeben", "dokumentieren", "protokoll", "zusammenfassen",
  "recherchieren", "sortieren", "kategorisieren", "standardisiert", "routine",
  "berichte erstellen", "auswerten", "formatieren", "übersetzen", "texte schreiben",
  "termine koordinieren", "stammdaten", "rechnungen", "reporting",
];

/** Merkmale, die menschlich bleiben: Urteil, Verantwortung, Beziehung, Körper. */
const HUMAN_CORE = [
  "verhandeln", "entscheiden", "verantwortung", "beraten", "betreuen", "führen",
  "konflikt", "vertrauen", "beziehung", "vor ort", "montage", "pflege", "präsentieren",
  "ueberzeugen", "eskalation", "kunde persoenlich", "team anleiten", "priorisieren",
];

/** Aufgaben, bei denen KI vor allem verstaerkt statt ersetzt. */
const AUGMENTABLE = [
  "analysieren", "entwerfen", "konzipieren", "planen", "optimieren", "recherchieren",
  "kampagne", "content", "code", "test", "prozess", "auswerten", "vorbereiten",
];

function hits(task: string, needles: string[]): number {
  const t = task.toLowerCase();
  return needles.filter((n) => t.includes(n)).length;
}

function classifyTask(task: string): TaskExposure {
  const auto = hits(task, AUTOMATABLE);
  const human = hits(task, HUMAN_CORE);
  const aug = hits(task, AUGMENTABLE);

  const automationExposure = Math.min(1, Math.max(0, auto * 0.3 - human * 0.25 + 0.15));
  const augmentationPotential = Math.min(1, Math.max(0, aug * 0.28 + auto * 0.12 + 0.2));

  const humanCore = human > 0
    ? "Urteil, Verantwortung und der direkte Umgang mit Menschen bleiben bei dir."
    : auto > 0
      ? "Der menschliche Anteil liegt vor allem in Priorisierung und Qualitätskontrolle."
      : "Der menschliche Anteil dieser Aufgabe ist aus der Anzeige nicht klar erkennbar.";

  const likelyChange = automationExposure > 0.55
    ? "Der Routineanteil dürfte deutlich schrumpfen. Was bleibt, ist Prüfen, Einordnen und Verantworten."
    : augmentationPotential > 0.55
      ? "Werkzeuge duerften den ersten Entwurf übernehmen. Die Qualität hängt dann staerker an deinem Urteil."
      : "Kurzfristig ist wenig Veränderung erkennbar; die Datenlage trägt aber keine starke Aussage.";

  return { task, automationExposure: round2(automationExposure), augmentationPotential: round2(augmentationPotential), humanCore, likelyChange };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

export interface AiTransitionInput {
  job: Job;
  /** Stand der zugrunde liegenden Marktdaten. Wird im UI immer gezeigt. */
  dataAsOf?: Date | null;
}

export function computeAiTransition(input: AiTransitionInput): AiTransitionResult {
  const { job } = input;

  if (job.coreTasks.length === 0) {
    return {
      category: "unclear_data",
      tasks: [],
      complementarySkills: [],
      reskillingEffort: "unknown",
      country: job.country,
      industry: job.industry,
      dataAsOf: input.dataAsOf ?? null,
      confidence: "low",
      scenarios: [{
        title: "Keine Aussage möglich",
        description:
          "Die Anzeige beschreibt keine konkreten Aufgaben. Ohne Aufgaben lässt sich nicht sagen, " +
          "was sich verändern könnte. Frag im Gespräch, wie ein typischer Arbeitstag aussieht.",
      }],
      version: SCORING_VERSION,
    };
  }

  const tasks = job.coreTasks.map(classifyTask);
  const avgAuto = tasks.reduce((s, t) => s + t.automationExposure, 0) / tasks.length;
  const avgAug = tasks.reduce((s, t) => s + t.augmentationPotential, 0) / tasks.length;

  const category = avgAug >= 0.55 && avgAuto < 0.55
    ? "strongly_augmentable"
    : avgAuto >= 0.55
      ? "partly_transformable"
      : avgAuto < 0.35 && avgAug < 0.45
        ? "relatively_robust"
        : "partly_transformable";

  const complementarySkills = category === "relatively_robust"
    ? ["Werkzeuge sinnvoll auswaehlen", "Ergebnisse prüfen statt übernehmen"]
    : [
        "Aufgaben so beschreiben, dass Werkzeuge sie zuverlaessig loesen",
        "Ergebnisse fachlich prüfen und Fehler erkennen",
        "Entscheidungen begründen und verantworten",
        ...(avgAuto > 0.5 ? ["Prozesse gestalten statt Schritte ausführen"] : []),
      ];

  const reskillingEffort = avgAuto >= 0.6 ? "medium" : avgAuto >= 0.4 ? "low" : "low";

  // Bewusst mehrere Szenarien statt einer Prognose.
  const scenarios = [
    {
      title: "Werkzeuge übernehmen den ersten Entwurf",
      description:
        `Die wiederkehrenden Anteile dieser Rolle laufen zunehmend werkzeuggestuetzt. ` +
        `Dein Beitrag verschiebt sich zum Prüfen, Einordnen und Entscheiden. ` +
        `Das ist die heute wahrscheinlichste Richtung, keine Gewissheit.`,
    },
    {
      title: "Der Zuschnitt der Rolle bleibt weitgehend",
      description:
        `Wo Verantwortung, Aushandlung oder Präsenz im Mittelpunkt stehen, ändert sich der Kern wenig. ` +
        `Die Werkzeuge treten daneben, nicht an die Stelle.`,
    },
    {
      title: "Die Rolle waechst um neue Aufgaben",
      description:
        `Wenn Routine wegfaellt, entsteht Raum. In vielen Fällen füllt er sich mit Aufgaben, ` +
        `die vorher liegen blieben - Qualität, Abstimmung, Weiterentwicklung.`,
    },
  ];

  const confidence = job.coreTasks.length >= 4 ? "medium" : "low";

  return {
    category, tasks, complementarySkills, reskillingEffort,
    country: job.country, industry: job.industry,
    dataAsOf: input.dataAsOf ?? null,
    confidence, scenarios, version: SCORING_VERSION,
  };
}

import {
  INTERVIEW_STAGE_ORDER,
  REQUIRED_STAGES,
  type EvidenceItem,
  type InterviewSession,
  type InterviewStage,
} from "@paycheck/domain";
import { QUESTIONS_BY_STAGE, STAGE_LABELS, followUpText, questionText, type Question } from "./questions.ts";

/**
 * Die Interview-Maschine.
 *
 * Adaptiv heisst hier: was schon sicher bekannt ist, wird nicht noch einmal
 * gefragt. Wer im Lebenslauf zwei Jahre Kundenservice stehen hat, soll nicht
 * gefragt werden, ob er Berufserfahrung hat - das ist der haeufigste Grund,
 * warum solche Gespräche sich wie Formulare anfuehlen.
 *
 * Umgekehrt gilt: wo etwas unsicher ist, wird gezielt nachgefragt statt
 * angenommen.
 */

export interface InterviewState {
  session: InterviewSession;
  evidence: EvidenceItem[];
  locale: "de" | "en";
  /** Fragen, die in dieser Sitzung bereits gestellt wurden. */
  askedKeys: string[];
  /** Fragen, die der Mensch uebersprungen hat. Werden nicht wiederholt. */
  skippedKeys: string[];
}

export interface NextStep {
  kind: "question" | "follow_up" | "stage_complete" | "interview_complete";
  stage: InterviewStage;
  questionKey: string | null;
  text: string;
  /** Verständlicher Themenname für die Fortschrittsanzeige. */
  stageLabel: string;
  /** Was dieses Thema beitragen soll - wird im Produkt angezeigt. */
  purpose: string;
  canSkip: boolean;
}

const PURPOSE: Record<string, { de: string; en: string }> = {
  consent_and_goal: {
    de: "Damit klar ist, worauf die Suche ueberhaupt zielt.",
    en: "So it is clear what the search is aiming at.",
  },
  experience_episodes: {
    de: "Konkrete Beispiele sind die Grundlage für alles Spätere - ohne sie bleibt jede Bewerbung allgemein.",
    en: "Concrete examples underpin everything later - without them every application stays generic.",
  },
  tasks_and_energy: {
    de: "Was du kannst und was dir gut tut, sind zwei verschiedene Dinge. Beides zählt.",
    en: "What you can do and what suits you are two different things. Both count.",
  },
  hard_constraints: {
    de: "Diese Grenzen werden nie stillschweigend uebergangen.",
    en: "These limits are never quietly overridden.",
  },
  location_and_logistics: {
    de: "Der Arbeitsweg entscheidet oft mehr über Zufriedenheit als der Jobtitel.",
    en: "The commute often decides more about satisfaction than the job title.",
  },
};

function purposeFor(stage: InterviewStage, locale: "de" | "en"): string {
  const p = PURPOSE[stage];
  if (p) return locale === "en" ? p.en : p.de;
  return locale === "en" ? "Helps complete the picture." : "Vervollständigt das Bild.";
}

/**
 * Gilt ein Thema als ausreichend verstanden? Nicht "wurde gefragt", sondern
 * "es liegt etwas Verwertbares vor".
 */
export function stageIsCovered(stage: InterviewStage, evidence: EvidenceItem[]): boolean {
  const alive = evidence.filter((e) => e.deletedAt === null && !e.userRejected);
  const bySource = (ref: string) => alive.filter((e) => e.sourceRef?.includes(ref));

  switch (stage) {
    case "experience_episodes":
      // Mindestens zwei belegte Episoden - eine einzelne traegt kein Profil.
      return bySource("experience_episodes").filter((e) => e.userConfirmed).length >= 2;
    case "hard_constraints":
      return bySource("hard_constraints").length >= 1;
    case "tasks_and_energy":
      return bySource("tasks_and_energy").length >= 2;
    default:
      return bySource(stage).length >= 1;
  }
}

export function hasWorkExperience(evidence: EvidenceItem[]): boolean {
  return evidence.some(
    (e) => e.type === "experience_episode" && e.deletedAt === null && !e.userRejected && e.userConfirmed,
  );
}

/**
 * Der naechste Schritt. Immer genau einer - das Produkt zeigt nie zwei
 * Hauptfragen gleichzeitig.
 */
export function nextStep(state: InterviewState): NextStep {
  const { session, evidence, locale } = state;
  const handled = new Set([...session.completedStages, ...session.skippedStages]);
  const withExperience = hasWorkExperience(evidence);

  const contentStages = INTERVIEW_STAGE_ORDER.filter(
    (s) => s !== "synthesis" && s !== "user_confirmation" && s !== "role_clusters" && s !== "micro_work_samples",
  );

  for (const stage of contentStages) {
    if (handled.has(stage)) continue;

    const pool = QUESTIONS_BY_STAGE[stage] ?? [];
    const open = pool.filter((q) => !state.askedKeys.includes(q.key) && !state.skippedKeys.includes(q.key));

    if (open.length === 0) {
      // Alle Fragen des Themas gestellt. Reicht das Ergebnis?
      if (stageIsCovered(stage, evidence) || pool.length === 0) {
        return {
          kind: "stage_complete",
          stage,
          questionKey: null,
          text:
            locale === "en"
              ? `Understood. Let's move on.`
              : `Verstanden. Dann weiter zum naechsten Thema.`,
          stageLabel: STAGE_LABELS[stage]![locale],
          purpose: purposeFor(stage, locale),
          canSkip: false,
        };
      }
      // Nichts Verwertbares trotz aller Fragen: ehrlich weitergehen statt bohren.
      return {
        kind: "stage_complete",
        stage,
        questionKey: null,
        text:
          locale === "en"
            ? `We can come back to this later - it does not have to be settled now.`
            : `Darauf koennen wir später zurueckkommen, das muss jetzt nicht geklaert sein.`,
        stageLabel: STAGE_LABELS[stage]![locale],
        purpose: purposeFor(stage, locale),
        canSkip: false,
      };
    }

    const q = open[0]!;
    return {
      kind: "question",
      stage,
      questionKey: q.key,
      text: questionText(q, locale, withExperience),
      stageLabel: STAGE_LABELS[stage]![locale],
      purpose: purposeFor(stage, locale),
      canSkip: true,
    };
  }

  return {
    kind: "interview_complete",
    stage: "synthesis",
    questionKey: null,
    text:
      locale === "en"
        ? "That is enough for a first picture. Let me summarise what I understood - you can correct anything."
        : "Das reicht für ein erstes Bild. Ich fasse zusammen, was ich verstanden habe - du kannst alles korrigieren.",
    stageLabel: STAGE_LABELS.synthesis![locale],
    purpose:
      locale === "en"
        ? "Nothing counts until you have confirmed it."
        : "Nichts davon zählt, bevor du es bestätigt hast.",
    canSkip: false,
  };
}

/**
 * Braucht eine Antwort eine Vertiefung? Kriterium ist nicht die Länge
 * allein, sondern ob etwas Konkretes darin steht - eine Handlung, ein
 * Ergebnis, ein Beispiel.
 */
export function needsFollowUp(answer: string, question: Question): boolean {
  const trimmed = answer.trim();
  if (trimmed.length < 40) return true;
  if (!followUpText(question, "de")) return false;

  const concreteMarkers =
    /\b(ich habe|ich hab|dann|danach|zuerst|zum beispiel|konkret|etwa|rund|ungefaehr|\d+)\b/i;
  return !concreteMarkers.test(trimmed);
}

export function followUpStep(question: Question, state: InterviewState): NextStep | null {
  const text = followUpText(question, state.locale);
  if (!text) return null;
  return {
    kind: "follow_up",
    stage: question.stage,
    questionKey: `${question.key}:follow_up`,
    text,
    stageLabel: STAGE_LABELS[question.stage]![state.locale],
    purpose: purposeFor(question.stage, state.locale),
    canSkip: true,
  };
}

export interface ProgressView {
  understood: number;
  total: number;
  /** Themen mit Namen und Zustand - für die Anzeige "3 von 7 verstanden". */
  topics: { stage: InterviewStage; label: string; state: "done" | "skipped" | "open" }[];
  minimumProfileReached: boolean;
  missingForMinimum: string[];
}

export function progressView(state: InterviewState): ProgressView {
  const contentStages = INTERVIEW_STAGE_ORDER.filter(
    (s) => s !== "synthesis" && s !== "user_confirmation" && s !== "role_clusters",
  );
  const done = new Set(state.session.completedStages);
  const skipped = new Set(state.session.skippedStages);

  const topics = contentStages.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage]![state.locale],
    state: done.has(stage) ? ("done" as const) : skipped.has(stage) ? ("skipped" as const) : ("open" as const),
  }));

  const missing = REQUIRED_STAGES.filter((s) => !done.has(s));

  return {
    understood: topics.filter((t) => t.state === "done").length,
    total: topics.length,
    topics,
    minimumProfileReached: missing.length === 0,
    missingForMinimum: missing.map((s) => STAGE_LABELS[s]![state.locale]),
  };
}

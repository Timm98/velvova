import { z } from "zod";

/**
 * Adaptives Karriereinterview. Der Ablauf ist eine Zustandsmaschine, kein
 * starrer Fragebogen: bereits sicher bekannte Themen werden übersprungen,
 * unsichere gezielt nachgefragt.
 */

export const InterviewStageSchema = z.enum([
  "consent_and_goal",
  "current_situation",
  "background",
  "experience_episodes",
  "tasks_and_energy",
  "feedback_and_recognition",
  "work_style_and_environment",
  "values_and_motives",
  "hard_constraints",
  "location_and_logistics",
  "learning_goals",
  "micro_work_samples",
  "synthesis",
  "user_confirmation",
  "role_clusters",
]);
export type InterviewStage = z.infer<typeof InterviewStageSchema>;

/** Reihenfolge der Themen. Mindestens diese Bereiche müssen abgedeckt sein. */
export const INTERVIEW_STAGE_ORDER: readonly InterviewStage[] = [
  "consent_and_goal", "current_situation", "background", "experience_episodes",
  "tasks_and_energy", "feedback_and_recognition", "work_style_and_environment",
  "values_and_motives", "hard_constraints", "location_and_logistics",
  "learning_goals", "micro_work_samples", "synthesis", "user_confirmation",
  "role_clusters",
] as const;

/** Themen, ohne die kein Mindestprofil zustande kommt. */
export const REQUIRED_STAGES: readonly InterviewStage[] = [
  "consent_and_goal", "current_situation", "experience_episodes",
  "tasks_and_energy", "hard_constraints", "location_and_logistics",
] as const;

export const InterviewSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mode: z.enum(["text", "voice"]),
  locale: z.enum(["de", "en"]),
  stage: InterviewStageSchema,
  /** Themen, die als verstanden gelten. Grundlage der Fortschrittsanzeige. */
  completedStages: z.array(InterviewStageSchema).default([]),
  /** Themen, die der Mensch bewusst übersprungen hat. */
  skippedStages: z.array(InterviewStageSchema).default([]),
  status: z.enum(["active", "paused", "completed", "abandoned"]),
  startedAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable().default(null),
});
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;

export const InterviewTurnSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  index: z.number().int().nonnegative(),
  role: z.enum(["assistant", "user", "system"]),
  stage: InterviewStageSchema,
  /** Schlüssel der gestellten Frage, damit Auswertung stabil bleibt. */
  questionKey: z.string().nullable(),
  content: z.string(),
  /** Bei Sprachmodus: wurde das Transkript gespeichert? Braucht Einwilligung. */
  fromVoice: z.boolean().default(false),
  createdAt: z.date(),
});
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;

/** Fortschritt als Themenbereiche, nicht als scheingenaue Prozentzahl. */
export interface InterviewProgress {
  understoodTopics: number;
  totalTopics: number;
  /** Was als Nächstes fehlt, in der Sprache des Menschen. */
  nextTopicLabel: string | null;
  minimumProfileReached: boolean;
}

export function computeProgress(session: InterviewSession, labels: Record<InterviewStage, string>): InterviewProgress {
  const relevant = INTERVIEW_STAGE_ORDER.filter(
    (s) => s !== "synthesis" && s !== "user_confirmation" && s !== "role_clusters",
  );
  const handled = new Set([...session.completedStages, ...session.skippedStages]);
  const done = relevant.filter((s) => handled.has(s));
  const next = relevant.find((s) => !handled.has(s)) ?? null;
  return {
    understoodTopics: done.length,
    totalTopics: relevant.length,
    nextTopicLabel: next ? labels[next] : null,
    minimumProfileReached: REQUIRED_STAGES.every((s) => session.completedStages.includes(s)),
  };
}

/**
 * Personalisierte Jobempfehlungen bleiben gesperrt, bis ein Mindestprofil
 * vorliegt und der Mensch es ausdrücklich bestätigt hat.
 */
export interface MinimumProfileGate {
  unlocked: boolean;
  missingStages: InterviewStage[];
  profileConfirmed: boolean;
  reason: string;
}

export function evaluateGate(
  session: InterviewSession | null,
  profileConfirmed: boolean,
): MinimumProfileGate {
  if (!session) {
    return {
      unlocked: false,
      missingStages: [...REQUIRED_STAGES],
      profileConfirmed: false,
      reason: "Es wurde noch kein Karrieregespräch begonnen.",
    };
  }
  const handled = new Set(session.completedStages);
  const missing = REQUIRED_STAGES.filter((s) => !handled.has(s));
  if (missing.length > 0) {
    return {
      unlocked: false,
      missingStages: missing,
      profileConfirmed,
      reason: `Es fehlen noch ${missing.length} Themen, bevor Empfehlungen sinnvoll sind.`,
    };
  }
  if (!profileConfirmed) {
    return {
      unlocked: false,
      missingStages: [],
      profileConfirmed: false,
      reason: "Das Profil muss noch von dir bestätigt werden.",
    };
  }
  return { unlocked: true, missingStages: [], profileConfirmed: true, reason: "Profil bestätigt." };
}

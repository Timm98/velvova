import { plural, pluralVerb } from "./plural.ts";
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

/**
 * ══════════════════════════════════════════════════════════════
 * Was jede Stufe über den Menschen weiss
 * ══════════════════════════════════════════════════════════════
 *
 * Vorher stand im Hinweis „Es fehlen noch 3 Themen, bevor
 * Empfehlungen sinnvoll sind." Der Satz zählte etwas, das niemand
 * sehen kann: Wer nie in den Code geschaut hat, weiss nicht, was ein
 * „Thema" ist, wie viele es gibt oder welche drei fehlen. Er las sich
 * wie eine Aufgabenliste ohne Aufgaben — drei Häkchen, die man
 * irgendwo abarbeiten soll.
 *
 * Es geht aber gar nicht um Aufgaben. Es geht darum, was wir über
 * einen Menschen wissen — und wenn etwas fehlt, ist das Ehrliche,
 * genau das zu benennen. „Ich weiss noch nicht, wo du arbeiten
 * kannst" sagt in einem Satz, was fehlt UND warum die Reihenfolge
 * ohne diese Angabe nicht zu begründen ist.
 *
 * Formuliert als das, was BEKANNT wäre — nicht als Frage. Es ist
 * kein Fragebogen, den jemand ausfüllt; es ist ein Gespräch, aus dem
 * sich das ergibt.
 */
const WAS_DIE_STUFE_WEISS: Partial<Record<InterviewStage, string>> = {
  consent_and_goal: "wonach du eigentlich suchst",
  current_situation: "wo du gerade stehst",
  experience_episodes: "was du bisher gemacht hast",
  tasks_and_energy: "welche Arbeit dir liegt",
  hard_constraints: "was für dich nicht infrage kommt",
  location_and_logistics: "wo du arbeiten kannst",
};

/**
 * Eine Aufzählung, wie man sie spricht: A, B und C.
 *
 * Bei mehr als drei fehlenden Angaben wird gekürzt. Sechs Halbsätze
 * hintereinander liest niemand — und eine Liste, die überfordert,
 * erreicht dasselbe wie gar keine.
 */
function alsAufzaehlung(teile: string[]): string {
  const gekuerzt = teile.length > 3 ? teile.slice(0, 3) : teile;
  const rest = teile.length - gekuerzt.length;
  const kern =
    gekuerzt.length === 1
      ? gekuerzt[0]!
      : `${gekuerzt.slice(0, -1).join(", ")} und ${gekuerzt.at(-1)}`;
  return rest > 0 ? `${kern} — und noch ${plural(rest, "eine Sache", "Sachen")}` : kern;
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
      reason:
        "Bisher weiss ich nichts über dich — die Liste zeigt deshalb, was neu ist, nicht was zu dir passt.",
    };
  }
  const handled = new Set(session.completedStages);
  const missing = REQUIRED_STAGES.filter((s) => !handled.has(s));
  if (missing.length > 0) {
    return {
      unlocked: false,
      missingStages: missing,
      profileConfirmed,
      /*
       * „Ich weiss noch nicht" und nicht „es fehlt": Das Zweite
       * klingt, als hätte der Mensch etwas versäumt. Versäumt hat
       * niemand etwas — wir haben nur noch nicht darüber gesprochen.
       */
      /*
       * `Partial`, weil es mehr Gesprächsstufen gibt als die sechs
       * verlangten. Beschrieben sind nur die, die im Riegel stehen —
       * für alles andere gäbe es hier nichts zu sagen. Der Rückfall
       * ist bewusst allgemein und nicht der technische Name: Der
       * gehört in kein Fenster, in das ein Mensch schaut.
       */
      reason: `Ich weiss noch nicht, ${alsAufzaehlung(
        missing.map((s) => WAS_DIE_STUFE_WEISS[s] ?? "was dir sonst noch wichtig ist"),
      )}.`,
    };
  }
  if (!profileConfirmed) {
    return {
      unlocked: false,
      missingStages: [],
      profileConfirmed: false,
      reason:
        "Ich habe alles zusammen — schau einmal drüber, ob es stimmt. Danach rechne ich damit.",
    };
  }
  return { unlocked: true, missingStages: [], profileConfirmed: true, reason: "Profil bestätigt." };
}

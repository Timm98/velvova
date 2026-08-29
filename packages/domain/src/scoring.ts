import { z } from "zod";

/**
 * Alle Bewertungen des Produkts. Bewusst getrennt gehalten:
 *
 *   Fit         - fachliche Passung zwischen Mensch und Stelle
 *   Confidence  - wie belastbar die Datenlage für diese Aussage ist
 *   Job Quality - wie gut die Stelle als Arbeitsplatz ist
 *   AI Transition - wie sich die Aufgaben durch KI verändern duerften
 *   Listing Confidence - wie vertrauenswürdig die Anzeige selbst ist
 *
 * Keiner davon ist eine Einstellungswahrscheinlichkeit. Diese Aussage
 * darf an keiner Stelle im Produkt getroffen werden.
 */

/** Version der Bewertungslogik. Wird pro Score gespeichert, damit ein
 *  altes Ergebnis nachvollziehbar bleibt, wenn die Formel sich ändert. */
export const SCORING_VERSION = "2026.08.1";

/** Wenn die Datenbasis dünn ist, zeigen wir keine Zahl, sondern ein Band. */
export const FitBandSchema = z.enum(["high", "medium", "exploratory", "insufficient_data"]);
export type FitBand = z.infer<typeof FitBandSchema>;

export const ScoreFactorSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** 0..1 vor Gewichtung. null heisst unbekannt und ist neutral. */
  raw: z.number().min(0).max(1).nullable(),
  weight: z.number().min(0).max(1),
  /** Beitrag zum Endwert nach Umverteilung unbekannter Gewichte. */
  contribution: z.number(),
  /** Ein Satz, der den Wert belegt oder das Unbekannte benennt. */
  explanation: z.string(),
  /** IDs bestätigter Evidenz, die diesen Faktor stuetzen. */
  evidenceIds: z.array(z.string()).default([]),
});
export type ScoreFactor = z.infer<typeof ScoreFactorSchema>;

export const FitResultSchema = z.object({
  /** 0..100. Nur zeigen, wenn coverage ausreicht - sonst band verwenden. */
  score: z.number().int().min(0).max(100).nullable(),
  band: FitBandSchema,
  /** Anteil der Gewichte, für die überhaupt Daten vorlagen. 0..1 */
  coverage: z.number().min(0).max(1),
  factors: z.array(ScoreFactorSchema),
  /** Der wichtigste Grund für die Passung. */
  topReason: z.string(),
  /** Der wichtigste Vorbehalt. Immer gefuellt - auch bei guter Passung. */
  topReservation: z.string(),
  version: z.string().default(SCORING_VERSION),
});
export type FitResult = z.infer<typeof FitResultSchema>;

export const ConfidenceResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(["high", "medium", "low"]),
  factors: z.array(ScoreFactorSchema),
  /** Was konkret fehlt, damit der Mensch es beheben kann. */
  reducedBy: z.array(z.string()),
  version: z.string().default(SCORING_VERSION),
});
export type ConfidenceResult = z.infer<typeof ConfidenceResultSchema>;

export const JobQualityResultSchema = z.object({
  score: z.number().int().min(0).max(100).nullable(),
  /** Bei zu dünner Datenlage steht hier true und score ist null. */
  insufficientData: z.boolean(),
  dimensions: z.array(ScoreFactorSchema),
  version: z.string().default(SCORING_VERSION),
});
export type JobQualityResult = z.infer<typeof JobQualityResultSchema>;

export const AiTransitionCategorySchema = z.enum([
  "strongly_augmentable",   // KI verstaerkt die Rolle deutlich
  "partly_transformable",   // Teile des Aufgabenbündels verschieben sich
  "relatively_robust",      // Kern bleibt weitgehend menschlich
  "unclear_data",           // Datenlage trägt keine Aussage
]);
export type AiTransitionCategory = z.infer<typeof AiTransitionCategorySchema>;

export const TaskExposureSchema = z.object({
  task: z.string(),
  /** 0..1 Anteil standardisierbarer Informationsarbeit in dieser Aufgabe. */
  automationExposure: z.number().min(0).max(1),
  /** 0..1 wie stark KI die Aufgabe verstaerken statt ersetzen dürfte. */
  augmentationPotential: z.number().min(0).max(1),
  /** Was menschlich bleibt: Urteil, Verantwortung, Beziehung, Körper. */
  humanCore: z.string(),
  likelyChange: z.string(),
});
export type TaskExposure = z.infer<typeof TaskExposureSchema>;

export const AiTransitionResultSchema = z.object({
  category: AiTransitionCategorySchema,
  tasks: z.array(TaskExposureSchema),
  /** Ergänzende Fähigkeiten, die die Rolle robuster machen. */
  complementarySkills: z.array(z.string()),
  reskillingEffort: z.enum(["low", "medium", "high", "unknown"]),
  country: z.string().length(2),
  industry: z.string().nullable(),
  /** Stand der zugrunde liegenden Daten. Immer sichtbar machen. */
  dataAsOf: z.date().nullable(),
  confidence: z.enum(["high", "medium", "low"]),
  /** Szenarien statt Prognose. Nie eine Jahreszahl für "verschwindet". */
  scenarios: z.array(z.object({ title: z.string(), description: z.string() })),
  version: z.string().default(SCORING_VERSION),
});
export type AiTransitionResult = z.infer<typeof AiTransitionResultSchema>;

export const ListingConfidenceResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(["high", "medium", "low"]),
  signals: z.array(
    z.object({ key: z.string(), label: z.string(), ok: z.boolean().nullable(), detail: z.string() }),
  ),
  /** Anzeige möglicherweise veraltet. Nie das Wort "Fake" ohne Beleg. */
  possiblyStale: z.boolean(),
  possibleRepost: z.boolean(),
  version: z.string().default(SCORING_VERSION),
});
export type ListingConfidenceResult = z.infer<typeof ListingConfidenceResultSchema>;

export const OverallRankingSchema = z.object({
  /** null, wenn zu viele Komponenten unbekannt sind. */
  score: z.number().int().min(0).max(100).nullable(),
  components: z.array(ScoreFactorSchema),
  /** Warum kein Gesamtwert gebildet wurde. */
  suppressedReason: z.string().nullable(),
  version: z.string().default(SCORING_VERSION),
});
export type OverallRanking = z.infer<typeof OverallRankingSchema>;

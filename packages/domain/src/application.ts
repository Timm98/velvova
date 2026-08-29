import { z } from "zod";

/** Bewerbungen, Dokumente und die Herkunft jeder einzelnen Aussage darin. */

export const ApplicationStageSchema = z.enum([
  "saved", "preparing", "sent", "acknowledged", "interview",
  "offer", "rejected", "withdrawn", "accepted",
]);
export type ApplicationStage = z.infer<typeof ApplicationStageSchema>;

export const APPLICATION_PIPELINE: readonly ApplicationStage[] = [
  "saved", "preparing", "sent", "acknowledged", "interview",
  "offer", "accepted", "rejected", "withdrawn",
] as const;

export const ApplicationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  jobId: z.string(),
  stage: ApplicationStageSchema,
  lastContactAt: z.date().nullable(),
  nextStepAt: z.date().nullable(),
  nextStepLabel: z.string().nullable(),
  notes: z.string().default(""),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Application = z.infer<typeof ApplicationSchema>;

/** Trichterereignisse. Grundlage des Application Funnel Debugger. */
export const ApplicationEventTypeSchema = z.enum([
  "job_viewed", "job_saved", "application_started", "application_sent",
  "acknowledged", "response_received", "interview_scheduled", "interview_held",
  "offer_received", "rejected", "withdrawn", "accepted",
  "fit_check_30", "fit_check_60", "fit_check_90",
]);
export type ApplicationEventType = z.infer<typeof ApplicationEventTypeSchema>;

export const ApplicationEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  applicationId: z.string().nullable(),
  jobId: z.string().nullable(),
  type: ApplicationEventTypeSchema,
  /** Rollencluster, damit die Diagnose nach Richtung trennen kann. */
  roleClusterId: z.string().nullable(),
  occurredAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type ApplicationEvent = z.infer<typeof ApplicationEventSchema>;

export const ArtifactKindSchema = z.enum([
  "cv_ats", "cv_designed", "cover_letter", "application_email",
  "portal_answers", "recruiter_message", "attachment_list", "portfolio_checklist",
]);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

export const GeneratedArtifactSchema = z.object({
  id: z.string(),
  userId: z.string(),
  applicationId: z.string(),
  kind: ArtifactKindSchema,
  locale: z.enum(["de", "en"]),
  version: z.number().int().positive(),
  content: z.string(),
  /** Welcher Prompt und welches Modell es erzeugt haben. */
  promptVersion: z.string().nullable(),
  aiRunId: z.string().nullable(),
  approvedByUser: z.boolean().default(false),
  createdAt: z.date(),
});
export type GeneratedArtifact = z.infer<typeof GeneratedArtifactSchema>;

/**
 * Claim-Provenienz. Jede pruefbare Behauptung in einem Dokument haengt an
 * bestaetigter Evidenz. Ohne diese Verknuepfung darf sie nicht in die
 * finale Fassung.
 */
export const ClaimSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  /** Der Satz, so wie er im Dokument steht. */
  text: z.string(),
  evidenceIds: z.array(z.string()),
  status: z.enum(["supported", "unsupported", "weakened", "user_override"]),
  /** Warum der Status so ist - erscheint im Studio als offener Punkt. */
  note: z.string(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export function claimStatus(evidenceIds: string[], confirmedIds: ReadonlySet<string>): Claim["status"] {
  if (evidenceIds.length === 0) return "unsupported";
  return evidenceIds.every((id) => confirmedIds.has(id)) ? "supported" : "weakened";
}

/** Ein Dokument ist erst versandfertig, wenn keine Aussage unbelegt ist. */
export function isArtifactSendable(claims: Claim[]): { ok: boolean; blockers: Claim[] } {
  const blockers = claims.filter((c) => c.status === "unsupported");
  return { ok: blockers.length === 0, blockers };
}

/** Versandvorschau. Der Mensch sieht genau das, bevor er freigibt. */
export const DeliveryPreviewSchema = z.object({
  recipient: z.string(),
  subject: z.string(),
  body: z.string(),
  attachments: z.array(
    z.object({ filename: z.string(), sizeBytes: z.number().int().nonnegative(), mimeType: z.string() }),
  ),
  locale: z.enum(["de", "en"]),
  /** true, wenn nichts wirklich versendet wird. Im UI deutlich markiert. */
  isDemo: z.boolean(),
  providerName: z.string(),
});
export type DeliveryPreview = z.infer<typeof DeliveryPreviewSchema>;

import { z } from "zod";
import { ContractTypeSchema, WorkModelSchema } from "./constraints.ts";

/** Normalisierte Stelle. Jede Quelle wird auf diese Form gebracht. */

export const RequirementKindSchema = z.enum(["must", "nice"]);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

export const JobRequirementSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  kind: RequirementKindSchema,
  /** Wortlaut aus der Anzeige, damit der Mensch es wiedererkennt. */
  text: z.string(),
  /** Auf die Taxonomie abgebildet, soweit möglich. */
  skillKey: z.string().nullable(),
  category: z.enum(["skill", "qualification", "language", "license", "experience", "other"]),
});
export type JobRequirement = z.infer<typeof JobRequirementSchema>;

export const SalarySchema = z.object({
  min: z.number().int().nonnegative().nullable(),
  max: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).default("EUR"),
  period: z.enum(["year", "month", "hour"]).default("year"),
  /** true, wenn die Anzeige gar nichts angibt. Nie als 0 behandeln. */
  disclosed: z.boolean(),
});
export type Salary = z.infer<typeof SalarySchema>;

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  companyId: z.string(),
  companyName: z.string(),
  location: z.string(),
  country: z.string().length(2).default("DE"),
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  workModel: WorkModelSchema,
  remotePercent: z.number().int().min(0).max(100).nullable(),
  salary: SalarySchema,
  contractType: ContractTypeSchema.nullable(),
  weeklyHours: z.number().nullable(),
  shiftWork: z.boolean().nullable(),
  travelPercent: z.number().int().min(0).max(100).nullable(),
  experienceLevel: z.enum(["entry", "junior", "mid", "senior", "lead"]).nullable(),
  industry: z.string().nullable(),
  languageRequirements: z.record(z.string(), z.string()).default({}),
  requiredLicenses: z.array(z.string()).default([]),
  workPermitRequired: z.boolean().nullable(),
  /** Was die Rolle tatsächlich tut - Grundlage des AI Transition Radar. */
  coreTasks: z.array(z.string()).default([]),
  description: z.string(),
  benefits: z.array(z.string()).default([]),
  applyMethod: z.enum(["email", "portal", "form", "unknown"]).default("unknown"),
  applyTarget: z.string().nullable(),
  publishedAt: z.date().nullable(),
  expiresAt: z.date().nullable(),
  /** Wann wir die Anzeige zuletzt tatsächlich gesehen haben. */
  fetchedAt: z.date(),
  lastLinkCheckAt: z.date().nullable(),
  lastLinkCheckOk: z.boolean().nullable(),
  originalUrl: z.string().nullable(),
  sourceId: z.string(),
  /** Inhaltshash zur Erkennung von Reposts derselben Stelle. */
  contentHash: z.string(),
  isDemo: z.boolean().default(false),
});
export type Job = z.infer<typeof JobSchema>;

/** Woher eine Stelle kommt und unter welcher Erlaubnis wir sie zeigen. */
export const JobSourceSchema = z.object({
  id: z.string(),
  key: z.string(),
  displayName: z.string(),
  kind: z.enum(["licensed_api", "employer_feed", "partner", "user_url", "user_text", "seed"]),
  /** Ohne geklaerte Lizenz wird eine Quelle nicht aktiviert. */
  licenseStatus: z.enum(["licensed", "public_link_only", "user_provided", "demo", "unclear"]),
  attributionRequired: z.boolean().default(false),
  attributionText: z.string().nullable(),
  termsUrl: z.string().nullable(),
  enabled: z.boolean().default(false),
});
export type JobSource = z.infer<typeof JobSourceSchema>;

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  sizeBand: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).nullable(),
  headquarters: z.string().nullable(),
  /** Aus einem offiziellen Register bestätigt, nicht aus der Anzeige. */
  registryVerified: z.boolean().default(false),
  isDemo: z.boolean().default(false),
});
export type Company = z.infer<typeof CompanySchema>;

/**
 * Bewertungsquellen. Die Art der Quelle wird immer sichtbar getrennt:
 * Google-Bewertungen sind ueberwiegend Kundenurteile und sagen für sich
 * genommen nichts über die Arbeitskultur.
 */
export const ReviewSourceKindSchema = z.enum([
  "employee_reviews", "customer_reviews", "employer_statement",
  "official_registry", "journalistic", "regulatory", "user_report",
]);
export type ReviewSourceKind = z.infer<typeof ReviewSourceKindSchema>;

export const ReviewAggregateSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  sourceKind: ReviewSourceKindSchema,
  sourceName: z.string(),
  sourceUrl: z.string().nullable(),
  ratingAverage: z.number().nullable(),
  ratingScaleMax: z.number().default(5),
  sampleSize: z.number().int().nonnegative().nullable(),
  /** Für welchen Standort und welche Rollen die Stichprobe gilt. */
  locationScope: z.string().nullable(),
  roleScope: z.string().nullable(),
  periodFrom: z.date().nullable(),
  periodTo: z.date().nullable(),
  fetchedAt: z.date(),
  attributionText: z.string().nullable(),
  /** Wie die Quelle selbst sortiert oder auswaehlt. Nie verschleiern. */
  selectionNote: z.string().nullable(),
  isDemo: z.boolean().default(false),
});
export type ReviewAggregate = z.infer<typeof ReviewAggregateSchema>;

export const ReviewThemeSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  aggregateId: z.string(),
  theme: z.string(),
  sentiment: z.enum(["positive", "negative", "mixed"]),
  mentionCount: z.number().int().nonnegative(),
  /** Kurze KI-Zusammenfassung. Im UI stets als solche gekennzeichnet. */
  summary: z.string(),
  sourceUrl: z.string().nullable(),
  periodFrom: z.date().nullable(),
  periodTo: z.date().nullable(),
});
export type ReviewTheme = z.infer<typeof ReviewThemeSchema>;

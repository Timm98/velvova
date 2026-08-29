import { z } from "zod";

/**
 * Harte Bedingungen des Menschen. Sie werden vor jedem Score geprueft und
 * niemals stillschweigend aufgeweicht - auch nicht, wenn eine Stelle sonst
 * hervorragend passt.
 */

export const WorkModelSchema = z.enum(["on_site", "hybrid", "remote"]);
export type WorkModel = z.infer<typeof WorkModelSchema>;

export const ContractTypeSchema = z.enum([
  "permanent", "fixed_term", "internship", "working_student",
  "apprenticeship", "freelance", "temp_agency",
]);
export type ContractType = z.infer<typeof ContractTypeSchema>;

export const CommuteModeSchema = z.enum(["walk", "bike", "public_transport", "car"]);
export type CommuteMode = z.infer<typeof CommuteModeSchema>;

export const UserConstraintsSchema = z.object({
  /** Untergrenze brutto pro Jahr in der Waehrung des Landes. */
  minSalaryPerYear: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).default("EUR"),
  /** Was einen niedrigeren Betrag ausnahmsweise ausgleichen koennte. */
  salaryTradeOffs: z.array(z.string()).default([]),

  baseLocation: z.string().nullable(),
  country: z.string().length(2).default("DE"),
  maxCommuteMinutes: z.number().int().positive().nullable(),
  commuteMode: CommuteModeSchema.default("public_transport"),
  acceptedWorkModels: z.array(WorkModelSchema).default(["on_site", "hybrid", "remote"]),
  willingToRelocate: z.boolean().default(false),
  targetCountries: z.array(z.string().length(2)).default([]),

  weeklyHoursMin: z.number().int().positive().nullable(),
  weeklyHoursMax: z.number().int().positive().nullable(),
  acceptsShiftWork: z.boolean().default(true),
  maxTravelPercent: z.number().int().min(0).max(100).nullable(),
  acceptedContractTypes: z.array(ContractTypeSchema).default([]),

  /** Sprachen mit Niveau nach GER, z. B. { de: "C2", en: "B2" }. */
  languages: z.record(z.string(), z.string()).default({}),
  /** Nachgewiesene Lizenzen und Zertifikate. */
  licenses: z.array(z.string()).default([]),
  workPermitCountries: z.array(z.string().length(2)).default([]),
  needsVisaSponsorship: z.boolean().default(false),

  earliestStartDate: z.date().nullable().default(null),
  /** Frei formulierte Ausschluesse, z. B. "reine Kaltakquise". */
  hardNoGos: z.array(z.string()).default([]),
});
export type UserConstraints = z.infer<typeof UserConstraintsSchema>;

/** Ergebnis je Bedingung. "uncertain" ist bewusst kein "blocked". */
export const ConstraintVerdictSchema = z.enum(["eligible", "uncertain", "blocked"]);
export type ConstraintVerdict = z.infer<typeof ConstraintVerdictSchema>;

export const ConstraintCheckSchema = z.object({
  key: z.string(),
  /** In der Sprache des Menschen, nicht als Feldname. */
  label: z.string(),
  verdict: ConstraintVerdictSchema,
  /** Warum. Muss auch dann etwas sagen, wenn die Antwort "unbekannt" ist. */
  reason: z.string(),
  /** Was die Stelle fordert, soweit bekannt. */
  jobValue: z.string().nullable(),
  /** Was der Mensch braucht. */
  userValue: z.string().nullable(),
});
export type ConstraintCheck = z.infer<typeof ConstraintCheckSchema>;

export const ConstraintResultSchema = z.object({
  overall: ConstraintVerdictSchema,
  checks: z.array(ConstraintCheckSchema),
  blockedBy: z.array(z.string()),
  uncertainAbout: z.array(z.string()),
});
export type ConstraintResult = z.infer<typeof ConstraintResultSchema>;

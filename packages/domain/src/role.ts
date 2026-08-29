import { z } from "zod";

/** Rollencluster: die Antwort auf "in welche Richtung ueberhaupt?". */

export const RoleClusterSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  /** Warum diese Richtung passt - in ganzen Saetzen, nicht als Score. */
  rationale: z.string(),
  /** Bestaetigte Evidenz, die die Richtung stuetzt. */
  supportingEvidenceIds: z.array(z.string()),
  /** Was noch fehlt oder unsicher ist. */
  gaps: z.array(z.string()),
  /** Bedingungen, die in dieser Richtung kritisch werden koennten. */
  criticalConstraints: z.array(z.string()),
  /** Wie realistisch der Einstieg heute ist. */
  entryRealism: z.enum(["direct", "with_bridge", "longer_path", "unclear"]),
  /** Eine konkrete naechste Handlung zur Ueberpruefung. */
  nextValidationStep: z.string(),
  /** Naheliegend oder angrenzend? Nischenrollen sind ausdruecklich gewollt. */
  kind: z.enum(["obvious", "adjacent", "niche"]),
  /** Abbildung auf Taxonomien. */
  escoUris: z.array(z.string()).default([]),
  kldbCodes: z.array(z.string()).default([]),
  userConfirmed: z.boolean().default(false),
  createdAt: z.date(),
});
export type RoleCluster = z.infer<typeof RoleClusterSchema>;

export const OccupationSchema = z.object({
  key: z.string(),
  labelDe: z.string(),
  labelEn: z.string(),
  synonyms: z.array(z.string()).default([]),
  /** Kerntaetigkeiten - Grundlage fuer Matching und AI Transition. */
  tasks: z.array(z.string()).default([]),
  skillKeys: z.array(z.string()).default([]),
  escoUri: z.string().nullable(),
  kldbCode: z.string().nullable(),
  /** Welche Taxonomie und in welcher Fassung. */
  taxonomy: z.enum(["esco", "kldb", "internal"]),
  taxonomyVersion: z.string(),
});
export type Occupation = z.infer<typeof OccupationSchema>;

export const SkillSchema = z.object({
  key: z.string(),
  labelDe: z.string(),
  labelEn: z.string(),
  synonyms: z.array(z.string()).default([]),
  kind: z.enum(["technical", "method", "social", "language", "license", "domain"]),
  /** Verwandte Faehigkeiten fuer Uebertragbarkeit. */
  relatedKeys: z.array(z.string()).default([]),
  escoUri: z.string().nullable(),
  taxonomy: z.enum(["esco", "kldb", "internal"]),
  taxonomyVersion: z.string(),
});
export type Skill = z.infer<typeof SkillSchema>;

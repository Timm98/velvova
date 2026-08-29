import { z } from "zod";

/**
 * Career Evidence Graph.
 *
 * Der Kern des Produkts. Nicht der Chatverlauf ist die Wahrheit, sondern
 * eine Menge einzeln pruefbarer Aussagen mit Herkunft, Sicherheit und
 * ausdruecklicher Nutzerbestaetigung.
 *
 * Zwei Regeln haengen technisch daran:
 *  1. Kein Bewerbungsclaim ohne verknuepfte, bestaetigte Evidenz.
 *  2. Fehlende Daten senken die Confidence, nie den Fit.
 */

/** Woher eine Aussage stammt. Bestimmt, wie stark sie zaehlen darf. */
export const SourceTypeSchema = z.enum([
  "user_stated",      // Der Mensch hat es selbst gesagt.
  "user_confirmed",   // Der Mensch hat eine Ableitung ausdruecklich bestaetigt.
  "document_extract", // Aus Lebenslauf oder Nachweis gelesen, noch unbestaetigt.
  "ai_hypothesis",    // Vermutung der Assistenz. Nie als Tatsache darstellen.
  "external_source",  // Markt-, Taxonomie- oder Unternehmensdaten.
  "work_sample",      // Ergebnis einer freiwilligen kurzen Aufgabe.
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const EvidenceNodeTypeSchema = z.enum([
  "experience_episode", "action", "result", "skill", "knowledge", "tool",
  "qualification", "preference", "motive", "constraint", "work_environment",
  "role", "occupation", "evidence_source",
]);
export type EvidenceNodeType = z.infer<typeof EvidenceNodeTypeSchema>;

export const EvidenceRelationSchema = z.enum([
  "demonstrates", "supports", "contradicts", "prefers", "avoids",
  "requires", "transfers_to", "maps_to", "derived_from",
]);
export type EvidenceRelation = z.infer<typeof EvidenceRelationSchema>;

/**
 * Wie schutzbeduerftig der Inhalt ist. Steuert Feldverschluesselung,
 * Weitergabe an externe KI-Provider und Aufbewahrung.
 */
export const SensitivitySchema = z.enum(["low", "normal", "high"]);
export type Sensitivity = z.infer<typeof SensitivitySchema>;

export const RetentionClassSchema = z.enum([
  "session_only",   // Nur bis Sitzungsende.
  "profile",        // Solange das Karriereprofil besteht.
  "legal_minimum",  // Nur, solange eine Aufbewahrungspflicht besteht.
]);
export type RetentionClass = z.infer<typeof RetentionClassSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: EvidenceNodeTypeSchema,
  /** Eine Aussage in der Sprache des Menschen, nicht in Modellsprache. */
  statement: z.string().min(1),
  sourceType: SourceTypeSchema,
  /** Verweis auf Herkunft: Interview-Turn, Dokumentseite, Quellen-URL. */
  sourceRef: z.string().nullable(),
  /** 0..1. Wie sicher ist die Aussage selbst - nicht wie gut sie ist. */
  confidence: z.number().min(0).max(1),
  /** Nur bestaetigte Evidenz darf einen Bewerbungsclaim tragen. */
  userConfirmed: z.boolean(),
  /** Vom Menschen ausdruecklich abgelehnt. Bleibt sichtbar, zaehlt nie. */
  userRejected: z.boolean().default(false),
  sensitivityLevel: SensitivitySchema.default("normal"),
  retentionClass: RetentionClassSchema.default("profile"),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable().default(null),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const EvidenceEdgeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  fromId: z.string(),
  toId: z.string(),
  relation: EvidenceRelationSchema,
  weight: z.number().min(0).max(1).default(1),
  createdAt: z.date(),
});
export type EvidenceEdge = z.infer<typeof EvidenceEdgeSchema>;

/** Zaehlt eine Aussage als belegter Fakt? Genau hier entscheidet es sich. */
export function isConfirmedFact(item: EvidenceItem): boolean {
  if (item.deletedAt !== null || item.userRejected) return false;
  return item.userConfirmed && item.sourceType !== "ai_hypothesis";
}

/** Aussagen, die noch Bestaetigung brauchen, bevor sie irgendwo auftauchen. */
export function isOpenHypothesis(item: EvidenceItem): boolean {
  if (item.deletedAt !== null || item.userRejected) return false;
  return !item.userConfirmed;
}

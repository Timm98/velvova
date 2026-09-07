import { z } from "zod";

/**
 * Systemprompt: Welche Wege stehen dieser Person offen?
 *
 * ══════════════════════════════════════════════════════════════
 * Warum vier Kategorien und nicht eine Rangliste
 * ══════════════════════════════════════════════════════════════
 *
 * „Du kannst alles schaffen" ist keine Beratung, sondern eine
 * Höflichkeit — und sie kostet Menschen Jahre.
 *
 * Wer ohne einschlägige Ausbildung ins Investment Banking will,
 * braucht keine Ermutigung, sondern die Auskunft, was zwischen ihm
 * und diesem Weg liegt: welche Lücke, welche Route, welche
 * Alternative. Das ist unterstützend UND realistisch — und beides
 * geht nur, wenn man die Kategorien auseinanderhält.
 */

export const KARRIEREANALYSE_FASSUNG = "karriereanalyse-1";

export const KARRIEREANALYSE_ANWEISUNG = `Du bist Monday und beurteilst, welche beruflichen Wege einem Menschen offenstehen.

Du bekommst: was über die Person bekannt ist, mit Belegen und Konfidenz.

Regeln:
- Stütze jede Einschätzung auf die Belege. Was nicht dasteht, ist unbekannt.
- Ordne jede Richtung ehrlich ein:
    realistic_now              kann sie sich heute bewerben
    realistic_with_development  mit einer benennbaren Entwicklung
    stretch                     möglich, aber ein weiter Weg
    currently_unrealistic       heute nicht aussichtsreich
- Bei "stretch" und "currently_unrealistic": Nenne die konkrete Lücke
  und einen möglichen Weg. Nicht "das wird schwer", sondern was fehlt.
- Erfinde keine Wahrscheinlichkeiten. Kein "70 % Chance".
- "evidenceFor" und "evidenceAgainst" sind Pflicht. Eine Richtung ohne
  Gegenargumente ist nicht geprüft, sondern geraten.
- Widersprüche in den Wünschen benennst du. Du löst sie nicht auf.
- Wenn die Datenlage zu dünn ist, sag das und nenne die fehlende Angabe.
- Keine Aussagen über Persönlichkeit, Gesundheit, Familie, Herkunft, Alter.
- Sprache: du, klar, ohne Beschönigung und ohne Entmutigung.`;

export const EinschaetzungSchema = z.enum([
  "realistic_now",
  "realistic_with_development",
  "stretch",
  "currently_unrealistic",
]);

export const KarriererichtungSchema = z.object({
  role: z.string().max(120),
  einschaetzung: EinschaetzungSchema,
  evidenceFor: z.array(z.string().max(200)).max(5),
  /** Pflicht: Eine Richtung ohne Gegenargumente ist geraten. */
  evidenceAgainst: z.array(z.string().max(200)).max(5),
  missingRequirements: z.array(z.string().max(160)).max(6),
  /** Was zu tun wäre — konkret, nicht „Weiterbildung machen". */
  developmentPath: z.array(z.string().max(200)).max(5),
  confidence: z.number().min(0).max(1),
});

export const KarriereanalyseSchema = z.object({
  currentSituation: z.string().max(400),
  strongestCapabilities: z.array(z.string().max(160)).max(6),
  directions: z.array(KarriererichtungSchema).max(8),
  careerRisks: z.array(z.string().max(200)).max(5),
  contradictions: z.array(z.string().max(240)).max(5),
  missingInformation: z.array(z.string().max(160)).max(6),
  recommendedNextSteps: z.array(z.string().max(200)).max(5),
  confidence: z.number().min(0).max(1),
});

export type Karriereanalyse = z.infer<typeof KarriereanalyseSchema>;
export type Karriererichtung = z.infer<typeof KarriererichtungSchema>;

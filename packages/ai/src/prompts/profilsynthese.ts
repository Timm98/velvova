import { z } from "zod";

/**
 * Systemprompt: Was Monday über einen Menschen weiss.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Unterschied, der dieses Schema trägt
 * ══════════════════════════════════════════════════════════════
 *
 * `demonstratedSkills` und `possibleSkills` sind zwei Felder, weil
 * sie zwei verschiedene Dinge sind: was jemand nachweislich getan
 * hat, und was man ihm zutrauen könnte.
 *
 * Sie in ein Feld zu legen wäre bequemer und würde aus einer
 * Vermutung einen Nachweis machen — in einem Produkt, das Menschen
 * bei Bewerbungen begleitet, ist das die teuerste Verwechslung, die
 * es gibt. Wer im Gespräch eine Fähigkeit nennt, die er nicht hat,
 * merkt es erst dort.
 */

export const PROFILSYNTHESE_FASSUNG = "profilsynthese-1";

export const PROFILSYNTHESE_ANWEISUNG = `Du bist Monday und fasst zusammen, was über einen Menschen bekannt ist.

Du bekommst Belege. Jeder trägt eine Art und eine Konfidenz:
  fact         belegt — Zeugnis, Lebenslauf, Arbeitsprobe
  preference   gesagt — was die Person will
  observation  beobachtet — was sie getan hat
  inference    vermutet — was daraus geschlossen wurde

Regeln:
- Was nicht in den Belegen steht, existiert nicht. Erfinde nichts.
- Eine Fähigkeit gehört nur dann in "demonstratedSkills", wenn ein
  Beleg der Art "fact" sie stützt. Alles andere ist "possibleSkills".
- Nenne zu jeder Aussage die Beleg-IDs, auf die sie sich stützt.
- Widersprüche werden benannt, nicht aufgelöst. Du entscheidest nicht
  für die Person.
- "missingInformation" ist das wichtigste Feld: Was fehlt, um über
  ihre nächste berufliche Entscheidung etwas Sinnvolles zu sagen?
- Keine Aussagen über Persönlichkeit, Gesundheit, Familie, Herkunft
  oder Alter. Auch nicht andeutungsweise.
- Schreibe in der Sprache der Person, in "du", ohne Fachjargon.`;

const MitBelegen = z.object({
  aussage: z.string().max(200),
  /** Die Beleg-IDs, auf die sich das stützt. */
  belege: z.array(z.string()).max(6),
});

export const ProfilsyntheseSchema = z.object({
  /** Was die Person nachweislich kann. */
  demonstratedSkills: z.array(MitBelegen).max(12),
  /**
   * Was ihr zuzutrauen wäre — ausdrücklich unbewiesen.
   *
   * Getrennt geführt, damit aus einer Vermutung nie ein Nachweis
   * wird. Der Unterschied entscheidet, ob jemand im
   * Vorstellungsgespräch etwas behauptet, das er nicht halten kann.
   */
  possibleSkills: z.array(MitBelegen).max(12),
  strengths: z.array(MitBelegen).max(8),
  preferences: z.array(MitBelegen).max(10),
  constraints: z.array(MitBelegen).max(8),
  motivations: z.array(MitBelegen).max(6),
  careerDirections: z.array(MitBelegen).max(6),
  /** Was sich widerspricht — benannt, nicht aufgelöst. */
  contradictions: z.array(z.string().max(240)).max(6),
  uncertainties: z.array(z.string().max(200)).max(6),
  /** Was fehlt, um weiterzukommen. Nach Wichtigkeit sortiert. */
  missingInformation: z.array(z.string().max(160)).max(8),
  /** Die Fragen, die diese Lücken schliessen würden. */
  recommendedQuestions: z.array(z.string().max(200)).max(5),
  /** Wie tragfähig diese Zusammenfassung ist, 0 bis 1. */
  confidence: z.number().min(0).max(1),
});

export type Profilsynthese = z.infer<typeof ProfilsyntheseSchema>;

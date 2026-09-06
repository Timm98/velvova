import { z } from "zod";
import type { TransformType } from "./decision-types.ts";

/**
 * Feldgenaue Herkunft.
 *
 * Jede Tatsache, die Velvova über eine Stelle anzeigt, muss sagen
 * können, woher sie kommt. Das ist keine Buchhaltung um ihrer selbst
 * willen: es ist die einzige Möglichkeit, „steht so in der Anzeige"
 * von „hat Nina daraus geschlossen" zu unterscheiden — und diese
 * Unterscheidung ist das ganze Produktversprechen.
 *
 * Die Regel, die hier durchgesetzt wird: **eine Zusammenfassung darf
 * keine neue Tatsache enthalten.** Ein `ai_summary` ohne Verweis auf
 * die Felder, aus denen er entstand, ist ungültig — nicht „unschön",
 * sondern ungültig.
 */

export const ProvenanceSchema = z
  .object({
    fieldName: z.string().min(1).max(64),
    transformType: z.enum([
      "verbatim_allowed",
      "normalized",
      "ai_summary",
      "inferred",
      "unknown",
    ]),
    /** Der Wert, wie er angezeigt wird. */
    value: z.unknown(),
    sourceUrl: z.string().url().nullable(),
    fetchedAt: z.string().datetime().nullable(),
    confidence: z.number().min(0).max(1),
    displayAllowed: z.boolean(),
    citationLabel: z.string().max(200).nullable(),
    /**
     * Aus welchen Feldern diese Angabe entstand.
     *
     * Pflicht für `ai_summary` und `inferred`. Ohne sie ließe sich eine
     * erfundene Tatsache nicht von einer abgeleiteten unterscheiden.
     */
    derivedFrom: z.array(z.string().min(1)).default([]),
  })
  .superRefine((record, ctx) => {
    if (
      (record.transformType === "ai_summary" || record.transformType === "inferred") &&
      record.derivedFrom.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["derivedFrom"],
        message:
          `Eine Angabe vom Typ „${record.transformType}" braucht die Felder, aus denen ` +
          `sie entstand. Ohne sie wäre sie von einer Erfindung nicht zu unterscheiden.`,
      });
    }

    if (record.transformType === "verbatim_allowed" && !record.sourceUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceUrl"],
        message: "Wörtlich Übernommenes braucht die Quelle, aus der es stammt.",
      });
    }
  });

export type ProvenanceRecord = z.infer<typeof ProvenanceSchema>;

/**
 * Eine Menge von Herkunftsangaben prüfen.
 *
 * Wirft nicht, sondern liefert die Verstöße: der Aufrufer entscheidet,
 * ob er den Datensatz verwirft oder nur die betroffenen Felder.
 */
export function validateProvenance(records: unknown[]): {
  ok: boolean;
  valid: ProvenanceRecord[];
  errors: { index: number; message: string }[];
} {
  const valid: ProvenanceRecord[] = [];
  const errors: { index: number; message: string }[] = [];

  records.forEach((record, index) => {
    const parsed = ProvenanceSchema.safeParse(record);
    if (parsed.success) valid.push(parsed.data);
    else
      errors.push({
        index,
        message: parsed.error.issues.map((i) => i.message).join(" "),
      });
  });

  return { ok: errors.length === 0, valid, errors };
}

/**
 * Was die Person zu einem Feld zu sehen bekommt.
 *
 * Eine Ableitung wird als Ableitung benannt — nicht in einer Fußnote,
 * sondern direkt am Wert.
 */
export function provenanceLabel(record: ProvenanceRecord): string {
  switch (record.transformType) {
    case "verbatim_allowed":
      return "aus der Anzeige";
    case "normalized":
      return "aus der Anzeige, vereinheitlicht";
    case "ai_summary":
      return "Zusammenfassung durch Nina";
    case "inferred":
      return "Einschätzung von Nina";
    case "unknown":
      return "Herkunft unklar";
  }
}

/**
 * Fehlt eine Angabe, bleibt sie leer.
 *
 * Diese Funktion existiert, damit nirgends im Code die Versuchung
 * entsteht, einen Platzhalter zu erfinden. Es gibt genau zwei
 * Ergebnisse: ein Wert mit Herkunft, oder „nicht angegeben".
 */
export function statedOrUnknown<T>(
  value: T | null | undefined,
  unknownLabel = "Nicht angegeben",
): { known: true; value: T } | { known: false; label: string } {
  if (value === null || value === undefined || value === "") {
    return { known: false, label: unknownLabel };
  }
  return { known: true, value };
}

import { and, desc, eq, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { schema, withUser, type Database } from "@paycheck/db";
import {
  erkenntnisart,
  wirksameKonfidenz,
  type Belegquelle,
  type Erkenntnisart,
} from "@paycheck/matching";

/**
 * Die Belege eines Menschen, in der Form, die die Analyse braucht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum jeder Beleg seine Art und seine gedeckelte Konfidenz trägt
 * ══════════════════════════════════════════════════════════════
 *
 * Weil das Modell sie sehen muss. Ein Prompt, der nur Sätze
 * enthält, kann nicht unterscheiden, was jemand gesagt und was ein
 * anderes Modell vermutet hat — und wird beides gleich behandeln.
 *
 * Gemessen: 44,8 Prozent aller Belege trugen eine Konfidenz über
 * dem, was ihre Quelle hergibt. Ungedeckelt in einen Prompt
 * geschrieben, hätte das Modell Vermutungen für Tatsachen gehalten.
 */

export interface Analysebeleg {
  id: string;
  art: Erkenntnisart;
  aussage: string;
  konfidenz: number;
  quelle: Belegquelle;
  belegart: string;
  ersteSicht: Date;
  letzteSicht: Date;
}

export interface Belegstand {
  belege: Analysebeleg[];
  /**
   * Ein Fingerabdruck über die eingeflossenen Belege.
   *
   * Ändert er sich, ist eine gespeicherte Synthese veraltet. Ein
   * Zeitstempel könnte das nicht sagen: „vor zwei Tagen gerechnet"
   * verrät nicht, ob sich seither etwas geändert hat.
   */
  stand: string;
  anzahl: number;
}

export async function belegstandLaden(db: Database, userId: string): Promise<Belegstand> {
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.evidenceItems)
      .where(
        and(
          eq(schema.evidenceItems.userId, userId),
          isNull(schema.evidenceItems.deletedAt),
          /* Was die Person abgelehnt hat, ist keine Grundlage mehr. */
          eq(schema.evidenceItems.userRejected, false),
        ),
      )
      .orderBy(desc(schema.evidenceItems.updatedAt))
      .limit(400),
  );

  const belege: Analysebeleg[] = zeilen.map((z) => {
    const b = {
      quelle: z.sourceType as Belegquelle,
      konfidenz: z.confidence,
      bestaetigt: z.userConfirmed,
      abgelehnt: z.userRejected,
    };
    return {
      id: z.id,
      art: erkenntnisart(b),
      aussage: z.statement,
      konfidenz: wirksameKonfidenz(b),
      quelle: b.quelle,
      belegart: z.type,
      ersteSicht: z.createdAt,
      letzteSicht: z.updatedAt,
    };
  });

  /*
   * Der Fingerabdruck über Kennung und Änderungszeit.
   *
   * Nicht über den Text: Ein Beleg, dessen Konfidenz sich geändert
   * hat, ist derselbe Satz und eine andere Grundlage.
   */
  const stand = createHash("sha256")
    .update(belege.map((b) => `${b.id}:${b.letzteSicht.getTime()}:${b.konfidenz}`).sort().join("|"))
    .digest("hex")
    .slice(0, 32);

  return { belege, stand, anzahl: belege.length };
}

/**
 * Die Belege als Text für das Modell.
 *
 * ── Warum die Art vor der Aussage steht ───────────────────────
 *
 * Damit sie nicht überlesen wird. „belegt: Staplerschein" und
 * „vermutet: Staplerschein" sind zwei verschiedene Sachverhalte, und
 * ein Modell, das die Kennzeichnung am Zeilenende findet, hat den
 * Satz schon gelesen.
 */
export function belegeAlsText(belege: readonly Analysebeleg[]): string {
  if (belege.length === 0) return "Es liegen noch keine Belege vor.";
  return belege
    .map((b) => `[${b.id}] ${b.art} (${b.konfidenz.toFixed(2)}): ${b.aussage}`)
    .join("\n");
}

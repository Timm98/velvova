import { getDb, schema, withSystem } from "@paycheck/db";
import { eq } from "drizzle-orm";
import { referenzFuerTitel } from "@/lib/jobs/berufsreferenz";

/**
 * Was sich vor einer Gehaltsverhandlung sagen lässt — und was nicht.
 *
 * ── Warum das mehr ist als ein Ratschlag ──────────────────────
 *
 * „Verhandle selbstbewusst" hilft niemandem. Was hilft, ist eine Zahl,
 * die man nennen kann, und die Quelle dazu: „Der Entgeltatlas der
 * Bundesagentur weist für diese Berufsgattung 52.400 € aus, Ihr
 * Angebot liegt bei 46.000."
 *
 * Diese Zahl haben wir seit dem Entgeltatlas für 1.926 Berufe. Sie
 * stand bisher nur auf der Stellenseite — nicht dort, wo tatsächlich
 * verhandelt wird.
 *
 * ── Was hier ausdrücklich NICHT passiert ──────────────────────
 *
 * Es wird keine Forderung berechnet. „Fordere 8 % mehr" wäre eine
 * Zahl ohne Grundlage: Was durchsetzbar ist, hängt von Markt, Person
 * und Gespräch ab, und davon wissen wir nichts. Was hier steht, ist
 * die Vergleichszahl und ihre Herkunft — die Entscheidung bleibt beim
 * Menschen.
 */

export interface Verhandlungslage {
  /** Das Angebot, aufs Jahr gerechnet. */
  angebot: number | null;
  /** Der amtliche Median für diesen Beruf, aufs Jahr. */
  median: number | null;
  q1: number | null;
  q3: number | null;
  beruf: string | null;
  quelle: "entgeltatlas" | "bundesagentur" | null;
  /** Wie viele Beschäftigte oder Anzeigen den Wert tragen. */
  grundlage: number | null;
  /**
   * Wie das Angebot zum Median steht — in Worten, nicht als Prozentsatz.
   *
   * Ein Prozentsatz lädt dazu ein, ihn als Forderung zu lesen. Die
   * Einordnung sagt, wo man steht; wie viel man verlangt, ist eine
   * andere Frage.
   */
  einordnung: "darunter" | "im_rahmen" | "darueber" | null;
  /** Was die Zahl NICHT sagt. Steht immer dabei. */
  grenzen: string;
}

/**
 * Wo ein Angebot zwischen den Quartilen steht.
 *
 * ── Warum in Worten und nicht in Prozent ──────────────────────
 *
 * „12 % unter dem Median" klingt nach einer Lücke, die zu schliessen
 * wäre — und liest sich damit als Forderung. „Innerhalb der mittleren
 * Hälfte" sagt, dass das Angebot normal ist. Beides kann dieselbe Zahl
 * sein, und nur das zweite ist eine Auskunft.
 *
 * Herausgelöst, damit die Regel ohne Datenbank prüfbar ist.
 */
export function einordnen(
  angebot: number | null,
  q1: number | null,
  q3: number | null,
): Verhandlungslage["einordnung"] {
  if (angebot === null) return null;
  if (q1 !== null && angebot < q1) return "darunter";
  if (q3 !== null && angebot > q3) return "darueber";
  /*
   * Ohne Quartile keine Einordnung.
   *
   * Sonst hiesse „wir kennen die Spanne nicht" dasselbe wie „das
   * Angebot ist normal" — und das wäre eine Behauptung.
   */
  if (q1 === null && q3 === null) return null;
  return "im_rahmen";
}

export async function verhandlungslage(
  jobId: string,
  angebotJahr: number | null,
): Promise<Verhandlungslage> {
  const grenzen =
    "Der Median ist keine Forderung. Er sagt, was Beschäftigte in dieser Berufsgattung verdienen — " +
    "nicht, was dieser Arbeitgeber zahlen kann oder was in diesem Gespräch durchsetzbar ist. " +
    "Erfahrung, Region und Verantwortung verschieben ihn in beide Richtungen.";

  const db = await getDb();
  const [zeile] = await withSystem(db, (tx) =>
    tx.select({ title: schema.jobs.title }).from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1),
  ).catch(() => []);
  if (!zeile) {
    return { angebot: angebotJahr, median: null, q1: null, q3: null, beruf: null,
             quelle: null, grundlage: null, einordnung: null, grenzen };
  }

  const referenz = await referenzFuerTitel(zeile.title).catch(() => null);
  if (!referenz) {
    return { angebot: angebotJahr, median: null, q1: null, q3: null, beruf: null,
             quelle: null, grundlage: null, einordnung: null, grenzen };
  }

  /*
   * Die Einordnung folgt den Quartilen, nicht einem Prozentabstand.
   *
   * „12 % unter dem Median" klingt nach einer Lücke, die zu schliessen
   * wäre. „Innerhalb der mittleren Hälfte" sagt, dass das Angebot
   * normal ist — und beides kann dieselbe Zahl sein.
   */
  const einordnung = einordnen(angebotJahr, referenz.q1, referenz.q3);

  return {
    angebot: angebotJahr,
    median: referenz.median,
    q1: referenz.q1,
    q3: referenz.q3,
    beruf: referenz.beruf,
    quelle: referenz.quelle,
    grundlage: referenz.anzahl,
    einordnung,
    grenzen,
  };
}

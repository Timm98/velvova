import { getDb, schema, withSystem } from "@paycheck/db";
import { eq } from "drizzle-orm";
import { standzeit, standzeitFolge, type Standzeit } from "@paycheck/domain";

/**
 * Die Standzeit einer Stelle, im Vergleich zu ihrem Berufsfeld.
 *
 * ── Warum diese Auskunft überhaupt zählt ──────────────────────
 *
 * Eine Anzeige kostet fast nichts und verpflichtet zu nichts. Deshalb
 * sagt ihre blosse Existenz nicht, dass jemand einstellen will.
 * Gemessen im eigenen Bestand: 26,3 % der ausgelieferten Stellen sind
 * älter als 90 Tage, 16,0 % älter als 180, 7,1 % älter als ein Jahr —
 * und alle wurden in der letzten Woche erneut von der Quelle geliefert.
 *
 * Das ist die einzige Zahl dieser Art für den deutschen Markt, die wir
 * kennen — und sie stammt aus 1,58 Mio. Anzeigen, nicht aus einer
 * Umfrage unter Anbietern.
 */
export interface Standzeitangabe extends Standzeit {
  folge: string | null;
}

export async function standzeitLaden(
  kldb: string | null,
  veroeffentlichtAm: Date | null,
  jetzt = new Date(),
): Promise<Standzeitangabe | null> {
  if (!veroeffentlichtAm) return null;

  const gruppe = kldb?.slice(0, 2) ?? null;
  let referenz = null;
  if (gruppe) {
    const db = await getDb();
    const [z] = await withSystem(db, (tx) =>
      tx
        .select()
        .from(schema.standzeitReferenz)
        .where(eq(schema.standzeitReferenz.gruppe, gruppe))
        .limit(1),
    ).catch(() => []);
    if (z) {
      referenz = { gruppe: z.gruppe, stellen: z.stellen, medianTage: z.medianTage, p90Tage: z.p90Tage };
    }
  }

  const s = standzeit(veroeffentlichtAm, referenz, jetzt);
  if (!s) return null;
  return { ...s, folge: standzeitFolge(s.befund) };
}

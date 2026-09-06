import { getDb, schema, withSystem } from "@paycheck/db";
import { eq, sql } from "drizzle-orm";
import {
  automatisierungssatz, iscoAusKldb, MIN_GRUPPEN, nachfragesatz,
  zukunftsherkunft, zukunftskonfidenz, type Zukunftsbild,
} from "@paycheck/domain";

/**
 * Die Zukunftseinschätzung zu einer Stelle.
 *
 * ── Der Weg ───────────────────────────────────────────────────
 *
 *   KldB der Anzeige  →  ISCO-Hauptgruppe (strukturell abgeleitet)
 *                     →  Mittel über die Berufsgruppen dieser Gruppe
 *                     →  Sätze aus den Werten, nicht aus einem Modell
 *
 * Jeder Schritt kann scheitern, und dann steht nichts da. Das ist der
 * Punkt: „Für diese Berufsgruppe liegt keine belastbare Einschätzung
 * vor" ist eine Auskunft. Ein erfundener Satz wäre keine.
 *
 * ── Warum die Sätze nicht vom Modell kommen ───────────────────
 *
 * Ein Sprachmodell formuliert flüssiger und kann nichts belegen. Die
 * Sätze hier stammen aus Schwellen über gemessenen Anteilen; wer sie
 * anzweifelt, kann die Zahl daneben nachrechnen.
 */
export interface Zukunftsangabe {
  bild: Zukunftsbild;
  nachfrage: string;
  automatisierung: string;
  konfidenz: "mittel" | "gering";
  herkunft: string;
}

export async function zukunftLaden(kldb: string | null): Promise<Zukunftsangabe | null> {
  const zuordnung = iscoAusKldb(kldb);
  if (!zuordnung) return null;

  const db = await getDb();
  const [z] = await withSystem(db, (tx) =>
    tx
      .select({
        berufsgruppen: sql<number>`count(*)::int`,
        sicherheit: sql<number>`avg(${schema.iscoBerufe.zukunftssicherheit})::float`,
        kiHoch: sql<number>`(count(*) filter (where ${schema.iscoBerufe.kiExposition} = 'hoch')::float / count(*))`,
        wachsend: sql<number>`(count(*) filter (where ${schema.iscoBerufe.nachfrage} like '%wachsend')::float / count(*))`,
        schrumpfend: sql<number>`(count(*) filter (where ${schema.iscoBerufe.nachfrage} like '%schrumpfend')::float / count(*))`,
        quelle: sql<string>`min(${schema.iscoBerufe.quelle})`,
        stand: sql<string>`min(${schema.iscoBerufe.stand})::text`,
      })
      .from(schema.iscoBerufe)
      .where(eq(schema.iscoBerufe.hauptgruppeNummer, zuordnung.hauptgruppe)),
  ).catch(() => []);

  if (!z || !z.berufsgruppen || z.berufsgruppen < MIN_GRUPPEN) return null;

  const bild: Zukunftsbild = {
    hauptgruppe: zuordnung.hauptgruppe,
    bezeichnung: zuordnung.bezeichnung,
    sicherheit: Number(z.sicherheit ?? 0),
    berufsgruppen: Number(z.berufsgruppen),
    kiExpositionHoch: Number(z.kiHoch ?? 0),
    nachfrageWachsend: Number(z.wachsend ?? 0),
    nachfrageSchrumpfend: Number(z.schrumpfend ?? 0),
    quelle: z.quelle ?? "",
    stand: z.stand ?? "",
  };

  return {
    bild,
    nachfrage: nachfragesatz(bild),
    automatisierung: automatisierungssatz(bild),
    konfidenz: zukunftskonfidenz(bild),
    herkunft: zukunftsherkunft(bild),
  };
}

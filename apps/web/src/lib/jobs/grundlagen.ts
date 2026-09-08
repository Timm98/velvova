import { sql } from "drizzle-orm";
import { getDb } from "@paycheck/db";

/**
 * Die vier Zahlen unter „Worauf das beruht".
 *
 * ══════════════════════════════════════════════════════════════
 * Warum sie nicht mehr im Bauteil stehen
 * ══════════════════════════════════════════════════════════════
 *
 * Sie standen dort als Zeichenketten:
 *
 *   "2,5 Mio."  Stellen im Bestand, aus 28 Quellen
 *   "436"       Berufsgruppen mit Zukunftseinschätzung
 *   "33"        Berufsfelder mit einer Arbeitsprobe
 *
 * Am 8. September 2026 nachgezählt: 3,46 Mio. Stellen, 34 Quellen mit
 * Bestand, 436 Berufsgruppen, 34 Arbeitsproben. Zwei von vier Zahlen
 * waren falsch, eine davon um fast eine Million.
 *
 * Das ist die Natur einer eingetippten Zahl neben einer wachsenden
 * Datenbank: Sie stimmt am Tag, an dem sie geschrieben wird, und
 * danach nie wieder. Und es ist ausgerechnet der Abschnitt, der sagt,
 * worauf alles beruht.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nichts kostet
 * ══════════════════════════════════════════════════════════════
 *
 * Keine dieser Abfragen fasst `jobs` an. `bestandskennzahlen` hält je
 * Quelle eine Zeile — ein paar Dutzend —, `isco_berufe` 436 und
 * `aufgabenproben` gut dreissig. Zusammen sind das drei Zählungen über
 * Tabellen, die in den Arbeitsspeicher passen.
 *
 * Ein `count(*)` über `jobs` stünde hier nicht: Er lief am 8. September
 * an 3,45 Mio. Zeilen in die Zeitgrenze (Code 57014).
 */
export interface Grundlagenzahlen {
  /** Aktive Stellen im Bestand — dieselbe Zahl wie im Kopf der Seite. */
  stellen: number;
  /** Quellen, die tatsächlich Bestand beigesteuert haben. */
  quellen: number;
  /** Berufsgruppen mit Zukunftseinschätzung. */
  berufsgruppen: number;
  /** Berufsfelder mit einer Arbeitsprobe. */
  arbeitsproben: number;
}

/**
 * Ein Rückfall, der nichts behauptet.
 *
 * Fällt eine Abfrage aus, steht dort `0` — und das Bauteil zeigt die
 * Zeile dann gar nicht an. Eine ausgedachte Zahl im Abschnitt
 * „Worauf das beruht" wäre der schlechteste denkbare Ort für eine
 * Schätzung.
 */
const LEER: Grundlagenzahlen = { stellen: 0, quellen: 0, berufsgruppen: 0, arbeitsproben: 0 };

export async function grundlagenzahlen(): Promise<Grundlagenzahlen> {
  try {
    const db = await getDb();

    /*
     * Eine Abfrage statt vier.
     *
     * Vier einzelne `select count(*)` wären vier Netzrunden gegen
     * Supabase — gemessen etwa 180 ms je Runde. Als Unterabfragen in
     * einer Anweisung ist es eine.
     *
     * `quelle <> ''` schliesst die Gesamtzeile aus: Sie steht in
     * derselben Tabelle und trägt die Summe, nicht eine Quelle. Ohne
     * diesen Ausschluss zählte sie sich selbst mit.
     */
    const r = (await db.execute(sql`
      select
        (select coalesce(aktiv, 0) from bestandskennzahlen where quelle = '' limit 1) as stellen,
        (select count(*) from bestandskennzahlen where quelle <> '' and aktiv > 0) as quellen,
        (select count(*) from isco_berufe) as berufsgruppen,
        (select count(*) from aufgabenproben) as arbeitsproben
    `)) as { rows?: Record<string, number | string | null>[] };

    const z = r.rows?.[0];
    if (!z) return LEER;

    return {
      stellen: Number(z.stellen ?? 0),
      quellen: Number(z.quellen ?? 0),
      berufsgruppen: Number(z.berufsgruppen ?? 0),
      arbeitsproben: Number(z.arbeitsproben ?? 0),
    };
  } catch {
    /*
     * Ein Abschnitt ohne Zahlen ist ein Abschnitt. Einer mit
     * erfundenen Zahlen ist eine Behauptung.
     */
    return LEER;
  }
}

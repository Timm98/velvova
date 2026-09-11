import { sql } from "drizzle-orm";
import { getDb, withSystem } from "@paycheck/db";
import { EXTRAKTIONSFASSUNG } from "@paycheck/domain";
import { anforderungenExtrahieren } from "./anforderungsextraktion.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die neue Extraktion nachziehen — zunächst nur für Logistik
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum nur ein Cluster ───────────────────────────────────────
 *
 * Weil die Regeln an Logistikanzeigen gemessen wurden und nur dort
 * eine geprüfte Referenz existiert. Eine Anzeige für Pflege oder
 * Elektrotechnik hat andere Überschriften und andere Floskeln; sie
 * hier mitzuziehen hiesse, eine Messung auf etwas zu übertragen, das
 * nicht gemessen wurde.
 *
 * ── Warum nichts überschrieben wird ─────────────────────────────
 *
 * Die alten Zeilen bleiben mit `extraktion_fassung = 'anforderung-1'`
 * stehen. Solange nicht im Betrieb geprüft ist, dass die neue Fassung
 * besser ist, wäre ein Überschreiben ein Verlust ohne Rückweg.
 *
 * Ein zweiter Lauf ersetzt nur die Zeilen SEINER Fassung — damit ist
 * er wiederholbar, ohne zu verdoppeln.
 */

export interface Backfillbericht {
  stellen: number;
  eintraege: number;
  ohneText: number;
  ohneEintrag: number;
  fassung: string;
}

export async function anforderungenNachziehen(
  kldbPraefix = "51",
  grenze = 500,
): Promise<Backfillbericht> {
  const db = await getDb();
  const bericht: Backfillbericht = {
    stellen: 0,
    eintraege: 0,
    ohneText: 0,
    ohneEintrag: 0,
    fassung: EXTRAKTIONSFASSUNG,
  };

  /*
   * ── Warum kein `not exists` in der Abfrage ────────────────────
   *
   * Ein Anti-Join zwischen `jobs` und `job_requirements` läuft über
   * beide Tabellen und in die Zeitgrenze — gemessen, nicht vermutet.
   * Die Kandidaten kommen deshalb ohne ihn, und ob eine Stelle schon
   * in dieser Fassung vorliegt, beantwortet eine Punktabfrage über
   * den Index auf `job_id`.
   */
  /*
   * ── Warum die Kandidaten aus `job_requirements` kommen ────────
   *
   * Gemessen, nicht vermutet: `select id, description from jobs where
   * kldb like '51%' limit 400` läuft in die Zeitgrenze — der Index
   * trägt das Präfix nicht, und `description` ist gross. Ein
   * Anti-Join dazu erst recht.
   *
   * Über `job_requirements` ist die Menge klein und indiziert. Der
   * Preis: Stellen, für die noch nie eine Anforderung extrahiert
   * wurde, kommen so nicht vor. Für den Startmarkt ist das tragbar —
   * es sind genau die Stellen, die heute schon im Vergleich stehen.
   */
  const ids = (await withSystem(db, (tx) =>
    tx.execute(sql`
      select distinct r.job_id as id
      from job_requirements r
      join jobs j on j.id = r.job_id
      where j.kldb like ${`${kldbPraefix}%`}
        and j.country = 'DE' and j.is_demo = false
      limit ${grenze}`),
  )) as unknown as { rows: { id: string }[] };

  const stellen = { rows: [] as { id: string; description: string | null }[] };
  for (const z of ids.rows) {
    const t = (await withSystem(db, (tx) =>
      tx.execute(sql`select id, description from jobs where id = ${z.id}::uuid`),
    )) as unknown as { rows: { id: string; description: string | null }[] };
    if (t.rows[0]) stellen.rows.push(t.rows[0]);
  }

  for (const s of stellen.rows) {
    const schon = (await withSystem(db, (tx) =>
      tx.execute(sql`
        select 1 from job_requirements
        where job_id = ${s.id}::uuid and extraktion_fassung = ${EXTRAKTIONSFASSUNG}
        limit 1`),
    )) as unknown as { rows: unknown[] };
    if (schon.rows.length > 0) continue;

    bericht.stellen++;
    if (!s.description || s.description.length < 120) {
      bericht.ohneText++;
      continue;
    }

    const { eintraege } = anforderungenExtrahieren(s.description);
    if (eintraege.length === 0) {
      bericht.ohneEintrag++;
      continue;
    }

    await withSystem(db, async (tx) => {
      /* Nur die eigene Fassung ersetzen. Die alte bleibt. */
      await tx.execute(sql`
        delete from job_requirements
        where job_id = ${s.id}::uuid and extraktion_fassung = ${EXTRAKTIONSFASSUNG}`);

      for (const e of eintraege) {
        await tx.execute(sql`
          insert into job_requirements
            (job_id, kind, text, category, kategorie, verbindlichkeit, bedeutung,
             erfahrungsfeld, erfahrungsmass, zwingend, konfidenz, belegstelle,
             extraktion_fassung)
          values (
            ${s.id}::uuid,
            /* Die alte Spalte kind bleibt für Leser, die sie noch
               benutzen. Eine Tätigkeit ist dort nice: Sie fordert
               nichts. Backticks stehen hier bewusst nicht — sie
               beenden die Zeichenkette, in der dieses SQL steht. */
            ${e.verbindlichkeit === "muss" ? "must" : "nice"},
            ${e.original.slice(0, 800)},
            ${e.kategorie.toLowerCase()},
            ${e.kategorie},
            ${e.verbindlichkeit},
            ${e.bedeutung.slice(0, 800)},
            ${e.erfahrungsfeld},
            ${e.erfahrungsmass},
            ${e.verbindlichkeit === "muss"},
            ${e.konfidenz},
            ${e.belegstelle},
            ${EXTRAKTIONSFASSUNG}
          )`);
      }
    });

    bericht.eintraege += eintraege.length;
  }

  return bericht;
}

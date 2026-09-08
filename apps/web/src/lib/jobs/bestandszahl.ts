import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/**
 * Die Stellenzahl für die Startseite.
 *
 * Sie steht dort als erste Aussage über dem Suchfeld und ist die
 * einzige Zahl auf der Seite, die ein Besucher nachrechnen kann: Er
 * sucht, zählt die Treffer und merkt sofort, ob die Überschrift lügt.
 * Deshalb kommt sie aus `bestandskennzahlen` und nicht aus dem Code.
 *
 * Gezählt wird `aktiv`, nicht `roh`. Wer „2,4 Millionen Stellen" liest
 * und dann abgelaufene Anzeigen findet, hat zu Recht den Eindruck,
 * verkauft worden zu sein.
 *
 * Ein `count(*)` über `jobs` steht hier bewusst nicht: bei 2,4 Mio.
 * Zeilen läuft er in die Zeitgrenze und nimmt die Startseite mit.
 */
export type Bestandszahl = {
  /** Genau, für `aria-label` und Datenauszeichnung. */
  genau: number;
  /** Abgerundet auf volle Zehntausend — nie aufgerundet. */
  gerundet: number;
  /** Fertig gesetzt, z. B. „2.360.000". */
  text: string;
  /** Wann zuletzt gezählt wurde; null, wenn nur geschätzt. */
  stand: string | null;
  /**
   * Wie viele Stellen im Schnitt je Sekunde hinzukommen.
   *
   * Gemessen an den Ernteläufen der letzten 24 Stunden, nicht
   * geschätzt: `job_ingestion_runs.created` hält fest, wie viele
   * Anzeigen jeder Lauf tatsächlich angelegt hat.
   *
   * Die Zahl trägt den Live-Zähler auf der Startseite. Ohne echte
   * Grundlage stünde dort eine Zahl, die schneller läuft als der
   * Bestand wächst — also eine Behauptung.
   */
  proSekunde: number;
};

/**
 * Ein Datenbankfehler wird abgefangen — aber nicht verschwiegen.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum beides nötig ist
 * ══════════════════════════════════════════════════════════════
 *
 * Die Startseite darf an einer Zahl nicht scheitern; deshalb gibt es
 * die Rückfälle. Nur haben sie am 8. September 2026 einen Ausfall
 * VOLLSTÄNDIG verdeckt: Die Anwendung lief auf Vercel gegen eine
 * Datenbank, die sie nicht erreichte, und zeigte „Finde 0 Jobs" —
 * während 3.482.474 Stellen darin standen.
 *
 * Der Bau war grün, die Seite lud, nichts protokollierte etwas. Der
 * Fehler war erst zu finden, als jemand die Zahl mit der Datenbank
 * verglich.
 *
 * Ein abgefangener Fehler ohne Protokolleintrag ist kein
 * Fehlerschutz, sondern eine Falle. Ab hier wird jeder gemeldet.
 */
function dbFehler(stelle: string): (e: unknown) => never[] {
  return (e: unknown) => {
    console.error(
      `[bestandszahl] ${stelle} fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`,
    );
    return [];
  };
}

export async function bestandszahl(): Promise<Bestandszahl> {
  const db = await getDb();

  const [vorberechnet] = await db
    .select()
    .from(schema.bestandskennzahlen)
    .where(eq(schema.bestandskennzahlen.quelle, ""))
    .limit(1)
    .catch(dbFehler("Abfrage der Bestandskennzahlen"));

  let genau = Number(vorberechnet?.aktiv ?? 0);
  let stand = vorberechnet?.berechnetAm ? vorberechnet.berechnetAm.toISOString() : null;

  if (genau <= 0) {
    /* Rückfall auf den Schätzwert des Planers — kostet nichts. Eine
       Startseite, die „0 Stellen" behauptet, wäre schlimmer als eine,
       die um ein Prozent danebenliegt. */
    const r = (await db
      .execute(sql`select reltuples::bigint n from pg_class where relname = 'jobs'`)
      .catch((e: unknown) => {
        dbFehler("Schätzwert aus pg_class")(e);
        return { rows: [] };
      })) as { rows?: { n?: number | string }[] };
    genau = Number(r.rows?.[0]?.n ?? 0);
    stand = null;
  }

  /*
   * Abrunden, nie aufrunden.
   *
   * „Über 2.360.000" muss auch dann noch stimmen, wenn zwischen der
   * Auszählung und dem Seitenaufruf Anzeigen ablaufen. Aufrunden
   * würde aus einer wahren Aussage eine falsche machen, sobald der
   * Bestand kurz sinkt — und der Bestand sinkt regelmässig, weil
   * abgelaufene Anzeigen verschwinden.
   */
  const gerundet = Math.max(0, Math.floor(genau / 10_000) * 10_000);

  /*
   * Die Zuwachsrate aus den Ernteläufen.
   *
   * `job_ingestion_runs` ist klein — ein paar tausend Zeilen je Tag —
   * und die Summe darüber kostet nichts. Der Umweg über `jobs` mit
   * `fetched_at > now() - 24h` wäre dagegen ein Sequenz-Scan über 2,5
   * Mio. Zeilen ohne passenden Index.
   */
  const rate = (await db
    .execute(
      sql`select coalesce(sum(created), 0)::int n from job_ingestion_runs
          where started_at > now() - interval '24 hours'`,
    )
    .catch((e: unknown) => {
      dbFehler("Zuwachsrate aus job_ingestion_runs")(e);
      return { rows: [{ n: 0 }] };
    })) as { rows?: { n?: number }[] };
  const proSekunde = Math.max(0, Number(rate.rows?.[0]?.n ?? 0) / 86_400);

  return {
    genau,
    gerundet,
    text: gerundet.toLocaleString("de-DE"),
    stand,
    proSekunde,
  };
}

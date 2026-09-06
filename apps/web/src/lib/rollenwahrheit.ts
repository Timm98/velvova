import { getDb, schema, withSystem } from "@paycheck/db";
import { eq, isNotNull } from "drizzle-orm";
import { rollenwahrheit, stellenDimensionen, type Rollenangabe } from "@paycheck/matching";
import type { Arbeitsdimension, Job } from "@paycheck/domain";

/**
 * Die Role Truth Card zu einer Stelle laden.
 *
 * ── Warum über `job_postings` und nicht über `jobs` ───────────
 *
 * Die Karte gehört zur Ausschreibung des Arbeitgebers, nicht zur
 * importierten Anzeige. Für die weit über eine Million Stellen aus
 * fremden Quellen gibt es keine — und das ist richtig so: Wir haben
 * dort niemanden, der etwas bestätigen könnte.
 *
 * Für sie bleibt die Ableitung aus dem Text, ausdrücklich als solche
 * gekennzeichnet.
 */
export interface Rollenkarte {
  angaben: Rollenangabe[];
  aufgaben: { aufgabe: string; zeitanteil: number }[];
  abgaenge: string[];
  /** true, wenn ein Arbeitgeber die Karte tatsächlich ausgefüllt hat. */
  vomArbeitgeber: boolean;
}

/*
 * Welche Stellen überhaupt eine Ausschreibung haben.
 *
 * ── Warum das im Speicher steht ───────────────────────────────
 *
 * Von 1,13 Millionen Stellen stammen ein paar Dutzend von einem
 * Arbeitgeber, der bei uns eingestellt hat. Alle übrigen sind
 * importiert und haben keine Ausschreibung — es gibt dort niemanden,
 * der etwas bestätigen könnte.
 *
 * Trotzdem fragte jede Detailseite danach: eine Transaktion über die
 * Systemverbindung, 131 Millisekunden, für eine Antwort, die in
 * 99,99 % der Fälle leer ist.
 *
 * Die Menge der Stellen MIT Ausschreibung ist klein genug, um sie ganz
 * zu halten. Fünf Minuten Haltbarkeit: Eine neu veröffentlichte
 * Ausschreibung erscheint dann etwas später — sie erscheint aber, und
 * bis dahin fehlt nur ein Abschnitt, der ohnehin neu ist.
 */
let ausschreibungen: { kennungen: Set<string>; bis: number } | null = null;
const AUSSCHREIBUNGEN_HALTBAR_MS = 5 * 60 * 1000;

async function stellenMitAusschreibung(): Promise<Set<string>> {
  if (ausschreibungen && ausschreibungen.bis > Date.now()) return ausschreibungen.kennungen;
  const db = await getDb();
  const zeilen = await withSystem(db, (tx) =>
    tx
      .select({ jobId: schema.jobPostings.jobId })
      .from(schema.jobPostings)
      .where(isNotNull(schema.jobPostings.jobId)),
  ).catch(() => []);
  const kennungen = new Set(zeilen.map((z) => String(z.jobId)));
  ausschreibungen = { kennungen, bis: Date.now() + AUSSCHREIBUNGEN_HALTBAR_MS };
  return kennungen;
}

export async function rollenkarteLaden(job: Job): Promise<Rollenkarte> {
  const abgeleitet = stellenDimensionen(job);

  /*
   * Der Schnellweg für importierte Stellen.
   *
   * Ohne ihn kostete jede Detailseite eine Transaktion für die Frage,
   * ob es eine Ausschreibung gibt — und die Antwort war fast immer
   * nein.
   */
  if (!(await stellenMitAusschreibung()).has(job.id)) {
    return {
      angaben: rollenwahrheit({ arbeitgeber: [], bestaetigungen: [], abgeleitet }),
      aufgaben: [],
      abgaenge: [],
      vomArbeitgeber: false,
    };
  }

  const db = await getDb();

  /*
   * Über die Systemverbindung: Die Karte gehört zur Stelle und ist für
   * jeden sichtbar, der die Stelle sehen darf. Die Kennungen der
   * bestätigenden Mitarbeiter verlassen diese Funktion nie.
   */
  const [posting] = await withSystem(db, (tx) =>
    tx
      .select({ id: schema.jobPostings.id })
      .from(schema.jobPostings)
      .where(eq(schema.jobPostings.jobId, job.id))
      .limit(1),
  ).catch(() => []);

  if (!posting) {
    return {
      angaben: rollenwahrheit({ arbeitgeber: [], bestaetigungen: [], abgeleitet }),
      aufgaben: [],
      abgaenge: [],
      vomArbeitgeber: false,
    };
  }

  const [aussagen, bestaetigungen, aufgaben, abgaenge] = await Promise.all([
    withSystem(db, (tx) =>
      tx.select().from(schema.rollenAussagen).where(eq(schema.rollenAussagen.postingId, posting.id)),
    ).catch(() => []),
    withSystem(db, (tx) =>
      tx
        .select({
          dimension: schema.rollenBestaetigungen.dimension,
          wert: schema.rollenBestaetigungen.wert,
        })
        .from(schema.rollenBestaetigungen)
        .where(eq(schema.rollenBestaetigungen.postingId, posting.id)),
    ).catch(() => []),
    withSystem(db, (tx) =>
      tx
        .select({ aufgabe: schema.rollenAufgaben.aufgabe, zeitanteil: schema.rollenAufgaben.zeitanteil })
        .from(schema.rollenAufgaben)
        .where(eq(schema.rollenAufgaben.postingId, posting.id)),
    ).catch(() => []),
    withSystem(db, (tx) =>
      tx
        .select({ grund: schema.rollenAbgaenge.grund })
        .from(schema.rollenAbgaenge)
        .where(eq(schema.rollenAbgaenge.postingId, posting.id)),
    ).catch(() => []),
  ]);

  return {
    angaben: rollenwahrheit({
      arbeitgeber: aussagen.map((a) => ({
        dimension: a.dimension as Arbeitsdimension,
        wert: a.wert,
        begruendung: a.begruendung,
      })),
      bestaetigungen: bestaetigungen.map((b) => ({
        dimension: b.dimension as Arbeitsdimension,
        wert: b.wert,
      })),
      abgeleitet,
    }),
    aufgaben: aufgaben.sort((a, b) => b.zeitanteil - a.zeitanteil),
    abgaenge: abgaenge.map((a) => a.grund),
    vomArbeitgeber: aussagen.length > 0,
  };
}

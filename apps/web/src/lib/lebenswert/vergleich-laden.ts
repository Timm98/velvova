import { and, eq, getTableColumns, inArray } from "drizzle-orm";
import type { Job } from "@paycheck/domain";
import { getDb, schema, withUser } from "@paycheck/db";
import { rowToJob } from "@/lib/matching";

/**
 * Die Stellen für den Vergleich — mit Beschreibung.
 *
 * ── Warum nicht `loadScoredJob` ───────────────────────────────
 *
 * Das ruft `scoreAllJobs` auf und bewertet für EINE Stelle alle 1.500
 * gegen das Profil. Bei drei Spalten wären das drei volle Durchläufe
 * für Angaben, die alle in einer Zeile stehen: Gehalt, Stunden,
 * Vertrag, Beschreibung. Die Passung gehört auf die Detailseite; im
 * Vergleich steht, was messbar ist.
 *
 * ── Warum die Beschreibung mitkommt ───────────────────────────
 *
 * Die Rangliste lädt sie bewusst nicht — bei 1.500 Zeilen wäre das der
 * grösste Posten der Abfrage. Hier sind es höchstens drei, und die
 * Leistungen werden aus dem Text gelesen. Ohne ihn bliebe die
 * interessanteste Zeile der Tabelle leer.
 */
export async function ladeStellenFuerVergleich(userId: string, ids: string[]): Promise<Job[]> {
  const eindeutig = [...new Set(ids)].filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (eindeutig.length === 0) return [];

  const db = await getDb();
  const spalten = getTableColumns(schema.jobs);

  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ job: spalten, firma: schema.companies.name })
      .from(schema.jobs)
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(inArray(schema.jobs.id, eindeutig)),
  );

  /*
   * Die Reihenfolge kommt aus der Anfrage, nicht aus der Datenbank.
   *
   * Wer zwei Stellen in einer bestimmten Reihenfolge auswählt, erwartet
   * sie so — und beim Nachladen der Seite dieselbe. Sonst tauschen die
   * Spalten die Plätze, und der Vergleich, den jemand gerade gelesen
   * hat, sieht anders aus.
   */
  const nachId = new Map(zeilen.map((z) => [z.job.id, z]));
  return eindeutig
    .map((id) => nachId.get(id))
    .filter((z): z is (typeof zeilen)[number] => z !== undefined)
    .map(({ job, firma }) => {
      const { description, ...ohneText } = job;
      return { ...rowToJob(ohneText, firma), description };
    });
}

/** Die gemerkten Stellen, für die Auswahl im Vergleich. */
export async function ladeGemerkte(
  userId: string,
): Promise<{ id: string; titel: string; firma: string }[]> {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({ id: schema.jobs.id, titel: schema.jobs.title, firma: schema.companies.name })
      .from(schema.savedJobs)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.savedJobs.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(eq(schema.savedJobs.userId, userId)),
  );
  return zeilen;
}

/** Ob eine Stelle dem Nutzer überhaupt zugänglich ist. */
export async function stelleExistiert(userId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const [z] = await withUser(db, userId, (tx) =>
    tx.select({ id: schema.jobs.id }).from(schema.jobs).where(and(eq(schema.jobs.id, id))).limit(1),
  );
  return Boolean(z);
}

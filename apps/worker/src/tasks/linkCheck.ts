import { getDb, schema } from "@paycheck/db";
import { eq, isNotNull, or, sql } from "drizzle-orm";

/**
 * Linkcheck.
 *
 * Prueft, ob die Originalanzeige noch erreichbar ist - die Grundlage
 * dafuer, dass "moeglicherweise veraltet" nicht geraten ist.
 *
 * Wichtig: es wird ausschliesslich der Statuscode geholt, kein Inhalt
 * abgerufen und nichts gespeichert. Das ist kein Scraping, sondern die
 * Pruefung eines Links, den der Anbieter selbst veroeffentlicht hat.
 */

export interface LinkCheckResult {
  geprueft: number;
  erreichbar: number;
  nichtErreichbar: number;
  uebersprungen: number;
}

export async function runLinkCheck(limit = 50, fetchImpl: typeof fetch = fetch): Promise<LinkCheckResult> {
  const db = await getDb();

  const jobs = await db
    .select({ id: schema.jobs.id, url: schema.jobs.originalUrl, isDemo: schema.jobs.isDemo })
    .from(schema.jobs)
    .where(or(isNotNull(schema.jobs.originalUrl)))
    .limit(limit);

  let erreichbar = 0;
  let nichtErreichbar = 0;
  let uebersprungen = 0;

  for (const job of jobs) {
    // Demo-Stellen zeigen auf .invalid und werden nicht abgefragt.
    if (job.isDemo || !job.url || job.url.includes(".invalid")) {
      uebersprungen++;
      continue;
    }

    let ok = false;
    try {
      const response = await fetchImpl(job.url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      });
      ok = response.status < 400;
    } catch {
      ok = false;
    }

    if (ok) erreichbar++;
    else nichtErreichbar++;

    await db
      .update(schema.jobs)
      .set({ lastLinkCheckAt: new Date(), lastLinkCheckOk: ok })
      .where(eq(schema.jobs.id, job.id));
  }

  return { geprueft: erreichbar + nichtErreichbar, erreichbar, nichtErreichbar, uebersprungen };
}

/** Anzeigen, deren Frist abgelaufen ist, sind nicht mehr aktuell. */
export async function markExpired(now = new Date()): Promise<number> {
  const db = await getDb();
  const result = await db.execute(sql`
    UPDATE jobs SET last_link_check_ok = false
    WHERE expires_at IS NOT NULL AND expires_at < ${now} AND last_link_check_ok IS NOT false
  `);
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}

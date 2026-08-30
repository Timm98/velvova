import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { normalise, type JobSourceAdapter, type NormalisedListing } from "./adapter.ts";
import { decideForProvider } from "@paycheck/sources";
import { canonicalKey } from "./canonical.ts";
import { breakerFor } from "./health.ts";

/**
 * Echte Anzeigen in die Datenbank bringen.
 *
 * Drei Regeln, die den Unterschied zu einem naiven Import ausmachen:
 *
 * 1. Der Lauf ist wiederholbar. Dieselbe Anzeige zweimal abgerufen führt
 *    zu einem aktualisierten Datensatz, nicht zu einem zweiten. Der
 *    Inhaltshash entscheidet, ob sich überhaupt etwas geändert hat.
 *
 * 2. Ein Fehler bei einer Anzeige beendet nicht den ganzen Lauf, aber er
 *    wird gezählt und gemeldet. Ein stiller Teilausfall wäre schlimmer
 *    als ein lauter Totalausfall: er sieht aus wie Erfolg.
 *
 * 3. Echte Stellen tragen `isDemo: false`, Demo-Stellen `true`. Die
 *    Oberfläche trennt beides sichtbar. Vermischt wird nie.
 */

export interface IngestResult {
  sourceKey: string;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  /** Anzeigen, die zu einer bereits bekannten Stelle gehörten und
   *  deshalb als weitere Fundstelle angehängt wurden statt als Dublette
   *  in der Liste zu landen. */
  merged: number;
  failed: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
}

/** Die Quelle in der Datenbank anlegen oder auffrischen. */
async function upsertSource(
  db: Awaited<ReturnType<typeof getDb>>,
  adapter: JobSourceAdapter,
): Promise<string> {
  const existing = await db
    .select({ id: schema.jobSources.id })
    .from(schema.jobSources)
    .where(eq(schema.jobSources.key, adapter.key))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.jobSources)
      .set({
        displayName: adapter.displayName,
        licenseStatus: adapter.licenseStatus,
        attributionRequired: adapter.attributionRequired,
        attributionText: adapter.attributionText,
        termsUrl: adapter.termsUrl,
        enabled: true,
      })
      .where(eq(schema.jobSources.id, existing[0].id));
    return existing[0].id;
  }

  const [created] = await db
    .insert(schema.jobSources)
    .values({
      key: adapter.key,
      displayName: adapter.displayName,
      kind: adapter.kind,
      licenseStatus: adapter.licenseStatus,
      attributionRequired: adapter.attributionRequired,
      attributionText: adapter.attributionText,
      termsUrl: adapter.termsUrl,
      enabled: true,
    })
    .returning({ id: schema.jobSources.id });

  return created!.id;
}

/**
 * Unternehmen nach Namen zusammenführen.
 *
 * Bewusst konservativ: nur exakte, normalisierte Namensgleichheit. Eine
 * unscharfe Zusammenführung würde zwei verschiedene Arbeitgeber zu einem
 * machen, und daran hinge später eine Bewertung, die nicht zu ihnen
 * gehört.
 */
async function findOrCreateCompany(
  db: Awaited<ReturnType<typeof getDb>>,
  name: string,
): Promise<string> {
  const normalised = name.trim();
  const existing = await db
    .select({ id: schema.companies.id })
    .from(schema.companies)
    .where(sql`lower(${schema.companies.name}) = lower(${normalised})`)
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(schema.companies)
    .values({ name: normalised, isDemo: false })
    .returning({ id: schema.companies.id });

  return created!.id;
}

/**
 * Eine Fundstelle festhalten.
 *
 * Idempotent: derselbe Abruf zweimal erzeugt eine Zeile, nicht zwei.
 * Der Schlüssel dafür ist (Quelle, externe Kennung) — dieselbe Anzeige
 * beim selben Anbieter ist dieselbe Fundstelle, auch wenn sich die
 * Adresse ändert.
 */
async function verknuepfe(
  db: Awaited<ReturnType<typeof getDb>>,
  jobId: string,
  sourceId: string,
  n: NormalisedListing,
  canonical: string | null,
): Promise<void> {
  await db
    .insert(schema.jobSourceLinks)
    .values({
      jobId,
      sourceId,
      externalId: n.externalId,
      url: n.job.originalUrl ?? "",
      canonicalKey: canonical,
      lastSeenAt: n.job.fetchedAt,
    })
    .onConflictDoUpdate({
      target: [schema.jobSourceLinks.sourceId, schema.jobSourceLinks.externalId],
      set: {
        jobId,
        url: n.job.originalUrl ?? "",
        canonicalKey: canonical,
        lastSeenAt: n.job.fetchedAt,
      },
    });
}

async function writeListing(
  db: Awaited<ReturnType<typeof getDb>>,
  sourceId: string,
  n: NormalisedListing,
): Promise<"inserted" | "updated" | "unchanged" | "merged"> {
  const companyId = await findOrCreateCompany(db, n.companyName);
  const j = n.job;

  /*
   * Zwei Fragen, in dieser Reihenfolge:
   *
   *   1. Kennen wir GENAU DIESE Anzeige schon? (gleiche Quelle, gleiche
   *      Adresse) — dann wird sie fortgeschrieben.
   *   2. Kennen wir DIESE STELLE schon, von woanders? — dann bekommt der
   *      vorhandene Datensatz eine weitere Fundstelle statt einer
   *      Dublette.
   *
   * Die zweite Frage ist der eigentliche Unterschied zwischen einer
   * Metasuche und drei nebeneinanderlaufenden Listen.
   */
  const existing = await db
    .select({ id: schema.jobs.id, contentHash: schema.jobs.contentHash })
    .from(schema.jobs)
    .where(sql`${schema.jobs.originalUrl} = ${j.originalUrl} and ${schema.jobs.sourceId} = ${sourceId}`)
    .limit(1);

  const schluessel = canonicalKey({
    title: j.title,
    companyName: n.companyName,
    location: j.location,
  });

  if (!existing[0] && schluessel) {
    const [anderswo] = await db
      .select({ jobId: schema.jobSourceLinks.jobId })
      .from(schema.jobSourceLinks)
      .where(eq(schema.jobSourceLinks.canonicalKey, schluessel))
      .limit(1);

    if (anderswo) {
      await verknuepfe(db, anderswo.jobId, sourceId, n, schluessel);
      return "merged";
    }
  }

  const values = {
    title: j.title,
    companyId,
    location: j.location,
    country: j.country,
    workModel: j.workModel,
    remotePercent: j.remotePercent,
    salaryMin: j.salary.min,
    salaryMax: j.salary.max,
    salaryCurrency: j.salary.currency,
    salaryPeriod: j.salary.period,
    salaryDisclosed: j.salary.disclosed,
    contractType: j.contractType,
    weeklyHours: j.weeklyHours,
    shiftWork: j.shiftWork,
    travelPercent: j.travelPercent,
    experienceLevel: j.experienceLevel,
    industry: j.industry,
    languageRequirements: j.languageRequirements,
    requiredLicenses: j.requiredLicenses,
    workPermitRequired: j.workPermitRequired,
    coreTasks: j.coreTasks,
    description: j.description,
    benefits: j.benefits,
    applyMethod: j.applyMethod,
    applyTarget: j.applyTarget,
    publishedAt: j.publishedAt,
    expiresAt: j.expiresAt,
    fetchedAt: j.fetchedAt,
    originalUrl: j.originalUrl,
    sourceId,
    contentHash: j.contentHash,
    isDemo: false,
  };

  if (existing[0]) {
    if (existing[0].contentHash === j.contentHash) {
      // Nur den Abrufzeitpunkt fortschreiben: die Anzeige lebt noch.
      await db
        .update(schema.jobs)
        .set({ fetchedAt: j.fetchedAt })
        .where(eq(schema.jobs.id, existing[0].id));
      await verknuepfe(db, existing[0].id, sourceId, n, schluessel);
      return "unchanged";
    }

    await db.update(schema.jobs).set(values).where(eq(schema.jobs.id, existing[0].id));
    await verknuepfe(db, existing[0].id, sourceId, n, schluessel);
    await db.delete(schema.jobRequirements).where(eq(schema.jobRequirements.jobId, existing[0].id));
    if (n.requirements.length > 0) {
      await db
        .insert(schema.jobRequirements)
        .values(n.requirements.map((r) => ({ ...r, jobId: existing[0]!.id })));
    }
    await db.insert(schema.jobSnapshots).values({
      jobId: existing[0].id,
      sourceId,
      rawPayload: n.raw,
      contentHash: j.contentHash,
    });
    return "updated";
  }

  const [created] = await db.insert(schema.jobs).values(values).returning({ id: schema.jobs.id });

  if (n.requirements.length > 0) {
    await db
      .insert(schema.jobRequirements)
      .values(n.requirements.map((r) => ({ ...r, jobId: created!.id })));
  }
  await db.insert(schema.jobSnapshots).values({
    jobId: created!.id,
    sourceId,
    rawPayload: n.raw,
    contentHash: j.contentHash,
  });

  return "inserted";
}

/**
 * Die Entscheidung der Policy Engine, wie der Abruf sie braucht.
 *
 * Der Ingest kennt die Engine nicht — sie lebt in der Anwendung. Er
 * bekommt die Entscheidung übergeben und weigert sich, ohne sie zu
 * arbeiten. So kann kein Aufrufer sie versehentlich überspringen.
 */
export interface IngestPolicy {
  decision: "approved" | "link_only" | "private_import" | "blocked" | "pending_review";
  allowedOperations: string[];
  reason: string;
}

export async function ingestFromAdapter(
  adapter: JobSourceAdapter,
  options: { limit?: number; since?: Date; policy?: IngestPolicy } = {},
): Promise<IngestResult> {
  const startedAt = new Date();

  /*
   * Ohne Freigabe wird nichts abgerufen.
   *
   * Zwei Eigenschaften machen den Riegel wirksam, und beide sind hier
   * bewusst gesetzt:
   *
   * **Er steht vor dem ersten Netzzugriff.** Ein Abruf, der erst
   * hinterher als unzulässig erkannt wird, hat stattgefunden; die Daten
   * liegen dann schon da, und die Rechtsfrage ist bereits beantwortet,
   * falsch.
   *
   * **Er ist nicht optional.** Die erste Fassung nahm die Entscheidung
   * als Parameter entgegen — wer ihn vergass, rief ungeprüft ab, ohne
   * dass irgendetwas fehlschlug. Die Entscheidung wird jetzt hier
   * geholt. `options.policy` bleibt nur, um sie im Test zu setzen, und
   * kann den Riegel nicht abschalten: fehlt sie, wird gefragt.
   */
  {
    const { decision, allowedOperations, reason } =
      options.policy ?? decideForProvider(adapter.key);
    if (decision !== "approved" || !allowedOperations.includes("Search")) {
      return {
        sourceKey: adapter.key,
        fetched: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        merged: 0,
        failed: 0,
        errors: [`Abruf nicht freigegeben (${decision}): ${reason}`],
        startedAt,
        finishedAt: new Date(),
      };
    }
  }

  /*
   * Die Sicherung.
   *
   * Nach drei Fehlschlägen in Folge wird fünf Minuten lang nicht mehr
   * gefragt. Das schützt nicht uns — ein fehlgeschlagener Abruf kostet
   * uns nichts — sondern den anderen: einen überlasteten Dienst weiter
   * im Minutentakt anzufragen, verlängert seinen Ausfall.
   */
  const breaker = breakerFor(adapter.key);
  if (!breaker.allows()) {
    const sekunden = Math.ceil(breaker.retryInMs() / 1000);
    return {
      sourceKey: adapter.key,
      fetched: 0, inserted: 0, updated: 0, unchanged: 0, merged: 0, failed: 0,
      errors: [
        `Abruf ausgesetzt: die letzten Versuche sind fehlgeschlagen. ` +
          `Nächster Versuch in ${sekunden} Sekunden.`,
      ],
      startedAt,
      finishedAt: new Date(),
    };
  }

  const db = await getDb();
  const sourceId = await upsertSource(db, adapter);

  const result: IngestResult = {
    sourceKey: adapter.key,
    fetched: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    merged: 0,
    failed: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
  };

  let listings;
  try {
    listings = await adapter.fetchListings({ limit: options.limit ?? 100, since: options.since });
  } catch (error) {
    breaker.recordFailure();
    result.failed = 1;
    result.errors.push(error instanceof Error ? error.message : String(error));
    result.finishedAt = new Date();
    await db
      .update(schema.jobSources)
      .set({ lastRunAt: result.finishedAt, lastRunOk: false, lastRunError: result.errors[0] ?? null })
      .where(eq(schema.jobSources.id, sourceId));
    return result;
  }

  breaker.recordSuccess();
  result.fetched = listings.length;
  const fetchedAt = new Date();

  for (const listing of listings) {
    try {
      const outcome = await writeListing(db, sourceId, normalise(listing, fetchedAt));
      result[outcome] += 1;
    } catch (error) {
      result.failed += 1;
      // Die Kennung der Anzeige, nicht ihr Inhalt: Fehlermeldungen
      // landen in Protokollen, und dort gehören keine Volltexte hin.
      result.errors.push(
        `${listing.externalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  result.finishedAt = new Date();

  await db
    .update(schema.jobSources)
    .set({
      lastRunAt: result.finishedAt,
      lastRunOk: result.failed === 0,
      lastRunError: result.errors[0] ?? null,
    })
    .where(eq(schema.jobSources.id, sourceId));

  return result;
}

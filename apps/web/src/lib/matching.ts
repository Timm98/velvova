import { getDb, schema, withUser } from "@paycheck/db";
import {
  UserConstraintsSchema,
  type EvidenceItem,
  type Job,
  type JobRequirement,
  type JobSource,
  type ReviewAggregate,
  type ReviewTheme,
  type UserConstraints,
} from "@paycheck/domain";
import {
  checkConstraints,
  computeAiTransition,
  computeConfidence,
  computeFit,
  computeJobQuality,
  computeListingConfidence,
  computeOverall,
  sortJobs,
  type CommuteEstimator,
  type RankableJob,
  type SortKey,
  assessScamSignals,
  type ScamAssessment,
} from "@paycheck/matching";
import { and, eq, isNull, sql } from "drizzle-orm";

/**
 * Bringt Datenbank und Bewertungslogik zusammen.
 *
 * Die Berechnung läuft bewusst bei jeder Anfrage neu, statt gespeicherte
 * Werte auszuliefern: ändert der Mensch eine Bedingung oder bestätigt
 * eine Evidenz, muss sich das Ergebnis sofort ändern. Persistiert werden
 * die Ergebnisse zusätzlich (Tabelle job_matches), damit ein Score später
 * nachvollziehbar bleibt - nicht als Cache.
 */

/**
 * Schätzt Reisezeiten aus einer kleinen Tabelle. Ein Routendienst wäre
 * genauer, braucht aber einen Vertrag und schickt den Wohnort an Dritte.
 * Solange keiner verbunden ist, sagt die Oberfläche "geschätzt" - und
 * unbekannte Verbindungen liefern null, nicht eine erfundene Zahl.
 */
const DISTANCE_MINUTES: Record<string, Record<string, number>> = {
  Hamburg: { Hamburg: 25, Lübeck: 70, Kiel: 85, Bremen: 75, Hannover: 100, Berlin: 110, München: 380 },
  Berlin: { Berlin: 30, Hamburg: 110, Leipzig: 75, München: 260 },
  München: { München: 30, Augsburg: 45, Nürnberg: 70, Berlin: 260, Hamburg: 380 },
  Köln: { Köln: 25, Düsseldorf: 35, Bonn: 30, Dortmund: 60 },
};

export const commuteEstimator: CommuteEstimator = {
  estimateMinutes(from, to, mode) {
    const table = DISTANCE_MINUTES[from];
    const base = table?.[to];
    if (base === undefined) return null;
    // Grobe Anpassung nach Verkehrsmittel. Bewusst konservativ.
    const factor = mode === "car" ? 0.85 : mode === "bike" ? 1.6 : mode === "walk" ? 4 : 1;
    return Math.round(base * factor);
  },
};

// --- Laden ---------------------------------------------------------------

function rowToJob(row: typeof schema.jobs.$inferSelect, companyName: string): Job {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companyId,
    companyName,
    location: row.location,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    workModel: row.workModel,
    remotePercent: row.remotePercent,
    salary: {
      min: row.salaryMin,
      max: row.salaryMax,
      currency: row.salaryCurrency,
      period: row.salaryPeriod,
      disclosed: row.salaryDisclosed,
    },
    contractType: row.contractType,
    weeklyHours: row.weeklyHours,
    shiftWork: row.shiftWork,
    travelPercent: row.travelPercent,
    experienceLevel: row.experienceLevel,
    industry: row.industry,
    languageRequirements: row.languageRequirements,
    requiredLicenses: row.requiredLicenses,
    workPermitRequired: row.workPermitRequired,
    coreTasks: row.coreTasks,
    description: row.description,
    benefits: row.benefits,
    applyMethod: row.applyMethod,
    applyTarget: row.applyTarget,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    fetchedAt: row.fetchedAt,
    lastLinkCheckAt: row.lastLinkCheckAt,
    lastLinkCheckOk: row.lastLinkCheckOk,
    originalUrl: row.originalUrl,
    sourceId: row.sourceId,
    contentHash: row.contentHash,
    isDemo: row.isDemo,
  };
}

function rowToEvidence(row: typeof schema.evidenceItems.$inferSelect): EvidenceItem {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    statement: row.statement,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    confidence: row.confidence,
    userConfirmed: row.userConfirmed,
    userRejected: row.userRejected,
    sensitivityLevel: row.sensitivityLevel,
    retentionClass: row.retentionClass,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

export interface UserProfileContext {
  constraints: UserConstraints;
  evidence: EvidenceItem[];
  energisingTasks: string[];
  drainingTasks: string[];
  workStylePreferences: string[];
  rankedValues: string[];
  statedInterests: string[];
  profileConfirmed: boolean;
  coverage: number;
}

const EMPTY_CONSTRAINTS = UserConstraintsSchema.parse({
  minSalaryPerYear: null,
  baseLocation: null,
  maxCommuteMinutes: null,
  weeklyHoursMin: null,
  weeklyHoursMax: null,
  maxTravelPercent: null,
});

export async function loadProfileContext(userId: string): Promise<UserProfileContext> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [constraintRow] = await tx
      .select()
      .from(schema.userConstraints)
      .where(eq(schema.userConstraints.userId, userId))
      .limit(1);

    const evidenceRows = await tx
      .select()
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt)));

    const [profileRow] = await tx
      .select()
      .from(schema.careerProfiles)
      .where(eq(schema.careerProfiles.userId, userId))
      .limit(1);

    const evidence = evidenceRows.map(rowToEvidence);
    const alive = evidence.filter((e) => !e.userRejected);

    // Aus der Evidenz ableiten, was der Fit an Präferenzen braucht.
    const byRef = (needle: string) =>
      alive.filter((e) => e.sourceRef?.includes(needle)).map((e) => e.statement);

    const energising = alive
      .filter((e) => e.type === "preference" && /energie gibt|geben energie|leicht/i.test(e.statement))
      .map((e) => e.statement);
    const draining = alive
      .filter((e) => e.type === "preference" && /kostet|laugt|vermeide|falsch an/i.test(e.statement))
      .map((e) => e.statement);

    let constraints = EMPTY_CONSTRAINTS;
    if (constraintRow?.data) {
      const parsed = UserConstraintsSchema.safeParse(constraintRow.data);
      // Ein ungültiger Datensatz darf nicht dazu führen, dass Bedingungen
      // stillschweigend wegfallen. Lieber die leere, sichere Fassung.
      if (parsed.success) constraints = parsed.data;
    }

    return {
      constraints,
      evidence,
      energisingTasks: energising.length > 0 ? energising : byRef("tasks_and_energy"),
      drainingTasks: draining,
      workStylePreferences: byRef("work_style_and_environment"),
      rankedValues: byRef("values_and_motives"),
      statedInterests: byRef("learning_goals"),
      profileConfirmed: profileRow?.confirmedByUser ?? false,
      coverage: profileRow?.coverage ?? 0,
    };
  });
}

// --- Bewerten ------------------------------------------------------------

export interface ScoredJob extends RankableJob {
  job: Job;
  requirements: JobRequirement[];
  source: JobSource | null;
  /**
   * Warnzeichen in der Anzeige selbst.
   *
   * Steht getrennt von allen anderen Werten, weil es um etwas anderes
   * geht: nicht um Passung, sondern um Schaden. Ein Vorschussbetrug
   * kostet mehrere hundert Euro, die eine arbeitssuchende Person
   * gerade nicht hat.
   */
  scam: ScamAssessment;
  /** Wo dieselbe Stelle sonst noch steht. Leer, solange nur eine Quelle
   *  sie kennt — dann ist es keine Metasuche, sondern eine Liste, und
   *  das soll die Oberfläche nicht anders aussehen lassen. */
  alsoListedOn: { sourceName: string; url: string }[];
  reviews: ReviewAggregate[];
  themes: ReviewTheme[];
  confidence: ReturnType<typeof computeConfidence>;
  listingConfidence: ReturnType<typeof computeListingConfidence>;
}

export async function scoreAllJobs(userId: string, ctx: UserProfileContext): Promise<ScoredJob[]> {
  const db = await getDb();

  const allJobRows = await db
    .select({ job: schema.jobs, companyName: schema.companies.name })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId));

  /*
   * Erfundene Stellen erscheinen nicht in der Produktoberfläche.
   *
   * Die Regel ist bewusst datenabhängig statt konfigurierbar: sobald
   * auch nur eine echte Anzeige vorliegt, verschwinden die
   * Demo-Datensätze. Ein Schalter dafür würde irgendwann falsch stehen,
   * und dann stünden erfundene Unternehmen neben echten — genau das
   * darf nicht passieren.
   *
   * Ohne echte Stellen bleiben die Demo-Daten sichtbar, damit ein
   * frisch aufgesetztes Projekt nicht leer wirkt. Sie sind an jeder
   * Stelle als solche gekennzeichnet.
   */
  const hasRealJobs = allJobRows.some((r) => !r.job.isDemo);
  const jobRows = hasRealJobs ? allJobRows.filter((r) => !r.job.isDemo) : allJobRows;

  const requirementRows = await db.select().from(schema.jobRequirements);
  const sourceRows = await db.select().from(schema.jobSources);
  // Die weiteren Fundstellen derselben Stelle. Ein Abruf für alle
  // Stellen; pro Stelle einzeln nachzufragen wäre bei 150 Anzeigen
  // genau die Art von Abfrage, die eine Liste langsam macht.
  const linkRows = await db.select().from(schema.jobSourceLinks);
  const reviewRows = await db.select().from(schema.reviewAggregates);
  const themeRows = await db.select().from(schema.reviewThemes);

  // Reposts erkennen: gleiche Inhalte, früher erfasst.
  const byHash = new Map<string, Date[]>();
  for (const { job } of jobRows) {
    const list = byHash.get(job.contentHash) ?? [];
    list.push(job.publishedAt ?? job.fetchedAt);
    byHash.set(job.contentHash, list);
  }

  const now = new Date();

  return jobRows.map(({ job: row, companyName }) => {
    const job = rowToJob(row, companyName);
    const requirements: JobRequirement[] = requirementRows
      .filter((r) => r.jobId === job.id)
      .map((r) => ({
        id: r.id,
        jobId: r.jobId,
        kind: r.kind,
        text: r.text,
        skillKey: r.skillKey,
        category: r.category as JobRequirement["category"],
      }));

    const source = sourceRows.find((s) => s.id === job.sourceId) ?? null;
    const reviews: ReviewAggregate[] = reviewRows
      .filter((r) => r.companyId === job.companyId)
      .map((r) => ({ ...r, ratingScaleMax: r.ratingScaleMax }) as ReviewAggregate);
    const themes: ReviewTheme[] = themeRows.filter((t) => t.companyId === job.companyId) as ReviewTheme[];

    const mine = job.publishedAt ?? job.fetchedAt;
    const earlierDuplicates = (byHash.get(job.contentHash) ?? []).filter(
      (d) => d.getTime() < mine.getTime(),
    ).length;

    const constraints = checkConstraints(job, ctx.constraints, commuteEstimator);
    const fit = computeFit({
      job,
      requirements,
      evidence: ctx.evidence,
      constraints: ctx.constraints,
      energisingTasks: ctx.energisingTasks,
      drainingTasks: ctx.drainingTasks,
      workStylePreferences: ctx.workStylePreferences,
      rankedValues: ctx.rankedValues,
      statedInterests: ctx.statedInterests,
    });
    const confidence = computeConfidence({
      job,
      fitCoverage: fit.coverage,
      profileCoverage: ctx.coverage,
      requirementCount: requirements.length,
      reviews,
      now,
    });
    const jobQuality = computeJobQuality({ job, reviews, themes });
    const aiTransition = computeAiTransition({ job, dataAsOf: null });
    const listingConfidence = computeListingConfidence({
      job,
      source: source as JobSource | null,
      earlierDuplicateCount: earlierDuplicates,
      now,
    });
    const overall = computeOverall({
      constraints,
      fit,
      confidence,
      jobQuality,
      aiTransition,
      listingConfidence,
    });

    const salaryPerYear =
      job.salary.disclosed && (job.salary.max ?? job.salary.min) !== null
        ? job.salary.period === "month"
          ? (job.salary.max ?? job.salary.min)! * 12
          : job.salary.period === "hour"
            ? (job.salary.max ?? job.salary.min)! * 40 * 52
            : (job.salary.max ?? job.salary.min)!
        : null;

    const commuteMinutes =
      job.workModel === "remote"
        ? 0
        : ctx.constraints.baseLocation
          ? commuteEstimator.estimateMinutes(ctx.constraints.baseLocation, job.location, ctx.constraints.commuteMode)
          : null;

    // Nur ANDERE Quellen. Die eigene noch einmal als "auch gelistet bei"
    // zu zeigen, wäre eine Behauptung über Reichweite, die nicht stimmt.
    const alsoListedOn = linkRows
      .filter((l) => l.jobId === job.id && l.sourceId !== job.sourceId && l.url)
      .map((l) => ({
        sourceName: sourceRows.find((s) => s.id === l.sourceId)?.displayName ?? "unbekannt",
        url: l.url,
      }));

    return {
      jobId: job.id,
      job,
      requirements,
      source: source as JobSource | null,
      scam: assessScamSignals({
        title: job.title,
        description: job.description,
        companyName: job.companyName,
        originalUrl: job.originalUrl,
        fromEmployerFeed: source?.kind === "employer_feed",
        // Verifiziert ist eine Domäne erst, wenn sie in employer_boards
        // steht. Solange es dort keinen Eintrag gibt, ist "geprüfte
        // Quelle" eine Auszeichnung, die niemand verdient hat.
        employerDomainVerified: false,
      }),
      alsoListedOn,
      reviews,
      themes,
      overall,
      fit,
      confidence,
      jobQuality,
      aiTransition,
      listingConfidence,
      constraints,
      salaryPerYear,
      commuteMinutes,
      publishedAt: job.publishedAt,
    };
  });
}

export interface JobListOptions {
  sort?: SortKey;
  includeBlocked?: boolean;
  limit?: number;
}

/**
 * Eine Stelle ist nicht mehr aktuell, wenn ihr Ablaufdatum vorbei ist
 * oder die letzte Linkprüfung fehlgeschlagen hat.
 *
 * Beides bedeutet dasselbe für die Person: eine Bewerbung dort geht ins
 * Leere. Eine abgelaufene Anzeige im Ranking ist nicht bloss veraltete
 * Information — sie kostet Arbeit, die niemand liest.
 *
 * Aus der Rangfolge fliegt sie deshalb raus. Von der Detailseite nicht:
 * wer sich die Stelle gemerkt hat, soll seinen eigenen Vorgang
 * weiterhin sehen können, dort dann mit Hinweis.
 */
export function isStale(job: ScoredJob["job"], now = new Date()): boolean {
  if (job.expiresAt && job.expiresAt.getTime() < now.getTime()) return true;
  if (job.lastLinkCheckOk === false) return true;
  return false;
}

export async function listJobsForUser(
  userId: string,
  ctx: UserProfileContext,
  options: JobListOptions = {},
): Promise<{ jobs: ScoredJob[]; blockedCount: number; staleCount: number }> {
  const all = await scoreAllJobs(userId, ctx);

  const stale = all.filter((j) => isStale(j.job));
  const current = all.filter((j) => !isStale(j.job));

  const blocked = current.filter((j) => j.constraints.overall === "blocked");
  const visible = options.includeBlocked
    ? current
    : current.filter((j) => j.constraints.overall !== "blocked");
  const sorted = sortJobs(visible, options.sort ?? "best_overall") as ScoredJob[];

  return {
    jobs: options.limit ? sorted.slice(0, options.limit) : sorted,
    blockedCount: blocked.length,
    staleCount: stale.length,
  };
}

export async function loadScoredJob(userId: string, jobId: string): Promise<ScoredJob | null> {
  const ctx = await loadProfileContext(userId);
  const all = await scoreAllJobs(userId, ctx);
  return all.find((j) => j.jobId === jobId) ?? null;
}

/**
 * Schreibt das Ergebnis fort, damit ein später angezeigter Wert erklärbar
 * bleibt - mitsamt der Fassung der Bewertungslogik, die ihn erzeugt hat.
 */
export async function persistMatch(userId: string, scored: ScoredJob): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, async (tx) => {
    const [match] = await tx
      .insert(schema.jobMatches)
      .values({
        userId,
        jobId: scored.jobId,
        fitScore: scored.fit.score,
        fitBand: scored.fit.band,
        fitCoverage: scored.fit.coverage,
        confidenceScore: scored.confidence.score,
        jobQualityScore: scored.jobQuality.score,
        listingConfidenceScore: scored.listingConfidence.score,
        aiTransitionCategory: scored.aiTransition.category,
        overallScore: scored.overall.score,
        constraintVerdict: scored.constraints.overall,
        topReason: scored.fit.topReason,
        topReservation: scored.fit.topReservation,
        scoringVersion: scored.fit.version,
        computedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.jobMatches.userId, schema.jobMatches.jobId],
        set: {
          fitScore: scored.fit.score,
          fitBand: scored.fit.band,
          overallScore: scored.overall.score,
          computedAt: new Date(),
        },
      })
      .returning();

    if (!match) return;
    await tx.delete(schema.matchFactors).where(eq(schema.matchFactors.matchId, match.id));

    const factors = [
      ...scored.fit.factors.map((f) => ({ ...f, scoreKind: "fit" })),
      ...scored.confidence.factors.map((f) => ({ ...f, scoreKind: "confidence" })),
      ...scored.jobQuality.dimensions.map((f) => ({ ...f, scoreKind: "job_quality" })),
    ];
    if (factors.length > 0) {
      await tx.insert(schema.matchFactors).values(
        factors.map((f) => ({
          matchId: match.id,
          scoreKind: f.scoreKind,
          key: f.key,
          label: f.label,
          raw: f.raw,
          weight: f.weight,
          contribution: f.contribution,
          explanation: f.explanation,
          evidenceIds: f.evidenceIds,
        })),
      );
    }
  });
}

export async function recordEvent(
  userId: string,
  type: (typeof schema.applicationEvents.$inferInsert)["type"],
  opts: { jobId?: string; applicationId?: string } = {},
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx.insert(schema.applicationEvents).values({
      userId,
      type,
      jobId: opts.jobId ?? null,
      applicationId: opts.applicationId ?? null,
      occurredAt: new Date(),
    }),
  );
}

export async function countSentApplications(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await withUser(db, userId, (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.applicationEvents)
      .where(
        and(eq(schema.applicationEvents.userId, userId), eq(schema.applicationEvents.type, "application_sent")),
      ),
  );
  return rows[0]?.n ?? 0;
}

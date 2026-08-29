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
} from "@paycheck/matching";
import { and, eq, isNull, sql } from "drizzle-orm";

/**
 * Bringt Datenbank und Bewertungslogik zusammen.
 *
 * Die Berechnung laeuft bewusst bei jeder Anfrage neu, statt gespeicherte
 * Werte auszuliefern: aendert der Mensch eine Bedingung oder bestaetigt
 * eine Evidenz, muss sich das Ergebnis sofort aendern. Persistiert werden
 * die Ergebnisse zusaetzlich (Tabelle job_matches), damit ein Score spaeter
 * nachvollziehbar bleibt - nicht als Cache.
 */

/**
 * Schaetzt Reisezeiten aus einer kleinen Tabelle. Ein Routendienst waere
 * genauer, braucht aber einen Vertrag und schickt den Wohnort an Dritte.
 * Solange keiner verbunden ist, sagt die Oberflaeche "geschaetzt" - und
 * unbekannte Verbindungen liefern null, nicht eine erfundene Zahl.
 */
const DISTANCE_MINUTES: Record<string, Record<string, number>> = {
  Hamburg: { Hamburg: 25, Luebeck: 70, Kiel: 85, Bremen: 75, Hannover: 100, Berlin: 110, Muenchen: 380 },
  Berlin: { Berlin: 30, Hamburg: 110, Leipzig: 75, Muenchen: 260 },
  Muenchen: { Muenchen: 30, Augsburg: 45, Nuernberg: 70, Berlin: 260, Hamburg: 380 },
  Koeln: { Koeln: 25, Duesseldorf: 35, Bonn: 30, Dortmund: 60 },
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

    // Aus der Evidenz ableiten, was der Fit an Praeferenzen braucht.
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
      // Ein ungueltiger Datensatz darf nicht dazu fuehren, dass Bedingungen
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
  reviews: ReviewAggregate[];
  themes: ReviewTheme[];
  confidence: ReturnType<typeof computeConfidence>;
  listingConfidence: ReturnType<typeof computeListingConfidence>;
}

export async function scoreAllJobs(userId: string, ctx: UserProfileContext): Promise<ScoredJob[]> {
  const db = await getDb();

  const jobRows = await db
    .select({ job: schema.jobs, companyName: schema.companies.name })
    .from(schema.jobs)
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId));

  const requirementRows = await db.select().from(schema.jobRequirements);
  const sourceRows = await db.select().from(schema.jobSources);
  const reviewRows = await db.select().from(schema.reviewAggregates);
  const themeRows = await db.select().from(schema.reviewThemes);

  // Reposts erkennen: gleiche Inhalte, frueher erfasst.
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

    return {
      jobId: job.id,
      job,
      requirements,
      source: source as JobSource | null,
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

export async function listJobsForUser(
  userId: string,
  ctx: UserProfileContext,
  options: JobListOptions = {},
): Promise<{ jobs: ScoredJob[]; blockedCount: number }> {
  const all = await scoreAllJobs(userId, ctx);
  const blocked = all.filter((j) => j.constraints.overall === "blocked");
  const visible = options.includeBlocked ? all : all.filter((j) => j.constraints.overall !== "blocked");
  const sorted = sortJobs(visible, options.sort ?? "best_overall") as ScoredJob[];
  return {
    jobs: options.limit ? sorted.slice(0, options.limit) : sorted,
    blockedCount: blocked.length,
  };
}

export async function loadScoredJob(userId: string, jobId: string): Promise<ScoredJob | null> {
  const ctx = await loadProfileContext(userId);
  const all = await scoreAllJobs(userId, ctx);
  return all.find((j) => j.jobId === jobId) ?? null;
}

/**
 * Schreibt das Ergebnis fort, damit ein spaeter angezeigter Wert erklaerbar
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

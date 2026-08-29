import { createHash, randomBytes, scryptSync } from "node:crypto";
import { loadRuntimeConfig } from "@paycheck/config";
import { and, eq, sql } from "drizzle-orm";
import { getDbHandle, type Database } from "../client.ts";
import * as s from "../schema/index.ts";
import { seedCompanies } from "./companies.ts";
import { seedJobs } from "./jobs.ts";
import { LEA_EMAIL, leaConstraints, leaEvidence, leaRoleClusters } from "./lea.ts";
import { seedReviews } from "./reviews.ts";
import { seedTaxonomy } from "./taxonomy.ts";

/**
 * Seed-Daten. Ausschließlich synthetisch und durchgaengig als Demo
 * markiert - `is_demo = true` an Unternehmen und Stellen, damit die
 * Oberfläche sie nie als Live-Angebot ausgeben kann.
 *
 * Läuft idempotent: ein zweiter Aufruf legt nichts doppelt an.
 */

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY);
const inDays = (n: number) => new Date(now + n * DAY);

function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

function contentHash(...parts: string[]): string {
  return createHash("sha256").update(parts.join(" ")).digest("hex").slice(0, 32);
}

async function seedAll(db: Database): Promise<void> {
  // --- Jobquelle ---
  const [source] = await db
    .insert(s.jobSources)
    .values({
      key: "seed",
      displayName: "Demo-Datensatz",
      kind: "seed",
      licenseStatus: "demo",
      attributionRequired: false,
      enabled: true,
      lastRunAt: new Date(),
      lastRunOk: true,
    })
    .onConflictDoUpdate({ target: s.jobSources.key, set: { lastRunAt: new Date() } })
    .returning();
  const sourceId = source!.id;

  // --- Taxonomie und freiwillige Kurzaufgaben ---
  for (const skill of seedTaxonomy.skills) {
    await db.insert(s.skills).values(skill).onConflictDoNothing();
  }
  for (const occ of seedTaxonomy.occupations) {
    await db.insert(s.occupations).values(occ).onConflictDoNothing();
  }
  for (const m of seedTaxonomy.microAssessments) {
    await db.insert(s.microAssessments).values(m).onConflictDoNothing();
  }

  // --- Unternehmen ---
  const companyIds = new Map<string, string>();
  for (const c of seedCompanies) {
    const existing = await db
      .select({ id: s.companies.id })
      .from(s.companies)
      .where(eq(s.companies.name, c.name))
      .limit(1);
    if (existing[0]) {
      companyIds.set(c.key, existing[0].id);
      continue;
    }
    const [row] = await db
      .insert(s.companies)
      .values({
        name: c.name,
        website: c.website,
        industry: c.industry,
        sizeBand: c.sizeBand,
        headquarters: c.headquarters,
        registryVerified: c.registryVerified,
        isDemo: true,
      })
      .returning();
    companyIds.set(c.key, row!.id);
  }

  // --- Stellen ---
  const jobIds = new Map<string, string>();
  for (const j of seedJobs) {
    const companyId = companyIds.get(j.companyKey)!;
    const url = `https://demo.invalid/jobs/${j.key}`;
    // Reposts teilen sich bewusst den Inhaltshash mit ihrer Vorlage.
    const hash = contentHash(j.contentHashGroup ?? j.key, j.title, j.description);

    const existing = await db
      .select({ id: s.jobs.id })
      .from(s.jobs)
      .where(eq(s.jobs.originalUrl, url))
      .limit(1);
    if (existing[0]) {
      jobIds.set(j.key, existing[0].id);
      continue;
    }

    const [row] = await db
      .insert(s.jobs)
      .values({
        title: j.title,
        companyId,
        location: j.location,
        country: "DE",
        workModel: j.workModel,
        remotePercent: j.remotePercent,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryDisclosed: j.salaryDisclosed,
        contractType: j.contractType as never,
        weeklyHours: j.weeklyHours,
        shiftWork: j.shiftWork,
        travelPercent: j.travelPercent,
        experienceLevel: j.experienceLevel as never,
        industry: j.industry,
        languageRequirements: j.languageRequirements,
        requiredLicenses: j.requiredLicenses,
        workPermitRequired: j.workPermitRequired,
        coreTasks: j.coreTasks,
        description: j.description,
        benefits: j.benefits,
        applyMethod: j.applyMethod,
        applyTarget: j.applyTarget,
        publishedAt: j.publishedDaysAgo === null ? null : daysAgo(j.publishedDaysAgo),
        expiresAt: j.expiresInDays === null ? null : inDays(j.expiresInDays),
        fetchedAt: new Date(),
        lastLinkCheckAt: j.linkCheckOk === null ? null : daysAgo(1),
        lastLinkCheckOk: j.linkCheckOk,
        originalUrl: url,
        sourceId,
        contentHash: hash,
        isDemo: true,
      })
      .returning();
    jobIds.set(j.key, row!.id);

    for (const r of j.requirements) {
      await db.insert(s.jobRequirements).values({
        jobId: row!.id,
        kind: r.kind,
        text: r.text,
        category: r.category,
        skillKey: null,
      });
    }
    await db.insert(s.jobSnapshots).values({
      jobId: row!.id,
      sourceId,
      contentHash: hash,
      rawPayload: { note: "Synthetischer Demo-Datensatz, keine externe Quelle." },
    });
  }

  // --- Bewertungen, nach Quellenart getrennt ---
  for (const r of seedReviews) {
    const companyId = companyIds.get(r.companyKey);
    if (!companyId) continue;
    const existing = await db
      .select({ id: s.reviewAggregates.id })
      .from(s.reviewAggregates)
      .where(and(eq(s.reviewAggregates.companyId, companyId), eq(s.reviewAggregates.sourceName, r.sourceName)))
      .limit(1);
    if (existing[0]) continue;

    const [agg] = await db
      .insert(s.reviewAggregates)
      .values({
        companyId,
        sourceKind: r.sourceKind as never,
        sourceName: r.sourceName,
        sourceUrl: r.sourceUrl,
        ratingAverage: r.ratingAverage,
        sampleSize: r.sampleSize,
        locationScope: r.locationScope,
        roleScope: r.roleScope,
        periodFrom: daysAgo(r.periodDays),
        periodTo: new Date(),
        attributionText: r.attributionText,
        selectionNote: r.selectionNote,
        isDemo: true,
      })
      .returning();

    for (const t of r.themes) {
      await db.insert(s.reviewThemes).values({
        companyId,
        aggregateId: agg!.id,
        theme: t.theme,
        sentiment: t.sentiment as never,
        mentionCount: t.mentionCount,
        summary: t.summary,
        sourceUrl: r.sourceUrl,
        periodFrom: daysAgo(r.periodDays),
        periodTo: new Date(),
      });
    }
    await db.insert(s.sourceCitations).values({
      subjectType: "company",
      subjectId: companyId,
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
      sourceKind: r.sourceKind,
      retrievedAt: new Date(),
      licenseNote: "Synthetischer Demo-Datensatz. Keine reale Bewertungsquelle.",
    });
  }

  // --- Demo-Nutzerin Lea ---
  const existingUser = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(eq(s.users.email, LEA_EMAIL))
    .limit(1);
  if (existingUser[0]) {
    console.log("Demo-Nutzerin besteht bereits, Profildaten übersprungen.");
    return;
  }

  const [lea] = await db
    .insert(s.users)
    .values({
      email: LEA_EMAIL,
      displayName: "Lea (Demo)",
      role: "candidate",
      emailVerifiedAt: new Date(),
      passwordHash: hashPassword("demo-passwort-nur-lokal"),
    })
    .returning();
  const userId = lea!.id;

  await db.insert(s.userSettings).values({
    userId,
    locale: "de",
    country: "DE",
    currency: "EUR",
    theme: "system",
    baseLocation: "Hamburg",
    searchRadiusKm: 30,
    maxCommuteMinutes: 45,
    commuteMode: "public_transport",
    willingToRelocate: false,
  });

  const grantedConsents = [
    ["career_profile", "Erstellung und Pflege des Karriereprofils"],
    ["document_analysis", "Auswertung hochgeladener Unterlagen zur Vorbefüllung des Profils"],
    ["external_ai_processing", "Verarbeitung durch einen externen KI-Anbieter zur Textanalyse"],
  ] as const;
  for (const [kind, purpose] of grantedConsents) {
    await db.insert(s.consents).values({
      userId,
      kind,
      granted: true,
      policyVersion: "2026-08-1",
      purpose,
      grantedAt: new Date(),
    });
  }
  // Sprache, Transkript, Training und Weitergabe bewusst nicht erteilt:
  // zeigt in der Oberfläche den getrennten, ehrlichen Fall.
  const openConsents = ["voice_input", "transcript_storage", "model_training", "partner_sharing"] as const;
  for (const kind of openConsents) {
    await db.insert(s.consents).values({
      userId,
      kind,
      granted: false,
      policyVersion: "2026-08-1",
      purpose: "Noch nicht erteilt",
    });
  }

  const [profile] = await db
    .insert(s.careerProfiles)
    .values({
      userId,
      confirmedByUser: true,
      confirmedAt: new Date(),
      coverage: 0.86,
      careerCompass:
        "Du bist am staerksten, wenn du zwischen Menschen und einem komplizierten Thema stehst " +
        "und es verstaendlich machst. Zwei Jahre Kundenservice haben dir beigebracht, ruhig zu " +
        "bleiben, wenn es eng wird - das ist kein Nebeneffekt, sondern deine Kernstärke. Was " +
        "dir fehlt, ist nicht Fähigkeit, sondern eine Richtung, die du begründen kannst.",
    })
    .returning();

  const evidenceIds = new Map<string, string>();
  for (const e of leaEvidence) {
    const [row] = await db
      .insert(s.evidenceItems)
      .values({
        userId,
        profileId: profile!.id,
        type: e.type as never,
        statement: e.statement,
        sourceType: e.sourceType as never,
        sourceRef: e.sourceRef,
        confidence: e.confidence,
        userConfirmed: e.userConfirmed,
      })
      .returning();
    evidenceIds.set(e.key, row!.id);
  }

  await db.insert(s.userConstraints).values({ userId, data: leaConstraints as never });

  for (const c of leaRoleClusters) {
    await db.insert(s.roleClusters).values({
      userId,
      title: c.title,
      rationale: c.rationale,
      kind: c.kind,
      supportingEvidenceIds: c.evidenceKeys.map((k) => evidenceIds.get(k)).filter((x): x is string => !!x),
      gaps: c.gaps,
      criticalConstraints: c.criticalConstraints,
      entryRealism: c.entryRealism,
      nextValidationStep: c.nextValidationStep,
      userConfirmed: c.kind === "obvious",
    });
  }

  await db.insert(s.interviewSessions).values({
    userId,
    mode: "text",
    locale: "de",
    stage: "role_clusters",
    status: "completed",
    completedStages: [
      "consent_and_goal",
      "current_situation",
      "background",
      "experience_episodes",
      "tasks_and_energy",
      "feedback_and_recognition",
      "work_style_and_environment",
      "values_and_motives",
      "hard_constraints",
      "location_and_logistics",
      "learning_goals",
    ],
    skippedStages: ["micro_work_samples"],
    completedAt: daysAgo(2),
  });

  // --- Bewerbungen in verschiedenen Stadien ---
  const stages = [
    { jobKey: "csm-nordlicht", stage: "interview", days: 12 },
    { jobKey: "projektkoordination-leuchtturm", stage: "sent", days: 6 },
    { jobKey: "marketing-wellenform", stage: "rejected", days: 25 },
    { jobKey: "kundenerfolg-grünspan", stage: "saved", days: 1 },
    { jobKey: "datenpflege-hafenblick", stage: "withdrawn", days: 30 },
  ] as const;

  for (const st of stages) {
    const jobId = jobIds.get(st.jobKey);
    if (!jobId) continue;
    const [app] = await db
      .insert(s.applications)
      .values({
        userId,
        jobId,
        stage: st.stage as never,
        lastContactAt: st.stage === "saved" ? null : daysAgo(st.days - 2),
        nextStepAt: st.stage === "interview" ? inDays(3) : null,
        nextStepLabel: st.stage === "interview" ? "Gespräch vorbereiten" : null,
        createdAt: daysAgo(st.days),
      })
      .returning();

    await db.insert(s.applicationEvents).values({
      userId,
      applicationId: app!.id,
      jobId,
      type: "job_viewed",
      occurredAt: daysAgo(st.days + 1),
    });

    if (st.stage !== "saved") {
      await db.insert(s.applicationEvents).values([
        { userId, applicationId: app!.id, jobId, type: "application_started", occurredAt: daysAgo(st.days) },
        { userId, applicationId: app!.id, jobId, type: "application_sent", occurredAt: daysAgo(st.days - 1) },
      ]);
    }
    if (st.stage === "interview") {
      await db.insert(s.applicationEvents).values({
        userId,
        applicationId: app!.id,
        jobId,
        type: "interview_scheduled",
        occurredAt: daysAgo(2),
      });
      await db.insert(s.reminders).values({
        userId,
        applicationId: app!.id,
        kind: "interview_prep",
        dueAt: inDays(2),
        label: "Gespräch bei Nordlicht Software vorbereiten",
      });
    }
    if (st.stage === "rejected") {
      await db.insert(s.applicationEvents).values({
        userId,
        applicationId: app!.id,
        jobId,
        type: "rejected",
        occurredAt: daysAgo(st.days - 10),
      });
    }
  }

  // Neun weitere versendete Bewerbungen ohne Rückmeldung. Erst damit hat
  // der Trichter genug Fälle, um überhaupt etwas zu diagnostizieren -
  // unter dieser Menge sagt die Diagnose ausdrücklich nichts.
  const filler = jobIds.get("beratung-kranzberg-neu");
  if (filler) {
    for (let i = 0; i < 9; i++) {
      await db.insert(s.applicationEvents).values([
        { userId, jobId: filler, type: "job_viewed", occurredAt: daysAgo(40 - i * 3) },
        { userId, jobId: filler, type: "application_sent", occurredAt: daysAgo(39 - i * 3) },
      ]);
    }
  }

  console.log(`Demo-Nutzerin angelegt: ${LEA_EMAIL}`);
}

const cfg = loadRuntimeConfig();
const { db, close } = await getDbHandle(cfg);
await seedAll(db);

const counts = (await db.execute(sql`
  SELECT
    (SELECT count(*) FROM companies)::int          AS unternehmen,
    (SELECT count(*) FROM jobs)::int               AS stellen,
    (SELECT count(*) FROM job_requirements)::int   AS anforderungen,
    (SELECT count(*) FROM review_aggregates)::int  AS bewertungsquellen,
    (SELECT count(*) FROM evidence_items)::int     AS evidenz,
    (SELECT count(*) FROM role_clusters)::int      AS rollencluster,
    (SELECT count(*) FROM applications)::int       AS bewerbungen,
    (SELECT count(*) FROM application_events)::int AS ereignisse
`)) as unknown as { rows: Record<string, number>[] };
console.log("Seed abgeschlossen:", counts.rows[0]);
await close();

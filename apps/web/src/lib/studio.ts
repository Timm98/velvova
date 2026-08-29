"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { analyseClaims, buildApplicationEmail, buildCv, checkApproval, coverLetterAdvisable, selectDeliveryProvider } from "@paycheck/documents";
import { isConfirmedFact, type EvidenceItem, type Job, type JobRequirement } from "@paycheck/domain";
import { loadRuntimeConfig } from "@paycheck/config";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { recordEvent } from "./matching";

/**
 * Application Studio.
 *
 * Die zentrale Regel steht in checkApproval: ein Dokument mit einer
 * unbelegten Aussage kann nicht freigegeben werden. Und ohne Freigabe
 * versendet der Provider nichts - das sind zwei getrennte Riegel, weil
 * beide für sich versagen könnten.
 */

export interface StudioView {
  application: {
    id: string;
    stage: string;
    notes: string;
    nextStepLabel: string | null;
    nextStepAt: Date | null;
  };
  job: {
    id: string;
    title: string;
    companyName: string;
    applyMethod: string;
    applyTarget: string | null;
    isDemo: boolean;
  };
  requirements: { id: string; kind: string; text: string }[];
  evidence: { id: string; statement: string; confirmed: boolean }[];
  artifacts: {
    id: string;
    kind: string;
    version: number;
    content: string;
    approved: boolean;
    claims: { text: string; status: string; note: string; evidenceIds: string[] }[];
    canApprove: boolean;
  }[];
  coverLetterAdvice: { advisable: boolean; reason: string };
  /** Ehrlicher Zustand des Versandwegs. */
  delivery: { providerName: string; connected: boolean; willActuallySend: boolean };
}

async function loadContext(applicationId: string, userId: string) {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [row] = await tx
      .select({ app: schema.applications, job: schema.jobs, company: schema.companies })
      .from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(and(eq(schema.applications.id, applicationId), eq(schema.applications.userId, userId)))
      .limit(1);

    if (!row) return null;

    const requirements = await tx
      .select()
      .from(schema.jobRequirements)
      .where(eq(schema.jobRequirements.jobId, row.job.id));

    const evidence = await tx
      .select()
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt)));

    const artifacts = await tx
      .select()
      .from(schema.generatedArtifacts)
      .where(eq(schema.generatedArtifacts.applicationId, applicationId))
      .orderBy(desc(schema.generatedArtifacts.version));

    return { ...row, requirements, evidence, artifacts };
  });
}

function toDomainEvidence(row: typeof schema.evidenceItems.$inferSelect): EvidenceItem {
  return {
    id: row.id, userId: row.userId, type: row.type, statement: row.statement,
    sourceType: row.sourceType, sourceRef: row.sourceRef, confidence: row.confidence,
    userConfirmed: row.userConfirmed, userRejected: row.userRejected,
    sensitivityLevel: row.sensitivityLevel, retentionClass: row.retentionClass,
    createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt,
  };
}

export async function loadStudio(applicationId: string): Promise<StudioView | null> {
  const user = await requireUser();
  const ctx = await loadContext(applicationId, user.id);
  if (!ctx) return null;

  const cfg = loadRuntimeConfig();
  const provider = selectDeliveryProvider(cfg);
  const evidence = ctx.evidence.map(toDomainEvidence);

  /**
   * Nur die jeweils neueste Fassung je Art wird geprueft.
   *
   * Vorher lief die Claim-Pruefung ueber ALLE Fassungen. Mit jeder
   * erzeugten Version wurde die Seite langsamer, bis ein E2E-Test in
   * die Zeitgrenze lief. Angezeigt wird ohnehin immer nur eine Fassung.
   */
  const newestPerKind = new Map<string, (typeof ctx.artifacts)[number]>();
  for (const a of ctx.artifacts) {
    const seen = newestPerKind.get(a.kind);
    if (!seen || a.version > seen.version) newestPerKind.set(a.kind, a);
  }

  const artifacts = [...newestPerKind.values()].map((a) => {
    const analysis = analyseClaims(a.id, a.content, evidence);
    const approval = checkApproval(analysis);
    return {
      id: a.id,
      kind: a.kind,
      version: a.version,
      content: a.content,
      approved: a.approvedByUser,
      claims: analysis.claims.map((c) => ({
        text: c.text,
        status: c.status,
        note: c.note,
        evidenceIds: c.evidenceIds,
      })),
      canApprove: approval.canApprove,
    };
  });

  const job = { ...ctx.job, companyName: ctx.company.name } as unknown as Job;

  return {
    application: {
      id: ctx.app.id,
      stage: ctx.app.stage,
      notes: ctx.app.notes,
      nextStepLabel: ctx.app.nextStepLabel,
      nextStepAt: ctx.app.nextStepAt,
    },
    job: {
      id: ctx.job.id,
      title: ctx.job.title,
      companyName: ctx.company.name,
      applyMethod: ctx.job.applyMethod,
      applyTarget: ctx.job.applyTarget,
      isDemo: ctx.job.isDemo,
    },
    requirements: ctx.requirements.map((r) => ({ id: r.id, kind: r.kind, text: r.text })),
    evidence: evidence.map((e) => ({
      id: e.id,
      statement: e.statement,
      confirmed: isConfirmedFact(e),
    })),
    artifacts,
    coverLetterAdvice: coverLetterAdvisable(job),
    delivery: {
      providerName: provider.displayName,
      connected: provider.isConnected(),
      // Nur ein verbundener Nicht-Entwurfsweg versendet überhaupt etwas.
      willActuallySend: false,
    },
  };
}

/**
 * Ein Dokument erzeugen. Ausschließlich aus bestätigter Evidenz - was
 * fehlt, wird als Lücke benannt und nicht mit einer Formulierung
 * überdeckt.
 */
export async function generateArtifact(
  applicationId: string,
  kind: "cv_ats" | "cover_letter" | "application_email",
): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const ctx = await loadContext(applicationId, user.id);
  if (!ctx) return { ok: false, message: "Diese Bewerbung wurde nicht gefunden." };

  const evidence = ctx.evidence.map(toDomainEvidence);
  const confirmed = evidence.filter(isConfirmedFact);

  if (confirmed.length === 0) {
    return {
      ok: false,
      message:
        "Es gibt noch keine bestätigten Erfahrungen in deinem Profil. Ohne Belege könnte hier " +
        "nur Erfundenes stehen - deshalb wird nichts erzeugt. Bestätige zuerst dein Profil.",
    };
  }

  const job = { ...ctx.job, companyName: ctx.company.name } as unknown as Job;
  const requirements = ctx.requirements as unknown as JobRequirement[];

  let content: string;
  if (kind === "cv_ats") {
    const cv = buildCv(evidence, job, requirements, user.locale);
    content = cv.plainText;
    if (cv.gaps.length > 0) {
      content += `\n\nOFFENE LUECKEN GEGENUEBER DIESER STELLE\n${cv.gaps.map((g) => `- ${g}`).join("\n")}`;
    }
  } else if (kind === "application_email") {
    const mail = buildApplicationEmail(job, evidence, user.displayName, user.locale);
    content = mail.body;
  } else {
    const advice = coverLetterAdvisable(job);
    const strongest = [...confirmed].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    content =
      `Guten Tag,\n\nich bewerbe mich auf die Stelle "${job.title}".\n\n` +
      strongest.map((e) => `${e.statement}.`).join("\n\n") +
      `\n\nGern erläutere ich das in einem Gespräch.\n\nMit freundlichen Grüßen\n` +
      `${user.displayName ?? ""}\n\n` +
      `[Hinweis: ${advice.reason}]`;
  }

  const db = await getDb();
  await withUser(db, user.id, async (tx) => {
    const [last] = await tx
      .select({ version: schema.generatedArtifacts.version })
      .from(schema.generatedArtifacts)
      .where(
        and(
          eq(schema.generatedArtifacts.applicationId, applicationId),
          eq(schema.generatedArtifacts.kind, kind),
        ),
      )
      .orderBy(desc(schema.generatedArtifacts.version))
      .limit(1);

    const [artifact] = await tx
      .insert(schema.generatedArtifacts)
      .values({
        userId: user.id,
        applicationId,
        kind,
        locale: user.locale,
        version: (last?.version ?? 0) + 1,
        content,
        promptVersion: null,
        approvedByUser: false,
      })
      .returning();

    // Claim-Provenienz mitschreiben: jede Aussage bekommt ihre Belege.
    const analysis = analyseClaims(artifact!.id, content, evidence);
    if (analysis.claims.length > 0) {
      await tx.insert(schema.claimEvidenceLinks).values(
        analysis.claims.map((c) => ({
          artifactId: artifact!.id,
          claimText: c.text,
          evidenceItemId: c.evidenceIds[0] ?? null,
          status: c.status,
          note: c.note,
        })),
      );
    }
  });

  revalidatePath(`/app/applications/${applicationId}`);
  return { ok: true, message: "Entwurf erstellt. Prüf die markierten Aussagen." };
}

export async function updateArtifact(artifactId: string, content: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.generatedArtifacts)
      .set({
        content,
        // Eine Änderung setzt die Freigabe zurück. Was freigegeben wurde,
        // muss das sein, was auch versendet wird.
        approvedByUser: false,
      })
      .where(and(eq(schema.generatedArtifacts.id, artifactId), eq(schema.generatedArtifacts.userId, user.id))),
  );
  revalidatePath("/app/applications");
}

export async function approveArtifact(
  artifactId: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const db = await getDb();

  return withUser(db, user.id, async (tx) => {
    const [artifact] = await tx
      .select()
      .from(schema.generatedArtifacts)
      .where(and(eq(schema.generatedArtifacts.id, artifactId), eq(schema.generatedArtifacts.userId, user.id)))
      .limit(1);
    if (!artifact) return { ok: false, message: "Dokument nicht gefunden." };

    const evidence = (
      await tx
        .select()
        .from(schema.evidenceItems)
        .where(and(eq(schema.evidenceItems.userId, user.id), isNull(schema.evidenceItems.deletedAt)))
    ).map(toDomainEvidence);

    const analysis = analyseClaims(artifact.id, artifact.content, evidence);
    const approval = checkApproval(analysis);

    // Der Riegel. Nicht als Warnung, sondern als Verweigerung.
    if (!approval.canApprove) {
      return {
        ok: false,
        message:
          `${approval.blockers.length} Aussage(n) haben keinen Beleg. ` +
          `Ergänze einen Beleg im Profil oder formuliere sie vorsichtiger.`,
      };
    }

    await tx
      .update(schema.generatedArtifacts)
      .set({ approvedByUser: true })
      .where(eq(schema.generatedArtifacts.id, artifactId));

    return { ok: true, message: "Freigegeben." };
  });
}

/**
 * Versand. Zwei Bedingungen müssen erfüllt sein: das Dokument ist
 * freigegeben, UND der Mensch hat den Versand ausdrücklich bestätigt.
 * Fehlt eines von beidem, passiert nichts.
 */
export async function sendApplication(
  applicationId: string,
  artifactId: string,
  userConfirmed: boolean,
): Promise<{ ok: boolean; message: string; draft?: { filename: string; content: string } }> {
  const user = await requireUser();
  const cfg = loadRuntimeConfig();
  const provider = selectDeliveryProvider(cfg);

  const ctx = await loadContext(applicationId, user.id);
  if (!ctx) return { ok: false, message: "Diese Bewerbung wurde nicht gefunden." };

  const db = await getDb();
  const [artifact] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.generatedArtifacts)
      .where(and(eq(schema.generatedArtifacts.id, artifactId), eq(schema.generatedArtifacts.userId, user.id)))
      .limit(1),
  );

  if (!artifact) return { ok: false, message: "Dokument nicht gefunden." };
  if (!artifact.approvedByUser) {
    return { ok: false, message: "Das Dokument ist noch nicht freigegeben. Es wurde nichts versendet." };
  }

  const preview = {
    recipient: ctx.job.applyTarget ?? "unbekannt@example.invalid",
    subject: `Bewerbung: ${ctx.job.title}`,
    body: artifact.content,
    attachments: [],
    locale: user.locale,
    isDemo: true,
    providerName: provider.displayName,
  };

  const result = await provider.send(preview, userConfirmed);

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.deliveries).values({
      userId: user.id,
      applicationId,
      provider: provider.key,
      isDemo: result.isDemo,
      recipient: preview.recipient,
      subject: preview.subject,
      status: result.status,
      confirmedByUserAt: userConfirmed ? new Date() : null,
      sentAt: result.status === "sent" ? new Date() : null,
      providerMessageId: result.messageId,
      artifactVersions: { [artifact.kind]: artifact.version },
      error: result.status === "refused" || result.status === "not_connected" ? result.message : null,
    }),
  );

  if (result.status === "sent" || result.status === "draft_created") {
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.applications)
        .set({ stage: "sent", lastContactAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.applications.id, applicationId)),
    );
    await recordEvent(user.id, "application_sent", { applicationId, jobId: ctx.job.id });
  }

  revalidatePath(`/app/applications/${applicationId}`);
  return {
    ok: result.status === "sent" || result.status === "draft_created",
    message: result.message,
    draft: result.draft ? { filename: result.draft.filename, content: result.draft.content } : undefined,
  };
}

export async function saveNotes(applicationId: string, notes: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.applications)
      .set({ notes: notes.slice(0, 5000), updatedAt: new Date() })
      .where(and(eq(schema.applications.id, applicationId), eq(schema.applications.userId, user.id))),
  );
  revalidatePath(`/app/applications/${applicationId}`);
}

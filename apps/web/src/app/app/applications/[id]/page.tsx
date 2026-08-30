import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { loadStudio } from "@/lib/studio";
import { Studio } from "./Studio";
import { StageControl } from "./StageControl";
import { Badge, Card, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Bewerbung" };
export const dynamic = "force-dynamic";

/**
 * Application Studio.
 *
 * Drei Spalten: was die Stelle verlangt, das Dokument, und was noch
 * offen ist. Die dritte Spalte ist die wichtigste - sie sperrt die
 * Freigabe, solange eine Aussage keinen Beleg hat.
 */
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getPageContext();
  const view = await loadStudio(id);
  if (!view) notFound();

  return (
    <Stack gap={6}>
      <div>
        <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>
          <Link href="/app/applications" style={{ color: "var(--accent-text)" }}>
            ← {t("applications.title")}
          </Link>
        </p>
        <PageHeader title={view.job.title} lead={view.job.companyName} />
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
        {view.job.isDemo && <Badge tone="caution">Demo-Stelle</Badge>}
        <StageControl
          applicationId={view.application.id}
          current={view.application.stage}
          labels={{
            saved: t("applications.stageSaved"),
            preparing: t("applications.stagePreparing"),
            sent: t("applications.stageSent"),
            acknowledged: t("applications.stageAcknowledged"),
            interview: t("applications.stageInterview"),
            offer: t("applications.stageOffer"),
            accepted: t("applications.stageAccepted"),
            rejected: t("applications.stageRejected"),
            withdrawn: t("applications.stageWithdrawn"),
          }}
        />
        <Link
          href={`/app/coaching/${view.application.id}`}
          style={{ fontSize: "var(--text-sm)", color: "var(--accent-text)" }}
        >
          Gespräch vorbereiten →
        </Link>
      </div>

      <Studio
        view={view}
        labels={{
          requirements: t("studio.requirements"),
          yourEvidence: t("studio.yourEvidence"),
          document: t("studio.document"),
          checks: t("studio.checks"),
          openPoints: t("studio.openPoints"),
          generateCvAts: t("studio.generateCvAts"),
          generateCoverLetter: t("studio.generateCoverLetter"),
          generateEmail: t("studio.generateEmail"),
          claimSupported: t("studio.claimSupported"),
          claimUnsupported: t("studio.claimUnsupported"),
          claimNeedsConfirmation: t("studio.claimNeedsConfirmation"),
          unsupportedBlocked: t("studio.unsupportedBlocked"),
          preview: t("studio.preview"),
          recipient: t("studio.recipient"),
          subject: t("studio.subject"),
          confirmSend: t("studio.confirmSend"),
          send: t("studio.send"),
          exportDraft: t("studio.exportDraft"),
          demoSendNotice: t("studio.demoSendNotice"),
          coverLetterNotNeeded: t("studio.coverLetterNotNeeded"),
        }}
      />

      <Card>
        <Stack gap={3}>
          <h2 style={{ fontSize: "var(--text-base)" }}>{t("applications.notes")}</h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
            {view.application.notes || "Noch keine Notizen."}
          </p>
        </Stack>
      </Card>
    </Stack>
  );
}

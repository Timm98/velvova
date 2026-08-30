import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageContext } from "@/lib/locale";
import { loadCoaching } from "@/lib/coaching";
import { CoachingSession } from "./CoachingSession";
import { Badge, Card, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Gesprächsvorbereitung" };
export const dynamic = "force-dynamic";

/**
 * Coaching.
 *
 * Die Fragen kommen aus dieser Stelle und diesem Unternehmen, nicht aus
 * einer allgemeinen Liste - und woher jede stammt, steht dabei.
 */
export default async function CoachingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getPageContext();
  const view = await loadCoaching(id);
  if (!view) notFound();

  return (
    <Stack gap={6}>
      <div>
        <p style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>
          <Link href={`/app/applications/${id}`} style={{ color: "var(--accent-text)" }}>
            ← Zurück zur Bewerbung
          </Link>
        </p>
        <PageHeader
          title={t("coaching.title")}
          lead={view.job ? `${view.job.title} bei ${view.job.companyName}` : undefined}
        />
      </div>

      {/* Was ausdrücklich nicht bewertet wird */}
      <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
          {t("coaching.noBehaviourScoring")}
        </p>
      </Card>

      <div className="coaching-grid">
        <CoachingSession
          sessionId={view.sessionId}
          questions={view.questions}
          turns={view.turns}
          feedback={view.feedback}
          labels={{
            start: t("coaching.startSession"),
            repeat: t("coaching.repeatAnswer"),
            relevance: t("coaching.feedbackRelevance"),
            structure: t("coaching.feedbackStructure"),
            evidence: t("coaching.feedbackEvidence"),
            clarity: t("coaching.feedbackClarity"),
            missing: t("coaching.feedbackMissing"),
            yourAnswer: t("interview.yourAnswer"),
            send: t("interview.send"),
          }}
        />

        <aside style={{ display: "grid", gap: "var(--space-4)", alignContent: "start", minWidth: 0 }}>
          <Card>
            <Stack gap={3}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{t("coaching.starStories")}</h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Ausschließlich aus deinen bestätigten Erfahrungen. Nichts davon ist erfunden.
              </p>
              {view.starStories.length === 0 ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  Noch keine bestätigten Erfahrungen im Profil.
                </p>
              ) : (
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                  {view.starStories.map((s) => (
                    <li key={s.id} style={{ fontSize: "var(--text-sm)" }}>
                      · {s.statement}
                    </li>
                  ))}
                </ul>
              )}
            </Stack>
          </Card>

          <Card>
            <Stack gap={3}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{t("coaching.questionsForCompany")}</h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                Abgeleitet aus dem, was in der Anzeige fehlt oder in Bewertungen auffällt.
              </p>
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                {view.questionsForCompany.map((q) => (
                  <li key={q} style={{ fontSize: "var(--text-sm)" }}>
                    ? {q}
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>

        </aside>
      </div>

      <style>{`
        .coaching-grid { display: grid; gap: var(--space-5); grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 1024px) {
          .coaching-grid { grid-template-columns: minmax(0, 1fr) 340px; }
        }
      `}</style>
    </Stack>
  );
}

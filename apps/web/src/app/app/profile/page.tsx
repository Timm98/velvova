import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull } from "drizzle-orm";
import { EvidenceList } from "./EvidenceList";
import { ConfirmProfileButton, RoleClusterCard } from "./ProfileClient";
import { Badge, Card, EmptyState, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Profil" };
export const dynamic = "force-dynamic";

/**
 * Career Evidence Profile.
 *
 * Jede Aussage steht einzeln, mit ihrer Herkunft und ihrem Zustand.
 * Bestaetigen, bearbeiten, ablehnen, loeschen sind gleichrangig - das
 * Produkt draengt nicht zur Bestaetigung.
 */
export default async function ProfilePage() {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const db = await getDb();

  const [profile, evidence, clusters] = await withUser(db, user.id, async (tx) => [
    (await tx.select().from(schema.careerProfiles).where(eq(schema.careerProfiles.userId, user.id)).limit(1))[0],
    await tx
      .select()
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.userId, user.id), isNull(schema.evidenceItems.deletedAt))),
    await tx.select().from(schema.roleClusters).where(eq(schema.roleClusters.userId, user.id)),
  ]);

  const confirmed = evidence.filter((e) => e.userConfirmed && !e.userRejected);
  const open = evidence.filter((e) => !e.userConfirmed && !e.userRejected);
  const rejected = evidence.filter((e) => e.userRejected);
  const coverage = profile?.coverage ?? 0;

  const group = (needle: string) => confirmed.filter((e) => e.sourceRef?.includes(needle));

  if (evidence.length === 0) {
    return (
      <Stack gap={6}>
        <PageHeader title={t("profile.title")} />
        <EmptyState
          title={t("states.emptyTitle")}
          body={t("profile.empty")}
          action={
            <Link href="/app/nina" style={{ color: "var(--accent-text)" }}>
              Gespraech beginnen
            </Link>
          }
        />
      </Stack>
    );
  }

  return (
    <Stack gap={7}>
      <PageHeader title={t("profile.title")} />

      {profile?.careerCompass && (
        <Card style={{ background: "var(--assistant-subtle)", borderColor: "var(--assistant-border)" }}>
          <Stack gap={3}>
            <Badge tone="assistant">{t("profile.compass")}</Badge>
            <p style={{ fontSize: "var(--text-lg)", lineHeight: 1.6, maxWidth: "var(--measure)" }}>
              {profile.careerCompass}
            </p>
          </Stack>
        </Card>
      )}

      {/* Abdeckung */}
      <Card>
        <Stack gap={3}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
            <h2 style={{ fontSize: "var(--text-base)" }}>{t("profile.coverage")}</h2>
            <strong>{Math.round(coverage * 100)} %</strong>
          </div>
          <div aria-hidden style={{ height: 8, background: "var(--surface-inset)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
            <div style={{ width: `${Math.round(coverage * 100)}%`, height: "100%", background: "var(--accent)" }} />
          </div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
            {t("profile.coverageBody")}
          </p>
        </Stack>
      </Card>

      {/* Offene Vermutungen zuerst: sie brauchen eine Entscheidung */}
      {open.length > 0 && (
        <section aria-labelledby="offen">
          <h2 id="offen" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>
            {t("profile.gaps")}
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)", maxWidth: "var(--measure)" }}>
            Diese Angaben stammen aus deinen Antworten oder sind Vermutungen von {brand.assistantName}.
            Bis du sie bestaetigst, zaehlen sie nirgends.
          </p>
          <EvidenceList items={open.map(serialise)} showConfirm />
        </section>
      )}

      {/* Bestaetigte Staerken, nach Bereich gruppiert */}
      <section aria-labelledby="bestaetigt">
        <h2 id="bestaetigt" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          {t("profile.confirmedStrengths")}
        </h2>
        {confirmed.length === 0 ? (
          <EmptyState title="Noch nichts bestaetigt" body="Bestaetige oben, was zutrifft." />
        ) : (
          <Stack gap={5}>
            {[
              { key: "experience_episodes", label: "Konkrete Erfahrungen" },
              { key: "feedback_and_recognition", label: "Was andere an dir sehen" },
              { key: "tasks_and_energy", label: t("profile.energising") },
              { key: "work_style_and_environment", label: t("profile.workStyle") },
              { key: "values_and_motives", label: t("profile.values") },
              { key: "hard_constraints", label: t("profile.hardNoGos") },
              { key: "background", label: "Ausbildung und Werkzeuge" },
              { key: "profile:manual", label: "Von dir ergaenzt" },
            ]
              .map((g) => ({ ...g, items: group(g.key) }))
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.key}>
                  <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)", color: "var(--text-secondary)" }}>
                    {g.label}
                  </h3>
                  <EvidenceList items={g.items.map(serialise)} />
                </div>
              ))}
          </Stack>
        )}
      </section>

      {/* Rollencluster */}
      {clusters.length > 0 && (
        <section aria-labelledby="richtungen">
          <h2 id="richtungen" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
            {t("profile.roleClusters")}
          </h2>
          <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
            {clusters.map((c) => (
              <RoleClusterCard
                key={c.id}
                cluster={{
                  id: c.id,
                  title: c.title,
                  rationale: c.rationale,
                  kind: c.kind,
                  gaps: c.gaps,
                  criticalConstraints: c.criticalConstraints,
                  entryRealism: c.entryRealism,
                  nextValidationStep: c.nextValidationStep,
                  userConfirmed: c.userConfirmed,
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Abgelehnt: bleibt sichtbar, zaehlt nie */}
      {rejected.length > 0 && (
        <section aria-labelledby="abgelehnt">
          <h2 id="abgelehnt" style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)", color: "var(--text-muted)" }}>
            Von dir abgelehnt ({rejected.length})
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            Diese Aussagen bleiben sichtbar, damit du sie zurueckholen kannst. Sie zaehlen nirgends.
          </p>
          <EvidenceList items={rejected.map(serialise)} />
        </section>
      )}

      {/* Bestaetigung des Gesamtprofils */}
      <Card style={{ borderColor: "var(--accent-border)" }}>
        <Stack gap={4}>
          <div>
            <h2 style={{ fontSize: "var(--text-lg)" }}>{t("profile.confirmAll")}</h2>
            <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
              {t("profile.confirmAllBody")}
            </p>
          </div>
          <ConfirmProfileButton
            alreadyConfirmed={profile?.confirmedByUser ?? false}
            label={t("profile.confirmAll")}
          />
        </Stack>
      </Card>
    </Stack>
  );
}

function serialise(e: typeof schema.evidenceItems.$inferSelect) {
  return {
    id: e.id,
    statement: e.statement,
    sourceType: e.sourceType,
    sourceRef: e.sourceRef,
    confidence: e.confidence,
    userConfirmed: e.userConfirmed,
    userRejected: e.userRejected,
    type: e.type,
  };
}

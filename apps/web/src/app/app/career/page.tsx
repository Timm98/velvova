import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull } from "drizzle-orm";
import { EvidenceList } from "./EvidenceList";
import { ConfirmProfileButton, RoleClusterCard } from "./CareerClient";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { EmptyState, PageHeader, Section } from "@/components/ui/states";

export const metadata: Metadata = { title: "Karriere" };
export const dynamic = "force-dynamic";

/**
 * Career Evidence Profile.
 *
 * Jede Aussage steht einzeln, mit ihrer Herkunft und ihrem Zustand.
 * Bestätigen, bearbeiten, ablehnen, löschen sind gleichrangig - das
 * Produkt drängt nicht zur Bestätigung.
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
      <div className="grid gap-8">
        <PageHeader eyebrow="Karriereprofil" title={t("profile.title")} />
        <EmptyState
          icon={<Sparkles className="size-5" strokeWidth={1.7} />}
          title={t("states.emptyTitle")}
          body={t("profile.empty")}
          action={
            <Button asChild variant="primary">
              <Link href="/app/nina">
                Gespräch beginnen
                <ArrowRight className="size-4" strokeWidth={1.9} />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      <PageHeader eyebrow="Karriereprofil" title={t("profile.title")} />

      {profile?.careerCompass && (
        <Card className="border-assistant-border bg-assistant-soft">
          <Badge tone="assistant">
            <Sparkles className="size-3" strokeWidth={2} />
            {t("profile.compass")}
          </Badge>
          <p className="mt-4 max-w-[var(--measure)] text-lg leading-relaxed">
            {profile.careerCompass}
          </p>
        </Card>
      )}

      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">{t("profile.coverage")}</h2>
          <span className="text-lg font-semibold tabular">{Math.round(coverage * 100)} %</span>
        </div>
        <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-full bg-inset">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) ease-(--ease-out)"
            style={{ width: `${Math.round(coverage * 100)}%` }}
          />
        </div>
        <p className="mt-3 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          {t("profile.coverageBody")}
        </p>
      </Card>

      {/* Offene Vermutungen zuerst: sie brauchen eine Entscheidung */}
      {open.length > 0 && (
        <Section
          id="offen"
          title={t("profile.gaps")}
          description={`Diese Angaben stammen aus deinen Antworten oder sind Vermutungen von ${brand.assistantName}. Bis du sie bestätigst, zählen sie nirgends.`}
        >
          <EvidenceList items={open.map(serialise)} showConfirm />
        </Section>
      )}

      {/* Bestätigte Stärken, nach Bereich gruppiert */}
      <Section id="bestaetigt" title={t("profile.confirmedStrengths")}>
        {confirmed.length === 0 ? (
          <EmptyState title="Noch nichts bestätigt" body="Bestätige oben, was zutrifft." />
        ) : (
          <div className="grid gap-7">
            {[
              { key: "experience_episodes", label: "Konkrete Erfahrungen" },
              { key: "feedback_and_recognition", label: "Was andere an dir sehen" },
              { key: "tasks_and_energy", label: t("profile.energising") },
              { key: "work_style_and_environment", label: t("profile.workStyle") },
              { key: "values_and_motives", label: t("profile.values") },
              { key: "hard_constraints", label: t("profile.hardNoGos") },
              { key: "background", label: "Ausbildung und Werkzeuge" },
              { key: "profile:manual", label: "Von dir ergänzt" },
            ]
              .map((g) => ({ ...g, items: group(g.key) }))
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.key}>
                  <h3 className="mb-3 text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">
                    {g.label}
                  </h3>
                  <EvidenceList items={g.items.map(serialise)} />
                </div>
              ))}
          </div>
        )}
      </Section>

      {/* Rollencluster */}
      {clusters.length > 0 && (
        <Section
          id="richtungen"
          title={t("profile.roleClusters")}
          description="Mehrere plausible Richtungen statt eines angeblich perfekten Berufs."
        >
          <ul className="grid gap-4">
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
        </Section>
      )}

      {/* Abgelehnt: bleibt sichtbar, zählt nie */}
      {rejected.length > 0 && (
        <Section
          id="abgelehnt"
          title={`Von dir abgelehnt (${rejected.length})`}
          description="Diese Aussagen bleiben sichtbar, damit du sie zurückholen kannst. Sie zählen nirgends."
        >
          <EvidenceList items={rejected.map(serialise)} />
        </Section>
      )}

      {/* Bestätigung des Gesamtprofils */}
      <Card className="grid gap-5 border-accent-border">
        <div>
          <h2 className="text-lg font-semibold">{t("profile.confirmAll")}</h2>
          <p className="mt-2 max-w-[var(--measure)] leading-relaxed text-ink-2">
            {t("profile.confirmAllBody")}
          </p>
        </div>
        <ConfirmProfileButton
          alreadyConfirmed={profile?.confirmedByUser ?? false}
          label={t("profile.confirmAll")}
        />
      </Card>
    </div>
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

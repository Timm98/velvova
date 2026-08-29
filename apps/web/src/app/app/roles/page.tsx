import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { eq } from "drizzle-orm";
import { RoleClusterCard } from "../career/CareerClient";
import { buttonClass, Card, EmptyState, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Richtungen" };
export const dynamic = "force-dynamic";

/**
 * Rollencluster.
 *
 * Die Antwort auf "in welche Richtung überhaupt?" - und ausdrücklich
 * auch auf Rollen, die man selbst nicht genannt hätte. Genau dort liegt
 * der Wert: naheliegende Titel kennt man schon.
 */
export default async function RolesPage() {
  const user = await requireUser();
  const { t } = await getPageContext();
  const db = await getDb();

  const clusters = await withUser(db, user.id, (tx) =>
    tx.select().from(schema.roleClusters).where(eq(schema.roleClusters.userId, user.id)),
  );

  if (clusters.length === 0) {
    return (
      <Stack gap={6}>
        <PageHeader title={t("profile.roleClusters")} />
        <EmptyState
          title={t("states.emptyTitle")}
          body="Richtungen entstehen aus dem Gespräch. Sobald genug Themen abgedeckt sind, erscheinen sie hier."
          action={<Link href="/app/nina" className={buttonClass("primary")}>{t("jobs.lockedCta")}</Link>}
        />
      </Stack>
    );
  }

  const byKind = (kind: string) => clusters.filter((c) => c.kind === kind);

  return (
    <Stack gap={7}>
      <PageHeader
        title={t("profile.roleClusters")}
        lead="Jede Richtung mit Begründung, Lücken und einem konkreten nächsten Schritt zur Überprüfung."
      />

      {[
        { kind: "obvious", label: "Naheliegend" },
        { kind: "adjacent", label: "Angrenzend" },
        { kind: "niche", label: t("profile.surprising") },
      ]
        .map((g) => ({ ...g, items: byKind(g.kind) }))
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.kind} aria-labelledby={`kind-${g.kind}`}>
            <h2 id={`kind-${g.kind}`} style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
              {g.label}
            </h2>
            <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
              {g.items.map((c) => (
                <RoleClusterCard
                  key={c.id}
                  cluster={{
                    id: c.id, title: c.title, rationale: c.rationale, kind: c.kind,
                    gaps: c.gaps, criticalConstraints: c.criticalConstraints,
                    entryRealism: c.entryRealism, nextValidationStep: c.nextValidationStep,
                    userConfirmed: c.userConfirmed,
                  }}
                />
              ))}
            </ul>
          </section>
        ))}

      <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
          Diese Richtungen sind Hypothesen mit Unsicherheit, keine Diagnosen. Der nächste Schritt
          steht bei jeder dabei, weil eine Richtung sich nur durch Ausprobieren bestätigt - nicht
          durch eine Berechnung.
        </p>
      </Card>
    </Stack>
  );
}

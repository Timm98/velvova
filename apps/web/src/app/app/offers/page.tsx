import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { eq } from "drizzle-orm";
import { buttonStyle, Card, EmptyState, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Angebote" };
export const dynamic = "force-dynamic";

/**
 * Angebotsvergleich.
 *
 * Gehalt ist eine Zahl unter mehreren. Wer zwei Angebote nur über das
 * Grundgehalt vergleicht, übersieht meistens das, was den Alltag
 * bestimmt: Stunden, Remote-Anteil, Urlaub, Probezeit.
 */
export default async function OffersPage() {
  const user = await requireUser();
  const { t } = await getPageContext();
  const db = await getDb();

  const offers = await withUser(db, user.id, (tx) =>
    tx
      .select({ offer: schema.offers, jobTitle: schema.jobs.title, company: schema.companies.name })
      .from(schema.offers)
      .innerJoin(schema.applications, eq(schema.applications.id, schema.offers.applicationId))
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(eq(schema.offers.userId, user.id)),
  );

  if (offers.length === 0) {
    return (
      <Stack gap={6}>
        <PageHeader title={t("nav.offers")} />
        <EmptyState
          title={t("states.emptyTitle")}
          body="Sobald du ein Angebot erhältst, kannst du es hier eintragen und vergleichen."
          action={<Link href="/app/applications" style={buttonStyle("secondary")}>{t("applications.title")}</Link>}
        />
      </Stack>
    );
  }

  const fmt = (n: number | null, currency: string) =>
    n === null ? "nicht angegeben" : new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  return (
    <Stack gap={6}>
      <PageHeader title={t("nav.offers")} lead="Nicht nur das Grundgehalt - das bestimmt selten den Alltag." />

      <Card padded={false}>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Angebote im Vergleich">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Stelle", "Grundgehalt", "Bonus", "Wochenstunden", "Remote", "Urlaub", "Probezeit", "Frist"].map((h) => (
                  <th key={h} style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map(({ offer, jobTitle, company }) => (
                <tr key={offer.id}>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>
                    <strong>{jobTitle}</strong>
                    <br />
                    <span style={{ color: "var(--text-muted)" }}>{company}</span>
                  </td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{fmt(offer.baseSalary, offer.currency)}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>{fmt(offer.bonus, offer.currency)}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>{offer.weeklyHours ?? "–"}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>{offer.remotePercent === null ? "–" : `${offer.remotePercent} %`}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>{offer.vacationDays ?? "–"}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)" }}>{offer.probationMonths === null ? "–" : `${offer.probationMonths} Mon.`}</td>
                  <td style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-subtle)", whiteSpace: "nowrap" }}>
                    {offer.decisionDeadline ? new Intl.DateTimeFormat("de-DE").format(offer.decisionDeadline) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <Stack gap={3}>
          <h2 style={{ fontSize: "var(--text-base)" }}>Vor der Verhandlung</h2>
          <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            <li>· Nenn zuerst, was du bringst - mit einem konkreten Beispiel aus deinem Profil.</li>
            <li>· Verhandle nicht nur das Gehalt. Stunden, Remote-Anteil und Lernbudget sind oft beweglicher.</li>
            <li>· Frag nach der Frist, bevor du eine Zusage gibst. Eine Woche Bedenkzeit ist üblich.</li>
            <li>· Was dir nicht wichtig ist, muss nicht verhandelt werden. Weniger Punkte, klarer vorgetragen.</li>
          </ul>
        </Stack>
      </Card>
    </Stack>
  );
}

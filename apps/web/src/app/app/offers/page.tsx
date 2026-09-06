import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { buttonClass, Card, EmptyState, PageHeader, Stack } from "@/components/ui";
import { AngebotFormular } from "@/components/angebote/AngebotFormular";
import { verhandlungslage } from "@/lib/verhandlung";
import { inArray } from "drizzle-orm";

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
      .select({ offer: schema.offers, jobId: schema.jobs.id, jobTitle: schema.jobs.title, company: schema.companies.name })
      .from(schema.offers)
      .innerJoin(schema.applications, eq(schema.applications.id, schema.offers.applicationId))
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(eq(schema.offers.userId, user.id)),
  );

  /*
   * Die Bewerbungen, zu denen ein Angebot passen könnte.
   *
   * Nicht alle: Wer sich gestern beworben hat, hat kein Angebot. Die
   * Liste zeigt, was tatsächlich so weit ist — sonst sucht jemand in
   * dreissig Einträgen nach dem einen.
   */
  const offeneBewerbungen = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.applications.id, titel: schema.jobs.title, firma: schema.companies.name })
      .from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.applications.userId, user.id),
          inArray(schema.applications.stage, ["sent", "acknowledged", "interview", "offer"]),
        ),
      ),
  ).catch(() => []);

  if (offers.length === 0) {
    return (
      <Stack gap={6}>
        <PageHeader title={t("nav.offers")} />
        <AngebotFormular bewerbungen={offeneBewerbungen} />
        {offeneBewerbungen.length === 0 && (
          <EmptyState
            title={t("states.emptyTitle")}
            body="Sobald du ein Angebot erhältst, kannst du es hier eintragen und vergleichen."
            action={<Link href="/app/applications" className={buttonClass("secondary")}>{t("applications.title")}</Link>}
          />
        )}
      </Stack>
    );
  }

  /*
   * Jedes Angebot gegen den amtlichen Vergleichswert.
   *
   * Das ist der Teil, der eine Verhandlung tatsächlich stützt: eine
   * Zahl, die man nennen kann, und die Quelle dazu. „Verhandle
   * selbstbewusst" hilft niemandem.
   */
  const lagen = await Promise.all(
    offers.map(async ({ offer, jobId }) => ({
      offerId: offer.id,
      lage: await verhandlungslage(
        jobId,
        offer.baseSalary === null ? null : offer.baseSalary + (offer.bonus ?? 0),
      ).catch(() => null),
    })),
  );
  const lageNach = new Map(lagen.map((l) => [l.offerId, l.lage]));

  const fmt = (n: number | null, currency: string) =>
    n === null ? "nicht angegeben" : new Intl.NumberFormat("de-DE", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  const EINORDNUNG = {
    darunter: { wort: "unter der mittleren Hälfte", ton: "text-caution-text" },
    im_rahmen: { wort: "in der mittleren Hälfte", ton: "text-ink-2" },
    darueber: { wort: "über der mittleren Hälfte", ton: "text-positive-text" },
  } as const;

  return (
    <Stack gap={6}>
      <PageHeader title={t("nav.offers")} lead="Nicht nur das Grundgehalt - das bestimmt selten den Alltag." />

      <AngebotFormular bewerbungen={offeneBewerbungen} />

      {/*
       * Der amtliche Vergleich, je Angebot.
       *
       * ── Warum das hier steht und nicht auf der Stellenseite ──
       *
       * Dort steht er auch — aber verhandelt wird hier. Eine Zahl, die
       * man nennen kann, samt Quelle, ist der einzige Teil dieser
       * Seite, der eine Verhandlung tatsächlich stützt.
       *
       * ── Warum keine Forderung berechnet wird ─────────────────
       *
       * „Fordere 8 % mehr" wäre eine Zahl ohne Grundlage: Was
       * durchsetzbar ist, hängt von Markt, Person und Gespräch ab, und
       * davon wissen wir nichts.
       */}
      {offers.map(({ offer, jobTitle }) => {
        const lage = lageNach.get(offer.id);
        if (!lage?.median || !lage.einordnung) return null;
        const e = EINORDNUNG[lage.einordnung];
        const euro = (n: number) =>
          new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
        return (
          <Card key={offer.id}>
            <div className="grid gap-2">
              <h2 className="text-base font-semibold text-ink">{jobTitle}</h2>
              <p className="max-w-[var(--measure)] leading-relaxed text-ink">
                Dein Angebot liegt bei <strong>{euro(lage.angebot ?? 0)}</strong> und damit{" "}
                <strong className={e.ton}>{e.wort}</strong>
                {lage.q1 !== null && lage.q3 !== null
                  ? ` (${euro(lage.q1)} bis ${euro(lage.q3)})`
                  : ""}
                . Der Median für „{lage.beruf}" ist <strong>{euro(lage.median)}</strong>.
              </p>
              <p className="max-w-[var(--measure)] text-2xs leading-relaxed text-ink-3">
                {lage.quelle === "entgeltatlas"
                  ? "Entgeltatlas der Bundesagentur für Arbeit — Beschäftigungsstatistik, keine Auswertung von Anzeigen."
                  : "Aus Gehaltsangaben in Anzeigen der Bundesagentur für Arbeit."}{" "}
                {lage.grenzen}
              </p>
            </div>
          </Card>
        );
      })}

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

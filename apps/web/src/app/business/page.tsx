import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getDb, schema, withUser } from "@paycheck/db";
import { arbeitgeberKontext, darf } from "@/lib/arbeitgeber/zugang";

export const dynamic = "force-dynamic";

/**
 * Die Übersicht des Arbeitgeberbereichs.
 *
 * Drei Zahlen und ein nächster Schritt. Keine Kacheln mit
 * Wachstumspfeilen: Ein Recruiter kommt hierher, weil er wissen will,
 * ob etwas auf ihn wartet — nicht, um eine Auswertung zu lesen.
 */
export default async function BusinessStart({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const { user, organisation } = await arbeitgeberKontext(org);
  const db = await getDb();

  const [zahlen] = await withUser(db, user.id, (tx) =>
    tx
      .select({
        offen: sql<number>`(
          SELECT count(*)::int FROM job_postings p
          WHERE p.organization_id = ${organisation.organizationId} AND p.status = 'published'
        )`,
        entwuerfe: sql<number>`(
          SELECT count(*)::int FROM job_postings p
          WHERE p.organization_id = ${organisation.organizationId} AND p.status = 'draft'
        )`,
        neu: sql<number>`(
          SELECT count(*)::int FROM posting_candidates c
          WHERE c.organization_id = ${organisation.organizationId}
            AND c.stage = 'new' AND c.withdrawn_at IS NULL
        )`,
        gesamt: sql<number>`(
          SELECT count(*)::int FROM posting_candidates c
          WHERE c.organization_id = ${organisation.organizationId} AND c.withdrawn_at IS NULL
        )`,
      })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organisation.organizationId))
      .limit(1),
  );

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">
          {organisation.name}
        </h1>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Stellen ausschreiben und Bewerbungen bearbeiten. Was Bewerberinnen und Bewerber
          privat mit Monday besprechen, ihre Lebenshaltung und ihr aktuelles Gehalt sind hier
          nicht sichtbar — auch nicht in aggregierter Form.
        </p>
      </div>

      {!organisation.verifiziert && (
        /*
         * Der Hinweis steht vor allem anderen.
         *
         * Ohne Bestätigung kann niemand veröffentlichen. Das erst beim
         * Klick auf „Veröffentlichen" zu erfahren, nachdem man eine
         * Anzeige geschrieben hat, wäre die schlechtere Reihenfolge.
         */
        <div className="grid max-w-[var(--measure)] gap-2 rounded-(--radius-surface) bg-soft p-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck aria-hidden className="size-4 text-accent" strokeWidth={2} />
            Noch nicht bestätigt
          </p>
          <p className="text-sm leading-relaxed text-ink-2">
            Bevor hier jemand im Namen von {organisation.name} ausschreiben kann, prüfen wir die
            Zugehörigkeit zum Unternehmen. Bis dahin kannst du Entwürfe schreiben, aber nicht
            veröffentlichen — sonst stünde im Stellenindex eine Anzeige, von der das Unternehmen
            nichts weiss.
          </p>
        </div>
      )}

      <dl className="grid gap-4 sm:grid-cols-3">
        <Kennzahl label="Offene Stellen" wert={zahlen?.offen ?? 0} />
        <Kennzahl label="Neue Bewerbungen" wert={zahlen?.neu ?? 0} betont />
        <Kennzahl label="Bewerbungen insgesamt" wert={zahlen?.gesamt ?? 0} />
      </dl>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <Weiter href="/business/stellen" text="Stellen ansehen" />
        <Weiter href="/business/bewerbungen" text="Bewerbungen bearbeiten" />
        {darf(organisation.rolle, "admin") && <Weiter href="/business/team" text="Team verwalten" />}
      </div>

      {(zahlen?.entwuerfe ?? 0) > 0 && (
        <p className="text-sm text-ink-2">
          {zahlen!.entwuerfe} {zahlen!.entwuerfe === 1 ? "Entwurf wartet" : "Entwürfe warten"} auf
          Veröffentlichung.
        </p>
      )}
    </div>
  );
}

function Kennzahl({ label, wert, betont }: { label: string; wert: number; betont?: boolean }) {
  return (
    <div className="grid gap-1 rounded-(--radius-surface) bg-surface p-5 ring-1 ring-line">
      <dd
        className={
          betont && wert > 0
            ? "font-mono text-3xl font-semibold tabular text-accent-text"
            : "font-mono text-3xl font-semibold tabular text-ink"
        }
      >
        {wert}
      </dd>
      <dt className="text-sm text-ink-2">{label}</dt>
    </div>
  );
}

function Weiter({ href, text }: { href: string; text: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-6 items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
    >
      {text}
      <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
    </Link>
  );
}

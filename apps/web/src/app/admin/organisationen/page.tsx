import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { PageHeader } from "@/components/ui/states";
import { Bestaetigen } from "./Bestaetigen";

export const metadata: Metadata = { title: "Arbeitgeberkonten" };
export const dynamic = "force-dynamic";

/**
 * Arbeitgeberkonten bestätigen.
 *
 * ── Warum das ein Mensch entscheidet ──────────────────────────
 *
 * Eine Bestätigung heisst: Wir haben geprüft, dass die Personen hinter
 * diesem Konto tatsächlich für dieses Unternehmen sprechen. Erst danach
 * kann dort jemand ausschreiben.
 *
 * Automatisch ginge das nur über die E-Mail-Domäne — und die ist kein
 * Beweis: Eine Freemail-Adresse sagt nichts, eine Unternehmensadresse
 * hat auch das Praktikum, und Personaldienstleister schreiben
 * rechtmässig im Namen Dritter aus. Ein Prüfschritt, der falsch
 * durchwinkt, ist schlechter als keiner: Er trägt das Etikett
 * „bestätigt".
 *
 * ── Was auf dem Spiel steht ───────────────────────────────────
 *
 * Ohne diese Hürde könnte jemand ein Konto „Siemens AG" nennen und in
 * dessen Namen ausschreiben. Menschen bewerben sich darauf und schicken
 * ihre Unterlagen an jemanden, den sie für diesen Arbeitgeber halten.
 */
export default async function OrganisationenPage() {
  const user = await requireUser();
  const { flags } = await getPageContext();
  if (!flags.adminArea || (user.role !== "operator" && user.role !== "admin")) {
    notFound();
  }

  const db = await getDb();
  const orgs = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      kind: schema.organizations.kind,
      website: schema.organizations.website,
      verifiedAt: schema.organizations.verifiedAt,
      createdAt: schema.organizations.createdAt,
      mitglieder: sql<number>`(
        SELECT count(*)::int FROM memberships m WHERE m.organization_id = ${schema.organizations.id}
      )`,
      stellen: sql<number>`(
        SELECT count(*)::int FROM job_postings p WHERE p.organization_id = ${schema.organizations.id}
      )`,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.kind, "employer"))
    .orderBy(desc(schema.organizations.createdAt));

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Betrieb"
        title="Arbeitgeberkonten"
        lead="Bestätigt heisst: geprüft, dass diese Leute für dieses Unternehmen sprechen. Erst danach kann dort jemand ausschreiben."
      />

      {orgs.length === 0 ? (
        <p className="text-sm text-ink-2">Noch kein Arbeitgeberkonto.</p>
      ) : (
        <ul className="grid gap-3">
          {orgs.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-(--radius-surface) bg-surface p-5 ring-1 ring-line"
            >
              <span className="grid gap-1">
                <span className="text-[15px] font-semibold text-ink">{o.name}</span>
                <span className="text-2xs text-ink-2">
                  {o.mitglieder} {o.mitglieder === 1 ? "Mitglied" : "Mitglieder"} · {o.stellen}{" "}
                  {o.stellen === 1 ? "Stelle" : "Stellen"} · angelegt am{" "}
                  {o.createdAt.toLocaleDateString("de-DE")}
                  {o.website ? ` · ${o.website}` : ""}
                </span>
              </span>
              <Bestaetigen
                orgId={o.id}
                name={o.name}
                bestaetigt={o.verifiedAt !== null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

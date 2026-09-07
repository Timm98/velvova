import type { Metadata } from "next";
import { desc, eq, isNull, and } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { arbeitgeberKontext, darf, ROLLENNAME, type Rolle } from "@/lib/arbeitgeber/zugang";
import { TeamVerwaltung } from "./TeamVerwaltung";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

/**
 * Wer Zugriff auf die Bewerbungen hat.
 *
 * Diese Seite ist für alle sichtbar, auch für Nur-Leser — und das ist
 * Absicht. In einem Bereich, in dem Bewerbungsunterlagen liegen, ist
 * „wer kann das hier alles sehen?" keine Verwaltungsfrage, sondern eine
 * Auskunft, auf die jedes Mitglied Anspruch hat. Ändern darf sie
 * trotzdem nur die Verwaltung.
 */
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const { user, organisation } = await arbeitgeberKontext(org);
  const db = await getDb();

  const mitglieder = await withUser(db, user.id, (tx) =>
    tx
      .select({
        userId: schema.memberships.userId,
        rolle: schema.memberships.role,
        seit: schema.memberships.createdAt,
        email: schema.users.email,
        name: schema.users.displayName,
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.organizationId, organisation.organizationId))
      .orderBy(desc(schema.memberships.createdAt)),
  );

  const einladungen = await withUser(db, user.id, (tx) =>
    tx
      .select({
        id: schema.organizationInvitations.id,
        email: schema.organizationInvitations.email,
        rolle: schema.organizationInvitations.role,
        expiresAt: schema.organizationInvitations.expiresAt,
      })
      .from(schema.organizationInvitations)
      .where(
        and(
          eq(schema.organizationInvitations.organizationId, organisation.organizationId),
          isNull(schema.organizationInvitations.acceptedAt),
          isNull(schema.organizationInvitations.revokedAt),
        ),
      )
      .orderBy(desc(schema.organizationInvitations.createdAt)),
  );

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">Team</h1>
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
          Alle hier Aufgeführten können die Bewerbungen dieser Organisation sehen. Deshalb steht
          die Liste allen offen — ändern kann sie nur die Verwaltung.
        </p>
      </div>

      <TeamVerwaltung
        orgId={organisation.organizationId}
        eigeneUserId={user.id}
        eigeneRolle={organisation.rolle}
        darfVerwalten={darf(organisation.rolle, "admin")}
        mitglieder={mitglieder.map((m) => ({
          userId: m.userId,
          /* Ein Konto aus der SMS-Anmeldung hat keine Adresse. In
             einer Mitgliederliste ist ein Strich ehrlicher als ein
             leeres Feld, das nach einem Ladefehler aussieht. */
          rolle: (m.rolle in ROLLENNAME ? m.rolle : "viewer") as Rolle,
          email: m.email ?? "—",
          name: m.name,
          seit: m.seit.toISOString(),
        }))}
        einladungen={einladungen.map((e) => ({
          id: e.id,
          email: e.email,
          rolle: (e.rolle in ROLLENNAME ? e.rolle : "viewer") as Rolle,
          laeuftAb: e.expiresAt.toISOString(),
        }))}
      />
    </div>
  );
}

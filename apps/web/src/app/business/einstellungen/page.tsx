import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { arbeitgeberKontext, darf } from "@/lib/arbeitgeber/zugang";
import { OrgFormular } from "./OrgFormular";
import { UnternehmensAngaben } from "./UnternehmensAngaben";
import type { Pruefstand } from "@/lib/arbeitgeber/registrierung-felder";

export const metadata: Metadata = { title: "Einstellungen" };
export const dynamic = "force-dynamic";

/**
 * Die Angaben der Organisation.
 *
 * Wenig, und das mit Absicht: Name und Website. Beides erscheint in der
 * Anzeige und entscheidet mit, ob jemand sich bewirbt — alles andere,
 * was ein Arbeitgeberprofil sonst füllt (Kultur, Mission, Bildergalerie),
 * beantwortet keine Frage, die eine Bewerberin an dieser Stelle hat.
 */
export default async function EinstellungenPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const { user, organisation } = await arbeitgeberKontext(org);
  const db = await getDb();

  const [zeile] = await withUser(db, user.id, (tx) =>
    tx
      .select({
        name: schema.organizations.name,
        website: schema.organizations.website,
        rechtsname: schema.organizations.rechtsname,
        domain: schema.organizations.domain,
        branche: schema.organizations.branche,
        groesse: schema.organizations.groesse,
        hauptsitz: schema.organizations.hauptsitz,
        handelsregister: schema.organizations.handelsregister,
        ustId: schema.organizations.ustId,
        pruefstand: schema.organizations.pruefstand,
      })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organisation.organizationId))
      .limit(1),
  );

  return (
    <div className="grid max-w-[var(--measure)] gap-6">
      <div className="grid gap-2">
        <h1 className="font-display text-2xl font-normal tracking-[-0.02em]">Einstellungen</h1>
        <p className="text-sm leading-relaxed text-ink-2">
          Name und Website erscheinen in jeder Anzeige dieser Organisation.
        </p>
      </div>

      {organisation.verifiziert ? (
        <p className="rounded-(--radius-surface) bg-soft p-4 text-sm leading-relaxed text-ink-2">
          Diese Organisation ist bestätigt. Ihr könnt Stellen veröffentlichen.
        </p>
      ) : (
        <p className="rounded-(--radius-surface) bg-soft p-4 text-sm leading-relaxed text-ink-2">
          Noch nicht bestätigt. Solange wir die Zugehörigkeit zum Unternehmen nicht geprüft haben,
          bleiben eure Stellen Entwürfe — sonst stünde im Stellenindex eine Anzeige, von der das
          Unternehmen nichts weiss.
        </p>
      )}

      <OrgFormular
        orgId={organisation.organizationId}
        name={zeile?.name ?? organisation.name}
        website={zeile?.website ?? ""}
        darfAendern={darf(organisation.rolle, "admin")}
      />

      {/*
        Die Angaben für die Prüfung stehen unter Name und Website.

        Oben das, was in jeder Anzeige erscheint; darunter das, was
        darüber entscheidet, ob überhaupt etwas erscheinen darf.
      */}
      <UnternehmensAngaben
        orgId={organisation.organizationId}
        darfAendern={darf(organisation.rolle, "admin")}
        adresse={user.email ?? ""}
        stand={(zeile?.pruefstand ?? "angaben_fehlen") as Pruefstand}
        start={{
          rechtsname: zeile?.rechtsname ?? "",
          domain: zeile?.domain ?? "",
          branche: zeile?.branche ?? "",
          groesse: zeile?.groesse ?? "",
          hauptsitz: zeile?.hauptsitz ?? "",
          handelsregister: zeile?.handelsregister ?? "",
          ustId: zeile?.ustId ?? "",
        }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import { arbeitgeberKontext } from "@/lib/arbeitgeber/zugang";
import { darf } from "@/lib/arbeitgeber/rollen";
import { profilLaden } from "@/lib/arbeitgeber/profil";
import { ProfilEditor } from "./ProfilEditor";

export const metadata: Metadata = { title: "Unternehmensseite" };
export const dynamic = "force-dynamic";

/**
 * Die Unternehmensseite einrichten.
 *
 * ── Was hier auf dem Server bleibt ────────────────────────────
 *
 * Die Rechteprüfung und der Prüfstand des Unternehmens. Der Editor
 * bekommt beides als Wahrheitswerte übergeben und schaltet danach
 * Knöpfe frei — aber die eigentliche Prüfung passiert noch einmal in
 * der Serveraktion. Ein deaktivierter Knopf ist eine Auskunft an den
 * Nutzer, keine Absicherung: Wer die Aktion direkt aufruft, sieht ihn
 * nie.
 */
export default async function UnternehmensseitePage() {
  const { organisation } = await arbeitgeberKontext();
  const db = await getDb();

  const [org] = await db
    .select({
      slug: schema.organizations.slug,
      verifiedAt: schema.organizations.verifiedAt,
      name: schema.organizations.name,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organisation.organizationId))
    .limit(1);

  const profil = await profilLaden(organisation.organizationId);

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.2rem)] font-semibold tracking-[-0.025em]">
          Unternehmensseite
        </h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
          Was hier steht, sehen Menschen, bevor sie sich bewerben — und {" "}
          {profil?.veroeffentlichtAm ? "die Seite ist veröffentlicht." : "solange nichts veröffentlicht ist, sieht sie niemand ausser eurem Team."}
        </p>
      </div>

      {/*
        Der Hinweis auf die fehlende Prüfung steht oben, nicht am
        Knopf.

        Wer eine Stunde ein Profil ausfüllt und erst beim
        Veröffentlichen erfährt, dass es daran scheitert, hat eine
        Stunde in eine Sackgasse gearbeitet.
      */}
      {!org?.verifiedAt && (
        <p className="rounded-(--radius-md) border border-caution/40 bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink">
          Die Zugehörigkeit zu {org?.name ?? "diesem Unternehmen"} ist noch nicht bestätigt. Ihr
          könnt alles ausfüllen und speichern — veröffentlichen lässt sich die Seite erst danach.
        </p>
      )}

      <ProfilEditor
        organizationId={organisation.organizationId}
        slug={org?.slug ?? null}
        darfVeroeffentlichen={darf(organisation.rolle, "admin")}
        geprueft={Boolean(org?.verifiedAt)}
        start={profil}
      />
    </div>
  );
}

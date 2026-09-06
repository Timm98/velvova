import "server-only";

import { and, count, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";
import type { Schritt } from "@/app/business/Fortschritt";

/**
 * Wie weit die Einrichtung ist.
 *
 * ── Warum jeder Schritt aus den Daten kommt ───────────────────
 *
 * Der bequeme Weg wäre ein Zähler an der Organisation: „Schritt 3 von
 * 5". Der geht bei der ersten Abweichung auseinander — jemand löscht
 * seine Stelle, der Zähler steht weiter auf 5, und die Leiste behauptet
 * eine Einrichtung, die es nicht mehr gibt.
 *
 * Aus den Daten gelesen kann das nicht passieren: Was dasteht, ist
 * erledigt; was fehlt, fehlt.
 */
export async function einrichtungsstand(organizationId: string): Promise<Schritt[]> {
  const db = await getDb();

  const [org] = await db
    .select({
      verifiedAt: schema.organizations.verifiedAt,
      domain: schema.organizations.domain,
      hauptsitz: schema.organizations.hauptsitz,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);

  const [profil] = await db
    .select({ veroeffentlichtAm: schema.unternehmensprofile.veroeffentlichtAm })
    .from(schema.unternehmensprofile)
    .where(eq(schema.unternehmensprofile.organizationId, organizationId))
    .limit(1);

  const [stellen] = await db
    .select({ n: count() })
    .from(schema.jobPostings)
    .where(eq(schema.jobPostings.organizationId, organizationId));

  return [
    { id: "konto", label: "Konto", href: "/business", erledigt: true },
    {
      id: "bestaetigung",
      label: "Bestätigung",
      href: "/bestaetigen",
      erledigt: org?.verifiedAt !== null && org?.verifiedAt !== undefined,
    },
    {
      id: "unternehmen",
      label: "Unternehmen",
      href: "/business/einstellungen",
      /* Angelegt heisst hier: mit Domain und Hauptsitz. Ein Name allein
         reicht für nichts — weder für die Prüfung noch für die Seite. */
      erledigt: Boolean(org?.domain?.trim() && org?.hauptsitz?.trim()),
    },
    {
      id: "seite",
      label: "Unternehmensseite",
      href: "/business/unternehmensseite",
      erledigt: profil?.veroeffentlichtAm !== null && profil?.veroeffentlichtAm !== undefined,
    },
    {
      id: "stelle",
      label: "Erste Stelle",
      href: "/business/stellen",
      erledigt: (stellen?.n ?? 0) > 0,
    },
  ];
}

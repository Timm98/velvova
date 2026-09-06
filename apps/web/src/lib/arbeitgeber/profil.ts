import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@paycheck/db";

/**
 * Das Unternehmensprofil — lesen, schreiben, bewerten.
 *
 * ── Was hier NICHT passiert ───────────────────────────────────
 *
 * Es wird nichts ausgedacht. Fehlt eine Angabe, bleibt sie leer und
 * die öffentliche Seite schreibt „vom Unternehmen noch nicht
 * angegeben". Die naheliegende Versuchung wäre, aus Branche und Grösse
 * einen Standardsatz zu bauen — dann stünde auf der Seite eines
 * Unternehmens ein Satz, den dort niemand geschrieben hat, und wer
 * sich darauf verlässt, verlässt sich auf uns statt auf den
 * Arbeitgeber.
 */

/*
 * Die Feldbeschreibungen und die Bewertung liegen nebenan, in
 * `profil-felder.ts` — sie werden auch im Browser gebraucht, und diese
 * Datei zieht den Datenbanktreiber mit.
 *
 * Hier stehen sie als Re-Export, damit serverseitige Aufrufer nicht
 * aus zwei Dateien importieren müssen.
 */
export {
  ALLE_FELDER,
  BEREICHE,
  ninaHinweise,
  vollstaendigkeit,
  type Bereich,
  type Feld,
  type Profilstand,
  type Wert,
} from "./profil-felder";

import { BEREICHE as _B } from "./profil-felder";
import type { Profilstand as _P } from "./profil-felder";
void _B;

/* ══════════════════════════════════════════════════════════════
   Lesen
   ══════════════════════════════════════════════════════════════ */

/** Der Arbeitsstand eines Unternehmens — Entwurf eingeschlossen. */
export async function profilLaden(organizationId: string): Promise<_P | null> {
  const db = await getDb();
  const [zeile] = await db
    .select()
    .from(schema.unternehmensprofile)
    .where(eq(schema.unternehmensprofile.organizationId, organizationId))
    .limit(1);
  return zeile ?? null;
}

export type OeffentlichesProfil = {
  organisation: { id: string; name: string; slug: string | null; website: string | null; geprueft: boolean };
  profil: _P;
  offeneStellen: number;
};

/**
 * Die öffentliche Seite zu einem Slug.
 *
 * `isNotNull(veroeffentlichtAm)` steht hier zusätzlich zur
 * Zeilenrichtlinie in der Datenbank. Doppelt, mit Absicht: Die
 * Richtlinie ist die Absicherung, diese Bedingung die Absicht. Wer den
 * Code liest, soll nicht in `rls.sql` nachsehen müssen, um zu wissen,
 * dass Entwürfe hier nicht herauskommen.
 */
export async function oeffentlichesProfil(slug: string): Promise<OeffentlichesProfil | null> {
  const db = await getDb();

  const [zeile] = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      slug: schema.organizations.slug,
      website: schema.organizations.website,
      verifiedAt: schema.organizations.verifiedAt,
      profil: schema.unternehmensprofile,
    })
    .from(schema.organizations)
    .innerJoin(
      schema.unternehmensprofile,
      eq(schema.unternehmensprofile.organizationId, schema.organizations.id),
    )
    .where(
      and(
        eq(schema.organizations.slug, slug),
        isNotNull(schema.unternehmensprofile.veroeffentlichtAm),
      ),
    )
    .limit(1);

  if (!zeile) return null;

  const [zahl] = await db
    .select({ n: schema.jobPostings.id })
    .from(schema.jobPostings)
    .where(
      and(
        eq(schema.jobPostings.organizationId, zeile.id),
        eq(schema.jobPostings.status, "published"),
      ),
    );

  return {
    organisation: {
      id: zeile.id,
      name: zeile.name,
      slug: zeile.slug,
      website: zeile.website,
      geprueft: zeile.verifiedAt !== null,
    },
    profil: zeile.profil,
    offeneStellen: zahl ? 1 : 0,
  };
}


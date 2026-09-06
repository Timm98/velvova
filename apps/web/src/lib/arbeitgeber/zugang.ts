import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireVerifiedUser, requireUser, type SessionUser } from "@/lib/auth";
import {
  alsRolle,
  RANG,
  ROLLENNAME,
  type Mitgliedschaft,
  type Rolle,
} from "./rollen.ts";

/**
 * Wer im Arbeitgeberbereich was darf.
 *
 * ── Zwei Linien, nicht eine ───────────────────────────────────
 *
 * Die Zeilensicherheit in der Datenbank ist die zweite Verteidigungs-
 * linie. Sie fängt den vergessenen Filter — aber sie kann nicht
 * unterscheiden, ob jemand eine Stelle veröffentlichen oder nur ansehen
 * darf: Beides ist für Postgres dieselbe Zeile derselben Organisation.
 *
 * Die Rollenprüfung gehört deshalb hierher, VOR jede schreibende
 * Handlung, und sie steht an genau einer Stelle. Verstreute
 * `if (rolle === "admin")` in Formularen sind der Weg, auf dem eine
 * Prüfung beim nächsten Umbau verlorengeht.
 *
 * ── Warum 404 und nicht 403 ───────────────────────────────────
 *
 * Wer nicht zur Organisation gehört, bekommt „nicht gefunden". Ein
 * „kein Zugriff" wäre die Bestätigung, dass es diese Organisation gibt
 * — und die Kennung steht in jedem Link. Genau davon lebt das Absuchen
 * fremder Konten.
 */

export {
  darf,
  ROLLENBESCHREIBUNG,
  ROLLENNAME,
  type Mitgliedschaft,
  type Rolle,
} from "./rollen.ts";

/**
 * Die Organisationen, zu denen jemand gehört.
 *
 * `cache` von React: Auf einer Seite fragen Kopfzeile, Navigation und
 * Inhalt dasselbe. Ohne das wären es drei Abfragen für eine Antwort,
 * die sich innerhalb eines Aufrufs nicht ändern kann.
 */
export const meineOrganisationen = cache(async (userId: string): Promise<Mitgliedschaft[]> => {
  const db = await getDb();
  const zeilen = await withUser(db, userId, (tx) =>
    tx
      .select({
        organizationId: schema.memberships.organizationId,
        rolle: schema.memberships.role,
        name: schema.organizations.name,
        slug: schema.organizations.slug,
        verifiedAt: schema.organizations.verifiedAt,
      })
      .from(schema.memberships)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.memberships.organizationId))
      .where(eq(schema.memberships.userId, userId))
      .orderBy(desc(schema.memberships.createdAt)),
  ).catch((e) => {
    console.error("[arbeitgeber] Mitgliedschaften nicht lesbar:", e);
    return [];
  });

  return zeilen.map((z) => ({
    organizationId: z.organizationId,
    name: z.name,
    slug: z.slug,
    rolle: alsRolle(z.rolle),
    verifiziert: z.verifiedAt !== null,
  }));
});

export interface Arbeitgeberkontext {
  user: SessionUser;
  organisation: Mitgliedschaft;
  alle: Mitgliedschaft[];
}

/**
 * Der Kontext einer Seite im Arbeitgeberbereich.
 *
 * Ohne Mitgliedschaft: `notFound()`. Ohne Organisation überhaupt: zurück
 * zur Einrichtung — jemand ohne Arbeitgeberkonto soll nicht auf einer
 * leeren Seite landen, sondern erfahren, wie er eines bekommt.
 */
export async function arbeitgeberKontext(orgId?: string): Promise<Arbeitgeberkontext> {
  /*
   * Hier reicht eine Anmeldung nicht.
   *
   * Im Arbeitgeberbereich liegen Bewerbungsdaten fremder Menschen. Wer
   * darauf zugreift, muss belegt haben, dass ihm die Adresse gehört,
   * mit der er sich angemeldet hat — sonst genügt eine erfundene
   * Adresse für den Zugang zu echten Bewerbungen.
   */
  const user = await requireVerifiedUser();
  const alle = await meineOrganisationen(user.id);

  if (alle.length === 0) redirect("/business/einrichten");

  const gewaehlt = orgId ? alle.find((o) => o.organizationId === orgId) : alle[0];
  if (!gewaehlt) notFound();

  return { user, organisation: gewaehlt, alle };
}

/**
 * Verlangt eine Mindestrolle — vor jeder schreibenden Handlung.
 *
 * Wirft, statt `false` zurückzugeben. Ein Rückgabewert lässt sich
 * ignorieren, und genau das passiert beim schnellen Hinzufügen einer
 * Aktion: Die Prüfung steht da, ihr Ergebnis wird nicht ausgewertet, und
 * niemand merkt es, weil nichts kaputtgeht.
 */
export async function verlangeRolle(
  orgId: string,
  mindestens: Rolle,
): Promise<{ user: SessionUser; rolle: Rolle }> {
  const user = await requireUser();
  const alle = await meineOrganisationen(user.id);
  const m = alle.find((o) => o.organizationId === orgId);
  if (!m) throw new Error("Kein Zugriff auf diese Organisation.");
  if (RANG[m.rolle] < RANG[mindestens]) {
    throw new Error(
      `Dafür brauchst du mindestens die Rolle „${ROLLENNAME[mindestens]}". Du hast „${ROLLENNAME[m.rolle]}".`,
    );
  }
  return { user, rolle: m.rolle };
}

/** Ob eine Stelle zu dieser Organisation gehört. Sonst `notFound()`. */
export async function verlangeStelle(userId: string, orgId: string, postingId: string) {
  const db = await getDb();
  const [z] = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.jobPostings)
      .where(
        and(eq(schema.jobPostings.id, postingId), eq(schema.jobPostings.organizationId, orgId)),
      )
      .limit(1),
  );
  if (!z) notFound();
  return z;
}

/** Ein Eintrag im Protokoll der Organisation. */
export async function protokolliere(
  userId: string,
  orgId: string,
  type: string,
  subjectId?: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx.insert(schema.organizationEvents).values({
      organizationId: orgId,
      actorUserId: userId,
      type,
      subjectId: subjectId ?? null,
      metadata,
    }),
  ).catch((e) => {
    /*
     * Ein fehlgeschlagenes Protokoll darf die Handlung nicht verhindern.
     *
     * Es ist eine Nachvollziehbarkeitshilfe, kein Teil der Handlung
     * selbst. Wer wegen eines Protokolleintrags eine Absage nicht
     * abschicken kann, hat ein schlimmeres Problem als eine Lücke im
     * Protokoll — aber der Fehler muss sichtbar bleiben.
     */
    console.error("[arbeitgeber] Protokolleintrag fehlgeschlagen:", e);
  });
}

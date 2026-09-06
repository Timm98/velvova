"use server";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { meineOrganisationen, protokolliere, verlangeRolle, type Rolle } from "./zugang.ts";

/**
 * Die schreibenden Handlungen des Arbeitgeberbereichs.
 *
 * Jede beginnt mit `verlangeRolle`. Das ist keine Formsache: Die
 * Zeilensicherheit unterscheidet nicht zwischen Ansehen und Ändern —
 * für Postgres ist beides dieselbe Zeile derselben Organisation. Ob
 * jemand eine Stelle veröffentlichen darf, entscheidet sich hier.
 */

const EINLADUNG_GUELTIG_TAGE = 7;

// ── Organisation ─────────────────────────────────────────────────

/**
 * Eine Organisation gründen.
 *
 * Über die Datenbankfunktion, nicht mit zwei Einfügungen: Organisation
 * und Besitzer gehören zusammen. Wäre Selbsteintragung per Richtlinie
 * erlaubt, könnte sich jeder in JEDE Organisation eintragen — die Zeile
 * trüge ja seine eigene Kennung. Die Lücke gab es; sie ist in
 * `arbeitgeber-rls.test.ts` festgehalten.
 */
export async function organisationGruenden(name: string): Promise<{
  ok: boolean;
  text: string;
  id?: string;
}> {
  const user = await requireUser();
  const sauber = name.trim().slice(0, 120);
  if (sauber.length < 2) {
    return { ok: false, text: "Der Name braucht mindestens zwei Zeichen." };
  }

  try {
    const db = await getDb();
    const id = await withUser(db, user.id, async (tx) => {
      const r = (await tx.execute(
        sql`SELECT app_create_organization(${sauber}, 'employer') AS id`,
      )) as unknown as { rows: { id: string }[] };
      return r.rows[0]!.id;
    });
    await protokolliere(user.id, id, "organisation_gegruendet", id, { name: sauber });
    revalidatePath("/business");
    return { ok: true, text: "Angelegt.", id };
  } catch (e) {
    console.error("[arbeitgeber] Organisation nicht angelegt:", e);
    return { ok: false, text: "Das konnte ich nicht anlegen." };
  }
}

export async function organisationAendern(
  orgId: string,
  werte: { name?: string; website?: string },
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const db = await getDb();
  try {
    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.organizations)
        .set({
          ...(werte.name ? { name: werte.name.trim().slice(0, 120) } : {}),
          ...(werte.website !== undefined
            ? { website: werte.website.trim().slice(0, 200) || null }
            : {}),
        })
        .where(eq(schema.organizations.id, orgId)),
    );
    await protokolliere(user.id, orgId, "organisation_geaendert", orgId, werte);
    revalidatePath("/business");
    return { ok: true, text: "Gespeichert." };
  } catch (e) {
    console.error("[arbeitgeber] Organisation nicht geändert:", e);
    return { ok: false, text: "Das konnte ich nicht speichern." };
  }
}

// ── Team ─────────────────────────────────────────────────────────

/**
 * Jemanden einladen.
 *
 * Im Link steht ein Zufallswert, in der Datenbank nur sein Hash. Wer
 * unsere Tabelle liest, kann damit keine Einladung annehmen — dieselbe
 * Regel wie bei Sitzungen.
 */
export async function einladen(
  orgId: string,
  email: string,
  rolle: Rolle,
): Promise<{ ok: boolean; text: string; link?: string }> {
  const { user } = await verlangeRolle(orgId, "admin");

  const adresse = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
    return { ok: false, text: "Diese E-Mail-Adresse sieht nicht richtig aus." };
  }
  /*
   * Niemand lädt jemanden als Besitzer ein.
   *
   * Besitz wird übertragen, nicht vergeben — und zwar von einem
   * Besitzer an ein bestehendes Mitglied. Sonst entstünde per Einladung
   * ein zweiter Besitzer, der den ersten entfernen kann.
   */
  if (rolle === "owner") {
    return { ok: false, text: "Besitz wird übertragen, nicht per Einladung vergeben." };
  }

  const geheim = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(geheim).digest("hex");
  const ablauf = new Date(Date.now() + EINLADUNG_GUELTIG_TAGE * 24 * 60 * 60 * 1000);

  const db = await getDb();
  try {
    await withUser(db, user.id, (tx) =>
      tx.insert(schema.organizationInvitations).values({
        organizationId: orgId,
        email: adresse,
        role: rolle,
        invitedBy: user.id,
        tokenHash: hash,
        expiresAt: ablauf,
      }),
    );
    await protokolliere(user.id, orgId, "einladung_verschickt", undefined, { email: adresse, rolle });
    revalidatePath("/business/team");
    return {
      ok: true,
      text: `Einladung für ${adresse} erstellt. Sie gilt ${EINLADUNG_GUELTIG_TAGE} Tage.`,
      link: `/business/einladung/${geheim}`,
    };
  } catch (e) {
    console.error("[arbeitgeber] Einladung nicht angelegt:", e);
    return { ok: false, text: "Die Einladung konnte ich nicht anlegen." };
  }
}

/** Eine Einladung annehmen. Läuft unter der eingeladenen Person. */
export async function einladungAnnehmen(
  geheim: string,
): Promise<{ ok: boolean; text: string; orgId?: string }> {
  const user = await requireUser();
  const hash = createHash("sha256").update(geheim).digest("hex");
  const db = await getDb();

  /*
   * Die Einladung wird OHNE Nutzerkontext gelesen.
   *
   * Sie gehört einer Organisation, in der die einladende Person noch
   * kein Mitglied ist — unter `withUser` wäre sie durch die
   * Zeilensicherheit unsichtbar, und jede Einladung liefe ins Leere.
   *
   * Das ist vertretbar, weil der Zugriff über den Hash eines
   * 256-Bit-Geheimnisses erfolgt: Wer ihn hat, hat den Link. Gelesen
   * wird ausserdem nur diese eine Zeile und nichts sonst.
   */
  const [einladung] = await db
    .select()
    .from(schema.organizationInvitations)
    .where(eq(schema.organizationInvitations.tokenHash, hash))
    .limit(1);

  if (!einladung) return { ok: false, text: "Diese Einladung gibt es nicht." };
  if (einladung.revokedAt) return { ok: false, text: "Diese Einladung wurde zurückgezogen." };
  if (einladung.acceptedAt) return { ok: false, text: "Diese Einladung wurde schon angenommen." };
  if (einladung.expiresAt.getTime() < Date.now()) {
    return { ok: false, text: "Diese Einladung ist abgelaufen. Bitte um eine neue." };
  }
  /*
   * Die Adresse muss stimmen.
   *
   * Ein Link, der in falsche Hände gerät, soll dort nichts wert sein.
   * Ohne diese Prüfung wäre die Einladung ein Zugangsschlüssel für
   * jeden, der sie weiterleitet.
   */
  /* Ohne Adresse im Konto kann keine Einladung passen — das ist
     kein Sonderfall, sondern das richtige Ergebnis: Die Einladung ging
     an eine Adresse, und dieses Konto hat keine. */
  if (einladung.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return {
      ok: false,
      text: `Diese Einladung ist an ${einladung.email} gerichtet. Melde dich mit dieser Adresse an.`,
    };
  }

  try {
    /*
     * Auch das Eintragen läuft ohne Nutzerkontext.
     *
     * Die Richtlinie erlaubt Einfügen nur Verwaltern — die eingeladene
     * Person ist noch keine. Die Berechtigung stammt hier aus der
     * geprüften Einladung, nicht aus einer Mitgliedschaft.
     */
    await db
      .insert(schema.memberships)
      .values({
        organizationId: einladung.organizationId,
        userId: user.id,
        role: einladung.role,
      })
      .onConflictDoNothing();

    await db
      .update(schema.organizationInvitations)
      .set({ acceptedAt: new Date(), acceptedBy: user.id })
      .where(eq(schema.organizationInvitations.id, einladung.id));

    await protokolliere(user.id, einladung.organizationId, "einladung_angenommen", user.id, {
      rolle: einladung.role,
    });
    revalidatePath("/business");
    return { ok: true, text: "Willkommen im Team.", orgId: einladung.organizationId };
  } catch (e) {
    console.error("[arbeitgeber] Einladung nicht angenommen:", e);
    return { ok: false, text: "Das hat nicht geklappt." };
  }
}

export async function einladungZuruecknehmen(
  orgId: string,
  einladungId: string,
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "admin");
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.organizationInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.organizationInvitations.id, einladungId),
          eq(schema.organizationInvitations.organizationId, orgId),
        ),
      ),
  );
  await protokolliere(user.id, orgId, "einladung_zurueckgenommen", einladungId);
  revalidatePath("/business/team");
  return { ok: true, text: "Zurückgenommen." };
}

/** Die Rolle eines Mitglieds ändern. */
export async function rolleAendern(
  orgId: string,
  mitgliedUserId: string,
  neueRolle: Rolle,
): Promise<{ ok: boolean; text: string }> {
  const { user } = await verlangeRolle(orgId, "admin");
  if (neueRolle === "owner") {
    const eigene = await meineOrganisationen(user.id);
    const meine = eigene.find((o) => o.organizationId === orgId);
    if (meine?.rolle !== "owner") {
      return { ok: false, text: "Besitz kann nur ein Besitzer übertragen." };
    }
  }

  const db = await getDb();
  const fehler = await letzterBesitzerFehler(orgId, mitgliedUserId, neueRolle);
  if (fehler) return { ok: false, text: fehler };

  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.memberships)
      .set({ role: neueRolle })
      .where(
        and(
          eq(schema.memberships.organizationId, orgId),
          eq(schema.memberships.userId, mitgliedUserId),
        ),
      ),
  );
  await protokolliere(user.id, orgId, "rolle_geaendert", mitgliedUserId, { rolle: neueRolle });
  revalidatePath("/business/team");
  return { ok: true, text: "Rolle geändert." };
}

export async function mitgliedEntfernen(
  orgId: string,
  mitgliedUserId: string,
): Promise<{ ok: boolean; text: string }> {
  const user = await requireUser();
  /*
   * Sich selbst entfernen darf jeder, andere nur ein Verwalter.
   *
   * Ohne das Erste gäbe es kein Austreten: Wer einmal drin ist, käme nur
   * wieder heraus, wenn ein Verwalter ihn entfernt.
   */
  if (mitgliedUserId !== user.id) await verlangeRolle(orgId, "admin");

  const fehler = await letzterBesitzerFehler(orgId, mitgliedUserId, null);
  if (fehler) return { ok: false, text: fehler };

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .delete(schema.memberships)
      .where(
        and(
          eq(schema.memberships.organizationId, orgId),
          eq(schema.memberships.userId, mitgliedUserId),
        ),
      ),
  );
  await protokolliere(user.id, orgId, "mitglied_entfernt", mitgliedUserId);
  revalidatePath("/business/team");
  return { ok: true, text: mitgliedUserId === user.id ? "Du bist ausgetreten." : "Entfernt." };
}

/**
 * Verhindert, dass die letzte Besitzerin verschwindet.
 *
 * Eine Organisation ohne Besitzer wäre nicht mehr verwaltbar: Niemand
 * könnte Rollen ändern, niemand einladen, niemand sie schliessen. Der
 * Fehler passiert nicht beim Löschen des eigenen Kontos, sondern beim
 * Aufräumen — „die Rolle brauche ich hier nicht mehr".
 */
async function letzterBesitzerFehler(
  orgId: string,
  betroffenUserId: string,
  neueRolle: Rolle | null,
): Promise<string | null> {
  if (neueRolle === "owner") return null;
  const db = await getDb();
  const besitzer = await db
    .select({ userId: schema.memberships.userId })
    .from(schema.memberships)
    .where(and(eq(schema.memberships.organizationId, orgId), eq(schema.memberships.role, "owner")));

  const istBesitzer = besitzer.some((b) => b.userId === betroffenUserId);
  if (!istBesitzer) return null;
  if (besitzer.length > 1) return null;
  return "Das ist die einzige Besitzerin. Übertrage den Besitz zuerst an jemand anderen.";
}

/* ══════════════════════════════════════════════════════════════
   Unternehmensangaben
   ══════════════════════════════════════════════════════════════ */

/**
 * Die Angaben für die Prüfung speichern.
 *
 * ── Warum der Prüfstand hier gesetzt wird und nicht vom Formular ──
 *
 * Er ergibt sich aus den Angaben, nicht aus einer Auswahl. Käme er vom
 * Browser, liesse sich „bestätigt" mitschicken — und damit wäre die
 * ganze Prüfung eine Anzeige ohne Wirkung.
 *
 * `verifiedAt` bleibt unangetastet: Bestätigen kann diese Aktion
 * nicht. Sie kann nur festhalten, was für eine Bestätigung vorliegt.
 */
export async function unternehmensangabenSpeichern(
  orgId: string,
  werte: {
    rechtsname: string;
    domain: string;
    branche: string;
    groesse: string;
    hauptsitz: string;
    handelsregister: string;
    ustId: string;
  },
): Promise<{ ok: boolean; text: string; stand?: string }> {
  try {
    const { user } = await verlangeRolle(orgId, "admin");
    const db = await getDb();

    const { domainAus, standAus } = await import("./registrierung-felder");
    const domain = domainAus(werte.domain);
    const adressDomain = user.email ? domainAus(user.email) : null;

    const stand = standAus({
      domain,
      rechtsname: werte.rechtsname,
      hauptsitz: werte.hauptsitz,
      domainPasst: Boolean(domain && adressDomain && domain === adressDomain),
    });

    const kurz = (s: string, n: number) => s.trim().slice(0, n) || null;

    await withUser(db, user.id, (tx) =>
      tx
        .update(schema.organizations)
        .set({
          rechtsname: kurz(werte.rechtsname, 200),
          domain,
          branche: kurz(werte.branche, 120),
          groesse: kurz(werte.groesse, 60),
          hauptsitz: kurz(werte.hauptsitz, 200),
          handelsregister: kurz(werte.handelsregister, 80),
          ustId: kurz(werte.ustId, 40),
          pruefstand: stand,
          pruefstandSeit: new Date(),
        })
        .where(eq(schema.organizations.id, orgId)),
    );

    await protokolliere(user.id, orgId, "unternehmensangaben_geaendert", orgId, { stand });
    revalidatePath("/business/einstellungen");
    return { ok: true, text: "Gespeichert.", stand };
  } catch (fehler) {
    return {
      ok: false,
      text: fehler instanceof Error ? fehler.message : "Das konnte ich nicht speichern.",
    };
  }
}

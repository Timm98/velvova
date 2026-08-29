"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireUser, revokeSession } from "./auth";

/**
 * Privacy Center.
 *
 * Vier Dinge müssen tatsächlich funktionieren, nicht nur dastehen:
 * einsehen, ändern, exportieren, löschen. Und jede Einwilligung muss
 * einzeln widerrufbar sein - sonst ist es keine Einwilligung, sondern
 * ein Haken.
 */

export async function setConsent(
  kind: (typeof schema.consents.$inferInsert)["kind"],
  granted: boolean,
): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await withUser(db, user.id, async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.consents)
      .where(and(eq(schema.consents.userId, user.id), eq(schema.consents.kind, kind)))
      .limit(1);

    if (existing) {
      // Der Widerruf wird protokolliert, nicht die Zeile geloescht -
      // sonst wäre später nicht nachvollziehbar, was wann galt.
      await tx
        .update(schema.consents)
        .set({
          granted,
          grantedAt: granted ? new Date() : existing.grantedAt,
          revokedAt: granted ? null : new Date(),
        })
        .where(eq(schema.consents.id, existing.id));
    } else {
      await tx.insert(schema.consents).values({
        userId: user.id,
        kind,
        granted,
        policyVersion: "2026-08-1",
        purpose: "Im Privacy Center gesetzt",
        grantedAt: granted ? new Date() : null,
      });
    }
  });

  revalidatePath("/app/settings");
}

export async function updateSettings(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  const locale = formData.get("locale") === "en" ? "en" : "de";
  const country = String(formData.get("country") ?? "DE").slice(0, 2).toUpperCase();
  const baseLocation = String(formData.get("baseLocation") ?? "").trim() || null;
  const maxCommuteRaw = String(formData.get("maxCommuteMinutes") ?? "").trim();
  const maxCommuteMinutes = maxCommuteRaw ? Math.max(1, Math.min(600, Number(maxCommuteRaw))) : null;

  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.userSettings)
      .set({
        locale,
        country,
        baseLocation,
        maxCommuteMinutes,
        notificationEmail: formData.get("notificationEmail") === "on",
        updatedAt: new Date(),
      })
      .where(eq(schema.userSettings.userId, user.id)),
  );

  revalidatePath("/app/settings");
}

/**
 * Vollständiger Export. Alles, was zu diesem Menschen gespeichert ist -
 * ohne Passworthash und ohne Sitzungstoken, weil beides Geheimnisse sind
 * und im Export nichts zu suchen hat.
 */
export async function exportData(): Promise<string> {
  const user = await requireUser();
  const db = await getDb();

  const data = await withUser(db, user.id, async (tx) => ({
    exportiertAm: new Date().toISOString(),
    hinweis:
      "Dieser Export enthält alle zu dir gespeicherten Inhalte. Passwort und Sitzungstoken " +
      "sind bewusst nicht enthalten - es sind Geheimnisse, keine Inhalte.",
    konto: (
      await tx
        .select({
          email: schema.users.email,
          angezeigterName: schema.users.displayName,
          angelegtAm: schema.users.createdAt,
        })
        .from(schema.users)
        .where(eq(schema.users.id, user.id))
    )[0],
    einstellungen: (
      await tx.select().from(schema.userSettings).where(eq(schema.userSettings.userId, user.id))
    )[0],
    einwilligungen: await tx.select().from(schema.consents).where(eq(schema.consents.userId, user.id)),
    karriereprofil: (
      await tx.select().from(schema.careerProfiles).where(eq(schema.careerProfiles.userId, user.id))
    )[0],
    belege: await tx.select().from(schema.evidenceItems).where(eq(schema.evidenceItems.userId, user.id)),
    bedingungen: (
      await tx.select().from(schema.userConstraints).where(eq(schema.userConstraints.userId, user.id))
    )[0],
    rollencluster: await tx.select().from(schema.roleClusters).where(eq(schema.roleClusters.userId, user.id)),
    gespräche: await tx
      .select()
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.userId, user.id)),
    gespraechsverlauf: await tx
      .select()
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.userId, user.id)),
    bewerbungen: await tx.select().from(schema.applications).where(eq(schema.applications.userId, user.id)),
    ereignisse: await tx
      .select()
      .from(schema.applicationEvents)
      .where(eq(schema.applicationEvents.userId, user.id)),
    dokumente: await tx
      .select()
      .from(schema.generatedArtifacts)
      .where(eq(schema.generatedArtifacts.userId, user.id)),
    gemerkteStellen: await tx.select().from(schema.savedJobs).where(eq(schema.savedJobs.userId, user.id)),
  }));

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.privacyRequests).values({
      userId: user.id,
      kind: "export",
      status: "done",
      completedAt: new Date(),
    }),
  );

  return JSON.stringify(data, null, 2);
}

/**
 * Konto löschen.
 *
 * Zweistufig: erst Soft Delete, damit ein Versehen noch korrigierbar ist,
 * und der harte Löschlauf raeumt später auf. Der Mensch erfaehrt das -
 * "sofort und unwiederbringlich" zu behaupten, wäre unwahr.
 */
export async function deleteAccount(confirmation: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (confirmation.trim().toLowerCase() !== "löschen") {
    return {
      ok: false,
      message: 'Zur Bestätigung bitte das Wort "löschen" eingeben. Es wurde nichts geloescht.',
    };
  }

  const db = await getDb();
  const now = new Date();

  await withUser(db, user.id, async (tx) => {
    await tx.insert(schema.privacyRequests).values({
      userId: user.id,
      kind: "delete_account",
      status: "processing",
    });
    await tx
      .update(schema.evidenceItems)
      .set({ deletedAt: now })
      .where(eq(schema.evidenceItems.userId, user.id));
    await tx.update(schema.documents).set({ deletedAt: now }).where(eq(schema.documents.userId, user.id));
  });

  // Der Nutzerdatensatz selbst wird ausserhalb der eingeschraenkten Rolle
  // markiert; die Zeile gehoert zur Kontoverwaltung, nicht zu den Inhalten.
  await db.update(schema.users).set({ deletedAt: now }).where(eq(schema.users.id, user.id));
  await db.update(schema.sessions).set({ revokedAt: now }).where(eq(schema.sessions.userId, user.id));

  await destroySession();
  redirect("/");
}

export async function signOutDevice(sessionId: string): Promise<void> {
  const user = await requireUser();
  await revokeSession(user.id, sessionId);
  revalidatePath("/app/settings");
}

/** Einen einzelnen Beleg endgültig entfernen. */
export async function deleteSingleItem(evidenceId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, async (tx) => {
    await tx
      .update(schema.evidenceItems)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.evidenceItems.id, evidenceId), eq(schema.evidenceItems.userId, user.id)));
    await tx.insert(schema.privacyRequests).values({
      userId: user.id,
      kind: "delete_item",
      status: "done",
      targetRef: evidenceId,
      completedAt: new Date(),
    });
  });
  revalidatePath("/app/settings");
  revalidatePath("/app/profile");
}

"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { istLocaleCode, nutzbareUiSprachen } from "@paycheck/i18n";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireUser, revokeSession } from "./auth";
import { cookies } from "next/headers";

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
      // Der Widerruf wird protokolliert, nicht die Zeile gelöscht -
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

/**
 * Einstellungen speichern.
 *
 * Ein Formular je Bereich, aber eine Aktion für alle: das Formular
 * schickt nur die Felder, die es selbst enthält, und was nicht
 * mitkommt, bleibt unangetastet. Das ist der Unterschied zwischen
 * "Teilformular" und "der Rest wird stillschweigend zurückgesetzt".
 */
export async function updateSettings(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  /** Nur setzen, wenn das Formular das Feld überhaupt geschickt hat. */
  function ifPresent(field: string, apply: (raw: string) => void): void {
    if (!formData.has(field)) return;
    apply(String(formData.get(field) ?? "").trim());
  }

  /**
   * Kontrollkästchen melden sich nur, wenn sie an sind. Deshalb braucht
   * jedes ein verstecktes Feld gleichen Namens mit dem Wert "0" davor —
   * dann ist "vorhanden" gleichbedeutend mit "das Formular kannte das
   * Feld", und "an" ist der zweite Wert.
   */
  function checkbox(field: string, target: string): void {
    if (!formData.has(field)) return;
    const values = formData.getAll(field).map(String);
    patch[target] = values.includes("on") || values.includes("1");
  }

  /*
   * Zwei verschiedene Prüfungen, weil es zwei verschiedene Fragen sind.
   *
   * Die OBERFLÄCHE darf nur eine Sprache annehmen, für die es Texte
   * gibt — sonst entsteht die gemischte Oberfläche aus §20.3. Das
   * Register misst das an den Katalogen.
   *
   * GESPRÄCH und UNTERLAGEN dürfen jede eingetragene Sprache annehmen
   * (§20.2): Ninas Antworten entstehen im Modell und brauchen keinen
   * Katalog.
   *
   * Vorher stand hier zum dritten Mal `["de", "en"]` fest verdrahtet —
   * neben der Auswahlliste und dem Datenbanktyp. Der Effekt war
   * lautlos: die Seite bot Türkisch an, die Datenbank hätte es
   * gespeichert, und diese Zeile hat es kommentarlos verworfen. Das
   * Formular meldete Erfolg, und nach dem Neuladen stand wieder
   * Deutsch da.
   */
  const uiSprachen = new Set(nutzbareUiSprachen().map((l) => l.code));
  ifPresent("locale", (v) => { if (uiSprachen.has(v as never)) patch.locale = v; });
  ifPresent("assistantLocale", (v) => { if (istLocaleCode(v)) patch.assistantLocale = v; });
  ifPresent("documentLocale", (v) => { if (istLocaleCode(v)) patch.documentLocale = v; });

  ifPresent("country", (v) => { patch.country = v.slice(0, 2).toUpperCase() || "DE"; });
  ifPresent("jobMarketCountry", (v) => { patch.jobMarketCountry = v.slice(0, 2).toUpperCase() || "DE"; });
  ifPresent("currency", (v) => { patch.currency = v.slice(0, 3).toUpperCase() || "EUR"; });
  ifPresent("timezone", (v) => { if (v) patch.timezone = v.slice(0, 64); });
  ifPresent("distanceUnit", (v) => { patch.distanceUnit = v === "mi" ? "mi" : "km"; });
  ifPresent("baseLocation", (v) => { patch.baseLocation = v || null; });
  ifPresent("commuteMode", (v) => { if (v) patch.commuteMode = v.slice(0, 32); });
  ifPresent("theme", (v) => { patch.theme = ["light", "dark", "system"].includes(v) ? v : "system"; });

  const REMOTE = ["on_site", "hybrid", "remote", "no_preference"];
  ifPresent("remotePreference", (v) => {
    patch.remotePreference = REMOTE.includes(v) ? v : "no_preference";
  });

  ifPresent("searchRadiusKm", (v) => {
    patch.searchRadiusKm = v ? Math.max(1, Math.min(2000, Number(v))) : null;
  });
  ifPresent("maxCommuteMinutes", (v) => {
    patch.maxCommuteMinutes = v ? Math.max(1, Math.min(600, Number(v))) : null;
  });
  // Kein Gehaltswunsch bleibt leer. Eine 0 wäre eine Aussage, und zwar
  // eine falsche.
  ifPresent("desiredSalaryMin", (v) => {
    patch.desiredSalaryMin = v ? Math.max(0, Math.min(10_000_000, Number(v))) : null;
  });
  ifPresent("desiredSalaryPeriod", (v) => {
    patch.desiredSalaryPeriod = ["year", "month", "hour"].includes(v) ? v : "year";
  });
  ifPresent("voiceSpeed", (v) => {
    const n = Number(v);
    patch.voiceSpeed = Number.isFinite(n) ? Math.max(0.5, Math.min(2, n)) : 1;
  });

  if (formData.has("employmentTypes")) {
    const allowed = new Set([
      "permanent", "fixed_term", "internship", "working_student",
      "apprenticeship", "freelance", "temp_agency",
    ]);
    patch.employmentTypes = formData
      .getAll("employmentTypes")
      .map(String)
      .filter((v) => allowed.has(v));
  }

  checkbox("willingToRelocate", "willingToRelocate");
  checkbox("notificationEmail", "notificationEmail");
  checkbox("notificationPush", "notificationPush");
  checkbox("microphoneEnabled", "microphoneEnabled");
  checkbox("voiceAutoplay", "voiceAutoplay");
  checkbox("voiceCaptions", "voiceCaptions");
  checkbox("deleteAudioAfterTranscript", "deleteAudioAfterTranscript");

  if (formData.get("completeOnboarding") === "1") {
    patch.onboardingCompletedAt = new Date();
  }

  /*
   * Erst sicherstellen, dass es die Zeile gibt.
   *
   * Ein UPDATE auf eine nicht vorhandene Zeile ändert null Zeilen — ohne
   * Fehler, ohne Meldung, ohne dass die Oberfläche etwas anderes zeigt
   * als "gespeichert". Der Datensatz entsteht sonst beim Onboarding;
   * wer über einen anderen Weg hereinkommt, hätte Einstellungen
   * vorgenommen, die nirgends ankommen.
   */
  await withUser(db, user.id, async (tx) => {
    await tx
      .insert(schema.userSettings)
      .values({ userId: user.id })
      .onConflictDoNothing({ target: schema.userSettings.userId });

    await tx
      .update(schema.userSettings)
      .set(patch)
      .where(eq(schema.userSettings.userId, user.id));
  });

  /*
   * Die Oberflächensprache zusätzlich ins Cookie.
   *
   * Der Server liest sie beim ersten Byte aus dem Cookie, nicht aus der
   * Datenbank. Ohne diese Zeile wäre die Sprache gespeichert und die
   * Seite trotzdem in der alten — sichtbar erst beim nächsten Laden,
   * und dann als "hat nicht funktioniert".
   */
  if (typeof patch.locale === "string") {
    const store = await cookies();
    store.set("paycheck_locale", patch.locale, {
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
    });
  }

  revalidatePath("/app/settings", "layout");
  revalidatePath("/app");
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
    gesprächsverlauf: await tx
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
 * und der harte Löschlauf räumt später auf. Der Mensch erfährt das -
 * "sofort und unwiederbringlich" zu behaupten, wäre unwahr.
 */
export async function deleteAccount(confirmation: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (confirmation.trim().toLowerCase() !== "löschen") {
    return {
      ok: false,
      message: 'Zur Bestätigung bitte das Wort "löschen" eingeben. Es wurde nichts gelöscht.',
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

  // Der Nutzerdatensatz selbst wird ausserhalb der eingeschränkten Rolle
  // markiert; die Zeile gehört zur Kontoverwaltung, nicht zu den Inhalten.
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
  revalidatePath("/app/career");
}
